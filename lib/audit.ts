import { prisma } from "./prisma";

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
    return Object.is(oldValue, newValue) ? [] : [{ field, oldValue, newValue }];
  });
}

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  details,
}: {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
