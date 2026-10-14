import { NextRequest, NextResponse } from "next/server";

import { promises as fs } from "fs";
import path from "path";

const SYSTEM_PROMPT = `
You are an IT documentation assistant.

Return only the corrected text.

Never explain.
Never provide options.
Never provide bullet points.
Never provide markdown.
Never ask questions.

Keep technical terms unchanged.
Keep IP addresses, hostnames, software names,
error messages and reference numbers unchanged.
`;


export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body as { text?: unknown };

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Text is required" },
      { status: 400 }
    );
  }

const config = JSON.parse(
  await fs.readFile(
    path.join(
      process.cwd(),
      "data",
      "ai-settings.json"
    ),
    "utf8"
  )
);

if (!config.enabled) {
  return NextResponse.json(
    {
      error: "AI assistance is disabled by an administrator."
    },
    { status: 503 }
  );
}

const OLLAMA_URL = `${config.url}/api/generate`;
const OLLAMA_MODEL = config.model;
const REQUEST_TIMEOUT_MS = config.timeout ?? 30000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        system: SYSTEM_PROMPT,
        prompt: text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Ollama error:", response.status, errText);
      return NextResponse.json(
        { error: "AI request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (typeof data.response !== "string") {
      console.error("Unexpected Ollama response shape:", data);
      return NextResponse.json(
        { error: "Unexpected AI response" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      suggestion: data.response,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Ollama request timed out");
      return NextResponse.json(
        { error: "AI request timed out" },
        { status: 504 }
      );
    }

    console.error("Ollama request failed:", error);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
