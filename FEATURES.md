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

Technical Assistance also includes Location and optional Show / Group from master data. Existing Other Task Location and Show / Group database values are retained but are not used in current task workflows.
# OpsTracker Features

This inventory describes behavior implemented in the current application. For technical detail, see the linked guides in [README.md](README.md).

## Record types

The application stores two kinds of records in separate tables:

- **Technical Assistance:** client name, problem, category, optional resolution.
- **Other Task:** activity type and description.
- Both include start date, optional end date, shift, priority, start/end time, status, assigned person, accountable person, optional remarks, owner and lock metadata. Technical Assistance also includes Location and optional Show / Group. Other Tasks retain legacy database values for Location and Show / Group, but current task workflows omit both fields.

Reference numbers are generated as `TA-YYYY-NNNNN` or `OT-YYYY-NNNNN`. A per-type, per-year counter is incremented in the create transaction.

## Record operations

- Technical Assistance forms use searchable comboboxes for Location, Shift, Show / Group and Category. Other Task forms use Shift and Activity Type; Location and Show / Group are omitted from task forms, lists, details, reports, and task APIs. Existing task Location and Show / Group values remain stored but are ignored by task validation and saves. Authenticated users can add values with each field's adjacent plus control; new active master-data values are audited, immediately added to the list and selected. Show / Group is optional for Technical Assistance.
- Lists support text search, status and shift filters; Technical Assistance also supports a location filter. Both provide the Today, Yesterday, This Week, This Month, This Year, All Records and Custom period filter, plus sorting and pagination. From and To date inputs appear only for Custom. The user filter defaults to the signed-in user, with All Users available as a manual selection. The Assigned To column is followed by Accountable Person, which displays the record owner's full name.
- Open records show the start time and a live elapsed-time counter in the list, and Started plus a live elapsed-time counter on the detail page, refreshed every second. Closed records retain their final calculated duration; duration calculations in reports and exports are unchanged.
- Locked records show a Locked indicator in Technical Assistance and Other Tasks lists, Dashboard Needs Attention, and the record detail header beside the status badge. Lock and unlock controls and behavior are unchanged.
- Technical Assistance list content shows the client and problem; Other Tasks shows the description. Both prefer the latest Resolution and Remark work logs, falling back independently to legacy Resolution and Remarks fields. If neither is available, the latest work log appears as Update; records without any of these values show “Update: No updates yet.” Status badges use red for Open, orange for Close Pending and green for Closed. Location and Show / Group appear only in Technical Assistance lists.
- Detail pages show record fields and one chronological Record Timeline combining reported, assigned, endorsed, status-transition and typed work-log events.
- Batch operations can update applicable record fields, delete records, or lock/unlock them. Unauthorized records in a batch are skipped and counted.
- The Record Timeline displays lifecycle events and work logs in oldest-first timestamp order, with one continuous accent-colored rail that ends at the first and last centered nodes. As the rail reaches each node, its glow and the corresponding theme-aware panel card fade/slide-in start together; arrival timing is derived from distance along the rail. Only the newest node retains a subtle static glow after the sequence. Cards have a clear gutter from the rail, with no horizontal connectors, and small type badges. Work-log entries show their author, date/time and message. Users with record edit permission can add entries. Administrators and record owners can edit or delete any entry; authors can edit or delete their own entries. Edits change only the message and display the modification date/time, including for older entries without an `updatedAt` value.
- Dashboard summaries include period-filtered assistance/task status counts, date-based activity trends, assistance category counts and recent audit activity. Activity Summary cards use two columns on mobile, with labels wrapping only between words; desktop layout and card styling are unchanged. Needs Attention is an all-date queue of Open and Close Pending records, ordered oldest first and labeled with age. Technical Assistance titles include the program and location after the requestor; Other Task titles are unchanged. Each row shows the ownership chain from assignment audit history using usernames, with prior owners muted and the current assignee emphasized.

## Status and time rules

- Status values are Open, Close Pending and Closed; priorities are Low, Normal, High and Critical.
- Single-record status changes allow Open to Close Pending, Close Pending to Closed or Open, and Closed to Open. Batch status edits use a separate path and do not enforce those transitions.
- For form and single-record saves, Close Pending fills a missing end date/time with the current server date/time. Validation requires an end date/time for Close Pending and Closed records; batch status updates do not run the full record schema validation.
- Reopening a record clears its end date and end time.
- Duration calculations use the start and end dates/times. Records without an end date/time have no completed duration.
- The list displays the start time beside second-resolution elapsed time for open records. The detail view displays Started and Elapsed Time for open records without an “ongoing” end-time label. Closed-record duration formatting and report/export calculations are unchanged.

## Reporting and audit

