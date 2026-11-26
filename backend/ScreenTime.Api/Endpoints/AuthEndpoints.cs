using System.Net.Mail;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Auth;
using ScreenTime.Api.Data;
using ScreenTime.Api.Domain;

namespace ScreenTime.Api.Endpoints;

public record RegisterRequest(string Name, string Email, string Password, string? FamilyName, string? JoinCode);
public record LoginRequest(string Email, string Password);
public record ChildLoginRequest(string FamilyCode, Guid ChildId, string Pin);

public static class AuthEndpoints
{
    public static void MapAuth(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").RequireRateLimiting("auth");

        // ---------- Förälder: skapa konto ----------
        auth.MapPost("/register", async (RegisterRequest req, AppDb db, TokenService tokens, IPasswordHasher<Parent> hasher) =>
        {
            var name = req.Name?.Trim() ?? "";
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            if (name.Length is < 1 or > 60) return Http.BadRequest("Skriv ditt namn");
            if (!MailAddress.TryCreate(email, out _)) return Http.BadRequest("Ogiltig e-postadress");
            if ((req.Password ?? "").Length < 8) return Http.BadRequest("Lösenordet måste vara minst 8 tecken");
            if (await db.Parents.AnyAsync(p => p.Email == email)) return Http.Conflict("Det finns redan ett konto med den e-postadressen");

            Family family;
            if (!string.IsNullOrWhiteSpace(req.JoinCode))
            {
                // Andra föräldern går med i en befintlig familj.
                var code = NormalizeCode(req.JoinCode);
                var existing = await db.Families.FirstOrDefaultAsync(f => f.JoinCode == code);
                if (existing is null) return Http.BadRequest("Hittar ingen familj med den koden");
                family = existing;
            }
            else
            {
                var familyName = string.IsNullOrWhiteSpace(req.FamilyName) ? $"Familjen {name}" : req.FamilyName.Trim();
                family = new Family { Name = familyName, JoinCode = await UniqueCodeAsync(db) };
                db.Families.Add(family);
                db.Chores.AddRange(FamilyFactory.DefaultChores(family.Id));
            }

            var parent = new Parent { FamilyId = family.Id, Name = name, Email = email };
            parent.PasswordHash = hasher.HashPassword(parent, req.Password!);
            db.Parents.Add(parent);
            await db.SaveChangesAsync();

            return Results.Ok(new AuthResponse(
                tokens.Issue(parent.Id, Roles.Parent, family.Id, parent.Name),
                new MeDto(Roles.Parent, parent.Id, parent.Name, new FamilyDto(family.Id, family.Name, family.JoinCode))));
        });

        // ---------- Förälder: logga in ----------
        auth.MapPost("/login", async (LoginRequest req, AppDb db, TokenService tokens, IPasswordHasher<Parent> hasher) =>
        {
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            var parent = await db.Parents.Include(p => p.Family).FirstOrDefaultAsync(p => p.Email == email);
            if (parent is null || hasher.VerifyHashedPassword(parent, parent.PasswordHash, req.Password ?? "") == PasswordVerificationResult.Failed)
                return Http.Error(401, "Fel e-post eller lösenord");

            return Results.Ok(new AuthResponse(
                tokens.Issue(parent.Id, Roles.Parent, parent.FamilyId, parent.Name),
                new MeDto(Roles.Parent, parent.Id, parent.Name, new FamilyDto(parent.FamilyId, parent.Family.Name, parent.Family.JoinCode))));
        });

        // ---------- Barn: välj sig själv i familjen ----------
        auth.MapGet("/family/{code}/children", async (string code, AppDb db) =>
        {
            var normalized = NormalizeCode(code);
            var family = await db.Families.FirstOrDefaultAsync(f => f.JoinCode == normalized);
            if (family is null) return Http.Error(404, "Hittar ingen familj med den koden");
            var kids = await db.Children.Where(c => c.FamilyId == family.Id).OrderBy(c => c.Name)
                .Select(c => new { c.Id, c.Name, Avatar = c.AvatarEmoji, c.Color }).ToListAsync();
            return Results.Ok(new { familyName = family.Name, children = kids });
        });

        // ---------- Barn: logga in med PIN ----------
        auth.MapPost("/child-login", async (ChildLoginRequest req, AppDb db, TokenService tokens, IPasswordHasher<Child> hasher) =>
        {
            var code = NormalizeCode(req.FamilyCode);
            var child = await db.Children.Include(c => c.Family)
                .FirstOrDefaultAsync(c => c.Id == req.ChildId && c.Family.JoinCode == code);
            if (child is null || hasher.VerifyHashedPassword(child, child.PinHash, req.Pin ?? "") == PasswordVerificationResult.Failed)
                return Http.Error(401, "Fel PIN-kod");

            return Results.Ok(new AuthResponse(
                tokens.Issue(child.Id, Roles.Child, child.FamilyId, child.Name),
                new MeDto(Roles.Child, child.Id, child.Name, new FamilyDto(child.FamilyId, child.Family.Name, null))));
        });

        // ---------- Vem är jag? ----------
        api.MapGet("/me", async (ClaimsPrincipal user, AppDb db) =>
        {
            var family = await db.Families.FindAsync(user.FamilyId());
            if (family is null) return Results.Unauthorized();
            if (user.IsParent())
            {
                var p = await db.Parents.FindAsync(user.UserId());
                if (p is null) return Results.Unauthorized();
                return Results.Ok(new MeDto(Roles.Parent, p.Id, p.Name, new FamilyDto(family.Id, family.Name, family.JoinCode)));
            }
            var c = await db.Children.FindAsync(user.UserId());
            if (c is null) return Results.Unauthorized();
            return Results.Ok(new MeDto(Roles.Child, c.Id, c.Name, new FamilyDto(family.Id, family.Name, null)));
        }).RequireAuthorization();
    }

    public static string NormalizeCode(string? code) => (code ?? "").Trim().ToUpperInvariant().Replace(" ", "").Replace("-", "");

    private static async Task<string> UniqueCodeAsync(AppDb db)
    {
        while (true)
        {
            var code = FamilyFactory.NewJoinCode();
            if (!await db.Families.AnyAsync(f => f.JoinCode == code)) return code;
        }
    }
}
