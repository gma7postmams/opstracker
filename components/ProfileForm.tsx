"use client";

import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

export default function ProfileForm({
  user,
}: {
  user: any;
}) {
  const router = useRouter();
  const { update } = useSession();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] =
    useState(false);

  const [firstName, setFirstName] = useState(
    user.firstName ?? ""
  );

  const [middleInitial, setMiddleInitial] = useState(
    user.middleInitial ?? ""
  );

  const [surname, setSurname] = useState(
    user.surname ?? ""
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

        <div className="form">
          <div className="sectionlabel">
            Profile photo
          </div>

          <div className="full">
            <ImageUpload
              kind="avatar"
              value={avatarUrl}
              round
              hint="PNG, JPG or WebP up to 2 MB. Square images look best."
              onChange={(url) => setAvatarUrl(url)}
            />
          </div>

          <div className="sectionlabel">
            Name
          </div>

          <label>
            First name
            <input
              value={firstName}
              onChange={(e) =>
                setFirstName(e.target.value)
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
                setSurname(e.target.value)
              }
              required
            />
          </label>

          <div className="sectionlabel">
            Account
          </div>

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

          <div className="sectionlabel">
            Email Reports
          </div>

          <label
            className="full"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <input
              type="checkbox"
              checked={smtpEnabled}
              onChange={(e) =>
                setSmtpEnabled(e.target.checked)
              }
              style={{
                width: "18px",
                height: "18px",
                margin: 0,
              }}
            />

            <span>
              Enable Email Reports
            </span>
          </label>

          <label className="full">
            Gmail Sender

            <input
              type="email"
              value={smtpEmail}
              onChange={(e) =>
                setSmtpEmail(e.target.value)
              }
              placeholder="gma7postmams@gmail.com"
            />
          </label>

          <label className="full">
            Gmail App Password

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type={
                  showSmtpPassword
                    ? "text"
                    : "password"
                }
                value={smtpPassword}
                placeholder="Leave blank to keep current password"
                onChange={(e) =>
                  setSmtpPassword(
                    e.target.value
                  )
                }
                style={{
                  paddingRight: "40px",
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowSmtpPassword(
                    !showSmtpPassword
                  )
                }
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showSmtpPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          <label className="full">
            Recipients

            <input
              value={smtpRecipients}
              onChange={(e) =>
                setSmtpRecipients(
                  e.target.value
                )
              }
              placeholder="manager@gmail.com,noel@gmail.com"
            />

            <span className="muted">
              Separate multiple email addresses with commas.
            </span>
          </label>

          <div
            className="full"
            style={{
              textAlign: "right",
              marginTop: "24px",
            }}
          >

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