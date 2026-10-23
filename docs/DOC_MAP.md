# Documentation Map

Use this map to select documentation based on the code that changed. Update only the mapped documentation that applies, along with the conditional root-file rules below.

## Root Documentation Rules

- Always update `CHANGELOG.md` for user-visible changes.
- Update `FEATURES.md` when application functionality changes.
- Update `README.md` only for setup, architecture, deployment, or major capability changes.

## Authentication & Login

Code:
- `app/login/**`
- `app/api/auth/**`
- `app/(app)/profile/**` when authentication or 2FA behavior changes
- `app/api/profile/**` when authentication or 2FA behavior changes
- `lib/auth.ts`
- `lib/email2fa.ts`

Update:
- `docs/authentication.md`
- `docs/workflow.md` only when the overall operational workflow changes
- `FEATURES.md` when functionality changes
- `CHANGELOG.md` for user-visible changes

## Administration

Code:
- `app/(app)/admin/**`
- `app/api/admin/**`

Update:
- `docs/workflow.md`
- `FEATURES.md` when functionality changes
- `CHANGELOG.md` for user-visible changes

## Reports

Code:
- `app/(app)/reports/**`
- `app/api/reports/**`
- `lib/reports.ts`
- `lib/reportExcel.ts`

Update:
- `docs/reporting.md`
- `FEATURES.md` when functionality changes
- `CHANGELOG.md` for user-visible changes

## Database

Code:
- `prisma/**`
- `lib/prisma.ts`

Update:
- `docs/database.md`
- `CHANGELOG.md` for user-visible changes

Also update the relevant domain documentation when a schema or migration changes documented behavior.

## Permissions & User Management

Code:
- `app/(app)/users/**`
- `app/api/users/**`
- `lib/permissions.ts`
- Components that implement or expose permission-controlled actions

Update:
- `docs/permissions.md`
- `FEATURES.md` when functionality changes
- `CHANGELOG.md` for user-visible changes

## Architecture

Code:
- Major structural changes
- Infrastructure changes
- Application design changes

Update:
- `docs/architecture.md`
- `README.md` when setup, architecture, deployment, or major capabilities change
- `CHANGELOG.md` for user-visible changes

## UI / UX Standards

Code:
- `components/**`
- `app/**`

Update:
- `docs/ui-crm-standards.md` when shared UI standards or patterns change
- `FEATURES.md` when functionality changes
- `CHANGELOG.md` for user-visible changes

For a change spanning multiple areas, apply every relevant section. Do not update documentation merely because a file matches a broad UI path; update it when the change affects the documented behavior or standard.