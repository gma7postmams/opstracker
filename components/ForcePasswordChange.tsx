"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

/**
 * Blocks the app until a user on a seeded or admin-reset password picks their
 * own. The server clears the flag when the account owner changes their own
 * password, so refreshing the layout is enough to dismiss this.
 */
export default function ForcePasswordChange({ userId }: { userId: number }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== again) return setError("The two passwords don't match");
    setBusy(true);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      return setError(out.fields?.password ?? out.error ?? "Could not change the password");
    }
    router.refresh();
  }

  return (
    <div className="modalbg">
      <form className="modal" style={{ width: 420 }} onSubmit={submit}>
        <div className="modalhead">
          <div>
            <h3>Choose a new password</h3>
            <p className="muted">Your account is using a temporary password. Set your own to continue.</p>
          </div>
        </div>
        <div className="modalbody" style={{ display: "grid", gap: 12 }}>
          {error && <div className="err">{error}</div>}
          <label>New password
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters" autoComplete="new-password" required />
          </label>
          <label>Confirm password
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)}
              autoComplete="new-password" required />
          </label>
          <div className="btngroup" style={{ marginLeft: 0 }}>
            <button type="button" className="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sign out
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
