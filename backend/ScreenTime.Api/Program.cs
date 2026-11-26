using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Data;
using ScreenTime.Api.Domain;
using ScreenTime.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDb>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=data/screentime.db"));

var ai = builder.Configuration.GetSection("Anthropic").Get<AnthropicOptions>() ?? new AnthropicOptions();
ai.ApiKey ??= Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
builder.Services.AddSingleton(ai);
builder.Services.AddHttpClient<PhotoVerificationService>(c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddSingleton<PhotoStore>();
builder.Services.AddHostedService<PhotoCleanupService>();

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "data"));
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    db.Database.EnsureCreated(); // Dev: byt till migrations innan produktion.
    Seed.Run(db);
}

var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");
DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).DateTime);

var api = app.MapGroup("/api");

api.MapGet("/config", (PhotoVerificationService verifier) => new { aiEnabled = verifier.IsConfigured });

// ---------- Barn ----------

api.MapGet("/children", async (AppDb db) =>
{
    var children = await db.Children.OrderBy(c => c.Name).ToListAsync();
    var result = new List<ChildSummary>();
    foreach (var c in children) result.Add(await Summarize(db, c, Today()));
    return result;
});

api.MapGet("/children/{childId:guid}/today", async (Guid childId, AppDb db) =>
{
    var child = await db.Children.FindAsync(childId);
    if (child is null) return Results.NotFound();

    var today = Today();
    var existing = await db.ChoreInstances.Where(i => i.ChildId == childId && i.Date == today)
        .Select(i => i.ChoreId).ToListAsync();
    var missing = await db.Chores.Where(c => !existing.Contains(c.Id)).ToListAsync();
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
        child = await Summarize(db, child, today),
        chores = instances.Select(ToDto),
    });
});

// ---------- Sysslans livscykel ----------

api.MapGet("/instances/{id:guid}", async (Guid id, AppDb db) =>
    await Load(db, id) is { } i ? Results.Ok(ToDto(i)) : Results.NotFound());

api.MapPost("/instances/{id:guid}/start", async (Guid id, AppDb db) =>
{
    var i = await Load(db, id);
    if (i is null) return Results.NotFound();
    if (i.Status is not (ChoreStatus.Available or ChoreStatus.Returned))
        return Conflict($"Kan inte starta en syssla med status {i.Status}");
    i.Status = ChoreStatus.InProgress;
    await db.SaveChangesAsync();
    return Results.Ok(ToDto(i));
});

api.MapPost("/instances/{id:guid}/photo", async (Guid id, HttpRequest request, AppDb db, PhotoStore photos,
    PhotoVerificationService verifier, CancellationToken ct) =>
{
    var i = await Load(db, id);
    if (i is null) return Results.NotFound();
    if (i.Status != ChoreStatus.InProgress) return Conflict("Starta sysslan innan du tar foto");
    if (!request.HasFormContentType) return Results.BadRequest("Skicka bilden som multipart/form-data");

    var form = await request.ReadFormAsync(ct);
    var file = form.Files.GetFile("photo");
    if (file is null || file.Length == 0) return Results.BadRequest("Fältet 'photo' saknas");
    if (file.Length > 8 * 1024 * 1024) return Results.BadRequest("Bilden är för stor (max 8 MB)");

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms, ct);
    var bytes = ms.ToArray();
    if (!IsJpeg(bytes)) return Results.BadRequest("Bilden måste vara JPEG");

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
    return Results.Ok(ToDto(i));
}).DisableAntiforgery();

api.MapPost("/instances/{id:guid}/submit", async (Guid id, AppDb db) =>
{
    var i = await Load(db, id);
    if (i is null) return Results.NotFound();
    if (i.Status != ChoreStatus.InProgress) return Conflict($"Kan inte skicka in en syssla med status {i.Status}");
    if (i.Chore.RequiresPhoto && i.PhotoFileName is null) return Results.BadRequest("Den här sysslan kräver ett foto");
    i.Status = ChoreStatus.Submitted;
    i.SubmittedAt = DateTimeOffset.UtcNow;
    i.ParentComment = null;
    await db.SaveChangesAsync();
    return Results.Ok(ToDto(i));
});

// ---------- Förälder ----------

api.MapGet("/parent/queue", async (AppDb db) =>
{
    var items = await db.ChoreInstances.Include(i => i.Chore).Include(i => i.Child)
        .Where(i => i.Status == ChoreStatus.Submitted)
        .ToListAsync();
    return items.OrderBy(i => i.SubmittedAt).Select(i => new { childName = i.Child.Name, childAvatar = i.Child.AvatarEmoji, chore = ToDto(i) });
});

