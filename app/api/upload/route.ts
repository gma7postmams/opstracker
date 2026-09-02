import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
};
const KINDS = ["avatar", "logo", "favicon"] as const;
type Kind = (typeof KINDS)[number];

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "avatar") as Kind;

  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown upload kind" }, { status: 400 });
  // Branding assets are site-wide, so only admins may replace them.
  if (kind !== "avatar" && !isAdmin(user)) {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Upload a PNG, JPG, WebP, SVG or ICO image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is over 2 MB — pick a smaller one" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Random name, never the client-supplied one — an uploaded "../../x.png"
  // must not be able to steer the write outside the uploads directory.
  const name = `${kind}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  return NextResponse.json({ url: `/uploads/${name}` });
}
