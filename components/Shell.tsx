"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ClipboardList,
  FileText,
  Headset,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Avatar from "./Avatar";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/assistance", icon: Headset, label: "Technical Assistance" },
  { href: "/tasks", icon: ListTodo, label: "Other Tasks" },
  { href: "/maco", icon: Sparkles, label: "MACO AI" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/users", icon: UsersRound, label: "Users" },
  { href: "/admin", icon: Settings, label: "Administration" },
  { href: "/audit", icon: ClipboardList, label: "Audit Logs" },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/assistance": "Technical Assistance", "/tasks": "Other Tasks",
  "/maco": "MACO AI", "/reports": "Reports", "/users": "Users", "/admin": "Administration","/audit": "Audit Logs", "/profile": "Account Settings",
};

interface Props {
  branding: { title: string; tagline: string; logoUrl: string | null };
  user: { id: number; name: string; role: string; avatarUrl: string | null };
  children: ReactNode;
}

export default function Shell({ branding, user, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [macoEnabled, setMacoEnabled] = useState(false);
  const displayRole = user.role === "ADMIN" ? "Administrator" : user.role;
  const heading = TITLES[pathname] ?? (pathname.startsWith("/records/assistance") ? "Technical Assistance" : pathname.startsWith("/records/tasks") ? "Other Tasks" : branding.title);

  useEffect(() => {
    const loadSettings = () => {
      fetch("/api/features")
        .then((res) => res.json())
        .then((features) => setMacoEnabled(features.macoEnabled === true))
        .catch(() => setMacoEnabled(false));
    };

    loadSettings();
    window.addEventListener("opstracker:ai-settings-saved", loadSettings);
    return () => window.removeEventListener("opstracker:ai-settings-saved", loadSettings);
  }, []);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const date = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    : "";
  const time = now
    ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
    : "";

  return (
    <div className={`app${open ? " navopen" : ""}`}>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside>
        <div className="brand">
          {branding.logoUrl
            ? <img className="mark" src={branding.logoUrl} alt="" />
            : <div className="mark">{branding.title.slice(0, 2).toUpperCase()}</div>}
          <div><b>{branding.title}</b><small>{branding.tagline}</small></div>
        </div>
        <nav className="nav">

          {NAV
            .filter(
              (n) =>
                (n.href !== "/maco" || macoEnabled) &&
                (user.role === "ADMIN" ||
                  (n.href !== "/admin" && n.href !== "/users"))
            )
            .map((n) => (

            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={pathname.startsWith(n.href) ? "active" : ""}>
              <n.icon className="ic" aria-hidden="true" size={18} strokeWidth={1.8} /><span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side">
          <div className="user">
            <span className="user-avatar-wrap">
              <Avatar url={user.avatarUrl} name={user.name} size={32} />
              <span className="online-indicator" aria-label="Online" />
            </span>
            <div><b>{user.name}</b><small>{displayRole}</small></div>
          </div>

<Link
  href="/profile"
  className="logout"
>
  <Settings className="ic" aria-hidden="true" size={18} strokeWidth={1.8} />
  <span>Account Settings</span>
</Link>

<button
  className="logout"
  onClick={async () => {
    try {
      await fetch("/api/audit/logout", {
        method: "POST",
      });
    } catch (err) {
      console.error("Logout audit failed:", err);
    }

    await signOut({
      callbackUrl: "/login",
    });
  }}
>
  <LogOut className="ic" aria-hidden="true" size={18} strokeWidth={1.8} />
  <span>Log out</span>
</button>


        </div>
      </aside>

      <main>
        <header>
          <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation">☰</button>
          <div style={{ minWidth: 0 }}>
            <h2>{heading}</h2>
            <span className="muted" style={{ display: "block", overflowWrap: "anywhere" }}>
              {user.name} · {user.role} · {date}{time && ` · ${time}`}
            </span>
          </div>
          <div className="header-spacer" />
          <ThemeToggle />
        </header>
        {children}
      </main>
    </div>
  );
}
