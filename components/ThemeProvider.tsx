"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type Preference = "light" | "dark" | "system";
type Effective = "light" | "dark";

const STORAGE_KEY = "opslog-theme";

interface ThemeCtx {
  preference: Preference;
  effective: Effective;
  setPreference: (p: Preference) => void;
  cycle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline head script already set the DOM attribute correctly before
  // paint; read it back rather than guessing again, so hydration matches.
  const [preference, setPreferenceState] = useState<Preference>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Preference) || "system";
  });
  const [effective, setEffective] = useState<Effective>(() => {
    if (typeof document === "undefined") return "light";
    return (document.documentElement.getAttribute("data-theme") as Effective) || "light";
  });

  const apply = useCallback((pref: Preference) => {
    const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    setEffective(dark ? "dark" : "light");
  }, []);

  const setPreference = useCallback((pref: Preference) => {
    localStorage.setItem(STORAGE_KEY, pref);
    setPreferenceState(pref);
    apply(pref);
  }, [apply]);

  const cycle = useCallback(() => {
    setPreference(preference === "light" ? "dark" : preference === "dark" ? "system" : "light");
  }, [preference, setPreference]);

  // Follow the OS live while set to "system" — e.g. the machine flips to
  // dark at sunset and the app should follow without a manual toggle.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, apply]);

  const value = useMemo(() => ({ preference, effective, setPreference, cycle }), [preference, effective, setPreference, cycle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
