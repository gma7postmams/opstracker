import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { fullName } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const sessionUser = await currentUser();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: sessionUser.id,
    },
    select: {
      id: true,
      firstName: true,
      middleInitial: true,
      surname: true,
      email: true,
      username: true,
      avatarUrl: true,

      smtpEmail: true,
      smtpRecipients: true,
      smtpEnabled: true,
    },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const sessionUser = await currentUser();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const changedFields: string[] = [];

  const data: Record<string, unknown> = {};

  if (body.firstName !== undefined) {
    data.firstName = body.firstName.trim();
    changedFields.push("firstName");
  }

  if (body.middleInitial !== undefined) {
    data.middleInitial =
      body.middleInitial?.trim().toUpperCase() || null;
    changedFields.push("middleInitial");
  }

  if (body.surname !== undefined) {
    data.surname = body.surname.trim();
    changedFields.push("surname");
  }

  if (body.email !== undefined) {
    data.email = body.email.trim();
    changedFields.push("email");
  }

  if (body.username !== undefined) {
    data.username = body.username.trim().toLowerCase();
    changedFields.push("username");
  }

  if (body.avatarUrl !== undefined) {
    data.avatarUrl = body.avatarUrl;
    changedFields.push("avatarUrl");
  }

  if (body.smtpEnabled !== undefined) {
    data.smtpEnabled = !!body.smtpEnabled;
    changedFields.push("smtpEnabled");
  }

  if (body.smtpEmail !== undefined) {
    data.smtpEmail = body.smtpEmail || null;
    changedFields.push("smtpEmail");
  }

  if (body.smtpRecipients !== undefined) {
    data.smtpRecipients = body.smtpRecipients || null;
    changedFields.push("smtpRecipients");
  }

  if (body.smtpPassword?.trim()) {
    data.smtpPassword = body.smtpPassword.trim();
    changedFields.push("smtpPassword");
  }

  if (body.password?.trim()) {
    data.passwordHash = await bcrypt.hash(
      body.password.trim(),
      10
    );

    changedFields.push("password");
  }

  const updated = await prisma.user.update({
    where: {
      id: sessionUser.id,
    },
    data,
    select: {
      id: true,
      firstName: true,
      middleInitial: true,
      surname: true,
      email: true,
      username: true,
      avatarUrl: true,

      smtpEnabled: true,
      smtpEmail: true,
      smtpRecipients: true,
    },
  });

  if (changedFields.length > 0) {
    await logAudit({
      userId: sessionUser.id,
      action: "UPDATE_PROFILE",
      entityType: "User Profile",
      entityId: `Updated ${updated.username}`,
      details: {
        user: fullName(updated),
        changedFields,
        passwordChanged: changedFields.includes("password"),
        smtpPasswordChanged:
          changedFields.includes("smtpPassword"),
      },
    });
  } 
  

  return NextResponse.json(updated);
}