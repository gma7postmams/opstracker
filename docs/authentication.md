# Authentication

## Overview

OpsTracker authenticates users with a username and password through the NextAuth Credentials provider. Passwords are checked against bcrypt hashes, usernames are normalized to lowercase, and inactive accounts cannot sign in. Email Two-Factor Authentication (2FA) is optional and managed from Account Settings.

The application uses a JWT session with a 12-hour maximum age. After credentials are accepted, NextAuth establishes the session and exposes the user's ID, username, role, name, and avatar to the application. Successful sign-in updates the user's last-login timestamp. Authentication and 2FA outcomes are recorded in Audit Logs.

## Login Flow

### Standard Login

1. The user enters a username and password.
2. The login page sends them to the 2FA request endpoint, which checks that the account is active and the password is valid.
3. If 2FA is disabled, the page submits the credentials to NextAuth, which validates them and establishes the session.
4. The login success screen completes its checklist, then redirects to `/dashboard`.

### Email 2FA Login

1. The user enters a username and password; the request endpoint validates them before sending a code.
2. If Email 2FA is enabled, a six-digit code is sent to the user's profile email and the login page displays the verification step.
3. The user enters the code. The page automatically submits once all six digits are present.
4. NextAuth validates the credentials and verifies the code. A valid code is consumed before the session is established.
5. The success checklist completes, then the page redirects to `/dashboard`.

The code request and NextAuth credential validation are separate requests. A session is not established by the code request itself.

## Email Two-Factor Authentication

### Verification Code Rules

- Codes contain six digits, including leading zeroes when generated.
- Codes expire after 10 minutes.
- Each code can be used once. A newly issued code invalidates earlier unused codes for that user.
- Code issuance is limited to five codes per user in a rolling 15-minute window.
- Explicit resend requests are subject to a 60-second cooldown. The initial login challenge bypasses that cooldown; the rate limit still applies.
- Setup codes and login codes use the same issuance limits.

Codes are generated randomly and stored as bcrypt hashes. Verification accepts only six numeric digits and checks unexpired, unused codes. Invalid or expired codes do not establish a session.

### Verification Email

The email includes the verification code, a 10-minute expiry notice, a warning not to share the code, and a message to ignore the email if the recipient did not attempt to sign in. Delivery uses the user's saved Gmail sender and app password via Gmail SMTP. A valid profile email and both SMTP values must be configured before a code can be sent.

### Profile Security Settings

Users manage Email 2FA in Account Settings. Enabling it requires requesting and verifying a code; the profile email and Gmail sender credentials must already be saved. Users can disable 2FA from the same settings. Disabling it also invalidates the user's outstanding unused verification codes. The profile displays whether 2FA is enabled and the last recorded sign-in. Administrators can also disable 2FA for account recovery through User Management.

## Login User Experience

The credentials screen greets users with “Hello there” and “Sign in to access OpsTracker.” Credential submission displays staged progress: 35% “Checking Credentials,” 75% “Validating Username,” and 100% “Credentials Verified.” After a successful 2FA challenge and completion of the existing progress animation, the hero and authentication panels exchange sides over 550 ms with ease-in-out timing. On desktop, verification controls move to the left and the welcome uses the first word of the entered value on the right; because the login screen only has the entered username and does not load account profile data, that value is also the fallback. The verification message states that a code was sent by email and asks the user to enter the six-digit code. On mobile, panels remain in verification-first order. The transition respects reduced-motion preferences. The first of six digit inputs receives focus after the panel transition completes. A resend countdown is shown, and the code submits automatically after the sixth digit. Invalid codes clear the inputs and return focus to the first input.

Code verification displays 35% “Verifying Identity,” 75% “Establishing Secure Session,” and 100% “Secure Access Granted.” Successful progress is held briefly before continuing.

After sign-in, a full-screen confirmation displays “Login Successful” and “Security Verification Complete.” “Identity Verified,” “Secure Session Established,” and “Loading Workspace” complete sequentially at 800 ms intervals; the last item changes to “Workspace Loaded” before redirecting to the dashboard.

The “Remember username” option stores only the username in browser local storage, not the password. The “Forgot password?” control directs the user to ask an administrator to reset it; the login page does not provide a self-service password reset flow.

## Audit Events

Authentication audit events include failed login, successful login, code sent, code verification success or failure, Email 2FA enabled or disabled, and email delivery failure. The login challenge includes a request ID and request type in its server logs for request correlation.

## Related Files

- Login UI: `app/login/page.tsx`
- NextAuth route and login 2FA request: `app/api/auth/**`
- Profile 2FA API: `app/api/profile/2fa/**`
- Authentication and session callbacks: `lib/auth.ts`
- Code generation, email delivery, and verification: `lib/email2fa.ts`
- Account settings UI: `components/ProfileForm.tsx`
- User and code persistence: `User` and `EmailVerificationCode` models in `prisma/schema.prisma`