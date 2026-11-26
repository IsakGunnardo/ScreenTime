using Microsoft.EntityFrameworkCore;
using ScreenTime.Api.Domain;

namespace ScreenTime.Api.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Child> Children => Set<Child>();
    public DbSet<Chore> Chores => Set<Chore>();
    public DbSet<ChoreInstance> ChoreInstances => Set<ChoreInstance>();
    public DbSet<LedgerEntry> Ledger => Set<LedgerEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
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

public static class Seed
{
    public static void Run(AppDb db)
    {
        if (db.Children.Any()) return;

        db.Children.AddRange(
            new Child { Name = "Elsa", AvatarEmoji = "🦊", Color = "#FF8A5B" },
            new Child { Name = "Leo", AvatarEmoji = "🐸", Color = "#3DBE8B" });

        db.Chores.AddRange(
            new Chore { Title = "Bädda sängen", Emoji = "🛏️", Minutes = 5, Xp = 25, Coins = 10,
                RequiresPhoto = true, AiCheckKey = "bed_made", Hint = "Täcket slätt och kudden på plats." },
            new Chore { Title = "Plocka ur diskmaskinen", Emoji = "🍽️", Minutes = 10, Xp = 50, Coins = 20,
                RequiresPhoto = true, AiCheckKey = "dishwasher_empty", Hint = "Glöm inte bestickskorgen!" },
            new Chore { Title = "Städa rummet", Emoji = "🧸", Minutes = 15, Xp = 75, Coins = 30,
                RequiresPhoto = true, AiCheckKey = "room_tidy", Hint = "Inga saker på golvet." },
            new Chore { Title = "Gå ut med soporna", Emoji = "🗑️", Minutes = 5, Xp = 25, Coins = 10,
                RequiresPhoto = false, Hint = "Ny påse i hinken efteråt." },
            new Chore { Title = "Dammsuga vardagsrummet", Emoji = "🧹", Minutes = 15, Xp = 75, Coins = 30,
                RequiresPhoto = true, AiCheckKey = "floor_clean", Hint = "Under soffbordet också." });

        db.SaveChanges();
    }
}
