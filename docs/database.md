# Database

PostgreSQL is the configured datasource. `prisma/schema.prisma` is the current schema definition; migration SQL is under `prisma/migrations/`. Prisma Client is generated during `npm run build`.

## Models

| Model | Purpose and key data |
|---|---|
| `User` | Name, unique email and username, bcrypt password hash, role, avatar, active state, last login, optional per-user SMTP settings. |
| `Assistance` | Technical Assistance record: unique reference, start/end dates, shift/location/show-group, client/problem/category/resolution, priority/status, times, assigned/accountable/remarks, owner and lock fields. |
| `Task` | Other Task record with the shared operational fields plus activity type and description. |
| `MasterData` | Typed location, shift, show/group, category and activity-type values. `(kind, value)` is unique; `active` marks retired values. |
| `Counter` | Integer counters keyed by record type and year for reference-number allocation. |
| `Branding` | Singleton-style row with title, tagline, logo URL and favicon URL. |
| `AuditLog` | Action, entity type/id, optional actor ID, JSON details and timestamp. Indexed by timestamp and entity type. |
| `WorkLog` | Append-only record note with type, message, creator ID/name and timestamp; linked to either Assistance or Task. |

Enums are `Status` (`OPEN`, `CLOSE_PENDING`, `CLOSED`), `Role` (`ADMIN`, `USER`), `Priority` (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`), `MasterKind`, and `WorkLogType` (`RESOLUTION`, `REMARK`, `INVESTIGATION`).

## Relationships and retention

- Assistance and Task have nullable owner and lock-holder relations to User. Deleting a user sets those foreign keys to null; the operational record remains.
- Work logs have optional relations to Assistance and Task. Their foreign keys use `Restrict`, so an attached work-log history prevents deletion of that record at the database level. The single-record delete handler also checks and reports this condition.
- Work-log creator relations use `SetNull`; `createdByName` preserves the displayed author name.
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
