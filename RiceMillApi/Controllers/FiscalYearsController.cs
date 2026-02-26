using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FiscalYearsController : ControllerBase
{
    private readonly AppDbContext _db;
    public FiscalYearsController(AppDbContext db) => _db = db;

    /// <summary>Get all fiscal years</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var years = await _db.FiscalYears
            .OrderByDescending(f => f.StartDate)
            .ToListAsync();
        return Ok(years);
    }

    /// <summary>Get active (open) fiscal year</summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        var year = await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);
        if (year == null) return NotFound(new { message = "No active fiscal year" });
        return Ok(year);
    }

    /// <summary>Create a new fiscal year</summary>
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] FiscalYearRequest req)
    {
        var exists = await _db.FiscalYears.AnyAsync(f => f.YearLabel == req.YearLabel);
        if (exists) return BadRequest(new { message = "Fiscal year already exists" });

        var year = new FiscalYear
        {
            YearLabel = req.YearLabel,
            StartDate = req.StartDate,
            EndDate   = req.EndDate,
            IsClosed  = false
        };

        _db.FiscalYears.Add(year);
        await _db.SaveChangesAsync();
        return Ok(year);
    }

    /// <summary>Close a fiscal year — locks all entries (admin only)</summary>
    [HttpPost("{id}/close")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Close(int id)
    {
        var year = await _db.FiscalYears.FindAsync(id);
        if (year == null) return NotFound();
        if (year.IsClosed) return BadRequest(new { message = "Fiscal year is already closed" });

        var txnCount = await _db.Transactions.CountAsync(t => t.FiscalYearId == id);
        year.IsClosed = true;
        await _db.SaveChangesAsync();

        return Ok(new {
            message  = $"Fiscal year {year.YearLabel} closed successfully",
            TotalTransactions = txnCount
        });
    }
}

public record FiscalYearRequest(string YearLabel, DateOnly StartDate, DateOnly EndDate);
