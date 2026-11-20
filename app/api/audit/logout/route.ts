import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const user = await currentUser();

  if (user) {

await logAudit({
  action: "LOGOUT",
  entityType: "auth",
  entityId: "Successful Logout",
  userId: user.id,
  request,
  details: {
    name: user.name,
  },
});


  }

  return NextResponse.json({ ok: true });
}
