import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(
  process.cwd(),
  "data",
  "ai-settings.json"
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const question = body.message?.trim();

    if (!question) {
      return NextResponse.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        }
      );
    }

    const settings = JSON.parse(
      await fs.readFile(
        SETTINGS_FILE,
        "utf8"
      )
    );

    // ADD THESE
    console.log("Ollama URL:", settings.url);
    console.log("Model:", settings.maco.model);

    const ollamaUrl =
      `${settings.url}/api/generate`;

    console.log(
      "Calling URL:",
      ollamaUrl
    );

    const response = await fetch(
      ollamaUrl,

      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.maco.model,
prompt: `
You are MACO (MCR AI Copilot).

You assist MCR employees with:
- Technical support
- Broadcast operations
- Engineering concerns
- Workflow troubleshooting
- General knowledge questions

Rules:
- Provide accurate answers.
- Be concise and professional.
- Use bullet points when appropriate.
- Do not make up information.
- If you are unsure, say so.
- If asked who you are, respond that you are MACO (MCR AI Copilot), the AI assistant for OpsTracker and MCR staff.
- Never identify yourself as ChatGPT, OpenAI, Qwen, Ollama, or any other assistant.
- Always identify yourself as MACO (MCR AI Copilot) when asked who you are.

Question:
${question}
`,
        stream: false,
        options: {
          temperature:
            settings.maco.temperature ?? 0.2,
        },
      }),
      }
    );

  // ADD THIS
  console.log("Status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();

      console.log(
        "Ollama Error Body:",
        errorBody
      );

      throw new Error(
        `Ollama error: ${response.status}`
      );
    }

    const data = await response.json();

    return NextResponse.json({
      answer: data.response,
      model: settings.maco.model,
    });
  } 
  catch (error: any) {
    console.error("MACO ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}