import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/**
 * Detects whether an error specifically originates from the Next.js App Router
 * Server Component read-only cookie restriction (`ReadonlyRequestCookiesError`).
 *
 * Next.js throws an Error with the canonical message:
 * "Cookies can only be modified in a Server Action or Route Handler. Read more: ..."
 *
 * We deliberately do NOT perform broad substring matching (e.g., matching the word "cookie"
 * or "Server Component" in isolation) to ensure unrelated cookie store errors, database failures,
 * or unexpected runtime exceptions are never silently swallowed.
 */
export function isServerComponentCookieError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(
    "Cookies can only be modified in a Server Action or Route Handler"
  );
}

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers.
 *
 * Security & Architecture:
 * - Next.js 16 Asynchronous Cookie API: Uses `await cookies()`.
 * - Security: Uses strictly public project URL and publishable key with authenticated user session cookies.
 * - Least Privilege: Never uses service_role key or bypasses RLS.
 * - Server Component Safe: Gracefully catches ONLY the canonical Next.js Server Component
 *   read-only cookie modification error without suppressing unrelated exceptions.
 */
export async function createClient(
  customCookieStore?: Awaited<ReturnType<typeof cookies>>
) {
  const cookieStore = customCookieStore ?? (await cookies());
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // In Next.js Server Components, cookies cannot be mutated.
            // Supabase SSR calls setAll when refreshing session tokens during getClaims or getUser.
            // If the error is specifically the canonical Server Component read-only restriction,
            // we safely ignore it as session cookies are refreshed in write-capable contexts.
            if (isServerComponentCookieError(error)) {
              return;
            }

            // Rethrow any unexpected errors that are not the Next.js Server Component restriction
            throw error;
          }
        },
      },
    }
  );
}
