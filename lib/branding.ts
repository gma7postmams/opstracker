import { prisma } from "./prisma";

export const BRANDING_DEFAULTS = {
  title: "MAMS Support Operations Tracker",
  tagline: "Technical assistance and task logging",
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
};

/**
 * Branding is a single row. Falls back to defaults when the table is empty or
 * unreachable so a database hiccup cannot take down the sign-in screen.
 */
export async function getBranding() {
  try {
    const row = await prisma.branding.findUnique({ where: { id: 1 } });
    return row ?? { id: 1, ...BRANDING_DEFAULTS };
  } catch {
    return { id: 1, ...BRANDING_DEFAULTS };
  }
}
