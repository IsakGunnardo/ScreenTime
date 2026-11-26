using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Auth;
using ScreenTime.Api.Data;
using ScreenTime.Api.Domain;
using ScreenTime.Api.Services;

namespace ScreenTime.Api.Endpoints;

public record DecisionRequest(string? Comment);

public static class ChoreEndpoints
{
    public static void MapChores(this RouteGroupBuilder api)
    {
        var authed = api.MapGroup("").RequireAuthorization();
        var childOnly = api.MapGroup("").RequireAuthorization("Child");
        var parentOnly = api.MapGroup("").RequireAuthorization("Parent");

        // ---------- Läsa (barnet självt eller förälder i samma familj) ----------

        authed.MapGet("/children/{childId:guid}/today", async (Guid childId, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            var child = await db.Children.FindAsync(childId);
            if (child is null || !CanSee(user, child)) return Results.NotFound();

            var today = Clock.Today();
            var existing = await db.ChoreInstances.Where(i => i.ChildId == childId && i.Date == today)
                .Select(i => i.ChoreId).ToListAsync();
            var missing = await db.Chores.Where(c => c.FamilyId == child.FamilyId && !existing.Contains(c.Id)).ToListAsync();
            foreach (var chore in missing)
            {
                db.ChoreInstances.Add(new ChoreInstance
                {
                    ChildId = childId, ChoreId = chore.Id, Date = today,
                    Minutes = chore.Minutes, Xp = chore.Xp, Coins = chore.Coins,
                });
            }
            if (missing.Count > 0)
            {
                try { await db.SaveChangesAsync(); }
                catch (DbUpdateException)
                {
                    // Ett parallellt anrop hann skapa dagens uppdrag först (unikt index) — använd dem.
                    db.ChangeTracker.Clear();
                }
            }

            var instances = await db.ChoreInstances.Include(i => i.Chore)
                .Where(i => i.ChildId == childId && i.Date == today)
                .OrderBy(i => i.Minutes).ToListAsync();

            return Results.Ok(new
            {
                child = await Mapping.SummarizeAsync(db, child, today),
                chores = instances.Select(i => i.ToDto(signer)),
            });
        });

        authed.MapGet("/instances/{id:guid}", async (Guid id, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
            await Load(db, id) is { } i && CanSee(user, i.Child) ? Results.Ok(i.ToDto(signer)) : Results.NotFound());

        // ---------- Barnets handlingar (bara på egna uppdrag) ----------

        childOnly.MapPost("/instances/{id:guid}/start", async (Guid id, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            var i = await LoadOwn(db, id, user);
            if (i is null) return Results.NotFound();
            if (i.Status is not (ChoreStatus.Available or ChoreStatus.Returned))
                return Http.Conflict($"Kan inte starta en syssla med status {i.Status}");
            i.Status = ChoreStatus.InProgress;
            await db.SaveChangesAsync();
            return Results.Ok(i.ToDto(signer));
        });

        childOnly.MapPost("/instances/{id:guid}/photo", async (Guid id, HttpRequest request, ClaimsPrincipal user, AppDb db,
            PhotoStore photos, PhotoVerificationService verifier, PhotoUrlSigner signer, CancellationToken ct) =>
        {
            var i = await LoadOwn(db, id, user);
            if (i is null) return Results.NotFound();
            if (i.Status != ChoreStatus.InProgress) return Http.Conflict("Starta sysslan innan du tar foto");
            if (!request.HasFormContentType) return Http.BadRequest("Skicka bilden som multipart/form-data");

            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("photo");
            if (file is null || file.Length == 0) return Http.BadRequest("Fältet 'photo' saknas");
            if (file.Length > 8 * 1024 * 1024) return Http.BadRequest("Bilden är för stor (max 8 MB)");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var bytes = ms.ToArray();
            if (!IsJpeg(bytes)) return Http.BadRequest("Bilden måste vara JPEG");

            photos.Delete(i.PhotoFileName); // ersätt tidigare foto vid omtagning
            i.PhotoFileName = await photos.SaveAsync(bytes, ct);
            i.PhotoTakenAt = DateTimeOffset.UtcNow;
            i.AiComplete = null; i.AiConfidence = null; i.AiFeedbackChild = null; i.AiFeedbackParent = null;

            if (i.Chore.AiCheckKey is { } key)
            {
                var result = await verifier.VerifyAsync(bytes, key, i.Chore.Title, ct);
                if (result is not null)
                {
                    i.AiComplete = result.Complete;
                    i.AiConfidence = result.Confidence;
                    i.AiFeedbackChild = result.FeedbackChild;
                    i.AiFeedbackParent = result.FeedbackParent;
                }
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(i.ToDto(signer));
        }).DisableAntiforgery();

        childOnly.MapPost("/instances/{id:guid}/submit", async (Guid id, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            var i = await LoadOwn(db, id, user);
            if (i is null) return Results.NotFound();
            if (i.Status != ChoreStatus.InProgress) return Http.Conflict($"Kan inte skicka in en syssla med status {i.Status}");
            if (i.Chore.RequiresPhoto && i.PhotoFileName is null) return Http.BadRequest("Den här sysslan kräver ett foto");
            i.Status = ChoreStatus.Submitted;
            i.SubmittedAt = DateTimeOffset.UtcNow;
            i.ParentComment = null;
            await db.SaveChangesAsync();
            return Results.Ok(i.ToDto(signer));
        });

        // ---------- Förälderns handlingar (bara i egen familj) ----------

        parentOnly.MapGet("/parent/queue", async (ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            var fid = user.FamilyId();
            var items = await db.ChoreInstances.Include(i => i.Chore).Include(i => i.Child)
                .Where(i => i.Status == ChoreStatus.Submitted && i.Child.FamilyId == fid)
                .ToListAsync();
            return items.OrderBy(i => i.SubmittedAt)
                .Select(i => new { childName = i.Child.Name, childAvatar = i.Child.AvatarEmoji, chore = i.ToDto(signer) });
        });

        parentOnly.MapPost("/instances/{id:guid}/approve", async (Guid id, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var i = await LoadInFamily(db, id, user);
            if (i is null) return Results.NotFound();
            if (i.Status == ChoreStatus.Approved) return Results.Ok(i.ToDto(signer)); // idempotent
            if (i.Status != ChoreStatus.Submitted) return Http.Conflict($"Kan inte godkänna en syssla med status {i.Status}");

            i.Status = ChoreStatus.Approved;
            i.DecidedAt = DateTimeOffset.UtcNow;
            i.DecidedByParentId = user.UserId();
            db.Ledger.AddRange(
                new LedgerEntry { ChildId = i.ChildId, Currency = Currency.Minutes, Amount = i.Minutes, Type = "chore_approved", ChoreInstanceId = i.Id },
                new LedgerEntry { ChildId = i.ChildId, Currency = Currency.Coins, Amount = i.Coins, Type = "chore_approved", ChoreInstanceId = i.Id },
                new LedgerEntry { ChildId = i.ChildId, Currency = Currency.Xp, Amount = i.Xp, Type = "chore_approved", ChoreInstanceId = i.Id });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Ok(i.ToDto(signer));
        });

        parentOnly.MapPost("/instances/{id:guid}/return", async (Guid id, DecisionRequest body, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            var i = await LoadInFamily(db, id, user);
            if (i is null) return Results.NotFound();
            if (i.Status != ChoreStatus.Submitted) return Http.Conflict($"Kan inte skicka tillbaka en syssla med status {i.Status}");
            i.Status = ChoreStatus.Returned;
            i.ParentComment = string.IsNullOrWhiteSpace(body.Comment) ? "Nästan! Kolla en gång till 😊" : body.Comment.Trim();
            i.DecidedAt = DateTimeOffset.UtcNow;
            i.DecidedByParentId = user.UserId();
            await db.SaveChangesAsync();
            return Results.Ok(i.ToDto(signer));
        });

        parentOnly.MapPost("/instances/{id:guid}/reject", async (Guid id, DecisionRequest body, ClaimsPrincipal user, AppDb db, PhotoUrlSigner signer) =>
        {
            var i = await LoadInFamily(db, id, user);
            if (i is null) return Results.NotFound();
            if (i.Status != ChoreStatus.Submitted) return Http.Conflict($"Kan inte neka en syssla med status {i.Status}");
            i.Status = ChoreStatus.Rejected;
            i.ParentComment = body.Comment?.Trim();
            i.DecidedAt = DateTimeOffset.UtcNow;
            i.DecidedByParentId = user.UserId();
            await db.SaveChangesAsync();
            return Results.Ok(i.ToDto(signer));
        });

        // ---------- Foton (signerad URL, ingen header behövs) ----------

        api.MapGet("/photos/{fileName}", (string fileName, long exp, string? sig, PhotoStore photos, PhotoUrlSigner signer) =>
        {
            if (!signer.Verify(fileName, exp, sig)) return Results.NotFound();
            return photos.PathFor(fileName) is { } path ? Results.File(path, "image/jpeg") : Results.NotFound();
        });
    }

    /// <summary>Barnet ser sig självt; föräldrar ser alla barn i sin familj.</summary>
    private static bool CanSee(ClaimsPrincipal user, Child child) =>
        user.IsParent() ? child.FamilyId == user.FamilyId() : child.Id == user.UserId();

    private static Task<ChoreInstance?> Load(AppDb db, Guid id) =>
        db.ChoreInstances.Include(i => i.Chore).Include(i => i.Child).FirstOrDefaultAsync(i => i.Id == id);

    private static async Task<ChoreInstance?> LoadOwn(AppDb db, Guid id, ClaimsPrincipal user)
    {
        var i = await Load(db, id);
        return i is not null && i.ChildId == user.UserId() ? i : null;
    }

    private static async Task<ChoreInstance?> LoadInFamily(AppDb db, Guid id, ClaimsPrincipal user)
    {
        var i = await Load(db, id);
        return i is not null && i.Child.FamilyId == user.FamilyId() ? i : null;
    }

    private static bool IsJpeg(byte[] b) => b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF;
}
