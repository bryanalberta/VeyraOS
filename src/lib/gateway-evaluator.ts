// ---------------------------------------------------------------------------
// 1. Safe Redirect Sanitization (Anti-Open-Redirect & Anti-Loop)
// ---------------------------------------------------------------------------

/**
 * Memvalidasi dan membersihkan parameter pengalihan (redirectTo).
 *
 * Aturan Keamanan:
 * - Hanya mengizinkan path relatif internal yang dimulai dengan satu karakter '/'
 * - Menolak URL eksternal dengan skema (http:, https:, javascript:, data:, dll.)
 * - Menolak protocol-relative URLs yang diawali '//' atau '/\'
 * - Menolak karakter escape backslash '\'
 * - Menolak pengalihan sirkular kembali ke '/', '/login', atau '/register'
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Wajib diawali '/' dan BUKAN '//' atau '/\'
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\")
  ) {
    return fallback;
  }

  // Tolak skema protokol (misal: "javascript:", "https:") atau backslash
  if (trimmed.includes(":") || trimmed.includes("\\")) {
    return fallback;
  }

  // Cegah redirect loop ke halaman autentikasi atau root
  if (
    trimmed === "/" ||
    trimmed === "/login" ||
    trimmed.startsWith("/login?") ||
    trimmed === "/register" ||
    trimmed.startsWith("/register?")
  ) {
    return fallback;
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// 2. Gateway Decision Engine (Deterministic Pure Function)
// ---------------------------------------------------------------------------

export type GatewayDecision =
  | { action: "REDIRECT"; destination: string }
  | { action: "RENDER_LANDING" };

export function evaluateGatewayRouting({
  isAuthenticated,
  hasBusiness,
  redirectTo,
}: {
  isAuthenticated: boolean;
  hasBusiness: boolean;
  redirectTo?: string | null;
}): GatewayDecision {
  // Pengunjung anonim -> tampilkan landing page publik
  if (!isAuthenticated) {
    return { action: "RENDER_LANDING" };
  }

  // Pengguna terautentikasi tetapi belum memiliki bisnis -> alur onboarding
  if (!hasBusiness) {
    return { action: "REDIRECT", destination: "/onboarding/create-business" };
  }

  // Pengguna terautentikasi dengan bisnis aktif -> dashboard atau tujuan aman
  const destination = getSafeRedirectUrl(redirectTo, "/dashboard");
  return { action: "REDIRECT", destination };
}

/**
 * Mendeteksi apakah error merupakan Next.js Server Redirect.
 */
export function isNextRedirectError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    if (
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string"
    ) {
      return (error as { digest: string }).digest.includes("NEXT_REDIRECT");
    }
    if (
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message: string }).message === "NEXT_REDIRECT";
    }
  }
  return false;
}
