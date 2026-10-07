import api from "./axios";

export type RotationType = "DAILY" | "WEEKLY";

export type CurrentOnCall = { userId: string; name: string; until: string };

// One row on the schedules list.
export type ScheduleSummary = {
  id: string;
  name: string;
  team: { id: string; name: string };
  timezone: string;
  rotationType: RotationType;
  // 0 = Sunday ... 6 = Saturday. null for a daily rotation.
  handoffDay: number | null;
  handoffTime: string;
  participantCount: number;
  currentOnCall: CurrentOnCall | null;
};

export type Participant = { position: number; userId: string; name: string };

// One schedule in full.
export type Schedule = Omit<ScheduleSummary, "participantCount"> & {
  startDate: string;
  participants: Participant[];
};

export type ShiftBlock = {
  from: string;
  to: string;
  user: { id: string; name: string } | null;
  current: boolean;
};

export type ScheduleInput = {
  name: string;
  teamId: string;
  timezone: string;
  rotationType: RotationType;
  handoffDay?: number;
  handoffTime: string;
  // "2026-01-05"
  startDate: string;
  // In rotation order. Only used when creating.
  participantIds?: string[];
};

// One row of "who is on call right now" across the organization.
export type OnCallRow = {
  schedule: { id: string; name: string; timezone: string };
  team: { id: string; name: string };
  onCall: { userId: string; name: string } | null;
  until: string | null;
};

export const getSchedulesApi = () =>
  api.get<{ data: ScheduleSummary[] }>("/schedules");

export const getScheduleApi = (id: string) =>
  api.get<Schedule>(`/schedules/${id}`);

export const createScheduleApi = (data: ScheduleInput) =>
  api.post<Schedule>("/schedules", data);

// The team can't be changed after creation.
export const updateScheduleApi = (
  id: string,
  data: Partial<Omit<ScheduleInput, "teamId" | "participantIds">>,
) => api.patch<Schedule>(`/schedules/${id}`, data);

export const deleteScheduleApi = (id: string) => api.delete(`/schedules/${id}`);

export const addParticipantApi = (id: string, userId: string) =>
  api.post<Participant>(`/schedules/${id}/participants`, { userId });

export const removeParticipantApi = (id: string, userId: string) =>
  api.delete(`/schedules/${id}/participants/${userId}`);

export const reorderParticipantsApi = (id: string, userIds: string[]) =>
  api.put<{ participants: Participant[] }>(
    `/schedules/${id}/participants/order`,
    { userIds },
  );

export const getUpcomingShiftsApi = (id: string, weeks = 8) =>
  api.get<{ scheduleId: string; timezone: string; blocks: ShiftBlock[] }>(
    `/schedules/${id}/upcoming`,
    { params: { weeks } },
  );

export const getOnCallApi = () => api.get<{ data: OnCallRow[] }>("/on-call");
