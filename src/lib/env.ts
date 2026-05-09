import { z } from "zod";

/**
 * Environment validation. Runs at module import time so a missing var
 * fails fast instead of producing 401-loops or undefined fetch URLs.
 *
 * NEXT_PUBLIC_* vars are inlined at build time by Next.js, so this validates
 * what the bundle was built with — not the runtime container.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url("NEXT_PUBLIC_API_URL must be a full URL (http://localhost:8080 or https://api.example.com)"),
  NEXT_PUBLIC_WS_URL: z
    .string()
    .regex(/^wss?:\/\//, "NEXT_PUBLIC_WS_URL must start with ws:// or wss://"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
});

if (!parsed.success) {
  // Build-time + first-import-time error. Throwing here is intentional —
  // catching this would mask configuration drift across environments.
  throw new Error(
    `Invalid environment variables:\n${parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")}`
  );
}

export const env = parsed.data;
