namespace ScreenTime.Api.Domain;

public class Child
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string AvatarEmoji { get; set; }
    public required string Color { get; set; }
}

/// <summary>Mall för en syssla som föräldern skapat.</summary>
public class Chore
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Title { get; set; }
    public required string Emoji { get; set; }
    public string? Hint { get; set; }
    public int Minutes { get; set; }
    public int Xp { get; set; }
    public int Coins { get; set; }
    public bool RequiresPhoto { get; set; }

    /// <summary>Nyckel till en fördefinierad AI-verifieringsmall (se VerificationTemplates). Null = ingen AI.</summary>
    public string? AiCheckKey { get; set; }
}

public enum ChoreStatus
{
    Available,
    InProgress,
    Submitted,
    Returned,
    Approved,
    Rejected,
}

/// <summary>En konkret syssla för ett barn en viss dag. Belöningen snapshotas vid skapande.</summary>
public class ChoreInstance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = null!;
    public Guid ChoreId { get; set; }
    public Chore Chore { get; set; } = null!;
    public DateOnly Date { get; set; }
    public ChoreStatus Status { get; set; } = ChoreStatus.Available;

    // Snapshot – ändras inte om föräldern ändrar mallen senare.
    public int Minutes { get; set; }
    public int Xp { get; set; }
    public int Coins { get; set; }

    public string? PhotoFileName { get; set; }
    public DateTimeOffset? PhotoTakenAt { get; set; }

    // AI-bedömning (rådgivande, aldrig beslutande)
    public bool? AiComplete { get; set; }
    public double? AiConfidence { get; set; }
    public string? AiFeedbackChild { get; set; }
    public string? AiFeedbackParent { get; set; }

    public string? ParentComment { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}

public enum Currency { Minutes, Coins, Xp }

/// <summary>Append-only. Saldo = summan av poster. Skrivs aldrig över.</summary>
public class LedgerEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChildId { get; set; }
    public Currency Currency { get; set; }
    public int Amount { get; set; }
    public required string Type { get; set; } // "chore_approved", "manual", ...
    public Guid? ChoreInstanceId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
