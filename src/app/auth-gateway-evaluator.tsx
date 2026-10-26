import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantContext } from "@/services/business/business.service";
import { hasPublicSupabaseEnv } from "@/lib/env";
import {
  evaluateGatewayRouting,
  isNextRedirectError,
} from "@/lib/gateway-evaluator";

/**
 * Komponen asinkron internal yang mengevaluasi sesi Supabase terautentikasi.
 * Dijalankan di dalam boundary <React.Suspense> agar pembacaan runtime data
 * (cookies() dan searchParams) tidak memblokir prerendering statis landing page
 * pada arsitektur Next.js 16 (Cache Components & Partial Prerendering).
 */
export async function AuthGatewayEvaluator({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (hasPublicSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const tenantRes = await resolveTenantContext(undefined, {
          supabase,
          userId: user.id,
        });

        // Resolve searchParams secara aman
        const resolvedSearchParams = searchParams
          ? await searchParams
          : undefined;

        const rawRedirectTo =
          typeof resolvedSearchParams?.redirectTo === "string"
            ? resolvedSearchParams.redirectTo
            : undefined;

        const hasActiveBiz = Boolean(
          tenantRes.success &&
            tenantRes.data.hasBusiness &&
            tenantRes.data.activeBusiness
        );

        const decision = evaluateGatewayRouting({
          isAuthenticated: true,
          hasBusiness: hasActiveBiz,
          redirectTo: rawRedirectTo,
        });

        if (decision.action === "REDIRECT") {
          redirect(decision.destination);
        }
      }
    } catch (error) {
      // Re-throw Next.js internal redirect exceptions
      if (isNextRedirectError(error)) {
        throw error;
      }
      // Untuk error konektivitas atau sesi tak terduga, fail open tanpa mengganggu landing page
    }
  }

  return null;
}
