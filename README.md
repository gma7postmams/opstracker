# MAMS Support Operations Tracker

# MAMS Support Operations Tracker

OpsTracker is a Next.js application for recording and reviewing Technical Assistance and Other Task activity for the MAMS Support Unit. It uses PostgreSQL through Prisma and credential-based NextAuth sessions.

## Current capabilities

- Separate Technical Assistance and Other Tasks records with reference numbers, status, priority, assignment and date/time fields.
- Searchable, filterable record lists with live elapsed-time counters for open records, Resolution and Remark summaries that prefer typed work logs and fall back to legacy fields, record detail pages, batch actions and a chronological Record Timeline with typed entries, message editing, role-based edit/delete permissions and animations.
- Dashboard summaries, Technical Assistance and Other Tasks lists, and Audit Logs share Today, Yesterday, This Week, This Month, This Year, All Records and Custom period filters using UTC date boundaries. Custom date inputs appear only when Custom is selected.
- Owner/assignee reports include participation counts and report-detail timelines. Excel downloads and email attachments include a WorkLogs sheet; record lists also offer an owner-only Export mine action.
- User and master-data administration, branding, JSON backup and restore, and audit-log review/export.
- Optional email-based two-factor authentication with six-digit, single-use login codes, throttled delivery, audit events and administrator recovery.
- Spreadsheet and CSV import, plus AI text improvement and MACO operational Q&A backed by an Ollama-compatible service.

See [FEATURES.md](FEATURES.md) for user-facing behavior and rules. Technical references: [architecture](docs/architecture.md), [database](docs/database.md), [workflow](docs/workflow.md), [permissions](docs/permissions.md), [reporting](docs/reporting.md), and [AI](docs/ai.md). Existing UI standards are in [docs/ui-crm-standards.md](docs/ui-crm-standards.md).

## Stack

- Next.js App Router, React and TypeScript
- PostgreSQL and Prisma
- NextAuth credentials provider with JWT sessions
- Zod validation, ExcelJS, `xlsx`, and Nodemailer
- Ollama-compatible HTTP API for AI requests

## Requirements and setup

Install a supported Node.js runtime, npm, and PostgreSQL. Create a PostgreSQL database, install dependencies, and create a local `.env` file in the project root containing:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/opslog?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="a-long-random-secret"
```

The repository does not include an `.env.example`. Apply the checked-in migrations and seed initial accounts and master data:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. For local schema development, `npm run db:migrate` runs `prisma migrate dev`; `npm run db:studio` opens Prisma Studio.

The seed creates `admin` with password `admin123` by default, ten named team accounts with password `<username>123`, and initial master-data values. One named team account is also seeded as an administrator. Set `SEED_ADMIN_PASSWORD` to override the bootstrap admin password. `SEED_DEMO_USER=true` additionally creates a generic demo account whose password can be set with `SEED_USER_PASSWORD`. These defaults are not suitable for production. Seeding does not replace passwords for accounts that already exist.

## Build and run

```bash
npm run build
npm run start
```

The production server listens on the Next.js default port unless configured otherwise. Ensure the database is migrated and `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` are set in the runtime environment.

## Operational data

Administrators can download or restore a versioned JSON database backup from Administration. The file includes user password hashes and must be protected. It excludes uploaded assets; preserve `public/uploads` separately. Imports accept `.xlsx`, `.xlsm`, and `.csv` files up to 10 MB. The import scope defaults to both the `Technical Assistance` and `Other Tasks` worksheets, with either worksheet available individually from any record page; additional tabs such as `WorkLogs` are ignored. Preview and completion summaries show counts per worksheet, and warnings identify their worksheet. Preview dates match the dates imported; Excel date/time serials are normalized before validation. Closed rows need `End Date` and `Time Ended`; close-pending rows receive the current date/time for missing end fields. Both fields are included in the downloadable template. Optional `Assigned To` values are matched by user full name; unknown or ambiguous names remain unassigned with a preview warning. Imported records are owned by the importer, and `Accountable Person` values are ignored. Report workbooks include a WorkLogs worksheet for exported entries.

The application writes uploaded images to `public/uploads`; use persistent storage for this directory when deploying. Email reporting and Email 2FA use the per-user Gmail SMTP settings saved in the profile. Users must configure a Gmail sender and app password before enabling 2FA. AI settings are stored in `data/ai-settings.json` and point to the configured Ollama-compatible service.

## Project map

| Path | Purpose |
|---|---|
| `app/(app)/` | Authenticated application pages |
| `app/api/` | Next.js route handlers |
| `components/` | Shared record, import, backup, and UI components |
| `lib/` | Authentication, permissions, validation, record/report services, and utilities |
| `prisma/schema.prisma` | PostgreSQL data model |
| `prisma/migrations/` | Database migration history |
| `data/ai-settings.json` | Runtime AI and MACO settings |
| `public/templates/` | Import workbook template |
| `public/uploads/` | Runtime user and branding image uploads |
