using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Auth;
using ScreenTime.Api.Data;
using ScreenTime.Api.Domain;

namespace ScreenTime.Api.Endpoints;

public record AiDto(bool Complete, double Confidence, string FeedbackChild, string FeedbackParent);

public record ChoreDto(Guid Id, Guid ChildId, string Title, string Emoji, string? Hint, ChoreStatus Status,
    int Minutes, int Xp, int Coins, bool RequiresPhoto, bool AiCheck,
    string? PhotoUrl, AiDto? Ai, string? ParentComment, DateTimeOffset? SubmittedAt);

public record ChildSummary(Guid Id, string Name, string Avatar, string Color,
    int Minutes, int Coins, int Xp, int Level, int LevelXp, int LevelXpMax, int Streak);

public record FamilyDto(Guid Id, string Name, string? JoinCode);

public record MeDto(string Role, Guid Id, string Name, FamilyDto Family);

public record AuthResponse(string Token, MeDto Me);

public static class Mapping
{
    public static ChoreDto ToDto(this ChoreInstance i, PhotoUrlSigner signer) => new(
        i.Id, i.ChildId, i.Chore.Title, i.Chore.Emoji, i.Chore.Hint, i.Status,
        i.Minutes, i.Xp, i.Coins, i.Chore.RequiresPhoto, i.Chore.AiCheckKey is not null,
        i.PhotoFileName is null ? null : signer.Sign(i.PhotoFileName),
        i.AiComplete is null ? null : new AiDto(i.AiComplete.Value, i.AiConfidence ?? 0, i.AiFeedbackChild ?? "", i.AiFeedbackParent ?? ""),
        i.ParentComment, i.SubmittedAt);

    private const int XpPerLevel = 200;

    public static async Task<ChildSummary> SummarizeAsync(AppDb db, Child c, DateOnly today)
    {
        var sums = await db.Ledger.Where(l => l.ChildId == c.Id)
            .GroupBy(l => l.Currency)
            .Select(g => new { g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync();
        int Sum(Currency cur) => sums.FirstOrDefault(s => s.Key == cur)?.Total ?? 0;

        var xp = Sum(Currency.Xp);

        // Streak: dagar i rad (bakåt från idag, eller igår om idag ännu är tom) med minst en godkänd syssla.
        var approvedDays = (await db.ChoreInstances
            .Where(i => i.ChildId == c.Id && i.Status == ChoreStatus.Approved)
            .Select(i => i.Date).Distinct().ToListAsync()).ToHashSet();
        var day = approvedDays.Contains(today) ? today : today.AddDays(-1);
        var streak = 0;
        while (approvedDays.Contains(day)) { streak++; day = day.AddDays(-1); }

        return new ChildSummary(c.Id, c.Name, c.AvatarEmoji, c.Color,
            Sum(Currency.Minutes), Sum(Currency.Coins), xp,
            xp / XpPerLevel + 1, xp % XpPerLevel, XpPerLevel, streak);
    }
}

public static class Clock
{
    private static readonly TimeZoneInfo Tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");
    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Tz).DateTime);
}

public static class Http
{
    public static IResult Error(int status, string message) => Results.Json(new { error = message }, statusCode: status);
    public static IResult BadRequest(string message) => Error(400, message);
    public static IResult Conflict(string message) => Error(409, message);
}
