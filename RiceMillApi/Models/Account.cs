namespace RiceMillApi.Models;

public class Account
{
    public int AccountId { get; set; }
    public string AccountCode { get; set; } = null!;
    public string AccountName { get; set; } = null!;
    public string AccountType { get; set; } = null!;   // Asset / Liability / Income / Expense / Equity
    public string Category { get; set; } = null!;       // Fixed Asset, Current Asset, Revenue, etc.
    public int? ParentAccountId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Account? ParentAccount { get; set; }
    public ICollection<Account> SubAccounts { get; set; } = new List<Account>();
    public ICollection<TransactionEntry> TransactionEntries { get; set; } = new List<TransactionEntry>();
}
