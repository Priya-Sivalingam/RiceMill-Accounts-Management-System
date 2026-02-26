using Microsoft.EntityFrameworkCore;
using RiceMillApi.Models;

namespace RiceMillApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Party> Parties => Set<Party>();
    public DbSet<FiscalYear> FiscalYears => Set<FiscalYear>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<TransactionEntry> TransactionEntries => Set<TransactionEntry>();
    public DbSet<Cheque> Cheques => Set<Cheque>();
    public DbSet<Advance> Advances => Set<Advance>();
    public DbSet<ContractMilling> ContractMillings => Set<ContractMilling>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Account ──────────────────────────────────────────────
        modelBuilder.Entity<Account>(e =>
        {
            e.HasKey(a => a.AccountId);
            e.HasIndex(a => a.AccountCode).IsUnique();
            e.Property(a => a.AccountCode).HasMaxLength(20).IsRequired();
            e.Property(a => a.AccountName).HasMaxLength(100).IsRequired();
            e.Property(a => a.AccountType).HasMaxLength(30).IsRequired();
            e.Property(a => a.Category).HasMaxLength(50).IsRequired();

            // Self-referencing tree for sub-accounts
            e.HasOne(a => a.ParentAccount)
             .WithMany(a => a.SubAccounts)
             .HasForeignKey(a => a.ParentAccountId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Party ─────────────────────────────────────────────────
        modelBuilder.Entity<Party>(e =>
        {
            e.HasKey(p => p.PartyId);
            e.HasIndex(p => p.PartyCode).IsUnique();
            e.Property(p => p.PartyCode).HasMaxLength(20).IsRequired();
            e.Property(p => p.PartyName).HasMaxLength(150).IsRequired();
            e.Property(p => p.PartyType).HasMaxLength(30).IsRequired();
            e.Property(p => p.OpeningBalance).HasPrecision(15, 2);
            e.Property(p => p.CreditLimit).HasPrecision(15, 2);
            e.Property(p => p.OpeningBalanceType).HasMaxLength(2).HasDefaultValue("DR");

            e.HasOne(p => p.LinkedAccount)
             .WithMany()
             .HasForeignKey(p => p.LinkedAccountId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── FiscalYear ────────────────────────────────────────────
        modelBuilder.Entity<FiscalYear>(e =>
        {
            e.HasKey(f => f.FiscalYearId);
            e.Property(f => f.YearLabel).HasMaxLength(20).IsRequired();
        });

        // ── User ──────────────────────────────────────────────────
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.UserId);
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Username).HasMaxLength(50).IsRequired();
            e.Property(u => u.PasswordHash).HasMaxLength(255).IsRequired();
            e.Property(u => u.FullName).HasMaxLength(100).IsRequired();
            e.Property(u => u.Role).HasMaxLength(20).HasDefaultValue("accountant");
        });

        // ── Cheque ────────────────────────────────────────────────
        modelBuilder.Entity<Cheque>(e =>
        {
            e.HasKey(c => c.ChequeId);
            e.Property(c => c.ChequeNumber).HasMaxLength(30).IsRequired();
            e.Property(c => c.BankName).HasMaxLength(100).IsRequired();
            e.Property(c => c.Amount).HasPrecision(15, 2);
            e.Property(c => c.ChequeType).HasMaxLength(10).IsRequired();
            e.Property(c => c.Status).HasMaxLength(20).HasDefaultValue("pending");

            e.HasOne(c => c.Party)
             .WithMany(p => p.Cheques)
             .HasForeignKey(c => c.PartyId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Transaction ───────────────────────────────────────────
        modelBuilder.Entity<Transaction>(e =>
        {
            e.HasKey(t => t.TxnId);
            e.HasIndex(t => t.TxnNumber).IsUnique();
            e.Property(t => t.TxnNumber).HasMaxLength(30).IsRequired();
            e.Property(t => t.TxnType).HasMaxLength(30).IsRequired();
            e.Property(t => t.TotalAmount).HasPrecision(15, 2);
            e.Property(t => t.PaidAmount).HasPrecision(15, 2);
            e.Property(t => t.PaymentMode).HasMaxLength(20).HasDefaultValue("cash");

            // Ignore computed property - calculate in app layer
            e.Ignore(t => t.BalanceDue);

            e.HasOne(t => t.Party)
             .WithMany(p => p.Transactions)
             .HasForeignKey(t => t.PartyId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.FiscalYear)
             .WithMany(f => f.Transactions)
             .HasForeignKey(t => t.FiscalYearId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.CreatedByUser)
             .WithMany(u => u.Transactions)
             .HasForeignKey(t => t.CreatedBy)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.Cheque)
             .WithOne(c => c.Transaction)
             .HasForeignKey<Transaction>(t => t.ChequeId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── TransactionEntry ──────────────────────────────────────
        modelBuilder.Entity<TransactionEntry>(e =>
        {
            e.HasKey(te => te.EntryId);
            e.Property(te => te.DrAmount).HasPrecision(15, 2);
            e.Property(te => te.CrAmount).HasPrecision(15, 2);

            e.HasOne(te => te.Transaction)
             .WithMany(t => t.Entries)
             .HasForeignKey(te => te.TxnId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(te => te.Account)
             .WithMany(a => a.TransactionEntries)
             .HasForeignKey(te => te.AccountId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(te => te.Party)
             .WithMany(p => p.TransactionEntries)
             .HasForeignKey(te => te.PartyId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Advance ───────────────────────────────────────────────
        modelBuilder.Entity<Advance>(e =>
        {
            e.HasKey(a => a.AdvanceId);
            e.Property(a => a.Amount).HasPrecision(15, 2);
            e.Property(a => a.AdjustedAmount).HasPrecision(15, 2);
            e.Property(a => a.AdvanceType).HasMaxLength(30).IsRequired();
            e.Ignore(a => a.Balance);

            e.HasOne(a => a.Party)
             .WithMany(p => p.Advances)
             .HasForeignKey(a => a.PartyId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(a => a.Transaction)
             .WithMany()
             .HasForeignKey(a => a.TxnId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── ContractMilling ───────────────────────────────────────
        modelBuilder.Entity<ContractMilling>(e =>
        {
            e.HasKey(m => m.MillingId);
            e.HasIndex(m => m.MillingNumber).IsUnique();
            e.Property(m => m.MillingNumber).HasMaxLength(30).IsRequired();
            e.Property(m => m.PaddyQtyKg).HasPrecision(10, 2);
            e.Property(m => m.RiceQtyKg).HasPrecision(10, 2);
            e.Property(m => m.BranQtyKg).HasPrecision(10, 2);
            e.Property(m => m.MillingCharge).HasPrecision(10, 2);
            e.Property(m => m.PaymentMode).HasMaxLength(20).HasDefaultValue("cash");

            e.HasOne(m => m.Party)
             .WithMany(p => p.ContractMillings)
             .HasForeignKey(m => m.PartyId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(m => m.Transaction)
             .WithOne(t => t.ContractMilling)
             .HasForeignKey<ContractMilling>(m => m.TxnId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Seed: Default Chart of Accounts ──────────────────────
        modelBuilder.Entity<Account>().HasData(
            new Account { AccountId = 1,  AccountCode = "1",      AccountName = "Land",                        AccountType = "Asset",     Category = "Fixed Asset",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 2,  AccountCode = "2",      AccountName = "Building",                    AccountType = "Asset",     Category = "Fixed Asset",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 3,  AccountCode = "3",      AccountName = "Furniture",                   AccountType = "Asset",     Category = "Fixed Asset",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 4,  AccountCode = "4",      AccountName = "Machinery",                   AccountType = "Asset",     Category = "Fixed Asset",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 5,  AccountCode = "5",      AccountName = "Vehicles",                    AccountType = "Asset",     Category = "Fixed Asset",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 6,  AccountCode = "6",      AccountName = "Purchase",                    AccountType = "Expense",   Category = "Direct Cost",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 7,  AccountCode = "7",      AccountName = "Sales",                       AccountType = "Income",    Category = "Revenue",             CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 8,  AccountCode = "8",      AccountName = "Other Income",                AccountType = "Income",    Category = "Other Income",        CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 9,  AccountCode = "10",     AccountName = "Administrative Expenses",     AccountType = "Expense",   Category = "Indirect Expense",    CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 10, AccountCode = "11",     AccountName = "Selling & Distribution Exp",  AccountType = "Expense",   Category = "Indirect Expense",    CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 11, AccountCode = "12",     AccountName = "Financial Expense",           AccountType = "Expense",   Category = "Financial",           CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 12, AccountCode = "13",     AccountName = "General Expense",             AccountType = "Expense",   Category = "Indirect Expense",    CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 13, AccountCode = "14",     AccountName = "Production Expense",          AccountType = "Expense",   Category = "Direct Cost",         CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 14, AccountCode = "15.1",   AccountName = "Debtor 1",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 15, AccountCode = "15.2",   AccountName = "Debtor 2",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 16, AccountCode = "15.3",   AccountName = "Debtor 3",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 17, AccountCode = "15.4",   AccountName = "Debtor 4",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 18, AccountCode = "15.5",   AccountName = "Debtor 5",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 19, AccountCode = "15.6",   AccountName = "Debtor 6",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 20, AccountCode = "15.7",   AccountName = "Debtor 7",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 21, AccountCode = "15.8",   AccountName = "Debtor 8",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 22, AccountCode = "15.9",   AccountName = "Debtor 9",                    AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 23, AccountCode = "16.1.1", AccountName = "Paddy Creditors",             AccountType = "Liability", Category = "Current Liability",   CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 24, AccountCode = "16.1.2", AccountName = "Other Creditors",             AccountType = "Liability", Category = "Current Liability",   CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 25, AccountCode = "16.1.3", AccountName = "Financial Creditors",         AccountType = "Liability", Category = "Current Liability",   CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 26, AccountCode = "16.2",   AccountName = "Bank Long-Term Loan",         AccountType = "Liability", Category = "Long-Term Liability", CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 27, AccountCode = "17.1",   AccountName = "Bank - Current Account",      AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 28, AccountCode = "17.2",   AccountName = "Bank - Saving Account",       AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 29, AccountCode = "18.1",   AccountName = "Salary Advance",              AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 30, AccountCode = "18.2",   AccountName = "Paddy Purchase Advance",      AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 31, AccountCode = "19",     AccountName = "Insurance",                   AccountType = "Asset",     Category = "Prepaid",             CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 32, AccountCode = "20",     AccountName = "Fixed Deposit",               AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 33, AccountCode = "21",     AccountName = "Lease",                       AccountType = "Asset",     Category = "Long-Term",           CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 34, AccountCode = "22",     AccountName = "Miscellaneous Account",       AccountType = "Expense",   Category = "General",             CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 35, AccountCode = "23",     AccountName = "Post-Dated Cheque",           AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow },
            new Account { AccountId = 36, AccountCode = "24",     AccountName = "Cash",                        AccountType = "Asset",     Category = "Current Asset",       CreatedAt = DateTime.UtcNow }
        );

        // ── Seed: Default Admin User ──────────────────────────────
        modelBuilder.Entity<User>().HasData(
            new User
            {
                UserId = 1,
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@1234"),
                FullName = "System Administrator",
                Role = "admin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );

        // ── Seed: Default Fiscal Year ─────────────────────────────
        modelBuilder.Entity<FiscalYear>().HasData(
            new FiscalYear
            {
                FiscalYearId = 1,
                YearLabel = "2024-2025",
                StartDate = new DateOnly(2024, 4, 1),
                EndDate = new DateOnly(2025, 3, 31),
                IsClosed = false
            }
        );
    }
}
