import api from "./axios";
import type { Role } from "@/types/auth";
import type { AssignableRole } from "@/lib/roles";

export type Member = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  joinedAt: string;
};

export const getMembersApi = () =>
  api.get<{ data: Member[] }>("/organization/members");

export const updateMemberRoleApi = (userId: string, role: AssignableRole) =>
  api.patch<Member>(`/organization/members/${userId}`, { role });

export const removeMemberApi = (userId: string) =>
  api.delete(`/organization/members/${userId}`);
