import api from "./axios";

export type TargetType = "USER" | "TEAM" | "SCHEDULE";

// One row on the policies list.
export type PolicySummary = {
  id: string;
  name: string;
  repeatCount: number;
  stepCount: number;
  serviceCount: number;
  createdAt: string;
};

export type PolicyStep = {
  id: string;
  position: number;
  delayMinutes: number;
  targetType: TargetType;
  target: { id: string; name: string };
};

// One policy in full.
export type Policy = {
  id: string;
  name: string;
  repeatCount: number;
  steps: PolicyStep[];
  createdAt: string;
  // Only present when loading a single policy.
  services?: { id: string; name: string }[];
};

// What the API accepts for a step when saving.
export type StepInput = {
  position: number;
  delayMinutes: number;
  targetType: TargetType;
  targetId: string;
};

export type PolicyInput = {
  name: string;
  repeatCount: number;
  steps: StepInput[];
};

export const getPoliciesApi = () =>
  api.get<{ data: PolicySummary[] }>("/escalation-policies");

export const getPolicyApi = (id: string) =>
  api.get<Policy>(`/escalation-policies/${id}`);

export const createPolicyApi = (data: PolicyInput) =>
  api.post<Policy>("/escalation-policies", data);

// Sending `steps` replaces every existing step.
export const updatePolicyApi = (id: string, data: Partial<PolicyInput>) =>
  api.patch<Policy>(`/escalation-policies/${id}`, data);

export const deletePolicyApi = (id: string) =>
  api.delete(`/escalation-policies/${id}`);
