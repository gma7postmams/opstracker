import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

const MAX_BYTES = 2 * 1024 * 1024;
const KINDS = ["avatar", "logo", "favicon"] as const;
type Kind = (typeof KINDS)[number];

export const runtime = "nodejs";

/**
 * Identify the image from its leading bytes. The client-supplied MIME type is
 * only a claim, so it is never used to pick the extension we write to disk.
 *
 * SVG is deliberately not accepted: an SVG opened directly is a document that
 * can run script on our origin, and sanitising it reliably is out of scope for
 * a logo upload. Use PNG, WebP or ICO for branding.
 */
function sniffImage(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ".jpg";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return ".webp";
  if (b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return ".ico";
  return null;
}

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

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is over 2 MB — pick a smaller one" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) {
    return NextResponse.json({ error: "Upload a PNG, JPG, WebP or ICO image" }, { status: 400 });
  }

  // Random name, never the client-supplied one — an uploaded "../../x.png"
  // must not be able to steer the write outside the uploads directory.
  const name = `${kind}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  return NextResponse.json({ url: `/uploads/${name}` });
}
