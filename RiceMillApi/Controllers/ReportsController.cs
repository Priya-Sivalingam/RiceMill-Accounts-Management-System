using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReportsController(AppDbContext db) => _db = db;

    /// <summary>Daily Cash Book — all cash transactions for a date range</summary>
    [HttpGet("cashbook")]
    public async Task<IActionResult> CashBook([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        // Cash account code = "24"
        var cashAccount = await _db.Accounts.FirstOrDefaultAsync(a => a.AccountCode == "24");
        if (cashAccount == null) return NotFound(new { message = "Cash account not found" });

        var entries = await _db.TransactionEntries
            .Where(e => e.AccountId == cashAccount.AccountId &&
                        e.Transaction.TxnDate >= from &&
                        e.Transaction.TxnDate <= to &&
                        !e.Transaction.IsCancelled)
            .Include(e => e.Transaction).ThenInclude(t => t.Party)
            .OrderBy(e => e.Transaction.TxnDate)
            .ThenBy(e => e.EntryId)
            .Select(e => new {
                e.Transaction.TxnDate,
                e.Transaction.TxnNumber,
                e.Transaction.TxnType,
                Party = e.Transaction.Party != null ? e.Transaction.Party.PartyName : "-",
                e.Transaction.Narration,
                CashIn  = e.DrAmount,
                CashOut = e.CrAmount
            })
            .ToListAsync();

        var totalIn  = entries.Sum(e => e.CashIn);
        var totalOut = entries.Sum(e => e.CashOut);

        return Ok(new {
            From = from, To = to,
            Entries = entries,
            TotalCashIn  = totalIn,
            TotalCashOut = totalOut,
            ClosingBalance = totalIn - totalOut
        });
    }

    /// <summary>Balance Sheet — as of a specific date</summary>
    [HttpGet("balancesheet")]
    public async Task<IActionResult> BalanceSheet([FromQuery] DateOnly? asOf)
    {
        var date = asOf ?? DateOnly.FromDateTime(DateTime.Today);

        var balances = await _db.TransactionEntries
            .Where(e => e.Transaction.TxnDate <= date && !e.Transaction.IsCancelled)
            .Include(e => e.Account)
            .GroupBy(e => new {
                e.Account.AccountId, e.Account.AccountCode,
                e.Account.AccountName, e.Account.AccountType,
                e.Account.Category
            })
            .Select(g => new {
                g.Key.AccountId, g.Key.AccountCode, g.Key.AccountName,
                g.Key.AccountType, g.Key.Category,
                TotalDr = g.Sum(e => e.DrAmount),
                TotalCr = g.Sum(e => e.CrAmount)
            })
            .ToListAsync();

        var assets = balances
            .Where(b => b.AccountType == "Asset")
            .Select(b => new {
                b.AccountId, b.AccountCode, b.AccountName, b.Category,
                Balance = b.TotalDr - b.TotalCr
            })
            .OrderBy(b => b.AccountCode);

        var liabilities = balances
            .Where(b => b.AccountType == "Liability")
            .Select(b => new {
                b.AccountId, b.AccountCode, b.AccountName, b.Category,
                Balance = b.TotalCr - b.TotalDr
            })
            .OrderBy(b => b.AccountCode);

        // Equity accounts (Capital, Retained Earnings etc.)
        var equity = balances
            .Where(b => b.AccountType == "Equity")
            .Select(b => new {
                b.AccountId, b.AccountCode, b.AccountName, b.Category,
                Balance = b.TotalCr - b.TotalDr
            })
            .OrderBy(b => b.AccountCode);

        var income = balances
            .Where(b => b.AccountType == "Income")
            .Sum(b => b.TotalCr - b.TotalDr);

        var expenses = balances
            .Where(b => b.AccountType == "Expense")
            .Sum(b => b.TotalDr - b.TotalCr);

        var netProfit = income - expenses;

        var totalLiabilities = liabilities.Sum(l => l.Balance);
        var totalEquity      = equity.Sum(e => e.Balance);

        return Ok(new {
            AsOf = date,
            Assets = new {
                Items = assets,
                Total = assets.Sum(a => a.Balance)
            },
            Liabilities = new {
                Items       = liabilities,
                Total       = totalLiabilities,
                Equity      = new { Items = equity, Total = totalEquity },
                NetProfit   = netProfit,
                GrandTotal  = totalLiabilities + totalEquity + netProfit
            }
        });
    }

    /// <summary>Profit & Loss — for a date range</summary>
    [HttpGet("profitloss")]
    public async Task<IActionResult> ProfitLoss([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var entries = await _db.TransactionEntries
            .Where(e => e.Transaction.TxnDate >= from &&
                        e.Transaction.TxnDate <= to &&
                        !e.Transaction.IsCancelled)
            .Include(e => e.Account)
            .Where(e => e.Account.AccountType == "Income" || e.Account.AccountType == "Expense")
            .GroupBy(e => new {
                e.Account.AccountCode, e.Account.AccountName,
                e.Account.AccountType, e.Account.Category
            })
            .Select(g => new {
                g.Key.AccountCode, g.Key.AccountName,
                g.Key.AccountType, g.Key.Category,
                Amount = g.Key.AccountType == "Income"
                    ? g.Sum(e => e.CrAmount - e.DrAmount)
                    : g.Sum(e => e.DrAmount - e.CrAmount)
            })
            .ToListAsync();

        var income   = entries.Where(e => e.AccountType == "Income").OrderBy(e => e.AccountCode);
        var expenses = entries.Where(e => e.AccountType == "Expense").OrderBy(e => e.AccountCode);

        var totalIncome  = income.Sum(i => i.Amount);
        var totalExpense = expenses.Sum(e => e.Amount);
        var netProfit    = totalIncome - totalExpense;

        return Ok(new {
            From = from, To = to,
            Income = new { Items = income, Total = totalIncome },
            Expenses = new { Items = expenses, Total = totalExpense },
            NetProfit = netProfit,
            Status = netProfit >= 0 ? "Profit" : "Loss"
        });
    }

    /// <summary>Income & Expense Summary</summary>
    [HttpGet("incomexpense")]
    public async Task<IActionResult> IncomeExpense([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var summary = await _db.TransactionEntries
            .Where(e => e.Transaction.TxnDate >= from &&
                        e.Transaction.TxnDate <= to &&
                        !e.Transaction.IsCancelled)
            .Include(e => e.Account)
            .Where(e => e.Account.AccountType == "Income" || e.Account.AccountType == "Expense")
            .GroupBy(e => new { e.Account.AccountType, e.Account.Category })
            .Select(g => new {
                g.Key.AccountType,
                g.Key.Category,
                Total = g.Key.AccountType == "Income"
                    ? g.Sum(e => e.CrAmount - e.DrAmount)
                    : g.Sum(e => e.DrAmount - e.CrAmount)
            })
            .ToListAsync();

        return Ok(new { From = from, To = to, Summary = summary });
    }

    /// <summary>Debtors — outstanding credit sales per customer with invoice details</summary>
    [HttpGet("debtors")]
    public async Task<IActionResult> Debtors([FromQuery] DateOnly? asOf)
    {
        var date = asOf ?? DateOnly.FromDateTime(DateTime.Today);

        // Get all credit sales with balance due > 0
        var outstandingTxns = await _db.Transactions
            .Where(t => t.TxnDate <= date
                     && !t.IsCancelled
                     && t.TxnType == "sale"
                     && t.PaymentMode == "credit"
                     && t.TotalAmount > t.PaidAmount)
            .Include(t => t.Party)
            .Include(t => t.Cheque)
            .OrderBy(t => t.TxnDate)
            .ToListAsync();

        // Group by party for summary
        var partyGroups = outstandingTxns
            .Where(t => t.Party != null)
            .GroupBy(t => new { t.PartyId, t.Party!.PartyName, t.Party.PartyCode, t.Party.Phone })
            .Select(g => new {
                g.Key.PartyCode,
                g.Key.PartyName,
                g.Key.Phone,
                TotalOutstanding = g.Sum(t => t.TotalAmount - t.PaidAmount),
                InvoiceCount = g.Count(),
                OldestInvoice = g.Min(t => t.TxnDate),
                Invoices = g.Select(t => new {
                    t.TxnId,
                    t.TxnNumber,
                    t.TxnDate,
                    t.TotalAmount,
                    t.PaidAmount,
                    BalanceDue  = t.TotalAmount - t.PaidAmount,
                    DaysOverdue = (date.ToDateTime(TimeOnly.MinValue) - t.TxnDate.ToDateTime(TimeOnly.MinValue)).Days,
                    t.Reference,
                    t.Narration,
                    ChequeInfo = t.Cheque == null ? null : new {
                        t.Cheque.ChequeNumber,
                        t.Cheque.BankName,
                        t.Cheque.ChequeDate,
                        t.Cheque.IsPostDated,
                        t.Cheque.Status
                    }
                }).OrderBy(i => i.TxnDate).ToList()
            })
            .OrderByDescending(p => p.TotalOutstanding)
            .ToList();

        return Ok(new {
            AsOf            = date,
            TotalReceivable = partyGroups.Sum(p => p.TotalOutstanding),
            PartyCount      = partyGroups.Count,
            Debtors         = partyGroups
        });
    }

    /// <summary>Creditors — outstanding credit purchases per supplier with invoice details</summary>
    [HttpGet("creditors")]
    public async Task<IActionResult> Creditors([FromQuery] DateOnly? asOf)
    {
        var date = asOf ?? DateOnly.FromDateTime(DateTime.Today);

        // Get all credit purchases with balance due > 0
        var outstandingTxns = await _db.Transactions
            .Where(t => t.TxnDate <= date
                     && !t.IsCancelled
                     && t.TxnType == "purchase"
                     && t.PaymentMode == "credit"
                     && t.TotalAmount > t.PaidAmount)
            .Include(t => t.Party)
            .Include(t => t.Cheque)
            .OrderBy(t => t.TxnDate)
            .ToListAsync();

        var partyGroups = outstandingTxns
            .Where(t => t.Party != null)
            .GroupBy(t => new { t.PartyId, t.Party!.PartyName, t.Party.PartyCode, t.Party.Phone })
            .Select(g => new {
                g.Key.PartyCode,
                g.Key.PartyName,
                g.Key.Phone,
                TotalOutstanding = g.Sum(t => t.TotalAmount - t.PaidAmount),
                InvoiceCount     = g.Count(),
                OldestInvoice    = g.Min(t => t.TxnDate),
                Invoices = g.Select(t => new {
                    t.TxnId,
                    t.TxnNumber,
                    t.TxnDate,
                    t.TotalAmount,
                    t.PaidAmount,
                    BalanceDue  = t.TotalAmount - t.PaidAmount,
                    DaysOverdue = (date.ToDateTime(TimeOnly.MinValue) - t.TxnDate.ToDateTime(TimeOnly.MinValue)).Days,
                    t.Reference,
                    t.Narration,
                    ChequeInfo = t.Cheque == null ? null : new {
                        t.Cheque.ChequeNumber,
                        t.Cheque.BankName,
                        t.Cheque.ChequeDate,
                        t.Cheque.IsPostDated,
                        t.Cheque.Status
                    }
                }).OrderBy(i => i.TxnDate).ToList()
            })
            .OrderByDescending(p => p.TotalOutstanding)
            .ToList();

        return Ok(new {
            AsOf         = date,
            TotalPayable = partyGroups.Sum(p => p.TotalOutstanding),
            PartyCount   = partyGroups.Count,
            Creditors    = partyGroups
        });
    }
}
