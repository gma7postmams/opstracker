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
    const settings = JSON.parse(
      await fs.readFile(
        SETTINGS_FILE,
        "utf8"
      )
    );

    const response = await fetch(
      `${settings.url}/api/tags`
    );

    if (!response.ok) {
      throw new Error("Connection failed");
    }

    const data = await response.json();

    return NextResponse.json({
      ok: true,
      models:
        data.models?.map(
          (m: any) => m.name
        ) ?? [],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      ok: false,
      models: [],
    });
  }
}
