namespace RiceMillApi.Models;

public class FiscalYear
{
    public int FiscalYearId { get; set; }
    public string YearLabel { get; set; } = null!;    // e.g. "2024-2025"
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool IsClosed { get; set; } = false;

    // Navigation
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
