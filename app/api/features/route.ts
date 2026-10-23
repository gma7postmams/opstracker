import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { currentUser } from "@/lib/auth";

const SETTINGS_FILE = path.join(process.cwd(), "data", "ai-settings.json");

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
    return NextResponse.json({
      aiEnabled: settings.enabled === true,
      macoEnabled: settings.maco?.enabled === true,
    });
  } catch {
    return NextResponse.json({ aiEnabled: false, macoEnabled: false });
  }
}