import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { brandingSchema, flatten } from "@/lib/validation";
import { getBranding, BRANDING_DEFAULTS } from "@/lib/branding";

/** Unauthenticated on purpose — the sign-in screen needs the branding. */
export async function GET() {
  return NextResponse.json(await getBranding());
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const parsed = brandingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const saved = await prisma.branding.upsert({
    where: { id: 1 },
    update: { title: d.title, tagline: d.tagline, logoUrl: d.logoUrl || null, faviconUrl: d.faviconUrl || null },
    create: { id: 1, title: d.title, tagline: d.tagline, logoUrl: d.logoUrl || null, faviconUrl: d.faviconUrl || null },
  });
  return NextResponse.json(saved);
}

export async function DELETE() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  const saved = await prisma.branding.upsert({
    where: { id: 1 }, update: BRANDING_DEFAULTS, create: { id: 1, ...BRANDING_DEFAULTS },
  });
  return NextResponse.json(saved);
}
