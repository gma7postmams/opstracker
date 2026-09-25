# MAMS Support Operations Tracker

A centralized operations management and technical assistance tracking system designed for the MAMS Support Unit.

The system provides ITIL-inspired incident logging, operational task tracking, audit monitoring, reporting, backup and restore capabilities, and master data administration.

## Technology Stack

- Next.js 16
- PostgreSQL
- Prisma ORM
- NextAuth Authentication
- TypeScript

---

## Features

### Technical Assistance Management

- Technical Assistance record creation and management
- Client information tracking
- Issue categorization
- Resolution documentation
- Priority management
- Open, Close Pending, and Closed workflows
- Activity history tracking

### Operations Task Management

- Other Task recording and monitoring
- Activity type categorization
- Priority tracking
- Personnel assignment and accountability
- Ongoing task monitoring
- Duration calculation

### Duration Tracking

- Automatic duration calculation
- Ongoing duration tracking for open records
- Overnight activity support
- Multi-day activity support

### User Management

- Role-based access control
- Administrator and User roles
- Record ownership validation
- Login activity tracking

### Audit Trail

- User activity logging
- System audit records
- Record modification history
- Backup and restore audit tracking

### Master Data Administration

Manage:

- Locations
- Shifts
- Categories
- Activity Types
- Show Groups

Features include:

- Active / inactive status
- Administrative management
- Recovery through backup restore

### Backup and Restore

- Full JSON backup export
- Backup preview before restore
- Merge restore mode
- Replace restore mode
- Master Data recovery
- Audit Log restoration

### Reporting

- Dashboard monitoring
- Operational summaries
- Technical Assistance reporting
- Task reporting
- Detailed export-ready reports

---

## Screenshots

### Dashboard

![docs/screenshots/dashboard.png]

Provides a real-time overview of Technical Assistance requests, operational activities, recent actions, and system statistics.

### Technical Assistance

[docs/screenshots/technical-assistance.png]

ITIL-inspired Technical Assistance management module for incident logging, categorization, client support tracking, and resolution documentation.

### Other Tasks

[docs/screenshots/other-tasks.png]

Operational task tracking module for daily activities, assignments, accountability, and work monitoring.

### Reports

[docs/screenshots/reports.png]

Reporting module for generating operational summaries and activity-based reports.

### User Management

[docs/screenshots/users.png]

Administrative management of user accounts, roles, access permissions, and account status.

### Administration

[docs/screenshots/administration.png]

Centralized administration panel for managing master data, branding, backups, restores, and system settings.

### Audit Logs

[docs/screenshots/audit-logs.png]

Comprehensive audit trail capturing user actions, record updates, administrative changes, backups, and restores.

### Account Settings

[docs/screenshots/account-settings.png]

User profile management including account settings and password updates.

---

## Setup

Install dependencies:

```bash
npm install
```

Copy environment configuration:

```bash
cp .env.example .env
```

Configure:

```env
DATABASE_URL="postgresql://opslog:yourpassword@localhost:5432/opslog?schema=public"
NEXTAUTH_URL="http://your-server:3000"
NEXTAUTH_SECRET="your-secret-key"
```

---

## Database Setup

Create the database:

```bash
createdb opslog
```

Run migrations:

```bash
npx prisma migrate dev
```

Seed the database:

```bash
npm run db:seed
```

The seed process creates:

- Administrator account
- Team user accounts
- Default locations
- Default shifts
- Default categories
- Default activity types
- Default show groups

---

## Development

Start the development server:

```bash
npm run dev
```

Access the application:

```text
http://localhost:3000
```

---

## Production Deployment

Build the application:

```bash
npm run build
```

Start using PM2:

```bash
pm2 start npm --name opslog -- start
pm2 save
```

---

## Backup and Restore

Navigate to:

```text
Administration → Backup & Restore
```

Available functions:

- Download full system backup
- Backup preview
- Merge restore
- Replace restore
- Master Data recovery
- Audit Log restoration

### Important

JSON backups include:

- Users
- Technical Assistance records
- Task records
- Master Data
- Branding configuration
- Audit Logs

JSON backups do **not** include files stored in:

```text
public/uploads
```

Back up that folder separately.

---

## Importing Legacy Data

Supported files:

- Microsoft Excel (.xlsx)

Import options:

### User Import

Imports records under the currently logged-in user.

### Administrative Import

Reads Assigned To and Accountable Person values directly from the source file.

Features:

- Preview before import
- Validation checks
- Duplicate protection
- Data normalization

---

## Security Features

- NextAuth authentication
- Role-based permissions
- Record ownership controls
- Administrative record locking
- Audit logging of sensitive actions

---

## Project Structure

```text
app/
├── (app)/
├── api/

components/
├── BackupPanel.tsx
├── ConfirmDialog.tsx
├── RecordForm.tsx

lib/
├── audit.ts
├── permissions.ts
├── recordTypes.ts
├── records.ts
├── validation.ts

prisma/
├── schema.prisma
```

---

## Current Status

**Version Status:** Complete ✅

Completed Development Areas:

- PostgreSQL Integration
- Technical Assistance Module
- Other Tasks Module
- Dashboard and Reporting
- Audit Logging
- Master Data Management
- Backup and Restore
- Import and Migration
- Role-Based Security
- Duration Tracking
- Administrative Controls
- User Experience Improvements

---

## Project Information

**Project Name:** MAMS Support Operations Tracker  
**Developed By:** Eugene B. Horfilla  
**Project Period:** September 2, 2026 - September 25, 2026  
**Status:** Complete ✅

Developed for the MAMS Support Unit to improve Technical Assistance tracking, operational task monitoring, reporting, accountability, auditing, and records management.