api.MapPost("/instances/{id:guid}/approve", async (Guid id, AppDb db) =>
{
    await using var tx = await db.Database.BeginTransactionAsync();
    var i = await Load(db, id);
    if (i is null) return Results.NotFound();
    if (i.Status == ChoreStatus.Approved) return Results.Ok(ToDto(i)); // idempotent
    if (i.Status != ChoreStatus.Submitted) return Conflict($"Kan inte godkänna en syssla med status {i.Status}");

    i.Status = ChoreStatus.Approved;
    i.DecidedAt = DateTimeOffset.UtcNow;
    db.Ledger.AddRange(
        new LedgerEntry { ChildId = i.ChildId, Currency = Currency.Minutes, Amount = i.Minutes, Type = "chore_approved", ChoreInstanceId = i.Id },
        new LedgerEntry { ChildId = i.ChildId, Currency = Currency.Coins, Amount = i.Coins, Type = "chore_approved", ChoreInstanceId = i.Id },
        new LedgerEntry { ChildId = i.ChildId, Currency = Currency.Xp, Amount = i.Xp, Type = "chore_approved", ChoreInstanceId = i.Id });
    await db.SaveChangesAsync();
    await tx.CommitAsync();
    return Results.Ok(ToDto(i));
});

api.MapPost("/instances/{id:guid}/return", async (Guid id, DecisionRequest body, AppDb db) =>
{
    var i = await Load(db, id);
    if (i is null) return Results.NotFound();
    if (i.Status != ChoreStatus.Submitted) return Conflict($"Kan inte skicka tillbaka en syssla med status {i.Status}");
    i.Status = ChoreStatus.Returned;
    i.ParentComment = string.IsNullOrWhiteSpace(body.Comment) ? "Nästan! Kolla en gång till 😊" : body.Comment.Trim();
    i.DecidedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ToDto(i));
});

api.MapPost("/instances/{id:guid}/reject", async (Guid id, DecisionRequest body, AppDb db) =>
{
    var i = await Load(db, id);
    if (i is null) return Results.NotFound();
    if (i.Status != ChoreStatus.Submitted) return Conflict($"Kan inte neka en syssla med status {i.Status}");
    i.Status = ChoreStatus.Rejected;
    i.ParentComment = body.Comment?.Trim();
    i.DecidedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ToDto(i));
});

api.MapGet("/photos/{fileName}", (string fileName, PhotoStore photos) =>
    photos.PathFor(fileName) is { } path ? Results.File(path, "image/jpeg") : Results.NotFound());

app.Run();

// ---------- Hjälpare ----------

static IResult Conflict(string message) => Results.Conflict(new { error = message });

static Task<ChoreInstance?> Load(AppDb db, Guid id) =>
    db.ChoreInstances.Include(i => i.Chore).FirstOrDefaultAsync(i => i.Id == id);

static bool IsJpeg(byte[] b) => b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF;

static ChoreDto ToDto(ChoreInstance i) => new(
    i.Id, i.Chore.Title, i.Chore.Emoji, i.Chore.Hint, i.Status,
    i.Minutes, i.Xp, i.Coins, i.Chore.RequiresPhoto, i.Chore.AiCheckKey is not null,
    i.PhotoFileName is null ? null : $"/api/photos/{i.PhotoFileName}",
    i.AiComplete is null ? null : new AiDto(i.AiComplete.Value, i.AiConfidence ?? 0, i.AiFeedbackChild ?? "", i.AiFeedbackParent ?? ""),
    i.ParentComment, i.SubmittedAt);

static async Task<ChildSummary> Summarize(AppDb db, Child c, DateOnly today)
{
    var sums = await db.Ledger.Where(l => l.ChildId == c.Id)
        .GroupBy(l => l.Currency)
        .Select(g => new { g.Key, Total = g.Sum(x => x.Amount) })
        .ToListAsync();
    int Sum(Currency cur) => sums.FirstOrDefault(s => s.Key == cur)?.Total ?? 0;

    var xp = Sum(Currency.Xp);
    const int xpPerLevel = 200;

    // Streak: antal dagar i rad (bakåt från idag, eller igår om idag ännu är tom) med minst en godkänd syssla.
    var approvedDays = (await db.ChoreInstances
        .Where(i => i.ChildId == c.Id && i.Status == ChoreStatus.Approved)
        .Select(i => i.Date).Distinct().ToListAsync()).ToHashSet();
    var day = approvedDays.Contains(today) ? today : today.AddDays(-1);
    var streak = 0;
    while (approvedDays.Contains(day)) { streak++; day = day.AddDays(-1); }

    return new ChildSummary(c.Id, c.Name, c.AvatarEmoji, c.Color,
        Sum(Currency.Minutes), Sum(Currency.Coins), xp,
        xp / xpPerLevel + 1, xp % xpPerLevel, xpPerLevel, streak);
}

record DecisionRequest(string? Comment);
record AiDto(bool Complete, double Confidence, string FeedbackChild, string FeedbackParent);
record ChoreDto(Guid Id, string Title, string Emoji, string? Hint, ChoreStatus Status,
    int Minutes, int Xp, int Coins, bool RequiresPhoto, bool AiCheck,
    string? PhotoUrl, AiDto? Ai, string? ParentComment, DateTimeOffset? SubmittedAt);
record ChildSummary(Guid Id, string Name, string Avatar, string Color,
    int Minutes, int Coins, int Xp, int Level, int LevelXp, int LevelXpMax, int Streak);
