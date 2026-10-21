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
# OpsTracker Features

This inventory describes behavior implemented in the current application. For technical detail, see the linked guides in [README.md](README.md).

## Record types

The application stores two kinds of records in separate tables:

- **Technical Assistance:** client name, problem, category, optional resolution.
- **Other Task:** activity type and description.
- Both include start date, optional end date, shift, location, optional show/group, priority, start/end time, status, assigned person, accountable person, optional remarks, owner and lock metadata.

Reference numbers are generated as `TA-YYYY-NNNNN` or `OT-YYYY-NNNNN`. A per-type, per-year counter is incremented in the create transaction.

## Record operations

- Lists support text search, status/location/shift/date filters, sorting and pagination.
- Open records show the start time and a live elapsed-time counter in the list, and Started plus a live elapsed-time counter on the detail page, refreshed every second. Closed records retain their final calculated duration; reports and exports are unchanged.
- Technical Assistance list content shows the client and problem; Other Tasks shows the description. Both prefer the latest Resolution and Remark work logs, falling back independently to legacy Resolution and Remarks fields. If neither is available, the latest work log appears as Update; records without any of these values show “Update: No updates yet.” Status badges use red for Open, orange for Close Pending and green for Closed. Show/group and location remain in their separate columns.
- Detail pages show record fields and one chronological Record Timeline combining reported, assigned, endorsed, status-transition and typed work-log events.
- Batch operations can update shared fields, delete records, or lock/unlock them. Unauthorized records in a batch are skipped and counted.
- The Record Timeline displays lifecycle events and work logs in oldest-first timestamp order, with one continuous accent-colored rail that ends at the first and last centered nodes. As the rail reaches each node, its glow and the corresponding theme-aware panel card fade/slide-in start together; arrival timing is derived from distance along the rail. Only the newest node retains a subtle static glow after the sequence. Cards have a clear gutter from the rail, with no horizontal connectors, and small type badges. Work-log entries show their author, date/time and message. Users with record edit permission can add entries. Administrators and record owners can edit or delete any entry; authors can edit or delete their own entries. Edits change only the message and display the modification date/time, including for older entries without an `updatedAt` value.
- Dashboard summaries include assistance/task status counts, date-based activity trends, assistance category counts, attention records and recent audit activity.

## Status and time rules

- Status values are Open, Close Pending and Closed; priorities are Low, Normal, High and Critical.
- Single-record status changes allow Open to Close Pending, Close Pending to Closed or Open, and Closed to Open. Batch status edits use a separate path and do not enforce those transitions.
- For form and single-record saves, Close Pending fills a missing end date/time with the current server date/time. Validation requires an end date/time for Close Pending and Closed records; batch status updates do not run the full record schema validation.
- Reopening a record clears its end date and end time.
- Duration calculations use the start and end dates/times. Records without an end date/time have no completed duration.
- The list displays the start time beside second-resolution elapsed time for open records. The detail view displays Started and Elapsed Time for open records without an “ongoing” end-time label. Closed-record duration formatting and report/export calculations are unchanged.

## Reporting and audit

- Dashboard periods: today, yesterday, this week, this month, this year, all records, and custom dates. Administrators can filter the dashboard by record owner.
- Reports filter by date period, activity type, status, report scope and (for administrators) user. Tallies are grouped by record owner and assignee and include total, closed, open, pending, closed-per-day average and average handling minutes.
- The Reports page displays a participated-record count for the selected user, or the signed-in user when no user is selected. Report details, Excel summaries and email previews/sent reports include owned, currently assigned and participated record counts for that user. Participation includes ownership, current assignment or at least one authored work log; each record is counted once per user.
- Report details include a chronological timeline of available creation, assignment, endorsement, close-pending, closed and typed work-log events, plus distinct participant names. Technical Assistance details use the latest Resolution work log as the resolution, falling back to the legacy resolution field.
- Report scope continues to include owners, current assignees and work-log contributors in My Records. Total Records remains the number of records in the report and is not increased by multiple contributors or work logs.
- Reports export to a multi-sheet Excel workbook. Email previews and sent reports use compact Ref No, Details, Status, Owner and Assigned tables. Technical Assistance Details show client, show/group and location, the problem, and any latest Resolution and Remark work-log messages. When neither typed message exists, Details shows the newest work-log message as Update when available. Other Tasks use the newest work-log update, or show Not recorded when no work log exists. The emailed report includes the Excel attachment; the workbook's existing detail and summary calculations are unchanged.
- Audit logs capture supported authentication, record, import, user, master-data, backup/restore and email-report actions. The audit page supports search, action/date filters and Excel export.

## Users and administration

- Roles are `ADMIN` and `USER`. Administrators manage accounts; users can update their own profile and password.
- Profiles include names, email, username, role, avatar, and optional Gmail report settings.
- Administrators manage locations, shifts, show/groups, assistance categories, activity types, branding, AI/MACO settings, imports and JSON backups/restores.
- Master-data values are retired (marked inactive), not deleted; new records use active values.
- Avatars, logos and favicons are stored as files under `public/uploads`, not in the JSON backup.

## Import

- Accepted files: `.xlsx`, `.xlsm`, and `.csv`, up to 10 MB.
- Single-type imports accept a selected sheet; the two-type mode requires an Excel workbook with `Technical Assistance` and `Other Tasks` sheets.
- The preview reports detected and valid rows, validation errors, unrecognized columns and a small sample. Invalid rows are skipped when importing valid rows.
- Self-service imports set both assigned and accountable to the importer. Admin imports may use those columns from the file. Imported records are owned by the importer in either mode.
- The importer generates new reference numbers; imported reference-number values are not used.

## AI

- Text improvement sends a supplied text string to an Ollama-compatible `/api/generate` endpoint and returns a suggested edit.
- MACO accepts conversational questions, builds live context from OpsTracker records and selected system data, then asks the configured model for a response. Responses can include source categories and record references.

## UI and themes

- The interface includes dashboard, assistance, tasks, MACO, reports, users, administration, audit logs and account settings.
- Theme selection supports light, dark and system preference; the selected setting is stored in the browser.
- Branding values update the sign-in page, sidebar and browser title/icon.
**Three separate tallies**, each with per-user rows and an all-users total:
