namespace ScreenTime.Api.Services;

/// <summary>Lagrar foton på disk. Foton raderas automatiskt efter RetentionDays (se PhotoCleanupService).</summary>
public class PhotoStore(IWebHostEnvironment env)
{
    public const int RetentionDays = 7;
    private readonly string _dir = Path.Combine(env.ContentRootPath, "data", "photos");

    public async Task<string> SaveAsync(byte[] bytes, CancellationToken ct)
    {
        Directory.CreateDirectory(_dir);
        var name = $"{Guid.NewGuid():N}.jpg";
        await File.WriteAllBytesAsync(Path.Combine(_dir, name), bytes, ct);
        return name;
    }

    public string? PathFor(string fileName)
    {
        // Skydd mot path traversal: endast filnamn vi själva genererat.
        if (fileName != Path.GetFileName(fileName)) return null;
        var p = Path.Combine(_dir, fileName);
        return File.Exists(p) ? p : null;
    }

    public void Delete(string? fileName)
    {
        if (fileName is null) return;
        var p = PathFor(fileName);
        if (p is not null) File.Delete(p);
    }

    public IEnumerable<FileInfo> Expired()
    {
        if (!Directory.Exists(_dir)) return [];
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        return new DirectoryInfo(_dir).EnumerateFiles("*.jpg").Where(f => f.CreationTimeUtc < cutoff);
    }
}

public class PhotoCleanupService(PhotoStore store, ILogger<PhotoCleanupService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            foreach (var f in store.Expired())
            {
                try { f.Delete(); log.LogInformation("Raderade gammalt foto {Name}", f.Name); }
                catch (IOException ex) { log.LogWarning(ex, "Kunde inte radera {Name}", f.Name); }
            }
            await Task.Delay(TimeSpan.FromHours(6), ct);
        }
    }
}
