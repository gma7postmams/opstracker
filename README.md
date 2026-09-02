# MAMS Support Operations Tracker

Daily report system for Technical Assistance and Other Task logging.
See **FEATURES.md** for the full feature and rules specification.

Next.js 16 · PostgreSQL · Prisma · NextAuth

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://opslog:yourpassword@localhost:5432/opslog?schema=public"
NEXTAUTH_URL="http://your-lan-server:3000"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
```

Create the database and seed it:

```bash
createdb opslog                 # or via psql
npx prisma migrate dev --name init
npm run db:seed
```

The seed creates:
- One bootstrap admin: `admin` / `admin123` (override with `SEED_ADMIN_PASSWORD=...`)
- Ten named team accounts, one per person, each with a default password of
  `<username>123` — e.g. `renan` / `renan123`, `janice` / `janice123`
- The default master data (locations, shifts, categories, activity types)

**Change every default password before going live.** The named team accounts
exist so each person's work is attributed to them from day one, rather than
importing everything under a shared login.

### Demo accounts

The sign-in screen deliberately shows no demo credentials — advertising a
working login on a reachable page is not something a production system should
do. A generic `user` / `user123` account is available for demos and training
but is **not** seeded by default:

```bash
SEED_DEMO_USER=true npm run db:seed
```

Do not enable it on the live instance. The standalone `preview.html` mockup
still has the quick-fill buttons, since it exists purely to be clicked through.

```bash
npm run dev        # http://localhost:3000
```

## Deployment (LAN)

```bash
npm run build
pm2 start npm --name opslog -- start
pm2 save
```

Apache reverse proxy:

```apache
ProxyPreserveHost On
ProxyPass        / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
```

Set `NEXTAUTH_URL` to the URL users actually visit — auth cookies depend on it.

## Backup

Administration → Backup & restore downloads a full JSON export.

**The JSON does not include uploaded images.** For a complete backup take both:

```bash
# database + settings
curl -o backup.json http://localhost:3000/api/backup   # or use the UI

# uploaded avatars, logo, favicon
tar czf uploads.tgz public/uploads
```

A `pg_dump` is still worth scheduling as the primary backup; the JSON export is
for portability and selective restore.

## Importing legacy data

Two entry points:

- **Import mine** on the Technical Assistance / Other Tasks pages — any user, and
  every row is logged under them regardless of what the file says.
- **Administration → Import records** — admin only, and the Assigned To /
  Accountable Person columns are read from the file, so a whole shift log can be
  loaded in one pass.

Upload the `.xlsx` directly — no CSV export step needed. Choose the record type, pick the sheet if the workbook has several tabs,
and use the preview to check the mapping and row errors before committing.

Uploading the workbook is preferable to exporting CSV first: Excel date and time
cells arrive typed, so they don't have to be guessed from ambiguous text.

Recognised column headers and normalization rules are in FEATURES.md.

## Project layout

```
app/(app)/        authenticated pages
app/api/          route handlers
lib/records.ts    shared service over both record tables
lib/recordTypes.ts  type config — client-safe, no Prisma import
lib/permissions.ts  ownership, locking, admin rules
lib/validation.ts   Zod schemas incl. cross-field time rules
lib/csv.ts        quote-aware CSV parser + shared normalizers
lib/xlsx.ts       Excel reader — same { headers, rows } shape as the CSV parser
```

### Why one service layer over two tables

Assistance and Task are separate tables with their own columns, but they share
all filtering, sorting, batch and reporting behaviour. `lib/records.ts` drives
either table through a single generic delegate, so that logic exists once.
`lib/recordTypes.ts` holds the per-type configuration and deliberately imports
nothing server-only, because client components import its label helpers.
