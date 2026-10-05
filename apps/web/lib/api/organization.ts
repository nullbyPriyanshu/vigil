import api from "./axios";
import type { Role } from "@/types/auth";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  onboardingCompletedAt: string | null;
  createdAt: string;
};

export const getOrganizationApi = () => api.get<Organization>("/organization");

export const updateOrganizationApi = (data: { name?: string; slug?: string }) =>
  api.patch<Organization>("/organization", data);

export const transferOwnershipApi = (userId: string) =>
  api.post<{
    previousOwner: { userId: string; role: Role };
    newOwner: { userId: string; role: Role };
  }>("/organization/transfer-ownership", { userId });

export const deleteOrganizationApi = (confirmName: string) =>
  api.delete("/organization", { data: { confirmName } });

export const completeOnboardingApi = () =>
  api.post<{ onboardingCompletedAt: string }>(
    "/organization/onboarding/complete",
  );
