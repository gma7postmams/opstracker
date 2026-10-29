export interface SessionUser {
  id: number;
  role: "ADMIN" | "USER";
  name: string;
}

interface OwnableRecord {
  ownerId: number | null;
  owner?: { role: "ADMIN" | "USER" } | null;
  assigned?: string | null;
  locked: boolean;
  hasParticipated?: boolean;
}

export function canView(user: SessionUser, record: OwnableRecord, includeAllUserOwned = false): boolean {
  if (user.role === "ADMIN") return true;
  return (
    (includeAllUserOwned && record.owner?.role === "USER") ||
    record.ownerId === user.id ||
    record.assigned === user.name ||
    record.hasParticipated === true
  );
}

export function canEdit(user: SessionUser, record: OwnableRecord): boolean {
  if (user.role === "ADMIN") return true;
  return (record.ownerId === user.id || record.assigned === user.name) && !record.locked;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

/** Reason string for the UI when canEdit is false — used in tooltips. */
export function editBlockedReason(user: SessionUser, record: OwnableRecord): string | null {
  if (canEdit(user, record)) return null;
  if (record.locked) return "This record is locked by an administrator";
  return "Only the record owner or current assignee can edit it";
}

/** Admins may not strip their own admin rights or delete themselves. */
export function canModifyUser(actor: SessionUser, targetId: number) {
  return {
    canEditRole: actor.role === "ADMIN" && actor.id !== targetId,
    canDelete: actor.role === "ADMIN" && actor.id !== targetId,
  };
}
