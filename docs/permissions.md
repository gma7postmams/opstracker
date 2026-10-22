# Authentication and Permissions

## Authentication

Sign-in uses a NextAuth credentials provider with username and password. Passwords are checked against bcrypt hashes; inactive accounts cannot authenticate. Accounts with Email 2FA enabled must also provide a valid one-time email code before NextAuth creates a session. The session strategy is JWT with a 12-hour maximum age. Successful and failed credential attempts and explicit logout are written to audit logs.

The shared `(app)` layout redirects unauthenticated visitors to `/login`. Middleware also checks the protected application routes and restricts `/admin` pages to the `ADMIN` role. API routes require their own checks; middleware does not provide blanket API authorization.

## Roles and record permissions

| Capability | `USER` | `ADMIN` |
|---|---|---|
| View record lists | Records owned by a regular user, plus records assigned to the caller | All records |
| View a record detail | Owner is a regular user or caller is assigned | All records |
| Edit record content | Owner, or assigned user when unlocked; assigned users have a restricted field set | Any record, including locked records |
| Edit work logs | Author may edit their own; record owner may edit any work log on their record | Any work log |
| Delete work logs | Author may delete their own; record owner may delete any work log on their record | Any work log |
| Lock/unlock records | No | Yes |
| Import records for multiple assignees | No | Yes |
| Manage users, roles, master data, branding, backup/restore | No | Yes |

An unlocked record owner or assigned user can pass the base edit check. A caller editing a record they do not own is limited to assigned person, status, priority, end date and end time. The owner (and an administrator) can edit the full record except that owner identity is not an editable field. A lock blocks non-admin edits. Batch operations skip records the caller cannot edit.

Work-log editing and deletion are separately authorized and are not blocked by record locks: administrators and record owners can edit or delete any work log in scope, while authors can edit or delete their own work logs. Editing changes only the message; entry type, author and creation timestamp are immutable.

The ordinary-user list visibility rule is based on owner role `USER` or matching assignee name. It is distinct from edit permission. Reports use a participation scope: the caller's owned records, assigned records and records with a work log authored by the caller. The dashboard's ordinary-user data filter is by owner ID.

## Account management

- Users can update their own profile and password; only administrators can create users, change another user's account/role, deactivate accounts or delete users.
- Authenticated users can enable or disable Email 2FA for their own account. Only administrators can disable Email 2FA for another user as an account-recovery action; the recovery action invalidates outstanding codes and is audit logged.
- A user cannot change their own role or delete themselves.
- The last active administrator cannot be demoted or deleted.
- Deleting a user sets operational record owner/lock references to null; records remain.
- Usernames and emails are unique. User creation/update validates passwords with a minimum of eight characters.

Email 2FA setup and login codes are sent to the user's profile email through their saved Gmail SMTP credentials. The login challenge endpoint validates the submitted username and password before issuing a code. Codes are single-use and expire after 10 minutes; issuance is limited to five per user in a rolling 15-minute window. The initial login challenge bypasses the resend cooldown, while explicit resends are subject to a 60-second cooldown. The Audit Logs page supports the `2FA_ENABLED`, `2FA_DISABLED`, `2FA_CODE_SENT`, `2FA_SUCCESS` and `2FA_FAILURE` actions.

## Other boundaries

- `/api/branding` GET is intentionally public for sign-in rendering; writes require an administrator.
- Any authenticated user can upload an avatar. Logo and favicon uploads require an administrator. Uploads are limited to 2 MB and allowed image MIME types, with server-generated filenames.
- `/api/users` GET is available to authenticated users and returns the user directory. Audit list/export routes return all logs to administrators and only the caller's logs to regular users.
- The report user filter is administrator-only. MACO chat and work-log APIs require a session.

## Authorization gaps in the current code

The following endpoints do not enforce the protections implied by their page location or names; document these as current implementation behavior, not as intended policy:

- `/api/admin/ai` GET/PUT and `/api/admin/ai/test` do not check authentication or administrator role.
- `/api/ai/improve` does not check authentication.
- `/api/users/filter` does not check authentication.
- `/api/dashboard` returns the five newest audit events without applying the current user's audit-log scope, although its record metrics are scoped by owner.

These are important access-control discrepancies. Do not rely on the UI or route naming as protection for these endpoints.
