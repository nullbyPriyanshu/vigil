import api from "./axios";
import type { Role } from "@/types/auth";
import type { AssignableRole } from "@/lib/roles";

export type Invitation = {
  id: string;
  email: string;
  role: Role;
  invitedBy: { id: string; name: string };
  expiresAt: string;
  createdAt: string;
};

// What the public /invite/{token} page is allowed to know.
export type InvitationPreview = {
  organization: { name: string };
  email: string;
  role: Role;
  hasAccount: boolean;
  expiresAt: string;
};

// Either a new invitation, or `{ alreadyMember: true }` when the person is
// already in the organization and nothing was sent.
export const createInvitationApi = (email: string, role: AssignableRole) =>
  api.post<Invitation | { alreadyMember: true }>("/organization/invitations", {
    email,
    role,
  });

export const getInvitationsApi = () =>
  api.get<{ data: Invitation[] }>("/organization/invitations");

export const revokeInvitationApi = (id: string) =>
  api.delete(`/organization/invitations/${id}`);

export const getInvitationPreviewApi = (token: string) =>
  api.get<InvitationPreview>(`/invitations/${token}`);

// Three ways to accept, matching the backend:
//  - new account:               { name, password, timezone }
//  - have an account, logged in: {}
//  - have an account, logged out: { currentPassword }
export const acceptInvitationApi = (
  token: string,
  data: {
    name?: string;
    password?: string;
    timezone?: string;
    currentPassword?: string;
  },
) => api.post(`/invitations/${token}/accept`, data);
