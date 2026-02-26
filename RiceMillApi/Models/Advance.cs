namespace RiceMillApi.Models;

public class Advance
{
    public int AdvanceId { get; set; }
    public int PartyId { get; set; }

    // salary_advance / paddy_purchase_advance / customer_advance
    public string AdvanceType { get; set; } = null!;

    public decimal Amount { get; set; }
    public DateOnly AdvanceDate { get; set; }
    public decimal AdjustedAmount { get; set; } = 0;
    public int? TxnId { get; set; }
    public string? Remarks { get; set; }

    // Computed
    public decimal Balance => Amount - AdjustedAmount;

    // Navigation
    public Party Party { get; set; } = null!;
    public Transaction? Transaction { get; set; }
}
