import { isAxiosError } from "axios";


export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
