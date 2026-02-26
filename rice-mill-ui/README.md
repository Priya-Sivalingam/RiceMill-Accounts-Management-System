# Rice Mill UI — React Frontend

## Tech Stack
- React 18
- Material UI (MUI) v5
- React Router v6
- Axios (API calls)
- Recharts (charts)

## Setup Instructions

### 1. Install Node.js
Download from: https://nodejs.org (choose LTS version)

### 2. Install dependencies
```bash
cd rice-mill-ui
npm install
```

### 3. Make sure your backend is running
```bash
# In your backend folder:
set ASPNETCORE_ENVIRONMENT=Development
dotnet run
# Should run on http://localhost:5000
```

### 4. Start the frontend
```bash
npm start
```
Opens at: http://localhost:3000

## Login
- Username: admin
- Password: Admin@1234

## Pages Built
| Page | Path |
|------|------|
| Login | /login |
| Dashboard | / |
| Parties | /parties |
| Balance Sheet | /reports/balancesheet |

## Pages Coming Next
- Transactions (Paddy Purchase, Rice Sale, Expense, etc.)
- Cheques
- Advances
- Cash Book Report
- Profit & Loss Report
- Debtors / Creditors Report
