import { z } from "zod";

/**
 * Public Environment Variables Schema
 * Available in both server and browser environments.
 * Must be prefixed with NEXT_PUBLIC_.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL is required")
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Server-Only Environment Variables Schema
 * Never exposed to browser bundles.
 */
export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Checks whether required public environment variables are present and non-empty.
 * Safe to call during build time or in demo mode without throwing errors.
 */
export function hasPublicSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  return Boolean(
    url &&
    key &&
    !url.includes("your-project-id") &&
    !key.includes("placeholder")
  );
}

/**
 * Retrieves and validates public environment variables.
 * Throws a clear and informative error message when required variables are missing
 * at the moment a database client or network integration actually requires them.
 */
export function getPublicEnv(): PublicEnv {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support both NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and legacy NEXT_PUBLIC_SUPABASE_ANON_KEY
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: rawUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: rawKey,
    NEXT_PUBLIC_APP_URL: rawAppUrl,
  });

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(
      `[VeyraOS Configuration Error] Invalid public environment variables: ${errorDetails}. ` +
      `Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are configured in .env.local.`
    );
  }

  return result.data;
}

/**
 * Retrieves and validates server-only environment variables.
 * Enforces a runtime check ensuring this function is NEVER executed in the browser context.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "[VeyraOS Security Violation] Attempted to access server-only environment variables in the browser."
    );
  }

  const result = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(
      `[VeyraOS Configuration Error] Invalid server environment variables: ${errorDetails}.`
    );
  }

  return result.data;
}
