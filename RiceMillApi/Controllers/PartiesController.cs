using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PartiesController : ControllerBase
{
    private readonly AppDbContext _db;
    public PartiesController(AppDbContext db) => _db = db;

    /// <summary>Get all parties (optionally filter by type)</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? type)
    {
        var query = _db.Parties.Where(p => p.IsActive);
        if (!string.IsNullOrEmpty(type))
            query = query.Where(p => p.PartyType == type);

        var parties = await query
            .OrderBy(p => p.PartyName)
            .Select(p => new {
                p.PartyId, p.PartyCode, p.PartyName, p.PartyType,
                p.Phone, p.Address, p.OpeningBalance,
                p.OpeningBalanceType, p.CreditLimit
            })
            .ToListAsync();

        return Ok(parties);
    }

    /// <summary>Get a single party by ID</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var party = await _db.Parties.FindAsync(id);
        if (party == null || !party.IsActive)
            return NotFound(new { message = "Party not found" });
        return Ok(party);
    }

    /// <summary>Create a new party (supplier / customer / contract_client / transporter)</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PartyRequest request)
    {
        // Auto-generate party code
        var prefix = request.PartyType switch
        {
            "supplier"        => "SUP",
            "customer"        => "CUS",
            "contract_client" => "CON",
            "transporter"     => "TRP",
            _ => "PTY"
        };

        var count = await _db.Parties.CountAsync(p => p.PartyType == request.PartyType) + 1;
        var code = $"{prefix}{count:D4}";

        var party = new Party
        {
            PartyCode           = code,
            PartyName           = request.PartyName,
            PartyType           = request.PartyType,
            Phone               = request.Phone,
            Address             = request.Address,
            OpeningBalance      = request.OpeningBalance,
            OpeningBalanceType  = request.OpeningBalanceType,
            CreditLimit         = request.CreditLimit,
            LinkedAccountId     = request.LinkedAccountId
        };

        _db.Parties.Add(party);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = party.PartyId }, party);
    }

    /// <summary>Update a party</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] PartyRequest request)
    {
        var party = await _db.Parties.FindAsync(id);
        if (party == null) return NotFound();

        party.PartyName          = request.PartyName;
        party.PartyType          = request.PartyType;
        party.Phone              = request.Phone;
        party.Address            = request.Address;
        party.CreditLimit        = request.CreditLimit;
        party.LinkedAccountId    = request.LinkedAccountId;

        await _db.SaveChangesAsync();
        return Ok(party);
    }

    /// <summary>Soft delete a party</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var party = await _db.Parties.FindAsync(id);
        if (party == null) return NotFound();
        party.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Party deactivated successfully" });
    }

    /// <summary>Get party ledger — all transactions for a party with running balance</summary>
    [HttpGet("{id}/ledger")]
    public async Task<IActionResult> GetLedger(int id, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var party = await _db.Parties.FindAsync(id);
        if (party == null) return NotFound();

        var query = _db.TransactionEntries
            .Where(e => e.PartyId == id)
            .Include(e => e.Transaction)
            .Include(e => e.Account)
            .AsQueryable();

        if (from.HasValue) query = query.Where(e => e.Transaction.TxnDate >= from.Value);
        if (to.HasValue)   query = query.Where(e => e.Transaction.TxnDate <= to.Value);

        var entries = await query
            .OrderBy(e => e.Transaction.TxnDate)
            .ThenBy(e => e.EntryId)
            .Select(e => new {
                e.Transaction.TxnDate,
                e.Transaction.TxnNumber,
                e.Transaction.TxnType,
                e.Account.AccountName,
                e.Narration,
                e.DrAmount,
                e.CrAmount
            })
            .ToListAsync();

        // Calculate running balance
        decimal runningBalance = party.OpeningBalance *
            (party.OpeningBalanceType == "DR" ? 1 : -1);

        var ledger = entries.Select(e => {
            runningBalance += e.DrAmount - e.CrAmount;
            return new {
                e.TxnDate, e.TxnNumber, e.TxnType,
                e.AccountName, e.Narration,
                e.DrAmount, e.CrAmount,
                Balance = Math.Abs(runningBalance),
                BalanceType = runningBalance >= 0 ? "DR" : "CR"
            };
        });

        return Ok(new {
            Party = party.PartyName,
            OpeningBalance = party.OpeningBalance,
            OpeningBalanceType = party.OpeningBalanceType,
            Entries = ledger
        });
    }
}

public record PartyRequest(
    string PartyName,
    string PartyType,
    string? Phone,
    string? Address,
    decimal OpeningBalance,
    string OpeningBalanceType,
    decimal CreditLimit,
    int? LinkedAccountId
);
