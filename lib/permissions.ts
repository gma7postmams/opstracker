export interface SessionUser {
  id: number;
  role: "ADMIN" | "USER";
  name: string;
}

interface OwnableRecord {
  ownerId: number | null;
  locked: boolean;
}

/**
 * The core rule: you may edit what you entered, unless an admin has locked it.
 * Admins are exempt from both halves.
 */
export function canEdit(user: SessionUser, record: OwnableRecord): boolean {
  if (user.role === "ADMIN") return true;
  return record.ownerId === user.id && !record.locked;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

/** Reason string for the UI when canEdit is false — used in tooltips. */
export function editBlockedReason(user: SessionUser, record: OwnableRecord): string | null {
  if (canEdit(user, record)) return null;
  if (record.locked) return "This record is locked by an administrator";
  return "Only the person who entered this record can edit it";
}

/** Admins may not strip their own admin rights or delete themselves. */
export function canModifyUser(actor: SessionUser, targetId: number) {
  return {
    canEditRole: actor.role === "ADMIN" && actor.id !== targetId,
    canDelete: actor.role === "ADMIN" && actor.id !== targetId,
  };
}
