# Operational Workflow

## Create and track records

Users create Technical Assistance records at `/assistance` or Other Task records at `/tasks`. Required fields include the activity date, shift, location, the type-specific subject/details, start time, assignee and accountable person. Show/group and remarks are optional. The server validates record data and creates an owner link to the signed-in account.

The Technical Assistance and Other Tasks list content columns show their respective client/problem or description, followed by the latest Resolution and Remark work logs. Each summary falls back to the corresponding legacy Resolution or Remarks field when no typed log exists. If neither Resolution nor Remark is available, the latest work log is shown as Update; with no available information, the list shows “Update: No updates yet.” Show/group and location remain in their separate table columns.

Open records show their start time beside a live elapsed-time counter in the list, and Started beside Elapsed Time on the detail page, refreshed every second. Closed records continue to show their final calculated duration; reports and exports are unaffected.

The server allocates references such as `TA-2026-00001` and `OT-2026-00001` using a transactionally updated counter. The reference year comes from the server's current year.

## Status lifecycle

Allowed transitions for the single-record update endpoint:

```text
OPEN -> CLOSE_PENDING -> CLOSED
			|               |
			+----> OPEN <----+
```

For form and single-record saves, Close Pending and Closed records require an end date and end time. When a record enters Close Pending without one or both values, the server fills the missing value(s) from its current clock. A transition back to Open clears both end values. A direct transition from Open to Closed is rejected by the single-record endpoint; the record must first enter Close Pending. Batch status edits use a separate update path and do not enforce the same transition or full-record validation rules.

The detail view presents a single Record Timeline combining Reported, Assigned, Endorsed, status-transition and work-log events in timestamp order. One continuous accent-colored rail is drawn from the first centered event node to the last without extending below it. Each node briefly glows as the rail reaches it, and its theme-aware panel card begins fading/sliding into view at that same arrival time, paced by distance along the rail; after the sequence, only the newest node retains a subtle static glow. Reduced-motion preferences disable the animation. Cards have a clear gutter from the rail and no horizontal connectors. Small Investigation, Resolution, Remark or System Event badges identify each event; the entry form appears above the timeline. Users with record edit permission can add an Investigation, Resolution or Remark entry. Administrators and record owners can edit or delete any work log; authors can edit or delete their own work logs. These permissions are independent of the record lock. Editing is limited to the message; type, author and creation timestamp remain unchanged, and edited entries show their modification date/time. A record with work-log history cannot be deleted through the single-record delete endpoint.

## Ownership, assignment and locking

The account that creates or imports a record is its owner; `assigned` and `accountable` are stored as names. Administrators may lock/unlock records. Locking prevents non-admin edits. Batch actions can act on multiple selected records and report records skipped for permission reasons.

## Import workflow

1. Choose a CSV or Excel file (maximum 10 MB); choose the record type or workbook mode.
2. The server maps known header aliases, normalizes dates, times, status and priority, then validates rows.
3. Review valid row count, validation errors, ignored columns and a sample. For multi-sheet workbooks, choose a sheet and preview it again.
4. Confirm import. Valid rows are inserted with newly generated references and the importing account as owner. Invalid rows are skipped and returned in the result.

Self-service imports set Assigned and Accountable to the importer even if the file contains those columns. Admin imports may read these columns; blank/missing values fall back to the importer. Importing both types requires an Excel workbook with sheets named exactly `Technical Assistance` and `Other Tasks`.

Supported single-type file extensions are `.xlsx`, `.xlsm`, and `.csv`. The importer does not accept online file links. CSV parsing supports quoted commas/newlines. Excel workbook parsing uses the selected sheet; the dedicated two-type mode selects the two named sheets.

## Reporting and email

Reports can be filtered by preset/custom date range, record type, status and scope. Administrators can choose all records or their participation and optionally select a user; non-admin users are limited to their participation scope. Export creates an Excel workbook. Email preview renders the report using the configured Gmail sender/recipients; sending attaches the workbook.

## Backup and restore

Administrators can download a versioned JSON backup. Restore supports Merge and Replace and provides a count preview before applying the operation. Merge skips existing users/records/master-data/audit rows according to their identifiers and updates branding; Replace clears database tables before restoring. Restore also resets PostgreSQL ID sequences and applies reference counters from the file. Uploaded files are not in the JSON backup; work logs are also not currently included.
