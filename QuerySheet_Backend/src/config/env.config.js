import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("8080"),
  NODE_ENV: z.enum(["development", "production", "test"]),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z
    .string()
    .email("FIREBASE_CLIENT_EMAIL must be a valid email"),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1, "FIREBASE_PRIVATE_KEY is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GROQ_API_KEY: z.string().min(1).optional(),
  LLM_PRIMARY_PROVIDER: z.enum(["groq", "gemini"]).default("groq"),
  ALLOWED_ORIGINS: z
    .string()
    .min(1, "ALLOWED_ORIGINS is required")
    .refine((value) => {
      const origins = value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

      return (
        origins.length > 0 &&
        origins.every((origin) => {
          try {
            // Enforce URL format while allowing comma-separated values.
            new URL(origin);
            return true;
          } catch {
            return false;
          }
        })
      );
    }, "ALLOWED_ORIGINS must be a comma-separated list of valid URLs"),
  JWT_AUDIENCE: z.string().min(1, "JWT_AUDIENCE is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Environment validation failed. Fix the following variables:");

  parsedEnv.error.issues.forEach((issue) => {
    const variableName = issue.path[0] ?? "unknown";
    console.error(`- ${variableName}: ${issue.message}`);
  });

  process.exit(1);
}

parsedEnv.data.FIREBASE_PRIVATE_KEY = parsedEnv.data.FIREBASE_PRIVATE_KEY.replace(
  /\\n/g,
  "\n",
);

export default Object.freeze(parsedEnv.data);
