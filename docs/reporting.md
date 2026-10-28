# Reporting

## Dashboard

The dashboard summarizes Technical Assistance and Other Task records using these periods: Today, Yesterday, This Week, This Month, This Year, All Records and Custom. Custom dates are inclusive. Administrators may filter the dashboard by record owner; ordinary-user dashboard metrics use records owned by that user.

The dashboard presents status counts by record type, totals, assistance counts by category, activity trend buckets, open/close-pending attention records, and recent audit activity. Trend granularity changes with the selected period (day, week or month, with yearly buckets for All Records). Attention lists include non-closed records and are sorted by priority/date in the API.

## Reports

The Reports page has Today, This Week, This Month and Custom date choices, plus filters for activity type (`all`, `assistance`, `tasks`) and status. Administrators can select a report scope (`mine` or `all`) and a user. Regular users are forced to `mine`.

Technical Assistance and Other Tasks record toolbars also provide `Export mine`. This downloads the existing report Excel workbook with `scope=mine` and an owner-only constraint for the signed-in user. The workbook includes Technical Assistance, Other Tasks and WorkLogs sheets; this owner-only export is narrower than the Reports page's participation-based `mine` scope.

The `mine` scope includes records where the selected participant is the owner, assignee, or author of a work log. For administrators, `all` removes that participation restriction. If an administrator selects a user, that user's participation condition is additionally applied.

Summary metrics include total assistance, tasks, all records, closed, open, pending and closed-per-day average. Each enabled tally groups by record owner and assigned name and reports total, closed, open, pending, average closed per date-range day, and average duration in minutes. Duration averages use closed records for which start and end timestamps are available.

The Reports page displays the selected user's Participation Count, or the signed-in user's count when no user is selected. A Participation Summary table lists users with owned records or qualifying assignments and shows Owned Records and Participation Count for each. Owned Records continues to count records by the existing owner user relation. Participation Count adds one for the Assigned To user only when Assigned To differs from Accountable Person; assignment to the accountable person contributes zero. This rule is identical for Technical Assistance and Other Tasks. Report details, the Excel Summary sheet, email previews and sent reports use the same Participation Count rule, alongside Owned Records and Assigned Records for the selected user. These metrics use the report's active date, activity, status and scope filters. They are separate from Total Records, which remains the actual number of records returned. The `mine` report scope remains based on ownership, current assignment or authorship of a work log; that visibility rule is separate from Participation Count.

The report-details response also includes distinct participant names, a chronological timeline summary and structured report details. Detail presentation is based on Assigned To versus Accountable Person. Owner reports omit Investigation; Technical Assistance shows the compact Client / Show / Location header, Problem, and available Resolution and Remarks. Other Tasks shows Activity Type, Description and available Remarks, with no Investigation or Resolution. Delegated details show Investigation, Resolution and Remarks only when each has a value, alongside the record's primary problem or activity fields. Technical Assistance Resolution and Remarks use the latest typed work-log values when available and otherwise fall back to their legacy record fields. Empty sections are omitted. Legacy Location and Show / Group values on Other Tasks remain omitted.

The Reports page includes these details per record and expands the delegated record details for each Participation Summary user. Participation Count remains one per qualifying assignment where Assigned To differs from Accountable Person; the detail list explains that work without changing counts, filters, sorting, or report scope. The email preview and sent email use the same detail rules. Excel detail sheets include a formatted Details column using the same rules; the WorkLogs sheet follows the same owner/delegated visibility rules for typed history.

## Detailed Excel workbook

Export creates a workbook with Summary, Technical Assistance, Other Tasks, WorkLogs and Combined Records sheets. The Summary sheet includes contribution counts for the selected user. The Technical Assistance Details cell contains the compact Client / Show / Location header and rule-based sections; the Other Tasks Details cell contains its activity type, description and rule-based work sections. Detail sheets retain record metadata, owner and assignee. The WorkLogs sheet lists visible typed entries with their parent reference, record type, timestamp and author; it omits Investigation for owner reports and omits both Investigation and Resolution for owner Other Tasks.

Email previews and sent reports use a compact table with Ref No, Details, Status, Owner and Assigned columns. Details follow the owner/delegated rules above, and blank sections are not rendered. The same Excel workbook is attached to an emailed report; contribution summaries use the Participation Count rule above.

Email delivery is available when the current user's email-report settings are enabled and include a Gmail sender, SMTP password and recipient string. The application uses Gmail SMTP on port 587 with STARTTLS-style transport settings. The UI provides an email preview before sending. Successful delivery is audit logged.

## Audit reporting

The Audit Logs page filters the returned log set by text, action and date range, displays paginated results and exports the filtered result to Excel. The audit API returns at most the latest 200 entries for the list view. Export uses the selected filters and returns an Excel workbook.

For administrator accounts, the audit list/export can include all users' events. For regular accounts, both routes constrain events to the caller's `userId`. See [permissions.md](permissions.md) for dashboard audit scoping behavior.
