import { SessionUser } from "./permissions";
import { applyRecordVisibility } from "./records";
import { fullName } from "./format";

export type ReportScope = "mine" | "all";

export const reportOwnerSelect = {
  firstName: true,
  middleInitial: true,
  surname: true,
} as const;

export function formatReportOwner(owner?: {
  firstName: string;
  middleInitial?: string | null;
  surname: string;
} | null) {
  return owner ? fullName(owner) : "—";
}

export function resolveReportScope(scope: string | null | undefined, user: SessionUser): ReportScope {
  if (user.role !== "ADMIN") return "mine";
  if (scope === "mine" || scope === "all") return scope;
  return "all";
}

export function applyReportScope<T extends Record<string, any>>(
  where: T,
  user: SessionUser,
  scope: ReportScope
) {
  if (scope === "all") return applyRecordVisibility(where, user);
  return {
    AND: [
      where,
      { OR: [{ ownerId: user.id }, { assigned: user.name }] },
    ],
  };
}