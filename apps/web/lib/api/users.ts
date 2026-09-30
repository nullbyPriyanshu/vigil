import api from "./axios";

export type Profile = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  createdAt: string;
};

export const getProfileApi = () => api.get<Profile>("/users/me");

export const updateProfileApi = (data: { name?: string; timezone?: string }) =>
  api.patch<Profile>("/users/me", data);

export const changePasswordApi = (data: {
  currentPassword: string;
  newPassword: string;
}) => api.patch<{ message: string }>("/users/me/password", data);
