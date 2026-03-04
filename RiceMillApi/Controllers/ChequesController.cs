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

    /// <summary>
    /// Clear a PDC cheque — CASH BASIS
    /// Received (sale):   DR Bank(17.1)/CR PDC(23) + DR Suspense(25)/CR Sales(7)
    /// Issued (purchase): DR PDC(23)/CR Bank(17.1) + DR Purchase(6)/CR Suspense(25)
    /// </summary>
    [HttpPost("{id}/clear")]
    public async Task<IActionResult> Clear(int id, [FromBody] ClearChequeRequest req)
    {
        var cheque = await _db.Cheques
            .Include(c => c.Transaction)
            .FirstOrDefaultAsync(c => c.ChequeId == id);

        if (cheque == null) return NotFound();
        if (cheque.Status != "pending")
            return BadRequest(new { message = $"Cheque is already {cheque.Status}" });

        var fiscalYear = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        cheque.Status      = "cleared";
        cheque.ClearedDate = req.ClearedDate;

        var userId    = GetUserId();
        var count     = await _db.Transactions.CountAsync() + 1;
        var narration = $"PDC Cleared — {cheque.ChequeNumber} ({cheque.BankName})";
        var bankAcc  = await _db.Accounts.FirstAsync(a => a.AccountCode == "17.1");
        var pdcAcc   = await _db.Accounts.FirstAsync(a => a.AccountCode == "23");
        var suspAcc  = await _db.Accounts.FirstAsync(a => a.AccountCode == "25");

        var ct = new Transaction {
            TxnNumber = $"PDC-{DateTime.Today.Year}-{count:D4}", TxnDate = req.ClearedDate,
            TxnType = "journal", Narration = narration, TotalAmount = cheque.Amount,
            PaidAmount = cheque.Amount, PaymentMode = "cheque", PartyId = cheque.PartyId,
            FiscalYearId = fiscalYear.FiscalYearId, CreatedBy = userId
        };

        if (cheque.ChequeType == "received") {
            // SALE PDC CLEARED — income recognised only now (cash basis)
            var salesAcc = await _db.Accounts.FirstAsync(a => a.AccountCode == "7");
            ct.Entries.Add(new TransactionEntry { AccountId = bankAcc.AccountId, DrAmount = cheque.Amount, Narration = "Cash received in bank" });
            ct.Entries.Add(new TransactionEntry { AccountId = pdcAcc.AccountId,  CrAmount = cheque.Amount, Narration = "PDC cleared from account 23" });
            ct.Entries.Add(new TransactionEntry { AccountId = suspAcc.AccountId, DrAmount = cheque.Amount, Narration = "PDC Sale Suspense cleared" });
            ct.Entries.Add(new TransactionEntry { AccountId = salesAcc.AccountId, PartyId = cheque.PartyId, CrAmount = cheque.Amount, Narration = $"Sales income recognised — {cheque.ChequeNumber}" });
        } else {
            // PURCHASE PDC CLEARED — expense recognised only now (cash basis)
            var purchAcc = await _db.Accounts.FirstAsync(a => a.AccountCode == "6");
            ct.Entries.Add(new TransactionEntry { AccountId = pdcAcc.AccountId,  DrAmount = cheque.Amount, Narration = $"PDC cheque {cheque.ChequeNumber} paid" });
            ct.Entries.Add(new TransactionEntry { AccountId = bankAcc.AccountId, CrAmount = cheque.Amount, Narration = "Cash paid from bank" });
            ct.Entries.Add(new TransactionEntry { AccountId = purchAcc.AccountId, PartyId = cheque.PartyId, DrAmount = cheque.Amount, Narration = $"Purchase expense recognised — {cheque.ChequeNumber}" });
            ct.Entries.Add(new TransactionEntry { AccountId = suspAcc.AccountId, CrAmount = cheque.Amount, Narration = "PDC Purchase Suspense cleared" });
        }

        _db.Transactions.Add(ct);
        var orig = cheque.Transaction ?? await _db.Transactions.FirstOrDefaultAsync(t => t.ChequeId == cheque.ChequeId);
        if (orig != null) orig.PaidAmount = orig.TotalAmount;
        await _db.SaveChangesAsync();

        return Ok(new {
            message    = cheque.ChequeType == "received" ? $"Sales income now in P&L — {cheque.ChequeNumber}" : $"Purchase expense now in P&L — {cheque.ChequeNumber}",
            journalRef = ct.TxnNumber, amount = cheque.Amount
        });
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