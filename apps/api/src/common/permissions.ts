import { Role } from 'src/generated/prisma/enums';

// Highest role first. Used to sort member lists: owner, then admins,
// then responders, then viewers.
export const ROLE_ORDER: Role[] = ['OWNER', 'ADMIN', 'RESPONDER', 'VIEWER'];

// Roles that can be handed out from the members screen. OWNER is missing on
// purpose: ownership only moves through "transfer ownership".
export const ASSIGNABLE_ROLES = ['ADMIN', 'RESPONDER', 'VIEWER'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

// Who is allowed to change roles and remove members.
export function canManageMembers(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
