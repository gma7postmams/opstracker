"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Avatar from "./Avatar";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", icon: "▦", label: "Dashboard" },
  { href: "/assistance", icon: "◉", label: "Technical Assistance" },
  { href: "/tasks", icon: "☷", label: "Other Tasks" },
  { href: "/reports", icon: "▤", label: "Reports" },
  { href: "/users", icon: "◍", label: "Users" },
  { href: "/admin", icon: "⚙", label: "Administration" },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/assistance": "Technical Assistance", "/tasks": "Other Tasks",
  "/reports": "Reports", "/users": "Users", "/admin": "Administration",
};

interface Props {
  branding: { title: string; tagline: string; logoUrl: string | null };
  user: { id: number; name: string; role: string; avatarUrl: string | null };
  children: ReactNode;
}

export default function Shell({ branding, user, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const heading = TITLES[pathname] ?? (pathname.startsWith("/records/assistance") ? "Technical Assistance" : pathname.startsWith("/records/tasks") ? "Other Tasks" : branding.title);

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
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={pathname.startsWith(n.href) ? "active" : ""}>
              <span className="ic" aria-hidden>{n.icon}</span><span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side">
          <div className="user">
            <Avatar url={user.avatarUrl} name={user.name} size={32} />
            <div><b>{user.name}</b><small>{user.role}</small></div>
          </div>
          <button className="logout" onClick={() => signOut({ callbackUrl: "/login" })}>
            <span className="ic" aria-hidden>⏻</span><span>Sign out</span>
          </button>
        </div>
      </aside>

      <main>
        <header>
          <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation">☰</button>
          <div>
            <h2>{heading}</h2>
            <span className="muted">{user.name} · {user.role} · {new Date().toISOString().slice(0, 10)}</span>
          </div>
          <div className="header-spacer" />
          <ThemeToggle />
        </header>
        {children}
      </main>
    </div>
  );
}