- Dashboard and record-list periods share Today, Yesterday, This Week, This Month, This Year, All Records and Custom options and the same UTC date boundaries. Administrators can filter the dashboard by record owner.
- Reports filter by date period, activity type, status, report scope and (for administrators) user. Tallies are grouped by record owner and assignee and include total, closed, open, pending, closed-per-day average and average handling minutes.
- The Reports page displays a participated-record count for the selected user, or the signed-in user when no user is selected. Report details, Excel summaries and email previews/sent reports include owned, currently assigned and participated record counts for that user. Participation includes ownership, current assignment or at least one authored work log; each record is counted once per user.
- Report details include a chronological timeline of available creation, assignment, endorsement, close-pending, closed and typed work-log events, plus distinct participant names. Technical Assistance details use the latest Resolution work log as the resolution, falling back to the legacy resolution field.
- Report scope continues to include owners, current assignees and work-log contributors in My Records. Total Records remains the number of records in the report and is not increased by multiple contributors or work logs.
- Reports export to a multi-sheet Excel workbook, including Technical Assistance, Other Tasks and WorkLogs worksheets. The Technical Assistance worksheet includes Location and Show / Group; the Other Tasks worksheet omits both fields. WorkLogs lists all entries for exported records with parent reference, record type, creation date and author, and typed Investigation, Resolution or Remark content. Report calculations are unchanged. Email previews and sent reports use compact Ref No, Details, Status, Owner and Assigned tables. Technical Assistance Details show client, show/group and location, the problem, and any latest Resolution and Remark work-log messages. When neither typed message exists, Details shows the newest work-log message as Update when available. Other Tasks use the newest work-log update, or show Not recorded when no work log exists. The emailed report includes the Excel attachment.
- The Technical Assistance and Other Tasks record toolbars provide Export mine beside Import mine. It downloads the existing report workbook for records owned by the signed-in user, including their WorkLogs, without changing the Reports page's broader participation-based My Records scope.
- Audit logs capture supported authentication, record, import, user, master-data, backup/restore and email-report changes. Record update, status, endorsement, lock and unlock events store actual transitions as structured `changes` entries with `field`, `oldValue` and `newValue`; delete details retain Reference No, subject, description, Assigned To and Record Type. Record audit payloads omit passwords, SMTP passwords, tokens and 2FA secrets. The audit page initially displays All Records and supports combined search, category and action filters plus shared period filters; preset or custom date ranges filter the audit-log query. User creation, deletion, deactivation and role changes have dedicated events with actor, target user and relevant role/status transitions; audit details exclude passwords, SMTP passwords, 2FA secrets and tokens. Action choices follow the selected category: Authentication has login/logout and 2FA actions; User Management has profile/user updates and account lifecycle actions; Administration has master-data actions; Reports has report-email actions; Technical Assistance and Other Tasks each have record create/update/delete/import/lock/unlock actions; System has combined imports. Changing Category resets Action to All Actions. Excel export accepts search, category, action and custom From/To dates; preset periods are not passed to the export.
- Audit detail dialogs display Reference No for record create, update, status, endorsement, lock, unlock and delete events. Available Technical Assistance Client, Show / Group and Location values and Other Tasks Activity Type values appear in the activity summary. Lock diffs use the Lock Status label; the diff table structure and array-valued change rendering are unchanged. Audit storage and APIs remain unchanged.

## Users and administration

- Roles are `ADMIN` and `USER`. Administrators manage accounts; users can update their own profile and password.
- Profiles include names, email, username, role, avatar, optional Gmail report settings, and optional Email Two-Factor Authentication. Enabling 2FA requires a six-digit email code; codes expire after 10 minutes and are single-use. Code issuance is limited to five per user in a rolling 15-minute window. The initial login challenge bypasses the 60-second resend cooldown; explicit resends are subject to the cooldown, and the login page displays the remaining time and any server-provided retry delay.
- Users can disable Email 2FA on their own account. Administrators can disable it for another account as a recovery action. Enable/disable, code delivery, successful verification and failed verification are audit logged.
- Administrators manage all master-data kinds, branding, imports and JSON backups/restores. Authenticated users can add values for all five master-data kinds from the applicable record-form fields; only administrators can retire master-data values.
- Master-data values are retired (marked inactive), not deleted; new records use active values.
- Avatars, logos and favicons are stored as uniquely named files under `public/uploads` and served at `/uploads/<filename>`, including files created at runtime; they are not in the JSON backup.

## Import

- Accepted files: `.xlsx`, `.xlsm`, and `.csv`, up to 10 MB.
- The import scope defaults to both worksheets and can be set to `Technical Assistance Only`, `Other Tasks Only` or `Both Worksheets` on any page. Excel imports process the selected canonical worksheets; additional worksheets, including `WorkLogs`, are ignored and listed. CSV imports remain single-record-type imports.
- The preview reports detected, valid, invalid and warning counts per worksheet, along with validation errors and warnings labeled by worksheet, ignored worksheets, unrecognized columns and a small sample. The completed import reports the imported count per worksheet. Invalid rows are skipped when importing valid rows.
- The preview displays the same start date that will be imported. Excel date and time serials are normalized before validation. `CLOSED` rows require `End Date` and `Time Ended`; missing end fields on `CLOSE_PENDING` rows are filled with the current date and time. The downloadable workbook template includes `End Date` on both record worksheets.
- `Assigned To` is optional and matched to a user by full name. A unique match is assigned; no match or multiple matches leave the record unassigned and produce a warning. Imported records are owned by the importing user. Imported `Accountable Person` values are ignored and accountability is set to the importer.
- The importer generates new reference numbers; imported reference-number values are not used.

## UI and themes

- The interface includes dashboard, assistance, tasks, reports, users, administration, audit logs and account settings.
- Sign-in greets users on the Credentials screen and, after the existing credential progress animation, exchanges the hero and authentication panels over 550 ms with ease-in-out timing when 2FA is required. Desktop Verification controls appear on the left while the first-word greeting and email-code instructions appear on the right; the greeting uses the entered value because profile data is not loaded on the unauthenticated login page. Mobile keeps verification first. The first code field receives focus after the transition. Six-digit OTP entry submits automatically, invalid codes are reported, and resend controls show the remaining cooldown. Credential and verification progress is staged; successful sign-in displays a checklist before redirecting to the dashboard. The transition respects reduced-motion preferences.
- Account settings show profile details, last login and 2FA state, support self-service 2FA setup/disable, collapse Email Reports settings by default, and show save progress and confirmation. Verification emails include a responsive branded HTML message with the code, expiry and security notice, plus a plaintext fallback.
- Theme selection supports light, dark and system preference; the selected setting is stored in the browser.
- Branding values update the sign-in page, sidebar and browser title/icon.
**Three separate tallies**, each with per-user rows and an all-users total:
