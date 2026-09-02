import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, canModifyUser } from "@/lib/permissions";
import { userUpdateSchema, flatten } from "@/lib/validation";
import { fullName } from "@/lib/format";

const PUBLIC = {
  id: true, firstName: true, middleInitial: true, surname: true, email: true,
  username: true, role: true, avatarUrl: true, active: true, lastLogin: true,
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(p.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admins manage anyone; everyone else may only edit their own profile.
  if (!isAdmin(actor) && actor.id !== id) {
    return NextResponse.json({ error: "You can only edit your own profile" }, { status: 403 });
  }

  const parsed = userUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;

  if (d.username || d.email) {
    const clash = await prisma.user.findFirst({
      where: {
        id: { not: id },
        OR: [
          ...(d.username ? [{ username: d.username }] : []),
          ...(d.email ? [{ email: d.email }] : []),
        ],
      },
      select: { username: true, email: true },
    });
    if (clash) {
      return NextResponse.json({
        error: "Validation failed",
        fields: clash.username === d.username
          ? { username: "That username is already taken" }
          : { email: "That email is already registered to another user" },
      }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  const copyable = ["firstName", "surname", "email", "username", "avatarUrl", "active"] as const;
  for (const k of copyable) {
    if (d[k] !== undefined) data[k] = d[k];
  }
  if (d.middleInitial !== undefined) data.middleInitial = d.middleInitial?.toUpperCase() || null;
  if (d.password) data.passwordHash = await bcrypt.hash(d.password, 10);

  // Guard: nobody demotes themselves out of the last admin seat by accident.
  const { canEditRole } = canModifyUser(actor, id);
  if (d.role !== undefined) {
    if (!canEditRole) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 403 });
    }
    if (target.role === "ADMIN" && d.role === "USER") {
      const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) {
        return NextResponse.json({ error: "This is the last administrator account" }, { status: 400 });
      }
    }
    data.role = d.role;
  }

  const updated = await prisma.user.update({ where: { id }, data, select: PUBLIC });
  return NextResponse.json({ ...updated, name: fullName(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(actor)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const id = Number(p.id);
  if (!canModifyUser(actor, id).canDelete) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) {
      return NextResponse.json({ error: "This is the last administrator account" }, { status: 400 });
    }
  }

  // ownerId is ON DELETE SET NULL, so their records survive; the UI falls back
  // to showing the stored owner as unknown rather than losing the row.
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
