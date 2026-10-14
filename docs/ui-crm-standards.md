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