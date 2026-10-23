## 2026-10-23
- Changed Dashboard Activity Summary cards to a two-column mobile layout and kept labels intact at word boundaries; desktop layout and card styling are unchanged.
- Made the Dashboard Activity Trend fit mobile containers without horizontal scrolling while preserving desktop chart sizing and interactions.
- Added lock-status badges to Dashboard Needs Attention and record detail headers; lock and unlock behavior is unchanged.
- Added Reference No and available record summary fields to record Audit Details summaries, with a Lock Status diff label; audit storage, APIs and diff table rendering are unchanged.
- Standardized record update, status, endorsement, lock and unlock audit payloads as structured field diffs, retained record summary details for deletes, and excluded sensitive fields from record audit diffs.
- Upgraded AI/MACO setting and user lifecycle audit events to structured previous/updated diffs shown in the Audit Details table; URL credentials are redacted and user audit details continue to exclude passwords, SMTP passwords, 2FA secrets and tokens.
- Improved Audit Logs readability with friendly labels for changed fields and human-readable lists for array-valued changes; the details section is labeled Changes. Audit data and APIs are unchanged.
- Added dedicated audit events for user creation, deletion, deactivation and role changes, recording actor, target and relevant role/status transitions without secrets.
- Enforced authenticated administrator access for AI/MACO settings reads, writes and connection/model tests, and added audit events for enabled-state, model, URL and other settings changes without recording setting values or credentials.
- Refined Dashboard Needs Attention titles for Technical Assistance to include the program and location after the requestor; Other Task titles, descriptions, ownership flows and queue behavior are unchanged.
- Added assignment ownership flows to Dashboard Needs Attention, showing prior assignees and emphasizing the current assignee.
- Placed ownership flows beneath each Needs Attention description with italic styling and a dash prefix; ownership history and current-owner emphasis are unchanged.
- Ownership flow labels use usernames to keep the Needs Attention chain compact; ownership history and current-owner emphasis are unchanged.
- Updated Dashboard Needs Attention to show Open and Close Pending records across all dates, ordered oldest first with an age label. Dashboard period filtering for metrics, categories and activity trends is unchanged.

## 2026-10-22
- Refined Audit Logs filters so Action choices are limited to the selected Category and changing Category resets Action to All Actions. Search, period filtering, pagination, export and the Audit API are unchanged.
- Added an Audit Logs Category filter beside Action for Authentication, User Management, Administration, Reports, Technical Assistance, Other Tasks and System events. Category combines with search/action filtering and is also applied to Excel exports; period filtering and pagination remain unchanged.
- Reordered Audit Logs into a timeline-first table with Date & Time, combined Activity context, User and Details columns. Actor names use the account full name when available, then username, with “Unknown User” as the final fallback; audit filtering, pagination, data and export remain unchanged.
- Refined Audit Log details with the event as the dialog title and a color-coded outcome badge. Activity Summary presents Event, Category, User, and Date & Time; empty Changes and Additional Details sections are omitted. Audit data and controls are unchanged.
- Modernized the Audit Logs table with clearer actor and action hierarchy, human-friendly action labels, theme-aware outcome badges and row states, a quieter details action, and improved date and empty-state presentation. Existing audit data, filtering and pagination are unchanged.
- Defaulted the Audit Logs period filter to All Records so the page initially displays all audit entries; the existing period options and filtering remain available.
- Made the saved AI and MACO enabled settings control feature availability: disabled AI hides record-writing assistance and returns service unavailable from its endpoint; disabled MACO is removed from the sidebar, shows an administrator-disabled message on its page, and rejects chat requests. Saving the settings refreshes sidebar visibility immediately.
- Added optional Email Two-Factor Authentication with password-first login verification, six-digit single-use codes that expire after 10 minutes, per-user email delivery limits, profile setup, administrator recovery, and audit events.
- Updated sign-in and account settings with a Credentials/Verification flow, automatic OTP submission, resend countdowns, staged progress and a success checklist. Account settings show profile and security status, keep Email Reports collapsed by default, and provide save feedback. Verification emails include responsive branded HTML and a plaintext fallback.
- Fixed duplicate login challenge submissions and resend handling: initial credential challenges bypass the resend cooldown, while explicit resends observe it. Added correlated browser/server request logging.
- Aligned Technical Assistance, Other Tasks and Audit Logs period filters with the Dashboard's shared seven periods and UTC date boundaries. Custom date inputs are visible only for Custom, and audit periods are applied in the database query.

## 2026-10-21

- Fixed import previews to show the imported start date, normalized Excel date/time serials before validation, and added End Date to both worksheets in the downloadable template so closed records can pass validation.
- Added an import scope selector available from either record page, defaulting to both Technical Assistance and Other Tasks worksheets. Previews and completion summaries report counts per worksheet and label warnings by worksheet; unsupported worksheets such as WorkLogs remain ignored.
- Defaulted Technical Assistance and Other Tasks list filtering to the signed-in user, with All Users still available, and added the record owner's full name beside Assigned To.
- Added Export mine beside Import mine on record toolbars. It downloads the existing Technical Assistance, Other Tasks and WorkLogs workbook for records owned by the signed-in user.
- Updated Excel imports to process only the named Technical Assistance and Other Tasks worksheets, report ignored tabs such as WorkLogs, and match optional Assigned To values by user full name. Unknown or ambiguous names remain unassigned with warnings; imported records remain owned by the importer and Accountable Person values are ignored.
- Added a WorkLogs worksheet to report workbook downloads and email attachments, listing each exported record's work-log entries with parent reference, type, timestamp, author and typed content. Existing Technical Assistance and Other Tasks worksheet columns are unchanged.
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
