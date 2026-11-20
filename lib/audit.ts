import { prisma } from "./prisma";
import { headers } from "next/headers";
import { isIP } from "node:net";

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export function makeAuditChanges(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  fields: readonly string[]
): AuditChange[] {
  return fields.flatMap((field) => {
    if (/password|smtp|token|secret|2fa/i.test(field)) return [];
    const formatValue = (value: unknown) =>
      value instanceof Date ? value.toISOString().slice(0, 10) : value ?? null;
    const oldValue = formatValue(previous[field]);
    const newValue = formatValue(next[field]);
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field, oldValue, newValue }];
  });
}

function parseIpAddress(value: string | null | undefined) {
  const candidate = value?.trim().replace(/^['"]|['"]$/g, "");
  if (!candidate) return null;
  if (isIP(candidate)) return candidate;

  const bracketedIpv6 = candidate.match(/^\[([\da-f:.]+)\](?::\d+)?$/i)?.[1];
  if (bracketedIpv6 && isIP(bracketedIpv6) === 6) return bracketedIpv6;

  const ipv4WithPort = candidate.match(/^((?:\d{1,3}\.){3}\d{1,3}):\d+$/)?.[1];
  return ipv4WithPort && isIP(ipv4WithPort) === 4 ? ipv4WithPort : null;
}

async function getRequestMetadata(request?: Request) {
  let requestHeaders: Headers | undefined = request?.headers;
  if (!requestHeaders) {
    try {
      requestHeaders = await headers();
    } catch {
      return { ipAddress: null, userAgent: null };
    }
  }

  const forwardedFor = requestHeaders.get("x-forwarded-for")
    ?.split(",")
    .map(parseIpAddress)
    .filter((address) => address !== null)
    .at(-1);
  const runtimeRequest = request as (Request & {
    ip?: string;
    socket?: { remoteAddress?: string };
    connection?: { remoteAddress?: string };
  }) | undefined;
  const ipAddress = forwardedFor ??
    parseIpAddress(requestHeaders.get("x-real-ip")) ??
    parseIpAddress(runtimeRequest?.ip) ??
    parseIpAddress(runtimeRequest?.socket?.remoteAddress) ??
    parseIpAddress(runtimeRequest?.connection?.remoteAddress);

  return {
    ipAddress,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 1000) ?? null,
  };
}

function valuesFromChanges(changes: unknown) {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (!Array.isArray(changes)) return { oldValues, newValues };

  for (const change of changes) {
    if (!change || typeof change !== "object") continue;
    const { field, oldValue, newValue } = change as AuditChange;
    if (typeof field !== "string" || /password|smtp|token|secret|2fa/i.test(field)) continue;
    if (JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)) continue;
    oldValues[field] = oldValue ?? null;
    newValues[field] = newValue ?? null;
  }
  return { oldValues, newValues };
}

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  details,
  request,
}: {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  request?: Request;
}) {
  try {
    const metadata = await getRequestMetadata(request);
    const changes = valuesFromChanges(details?.changes);
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        oldValues: Object.keys(changes.oldValues).length ? changes.oldValues as any : undefined,
        newValues: Object.keys(changes.newValues).length ? changes.newValues as any : undefined,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
