import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(
  process.cwd(),
  "data",
  "ai-settings.json"
);

export async function GET() {
  try {
    const contents = await fs.readFile(
      SETTINGS_FILE,
      "utf8"
    );

    return NextResponse.json(
      JSON.parse(contents)
    );
  } catch {
    return NextResponse.json({
      enabled: true,
      url: "http://172.30.10.76:11434",
      model: "gpt-oss:20b",
      timeout: 30000,
    });
  }
}

export async function PUT(req: Request) {
  const body = await req.json();

  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(body, null, 2),
    "utf8"
  );

  return NextResponse.json({
    ok: true,
  });
}
