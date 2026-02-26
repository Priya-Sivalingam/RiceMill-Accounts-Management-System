namespace RiceMillApi.Models;

public class ContractMilling
{
    public int MillingId { get; set; }
    public string MillingNumber { get; set; } = null!;   // e.g. MILL-2024-0001
    public DateOnly MillingDate { get; set; }
    public int PartyId { get; set; }
    public decimal PaddyQtyKg { get; set; }
    public decimal RiceQtyKg { get; set; }
    public decimal BranQtyKg { get; set; }
    public decimal MillingCharge { get; set; }

    // cash / credit / deduct_from_rice
    public string PaymentMode { get; set; } = "cash";

    public int? TxnId { get; set; }
    public string? Remarks { get; set; }

    // Navigation
    public Party Party { get; set; } = null!;
    public Transaction? Transaction { get; set; }
}
