# MAMS Support Operations Tracker

# MAMS Support Operations Tracker

OpsTracker is a Next.js application for recording and reviewing Technical Assistance and Other Task activity for the MAMS Support Unit. It uses PostgreSQL through Prisma and credential-based NextAuth sessions.

## Current capabilities

- Separate Technical Assistance and Other Tasks records with reference numbers, status, priority, assignment and date/time fields.
- Searchable, filterable record lists with live elapsed-time counters for open records, Resolution and Remark summaries that prefer typed work logs and fall back to legacy fields, record detail pages, batch actions and a chronological Record Timeline with typed entries, message editing, role-based edit/delete permissions and animations.
- Dashboard summaries, Technical Assistance and Other Tasks lists, and Audit Logs share Today, Yesterday, This Week, This Month, This Year, All Records and Custom period filters using UTC date boundaries. Custom date inputs appear only when Custom is selected.
- Owner/assignee reports include participation counts and report-detail timelines. Excel downloads and email attachments include Summary, Technical Assistance, Other Tasks, Work Logs and Timeline sheets; report emails also attach a PDF rendered from the preview HTML. Record lists offer an owner-only Export mine action.
- User and master-data administration, branding, JSON backup and restore, and audit-log review/export.
- Optional email-based two-factor authentication with six-digit, single-use login codes, throttled delivery, audit events and administrator recovery.
- Spreadsheet and CSV import.

See [FEATURES.md](FEATURES.md) for user-facing behavior and rules. Technical references: [architecture](docs/architecture.md), [database](docs/database.md), [workflow](docs/workflow.md), [permissions](docs/permissions.md), and [reporting](docs/reporting.md). Existing UI standards are in [docs/ui-crm-standards.md](docs/ui-crm-standards.md).

## Stack

- Next.js App Router, React and TypeScript
- PostgreSQL and Prisma
- NextAuth credentials provider with JWT sessions
- Zod validation, ExcelJS, `xlsx`, and Nodemailer

## Requirements and setup

Install a supported Node.js runtime, npm, and PostgreSQL. Create a PostgreSQL database, install dependencies, and create a local `.env` file in the project root containing:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/opslog?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="a-long-random-secret"
```

Use `.env.example` as a starting point for local application settings. Apply the checked-in migrations and seed initial accounts and master data:

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

## Docker deployment

The production Docker image uses Next.js standalone output and runs as an unprivileged user. The image includes Chromium for rendering report email PDFs. On an Ubuntu VM with Docker Engine and the Compose plugin installed, create a root `.env.production` file with the following values. Local Docker testing uses `.env.docker`. Keep secrets out of source control. Use a strong generated `NEXTAUTH_SECRET` and URL-encode any reserved characters in the database password used in `DATABASE_URL`.

```env
POSTGRES_DB=opslog
POSTGRES_USER=opslog
POSTGRES_PASSWORD=replace-with-a-strong-password
DATABASE_URL=postgresql://opslog:replace-with-a-strong-password@db:5432/opslog?schema=public
NEXTAUTH_URL=https://ops.example.com
NEXTAUTH_SECRET=replace-with-a-long-random-secret
APP_PORT=3000
SEED_ADMIN_PASSWORD=replace-with-a-unique-bootstrap-password
SEED_DEMO_USER=false
```

For a first deployment, run the one-time seed job, then start the application:

```bash
make prod-seed
make prod-up
```

The seed job waits for PostgreSQL, applies pending migrations, and runs `npm run db:seed`. Its dedicated build target includes the development dependencies needed by `tsx`; those dependencies are not included in the optimized standalone app image. The job is not part of the normal `up` lifecycle, so it will not reseed on subsequent restarts. The seed uses upserts and does not replace passwords for existing accounts. Set `SEED_ADMIN_PASSWORD` in `.env.production` before the first run; the script otherwise falls back to the weak default `admin123`. Seeded team accounts also have per-user default passwords (`<username>123`); change them after initial login. Keep `SEED_DEMO_USER=false` unless a generic demo account is specifically needed.

For later deployments, run `make prod-update`. The app container runs `prisma migrate deploy` before starting Next.js; the command applies pending checked-in migrations and is safe to repeat on container restarts. Back up the database before deploying schema changes; for multi-instance deployments, run migrations once as a deployment job before starting application replicas.

Compose persists PostgreSQL data in the `postgres_data` named volume and uploaded images in the `uploads` named volume mounted at `/app/public/uploads`. The `/uploads/[filename]` route reads from that volume at runtime, including files created after the standalone build. Back up both volumes as part of the deployment's recovery plan. A host bind mount such as `./uploads:/app/public/uploads` can replace the upload volume when host-managed backups are preferred; create that directory and make it writable by container UID 1001 first. Keep port 3000 behind a TLS-terminating reverse proxy and restrict VM firewall access to the proxy.

## Makefile usage

Run `make help` to list targets and their descriptions. Development and database commands include `make install`, `make dev`, `make build`, `make lint`, `make test`, `make prisma-generate`, `make prisma-migrate`, `make prisma-reset`, and `make seed`.

Local Docker targets use `.env.docker`: `make docker-build`, `make docker-up`, `make docker-down`, `make docker-logs`, `make docker-restart`, and `make docker-seed`. Production targets use `.env.production`: `make prod-build`, `make prod-up`, `make prod-down`, `make prod-logs`, `make prod-seed`, and `make prod-update`. The `down` commands preserve named volumes.

Utilities are `make status`, `make clean`, `make backup-db`, and `make backup-uploads`. Status and backup targets operate on the local Docker stack; backups are written to `backups/` by default. Override paths and the Compose command with Make variables, for example `make prod-up ENV_PROD=/path/to/.env.production`. `make test` runs an npm test script if configured, then runs the TypeScript checker. The project currently has no test script, and its existing `npm run lint` command uses `next lint`, which is not supported by the installed Next.js 16 CLI.

## Operational data

Administrators can download or restore a versioned JSON database backup from Administration. The file includes user password hashes and must be protected. It excludes uploaded assets; preserve `public/uploads` separately. Imports accept `.xlsx`, `.xlsm`, and `.csv` files up to 10 MB. The import scope defaults to both the `Technical Assistance` and `Other Tasks` worksheets, with either worksheet available individually from any record page; additional tabs such as `WorkLogs` are ignored. Preview and completion summaries show counts per worksheet, and warnings identify their worksheet. Preview dates match the dates imported; Excel date/time serials are normalized before validation. Closed rows need `End Date` and `Time Ended`; close-pending rows receive the current date/time for missing end fields. Both fields are included in the downloadable template. Optional `Assigned To` values are matched by user full name; unknown or ambiguous names remain unassigned with a preview warning. Imported records are owned by the importer, and `Accountable Person` values are ignored. Report workbooks include Work Logs and Timeline worksheets for exported entries.

The application writes uploaded images to `public/uploads`; use persistent storage for this directory when deploying. Email reporting and Email 2FA use the per-user Gmail SMTP settings saved in the profile. Users must configure a Gmail sender and app password before enabling 2FA. Report workbooks include Summary, Technical Assistance, Other Tasks, Work Logs and Timeline worksheets.

## Project map

| Path | Purpose |
|---|---|
| `app/(app)/` | Authenticated application pages |
| `app/api/` | Next.js route handlers |
| `components/` | Shared record, import, backup, and UI components |
| `lib/` | Authentication, permissions, validation, record/report services, and utilities |
| `prisma/schema.prisma` | PostgreSQL data model |
| `prisma/migrations/` | Database migration history |
| `public/templates/` | Import workbook template |
| `public/uploads/` | Runtime user and branding image uploads |
