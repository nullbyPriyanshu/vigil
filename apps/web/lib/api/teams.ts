import api from "./axios";
import type { Role } from "@/types/auth";

// One row on the teams list.
export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  serviceCount: number;
  // A few members only, for the row of initials.
  members: { userId: string; name: string; initials: string }[];
};

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  role: Role;
};

// One team in full.
export type Team = {
  id: string;
  name: string;
  slug: string;
  members: TeamMember[];
  services: { id: string; name: string }[];
  schedules: { id: string; name: string }[];
};

export const getTeamsApi = () => api.get<{ data: TeamSummary[] }>("/teams");

export const getTeamApi = (id: string) => api.get<Team>(`/teams/${id}`);

export const createTeamApi = (data: { name: string; memberIds?: string[] }) =>
  api.post<Team>("/teams", data);

export const renameTeamApi = (id: string, name: string) =>
  api.patch<Team>(`/teams/${id}`, { name });

export const deleteTeamApi = (id: string) => api.delete(`/teams/${id}`);

export const addTeamMemberApi = (teamId: string, userId: string) =>
  api.post(`/teams/${teamId}/members`, { userId });

// `force` is for the case where the API answers 409 because the person is
// still on one of the team's schedules, and the user confirms anyway.
export const removeTeamMemberApi = (
  teamId: string,
  userId: string,
  force = false,
) =>
  api.delete(`/teams/${teamId}/members/${userId}`, {
    params: force ? { force: true } : undefined,
  });
