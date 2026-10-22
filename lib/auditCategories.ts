export const AUDIT_CATEGORIES = [
  { value: "AUTHENTICATION", label: "Authentication" },
  { value: "USER_MANAGEMENT", label: "User Management" },
  { value: "ADMINISTRATION", label: "Administration" },
  { value: "REPORTS", label: "Reports" },
  { value: "TECHNICAL_ASSISTANCE", label: "Technical Assistance" },
  { value: "OTHER_TASKS", label: "Other Tasks" },
  { value: "SYSTEM", label: "System" },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["value"];

export const AUDIT_ACTIONS = [
  "CREATE", "UPDATE", "UPDATE_PROFILE", "UPDATE_USER", "DELETE", "IMPORT", "IMPORT_BOTH",
  "LOCK", "UNLOCK", "LOGIN", "LOGOUT", "LOGIN_FAILED", "2FA_ENABLED", "2FA_DISABLED",
  "2FA_CODE_SENT", "2FA_SUCCESS", "2FA_FAILURE", "REPORT_EMAIL_SENT", "REPORT_EMAIL_FAILED",
  "MASTERDATA_ADD", "MASTERDATA_RETIRE", "MASTERDATA_RESTORE",
] as const;

const RECORD_ACTIONS = ["CREATE", "UPDATE", "DELETE", "IMPORT", "LOCK", "UNLOCK"] as const;

export const AUDIT_ACTIONS_BY_CATEGORY: Record<AuditCategory, readonly string[]> = {
  AUTHENTICATION: ["LOGIN", "LOGOUT", "LOGIN_FAILED", "2FA_ENABLED", "2FA_DISABLED", "2FA_CODE_SENT", "2FA_SUCCESS", "2FA_FAILURE"],
  USER_MANAGEMENT: ["UPDATE_PROFILE", "UPDATE_USER"],
  ADMINISTRATION: ["MASTERDATA_ADD", "MASTERDATA_RETIRE", "MASTERDATA_RESTORE"],
  REPORTS: ["REPORT_EMAIL_SENT", "REPORT_EMAIL_FAILED"],
  TECHNICAL_ASSISTANCE: RECORD_ACTIONS,
  OTHER_TASKS: RECORD_ACTIONS,
  SYSTEM: ["IMPORT_BOTH"],
};

export function getAuditCategory(log: { action?: unknown; entityType?: unknown }): AuditCategory {
  const action = String(log.action ?? "").toUpperCase();
  const entityType = String(log.entityType ?? "").toUpperCase().replace(/[_-]+/g, " ");

  if (entityType.includes("AUTH") || action.startsWith("LOGIN") || action.startsWith("LOGOUT") || action.startsWith("2FA")) {
    return "AUTHENTICATION";
  }
  if (action.includes("USER") || action.includes("PERMISSION") || entityType.includes("USER")) {
    return "USER_MANAGEMENT";
  }
  if (
    action.startsWith("MASTERDATA_") ||
    /SETTING|FEATURE|BRANDING|CONFIGURATION/.test(`${action} ${entityType}`) ||
    entityType.includes("MASTER DATA")
  ) {
    return "ADMINISTRATION";
  }
  if (action.startsWith("REPORT_") || entityType.includes("REPORT")) {
    return "REPORTS";
  }
  if (entityType.includes("ASSISTANCE")) {
    return "TECHNICAL_ASSISTANCE";
  }
  if (entityType.includes("TASK")) {
    return "OTHER_TASKS";
  }
  return "SYSTEM";
}