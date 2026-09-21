import { isAxiosError } from "axios";

// Pulls a readable message out of an API error. NestJS sends `message` as a
// string for most errors but as a string[] for validation failures, so both
// shapes are handled; anything unexpected falls back to the given default.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
