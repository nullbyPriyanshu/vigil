import api from "./axios";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  team: { id: string; name: string };
  escalationPolicy: { id: string; name: string };
  // Minutes until an untouched incident closes itself. null = never.
  autoResolveMinutes: number | null;
  openIncidentCount: number;
  createdAt: string;
};

export type RecentAlert = {
  id: string;
  title: string;
  receivedAt: string;
  // null for a "resolved" alert that found nothing open to close.
  incidentNumber: number | null;
  kind: "new" | "dedup";
};

// One service in full.
export type ServiceDetail = Service & { recentAlerts: RecentAlert[] };

export type ServiceInput = {
  name: string;
  description: string | null;
  teamId: string;
  escalationPolicyId: string;
  autoResolveMinutes: number | null;
};

export const getServicesApi = () => api.get<{ data: Service[] }>("/services");

export const getServiceApi = (id: string) =>
  api.get<ServiceDetail>(`/services/${id}`);

export const createServiceApi = (data: ServiceInput) =>
  api.post<Service>("/services", data);

export const updateServiceApi = (id: string, data: Partial<ServiceInput>) =>
  api.patch<Service>(`/services/${id}`, data);

export const deleteServiceApi = (id: string) => api.delete(`/services/${id}`);

// A service's API key as the list shows it: the prefix, never the key.
export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

// What comes back when a key is created. `key` is shown once, here only.
export type CreatedApiKey = {
  id: string;
  name: string;
  prefix: string;
  key: string;
  createdAt: string;
};

export const getApiKeysApi = (serviceId: string) =>
  api.get<{ data: ApiKey[] }>(`/services/${serviceId}/keys`);

export const createApiKeyApi = (serviceId: string, name: string) =>
  api.post<CreatedApiKey>(`/services/${serviceId}/keys`, { name });

export const revokeApiKeyApi = (serviceId: string, keyId: string) =>
  api.delete<{ id: string; revokedAt: string }>(
    `/services/${serviceId}/keys/${keyId}`,
  );
