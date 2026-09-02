export type RecordType = "assistance" | "tasks";

export interface TypeConfig {
  type: RecordType;
  label: string;
  singular: string;
  prefix: string;
  counterKey: string;
  /** Fields unique to this table, used for validation, search and CSV mapping. */
  ownFields: string[];
  /** The column shown as the bold "subject" in list rows. */
  subjectField: string;
  /** The column shown as the sub-line under the subject. */
  bodyField: string;
  /** Header used in the list table for the subject/body column. */
  subjectHeader: string;
  /** The master-data list that populates this type's classifier dropdown. */
  classifierField: string;
  classifierKind: "CATEGORY" | "ACTIVITY_TYPE";
}

export const TYPES: Record<RecordType, TypeConfig> = {
  assistance: {
    type: "assistance",
    label: "Technical Assistance",
    singular: "Assistance",
    prefix: "TA",
    counterKey: "assistance",
    ownFields: ["clientName", "problem", "category", "resolution"],
    subjectField: "clientName",
    bodyField: "problem",
    subjectHeader: "Client / Problem",
    classifierField: "category",
    classifierKind: "CATEGORY",
  },
  tasks: {
    type: "tasks",
    label: "Other Tasks",
    singular: "Task",
    prefix: "OT",
    counterKey: "tasks",
    ownFields: ["activityType", "description"],
    subjectField: "activityType",
    bodyField: "description",
    subjectHeader: "Activity / Description",
    classifierField: "activityType",
    classifierKind: "ACTIVITY_TYPE",
  },
};

export function isRecordType(v: string): v is RecordType {
  return v === "assistance" || v === "tasks";
}

/** Fields common to both tables — safe to filter, sort and batch-update on. */
export const SHARED_FIELDS = [
  "date", "shift", "location", "showGroup", "priority",
  "timeStarted", "timeEnded", "status", "assigned", "accountable", "remarks",
] as const;

export const SORTABLE = [
  "refNo", "date", "location", "subject", "priority", "timeStarted", "status", "assigned",
] as const;
export type SortKey = (typeof SORTABLE)[number];

/** Priority sorts by severity, not alphabetically. */
export const PRIORITY_ORDER = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
export const STATUS_ORDER = ["OPEN", "CLOSE_PENDING", "CLOSED"];

export function statusLabel(s: string) {
  return s === "CLOSE_PENDING" ? "Close Pending" : s === "OPEN" ? "Open" : "Closed";
}
export function priorityLabel(p: string) {
  return p.charAt(0) + p.slice(1).toLowerCase();
}
