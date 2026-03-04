using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly AppDbContext _db;
    public TransactionsController(AppDbContext db) => _db = db;

    // ─────────────────────────────────────────────────────────────
    // GET: List transactions
    // ─────────────────────────────────────────────────────────────
    /// <summary>Get all transactions with optional filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? type,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? partyId,
        [FromQuery] string? paymentMode,
        [FromQuery] bool? hasBalance)
    {
        var query = _db.Transactions
            .Where(t => !t.IsCancelled)
            .Include(t => t.Party)
            .Include(t => t.FiscalYear)
            .Include(t => t.Cheque)
            .AsQueryable();

        if (!string.IsNullOrEmpty(type))        query = query.Where(t => t.TxnType == type);
        if (from.HasValue)                      query = query.Where(t => t.TxnDate >= from.Value);
        if (to.HasValue)                        query = query.Where(t => t.TxnDate <= to.Value);
        if (partyId.HasValue)                   query = query.Where(t => t.PartyId == partyId);
        if (!string.IsNullOrEmpty(paymentMode)) query = query.Where(t => t.PaymentMode == paymentMode);
        if (hasBalance == true)                 query = query.Where(t => t.TotalAmount > t.PaidAmount);

        var result = await query
            .OrderByDescending(t => t.TxnDate)
            .ThenByDescending(t => t.TxnId)
            .Select(t => new {
                t.TxnId, t.TxnNumber, t.TxnDate, t.TxnType,
                Party = t.Party != null ? t.Party.PartyName : "-",
                t.Narration, t.TotalAmount, t.PaidAmount,
                BalanceDue = t.TotalAmount - t.PaidAmount,
                t.PaymentMode, t.IsCancelled,
                Cheque = t.Cheque == null ? null : new {
                    t.Cheque.ChequeId,
                    t.Cheque.ChequeNumber,
                    t.Cheque.BankName,
                    t.Cheque.ChequeDate,
                    t.Cheque.IsPostDated,
                    t.Cheque.Status,
                    t.Cheque.ClearedDate
                }
            })
            .ToListAsync();

        return Ok(result);
    }

    /// <summary>Get a single transaction with its journal entries</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var txn = await _db.Transactions
            .Include(t => t.Party)
            .Include(t => t.Entries).ThenInclude(e => e.Account)
            .Include(t => t.Cheque)
            .FirstOrDefaultAsync(t => t.TxnId == id);

        if (txn == null) return NotFound();

        return Ok(new {
            txn.TxnId,
            txn.TxnNumber,
            txn.TxnDate,
            txn.TxnType,
            txn.TotalAmount,
            txn.PaidAmount,
            txn.PaymentMode,
            txn.Reference,
            txn.Narration,
            txn.IsCancelled,
            Party = txn.Party == null ? null : new {
                txn.Party.PartyId,
                txn.Party.PartyName,
                txn.Party.PartyCode,
                txn.Party.Phone
            },
            Cheque = txn.Cheque == null ? null : new {
                txn.Cheque.ChequeId,
                txn.Cheque.ChequeNumber,
                txn.Cheque.BankName,
                txn.Cheque.ChequeDate,
                txn.Cheque.Amount,
                txn.Cheque.IsPostDated,
                txn.Cheque.Status,
                txn.Cheque.ChequeType
            },
            Entries = txn.Entries.Select(e => new {
                e.EntryId,
                e.DrAmount,
                e.CrAmount,
                e.Narration,
                Account = e.Account == null ? null : new {
                    e.Account.AccountCode,
                    e.Account.AccountName
                }
            })
        });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Paddy Purchase
    // DR: Purchase (6)
    // CR: Cash (24) OR Paddy Creditors (16.1.1) OR Advance (18.2)
    // ─────────────────────────────────────────────────────────────
    /// <summary>Record a paddy purchase</summary>
    [HttpPost("paddy-purchase")]
    public async Task<IActionResult> PaddyPurchase([FromBody] PurchaseRequest req)
    {
        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        var userId = GetUserId();
        var txnNumber = await GenerateNumber("PINV");

        // Resolve credit account based on payment mode
        // Cheque: check if post-dated
        bool isPurchasePostDated = req.PaymentMode == "cheque"
            && req.ChequeDetails != null
            && req.ChequeDetails.ChequeDate > DateOnly.FromDateTime(DateTime.Today);

        var crAccountCode = req.PaymentMode switch
        {
            "cash"          => "24",
            "bank_transfer" => "17.1",
            "cheque"        => isPurchasePostDated ? "23" : "17.1",
            "advance"       => "18.2",
            _               => "16.1.1"  // credit
        };

        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == "6");
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == crAccountCode);

        // Save cheque record
        Cheque? purchaseCheque = null;
        if (req.PaymentMode == "cheque" && req.ChequeDetails != null)
        {
            purchaseCheque = new Cheque
            {
                ChequeNumber = req.ChequeDetails.ChequeNumber,
                BankName     = req.ChequeDetails.BankName,
                ChequeDate   = req.ChequeDetails.ChequeDate,
                Amount       = req.Amount,
                ChequeType   = "issued",
                PartyId      = req.PartyId,
                IsPostDated  = isPurchasePostDated,
                Status       = isPurchasePostDated ? "pending" : "cleared"
            };
            _db.Cheques.Add(purchaseCheque);
            await _db.SaveChangesAsync();
        }

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.TxnDate,
            TxnType      = "purchase",
            PartyId      = req.PartyId,
            Reference    = req.Reference ?? purchaseCheque?.ChequeNumber,
            Narration    = req.Narration ?? (isPurchasePostDated ? $"Paddy Purchase — PDC Cheque (due {req.ChequeDetails?.ChequeDate})" : "Paddy Purchase"),
            TotalAmount  = req.Amount,
            // PDC cheque = unpaid until cleared; credit = unpaid; cash/bank = fully paid
            PaidAmount   = (req.PaymentMode == "credit" || isPurchasePostDated) ? 0 : req.Amount,
            PaymentMode  = req.PaymentMode,
            ChequeId     = purchaseCheque?.ChequeId,
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
            PartyId   = req.PaymentMode == "credit" ? req.PartyId : null,
            CrAmount  = req.Amount,
            Narration = txn.Narration
        });

        _db.Transactions.Add(txn);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = txn.TxnId },
            new { txn.TxnId, txn.TxnNumber, message = "Paddy purchase recorded successfully" });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Rice Sale
    // DR: Cash (24) OR Debtor (15.x)
    // CR: Sales (7)
    // ─────────────────────────────────────────────────────────────
    /// <summary>Record a rice sale</summary>
    [HttpPost("rice-sale")]
    public async Task<IActionResult> RiceSale([FromBody] SaleRequest req)
    {
        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        var userId = GetUserId();
        var txnNumber = await GenerateNumber("SINV");

        // Cheque: check if post-dated (cheque date > today)
        bool isPostDated = req.PaymentMode == "cheque"
            && req.ChequeDetails != null
            && req.ChequeDetails.ChequeDate > DateOnly.FromDateTime(DateTime.Today);

        // Resolve debit account
        var drAccountCode = req.PaymentMode switch
        {
            "cash"          => "24",    // Cash
            "bank_transfer" => "17.1",  // Bank Current
            "cheque"        => isPostDated ? "23" : "17.1",  // PDC=23, today=Bank
            _               => req.DebtorAccountCode ?? "15"  // Debtor on credit
        };

        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == drAccountCode);
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == "7"); // Sales

        // Save cheque record if cheque payment
        Cheque? cheque = null;
        if (req.PaymentMode == "cheque" && req.ChequeDetails != null)
        {
            cheque = new Cheque
            {
                ChequeNumber = req.ChequeDetails.ChequeNumber,
                BankName     = req.ChequeDetails.BankName,
                ChequeDate   = req.ChequeDetails.ChequeDate,
                Amount       = req.Amount,
                ChequeType   = "received",
                PartyId      = req.PartyId,
                IsPostDated  = isPostDated,
                Status       = isPostDated ? "pending" : "cleared"
            };
            _db.Cheques.Add(cheque);
            await _db.SaveChangesAsync();
        }

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.TxnDate,
            TxnType      = "sale",
            PartyId      = req.PartyId,
            Reference    = req.Reference ?? cheque?.ChequeNumber,
            Narration    = req.Narration ?? (isPostDated ? $"Rice Sale — PDC Cheque (due {req.ChequeDetails?.ChequeDate})" : "Rice Sale"),
            TotalAmount  = req.Amount,
            // PDC cheque = unpaid until cleared; credit = unpaid; cash/bank = fully paid
            PaidAmount   = (req.PaymentMode == "credit" || isPostDated) ? 0 : req.Amount,
            PaymentMode  = req.PaymentMode,
            ChequeId     = cheque?.ChequeId,
            FiscalYearId = fiscalYear.FiscalYearId,
            CreatedBy    = userId
        };

        txn.Entries.Add(new TransactionEntry
        {
            AccountId = drAccount.AccountId,
            PartyId   = req.PaymentMode == "credit" ? req.PartyId : null,
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
        return CreatedAtAction(nameof(GetById), new { id = txn.TxnId },
            new { txn.TxnId, txn.TxnNumber,
                  isPostDated,
                  chequeAccount = drAccountCode == "23" ? "PDC (23)" : "Bank (17.1)",
                  message = isPostDated
                    ? $"Rice Sale recorded — PDC cheque posted to account 23. Clear on {req.ChequeDetails?.ChequeDate}"
                    : "Rice sale recorded successfully" });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Expense
    // DR: Expense Account (10/11/12/13/14/22 etc.)
    // CR: Cash (24) OR Bank (17.1/17.2)
    // ─────────────────────────────────────────────────────────────
    /// <summary>Record an expense</summary>
    [HttpPost("expense")]
    public async Task<IActionResult> Expense([FromBody] ExpenseRequest req)
    {
        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        var userId = GetUserId();
        var txnNumber = await GenerateNumber("EXP");

        var drAccount = await _db.Accounts.FirstOrDefaultAsync(a => a.AccountCode == req.ExpenseAccountCode);
        if (drAccount == null) return BadRequest(new { message = $"Account {req.ExpenseAccountCode} not found" });

        var crAccountCode = req.PaymentMode switch
        {
            "bank_transfer" => "17.1",
            "cheque"        => "17.1",
            _               => "24"   // Cash
        };
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == crAccountCode);

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.TxnDate,
            TxnType      = "expense",
            PartyId      = req.PartyId,
            Narration    = req.Narration ?? $"Expense - {drAccount.AccountName}",
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
        return CreatedAtAction(nameof(GetById), new { id = txn.TxnId },
            new { txn.TxnId, txn.TxnNumber, message = "Expense recorded successfully" });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Receipt (collect money from customer)
    // DR: Cash (24) OR Bank (17.1)
    // CR: Debtor (15.x)
    // ─────────────────────────────────────────────────────────────
    /// <summary>Record a receipt — money collected from customer</summary>
    [HttpPost("receipt")]
    public async Task<IActionResult> Receipt([FromBody] ReceiptPaymentRequest req)
    {
        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        var userId = GetUserId();
        var txnNumber = await GenerateNumber("REC");

        var drAccountCode = req.PaymentMode switch
        {
            "bank_transfer" => "17.1",
            "cheque"        => req.IsPostDated ? "23" : "17.1",  // PDC goes to account 23
            _               => "24"  // Cash
        };

        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == drAccountCode);
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == req.PartyAccountCode);

        Cheque? cheque = null;
        if (req.PaymentMode == "cheque" && req.ChequeDetails != null)
        {
            cheque = new Cheque
            {
                ChequeNumber = req.ChequeDetails.ChequeNumber,
                BankName     = req.ChequeDetails.BankName,
                ChequeDate   = req.ChequeDetails.ChequeDate,
                Amount       = req.Amount,
                ChequeType   = "received",
                PartyId      = req.PartyId,
                IsPostDated  = req.IsPostDated,
                Status       = "pending"
            };
            _db.Cheques.Add(cheque);
            await _db.SaveChangesAsync();
        }

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.TxnDate,
            TxnType      = "receipt",
            PartyId      = req.PartyId,
            Reference    = req.Reference,
            Narration    = req.Narration ?? "Receipt from customer",
            TotalAmount  = req.Amount,
            PaidAmount   = req.Amount,
            PaymentMode  = req.PaymentMode,
            ChequeId     = cheque?.ChequeId,
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

        // If linked to a sale invoice, update its PaidAmount
        if (req.LinkedTxnId.HasValue)
        {
            var linkedTxn = await _db.Transactions.FindAsync(req.LinkedTxnId.Value);
            if (linkedTxn != null)
            {
                linkedTxn.PaidAmount = Math.Min(linkedTxn.TotalAmount,
                                                linkedTxn.PaidAmount + req.Amount);
                await _db.SaveChangesAsync();
            }
        }

        return CreatedAtAction(nameof(GetById), new { id = txn.TxnId },
            new { txn.TxnId, txn.TxnNumber, message = "Receipt recorded successfully" });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Payment (pay money to supplier)
    // DR: Creditor (16.1.1)
    // CR: Cash (24) OR Bank (17.1)
    // ─────────────────────────────────────────────────────────────
    /// <summary>Record a payment — money paid to supplier</summary>
    [HttpPost("payment")]
    public async Task<IActionResult> Payment([FromBody] ReceiptPaymentRequest req)
    {
        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        var userId = GetUserId();
        var txnNumber = await GenerateNumber("PAY");

        var crAccountCode = req.PaymentMode switch
        {
            "bank_transfer" => "17.1",
            "cheque"        => "17.1",
            _               => "24"  // Cash
        };

        var drAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == req.PartyAccountCode);
        var crAccount = await _db.Accounts.FirstAsync(a => a.AccountCode == crAccountCode);

        Cheque? cheque = null;
        if (req.PaymentMode == "cheque" && req.ChequeDetails != null)
        {
            cheque = new Cheque
            {
                ChequeNumber = req.ChequeDetails.ChequeNumber,
                BankName     = req.ChequeDetails.BankName,
                ChequeDate   = req.ChequeDetails.ChequeDate,
                Amount       = req.Amount,
                ChequeType   = "issued",
                PartyId      = req.PartyId,
                IsPostDated  = req.IsPostDated,
                Status       = "pending"
            };
            _db.Cheques.Add(cheque);
            await _db.SaveChangesAsync();
        }

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.TxnDate,
            TxnType      = "payment",
            PartyId      = req.PartyId,
            Reference    = req.Reference,
            Narration    = req.Narration ?? "Payment to supplier",
            TotalAmount  = req.Amount,
            PaidAmount   = req.Amount,
            PaymentMode  = req.PaymentMode,
            ChequeId     = cheque?.ChequeId,
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

        // If linked to a purchase invoice, update its PaidAmount
        if (req.LinkedTxnId.HasValue)
        {
            var linkedTxn = await _db.Transactions.FindAsync(req.LinkedTxnId.Value);
            if (linkedTxn != null)
            {
                linkedTxn.PaidAmount = Math.Min(linkedTxn.TotalAmount,
                                                linkedTxn.PaidAmount + req.Amount);
                await _db.SaveChangesAsync();
            }
        }

        return CreatedAtAction(nameof(GetById), new { id = txn.TxnId },
            new { txn.TxnId, txn.TxnNumber, message = "Payment recorded successfully" });
    }

    
    // ─────────────────────────────────────────────────────────────
    // POST: Journal Entry (manual double entry)
    // DR/CR: Any accounts
    // ─────────────────────────────────────────────────────────────
    /// <summary>Post a manual journal entry — must balance (DR = CR)</summary>
    [HttpPost("journal")]
    public async Task<IActionResult> Journal([FromBody] JournalRequest req)
    {
        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year found" });

        // Validate balance
        var totalDr = req.Entries.Sum(e => e.DrAmount);
        var totalCr = req.Entries.Sum(e => e.CrAmount);
        if (totalDr != totalCr)
            return BadRequest(new { message = $"Journal entry does not balance. DR={totalDr}, CR={totalCr}" });

        var userId = GetUserId();
        var txnNumber = await GenerateNumber("JNL");

        var txn = new Transaction
        {
            TxnNumber    = txnNumber,
            TxnDate      = req.TxnDate,
            TxnType      = "journal",
            Narration    = req.Narration,
            TotalAmount  = totalDr,
            PaidAmount   = totalDr,
            PaymentMode  = "journal",
            FiscalYearId = fiscalYear.FiscalYearId,
            CreatedBy    = userId
        };

        foreach (var entry in req.Entries)
        {
            var account = await _db.Accounts.FirstOrDefaultAsync(a => a.AccountCode == entry.AccountCode);
            if (account == null)
                return BadRequest(new { message = $"Account {entry.AccountCode} not found" });

            txn.Entries.Add(new TransactionEntry
            {
                AccountId = account.AccountId,
                PartyId   = entry.PartyId,
                DrAmount  = entry.DrAmount,
                CrAmount  = entry.CrAmount,
                Narration = entry.Narration ?? req.Narration
            });
        }

        _db.Transactions.Add(txn);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = txn.TxnId },
            new { txn.TxnId, txn.TxnNumber, message = "Journal entry posted successfully" });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Cancel a transaction (posts reversal entries)
    // ─────────────────────────────────────────────────────────────
    /// <summary>Cancel a transaction — posts reversal journal entry</summary>
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelRequest req)
    {
        var txn = await _db.Transactions
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.TxnId == id);

        if (txn == null) return NotFound();
        if (txn.IsCancelled) return BadRequest(new { message = "Transaction already cancelled" });

        var fiscalYear = await GetActiveFiscalYear();
        if (fiscalYear == null) return BadRequest(new { message = "No active fiscal year" });

        // Post reversal
        var reversalNumber = await GenerateNumber("REV");
        var reversal = new Transaction
        {
            TxnNumber    = reversalNumber,
            TxnDate      = DateOnly.FromDateTime(DateTime.Today),
            TxnType      = "journal",
            Narration    = $"Reversal of {txn.TxnNumber} - {req.Reason}",
            TotalAmount  = txn.TotalAmount,
            PaidAmount   = txn.TotalAmount,
            PaymentMode  = "journal",
            FiscalYearId = fiscalYear.FiscalYearId,
            CreatedBy    = GetUserId()
        };

        // Swap DR and CR to reverse
        foreach (var entry in txn.Entries)
        {
            reversal.Entries.Add(new TransactionEntry
            {
                AccountId = entry.AccountId,
                PartyId   = entry.PartyId,
                DrAmount  = entry.CrAmount,
                CrAmount  = entry.DrAmount,
                Narration = reversal.Narration
            });
        }

        txn.IsCancelled = true;
        _db.Transactions.Add(reversal);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Transaction cancelled. Reversal posted as {reversalNumber}" });
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────
    private async Task<FiscalYear?> GetActiveFiscalYear()
        => await _db.FiscalYears.FirstOrDefaultAsync(f => !f.IsClosed);

    private int GetUserId()
    {
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null ? int.Parse(claim.Value) : 1;
    }

    private async Task<string> GenerateNumber(string prefix)
    {
        var count = await _db.Transactions.CountAsync() + 1;
        var year = DateTime.Today.Year;
        return $"{prefix}-{year}-{count:D4}";
    }
}

