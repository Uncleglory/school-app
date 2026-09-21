# School Management System

Modern, robust school management application built with **Next.js 15**, **Prisma**, **PostgreSQL**, and **Auth.js**.

## Features (Roadmap)

- ✅ **Phase 1** – Auth, Roles, Dashboard shell, Full database schema
- ✅ **Phase 2** – Attendance (students + staff) + real-time alerts to Admin & Parents
- ✅ **Phase 3** – Fees (structures, auto-invoices, payments, receipts) + Exams/Results + Reports
- ✅ **Phase 4** – Students & Staff full CRUD
- ✅ **Phase 5** – Library (books, loans, returns)
- ✅ **Phase 6** – Teaching Materials
- ✅ **Phase 7** – Printable Receipts & Report Cards (Save as PDF)
- ✅ **Phase 8** – Email (Resend) + SMS (Africa’s Talking) + Vercel deploy guide

See **[DEPLOY.md](./DEPLOY.md)** for full Vercel + Neon + Resend setup.





## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL running locally (or use a free Neon / Supabase DB)

### 2. Install
```bash
cd school-app
npm install
```

### 3. Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/schooldb"
AUTH_SECRET="generate-with-npx-auth-secret"
```

### 4. Database
```bash
npx prisma db push
npm run db:seed
```

### 5. Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Login:**
- Email: `admin@school.com`
- Password: `password123`

## Project Structure

```
src/
├── app/
│   ├── (auth)/login          → Login page
│   ├── (dashboard)/          → Protected area
│   │   ├── layout.tsx        → Sidebar + Header
│   │   └── dashboard/        → Home dashboard
│   └── api/auth/[...nextauth]
├── components/
│   ├── ui/                   → shadcn-style components
│   └── layout/               → Sidebar & Header
├── config/navigation.ts      → Role-based menu
├── lib/                      → db, utils, schemas
├── server/actions/           → Server Actions
└── auth.ts + auth.config.ts  → Auth.js setup
prisma/
├── schema.prisma             → Complete data model
└── seed.ts                   → Admin + sample data
```

## Roles

| Role        | Access                                      |
|-------------|---------------------------------------------|
| ADMIN       | Everything                                  |
| TEACHER     | Students, Attendance, Materials             |
| ACCOUNTANT  | Fees                                        |
| LIBRARIAN   | Library                                     |
| PARENT      | Child attendance, fees, materials           |
| STUDENT     | Own materials, library                      |
| STAFF       | Basic dashboard                             |

## Next Steps

Tell me which module to build next:
1. **Attendance + Alerts** (recommended)
2. Students & Staff CRUD
3. Fees automation + receipts
4. Library
5. Teaching Materials
6. Parent portal polish
