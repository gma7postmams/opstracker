"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";

const SUN = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MOON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);
const MONITOR = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
);

const OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: SUN },
  { value: "dark", label: "Dark", icon: MOON },
  { value: "system", label: "System", icon: MONITOR },
];

export default function ThemeToggle() {
  const { preference, effective, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  return (
    <div className="themetoggle" ref={ref}>
      <button
        className="theme-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Theme: ${preference} (currently ${effective})`}
        aria-expanded={open}
        title={`Theme: ${preference[0].toUpperCase()}${preference.slice(1)}`}
      >
        {effective === "dark" ? MOON : SUN}
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              role="menuitemradio"
              aria-checked={preference === o.value}
              className={`theme-opt${preference === o.value ? " active" : ""}`}
              onClick={() => { setPreference(o.value); setOpen(false); }}
            >
              <span className="ic">{o.icon}</span>{o.label}
              {preference === o.value && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
