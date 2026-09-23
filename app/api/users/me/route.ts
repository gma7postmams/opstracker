import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/format";

export async function GET() {
  const user = await currentUser();

  return NextResponse.json({
    currentUser: user,
  });
}