"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";

const REMEMBER_KEY = "opslog-remember";

const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" />
  </svg>
);
const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 15l3.5-3.5 2.5 2.5L17 9" />
  </svg>
);
const PieIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15.5A9 9 0 1 1 8.5 3v9h12.5Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15Z" />
  </svg>
);
const UserIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
);
const LockIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const EyeIcon = ({ off }: { off: boolean }) => off ? (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.16 3.19M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

const FEATURES = [
  { icon: <DocIcon />, text: "Log technical assistance and other tasks in one place" },
  { icon: <ChartIcon />, text: "Track status from open through close-pending to closed" },
  { icon: <PieIcon />, text: "Reports and productivity tallies, per person and per team" },
];

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const [b, setB] = useState({ title: "MAMS Support Operations Tracker", tagline: "Technical assistance and task logging", logoUrl: null as string | null });
  const [f, setF] = useState({ username: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/branding").then((r) => r.json()).then(setB).catch(() => {});
    // "Remember me" stores only the username, never the password, so the next
    // sign-in is one field shorter without weakening the credential itself.
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { setF((s) => ({ ...s, username: saved })); setRemember(true); }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await signIn("credentials", { ...f, redirect: false });
    setBusy(false);
    if (res?.error) { setError("Incorrect username or password."); return; }
    if (remember) localStorage.setItem(REMEMBER_KEY, f.username);
    else localStorage.removeItem(REMEMBER_KEY);
    router.push("/dashboard");
  }

  const logo = (cls: string, size: number) => b.logoUrl
    ? <img className={cls} src={b.logoUrl} alt="" style={{ width: size, height: size }} />
    : <div className={cls}>{b.title.slice(0, 2).toUpperCase()}</div>;

  return (
    <div className="loginscreen">
      <div className="login-theme"><ThemeToggle /></div>

      <div className="loginleft">
        <div className="loginleft-inner">
          {logo("logotile", 62)}
          <h1>{b.title}</h1>
          <p>{b.tagline} — replacing the daily-report spreadsheet with a shared, searchable log.</p>
          <div className="loginrule" />
          <div className="loginfeatures">
            {FEATURES.map((ft) => (
              <div className="loginfeat" key={ft.text}>
                <div className="ftile">{ft.icon}</div>
                <span>{ft.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="loginright">
        <div className="loginright-inner">
          <div className="loginbrand">
            {logo("logotile", 56)}
            <div><b>{b.title}</b><small>{b.tagline}</small></div>
          </div>

          <h2 className="loginwelcome">Welcome back</h2>
          <p className="login-sub">Sign in to continue</p>

          <form onSubmit={submit}>
            <div className="loginfield">
              <label htmlFor="username">Username</label>
              <div className="inputicon">
                <UserIcon />
                <input id="username" placeholder="Enter your username" value={f.username}
                  autoComplete="username" required autoFocus
                  onChange={(e) => setF({ ...f, username: e.target.value })} />
              </div>
            </div>

            <div className="loginfield">
              <label htmlFor="password">Password</label>
              <div className="inputicon haseye">
                <LockIcon />
                <input id="password" type={showPw ? "text" : "password"} placeholder="Enter your password"
                  value={f.password} autoComplete="current-password" required
                  onChange={(e) => setF({ ...f, password: e.target.value })} />
                <button type="button" className="eyebtn" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}>
                  <EyeIcon off={showPw} />
                </button>
              </div>
            </div>

            <div className="loginrow">
              <label className="remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button type="button" className="forgot"
                onClick={() => toast("Ask an administrator to reset your password.")}>
                Forgot password?
              </button>
            </div>

            {error && <div className="err" style={{ marginBottom: 16 }}>{error}</div>}

            <button className="loginbtn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>

          <div className="loginsecure"><span><ShieldIcon />Secure and private</span></div>
          <p className="loginfoot">Your data is protected and never shared.</p>
        </div>
      </div>
    </div>
  );
}
