import type { Role } from "@/types/auth";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  RESPONDER: "Responder",
  VIEWER: "Viewer",
};

// Roles that can be picked on the members screen. Ownership only moves
// through "Transfer ownership" in the organization settings.
export const ASSIGNABLE_ROLES = ["ADMIN", "RESPONDER", "VIEWER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  ADMIN: "Can manage members and change organization settings.",
  RESPONDER: "Can be on call and respond to incidents.",
  VIEWER: "Can look, but not change anything.",
};

export function canManageMembers(role: Role | undefined) {
  return role === "OWNER" || role === "ADMIN";
}
