"use client";

import { useEffect, useRef, useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, CircleCheck, KeyRound, LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";

const toTitleCase = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase()}`
    );

export default function ProfileForm({
  user,
}: {
  user: any;
}) {
  const router = useRouter();
  const { update } = useSession();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const profilePictureRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] =
    useState(false);

  const [firstName, setFirstName] = useState(
    toTitleCase(user.firstName ?? "")
  );

  const [middleInitial, setMiddleInitial] = useState(
    (user.middleInitial ?? "").toUpperCase()
  );

  const [surname, setSurname] = useState(
    toTitleCase(user.surname ?? "")
  );

  const [email, setEmail] = useState(
    user.email ?? ""
  );

  const [username, setUsername] = useState(
    user.username ?? ""
  );

  const [password, setPassword] = useState("");

  const [avatarUrl, setAvatarUrl] = useState(
    user.avatarUrl ?? null
  );

  const [smtpEnabled, setSmtpEnabled] = useState(
    user.smtpEnabled ?? false
  );

  const [smtpEmail, setSmtpEmail] = useState(
    user.smtpEmail ?? ""
  );

  const [smtpPassword, setSmtpPassword] =
    useState("");

  const [smtpRecipients, setSmtpRecipients] =
    useState(user.smtpRecipients ?? "");

  const [email2faEnabled, setEmail2faEnabled] = useState(user.email2faEnabled ?? false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorCodeSent, setTwoFactorCodeSent] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  const currentValues = JSON.stringify([
    firstName,
    middleInitial,
    surname,
    email,
    username,
    avatarUrl,
    smtpEnabled,
    smtpEmail,
    smtpPassword,
    smtpRecipients,
    password,
  ]);
  const [savedValues, setSavedValues] = useState(currentValues);
  const hasUnsavedChanges = currentValues !== savedValues;

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const container = profilePictureRef.current;
    if (!container) return;

    const updateControls = () => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        const currentText = textNode.textContent ?? "";
        const label = currentText.trim();
        const replacement = label === "Choose File"
          ? "Change Picture"
          : label === "Remove"
            ? "Remove Picture"
            : null;

        if (replacement) {
          const whitespace = currentText.match(/^\s*/)?.[0] ?? "";
          textNode.textContent = `${whitespace}${replacement}`;
        }
        textNode = walker.nextNode();
      }
    };

    updateControls();
    const observer = new MutationObserver(updateControls);
    observer.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  const fullName = [firstName, middleInitial, surname]
    .filter(Boolean)
    .join(" ");
  const role = toTitleCase(String(user.role ?? "User").replace(/_/g, " "));
  const displayRole = role.toLowerCase() === "admin" ? "Administrator" : role;
  const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
  const formattedLastLogin = lastLogin && !Number.isNaN(lastLogin.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(lastLogin)
    : "No sign-in recorded";

  async function requestTwoFactorCode() {
    if (hasUnsavedChanges) {
      toast("Save your profile and email settings before changing Email 2FA");
      return;
    }
    setTwoFactorBusy(true);
    try {
      const res = await fetch("/api/profile/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Could not send verification code");
      setTwoFactorCodeSent(true);
      setTwoFactorCode("");
      toast("Verification code sent to your profile email");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send verification code");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function verifyTwoFactorCode() {
    setTwoFactorBusy(true);
    try {
      const res = await fetch("/api/profile/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: twoFactorCode }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Could not verify code");
      setEmail2faEnabled(true);
      setTwoFactorCodeSent(false);
      setTwoFactorCode("");
      toast("Email Two-Factor Authentication enabled");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not verify code");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function disableTwoFactor() {
    setTwoFactorBusy(true);
    try {
      const res = await fetch("/api/profile/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Could not disable Email 2FA");
      setEmail2faEnabled(false);
      setTwoFactorCodeSent(false);
      toast("Email Two-Factor Authentication disabled");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not disable Email 2FA");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="profile-experience">
      <motion.div className="profile-page-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <span className="profile-eyebrow">YOUR WORKSPACE</span>
          <h1>Account settings</h1>
          <p>Manage your identity, sign-in security, and email services.</p>
        </div>
      </motion.div>

      <motion.section
        className="profile-overview profile-card profile-overview-hero"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        whileHover={{ y: -2 }}
      >
        <div className="profile-overview-main">
          <div className="profile-avatar-display">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(fullName || "U").slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="profile-overview-copy">
            <span className="profile-eyebrow">ACCOUNT OVERVIEW</span>
            <h2>{toTitleCase(fullName) || "Your Name"}</h2>
            <div className="profile-overview-meta">
              <span className="profile-role"><UserRound size={13} /> {displayRole}</span>
              <span className={`profile-active${user.active ? "" : " is-inactive"}`}><i /> {user.active ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </div>
        <div className="profile-overview-details">
          <div><span>Email</span><strong title={email}>{email || "No email address"}</strong></div>
          <div><span>Username</span><strong>{username || "No username"}</strong></div>
          <div><span>Last login</span><strong>{formattedLastLogin}</strong></div>
        </div>
        <div className={`profile-security-widget ${email2faEnabled ? "is-secure" : "is-standard"}`}>
          <span className="profile-security-icon"><ShieldCheck size={20} /></span>
          <span className="profile-security-copy">
            <small>Sign-in security</small>
            <strong>{email2faEnabled ? "Two-factor authentication on" : "Password protection active"}</strong>
          </span>
          {email2faEnabled && <span className="profile-security-state">PROTECTED</span>}
        </div>
      </motion.section>

      <AnimatePresence>
        {savedNotice && (
          <motion.div className="profile-saved-notice" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <CircleCheck size={18} /> Changes saved successfully
          </motion.div>
        )}
      </AnimatePresence>

      <div className="profile-card-grid">
        <motion.section
          className="profile-card profile-personal-card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          whileHover={{ y: -2 }}
        >
          <div className="profile-card-heading">
            <span className="profile-card-icon profile-icon-blue"><UserRound size={18} /></span>
            <div><h2>Personal information</h2><p>Details shown across your workspace.</p></div>
          </div>
          <div className="form profile-form">
            <div className="full profile-avatar-field" ref={profilePictureRef} onClickCapture={(event) => {
              if (!(event.target instanceof Element) || !event.target.closest("img")) return;
              event.preventDefault();
              event.stopPropagation();
              profilePictureRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
            }}>
              <ImageUpload kind="avatar" value={avatarUrl} round hint="PNG, JPG or WebP up to 2 MB." onChange={(url) => setAvatarUrl(url)} />
            </div>
            <label>First name<input value={firstName} onChange={(event) => setFirstName(toTitleCase(event.target.value))} required /></label>
            <label>Middle initial<input maxLength={1} className="upper" value={middleInitial} onChange={(event) => setMiddleInitial(event.target.value.toUpperCase())} /></label>
            <label className="full">Surname<input value={surname} onChange={(event) => setSurname(toTitleCase(event.target.value))} required /></label>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Username<input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} /></label>
          </div>
        </motion.section>

        <div className="profile-side-cards">
          <motion.section
            className="profile-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            whileHover={{ y: -2 }}
          >
            <div className="profile-card-heading">
              <span className="profile-card-icon profile-icon-green"><ShieldCheck size={18} /></span>
              <div><h2>Security</h2><p>Password and account verification.</p></div>
            </div>
            <div className="profile-form-stack">
              <label className="profile-field-label">Change password
                <div className="profile-password-field">
                  <input type={showPassword ? "text" : "password"} value={password} placeholder="Leave blank to keep current" onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <div className={`profile-2fa-panel ${email2faEnabled ? "enabled" : ""}`}>
                <div className="profile-2fa-head">
                  <span className="profile-2fa-icon"><KeyRound size={17} /></span>
                  <span><small>Email two-factor authentication</small><strong>{email2faEnabled ? "Enabled" : "Not enabled"}</strong></span>
                  <span className={`profile-2fa-state ${email2faEnabled ? "enabled" : "disabled"}`}><i />{email2faEnabled ? "Enabled" : "Disabled"}</span>
                </div>
                <p>{email2faEnabled ? "A one-time email code is required at each sign-in." : "Add a second verification step to protect sign-ins."}</p>
                {email2faEnabled ? (
                  <button type="button" className="secondary profile-wide-button" disabled={twoFactorBusy} onClick={disableTwoFactor}>
                    {twoFactorBusy ? "Please wait…" : "Disable Email 2FA"}
                  </button>
                ) : (
                  <button type="button" className="secondary profile-wide-button" disabled={twoFactorBusy || !email.trim()} onClick={requestTwoFactorCode}>
                    {twoFactorBusy ? "Please wait…" : twoFactorCodeSent ? "Resend verification code" : "Enable Email 2FA"}
                  </button>
                )}
                {!email2faEnabled && twoFactorCodeSent && (
                  <div className="profile-verify-form">
                    <label className="profile-field-label">Verification code
                      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={twoFactorCode}
                        onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    </label>
                    <button type="button" className="primary profile-wide-button" disabled={twoFactorBusy || twoFactorCode.length !== 6} onClick={verifyTwoFactorCode}>
                      Verify and enable
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          <motion.details
            className="profile-card profile-email-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            whileHover={{ y: -2 }}
          >
            <summary className="profile-card-heading profile-email-summary">
              <span className="profile-card-icon profile-icon-cyan"><Mail size={18} /></span>
              <div><h2>Email services</h2><p>Configure report delivery.</p></div>
              <span className={`profile-email-status${smtpEnabled ? " is-on" : ""}`}>{smtpEnabled ? "Enabled" : "Disabled"}</span>
            </summary>
            <div className="profile-form-stack profile-email-body">
              <label className="profile-toggle-row">
                <input type="checkbox" checked={smtpEnabled} onChange={(event) => setSmtpEnabled(event.target.checked)} />
                <span><strong>Email reports</strong><small>{smtpEnabled ? "Enabled for this account" : "Currently disabled"}</small></span>
                <i className={smtpEnabled ? "is-on" : ""}>{smtpEnabled ? "ON" : "OFF"}</i>
              </label>
              <label className="profile-field-label">Gmail sender
                <input type="email" value={smtpEmail} onChange={(event) => setSmtpEmail(event.target.value)} placeholder="you@gmail.com" />
              </label>
              <label className="profile-field-label">Gmail app password
                <div className="profile-password-field">
                  <input type={showSmtpPassword ? "text" : "password"} value={smtpPassword} placeholder="Leave blank to keep current password" onChange={(event) => setSmtpPassword(event.target.value)} />
                  <button type="button" onClick={() => setShowSmtpPassword(!showSmtpPassword)} aria-label={showSmtpPassword ? "Hide app password" : "Show app password"}>
                    {showSmtpPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <label className="profile-field-label">Report recipients
                <input value={smtpRecipients} onChange={(event) => setSmtpRecipients(event.target.value)} placeholder="team@example.com, manager@example.com" />
                <small>Separate multiple email addresses with commas.</small>
              </label>
              <button type="button" className="secondary profile-wide-button" disabled={sendingTestEmail} onClick={async () => {
                if (hasUnsavedChanges) {
                  toast("Save your settings before sending a test email");
                  return;
                }
                setSendingTestEmail(true);
                try {
                  const today = new Date().toISOString().slice(0, 10);
                  const res = await fetch("/api/reports/email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ from: today, to: today }),
                  });
                  const out = await res.json();
                  if (!res.ok) throw new Error(out.error ?? "Failed to send test email");
                  toast(out.message ?? "Test email sent successfully");
                } catch (error) {
                  toast(error instanceof Error ? error.message : "Failed to send test email");
                } finally {
                  setSendingTestEmail(false);
                }
              }}>
                {sendingTestEmail ? "Sending test email…" : "Send test email"}
              </button>
            </div>
          </motion.details>
        </div>
      </div>

      <motion.div className="profile-savebar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="profile-save-message">
          {hasUnsavedChanges ? <><span className="profile-unsaved-dot" /> Unsaved changes</> : <span>Changes are up to date</span>}
        </div>
        <motion.button
          type="button"
          className="primary profile-save-button"
          disabled={saving}
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            setSaving(true);
            const res = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ firstName, middleInitial, surname, email, username, avatarUrl, smtpEnabled, smtpEmail, smtpPassword, smtpRecipients, password }),
            });
            setSaving(false);
            if (res.ok) {
              setPassword("");
              setSmtpPassword("");
              setSavedValues(JSON.stringify([firstName, middleInitial, surname, email, username, avatarUrl, smtpEnabled, smtpEmail, "", smtpRecipients, ""]));
              setSavedNotice(true);
              window.setTimeout(() => setSavedNotice(false), 1800);
              await update();
              router.refresh();
              toast("Profile updated successfully");
            } else {
              const out = await res.json();
              toast(out.error ?? "Failed to save profile");
            }
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={saving ? "saving" : savedNotice ? "saved" : "save"} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              {saving ? <><LoaderCircle className="profile-save-spinner" size={16} /> Saving...</> : savedNotice ? <><Check size={16} /> Saved</> : "Save changes"}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </div>
    </MotionConfig>
  );
}