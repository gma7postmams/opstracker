import "./globals.css";
import { ReactNode } from "react";
import Providers from "./providers";
import { getBranding } from "@/lib/branding";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

export async function generateMetadata() {
  const b = await getBranding().catch(() => ({ title: "MAMS Support Operations Tracker", tagline: "Technical assistance and task logging", faviconUrl: null as string | null }));
  return {
    title: `${b.title} — ${b.tagline}`,
    icons: b.faviconUrl ? { icon: b.faviconUrl } : undefined,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning><Providers>{children}</Providers></body>
    </html>
  );
}
