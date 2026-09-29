import * as z from "zod";

// Mirrors the backend's rules (apps/api/src/auth/dto/password-rules.ts) so
// users see the problem while typing instead of after submitting.
export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be at most 72 characters" })
  .regex(/[a-z]/, { message: "Add a lowercase letter" })
  .regex(/[A-Z]/, { message: "Add an uppercase letter" })
  .regex(/[0-9]/, { message: "Add a number" })
  .regex(/[^A-Za-z0-9]/, { message: "Add a symbol" });
