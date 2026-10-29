# Architecture

## Runtime and routing

OpsTracker is a Next.js App Router application using React and TypeScript. The root route redirects to `/dashboard` for an authenticated user and `/login` otherwise. Pages in `app/(app)/` share a server layout that checks the session, loads branding and the current user's avatar, and renders the navigation shell.

The principal pages are:

| Route | Purpose |
|---|---|
| `/dashboard` | Operational counts, trend and attention lists |
| `/assistance` | Technical Assistance records |
| `/tasks` | Other Task records |
| `/records/[type]/[id]` | Shared detail route for either record type |
| `/reports` | Summary/tally reports, export and email preview |
| `/users` | User directory and administrator account management |
| `/admin` | Master data, imports, branding and backup/restore |
| `/audit` | Audit log search and export |
| `/profile` | Current user's profile and email settings |

Middleware protects the listed application page paths and restricts `/admin` to administrators. The shared application layout also checks the session for pages in its route group.

## Request and data flow

1. Client components submit requests to `app/api/**/route.ts` handlers.
2. Route handlers authenticate the caller where implemented, parse inputs with Zod or explicit checks, and call Prisma or shared services.
3. `lib/records.ts` provides shared list, reference-number, permission partition and batch behavior over the Assistance and Task delegates.
4. Prisma Client accesses PostgreSQL using `DATABASE_URL`; `prisma/schema.prisma` defines the persisted models and migrations live in `prisma/migrations/`.

Record changes are also published through PostgreSQL `LISTEN/NOTIFY`. Database triggers on `assistance`, `tasks`, and `work_logs` emit generic invalidations after commits. An authenticated Node.js SSE route uses one reconnecting PostgreSQL listener per app process and fans invalidations out to connected clients. Dashboard metrics and the shared Technical Assistance / Other Tasks list re-fetch through their existing APIs; events contain no record data. SSE reconnects trigger an invalidation to recover changes missed while disconnected. Reports and report email workflows do not subscribe to this stream.

Important shared modules:

- `lib/auth.ts`: NextAuth credentials authentication, JWT session claims and current-user lookup.
- `lib/email2fa.ts`: one-time verification-code issuance, email delivery, throttling and verification.
- `lib/permissions.ts`: record, lock and user-management permission decisions.
- `lib/validation.ts`: record, user, master-data and branding schemas.
- `lib/recordTypes.ts`: client-safe record-type configuration and shared field definitions.
- `lib/reports.ts`, `lib/reportExcel.ts`: report scoping, work-log summaries and workbook generation.
- `lib/audit.ts`: audit event writing.
- `lib/csv.ts`, `lib/xlsx.ts`: import parsing and value normalization.

## External and filesystem dependencies

- PostgreSQL stores users, records, master data, settings, counters, audit events and work logs.
- Nodemailer sends reports and Email 2FA codes through each user's saved Gmail SMTP configuration. Email 2FA is verified before the credentials provider returns a user to NextAuth for JWT session creation.
- Uploaded images are written to `public/uploads` and served by `/uploads/[filename]` through a filesystem-backed route, so runtime-created files work with standalone builds. The import workbook template is served from `public/templates/`.

## Production deployment

The Docker deployment builds Next.js standalone output in a multi-stage Node 22 image and runs the app as a non-root user. Docker Compose provides PostgreSQL 16, waits for its health check, and runs `prisma migrate deploy` before the app server starts. A separate, opt-in seed target includes the development dependencies required by `tsx`; it runs migrations and seed data as a one-shot job without adding those tools to the app image. PostgreSQL data and `public/uploads` are persisted in separate named volumes; back up both independently. The app expects `DATABASE_URL`, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` at runtime.

## API areas

The route handlers cover authentication and Email 2FA, dashboard, records and work logs, reports and Excel/email output, users/profile, master data, branding, upload, import, backup/restore and audit. Authorization is enforced route-by-route; see [permissions.md](permissions.md) for implementation boundaries and known exceptions.
