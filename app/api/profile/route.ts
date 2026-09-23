import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const updated = await prisma.user.update({
    where: {
      id: sessionUser.id,
    },
    data: {
      firstName: body.firstName?.trim(),
      middleInitial: body.middleInitial?.trim() || null,
      surname: body.surname?.trim(),
      email: body.email?.trim(),
    },
    select: {
      id: true,
      firstName: true,
      middleInitial: true,
      surname: true,
      email: true,
      username: true,
      avatarUrl: true,
    },
  });

  return NextResponse.json(updated);
}