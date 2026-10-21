# Reporting

## Dashboard

The dashboard summarizes Technical Assistance and Other Task records using these periods: Today, Yesterday, This Week, This Month, This Year, All Records and Custom. Custom dates are inclusive. Administrators may filter the dashboard by record owner; ordinary-user dashboard metrics use records owned by that user.

The dashboard presents status counts by record type, totals, assistance counts by category, activity trend buckets, open/close-pending attention records, and recent audit activity. Trend granularity changes with the selected period (day, week or month, with yearly buckets for All Records). Attention lists include non-closed records and are sorted by priority/date in the API.

## Reports

The Reports page has Today, This Week, This Month and Custom date choices, plus filters for activity type (`all`, `assistance`, `tasks`) and status. Administrators can select a report scope (`mine` or `all`) and a user. Regular users are forced to `mine`.

The `mine` scope includes records where the selected participant is the owner, assignee, or author of a work log. For administrators, `all` removes that participation restriction. If an administrator selects a user, that user's participation condition is additionally applied.

Summary metrics include total assistance, tasks, all records, closed, open, pending and closed-per-day average. Each enabled tally groups by record owner and assigned name and reports total, closed, open, pending, average closed per date-range day, and average duration in minutes. Duration averages use closed records for which start and end timestamps are available.

The Reports page displays the selected user's Participated Records count, or the signed-in user's count when no user is selected. Report details, the Excel Summary sheet, email previews and sent reports include Owned Records, Assigned Records and Participated Records for that same user. Participation is the distinct union of records the user owns, is currently assigned to, or has authored at least one work log on. Multiple work logs and overlapping owner/assignee/contributor roles count once per user and record. Deleting a work log removes its author contribution when no other work log by that user remains on the record. These metrics use the report's active date, activity, status and scope filters. They are separate from Total Records, which remains the actual number of records returned.

The report-details response also includes distinct participant names and a chronological timeline summary. It combines available creation, assignment, endorsement, close-pending and closed audit events with typed work logs. If creation or initial-assignment audit history is unavailable, those baseline events use the record's creation data; a current Close Pending or Closed event is added when no matching event exists. For Technical Assistance, the latest Resolution work-log message is returned as the resolution, falling back to the record's legacy resolution field.

## Detailed Excel workbook

Export creates a workbook with Summary, Technical Assistance, Other Tasks and Combined Records sheets. The Summary sheet includes contribution counts for the selected user. Detail sheets include the record fields, owner and assignee, latest work-log summaries by type, and recent work-log entries.

Email previews and sent reports use a compact table with Ref No, Details, Status, Owner and Assigned columns. Technical Assistance details show client, show/group and location, followed by the problem and any latest Resolution and Remark work-log messages. When neither typed message exists, Details shows the newest work-log message as Update when available. Work-log candidates are selected by descending creation timestamp, with ID as a tie-breaker. Other Tasks details show activity type, description and the newest work-log update, or `Not recorded.` when no work log exists. The same Excel workbook is attached to an emailed report; report filters, contribution calculations and workbook calculations are unchanged.

Email delivery is available when the current user's email-report settings are enabled and include a Gmail sender, SMTP password and recipient string. The application uses Gmail SMTP on port 587 with STARTTLS-style transport settings. The UI provides an email preview before sending. Successful delivery is audit logged.

## Audit reporting

The Audit Logs page filters the returned log set by text, action and date range, displays paginated results and exports the filtered result to Excel. The audit API returns at most the latest 200 entries for the list view. Export uses the selected filters and returns an Excel workbook.

For administrator accounts, the audit list/export can include all users' events. For regular accounts, both routes constrain events to the caller's `userId`. See [permissions.md](permissions.md) for dashboard audit scoping behavior.
