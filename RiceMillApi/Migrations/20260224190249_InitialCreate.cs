using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RiceMillApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Accounts",
                columns: table => new
                {
                    AccountId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AccountName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AccountType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ParentAccountId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Accounts", x => x.AccountId);
                    table.ForeignKey(
                        name: "FK_Accounts_Accounts_ParentAccountId",
                        column: x => x.ParentAccountId,
                        principalTable: "Accounts",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FiscalYears",
                columns: table => new
                {
                    FiscalYearId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    YearLabel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsClosed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiscalYears", x => x.FiscalYearId);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    FullName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "accountant"),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                });

            migrationBuilder.CreateTable(
                name: "Parties",
                columns: table => new
                {
                    PartyId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PartyCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PartyName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PartyType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    OpeningBalance = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    OpeningBalanceType = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false, defaultValue: "DR"),
                    CreditLimit = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    LinkedAccountId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parties", x => x.PartyId);
                    table.ForeignKey(
                        name: "FK_Parties_Accounts_LinkedAccountId",
                        column: x => x.LinkedAccountId,
                        principalTable: "Accounts",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Cheques",
                columns: table => new
                {
                    ChequeId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ChequeNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    BankName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ChequeDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    ChequeType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    PartyId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "pending"),
                    ClearedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsPostDated = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cheques", x => x.ChequeId);
                    table.ForeignKey(
                        name: "FK_Cheques_Parties_PartyId",
                        column: x => x.PartyId,
                        principalTable: "Parties",
                        principalColumn: "PartyId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    TxnId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TxnNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    TxnDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TxnType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    PartyId = table.Column<int>(type: "integer", nullable: true),
                    Reference = table.Column<string>(type: "text", nullable: true),
                    Narration = table.Column<string>(type: "text", nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    PaidAmount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    PaymentMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "cash"),
                    ChequeId = table.Column<int>(type: "integer", nullable: true),
                    FiscalYearId = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsCancelled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.TxnId);
                    table.ForeignKey(
                        name: "FK_Transactions_Cheques_ChequeId",
                        column: x => x.ChequeId,
                        principalTable: "Cheques",
                        principalColumn: "ChequeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_FiscalYears_FiscalYearId",
                        column: x => x.FiscalYearId,
                        principalTable: "FiscalYears",
                        principalColumn: "FiscalYearId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_Parties_PartyId",
                        column: x => x.PartyId,
                        principalTable: "Parties",
                        principalColumn: "PartyId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Advances",
                columns: table => new
                {
                    AdvanceId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PartyId = table.Column<int>(type: "integer", nullable: false),
                    AdvanceType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    AdvanceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    AdjustedAmount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    TxnId = table.Column<int>(type: "integer", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Advances", x => x.AdvanceId);
                    table.ForeignKey(
                        name: "FK_Advances_Parties_PartyId",
                        column: x => x.PartyId,
                        principalTable: "Parties",
                        principalColumn: "PartyId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Advances_Transactions_TxnId",
                        column: x => x.TxnId,
                        principalTable: "Transactions",
                        principalColumn: "TxnId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ContractMillings",
                columns: table => new
                {
                    MillingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MillingNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    MillingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PartyId = table.Column<int>(type: "integer", nullable: false),
                    PaddyQtyKg = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RiceQtyKg = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    BranQtyKg = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    MillingCharge = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    PaymentMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "cash"),
                    TxnId = table.Column<int>(type: "integer", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContractMillings", x => x.MillingId);
                    table.ForeignKey(
                        name: "FK_ContractMillings_Parties_PartyId",
                        column: x => x.PartyId,
                        principalTable: "Parties",
                        principalColumn: "PartyId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ContractMillings_Transactions_TxnId",
                        column: x => x.TxnId,
                        principalTable: "Transactions",
                        principalColumn: "TxnId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TransactionEntries",
                columns: table => new
                {
                    EntryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TxnId = table.Column<int>(type: "integer", nullable: false),
                    AccountId = table.Column<int>(type: "integer", nullable: false),
                    PartyId = table.Column<int>(type: "integer", nullable: true),
                    DrAmount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    CrAmount = table.Column<decimal>(type: "numeric(15,2)", precision: 15, scale: 2, nullable: false),
                    Narration = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionEntries", x => x.EntryId);
                    table.ForeignKey(
                        name: "FK_TransactionEntries_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TransactionEntries_Parties_PartyId",
                        column: x => x.PartyId,
                        principalTable: "Parties",
                        principalColumn: "PartyId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TransactionEntries_Transactions_TxnId",
                        column: x => x.TxnId,
                        principalTable: "Transactions",
                        principalColumn: "TxnId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Accounts",
                columns: new[] { "AccountId", "AccountCode", "AccountName", "AccountType", "Category", "CreatedAt", "IsActive", "ParentAccountId" },
                values: new object[,]
                {
                    { 1, "1", "Land", "Asset", "Fixed Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9935), true, null },
                    { 2, "2", "Building", "Asset", "Fixed Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9939), true, null },
                    { 3, "3", "Furniture", "Asset", "Fixed Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9942), true, null },
                    { 4, "4", "Machinery", "Asset", "Fixed Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9944), true, null },
                    { 5, "5", "Vehicles", "Asset", "Fixed Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9946), true, null },
                    { 6, "6", "Purchase", "Expense", "Direct Cost", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9948), true, null },
                    { 7, "7", "Sales", "Income", "Revenue", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9950), true, null },
                    { 8, "8", "Other Income", "Income", "Other Income", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9952), true, null },
                    { 9, "10", "Administrative Expenses", "Expense", "Indirect Expense", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9954), true, null },
                    { 10, "11", "Selling & Distribution Exp", "Expense", "Indirect Expense", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9956), true, null },
                    { 11, "12", "Financial Expense", "Expense", "Financial", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9958), true, null },
                    { 12, "13", "General Expense", "Expense", "Indirect Expense", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9960), true, null },
                    { 13, "14", "Production Expense", "Expense", "Direct Cost", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9968), true, null },
                    { 14, "15.1", "Debtor 1", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9969), true, null },
                    { 15, "15.2", "Debtor 2", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9971), true, null },
                    { 16, "15.3", "Debtor 3", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9973), true, null },
                    { 17, "15.4", "Debtor 4", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9975), true, null },
                    { 18, "15.5", "Debtor 5", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9977), true, null },
                    { 19, "15.6", "Debtor 6", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9980), true, null },
                    { 20, "15.7", "Debtor 7", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9981), true, null },
                    { 21, "15.8", "Debtor 8", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9983), true, null },
                    { 22, "15.9", "Debtor 9", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9985), true, null },
                    { 23, "16.1.1", "Paddy Creditors", "Liability", "Current Liability", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9987), true, null },
                    { 24, "16.1.2", "Other Creditors", "Liability", "Current Liability", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9988), true, null },
                    { 25, "16.1.3", "Financial Creditors", "Liability", "Current Liability", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9990), true, null },
                    { 26, "16.2", "Bank Long-Term Loan", "Liability", "Long-Term Liability", new DateTime(2026, 2, 24, 19, 2, 48, 898, DateTimeKind.Utc).AddTicks(9992), true, null },
                    { 27, "17.1", "Bank - Current Account", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(32), true, null },
                    { 28, "17.2", "Bank - Saving Account", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(34), true, null },
                    { 29, "18.1", "Salary Advance", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(36), true, null },
                    { 30, "18.2", "Paddy Purchase Advance", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(37), true, null },
                    { 31, "19", "Insurance", "Asset", "Prepaid", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(39), true, null },
                    { 32, "20", "Fixed Deposit", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(41), true, null },
                    { 33, "21", "Lease", "Asset", "Long-Term", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(43), true, null },
                    { 34, "22", "Miscellaneous Account", "Expense", "General", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(44), true, null },
                    { 35, "23", "Post-Dated Cheque", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(46), true, null },
                    { 36, "24", "Cash", "Asset", "Current Asset", new DateTime(2026, 2, 24, 19, 2, 48, 899, DateTimeKind.Utc).AddTicks(48), true, null }
                });

            migrationBuilder.InsertData(
                table: "FiscalYears",
                columns: new[] { "FiscalYearId", "EndDate", "IsClosed", "StartDate", "YearLabel" },
                values: new object[] { 1, new DateOnly(2025, 3, 31), false, new DateOnly(2024, 4, 1), "2024-2025" });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "UserId", "CreatedAt", "FullName", "IsActive", "PasswordHash", "Role", "Username" },
                values: new object[] { 1, new DateTime(2026, 2, 24, 19, 2, 49, 53, DateTimeKind.Utc).AddTicks(581), "System Administrator", true, "$2a$11$w378D4UVyqgeZrRtI5yIBuDovGkKLtFFYEFMM9JUhfQqtqUjUvXbm", "admin", "admin" });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_AccountCode",
                table: "Accounts",
                column: "AccountCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_ParentAccountId",
                table: "Accounts",
                column: "ParentAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Advances_PartyId",
                table: "Advances",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_Advances_TxnId",
                table: "Advances",
                column: "TxnId");

            migrationBuilder.CreateIndex(
                name: "IX_Cheques_PartyId",
                table: "Cheques",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_ContractMillings_MillingNumber",
                table: "ContractMillings",
                column: "MillingNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContractMillings_PartyId",
                table: "ContractMillings",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_ContractMillings_TxnId",
                table: "ContractMillings",
                column: "TxnId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Parties_LinkedAccountId",
                table: "Parties",
                column: "LinkedAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Parties_PartyCode",
                table: "Parties",
                column: "PartyCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransactionEntries_AccountId",
                table: "TransactionEntries",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionEntries_PartyId",
                table: "TransactionEntries",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionEntries_TxnId",
                table: "TransactionEntries",
                column: "TxnId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_ChequeId",
                table: "Transactions",
                column: "ChequeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CreatedBy",
                table: "Transactions",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_FiscalYearId",
                table: "Transactions",
                column: "FiscalYearId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_PartyId",
                table: "Transactions",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_TxnNumber",
                table: "Transactions",
                column: "TxnNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Advances");

            migrationBuilder.DropTable(
                name: "ContractMillings");

            migrationBuilder.DropTable(
                name: "TransactionEntries");

            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropTable(
                name: "Cheques");

            migrationBuilder.DropTable(
                name: "FiscalYears");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Parties");

            migrationBuilder.DropTable(
                name: "Accounts");
        }
    }
}