// ─── REQUEST MODELS ──────────────────────────────────────────────────────────

public record PurchaseRequest(
    DateOnly TxnDate,
    int PartyId,
    decimal Amount,
    string PaymentMode,   // cash / credit / bank_transfer / cheque / advance
    string? Reference,
    string? Narration,
    ChequeDetails? ChequeDetails  // required if cheque
);

public record SaleRequest(
    DateOnly TxnDate,
    int PartyId,
    decimal Amount,
    string PaymentMode,           // cash / credit / bank_transfer / cheque
    string? DebtorAccountCode,    // required if credit
    string? Reference,
    string? Narration,
    ChequeDetails? ChequeDetails  // required if cheque — includes cheque date for PDC detection
);

public record ExpenseRequest(
    DateOnly TxnDate,
    string ExpenseAccountCode,    // e.g. "10","11","12","13","14","22"
    decimal Amount,
    string PaymentMode,           // cash / bank_transfer / cheque
    int? PartyId,
    string? Narration
);

public record ReceiptPaymentRequest(
    DateOnly TxnDate,
    int PartyId,
    string PartyAccountCode,      // Debtor account e.g. "15" for receipt, "16.1.1" for payment
    decimal Amount,
    string PaymentMode,           // cash / bank_transfer / cheque
    bool IsPostDated,
    string? Reference,
    string? Narration,
    ChequeDetails? ChequeDetails,
    int? LinkedTxnId              // optional — links receipt to a sale / payment to a purchase
);

public record ChequeDetails(
    string ChequeNumber,
    string BankName,
    DateOnly ChequeDate
);


public record JournalRequest(
    DateOnly TxnDate,
    string Narration,
    List<JournalEntryLine> Entries
);

public record JournalEntryLine(
    string AccountCode,
    int? PartyId,
    decimal DrAmount,
    decimal CrAmount,
    string? Narration
);

public record CancelRequest(string Reason);