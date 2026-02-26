namespace RiceMillApi.Models;

public class Cheque
{
    public int ChequeId { get; set; }
    public string ChequeNumber { get; set; } = null!;
    public string BankName { get; set; } = null!;
    public DateOnly ChequeDate { get; set; }
    public decimal Amount { get; set; }
    public string ChequeType { get; set; } = null!;    // received / issued
    public int PartyId { get; set; }

    // pending / cleared / bounced / cancelled
    public string Status { get; set; } = "pending";
    public DateOnly? ClearedDate { get; set; }
    public bool IsPostDated { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Party Party { get; set; } = null!;
    public Transaction? Transaction { get; set; }
}
