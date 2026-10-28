import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const FILENAME_PATTERN = /^(?:avatar|logo|favicon)-[a-f0-9]{16}\.(?:ico|jpg|png|svg|webp)$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!FILENAME_PATTERN.test(filename)) return new Response(null, { status: 404 });

  let contents: Buffer;
  try {
    contents = await readFile(path.join(process.cwd(), "public", "uploads", filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response(null, { status: 404 });
    }
    throw error;
  }

  return new Response(new Uint8Array(contents), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": CONTENT_TYPES[path.extname(filename)],
      "X-Content-Type-Options": "nosniff",
    },
  });
}