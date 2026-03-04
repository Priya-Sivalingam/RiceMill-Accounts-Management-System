using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AccountsController(AppDbContext db) => _db = db;

    /// <summary>Get all Chart of Accounts</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? type)
    {
        var query = _db.Accounts.Where(a => a.IsActive);
        if (!string.IsNullOrEmpty(type))
            query = query.Where(a => a.AccountType == type);

        var accounts = await query
            .OrderBy(a => a.AccountCode)
            .Select(a => new {
                a.AccountId, a.AccountCode, a.AccountName,
                a.AccountType, a.Category, a.ParentAccountId
            })
            .ToListAsync();

        return Ok(accounts);
    }

    /// <summary>Get account balance with transaction entries as of a date</summary>
    [HttpGet("{id}/balance")]
    public async Task<IActionResult> GetBalance(int id, [FromQuery] DateOnly? asOf)
    {
        var account = await _db.Accounts.FindAsync(id);
        if (account == null) return NotFound();

        var date = asOf ?? DateOnly.FromDateTime(DateTime.Today);

        // Load entries including ALL sibling entries of each transaction
        // so we can build "Cash DR / Capital CR" style journal descriptions
        var rawEntries = await _db.TransactionEntries
            .Where(e => e.AccountId == id
                     && e.Transaction.TxnDate <= date
                     && !e.Transaction.IsCancelled)
            .Include(e => e.Transaction)
                .ThenInclude(t => t.Party)
            .Include(e => e.Transaction)
                .ThenInclude(t => t.Entries)
                    .ThenInclude(te => te.Account)
            .OrderBy(e => e.Transaction.TxnDate)
            .ThenBy(e => e.EntryId)
            .ToListAsync();

        var entries = rawEntries.Select(e =>
        {
            var allEntries = e.Transaction.Entries.ToList();
            var drAccounts = allEntries
                .Where(x => x.DrAmount > 0)
                .Select(x => x.Account?.AccountName ?? "?")
                .Distinct();
            var crAccounts = allEntries
                .Where(x => x.CrAmount > 0)
                .Select(x => x.Account?.AccountName ?? "?")
                .Distinct();

            // e.g.  "Cash DR / Capital CR"
            var journalDesc = string.Join(", ", drAccounts) + " DR / " + string.Join(", ", crAccounts) + " CR";

            return new {
                e.Transaction.TxnDate,
                e.Transaction.TxnNumber,
                e.Transaction.TxnType,
                Party       = e.Transaction.Party != null ? e.Transaction.Party.PartyName : "-",
                Narration   = e.Transaction.Narration,
                JournalDesc = journalDesc,
                e.DrAmount,
                e.CrAmount
            };
        }).ToList();

        var dr      = entries.Sum(e => e.DrAmount);
        var cr      = entries.Sum(e => e.CrAmount);
        var balance = dr - cr;

        return Ok(new {
            account.AccountCode,
            account.AccountName,
            account.AccountType,
            TotalDr     = dr,
            TotalCr     = cr,
            Balance     = Math.Abs(balance),
            BalanceType = balance >= 0 ? "DR" : "CR",
            AsOf        = date,
            Entries     = entries
        });
    }

}
