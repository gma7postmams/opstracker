"use client";

import { useEffect, useRef, useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

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
  const lastUpdated = user.updatedAt ? new Date(user.updatedAt) : null;
  const formattedLastUpdated = lastUpdated && !Number.isNaN(lastUpdated.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(lastUpdated)
    : "Not available";

  return (
    <div
      style={{
        maxWidth: "800px",
      }}
    >
      <section className="panel">
        <h1>Account Settings</h1>

        <div className="muted" style={{ marginBottom: "24px" }}>
          Manage your profile, password, and email report settings.
        </div>

        <div
          className="full"
          style={{
            padding: "16px",
            marginBottom: "24px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.035)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>
              {toTitleCase(fullName) || "Your Name"}
            </div>
            <div className="muted" style={{ marginTop: "3px" }}>
              {displayRole}
            </div>
            <div style={{ marginTop: "3px" }}>
              🟢 Active
            </div>
            <div className="muted" style={{ marginTop: "3px" }}>
              Last Updated: {formattedLastUpdated}
            </div>
            <div style={{ marginTop: "8px", overflowWrap: "anywhere" }}>
              {email || "No email address"}
            </div>
            <div className="muted" style={{ marginTop: "3px", overflowWrap: "anywhere" }}>
              {username || "No username"}
            </div>
          </div>
        </div>

        {savedNotice && (
          <div className="full" role="status" style={{ marginBottom: "16px" }}>
            ✅ Changes saved successfully
          </div>
        )}

        <div className="form">
          <div className="sectionlabel">
            Profile Information
          </div>

          <div
            className="full"
            ref={profilePictureRef}
            onClickCapture={(event) => {
              if (!(event.target instanceof Element) || !event.target.closest("img")) return;
              event.preventDefault();
              event.stopPropagation();
              profilePictureRef.current
                ?.querySelector<HTMLInputElement>('input[type="file"]')
                ?.click();
            }}
          >
            <ImageUpload
              kind="avatar"
              value={avatarUrl}
              round
              hint="PNG, JPG or WebP up to 2 MB. Square images look best."
              onChange={(url) => setAvatarUrl(url)}
            />
          </div>

          <label>
            First name
            <input
              value={firstName}
              onChange={(e) =>
                setFirstName(toTitleCase(e.target.value))
              }
              required
            />
          </label>

          <label>
            Middle initial
            <input
              maxLength={1}
              className="upper"
              value={middleInitial}
              onChange={(e) =>
                setMiddleInitial(
                  e.target.value.toUpperCase()
                )
              }
            />
          </label>

          <label className="full">
            Surname
            <input
              value={surname}
              onChange={(e) =>
                setSurname(toTitleCase(e.target.value))
              }
              required
            />
          </label>

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />
          </label>

          <label>
            Username
            <input
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase()
                )
              }
            />
          </label>

          <div className="sectionlabel">
            Security
          </div>

          <label className="full">
            Password

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                placeholder="Leave blank to keep current"
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                style={{
                  paddingRight: "40px",
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          <details className="full" open>
            <summary style={{
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}>
              Email Reports
              <span
                style={{
                  color: smtpEnabled ? "#86efac" : "#fca5a5",
                  background: smtpEnabled ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  border: `1px solid ${smtpEnabled ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  borderRadius: "999px",
                  padding: "3px 9px",
                  fontSize: "12px",
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                }}
              >
                {smtpEnabled ? "🟢 Enabled" : "⚪ Disabled"}
              </span>
            </summary>
            <div className="form">
              <label
                className="full"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <input
                  type="checkbox"
                  checked={smtpEnabled}
                  onChange={(e) => setSmtpEnabled(e.target.checked)}
                  style={{ width: "18px", height: "18px", margin: 0 }}
                />
                <span>Enable Email Reports</span>
              </label>

              <label className="full">
                Gmail Sender
                <input
                  type="email"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  placeholder="gma7postmams@gmail.com"
                />
              </label>

              <label className="full">
                Gmail App Password
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtpPassword}
                    placeholder="Leave blank to keep current password"
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {showSmtpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="full">
                Recipients
                <input
                  value={smtpRecipients}
                  onChange={(e) => setSmtpRecipients(e.target.value)}
                  placeholder="manager@gmail.com,noel@gmail.com"
                />
                <span className="muted">Separate multiple email addresses with commas.</span>
              </label>

            </div>
          </details>

          {hasUnsavedChanges && (
            <div
              className="full"
              role="status"
              style={{
                marginTop: "8px",
                padding: "10px 12px",
                border: "1px solid rgba(250, 204, 21, 0.4)",
                borderRadius: "6px",
                background: "rgba(250, 204, 21, 0.1)",
                color: "#fde68a",
              }}
            >
              ⚠ You have unsaved changes
            </div>
          )}

          <div
            className="full"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              textAlign: "right",
              marginTop: hasUnsavedChanges ? "8px" : "24px",
            }}
          >
            <button
              type="button"
              disabled={sendingTestEmail}
              onClick={async () => {
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
              }}
            >
              {sendingTestEmail ? "Sending..." : "Send Test Email"}
            </button>
            <button
            className="primary"
            disabled={saving}
            onClick={async () => {
                setSaving(true);

                const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
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
                }),
                });

                setSaving(false);

                if (res.ok) {
                  setPassword("");
                  setSmtpPassword("");
                  setSavedValues(JSON.stringify([
                    firstName,
                    middleInitial,
                    surname,
                    email,
                    username,
                    avatarUrl,
                    smtpEnabled,
                    smtpEmail,
                    "",
                    smtpRecipients,
                    "",
                  ]));
                  setSavedNotice(true);
                  window.setTimeout(() => setSavedNotice(false), 3000);
                  await update();
                  router.refresh();

                  toast("Profile updated successfully");
                } else {
                const out = await res.json();

                toast(out.error ?? "Failed to save profile");
                }
            }}
            >
            {saving ? "Saving..." : "Save Changes"}
            </button>

          </div>
        </div>
      </section>
    </div>
  );
}