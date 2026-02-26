# Rice Mill Accounts System — Backend API

## Tech Stack
- .NET 8 Web API
- Entity Framework Core (ORM)
- PostgreSQL
- JWT Authentication
- Swagger UI

---

## Project Structure

```
RiceMillApi/
├── Models/               # Entity classes (DB tables)
│   ├── Account.cs
│   ├── Party.cs
│   ├── FiscalYear.cs
│   ├── User.cs
│   ├── Transaction.cs
│   ├── TransactionEntry.cs
│   ├── Cheque.cs
│   ├── Advance.cs
│   └── ContractMilling.cs
├── Data/
│   └── AppDbContext.cs   # EF Core context + COA seed data
├── Controllers/          # API endpoints (to be added)
├── Services/             # Business logic (to be added)
├── DTOs/                 # Request/Response models (to be added)
├── appsettings.json      # DB connection string + JWT config
└── Program.cs            # App startup + middleware
```

---

## Setup Instructions

### 1. Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [PostgreSQL](https://www.postgresql.org/download/) running locally
- [pgAdmin](https://www.pgadmin.org/) (optional, to view tables)

### 2. Create the Database
Open pgAdmin or psql and run:
```sql
CREATE DATABASE "RiceMillDb";
```

### 3. Update Connection String
Open `appsettings.json` and update:
```json
"DefaultConnection": "Host=localhost;Port=5432;Database=RiceMillDb;Username=postgres;Password=YOUR_PASSWORD"
```

### 4. Restore Packages
```bash
dotnet restore
```

### 5. Create & Apply Migration
```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```
This will:
- Create all 9 tables in PostgreSQL
- Seed the full Chart of Accounts (36 accounts)
- Seed default admin user (username: admin, password: Admin@1234)
- Seed fiscal year 2024-2025

### 6. Run the API
```bash
dotnet run
```

### 7. Open Swagger UI
Visit: http://localhost:5000/swagger

---

## Default Login
| Field    | Value       |
|----------|-------------|
| Username | admin       |
| Password | Admin@1234  |

> ⚠️ Change the password after first login!

---

## Tables Created by EF Migration
| Table               | Purpose                          |
|---------------------|----------------------------------|
| accounts            | Chart of Accounts (COA)          |
| parties             | Suppliers, customers, etc.       |
| fiscal_years        | Accounting periods               |
| users               | System users (2-5 team members)  |
| transactions        | All financial transactions       |
| transaction_entries | Double-entry DR/CR lines         |
| cheques             | Cheque + PDC tracking            |
| advances            | Salary & paddy advances          |
| contract_millings   | Contract milling jobs            |

---

## Next Steps
- [ ] Add Controllers (Parties, Transactions, Reports)
- [ ] Add Services (ledger calculation, balance sheet)
- [ ] Add DTOs (request/response shapes)
- [ ] Add Report endpoints (Cash Book, P&L, Balance Sheet)
