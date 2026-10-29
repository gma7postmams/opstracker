# System Map

Code ownership and navigation map for OpsTracker. Start with the feature area below, open its mapped files, and expand the search only when the implementation crosses an ownership boundary. Database names are the PostgreSQL table names mapped in `prisma/schema.prisma`.

## Authentication & Login

Purpose: Credential sign-in, NextAuth sessions, and Email Two-Factor Authentication.

UI Files:
- `app/login/page.tsx`
- `app/(app)/profile/page.tsx`
- `components/ProfileForm.tsx`

API Files:
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/2fa/request/route.ts`
- `app/api/profile/route.ts`
- `app/api/profile/2fa/route.ts`

Business Logic:
- `lib/auth.ts`
- `lib/email2fa.ts`
- `lib/audit.ts` for authentication-related audit events

Database Tables:
- `users`
- `EmailVerificationCode`
- `audit_logs`

Configuration Files:
- `lib/auth.ts` contains the NextAuth options.

Documentation Files:
- `docs/authentication.md`
- `docs/workflow.md`
- `docs/permissions.md`

## Dashboard

Purpose: Authenticated landing page with operational counts and activity summaries.

UI Files:
- `app/(app)/dashboard/page.tsx`

API Files:
- `app/api/dashboard/route.ts`
- `app/api/records/events/route.ts` for authenticated realtime invalidations

Business Logic:
- `lib/period.ts` for shared reporting-period boundaries
- `lib/recordEvents.ts` for the process-wide PostgreSQL notification listener

Database Tables:
- `assistance`
- `tasks`
- `audit_logs`
- `work_logs`

Configuration Files:
- No dashboard-specific configuration file.

Documentation Files:
- `docs/architecture.md`
- `docs/workflow.md`
- `FEATURES.md`

## Technical Assistance

Purpose: Create, assign, track, and update Technical Assistance records.

UI Files:
- `app/(app)/assistance/page.tsx`
- `app/(app)/records/[type]/[id]/page.tsx` for shared record details
- `components/RecordsView.tsx`
- `components/RecordForm.tsx`
- `components/WorkLogTimeline.tsx`

API Files:
- `app/api/records/[type]/route.ts`
- `app/api/records/events/route.ts` for authenticated realtime invalidations
- `app/api/records/[type]/[id]/route.ts`
- `app/api/records/[type]/batch/route.ts`
- `app/api/records/[type]/[id]/work-logs/route.ts`

Business Logic:
- `lib/records.ts`
- `lib/recordTypes.ts`
- `lib/validation.ts`
- `lib/permissions.ts`
- `lib/audit.ts`

Database Tables:
- `assistance`
- `work_logs`
- `users`
- `counters`
- `audit_logs`

Configuration Files:
- No Technical Assistance-specific configuration file.

Documentation Files:
- `docs/workflow.md`
- `docs/database.md`
- `FEATURES.md`

## Other Tasks

Purpose: Create, assign, track, and update Other Task records.

UI Files:
- `app/(app)/tasks/page.tsx`
- `app/(app)/records/[type]/[id]/page.tsx` for shared record details
- `components/RecordsView.tsx`
- `components/RecordForm.tsx`
- `components/WorkLogTimeline.tsx`

API Files:
- `app/api/records/[type]/route.ts`
- `app/api/records/events/route.ts` for authenticated realtime invalidations
- `app/api/records/[type]/[id]/route.ts`
- `app/api/records/[type]/batch/route.ts`
- `app/api/records/[type]/[id]/work-logs/route.ts`

Business Logic:
- `lib/records.ts`
- `lib/recordTypes.ts`
- `lib/validation.ts`
- `lib/permissions.ts`
- `lib/audit.ts`

Database Tables:
- `tasks`
- `work_logs`
- `users`
- `counters`
- `audit_logs`

Configuration Files:
- No Other Tasks-specific configuration file.

Documentation Files:
- `docs/workflow.md`
- `docs/database.md`
- `FEATURES.md`

## Reports

Purpose: Filter operational records and produce report details, Excel exports, and email reports.

UI Files:
- `app/(app)/reports/page.tsx`

API Files:
- `app/api/reports/route.ts`
- `app/api/reports/details/route.ts`
- `app/api/reports/excel/route.ts`
- `app/api/reports/email/route.ts`

Business Logic:
- `lib/reports.ts`
- `lib/reportExcel.ts`
- `lib/period.ts`
- `lib/audit.ts`

Database Tables:
- `assistance`
- `tasks`
- `work_logs`
- `users`
- `audit_logs`

Configuration Files:
- Report sender and recipient settings are stored on `users` and managed from Account Settings; there is no separate report configuration file.

Documentation Files:
- `docs/reporting.md`
- `docs/workflow.md`

## Users & Permissions

Purpose: Manage user accounts and apply role- and ownership-based access rules.

UI Files:
- `app/(app)/users/page.tsx`
- `app/(app)/profile/page.tsx`
- `components/ProfileForm.tsx`

API Files:
- `app/api/users/route.ts`
- `app/api/users/[id]/route.ts`
- `app/api/users/[id]/2fa/route.ts`
- `app/api/users/me/route.ts`
- `app/api/users/filter/route.ts`
- `app/api/users/report-filter/route.ts`
- `app/api/profile/route.ts`

Business Logic:
- `lib/permissions.ts`
- `lib/validation.ts`
- `lib/auth.ts`
- `lib/audit.ts`

Database Tables:
- `users`
- `EmailVerificationCode`
- `audit_logs`

Configuration Files:
- No separate user-management configuration file; roles are defined in `prisma/schema.prisma`.

Documentation Files:
- `docs/permissions.md`
- `docs/authentication.md`
- `docs/workflow.md`

## Audit Logs

Purpose: Review and export recorded system activity.

UI Files:
- `app/(app)/audit/page.tsx`

API Files:
- `app/api/audit/route.ts`
- `app/api/audit/export/route.ts`
- `app/api/audit/logout/route.ts`

Business Logic:
- `lib/audit.ts`
- `lib/period.ts`

Database Tables:
- `audit_logs`
- `users`

Configuration Files:
- No audit-specific configuration file.

Documentation Files:
- `docs/workflow.md`
- `docs/architecture.md`

## Administration

Purpose: Configure master data, import records, and back up or restore application data.

UI Files:
- `app/(app)/admin/page.tsx`
- `components/AdminImportPanel.tsx`
- `components/BackupPanel.tsx`
- `components/ImportDialog.tsx`

API Files:
- `app/api/masterdata/route.ts`
- `app/api/masterdata/[id]/route.ts`
- `app/api/import/route.ts`
- `app/api/backup/route.ts`

Business Logic:
- `lib/validation.ts`
- `lib/csv.ts`
- `lib/xlsx.ts`
- `lib/records.ts`

Database Tables:
- `master_data`
- `counters`
- `users`
- `assistance`
- `tasks`
- `work_logs`
- `audit_logs`
- `branding`

Configuration Files:
- `prisma/schema.prisma`

Documentation Files:
- `docs/workflow.md`
- `docs/architecture.md`
- `docs/database.md`

## Branding

Purpose: Load and update the application title, tagline, logo, and favicon.

UI Files:
- `app/(app)/admin/page.tsx`
- `components/ImageUpload.tsx`
- `components/Shell.tsx`

API Files:
- `app/api/branding/route.ts`
- `app/api/upload/route.ts`
- `app/uploads/[filename]/route.ts`

Business Logic:
- `lib/branding.ts`
- `lib/validation.ts`

Database Tables:
- `branding`

Configuration Files:
- No separate branding configuration file; branding values are database-backed.

Documentation Files:
- `docs/architecture.md`
- `docs/database.md`