import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const SETTINGS_FILE = path.join(
  process.cwd(),
  "data",
  "ai-settings.json"
);

const AI_SETTINGS = ["enabled", "url", "model", "timeout"];
const MACO_SETTINGS = [
  "maco.enabled",
  "maco.model",
  "maco.temperature",
  "maco.searchRecords",
  "maco.showRelatedRecords",
];

function getSetting(settings: any, name: string) {
  return name.split(".").reduce((value, key) => value?.[key], settings);
}

function getChangedSettings(previous: any, next: any, names: string[]) {
  return names.filter(
    (name) => JSON.stringify(getSetting(previous, name)) !== JSON.stringify(getSetting(next, name))
  );
}

function redactUrl(value: unknown) {
  if (typeof value !== "string" || !value) return value;

  try {
    const url = new URL(value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    for (const key of url.searchParams.keys()) {
      if (/token|key|secret|password|auth|credential/i.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    url.pathname = url.pathname.split("/").map((segment) =>
      /^(?:eyJ[A-Za-z0-9_-]{10,}\.|[A-Fa-f0-9]{32,}|[A-Za-z0-9_-]{32,})/.test(segment)
        ? "[REDACTED]"
        : segment
    ).join("/");
    return url.toString();
  } catch {
    return value
      .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[REDACTED]@")
      .replace(/([?&](?:[^=&#]*(?:token|key|secret|password|auth|credential)[^=&#]*)=)[^&#]*/gi, "$1[REDACTED]");
  }
}

const AI_AUDIT_FIELDS: Record<string, string> = {
  enabled: "aiEnabled",
  url: "ollamaUrl",
  model: "aiModel",
  timeout: "timeout",
};

const MACO_AUDIT_FIELDS: Record<string, string> = {
  "maco.enabled": "macoEnabled",
  "maco.model": "defaultModel",
  "maco.temperature": "temperature",
  "maco.searchRecords": "searchRecords",
  "maco.showRelatedRecords": "showRelatedRecords",
};

function makeChanges(previous: any, next: any, names: string[], fieldNames: Record<string, string>) {
  return names.map((name) => {
    const oldValue = getSetting(previous, name);
    const newValue = getSetting(next, name);
    return {
      field: fieldNames[name] ?? name,
      oldValue: name === "url" ? redactUrl(oldValue) : oldValue,
      newValue: name === "url" ? redactUrl(newValue) : newValue,
    };
  });
}

async function getSavedSettings() {
  try {
    return JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

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
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const previous = await getSavedSettings();

  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(body, null, 2),
    "utf8"
  );

  const aiChangedSettings = getChangedSettings(previous, body, AI_SETTINGS);
  const macoChangedSettings = getChangedSettings(previous, body, MACO_SETTINGS);
  const events: { action: string; entityType: string; changes: { field: string; oldValue: unknown; newValue: unknown }[] }[] = [];

  if (aiChangedSettings.length) {
    if (aiChangedSettings.includes("enabled")) {
      events.push({
        action: body.enabled ? "AI_ENABLED" : "AI_DISABLED",
        entityType: "AI Settings",
        changes: makeChanges(previous, body, ["enabled"], AI_AUDIT_FIELDS),
      });
    }
    if (aiChangedSettings.includes("model")) {
      events.push({ action: "AI_MODEL_CHANGED", entityType: "AI Settings", changes: makeChanges(previous, body, ["model"], AI_AUDIT_FIELDS) });
    }
    if (aiChangedSettings.includes("url")) {
      events.push({ action: "AI_URL_CHANGED", entityType: "AI Settings", changes: makeChanges(previous, body, ["url"], AI_AUDIT_FIELDS) });
    }
    events.push({
      action: "AI_SETTINGS_UPDATED",
      entityType: "AI Settings",
      changes: makeChanges(previous, body, aiChangedSettings, AI_AUDIT_FIELDS),
    });
  }

  if (macoChangedSettings.length) {
    if (macoChangedSettings.includes("maco.enabled")) {
      events.push({
        action: body.maco.enabled ? "MACO_ENABLED" : "MACO_DISABLED",
        entityType: "MACO Settings",
        changes: makeChanges(previous, body, ["maco.enabled"], MACO_AUDIT_FIELDS),
      });
    }
    if (macoChangedSettings.includes("maco.model")) {
      events.push({
        action: "MACO_MODEL_CHANGED",
        entityType: "MACO Settings",
        changes: makeChanges(previous, body, ["maco.model"], MACO_AUDIT_FIELDS),
      });
    }
    events.push({
      action: "MACO_SETTINGS_UPDATED",
      entityType: "MACO Settings",
      changes: makeChanges(previous, body, macoChangedSettings, MACO_AUDIT_FIELDS),
    });
  }

  for (const event of events) {
    await logAudit({
      userId: user.id,
      action: event.action,
      entityType: event.entityType,
      details: { changes: event.changes },
    });
  }

  return NextResponse.json({
    ok: true,
  });
}
