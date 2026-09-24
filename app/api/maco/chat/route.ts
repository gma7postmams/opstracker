import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

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

    const q = question.toLowerCase();
    let liveContext = "";

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

    if (q.includes("user")) {
      const totalUsers = await prisma.user.count();

      const users = await prisma.user.findMany({
        select: {
          firstName: true,
          surname: true,
          role: true,
          active: true,
        },
        orderBy: {
          surname: "asc",
        },
      });

      liveContext += `
    USER INFORMATION

    Total Users: ${totalUsers}

    Users:
    ${users
      .map(
        (u) =>
          `${u.firstName} ${u.surname} (${u.role}) Active: ${u.active}`
      )
      .join("\n")}
    `;
    }

    const assistance = await prisma.assistance.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      where: {
        OR: [
          {
            problem: {
              contains: question,
              mode: "insensitive",
            },
          },
          {
            resolution: {
              contains: question,
              mode: "insensitive",
            },
          },
          {
            remarks: {
              contains: question,
              mode: "insensitive",
            },
          },
        ],
      },
    });

    const tasks = await prisma.task.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      where: {
        OR: [
          {
            description: {
              contains: question,
              mode: "insensitive",
            },
          },
          {
            remarks: {
              contains: question,
              mode: "insensitive",
            },
          },
          {
            activityType: {
              contains: question,
              mode: "insensitive",
            },
          },
        ],
      },
    });

    const totalUsers = await prisma.user.count();

    const totalAssistance =
      await prisma.assistance.count();

    const totalTasks =
      await prisma.task.count();

    const openAssistance =
      await prisma.assistance.count({
        where: {
          status: "OPEN",
        },
      });

    const context = `
    Current OpsTracker Statistics

    Total Users: ${totalUsers}
    Total Technical Assistance Records: ${totalAssistance}
    Total Task Records: ${totalTasks}
    Open Technical Assistance Records: ${openAssistance}

    Technical Assistance Records:

    ${assistance
      .map(
        (r) => `
    Ref: ${r.refNo}
    Problem: ${r.problem}
    Resolution: ${r.resolution ?? "N/A"}
    Remarks: ${r.remarks ?? "N/A"}
    `
      )
      .join("\n")}

    Task Records:

    ${tasks
      .map(
        (r) => `
    Ref: ${r.refNo}
    Activity: ${r.activityType}
    Description: ${r.description}
    Remarks: ${r.remarks ?? "N/A"}
    `
      )
      .join("\n")}
    `;


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
- When answering questions about system statistics, always use the provided Current OpsTracker Statistics section.
- Use Live System Data whenever available.
- Never say you do not have access to system data if Live System Data is provided.
- Answer using the actual statistics supplied.
- When answering, start with a short title.

Response Formatting Rules:
- Always format responses using Markdown.
- Use headings (#, ##).
- Use bullet lists.
- Use numbered lists when appropriate.
- Use tables for reports or statistics.
- Use bold text for important information.
- Never return long walls of plain text.
- Present answers similar to Microsoft Copilot.

For statistics and counts:
- Start with a summary.
- Then provide details in bullets.
- Highlight important numbers using bold text.

Do not claim that you do not have access
to system data if statistics are provided.

Live System Data:

${liveContext}

Relevant OpsTracker Records:

${context}

User Question:
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