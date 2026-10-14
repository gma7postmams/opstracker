import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const SETTINGS_FILE = path.join(
  process.cwd(),
  "data",
  "ai-settings.json"
);

const formatDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));

export async function POST(req: NextRequest) {

  console.time("MACO Total");
  
  try {
    const body = await req.json();

    const question = body.message?.trim();

    const history = body.history ?? [];    

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

    const simpleQuestion =
      q === "hi" ||
      q === "hello" ||
      q === "hey" ||
      q === "thanks" ||
      q === "thank you" ||
      q.includes("who are you");    


    let liveContext = "";

    const similarityQuestion =
      q.includes("similar") ||
      q.includes("related") ||
      q.includes("before") ||
      q.includes("encountered") ||
      q.includes("history") ||
      q.includes("past issue") ||
      q.includes("previous");   

    if (similarityQuestion) {
      const relatedRecords =
        await prisma.assistance.findMany({
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
        });

      liveContext += `
    RELATED ASSISTANCE RECORDS

    ${relatedRecords
      .map(
        (r) => `
    Ref No: ${r.refNo}
    Problem: ${r.problem}
    Resolution: ${r.resolution ?? "N/A"}
    Status: ${r.status}
    `
      )
      .join("\n")}
    `;
    }

    if (
      q.includes("user") ||
      q.includes("admin")
    ) {
      const users =
        await prisma.user.findMany({
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

      const admins = users.filter(
        (u) => u.role === "ADMIN"
      );

      const normalUsers = users.filter(
        (u) => u.role === "USER"
      );

      const activeUsers = users.filter(
        (u) => u.active
      ).length;

      liveContext += `
      USER STATISTICS

      Total Users: ${users.length}
      Active Users: ${activeUsers}
      Inactive Users: ${users.length - activeUsers}

      Administrators:
      ${admins
        .map(
          (u) =>
            `- ${u.firstName} ${u.surname}`
        )
        .join("\n")}

      Standard Users:
      ${normalUsers
        .map(
          (u) =>
            `- ${u.firstName} ${u.surname}`
        )
        .join("\n")}
      `;
    }

    if (
      q.includes("incident") ||
      q.includes("assistance") ||
      q.includes("ticket")
    ) {
      const latestAssistance =
        await prisma.assistance.findMany({
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            refNo: true,
            problem: true,
            status: true,
          },
        });

      liveContext += `
    LATEST ASSISTANCE

    ${latestAssistance
      .map(
        (a) =>
          `- ${a.refNo}
    ${a.problem}
    Status: ${a.status}`
      )
      .join("\n")}

    `;
    }

    if (
      q.includes("task") ||
      q.includes("activity")
    ) {
      const latestTasks =
        await prisma.task.findMany({
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            refNo: true,
            activityType: true,
            description: true,
            status: true,
          },
        });

      liveContext += `
    LATEST TASKS

    ${latestTasks
      .map(
        (t) =>
          `- ${t.refNo}
    ${t.activityType}
    ${t.description}
    Status: ${t.status}`
      )
      .join("\n")}

    `;
    }

    let totalUsers = 0;
    let totalTasks = 0;
    let totalAssistance = 0;
    let openTasks = 0;
    let openAssistance = 0;

    let openTaskRecords: any[] = [];
    let openAssistanceRecords: any[] = [];

    if (!simpleQuestion) {
      console.time("Database");

      totalUsers =
        await prisma.user.count();

      totalTasks =
        await prisma.task.count();

      totalAssistance =
        await prisma.assistance.count();

      openTasks =
        await prisma.task.count({
          where: {
            status: "OPEN",
          },
        });

      openTaskRecords =
        await prisma.task.findMany({
          where: {
            status: "OPEN",
          },
          include: {
            owner: true,
          },
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
        });

      openAssistance =
        await prisma.assistance.count({
          where: {
            status: "OPEN",
          },
        });

      openAssistanceRecords =
        await prisma.assistance.findMany({
          where: {
            status: "OPEN",
          },
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
        });

      console.timeEnd("Database");
    }

  if (!simpleQuestion) {  

    liveContext += `
    SYSTEM STATISTICS

    Total Users: ${totalUsers}
    Total Tasks: ${totalTasks}
    Open Tasks: ${openTasks}

    Total Assistance Records: ${totalAssistance}
    Open Assistance Records: ${openAssistance}

    OPEN TASK RECORDS

    ${openTaskRecords
      .map(
        (t) => `
    Ref No: ${t.refNo}

    Date: ${t.date}
    Shift: ${t.shift}
    Location: ${t.location}
    Show Group: ${t.showGroup ?? "N/A"}

    Activity Type: ${t.activityType}
    Description: ${t.description}

    Priority: ${t.priority}
    Status: ${t.status}

    Assigned: ${t.assigned}
    Accountable: ${t.accountable}

    Owner:
    ${t.owner
      ? `${t.owner.firstName} ${t.owner.surname}`
      : "Unassigned"}

    Remarks:
    ${t.remarks ?? "N/A"}

    Created:
    ${formatDate(t.createdAt)}

    Updated:
    ${formatDate(t.updatedAt)}
    `
      )
      .join("\n")}

    OPEN ASSISTANCE RECORDS

    ${openAssistanceRecords
      .map(
        (a) => `
    Ref No: ${a.refNo}

    Date: ${a.date}
    Shift: ${a.shift}
    Location: ${a.location}
    Show Group: ${a.showGroup ?? "N/A"}

    Client: ${a.clientName ?? "N/A"}
    Category: ${a.category}

    Problem: ${a.problem}
    Resolution: ${a.resolution ?? "N/A"}

    Priority: ${a.priority}
    Status: ${a.status}

    Assigned: ${a.assigned}
    Accountable: ${a.accountable}

    Remarks:
    ${a.remarks ?? "N/A"}

    Created:
    ${formatDate(a.createdAt)}

    Updated:
    ${formatDate(a.updatedAt)}
    `
      )
      .join("\n")}
    `;

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

    let assistance: any[] = [];
    let tasks: any[] = [];

    if (settings.maco?.searchRecords !== false) {
      assistance =
        await prisma.assistance.findMany({
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

      tasks = await prisma.task.findMany({
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
    }
   
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
    Ref No: ${r.refNo}
    Date: ${r.date}
    Shift: ${r.shift}
    Location: ${r.location}
    Show Group: ${r.showGroup ?? "N/A"}

    Client: ${r.clientName ?? "N/A"}
    Category: ${r.category}

    Problem: ${r.problem}
    Resolution: ${r.resolution ?? "N/A"}

    Priority: ${r.priority}
    Status: ${r.status}

    Assigned: ${r.assigned}
    Accountable: ${r.accountable}

    Remarks: ${r.remarks ?? "N/A"}
    `
      )
      .join("\n")}

    Task Records:

    ${tasks
      .map(
        (r) => `
    Ref No: ${r.refNo}
    Date: ${r.date}
    Shift: ${r.shift}
    Location: ${r.location}
    Show Group: ${r.showGroup ?? "N/A"}

    Activity Type: ${r.activityType}
    Description: ${r.description}

    Priority: ${r.priority}
    Status: ${r.status}

    Assigned: ${r.assigned}
    Accountable: ${r.accountable}

    Remarks: ${r.remarks ?? "N/A"}
    `
      )
      .join("\n")}
    `;

    let prompt = "";

    if (simpleQuestion) {
      prompt = `
    You are MACO (MCR AI Copilot).

    Answer professionally and briefly.

    If asked who you are, identify yourself as MACO (MCR AI Copilot), the AI assistant for OpsTracker and MCR staff.

    User Question:
    ${question}
    `;
    } else {
      prompt = `
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
    - Insert a blank line between sections.
    - Group information into logical sections with headings.
    - For records and reports, use subsections instead of one large bullet list.
    - End with a short summary or recommended next action.

    Live System Data Rules:
     - Use Live System Data whenever available.
    - Never claim you lack access to system data when Live System Data exists.
    - Prefer actual statistics over assumptions.

    For statistics and counts:
    - Start with a summary.
    - Then provide details in bullets.
    - Highlight important numbers using bold text.

    When a user asks for a specific task or assistance record:

    - Display all available fields.
    - Do not omit information.
    - Present the record as a detailed report.
    - Include date, shift, location, priority, assignment, ownership, remarks, and status.
    - Only summarize after displaying the complete details.

    Do not claim that you do not have access
    to system data if statistics are provided.

    Live System Data:

    ${liveContext}

    Relevant OpsTracker Records:

    ${context}

    Conversation History:

    ${history
      .map(
        (m: any) =>
          `${m.role}: ${m.content}`
      )
      .join("\n")}

    User Question:
    ${question}
    `;
    }

    console.log(
      "Prompt Length:",
      prompt.length
    );

    console.log(
      "Prompt Preview:",
      prompt.substring(0, 500)
    );    

    console.time("Ollama");

    console.log(
      "Live Context Length:",
      liveContext.length
    );

    console.log(
      "Context Length:",
      context.length
    );

    console.log(
      "Total Prompt Length:",
      (
        liveContext +
        context +
        question
      ).length
    );    

    console.log("Question:", question);

    console.log(
      "History Length:",
      history.length
    );

    console.log(
      "History Content:",
      history.map(
        (m: any) => m.content
      )
    );

    console.log(
      "Live Context Length:",
      liveContext.length
    );

    console.log(
      "Context Length:",
      context.length
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
          prompt,
          stream: false,
          options: {
            temperature:
              settings.maco.temperature ?? 0.2,
          },
        }),
      }
    );

    console.timeEnd("Ollama");
    console.timeEnd("MACO Total");

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