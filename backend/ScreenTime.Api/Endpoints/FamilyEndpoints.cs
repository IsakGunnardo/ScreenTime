using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Auth;
using ScreenTime.Api.Data;
using ScreenTime.Api.Domain;

namespace ScreenTime.Api.Endpoints;

public record CreateChildRequest(string Name, string Avatar, string Color, string Pin);
public record SetPinRequest(string Pin);

/// <summary>Förälderns hantering av familjen. Allt filtreras på förälderns familj från token.</summary>
public static class FamilyEndpoints
{
    public static void MapFamily(this RouteGroupBuilder api)
    {
        var family = api.MapGroup("/family").RequireAuthorization("Parent");

        family.MapGet("/children", async (ClaimsPrincipal user, AppDb db) =>
        {
            var fid = user.FamilyId();
            var kids = await db.Children.Where(c => c.FamilyId == fid).OrderBy(c => c.Name).ToListAsync();
            var today = Clock.Today();
            var result = new List<ChildSummary>();
            foreach (var c in kids) result.Add(await Mapping.SummarizeAsync(db, c, today));
            return result;
        });

        family.MapPost("/children", async (CreateChildRequest req, ClaimsPrincipal user, AppDb db, IPasswordHasher<Child> hasher) =>
        {
            var name = req.Name?.Trim() ?? "";
            if (name.Length is < 1 or > 30) return Http.BadRequest("Skriv barnets namn");
            if (!IsValidPin(req.Pin)) return Http.BadRequest("PIN-koden ska vara 4 siffror");
            if (string.IsNullOrWhiteSpace(req.Avatar) || req.Avatar.Length > 16) return Http.BadRequest("Välj en avatar");
            if (!IsHexColor(req.Color)) return Http.BadRequest("Ogiltig färg");

            var fid = user.FamilyId();
            if (await db.Children.CountAsync(c => c.FamilyId == fid) >= 10) return Http.BadRequest("Max 10 barn per familj");

            var child = new Child { FamilyId = fid, Name = name, AvatarEmoji = req.Avatar.Trim(), Color = req.Color };
            child.PinHash = hasher.HashPassword(child, req.Pin);
            db.Children.Add(child);
            await db.SaveChangesAsync();
            return Results.Ok(await Mapping.SummarizeAsync(db, child, Clock.Today()));
        });

        family.MapPut("/children/{id:guid}/pin", async (Guid id, SetPinRequest req, ClaimsPrincipal user, AppDb db, IPasswordHasher<Child> hasher) =>
        {
            if (!IsValidPin(req.Pin)) return Http.BadRequest("PIN-koden ska vara 4 siffror");
            var fid = user.FamilyId();
            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id && c.FamilyId == fid);
            if (child is null) return Results.NotFound();
            child.PinHash = hasher.HashPassword(child, req.Pin);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static bool IsValidPin(string? pin) => pin is { Length: 4 } && pin.All(char.IsAsciiDigit);

    private static bool IsHexColor(string? c) =>
        c is { Length: 7 } && c[0] == '#' && c[1..].All(char.IsAsciiHexDigit);
}
