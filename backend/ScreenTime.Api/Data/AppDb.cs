using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Domain;

namespace ScreenTime.Api.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Family> Families => Set<Family>();
    public DbSet<Parent> Parents => Set<Parent>();
    public DbSet<Child> Children => Set<Child>();
    public DbSet<Chore> Chores => Set<Chore>();
    public DbSet<ChoreInstance> ChoreInstances => Set<ChoreInstance>();
    public DbSet<LedgerEntry> Ledger => Set<LedgerEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Family>().HasIndex(x => x.JoinCode).IsUnique();
        b.Entity<Parent>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Chore>().HasIndex(x => x.FamilyId);
        b.Entity<Child>().HasIndex(x => x.FamilyId);

        b.Entity<ChoreInstance>().Property(x => x.Status).HasConversion<string>();
        b.Entity<ChoreInstance>().HasIndex(x => new { x.ChildId, x.ChoreId, x.Date }).IsUnique();
        b.Entity<LedgerEntry>().Property(x => x.Currency).HasConversion<string>();

        // Idempotens: en godkänd syssla kan bara ge en post per valuta.
        b.Entity<LedgerEntry>()
            .HasIndex(x => new { x.ChoreInstanceId, x.Currency, x.Type })
            .IsUnique()
            .HasFilter("ChoreInstanceId IS NOT NULL");
    }
}

public static class FamilyFactory
{
    // Inga tecken som är lätta att blanda ihop (0/O, 1/I/L).
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static string NewJoinCode() =>
        new(Enumerable.Range(0, 6).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());

    /// <summary>Startpaket med sysslor som varje ny familj får. Föräldern kan ändra dem senare.</summary>
    public static IEnumerable<Chore> DefaultChores(Guid familyId) =>
    [
        new Chore { FamilyId = familyId, Title = "Bädda sängen", Emoji = "🛏️", Minutes = 5, Xp = 25, Coins = 10,
            RequiresPhoto = true, AiCheckKey = "bed_made", Hint = "Täcket slätt och kudden på plats." },
        new Chore { FamilyId = familyId, Title = "Plocka ur diskmaskinen", Emoji = "🍽️", Minutes = 10, Xp = 50, Coins = 20,
            RequiresPhoto = true, AiCheckKey = "dishwasher_empty", Hint = "Glöm inte bestickskorgen!" },
        new Chore { FamilyId = familyId, Title = "Städa rummet", Emoji = "🧸", Minutes = 15, Xp = 75, Coins = 30,
            RequiresPhoto = true, AiCheckKey = "room_tidy", Hint = "Inga saker på golvet." },
        new Chore { FamilyId = familyId, Title = "Gå ut med soporna", Emoji = "🗑️", Minutes = 5, Xp = 25, Coins = 10,
            RequiresPhoto = false, Hint = "Ny påse i hinken efteråt." },
        new Chore { FamilyId = familyId, Title = "Dammsuga vardagsrummet", Emoji = "🧹", Minutes = 15, Xp = 75, Coins = 30,
            RequiresPhoto = true, AiCheckKey = "floor_clean", Hint = "Under soffbordet också." },
    ];
}
