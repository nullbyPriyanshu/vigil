import api from "./axios";

export type Profile = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  // false = don't email me when an incident pages me.
  emailNotifications: boolean;
  createdAt: string;
};

export const getProfileApi = () => api.get<Profile>("/user/profile");

export const updateProfileApi = (data: {
  name?: string;
  timezone?: string;
  emailNotifications?: boolean;
}) =>
  api.patch<Profile>("/user/profile", data);

export const changePasswordApi = (data: {
  currentPassword: string;
  newPassword: string;
}) => api.patch<{ message: string }>("/user/profile/update-password", data);
