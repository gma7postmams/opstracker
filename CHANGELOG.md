## 2026-10-21

- Refined the Record Timeline animation so each card fade/slide-in begins at the same distance-based arrival time as its node glow. The continuous rail, reduced-motion behavior, event order, work-log functionality and permissions are unchanged.
- Fixed list summaries to fall back from typed Resolution and Remark work logs to legacy fields before showing Update.
- Added second-by-second elapsed-time counters for open records in list and detail views. The list retains the start time, while detail pages show Started and Elapsed Time instead of ongoing end-time/duration labels; closed-record duration and report/export calculations are unchanged.
- Changed record-list status badges to red for Open, orange for Close Pending and green for Closed, and added an “Update: No updates yet” fallback when a record has no work logs.
- Updated Technical Assistance and Other Tasks list content to use latest Resolution and Remark work logs, with latest-work-log Update fallback and no duplicate Show/group or Location text.
- Fixed Work Log edits for older entries with no `updatedAt`, falling back to `createdAt` or the current time.
- Refined Technical Assistance email Details to show client/show/location, the problem, and separate latest Resolution and Remark work logs, with a latest-work-log Update fallback only when neither typed log exists.
- Fixed Technical Assistance email Latest Update selection to fall back from the newest Resolution and Remark work logs to the newest work log of any type before legacy fields.
- Refined report email details into compact five-column tables with concise issue descriptions and latest updates; report filters and workbook calculations remain unchanged.
- Added participant names and chronological lifecycle/work-log summaries to report details, with Technical Assistance resolution fallback to the legacy field when no Resolution work log exists.
- Refined the Record Timeline spacing and neutral card styling, and added message-only work-log editing for administrators, record owners and entry authors with an edited timestamp.
- Enhanced the Record Timeline with type-specific entry guidance, entry animations, and confirmed work-log deletion for administrators, record owners and entry authors.
- Replaced separate Activity History and Work Log views with one chronological Record Timeline combining lifecycle events and typed work logs. Events use the existing accent and theme-aware panel surfaces, with the work-log form above the timeline.
- Added a participated-record KPI to the Reports page and contribution counts to report details, Excel summaries, email previews and sent reports. The counts cover owned, assigned and distinct participated records for the selected user, or the signed-in user when no user is selected.
- Kept Total Records tied to the actual number of records in the report; no database schema change was required.

## 2026-10-20

- Added typed, append-only work logs to record detail, and included work-log summaries in report details and report workbooks/emails.
- Added owner/assignee contributor reporting and reporting scope/user filters.
- Added separate start and end dates for record lifecycle tracking and refined status transitions.
- Improved MACO's record investigation and operational analytics, including related-record matching and source references.

## 2026-10-16

- Enhanced MACO, dashboard analytics, navigation and account settings.

## 2026-10-15

- Added MACO investigation, analytics and activity intelligence improvements.
- Improved audit-log detail presentation and user/admin interfaces.
- Refined theme behavior and dashboard activity trends.

## 2026-10-14

- Added report period presets, email previews and report-summary improvements.
- Improved record, report and audit interfaces, including Excel audit export.

This file records the dated changes visible in repository history. No semantic-versioned release tags are defined in the repository.
