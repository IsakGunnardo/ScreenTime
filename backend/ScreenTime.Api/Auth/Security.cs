using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace ScreenTime.Api.Auth;

public static class Roles
{
    public const string Parent = "parent";
    public const string Child = "child";
}

public static class ClaimNames
{
    public const string Subject = "sub";
    public const string Role = "role";
    public const string FamilyId = "fid";
    public const string Name = "name";
}

/// <summary>
/// Hemlig nyckel för att signera JWT och foto-URL:er.
/// Läses från config "Auth:SigningKey" (base64). Saknas den skapas en slumpad nyckel i data/signing.key
/// så att inloggningar överlever omstarter i utveckling.
/// </summary>
public sealed class KeyRing
{
    public byte[] JwtKey { get; }
    public byte[] PhotoKey { get; }
    public const string Issuer = "screentime-api";
    public const string Audience = "screentime-app";

    private KeyRing(byte[] master)
    {
        JwtKey = Derive(master, "jwt");
        PhotoKey = Derive(master, "photo");
    }

    private static byte[] Derive(byte[] master, string purpose) =>
        HMACSHA256.HashData(master, Encoding.UTF8.GetBytes(purpose));

    public static KeyRing Load(IConfiguration config, string contentRoot)
    {
        var configured = config["Auth:SigningKey"];
        if (!string.IsNullOrWhiteSpace(configured)) return new KeyRing(Convert.FromBase64String(configured));

        var dir = Path.Combine(contentRoot, "data");
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, "signing.key");
        if (!File.Exists(file)) File.WriteAllText(file, Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)));
        return new KeyRing(Convert.FromBase64String(File.ReadAllText(file).Trim()));
    }

    public TokenValidationParameters ValidationParameters() => new()
    {
        ValidIssuer = Issuer,
        ValidAudience = Audience,
        IssuerSigningKey = new SymmetricSecurityKey(JwtKey),
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(2),
        RoleClaimType = ClaimNames.Role,
        NameClaimType = ClaimNames.Name,
    };
}

public sealed class TokenService(KeyRing keys)
{
    private readonly JsonWebTokenHandler _handler = new();

    public string Issue(Guid userId, string role, Guid familyId, string name)
    {
        // Barnets enhet ska inte behöva logga in ofta; föräldern loggar in igen var 30:e dag.
        var lifetime = role == Roles.Child ? TimeSpan.FromDays(180) : TimeSpan.FromDays(30);
        return _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = KeyRing.Issuer,
            Audience = KeyRing.Audience,
            Expires = DateTime.UtcNow.Add(lifetime),
            Subject = new ClaimsIdentity(new Claim[]
            {
                new(ClaimNames.Subject, userId.ToString()),
                new(ClaimNames.Role, role),
                new(ClaimNames.FamilyId, familyId.ToString()),
                new(ClaimNames.Name, name),
            }),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(keys.JwtKey), SecurityAlgorithms.HmacSha256),
        });
    }
}

/// <summary>
/// Foton serveras via kortlivade signerade URL:er, så att &lt;Image&gt; kan ladda dem utan Authorization-header
/// men ingen utanför familjen kan gissa sig till en bild.
/// </summary>
public sealed class PhotoUrlSigner(KeyRing keys)
{
    public string Sign(string fileName)
    {
        var exp = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds();
        return $"/api/photos/{fileName}?exp={exp}&sig={Signature(fileName, exp)}";
    }

    public bool Verify(string fileName, long exp, string? sig)
    {
        if (sig is null || exp < DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return false;
        var expected = Encoding.ASCII.GetBytes(Signature(fileName, exp));
        return CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(sig));
    }

    private string Signature(string fileName, long exp) =>
        Base64UrlEncoder.Encode(HMACSHA256.HashData(keys.PhotoKey, Encoding.UTF8.GetBytes($"{fileName}:{exp}")));
}

public static class PrincipalExtensions
{
    public static Guid UserId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(ClaimNames.Subject)!);
    public static Guid FamilyId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(ClaimNames.FamilyId)!);
    public static bool IsParent(this ClaimsPrincipal u) => u.IsInRole(Roles.Parent);
    public static bool IsChild(this ClaimsPrincipal u) => u.IsInRole(Roles.Child);
}
