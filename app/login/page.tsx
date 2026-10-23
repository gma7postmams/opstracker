"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Fingerprint, KeyRound, Mail, ShieldCheck } from "lucide-react";
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
  const [progressMode, setProgressMode] = useState<"credentials" | "verification" | null>(null);
  const [progressStage, setProgressStage] = useState(0);
  const [requires2fa, setRequires2fa] = useState(false);
  const [verificationFirstName, setVerificationFirstName] = useState("");
  const [verificationDisplayName, setVerificationDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [successStage, setSuccessStage] = useState(0);
  const [otpInvalid, setOtpInvalid] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const verificationInFlight = useRef(false);
  const credentialSubmitInFlight = useRef(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    fetch("/api/branding").then((r) => r.json()).then(setB).catch(() => {});
    // "Remember me" stores only the username, never the password, so the next
    // sign-in is one field shorter without weakening the credential itself.
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { setF((s) => ({ ...s, username: saved })); setRemember(true); }
  }, []);

  useEffect(() => {
    if (requires2fa && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      otpRefs.current[0]?.focus();
    }
  }, [requires2fa]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (!progressMode) {
      setProgressStage(0);
      return;
    }
    setProgressStage(0);
    const validating = window.setTimeout(() => setProgressStage(1), 200);
    return () => {
      window.clearTimeout(validating);
    };
  }, [progressMode]);

  async function finishProgress(startedAt: number, succeeded = false) {
    console.log("LOGIN PROGRESS START", { succeeded });
    if (succeeded) {
      setProgressStage(2);
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      return;
    }
    const remaining = 600 - (performance.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
    console.log("LOGIN PROGRESS FINISHED", { succeeded });
  }

  async function finishSignIn() {
    setSuccessStage(0);
    setIsComplete(true);
    for (let completedItems = 1; completedItems <= 3; completedItems++) {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      setSuccessStage(completedItems);
    }
    router.push("/dashboard");
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (requires2fa) {
      await verifyCode(verificationCode);
      return;
    }
    if (credentialSubmitInFlight.current) {
      console.info("[login] duplicate credential submission ignored");
      return;
    }
    credentialSubmitInFlight.current = true;
    const startedAt = performance.now();
    setProgressMode("credentials");
    setBusy(true); setError("");
    try {
      const requestId = `login-${Date.now()}`;
      console.info("[login] sending initial 2FA request", { requestId });
      const challenge = await fetch("/api/auth/2fa/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
        body: JSON.stringify({ ...f, requestType: "initial" }),
      });
      const challengeResult = await challenge.json().catch(() => ({}));
      console.log("LOGIN CHALLENGE RESULT", { status: challenge.status, ok: challenge.ok, requires2fa: challengeResult.requires2fa });
      if (!challenge.ok) {
        await finishProgress(startedAt);
        setProgressMode(null);
        setBusy(false);
        setError(challengeResult.error ?? "Could not sign in.");
        return;
      }
      if (challengeResult.requires2fa) {
        await finishProgress(startedAt, true);
        setVerificationFirstName(typeof challengeResult.firstName === "string" ? challengeResult.firstName : "");
        setVerificationDisplayName(typeof challengeResult.displayName === "string" ? challengeResult.displayName : "");
        setResendCountdown(typeof challengeResult.retryAfterSeconds === "number" ? challengeResult.retryAfterSeconds : 60);
        setRequires2fa(true);
        setProgressMode(null);
        setBusy(false);
        return;
      }

      const res = await signIn("credentials", { ...f, redirect: false });
      console.log("LOGIN SIGNIN RESULT", res);
      await finishProgress(startedAt, !res?.error);
      if (res?.error) { setProgressMode(null); setError("Incorrect username or password."); return; }
      if (remember) localStorage.setItem(REMEMBER_KEY, f.username);
      else localStorage.removeItem(REMEMBER_KEY);
      setProgressMode(null);
      await finishSignIn();
    } catch (error) {
      console.error("LOGIN SUBMIT FAILED", error);
      await finishProgress(startedAt);
      setProgressMode(null);
      setError("Could not sign in. Please try again.");
    } finally {
      credentialSubmitInFlight.current = false;
      setBusy(false);
    }
  }

  async function verifyCode(code: string) {
    if (!/^\d{6}$/.test(code) || verificationInFlight.current) return;
    const startedAt = performance.now();
    verificationInFlight.current = true;
    setProgressMode("verification");
    setBusy(true);
    setError("");
    setOtpInvalid(false);
    try {
      console.log("VERIFY START", { usernamePresent: Boolean(f.username), passwordPresent: Boolean(f.password), codeLength: code.length });
      const res = await signIn("credentials", { ...f, verificationCode: code, redirect: false });
      console.log("VERIFY RESULT", res);
      if (res?.error) {
        await finishProgress(startedAt);
        setError("Invalid or expired verification code.");
        setOtpInvalid(true);
        setVerificationCode("");
        window.setTimeout(() => {
          otpRefs.current[0]?.focus();
          setOtpInvalid(false);
        }, 520);
        return;
      }
      await finishProgress(startedAt, true);
      if (remember) localStorage.setItem(REMEMBER_KEY, f.username);
      else localStorage.removeItem(REMEMBER_KEY);
      setOtpSuccess(true);
      await finishSignIn();
    } catch (error) {
      console.error("VERIFY FAILED", error);
      await finishProgress(startedAt);
      setError("Could not verify your code. Please try again.");
      setOtpInvalid(true);
      setVerificationCode("");
      window.setTimeout(() => {
        otpRefs.current[0]?.focus();
        setOtpInvalid(false);
      }, 520);
    } finally {
      verificationInFlight.current = false;
      setBusy(false);
      setProgressMode(null);
    }
  }

  function updateOtpDigit(index: number, value: string) {
    if (busy) return;
    const enteredDigits = value.replace(/\D/g, "");
    if (enteredDigits.length > 1) {
      const digits = verificationCode.padEnd(6, " ").split("");
      for (let offset = 0; offset < enteredDigits.length && index + offset < 6; offset++) {
        digits[index + offset] = enteredDigits[offset];
      }
      const nextCode = digits.join("").replace(/\s+$/, "");
      setVerificationCode(nextCode);
      setError("");
      setOtpInvalid(false);
      if (nextCode.length === 6) void verifyCode(nextCode);
      otpRefs.current[Math.min(index + enteredDigits.length, 5)]?.focus();
      return;
    }
    const digit = enteredDigits.slice(-1);
    const digits = verificationCode.padEnd(6, " ").split("");
    digits[index] = digit || " ";
    const nextCode = digits.join("").replace(/\s+$/, "");
    setVerificationCode(nextCode);
    setError("");
    setOtpInvalid(false);
    if (nextCode.length === 6) void verifyCode(nextCode);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    if (busy) return;
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setVerificationCode(pasted);
    setError("");
    setOtpInvalid(false);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) void verifyCode(pasted);
  }

  function handleOtpKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !verificationCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function useAnotherAccount() {
    setRequires2fa(false);
    setVerificationCode("");
    setResendCountdown(0);
    setError("");
    setOtpInvalid(false);
    setOtpSuccess(false);
    setF((current) => ({ ...current, password: "" }));
  }

  async function resendCode() {
    if (busy || resendCountdown > 0) return;
    setBusy(true); setError("");
    const requestId = `login-${Date.now()}`;
    console.info("[login] sending explicit 2FA resend", { requestId });
    const res = await fetch("/api/auth/2fa/request", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
      body: JSON.stringify({ ...f, requestType: "resend" }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (typeof out.retryAfterSeconds === "number") setResendCountdown(out.retryAfterSeconds);
      setError(out.error ?? "Could not send another code.");
      return;
    }
    setVerificationCode("");
    setResendCountdown(typeof out.retryAfterSeconds === "number" ? out.retryAfterSeconds : 60);
    toast("A new verification code was sent to your email.");
  }

  const logo = (cls: string, size: number) => b.logoUrl
    ? <img className={cls} src={b.logoUrl} alt="" style={{ width: size, height: size }} />
    : <div className={cls}>{b.title.slice(0, 2).toUpperCase()}</div>;
  const enteredName = f.username.trim();
  const greetingName = verificationFirstName || verificationDisplayName || enteredName;
  return (
    <MotionConfig reducedMotion="user">
    <div className="loginscreen">
      <div className="login-mesh" aria-hidden="true">
        <span className="login-shape login-shape-a" />
        <span className="login-shape login-shape-b" />
        <span className="login-grid" />
      </div>
      <div className="login-theme"><ThemeToggle /></div>

      <main className="login-layout">
        <motion.section
          className={`login-story${requires2fa ? " login-story-verification" : ""}`}
          layout
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.55, ease: "easeInOut" } }}
          onLayoutAnimationComplete={() => {
            if (requires2fa) otpRefs.current[0]?.focus();
          }}
        >
          {requires2fa ? (
            <motion.div
              key="verification-panel"
              className="login-verification"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <button type="button" className="login-back" onClick={useAnotherAccount}>
                <ArrowLeft size={16} /> Use another account
              </button>
              <div className="login-icon-heading"><span><Mail size={20} /></span></div>
              <h2 className="loginwelcome">Enter your verification code</h2>
              <p className="login-sub">A verification code has been sent to your email.<br />Enter the 6-digit code to continue.</p>

              <form onSubmit={submit}>
                <div className={`otp-group${otpInvalid ? " has-error" : ""}${otpSuccess ? " is-success" : ""}`} role="group" aria-label="Six-digit verification code">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input
                      key={index}
                      ref={(element) => { otpRefs.current[index] = element; }}
                      className={`otp-digit${verificationCode[index] ? " has-value" : ""}`}
                      aria-label={`Digit ${index + 1}`}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      pattern="[0-9]"
                      maxLength={1}
                      disabled={busy || otpSuccess}
                      aria-invalid={otpInvalid}
                      value={verificationCode[index] ?? ""}
                      onChange={(event) => updateOtpDigit(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                    />
                  ))}
                </div>
                <div className={`login-resend${resendCountdown === 0 ? " is-available" : ""}`} aria-live="polite">
                  {resendCountdown > 0 ? (
                    <span>Resend available in {resendCountdown}s</span>
                  ) : (
                    <>
                      <span>Didn't receive the code?</span>
                      <button type="button" className="forgot" onClick={resendCode} disabled={busy}>
                        Resend verification code
                      </button>
                    </>
                  )}
                </div>
                {error && <div className="err login-error" role="alert">{error}</div>}
                <button className={`loginbtn${progressMode === "verification" ? ` is-processing progress-${progressStage}${progressStage === 2 ? " is-success" : ""}` : ""}`} disabled={busy || verificationCode.length !== 6} aria-live="polite">
                  {progressMode === "verification" ? (
                    <span className="loginbtn-content"><span className="loginbtn-percent">{["35%", "75%", "100%"][progressStage]}</span>{["Verifying Identity...", "Establishing Secure Session...", "✓ Secure Access Granted"][progressStage]}</span>
                  ) : <span className="loginbtn-content"><Fingerprint size={18} /> Verify and sign in</span>}
                </button>
              </form>
            </motion.div>
          ) : (
            <>
              <div className="login-brandline">
                {logo("logotile", 54)}
                <span>OPS<span className="login-brand-accent">TRACKER</span></span>
              </div>
              <div className="login-story-copy">
                <span className="login-eyebrow"><span /> Operations workspace</span>
                <h1>{b.title}</h1>
                <p>{b.tagline}. A shared workspace for support activity, follow-through, and team visibility.</p>
              </div>
              <div className="login-feature-list">
                {FEATURES.map((feature, index) => (
                  <motion.div
                    className="login-feature"
                    key={feature.text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14 + index * 0.1, duration: 0.4 }}
                  >
                    <span className="login-feature-icon">{feature.icon}</span>
                    <span>{feature.text}</span>
                  </motion.div>
                ))}
              </div>
              <div className="login-story-foot"><ShieldCheck size={16} /> Private team access</div>
            </>
          )}
        </motion.section>

        <motion.section
          className={`login-card${requires2fa ? " login-card-welcome" : ""}`}
          layout
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.55, ease: "easeInOut" } }}
          aria-label="Sign in"
        >
          <div className="login-card-top">
            <div className="login-card-mark">{logo("logotile", 44)}</div>
            <div className="login-step-indicator" aria-label={requires2fa ? "Step 2 of 2: Verification" : "Step 1 of 2: Credentials"}>
              <span className={requires2fa ? "complete" : "active"}><i>{requires2fa ? "✓" : "1"}</i>Credentials</span>
              <span className={requires2fa ? "active" : ""}><i>2</i>Verification</span>
            </div>
          </div>

          <div className="login-step-stage">
          <AnimatePresence mode="popLayout" initial={false}>
            {requires2fa ? (
              <motion.div
                key="welcome"
                className="login-step-content"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 className="loginwelcome">Welcome back, {greetingName} 👋</h2>
                <p className="login-sub">Enter the verification code sent to your email.</p>
                <div className="login-security-note"><ShieldCheck size={18} /><span>An additional security check helps keep your account and workspace protected.</span></div>
              </motion.div>
            ) : (
              <motion.div
                key="credentials"
                className="login-step-content"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="login-icon-heading"><span><KeyRound size={20} /></span></div>
                <h2 className="loginwelcome">Hello there 👋</h2>
                <p className="login-sub">Sign in to access OpsTracker.</p>

                <form onSubmit={submit}>
                  <div className="loginfield">
                    <label htmlFor="username">Username</label>
                    <div className="inputicon">
                      <UserIcon />
                      <input id="username" placeholder="Enter your username" value={f.username}
                        autoComplete="username" required autoFocus
                        onChange={(event) => setF({ ...f, username: event.target.value })} />
                    </div>
                  </div>

                  <div className="loginfield">
                    <label htmlFor="password">Password</label>
                    <div className="inputicon haseye">
                      <LockIcon />
                      <input id="password" type={showPw ? "text" : "password"} placeholder="Enter your password"
                        value={f.password} autoComplete="current-password" required
                        onChange={(event) => setF({ ...f, password: event.target.value })} />
                      <button type="button" className="eyebtn" onClick={() => setShowPw((value) => !value)}
                        aria-label={showPw ? "Hide password" : "Show password"}>
                        <EyeIcon off={showPw} />
                      </button>
                    </div>
                  </div>

                  <div className="loginrow">
                    <label className="remember">
                      <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                      Remember username
                    </label>
                    <button type="button" className="forgot"
                      onClick={() => toast("Ask an administrator to reset your password.")}>
                      Forgot password?
                    </button>
                  </div>

                  {error && <div className="err login-error" role="alert">{error}</div>}
                  <button className={`loginbtn${progressMode === "credentials" ? ` is-processing progress-${progressStage}${progressStage === 2 ? " is-success" : ""}` : ""}`} disabled={busy} aria-live="polite">
                    {progressMode === "credentials" ? (
                      <span className="loginbtn-content"><span className="loginbtn-percent">{["35%", "75%", "100%"][progressStage]}</span>{["Checking Credentials...", "Validating Username...", "✓ Credentials Verified"][progressStage]}</span>
                    ) : <span className="loginbtn-content">Continue <ArrowLeft className="login-continue-arrow" size={17} /></span>}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          <div className="login-card-footer">
            <span><ShieldIcon /> Secure and private</span>
            <span>Protected workspace</span>
          </div>
        </motion.section>
      </main>

      <AnimatePresence>
        {isComplete && (
          <motion.div className="login-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="login-success-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              aria-live="polite"
            >
              <h1 className="login-success-title">✅ Login Successful</h1>
              <p className="login-success-subtitle">Security Verification Complete</p>
              <ol className="login-success-checklist">
                {["Identity Verified", "Secure Session Established", "Loading Workspace"].map((label, index) => {
                  const complete = successStage > index;
                  const itemLabel = index === 2 && complete ? "Workspace Loaded" : label;
                  return (
                    <li
                      className={complete ? "is-complete" : ""}
                      key={label}
                    >
                      <span className={`login-success-check${complete ? " is-complete" : ""}`} aria-hidden="true">
                        {complete ? "✓" : "☐"}
                      </span>
                      <span>{itemLabel}</span>
                    </li>
                  );
                })}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
