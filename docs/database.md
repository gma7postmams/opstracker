# Database

PostgreSQL is the configured datasource. `prisma/schema.prisma` is the current schema definition; migration SQL is under `prisma/migrations/`. Prisma Client is generated during `npm run build`.

## Models

| Model | Purpose and key data |
|---|---|
| `User` | Name, unique email and username, bcrypt password hash, role, avatar, active state, last login, Email 2FA state (disabled by default), optional per-user SMTP settings. |
| `Assistance` | Technical Assistance record: unique reference, start/end dates, shift/location/show-group, client/problem/optional cause/category/resolution, priority/status, times, assigned/accountable/remarks, owner and lock fields. |
| `Task` | Other Task record with the shared operational fields plus activity type and description. |
| `MasterData` | Typed location, shift, show/group, category and activity-type values. `(kind, value)` is unique; `active` marks retired values. |
| `Counter` | Integer counters keyed by record type and year for reference-number allocation. |
| `Branding` | Singleton-style row with title, tagline, logo URL and favicon URL. |
| `AuditLog` | Action, entity type/id, optional actor ID, JSON details and timestamp. Indexed by timestamp and entity type. |
| `EmailVerificationCode` | Bcrypt-hashed six-digit one-time code, user ID, expiry, used timestamp and creation timestamp. Indexed by user ID and linked to its user. |
| `WorkLog` | Record timeline note with type, message, creator ID/name, creation timestamp and modification timestamp; linked to either Assistance or Task. |

Enums are `Status` (`OPEN`, `CLOSE_PENDING`, `CLOSED`), `Role` (`ADMIN`, `USER`), `Priority` (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`), `MasterKind`, and `WorkLogType` (`RESOLUTION`, `REMARK`, `INVESTIGATION`).

## Relationships and retention

- Assistance and Task have nullable owner and lock-holder relations to User. Deleting a user sets those foreign keys to null; the operational record remains.
- Work logs have optional relations to Assistance and Task. Their foreign keys use `Restrict`, so an attached work-log history prevents deletion of that record at the database level. The single-record delete handler also checks and reports this condition.
- Work-log creator relations use `SetNull`; `createdByName` preserves the displayed author name.
- Work-log edits update only `message`; `updatedAt` tracks modification time and is initialized from `createdAt` for existing entries.
- Audit log `userId` is a scalar field, not a Prisma relation. Audit history remains independent of user deletion.
- Records keep master-data labels as text, not foreign keys. Retiring a master-data row therefore does not rewrite existing record values.

## Important data rules

- Record `startDate` and optional `endDate` are PostgreSQL `DATE` values. Times are strings in `HH:MM` format.
- Reference numbers are unique and assigned by updating a per-type/year `Counter` inside the same transaction as record creation/import.
- Assistance and Task rows maintain `updatedAt` through Prisma's `@updatedAt` fields. User rows do not have an `updatedAt` column.
- Passwords are stored as bcrypt hashes. The backup API includes those hashes; backup JSON is sensitive.
- Backup JSON includes users, both record tables, branding, master data, counters and audit logs. It does not include work-log rows or uploaded files in the current payload implementation.

## Database operations

Development migration command: `npm run db:migrate` (`prisma migrate dev`). Deployment migration command: `npm run db:deploy` (`prisma migrate deploy`). Seed command: `npm run db:seed`. `npm run db:studio` opens Prisma Studio.

The seed adds a bootstrap admin, ten named team users, default master data and default branding when missing. It does not update existing accounts' passwords or existing seed rows' values.

## Record change notifications

The `20261029130000_add_record_change_notifications` migration adds PostgreSQL triggers to `assistance`, `tasks`, and `work_logs`. Each row-level insert, update, or delete issues the same `opstracker_record_changes` notification with the `records-changed` payload. PostgreSQL delivers notifications only after the transaction commits and coalesces identical channel/payload notifications within a transaction, covering single writes, batch operations, imports, and work-log changes without including record contents. These triggers do not alter report queries or calculations.
