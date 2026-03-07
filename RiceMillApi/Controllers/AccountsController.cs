using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
// [Authorize]
public class AccountsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AccountsController(AppDbContext db) => _db = db;

    // GET /api/accounts
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
                a.AccountType, a.Category, a.ParentAccountId,
                a.IsActive, a.CreatedAt
            })
            .ToListAsync();

        return Ok(accounts);
    }

    // GET /api/accounts/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var account = await _db.Accounts
            .Include(a => a.ParentAccount)
            .Include(a => a.SubAccounts.Where(s => s.IsActive))
            .FirstOrDefaultAsync(a => a.AccountId == id);

        if (account == null) return NotFound(new { message = $"Account {id} not found" });

        return Ok(new {
            account.AccountId, account.AccountCode, account.AccountName,
            account.AccountType, account.Category, account.ParentAccountId,
            account.IsActive, account.CreatedAt,
            ParentAccount = account.ParentAccount == null ? null : new {
                account.ParentAccount.AccountId,
                account.ParentAccount.AccountCode,
                account.ParentAccount.AccountName
            },
            SubAccounts = account.SubAccounts.Select(s => new {
                s.AccountId, s.AccountCode, s.AccountName
            })
        });
    }

    // GET /api/accounts/{id}/balance
    [HttpGet("{id}/balance")]
    public async Task<IActionResult> GetBalance(int id, [FromQuery] DateOnly? asOf)
    {
        var account = await _db.Accounts.FindAsync(id);
        if (account == null) return NotFound(new { message = $"Account {id} not found" });

        var date = asOf ?? DateOnly.FromDateTime(DateTime.Today);

        var rawEntries = await _db.TransactionEntries
            .Where(e => e.AccountId == id
                     && e.Transaction.TxnDate <= date
                     && !e.Transaction.IsCancelled)
            .Include(e => e.Transaction).ThenInclude(t => t.Party)
            .Include(e => e.Transaction).ThenInclude(t => t.Entries).ThenInclude(te => te.Account)
            .OrderBy(e => e.Transaction.TxnDate)
            .ThenBy(e => e.EntryId)
            .ToListAsync();

        var entries = rawEntries.Select(e =>
        {
            var all = e.Transaction.Entries.ToList();
            var drAcc = all.Where(x => x.DrAmount > 0).Select(x => x.Account?.AccountName ?? "?").Distinct();
            var crAcc = all.Where(x => x.CrAmount > 0).Select(x => x.Account?.AccountName ?? "?").Distinct();
            var journalDesc = string.Join(", ", drAcc) + " DR / " + string.Join(", ", crAcc) + " CR";

            return new {
                e.Transaction.TxnDate, e.Transaction.TxnNumber, e.Transaction.TxnType,
                Party       = e.Transaction.Party != null ? e.Transaction.Party.PartyName : "-",
                Narration   = e.Transaction.Narration,
                JournalDesc = journalDesc,
                e.DrAmount, e.CrAmount
            };
        }).ToList();

        var dr = entries.Sum(e => e.DrAmount);
        var cr = entries.Sum(e => e.CrAmount);
        var bal = dr - cr;

        return Ok(new {
            account.AccountCode, account.AccountName, account.AccountType, account.Category,
            TotalDr = dr, TotalCr = cr,
            Balance = Math.Abs(bal),
            BalanceType = bal >= 0 ? "DR" : "CR",
            AsOf = date, Entries = entries
        });
    }

    // POST /api/accounts
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AccountDto dto)
    {
        var exists = await _db.Accounts.AnyAsync(a => a.AccountCode == dto.AccountCode);
        if (exists)
            return Conflict(new { message = $"Account code '{dto.AccountCode}' already exists." });

        if (dto.ParentAccountId.HasValue)
        {
            var parent = await _db.Accounts.FindAsync(dto.ParentAccountId.Value);
            if (parent == null)
                return BadRequest(new { message = $"Parent account {dto.ParentAccountId} not found." });
        }

        var account = new Account {
            AccountCode     = dto.AccountCode.Trim(),
            AccountName     = dto.AccountName.Trim(),
            AccountType     = dto.AccountType,
            Category        = dto.Category,
            ParentAccountId = dto.ParentAccountId,
            IsActive        = true,
            CreatedAt       = DateTime.UtcNow
        };

        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = account.AccountId }, new {
            account.AccountId, account.AccountCode, account.AccountName,
            account.AccountType, account.Category,
            message = "Account created successfully"
        });
    }

    // PUT /api/accounts/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] AccountDto dto)
    {
        var account = await _db.Accounts.FindAsync(id);
        if (account == null)
            return NotFound(new { message = $"Account {id} not found" });

        var codeExists = await _db.Accounts
            .AnyAsync(a => a.AccountCode == dto.AccountCode && a.AccountId != id);
        if (codeExists)
            return Conflict(new { message = $"Account code '{dto.AccountCode}' already used by another account." });

        if (dto.ParentAccountId.HasValue)
        {
            if (dto.ParentAccountId.Value == id)
                return BadRequest(new { message = "An account cannot be its own parent." });
            var parent = await _db.Accounts.FindAsync(dto.ParentAccountId.Value);
            if (parent == null)
                return BadRequest(new { message = $"Parent account {dto.ParentAccountId} not found." });
        }

        account.AccountCode     = dto.AccountCode.Trim();
        account.AccountName     = dto.AccountName.Trim();
        account.AccountType     = dto.AccountType;
        account.Category        = dto.Category;
        account.ParentAccountId = dto.ParentAccountId;

        await _db.SaveChangesAsync();

        return Ok(new {
            account.AccountId, account.AccountCode, account.AccountName,
            account.AccountType, account.Category,
            message = "Account updated successfully"
        });
    }

    // DELETE /api/accounts/{id}  — soft delete
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var account = await _db.Accounts.FindAsync(id);
        if (account == null)
            return NotFound(new { message = $"Account {id} not found" });

        var hasTransactions = await _db.TransactionEntries.AnyAsync(e => e.AccountId == id);
        if (hasTransactions)
            return BadRequest(new {
                message = $"Cannot delete '{account.AccountName}' — it has existing transactions."
            });

        var hasSubAccounts = await _db.Accounts.AnyAsync(a => a.ParentAccountId == id && a.IsActive);
        if (hasSubAccounts)
            return BadRequest(new {
                message = $"Cannot delete '{account.AccountName}' — it has active sub-accounts."
            });

        account.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Account '{account.AccountName}' deactivated successfully." });
    }
}

// DTO
public record AccountDto(
    string AccountCode,
    string AccountName,
    string AccountType,
    string Category,
    int?   ParentAccountId
);