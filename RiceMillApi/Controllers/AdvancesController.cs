using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdvancesController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdvancesController(AppDbContext db) => _db = db;

    /// <summary>Get all advances with optional filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? type,   // salary_advance / paddy_purchase_advance / customer_advance
        [FromQuery] int? partyId,
        [FromQuery] bool? hasBalance)
    {
        var query = _db.Advances
            .Include(a => a.Party)
            .AsQueryable();

        if (!string.IsNullOrEmpty(type)) query = query.Where(a => a.AdvanceType == type);
        if (partyId.HasValue) query = query.Where(a => a.PartyId == partyId);

        var advances = await query
            .OrderByDescending(a => a.AdvanceDate)
            .Select(a => new {
                a.AdvanceId,
                a.AdvanceType,
                a.AdvanceDate,
                Party       = a.Party.PartyName,
                a.Amount,
                a.AdjustedAmount,
                Balance     = a.Amount - a.AdjustedAmount,
                a.Remarks
            })
            .ToListAsync();

        if (hasBalance == true)
            advances = advances.Where(a => a.Balance > 0).ToList();

        return Ok(new {
            Advances     = advances,
            TotalBalance = advances.Sum(a => a.Balance)
        });
    }

    /// <summary>
    /// Give a salary advance
    /// DR: Salary Advance (18.1)
    /// CR: Cash (24)
    /// </summary>
    [HttpPost("salary")]
    public async Task<IActionResult> SalaryAdvance([FromBody] AdvanceRequest req)
    {
        return await CreateAdvance(req, "salary_advance", "18.1");
    }

    /// <summary>
    /// Give a paddy purchase advance to a supplier
    /// DR: Paddy Purchase Advance (18.2)
    /// CR: Cash (24) or Bank (17.1)
    /// </summary>
    [HttpPost("paddy-purchase")]
    public async Task<IActionResult> PaddyPurchaseAdvance([FromBody] AdvanceRequest req)
    {
        return await CreateAdvance(req, "paddy_purchase_advance", "18.2");
    }

    /// <summary>
    /// Receive advance from a customer
    /// DR: Cash (24) or Bank (17.1)
    /// CR: Debtor account (15.x)
    /// </summary>
    [HttpPost("customer")]
    public async Task<IActionResult> CustomerAdvance([FromBody] CustomerAdvanceRequest req)
    {
        var fiscalYear = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year" });

        var userId = GetUserId();
        var count = await _db.Transactions.CountAsync() + 1;
        var txnNumber = $"CADV-{DateTime.Today.Year}-{count:D4}";

        var drAccountCode = req.PaymentMode == "bank_transfer" ? "17.1" : "24";
        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == drAccountCode);
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == req.DebtorAccountCode);

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.AdvanceDate,
            TxnType      = "receipt",
            PartyId      = req.PartyId,
            Narration    = req.Narration ?? "Customer Advance Received",
            TotalAmount  = req.Amount,
            PaidAmount   = req.Amount,
            PaymentMode  = req.PaymentMode,
            FiscalYearId = fiscalYear.FiscalYearId,
            CreatedBy    = userId
        };

        txn.Entries.Add(new TransactionEntry
        {
            AccountId = drAccount.AccountId,
            DrAmount  = req.Amount,
            Narration = txn.Narration
        });
        txn.Entries.Add(new TransactionEntry
        {
            AccountId = crAccount.AccountId,
            PartyId   = req.PartyId,
            CrAmount  = req.Amount,
            Narration = txn.Narration
        });

        _db.Transactions.Add(txn);
        await _db.SaveChangesAsync();

        var advance = new Advance
        {
            PartyId      = req.PartyId,
            AdvanceType  = "customer_advance",
            Amount       = req.Amount,
            AdvanceDate  = req.AdvanceDate,
            TxnId        = txn.TxnId,
            Remarks      = req.Narration
        };

        _db.Advances.Add(advance);
        await _db.SaveChangesAsync();

        return Ok(new { advance.AdvanceId, txn.TxnNumber,
                        message = "Customer advance recorded successfully" });
    }

    /// <summary>
    /// Adjust (settle) an advance against a transaction
    /// e.g. Paddy purchase advance adjusted when paddy delivered
    /// DR: Paddy Creditors (16.1.1)
    /// CR: Paddy Purchase Advance (18.2)
    /// </summary>
    [HttpPost("{id}/adjust")]
    public async Task<IActionResult> Adjust(int id, [FromBody] AdjustRequest req)
    {
        var advance = await _db.Advances
            .Include(a => a.Party)
            .FirstOrDefaultAsync(a => a.AdvanceId == id);

        if (advance == null) return NotFound();

        var remainingBalance = advance.Amount - advance.AdjustedAmount;
        if (req.AdjustAmount > remainingBalance)
            return BadRequest(new { message = $"Adjust amount exceeds balance. Available: {remainingBalance}" });

        var fiscalYear = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year" });

        // Determine accounts based on advance type
        var (drCode, crCode) = advance.AdvanceType switch
        {
            "salary_advance"        => ("10", "18.1"),    // Admin Expense DR, Salary Advance CR
            "paddy_purchase_advance"=> ("16.1.1", "18.2"),// Paddy Creditor DR, Paddy Advance CR
            "customer_advance"      => (req.DebtorAccountCode ?? "15.1", "24"), // Debtor DR, Cash CR
            _ => ("10", "18.1")
        };

        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == drCode);
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == crCode);

        var userId = GetUserId();
        var count = await _db.Transactions.CountAsync() + 1;

        var txn = new Transaction
        {
            TxnNumber    = $"ADJ-{DateTime.Today.Year}-{count:D4}",
            TxnDate      = req.AdjustDate,
            TxnType      = "journal",
            PartyId      = advance.PartyId,
            Narration    = req.Narration ?? $"Advance adjustment - {advance.Party.PartyName}",
            TotalAmount  = req.AdjustAmount,
            PaidAmount   = req.AdjustAmount,
            PaymentMode  = "journal",
            FiscalYearId = fiscalYear.FiscalYearId,
            CreatedBy    = userId
        };

        txn.Entries.Add(new TransactionEntry
        {
            AccountId = drAccount.AccountId,
            PartyId   = advance.PartyId,
            DrAmount  = req.AdjustAmount,
            Narration = txn.Narration
        });
        txn.Entries.Add(new TransactionEntry
        {
            AccountId = crAccount.AccountId,
            PartyId   = advance.PartyId,
            CrAmount  = req.AdjustAmount,
            Narration = txn.Narration
        });

        _db.Transactions.Add(txn);

        // Update advance adjusted amount
        advance.AdjustedAmount += req.AdjustAmount;
        await _db.SaveChangesAsync();

        return Ok(new {
            message       = "Advance adjusted successfully",
            AdjustedAmount = advance.AdjustedAmount,
            RemainingBalance = advance.Amount - advance.AdjustedAmount
        });
    }

    /// <summary>Get advance summary by type</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var summary = await _db.Advances
            .GroupBy(a => a.AdvanceType)
            .Select(g => new {
                AdvanceType     = g.Key,
                TotalGiven      = g.Sum(a => a.Amount),
                TotalAdjusted   = g.Sum(a => a.AdjustedAmount),
                TotalBalance    = g.Sum(a => a.Amount - a.AdjustedAmount),
                Count           = g.Count()
            })
            .ToListAsync();

        return Ok(summary);
    }

    // ─── PRIVATE HELPER ──────────────────────────────────────────
    private async Task<IActionResult> CreateAdvance(
        AdvanceRequest req, string advanceType, string drAccountCode)
    {
        var fiscalYear = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year" });

        var userId = GetUserId();
        var count = await _db.Transactions.CountAsync() + 1;
        var prefix = advanceType == "salary_advance" ? "SADV" : "PADV";
        var txnNumber = $"{prefix}-{DateTime.Today.Year}-{count:D4}";

        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == drAccountCode);
        var crAccountCode = req.PaymentMode == "bank_transfer" ? "17.1" : "24";
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == crAccountCode);

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.AdvanceDate,
            TxnType      = "payment",
            PartyId      = req.PartyId,
            Narration    = req.Narration ?? $"{advanceType.Replace("_", " ")} given",
            TotalAmount  = req.Amount,
            PaidAmount   = req.Amount,
            PaymentMode  = req.PaymentMode,
            FiscalYearId = fiscalYear.FiscalYearId,
            CreatedBy    = userId
        };

        txn.Entries.Add(new TransactionEntry
        {
            AccountId = drAccount.AccountId,
            PartyId   = req.PartyId,
            DrAmount  = req.Amount,
            Narration = txn.Narration
        });
        txn.Entries.Add(new TransactionEntry
        {
            AccountId = crAccount.AccountId,
            CrAmount  = req.Amount,
            Narration = txn.Narration
        });

        _db.Transactions.Add(txn);
        await _db.SaveChangesAsync();

        var advance = new Advance
        {
            PartyId     = req.PartyId,
            AdvanceType = advanceType,
            Amount      = req.Amount,
            AdvanceDate = req.AdvanceDate,
            TxnId       = txn.TxnId,
            Remarks     = req.Narration
        };

        _db.Advances.Add(advance);
        await _db.SaveChangesAsync();

        return Ok(new { advance.AdvanceId, txn.TxnNumber,
                        message = $"{advanceType} recorded successfully" });
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null ? int.Parse(claim.Value) : 1;
    }
}

// ─── REQUEST MODELS ─────────────────────────────────────────────────────────
public record AdvanceRequest(
    int PartyId,
    decimal Amount,
    DateOnly AdvanceDate,
    string PaymentMode,   // cash / bank_transfer
    string? Narration
);

public record CustomerAdvanceRequest(
    int PartyId,
    decimal Amount,
    DateOnly AdvanceDate,
    string PaymentMode,
    string DebtorAccountCode,  // e.g. "15.1"
    string? Narration
);

public record AdjustRequest(
    decimal AdjustAmount,
    DateOnly AdjustDate,
    string? DebtorAccountCode,
    string? Narration
);
