using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Auth;
using ScreenTime.Api.Data;
using ScreenTime.Api.Domain;
using ScreenTime.Api.Endpoints;
using ScreenTime.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------- Data ----------
builder.Services.AddDbContext<AppDb>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=data/screentime.db"));

// ---------- AI-verifiering ----------
var aiOptions = builder.Configuration.GetSection("Anthropic").Get<AnthropicOptions>() ?? new AnthropicOptions();
aiOptions.ApiKey ??= Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
builder.Services.AddSingleton(aiOptions);
builder.Services.AddHttpClient<PhotoVerificationService>(c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddSingleton<PhotoStore>();
builder.Services.AddHostedService<PhotoCleanupService>();

// ---------- Inloggning ----------
var keys = KeyRing.Load(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddSingleton(keys);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<PhotoUrlSigner>();
builder.Services.AddSingleton<IPasswordHasher<Parent>, PasswordHasher<Parent>>();
builder.Services.AddSingleton<IPasswordHasher<Child>, PasswordHasher<Child>>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // behåll "sub", "role", "fid" som de är
        o.TokenValidationParameters = keys.ValidationParameters();
    });
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Parent", p => p.RequireRole(Roles.Parent))
    .AddPolicy("Child", p => p.RequireRole(Roles.Child));

// Skydd mot gissning av lösenord/PIN: max 10 inloggningsförsök per minut och IP.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

// ---------- HTTP ----------
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "data"));
using (var scope = app.Services.CreateScope())
{
    // Dev: byt till migrations innan produktion. Ändras modellen: radera data/screentime.db.
    scope.ServiceProvider.GetRequiredService<AppDb>().Database.EnsureCreated();
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");
api.MapGet("/config", (PhotoVerificationService verifier) => new { aiEnabled = verifier.IsConfigured });
api.MapAuth();
api.MapFamily();
api.MapChores();

app.Run();
