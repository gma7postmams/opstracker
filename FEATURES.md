# MAMS Support Operations Tracker — Features & Rules

Daily report system for Technical Assistance and Other Task logging, replacing
the Excel/CSV workflow with a database-backed web application.

**Stack:** Next.js 16 (App Router) · PostgreSQL · Prisma · NextAuth
**Deployment:** LAN server, pm2 behind an Apache reverse proxy

---

## 1. Records

Two record types, each on its own page and its own database table.

### Shared fields

| Field | Notes |
|---|---|
| Date | Required |
| Shift | From master data |
| Location | From master data |
| Show / Group | Optional, from master data |
| Priority | Low · Normal · High · Critical |
| Time started | 24-hour HH:MM, required |
| Time ended | 24-hour HH:MM, optional while open |
| Status | Open · Close Pending · Closed |
| Assigned to | Person doing the work — drives the productivity tally |
| Accountable person | Person answerable for it |
| Remarks | Free text |

### Technical Assistance only
Client name · Problem · Category · Resolution

### Other Task only
Activity type · Description

### Reference numbers
Auto-generated per type and year: `TA-2026-00001`, `OT-2026-00001`.
Allocated from a counter row inside the same transaction as the insert, so two
people saving at the same moment cannot receive the same number.

---

## 2. Record list pages

- **Search** across visible fields only — reference number, location, show/group,
  assigned, accountable, remarks, and the type-specific fields.
- **Filters:** status, location, shift, date from/to. A chip shows how many are
  active and clears them all.
- **Sorting** on every column, click again to reverse. Priority sorts by severity
  (Critical → Low), not alphabetically. Date sorts by date then start time.
- **Multi-select** with a select-all checkbox in the header.
- **Batch actions:** Edit, Lock, Unlock, Delete.
- Locked records show a padlock in the list.

### Batch edit
A "leave unchanged" form covering status, priority, location, shift, assigned,
accountable and time ended. Only the fields actually changed are written; every
other field is left alone across the whole selection.

---

## 3. Record detail

Full field view, activity history timeline, inline status change, edit, delete,
and — for admins — lock/unlock. The edit button is disabled with an explanatory
tooltip when the rules below block it.

---

## 4. Dashboard

- Six colour-accented count cards: assistance, tasks, total, open, close pending, closed
- Status distribution bar with legend
- 7-day activity trend, peak day highlighted
- Needs-attention list of open and close-pending records, priority-flagged
- Assistance-by-category breakdown
- Quick actions

---

## 5. Reports

Filters: date range, activity type, status.

**Three separate tallies**, each with per-user rows and an all-users total:

1. Technical Assistance tally
2. Other Task tally
3. Combined tally (only when viewing both types)

Per user: total, completed, open, pending, average completed per day, and average
handling time in minutes. Handling time is computed from start/end and handles
overnight shifts. Exports to CSV.

---

## 6. Users

First name · middle initial · surname · email · username · role · profile photo.

Display name renders as `Juan S. Administrator`, with a surname-first line for
scanning. Photos upload to disk and fall back to coloured initials.

Roles: **ADMIN** and **USER**.

---

## 7. Administration (admin only)

### Branding
Title, tagline, logo and favicon. Applies to the sign-in screen, the sidebar and
the browser tab. Resettable to defaults.

### Master data
Locations, shifts, shows/groups, assistance categories, activity types.
Entries are **retired**, not deleted — existing records store the value as text,
so retiring an entry never changes what past records say.

### Backup & restore
- **Download** a full JSON export: users, both record tables, master data,
  branding and reference-number counters.
- **Restore** in one of two modes, each with a preview showing what is in the
  file versus what is in the database now:
  - **Merge** — adds anything missing, leaves existing rows untouched
  - **Replace** — deletes all current data first (extra confirmation required)
- After a restore, Postgres sequences and reference counters are reset past the
  restored rows so the next insert cannot collide.

> The JSON contains password hashes — store it privately.
> Uploaded images live in `public/uploads` and are **not** inside the JSON.
> Back that folder up alongside it.

---

## 8. Spreadsheet import

Accepts **.xlsx**, **.xlsm** and **.csv**, up to 10 MB. No OneDrive or SharePoint
link fetching — the file is uploaded.

There are **two import modes**, and they differ in one thing: who the rows get
attributed to.

| | Self-service import | Administration import |
|---|---|---|
| Where | "Import mine" on the Technical Assistance and Other Tasks pages | Administration → Import records |
| Who can use it | Any signed-in user | Administrators only |
| Record type | Fixed to the page you are on | Chosen in the dialog |
| Assigned To / Accountable | **Ignored.** Every row is logged under the importer | **Read from the file**, so rows can be attributed to different people |
| If those columns are missing | n/a | Falls back to the importer's name |
| Record ownership | The importer | The importer |

