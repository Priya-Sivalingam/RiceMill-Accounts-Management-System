using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChequesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ChequesController(AppDbContext db) => _db = db;

    /// <summary>Get all cheques with optional filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? type,       // received / issued
        [FromQuery] string? status,     // pending / cleared / bounced / cancelled
        [FromQuery] bool? isPostDated,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to)
    {
        var query = _db.Cheques
            .Include(c => c.Party)
            .AsQueryable();

        if (!string.IsNullOrEmpty(type))   query = query.Where(c => c.ChequeType == type);
        if (!string.IsNullOrEmpty(status)) query = query.Where(c => c.Status == status);
        if (isPostDated.HasValue)          query = query.Where(c => c.IsPostDated == isPostDated);
        if (from.HasValue) query = query.Where(c => c.ChequeDate >= from.Value);
        if (to.HasValue)   query = query.Where(c => c.ChequeDate <= to.Value);

        var cheques = await query
            .OrderByDescending(c => c.ChequeDate)
            .Select(c => new {
                c.ChequeId, c.ChequeNumber, c.BankName,
                c.ChequeDate, c.Amount, c.ChequeType,
                Party = c.Party.PartyName,
                c.Status, c.IsPostDated, c.ClearedDate
            })
            .ToListAsync();

        return Ok(cheques);
    }

    /// <summary>Get pending cheques due today or overdue</summary>
    [HttpGet("pending-today")]
    public async Task<IActionResult> PendingToday()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);

        var cheques = await _db.Cheques
            .Include(c => c.Party)
            .Where(c => c.Status == "pending" && c.ChequeDate <= today)
            .OrderBy(c => c.ChequeDate)
            .Select(c => new {
                c.ChequeId, c.ChequeNumber, c.BankName,
                c.ChequeDate, c.Amount, c.ChequeType,
                Party = c.Party.PartyName,
                c.IsPostDated,
                DaysOverdue = today.DayNumber - c.ChequeDate.DayNumber
            })
            .ToListAsync();

        return Ok(new {
            Count = cheques.Count,
            TotalAmount = cheques.Sum(c => c.Amount),
            Cheques = cheques
        });
    }

    /// <summary>Mark a cheque as cleared — moves PDC from account 23 to Bank 17.1</summary>
    [HttpPost("{id}/clear")]
    public async Task<IActionResult> Clear(int id, [FromBody] ClearChequeRequest req)
    {
        var cheque = await _db.Cheques
            .Include(c => c.Transaction)
            .FirstOrDefaultAsync(c => c.ChequeId == id);

        if (cheque == null) return NotFound();
        if (cheque.Status != "pending")
            return BadRequest(new { message = $"Cheque is already {cheque.Status}" });

        cheque.Status      = "cleared";
        cheque.ClearedDate = req.ClearedDate;

        // If post-dated cheque: move from PDC account (23) to Bank (17.1)
        if (cheque.IsPostDated)
        {
            var fiscalYear = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
            if (fiscalYear != null)
            {
                var pdcAccount  = await _db.Accounts.FirstAsync(a => a.AccountCode == "23");
                var bankAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == "17.1");
                var userId = GetUserId();

                var count = await _db.Transactions.CountAsync() + 1;
                var clearingTxn = new Transaction
                {
                    TxnNumber    = $"PDC-{DateTime.Today.Year}-{count:D4}",
                    TxnDate      = req.ClearedDate,
                    TxnType      = "journal",
                    Narration    = $"PDC Cleared - Cheque {cheque.ChequeNumber} from {cheque.BankName}",
                    TotalAmount  = cheque.Amount,
                    PaidAmount   = cheque.Amount,
                    PaymentMode  = "cheque",
                    FiscalYearId = fiscalYear.FiscalYearId,
                    CreatedBy    = userId
                };

                // DR Bank 17.1, CR PDC Account 23
                clearingTxn.Entries.Add(new TransactionEntry
                {
                    AccountId = bankAccount.AccountId,
                    DrAmount  = cheque.Amount,
                    Narration = clearingTxn.Narration
                });
                clearingTxn.Entries.Add(new TransactionEntry
                {
                    AccountId = pdcAccount.AccountId,
                    CrAmount  = cheque.Amount,
                    Narration = clearingTxn.Narration
                });

                _db.Transactions.Add(clearingTxn);
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Cheque {cheque.ChequeNumber} marked as cleared" });
    }

    /// <summary>Mark a cheque as bounced</summary>
    [HttpPost("{id}/bounce")]
    public async Task<IActionResult> Bounce(int id, [FromBody] BounceRequest req)
    {
        var cheque = await _db.Cheques.FindAsync(id);
        if (cheque == null) return NotFound();
        if (cheque.Status != "pending")
            return BadRequest(new { message = $"Cheque is already {cheque.Status}" });

        cheque.Status = "bounced";

        // Reverse the original receipt entry — DR Debtor back, CR Cash/Bank
        var fiscalYear = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
        if (fiscalYear != null && cheque.Transaction != null)
        {
            var originalEntries = await _db.TransactionEntries
                .Where(e => e.TxnId == cheque.Transaction.TxnId)
                .ToListAsync();

            var userId = GetUserId();
            var count = await _db.Transactions.CountAsync() + 1;

            var reversalTxn = new Transaction
            {
                TxnNumber    = $"BNC-{DateTime.Today.Year}-{count:D4}",
                TxnDate      = DateOnly.FromDateTime(DateTime.Today),
                TxnType      = "journal",
                Narration    = $"Cheque Bounce - {cheque.ChequeNumber} - {req.Reason}",
                TotalAmount  = cheque.Amount,
                PaidAmount   = cheque.Amount,
                PaymentMode  = "journal",
                FiscalYearId = fiscalYear.FiscalYearId,
                CreatedBy    = userId
            };

            foreach (var entry in originalEntries)
            {
                reversalTxn.Entries.Add(new TransactionEntry
                {
                    AccountId = entry.AccountId,
                    PartyId   = entry.PartyId,
                    DrAmount  = entry.CrAmount,  // Swap
                    CrAmount  = entry.DrAmount,
                    Narration = reversalTxn.Narration
                });
            }

            _db.Transactions.Add(reversalTxn);
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Cheque {cheque.ChequeNumber} marked as bounced and reversed" });
    }

    /// <summary>Cheque summary — totals by status</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var summary = await _db.Cheques
            .GroupBy(c => new { c.ChequeType, c.Status })
            .Select(g => new {
                g.Key.ChequeType,
                g.Key.Status,
                Count  = g.Count(),
                Amount = g.Sum(c => c.Amount)
            })
            .ToListAsync();

        return Ok(summary);
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null ? int.Parse(claim.Value) : 1;
    }
}

public record ClearChequeRequest(DateOnly ClearedDate);
public record BounceRequest(string Reason);
