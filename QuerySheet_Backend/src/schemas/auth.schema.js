import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(128),
});

export const registerBodySchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(
      /^(?=.*[A-Z])(?=.*[0-9])/,
      "Password must contain at least one uppercase letter and one number",
    ),
  displayName: z.string().min(2).max(100).trim(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(64).max(64),
  newPassword: z.string().min(8).max(128),
});
