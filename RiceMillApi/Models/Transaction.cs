namespace RiceMillApi.Models;

public class Transaction
{
    public int TxnId { get; set; }
    public string TxnNumber { get; set; } = null!;
    public DateOnly TxnDate { get; set; }

    // purchase / sale / expense / receipt / payment / journal / contract_milling
    public string TxnType { get; set; } = null!;

    public int? PartyId { get; set; }
    public string? Reference { get; set; }
    public string? Narration { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; } = 0;

    // cash / credit / advance / bank_transfer / cheque
    public string PaymentMode { get; set; } = "cash";

    public int? ChequeId { get; set; }
    public int FiscalYearId { get; set; }
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsCancelled { get; set; } = false;

    // Computed
    public decimal BalanceDue => TotalAmount - PaidAmount;

    // Navigation
    public Party? Party { get; set; }
    public Cheque? Cheque { get; set; }
    public FiscalYear FiscalYear { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<TransactionEntry> Entries { get; set; } = new List<TransactionEntry>();
    public ContractMilling? ContractMilling { get; set; }
}
