import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const statusEnum = z.enum(["OPEN", "CLOSE_PENDING", "CLOSED"]);
const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

const shared = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date"),
  shift: z.string().min(1, "Shift is required"),
  location: z.string().min(1, "Location is required"),
  showGroup: z.string().optional().nullable(),
  priority: priorityEnum.default("NORMAL"),
  timeStarted: z.string().regex(HHMM, "Use a 24-hour HH:MM time"),
  timeEnded: z.union([z.string().regex(HHMM), z.literal(""), z.null()]).optional(),
  status: statusEnum.default("OPEN"),
  assigned: z.string().min(1, "Assigned to is required"),
  accountable: z.string().min(1, "Accountable person is required"),
  remarks: z.string().optional().nullable(),
};

/**
 * Both time rules live here rather than in the route so the CSV importer and
 * the form get identical treatment.
 */
const timeRules = (v: any, ctx: z.RefinementCtx) => {
  if (v.timeEnded && v.timeEnded < v.timeStarted) {
    ctx.addIssue({ code: "custom", path: ["timeEnded"], message: "Time ended is before time started" });
  }
  if (v.status === "CLOSED" && !v.timeEnded) {
    ctx.addIssue({ code: "custom", path: ["timeEnded"], message: "A closed record needs a time ended" });
  }
};

export const assistanceSchema = z.object({
  ...shared,
  clientName: z.string().min(1, "Client name is required"),
  problem: z.string().min(1, "Problem is required"),
  category: z.string().min(1, "Category is required"),
  resolution: z.string().optional().nullable(),
}).superRefine(timeRules);

export const taskSchema = z.object({
  ...shared,
  activityType: z.string().min(1, "Activity type is required"),
  description: z.string().min(1, "Description is required"),
}).superRefine(timeRules);

export function schemaFor(type: string) {
  return type === "assistance" ? assistanceSchema : taskSchema;
}

export const batchPatchSchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  location: z.string().min(1).optional(),
  shift: z.string().min(1).optional(),
  assigned: z.string().min(1).optional(),
  accountable: z.string().min(1).optional(),
  timeEnded: z.string().regex(HHMM).optional(),
});

export const userCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleInitial: z.string().max(1).optional().nullable(),
  surname: z.string().min(1, "Surname is required"),
  email: z.string().email("Enter a valid email address"),
  username: z.string().min(3, "Username needs at least 3 characters")
    .regex(/^[a-z0-9._-]+$/, "Use lowercase letters, numbers, dot, dash or underscore"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  password: z.string().min(8, "Password needs at least 8 characters"),
  avatarUrl: z.string().optional().nullable(),

  smtpEmail: z.string().email().optional().or(z.literal("")),
  smtpPassword: z.string().optional(),
  smtpRecipients: z.string().optional(),
  smtpEnabled: z.boolean().optional(),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  password: z.string().min(8, "Password needs at least 8 characters").optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const brandingSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(48),
  tagline: z.string().max(60),
  logoUrl: z.string().optional().nullable(),
  faviconUrl: z.string().optional().nullable(),
});

export const masterDataSchema = z.object({
  kind: z.enum(["LOCATION", "SHIFT", "SHOW_GROUP", "CATEGORY", "ACTIVITY_TYPE"]),
  value: z.string().min(1, "Value is required"),
});

export function flatten(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".") || "_"] = i.message;
  return out;
}
