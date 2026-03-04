namespace RiceMillApi.Models;

public class Party
{
    public int PartyId { get; set; }
    public string PartyCode { get; set; } = null!;
    public string PartyName { get; set; } = null!;

    // supplier / customer / contract_client / transporter / bank
    public string PartyType { get; set; } = null!;

    public string? Phone { get; set; }
    public string? Address { get; set; }
    public decimal OpeningBalance { get; set; } = 0;
    public string OpeningBalanceType { get; set; } = "DR";   // DR or CR
    public decimal CreditLimit { get; set; } = 0;
    public int? LinkedAccountId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Account? LinkedAccount { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<TransactionEntry> TransactionEntries { get; set; } = new List<TransactionEntry>();
    public ICollection<Cheque> Cheques { get; set; } = new List<Cheque>();
}
