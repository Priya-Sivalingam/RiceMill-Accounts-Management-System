namespace RiceMillApi.Models;

public class TransactionEntry
{
    public int EntryId { get; set; }
    public int TxnId { get; set; }
    public int AccountId { get; set; }
    public int? PartyId { get; set; }
    public decimal DrAmount { get; set; } = 0;
    public decimal CrAmount { get; set; } = 0;
    public string? Narration { get; set; }

    // Navigation
    public Transaction Transaction { get; set; } = null!;
    public Account Account { get; set; } = null!;
    public Party? Party { get; set; }
}
