import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";
import { LandingPageView } from "./landing-page-view";
import { AuthGatewayEvaluator } from "./auth-gateway-evaluator";
import {
  getSafeRedirectUrl,
  evaluateGatewayRouting,
  isNextRedirectError,
} from "@/lib/gateway-evaluator";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    const err = new Error("NEXT_REDIRECT");
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

// ---------------------------------------------------------------------------
// Mock Supabase Server Client & Env
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();
const mockResolveTenantContext = vi.fn();
let mockHasEnv = true;

vi.mock("@/lib/env", () => ({
  hasPublicSupabaseEnv: () => mockHasEnv,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/services/business/business.service", () => ({
  resolveTenantContext: (...args: unknown[]) => mockResolveTenantContext(...args),
}));

describe("VeyraOS Stage 5.7 - Landing Gateway & Root Routing Suite (/)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasEnv = true;
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockResolveTenantContext.mockResolvedValue({
      success: true,
      data: { hasBusiness: false, activeBusiness: null, role: null },
    });
  });

  // =========================================================================
  // 1. Safe Redirect Sanitization (Anti-Open-Redirect & Anti-Loop)
  // =========================================================================
  describe("getSafeRedirectUrl", () => {
    it("returns default fallback '/dashboard' when target is null, undefined, or empty", () => {
      expect(getSafeRedirectUrl(null)).toBe("/dashboard");
      expect(getSafeRedirectUrl(undefined)).toBe("/dashboard");
      expect(getSafeRedirectUrl("")).toBe("/dashboard");
      expect(getSafeRedirectUrl("   ")).toBe("/dashboard");
    });

    it("respects custom fallback path when provided", () => {
      expect(getSafeRedirectUrl(null, "/custom-fallback")).toBe("/custom-fallback");
    });

    it("rejects URLs not starting with leading slash '/'", () => {
      expect(getSafeRedirectUrl("dashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("sales/new")).toBe("/dashboard");
    });

    it("rejects protocol-relative URLs (// and /\\) to prevent open redirect vulnerabilities", () => {
      expect(getSafeRedirectUrl("//evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("//evil.com/phishing")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/\\evil.com")).toBe("/dashboard");
    });

    it("rejects scheme payloads containing colon or backslash", () => {
      expect(getSafeRedirectUrl("/javascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/https://attacker.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/path\\with\\backslash")).toBe("/dashboard");
    });

    it("prevents redirect loops back to root or authentication routes", () => {
      expect(getSafeRedirectUrl("/")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/login")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/login?redirectTo=/sales")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/register")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/register?plan=pro")).toBe("/dashboard");
    });

    it("accepts valid and safe internal application paths", () => {
      expect(getSafeRedirectUrl("/sales")).toBe("/sales");
      expect(getSafeRedirectUrl("/sales/new")).toBe("/sales/new");
      expect(getSafeRedirectUrl("/products?category=sembako")).toBe("/products?category=sembako");
      expect(getSafeRedirectUrl("/reports")).toBe("/reports");
      expect(getSafeRedirectUrl("/expenses")).toBe("/expenses");
      expect(getSafeRedirectUrl("/settings")).toBe("/settings");
    });
  });

  // =========================================================================
  // 2. Gateway Decision Engine
  // =========================================================================
  describe("evaluateGatewayRouting", () => {
    it("renders landing page for anonymous unauthenticated visitors", () => {
      const decision = evaluateGatewayRouting({
        isAuthenticated: false,
        hasBusiness: false,
      });
      expect(decision).toEqual({ action: "RENDER_LANDING" });
    });

    it("redirects authenticated users without a business to onboarding", () => {
      const decision = evaluateGatewayRouting({
        isAuthenticated: true,
        hasBusiness: false,
      });
      expect(decision).toEqual({
        action: "REDIRECT",
        destination: "/onboarding/create-business",
      });
    });

    it("redirects authenticated users with active business to /dashboard by default", () => {
      const decision = evaluateGatewayRouting({
        isAuthenticated: true,
        hasBusiness: true,
      });
      expect(decision).toEqual({
        action: "REDIRECT",
        destination: "/dashboard",
      });
    });

    it("redirects authenticated users to sanitized redirectTo destination if provided", () => {
      const decision = evaluateGatewayRouting({
        isAuthenticated: true,
        hasBusiness: true,
        redirectTo: "/sales/new",
      });
      expect(decision).toEqual({
        action: "REDIRECT",
        destination: "/sales/new",
      });
    });

    it("sanitizes malicious redirectTo target before making redirect decision", () => {
      const decision = evaluateGatewayRouting({
        isAuthenticated: true,
        hasBusiness: true,
        redirectTo: "//attacker.com/malicious",
      });
      expect(decision).toEqual({
        action: "REDIRECT",
        destination: "/dashboard",
      });
    });
  });

  // =========================================================================
  // 3. Next.js Redirect Detection Helper
  // =========================================================================
  describe("isNextRedirectError", () => {
    it("identifies Next.js redirect errors by digest string", () => {
      const err = { digest: "NEXT_REDIRECT;replace;/dashboard;307;" };
      expect(isNextRedirectError(err)).toBe(true);
    });

    it("identifies Next.js redirect errors by message", () => {
      const err = new Error("NEXT_REDIRECT");
      expect(isNextRedirectError(err)).toBe(true);
    });

    it("returns false for standard application errors", () => {
      expect(isNextRedirectError(new Error("Database connection failed"))).toBe(false);
      expect(isNextRedirectError(new Error("UNAUTHENTICATED"))).toBe(false);
    });

    it("handles primitives and null safely without throwing", () => {
      expect(isNextRedirectError(null)).toBe(false);
      expect(isNextRedirectError(undefined)).toBe(false);
      expect(isNextRedirectError("random string")).toBe(false);
      expect(isNextRedirectError(12345)).toBe(false);
      expect(isNextRedirectError({})).toBe(false);
    });
  });

  // =========================================================================
  // 4. Landing Page View Rendering & Content Integrity
  // =========================================================================
  describe("LandingPageView Component", () => {
    it("renders VeyraOS brand identity and official tagline", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).toContain("VeyraOS");
      expect(html).toContain("Run your business.");
      expect(html).toContain("Know your numbers.");
      expect(html).toContain("Sistem Operasi Bisnis UMKM Indonesia");
      expect(html).toContain("Business &amp; Finance Engine");
      expect(html).toContain("<svg");
      expect(html).toContain("#5B3CC4");
      expect(html).toContain("#392477");
    });

    it("renders high-contrast, accessible secondary CTA 'Masuk ke Toko Anda' linking to /login", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).toContain("Masuk ke Toko Anda");
      expect(html).toContain('href="/login"');
      // Verifikasi kelas kontras eksplisit agar teks selalu terbaca di atas dark background
      expect(html).toContain("bg-white/10");
      expect(html).toContain("text-white");
      expect(html).toContain("border-white/60");
    });

    it("renders clear authentication call to action buttons to /login and /register", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).toContain('href="/login"');
      expect(html).toContain('href="/register"');
      expect(html).toContain("Masuk");
      expect(html).toContain("Daftar Bisnis");
      expect(html).toContain("Mulai Kelola Toko Gratis");
    });

    it("renders all 4 operational feature pillars", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).toContain("Kasir Penjualan Kilat (POS)");
      expect(html).toContain("Stok &amp; HPP Bergerak (MWAC)");
      expect(html).toContain("Buku Beban Operasional");
      expect(html).toContain("Dashboard &amp; Laba Bersih");
    });

    it("renders architecture & financial trust highlights (BIGINT, RLS, WIB)", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).toContain("100% Integer Math (BIGINT)");
      expect(html).toContain("Isolasi Multi-Tenant RLS");
      expect(html).toContain("Waktu Indonesia (WIB)");
      expect(html).toContain("Kalkulasi Moneter Integer");
      expect(html).toContain("Isolasi Multi-Tenant Berlapis");
    });

    it("renders transparent and factual Demo Mode notice box", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).toContain("Informasi Akses Mode Demo Terisolasi");
      expect(html).toContain("Toko Sembako Sejahtera");
    });

    it("verifies legacy scaffold text 'Phase 4 Stage 1 Scaffold Ready' is completely removed", () => {
      const html = renderToStaticMarkup(<LandingPageView />);
      expect(html).not.toContain("Phase 4 Stage 1 Scaffold Ready");
      expect(html).not.toContain("Fondasi Arsitektur Siap");
    });
  });

  // =========================================================================
  // 5. AuthGatewayEvaluator (Server Component Runtime Gateway)
  // =========================================================================
  describe("AuthGatewayEvaluator Component", () => {
    it("returns null when Supabase environment variables are missing", async () => {
      mockHasEnv = false;
      const res = await AuthGatewayEvaluator({});
      expect(res).toBeNull();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("returns null when user is not authenticated (anonymous visitor)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await AuthGatewayEvaluator({});
      expect(res).toBeNull();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects authenticated user without active business to /onboarding/create-business", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "user@toko.com" } },
        error: null,
      });
      mockResolveTenantContext.mockResolvedValue({
        success: true,
        data: { hasBusiness: false, activeBusiness: null, role: null },
      });

      await expect(AuthGatewayEvaluator({})).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/onboarding/create-business");
    });

    it("redirects authenticated user with active business to /dashboard by default", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "user@toko.com" } },
        error: null,
      });
      mockResolveTenantContext.mockResolvedValue({
        success: true,
        data: {
          hasBusiness: true,
          activeBusiness: { id: "biz-123", name: "Toko Berkah" },
          role: "OWNER",
        },
      });

      await expect(AuthGatewayEvaluator({})).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects authenticated user to safe redirectTo path when query param is present", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "user@toko.com" } },
        error: null,
      });
      mockResolveTenantContext.mockResolvedValue({
        success: true,
        data: {
          hasBusiness: true,
          activeBusiness: { id: "biz-123", name: "Toko Berkah" },
          role: "OWNER",
        },
      });

      const searchParamsPromise = Promise.resolve({ redirectTo: "/sales/new" });
      await expect(
        AuthGatewayEvaluator({ searchParams: searchParamsPromise })
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/sales/new");
    });

    it("re-throws NEXT_REDIRECT exceptions without swallowing them", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });
      mockResolveTenantContext.mockResolvedValue({
        success: true,
        data: {
          hasBusiness: true,
          activeBusiness: { id: "biz-123" },
        },
      });

      let caughtError: unknown;
      try {
        await AuthGatewayEvaluator({});
      } catch (err) {
        caughtError = err;
      }

      expect(isNextRedirectError(caughtError)).toBe(true);
    });

    it("fails open gracefully and returns null on unexpected database/network errors", async () => {
      mockGetUser.mockRejectedValue(new Error("Supabase auth service unreachable"));
      const res = await AuthGatewayEvaluator({});
      expect(res).toBeNull();
    });
  });

  // =========================================================================
  // 6. Home Root Component
  // =========================================================================
  describe("Home Default Export Component", () => {
    it("renders landing page markup within React tree", () => {
      const html = renderToStaticMarkup(<Home />);
      expect(html).toContain("VeyraOS");
      expect(html).toContain("Run your business.");
      expect(html).toContain("Know your numbers.");
    });
  });
});