In self-service mode, if the file *does* contain people columns, the preview says
plainly that they are being ignored and names who the rows will be logged under —
an overridden value is never a silent surprise.

Both rules are enforced server-side: a request asking for the administration mode
without an admin session is rejected, and in self-service mode the people columns
are never read regardless of what the client sends.

### Excel
- Reads typed cells, so a real date cell arrives as a date rather than an
  ambiguous `8/26/26` string
- Time cells convert to `HH:MM` using UTC getters, so the server's timezone
  cannot shift a value across midnight
- Formula cells use the computed result; rich text and hyperlink cells flatten
  to their text
- Header row is detected within the first 10 rows, so a title line above the
  header does not break the mapping
- Multi-tab workbooks show a sheet picker; changing sheets re-runs the preview

### CSV
- Quote-aware parser handling commas *and* newlines inside quoted fields
- BOM stripped from Excel-exported files

### Shared by both
- Header aliasing (`Locations`→location, `Assigned To`→assigned, …)
- Status normalized: `close pending`, `close-pending`, `completed`, `resolved`, …
- Times normalized: `8:05 AM` → `08:05`, `12:30 AM` → `00:30`, `22:05:30` → `22:05`
- Dates normalized: ISO, `8/26/2026`, `26/08/2026`, 2-digit years
- **Preview pass** shows detected rows, valid count, per-row errors, ignored
  columns and a 3-row sample before anything is written
- Invalid rows are skipped and reported; the rest still import

---

## 9. Appearance

Light, dark, and system-following themes, switched from a sun/moon control in
the header (and on the sign-in screen).

- **Light** / **Dark** — pinned regardless of the device's OS setting
- **System** (default) — follows the OS preference live; if the device switches
  from light to dark at sunset, the app follows without a manual toggle
- Choice persists across sessions (per browser)
- Applied before the page paints, so there is no flash of the wrong theme on load
- Every surface — cards, status badges, tables, modals, chips, the import
  preview — is themed; nothing hardcodes a light-only background

## Rules

### Ownership and editing

| Rule | Behaviour |
|---|---|
| Ownership | A user may edit only records they entered |
| Admin override | Admins may edit any record |
| Locking | Admin-only. A locked record cannot be edited by its owner |
| Batch scope | Batch actions skip records the user may not touch, and report how many were skipped rather than failing outright |
| Import ownership | Imported records are owned by the importer, so they can be corrected afterwards |
| Self-service import | Any user may import their own work; every row is assigned and accountable to them, whatever the file says |
| Administration import | Admin-only. Reads Assigned To and Accountable Person from the file so a shift log can be loaded in one pass |
| Import formats | .xlsx, .xlsm and .csv only, 10 MB cap — anything else is rejected before parsing |
| User deletion | Records survive and stay attributed; the owner link is set null |

### Data integrity

| Rule | Behaviour |
|---|---|
| Closing a record | Requires a time ended. Closing without one back-fills the start time |
| Reopening a record | Clears the time ended |
| Time order | Time ended may not precede time started |
| Partial edits | Validated against the merged stored record, so cross-field rules still apply |
| Reference numbers | Transaction-allocated per type and year; never derived from row count |
| Master data | Retired rather than deleted |

### Account rules

| Rule | Behaviour |
|---|---|
| Self-role | You cannot change your own role |
| Self-deletion | You cannot delete your own account |
| Last admin | The final admin account cannot be demoted or deleted |
| Uniqueness | Username and email must both be unique |
| Passwords | Minimum 8 characters, bcrypt-hashed |
| Profile edits | A user may edit their own profile; only admins may edit others |

### Access control

| Rule | Behaviour |
|---|---|
| Authentication | All pages except sign-in require a session |
| Admin pages | `/admin` is gated in middleware and re-checked in every API route |
| Branding read | Public — the sign-in screen needs it before authentication |
| Uploads | Any signed-in user may upload an avatar; only admins may replace logo or favicon |
| Upload safety | Type and size validated; stored under a random server-generated filename, never the client's |
| Search scope | Never searches owner ids or lock flags, so searching a username cannot leak which records someone entered |

---

## Notes for operators

- Default seeded accounts are `admin` (bootstrap) plus ten named team accounts —
  change every default password before going live.
- The sign-in screen shows no demo credentials. A generic `user` account is
  opt-in via `SEED_DEMO_USER=true` and should stay off in production.
- Set `NEXTAUTH_SECRET` before going live.
- Uploads are written to `public/uploads`; include it in your backup routine.
- Sessions last 12 hours.
