Inspect only:

- docs/ui-crm-standards.md
- app/(app)/records/[type]/page.tsx

Apply the CRM UI Standards.

Requirements:

1. Add Remarks visibility to both Technical Assistance and Other Tasks tables.
2. Do NOT create a separate Remarks column.
3. Display Remarks beneath the existing Activity / Description content.
4. Show:
   - Title
   - Description
   - Remarks label (only if remarks exists)
5. Truncate long Description and Remarks content with line clamp.
6. Preserve all existing filtering, sorting, searching, row actions, and responsive behavior.
7. Do not modify APIs, database schema, business logic, or backend code.

CRM Modernization:

8. Upgrade the table to a modern CRM-style experience:
   - Improved column spacing
   - Better typography hierarchy
   - Softer borders
   - Hover highlight state
   - Sticky table header
   - Modern empty state
   - Better badge styling for Status and Priority

9. Add modern icons where appropriate:
   - Search input
   - Status
   - Priority
   - Assigned User
   - Location
   - Date
   - Import
   - New Record button

10. Enhance status badges:
   - OPEN = Blue
   - CLOSE_PENDING = Amber
   - CLOSED = Green

11. Enhance priority badges:
   - LOW = Gray
   - NORMAL = Blue
   - HIGH = Orange
   - CRITICAL = Red

12. Add CRM summary cards above the table:
   - Total Records
   - Open
   - Close Pending
   - Closed

13. Cards must use:
   - Subtle glossy CRM style
   - Soft shadow
   - Rounded corners
   - Color accent strip
   - Small icon
   - Hover transition

14. Modernize pagination:
   - Previous / Next buttons
   - Current page indicator
   - Rows per page selector
   - Total records count
   - CRM-style compact footer

15. Use smooth animations:
   - 150–200ms transitions
   - Hover elevation
   - Button hover effects
   - No excessive animations

Activity / Description Layout:

Storage Monitoring

Performed monitoring of IBM storage utilization and health metrics...

Remarks:
Usage stable at 80%.
No action required.

Design Goal:

Create a premium modern CRM dashboard experience similar to:
- HubSpot CRM
- Salesforce Lightning
- Attio
- Vercel Dashboard

while preserving the existing OpsTracker functionality and data behavior.

## Email Activity Summary

Email report Activity Summary uses exactly three compact KPI cards, ordered Technical Assistance, Other Tasks, and Total Records. Keep the cards approximately 160-180px wide, equal in width and height, compact, centered, and naturally spaced within the email width rather than stretching them across the row. Use white rounded cards with a subtle glossy appearance, a subtle shadow, and a colored left accent: cyan for Technical Assistance, amber for Other Tasks, and blue for Total Records. Place each icon to the left of its label and center the value below.

Keep the email Status Summary with three equally sized cards ordered Open, Close Pending, and Closed. Use red for Open, amber for Close Pending, and green for Closed. Preserve the same compact rounded CRM glossy appearance as the Activity Summary cards. Use Outlook-compatible presentation tables and inline styles, with graceful fallback where email clients do not support rounded corners or shadows; do not make the cards full-width table cells.

## Table Column Sizing

For Technical Assistance and Other Tasks tables, make Activity / Description the primary content column at approximately 35-40% of the table width. Keep Title first, followed by Description and optional Remarks; clamp Description and Remarks to two lines. Reduce the Date, Priority, Duration, and Status columns, while retaining enough width for Location and Assigned values to remain readable. Use fixed column proportions within the existing horizontally scrollable table wrapper so narrow viewports remain usable without compressing the primary content.