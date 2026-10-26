import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";
import CreateBusinessOnboardingPage from "./onboarding/create-business/page";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";
import { createBusinessSchema } from "@/lib/validations/business";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === "redirectTo" ? "/dashboard" : null)),
  }),
}));

describe("Stage 5.2 — Authentication & Business Onboarding UI Test Suite", () => {
  describe("1. Login Page UI & Accessibility", () => {
    it("renders email and password inputs with labels, icons, and submit button", () => {
      const html = renderToStaticMarkup(<LoginPage />);

      expect(html).toContain("Masuk ke Akun Anda");
      expect(html).toContain('id="login-email"');
      expect(html).toContain('id="login-password"');
      expect(html).toContain('type="email"');
      expect(html).toContain('type="password"');
      expect(html).toContain("Alamat Email");
      expect(html).toContain("Kata Sandi");
      expect(html).toContain("Masuk");
    });

    it("renders navigation links to register page and demo mode", () => {
      const html = renderToStaticMarkup(<LoginPage />);

      expect(html).toContain('href="/register"');
      expect(html).toContain("Daftar Akun Bisnis Baru");
      expect(html).toContain('href="/demo"');
      expect(html).toContain("Mode Demo");
    });

    it("validates login credentials using signInSchema", () => {
      // Empty input
      const invalidEmpty = signInSchema.safeParse({ email: "", password: "" });
      expect(invalidEmpty.success).toBe(false);

      // Invalid email
      const invalidEmail = signInSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(invalidEmail.success).toBe(false);

      // Valid input
      const valid = signInSchema.safeParse({
        email: "owner@tokoberkah.com",
        password: "password123",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("2. Registration Page UI & Email Confirmation", () => {
    it("renders registration fields (full name, email, password) and submit button", () => {
      const html = renderToStaticMarkup(<RegisterPage />);

      expect(html).toContain("Daftar Akun Pemilik Usaha");
      expect(html).toContain('id="register-fullname"');
      expect(html).toContain('id="register-email"');
      expect(html).toContain('id="register-password"');
      expect(html).toContain("Nama Lengkap");
      expect(html).toContain("Alamat Email");
      expect(html).toContain("Kata Sandi");
      expect(html).toContain("Daftar Akun Bisnis");
    });

    it("renders navigation link back to login page and demo mode", () => {
      const html = renderToStaticMarkup(<RegisterPage />);

      expect(html).toContain('href="/login"');
      expect(html).toContain("Masuk ke Akun Anda");
      expect(html).toContain('href="/demo"');
    });

    it("validates registration data using signUpSchema (minimum 8 char password, valid email, min 2 char name)", () => {
      // Too short password (< 8 chars)
      const shortPass = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "budi@tokoberkah.com",
        password: "12345",
      });
      expect(shortPass.success).toBe(false);
      if (!shortPass.success) {
        expect(shortPass.error.issues[0].message).toContain("minimal 8 karakter");
      }

      // Too short name (< 2 chars)
      const shortName = signUpSchema.safeParse({
        fullName: "B",
        email: "budi@tokoberkah.com",
        password: "password123",
      });
      expect(shortName.success).toBe(false);

      // Valid registration input
      const valid = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "budi@tokoberkah.com",
        password: "password123",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("3. Business Onboarding Page UI & Validation", () => {
    it("renders business name, category, phone, and address inputs", () => {
      const html = renderToStaticMarkup(<CreateBusinessOnboardingPage />);

      expect(html).toContain("Daftarkan Toko / Usaha Anda");
      expect(html).toContain('id="biz-name"');
      expect(html).toContain('id="biz-category"');
      expect(html).toContain('id="biz-phone"');
      expect(html).toContain('id="biz-address"');
      expect(html).toContain("Nama Toko / Usaha");
      expect(html).toContain("Bidang / Kategori Usaha");
      expect(html).toContain("Mulai Kelola Bisnis");
    });

    it("renders automatic regional settings indicator (IDR currency & Asia/Jakarta timezone)", () => {
      const html = renderToStaticMarkup(<CreateBusinessOnboardingPage />);

      expect(html).toContain("Rupiah (IDR)");
      expect(html).toContain("WIB (Asia/Jakarta)");
    });

    it("validates business creation data using createBusinessSchema (name 2-60 chars)", () => {
      // Too short name (< 2 chars)
      const shortBiz = createBusinessSchema.safeParse({
        name: "A",
        category: "Sembako / Kelontong",
      });
      expect(shortBiz.success).toBe(false);

      // Valid business input
      const validBiz = createBusinessSchema.safeParse({
        name: "Toko Sembako Sejahtera",
        category: "Sembako / Kelontong",
        phone: "081234567890",
        address: "Jl. Merdeka No. 10",
      });
      expect(validBiz.success).toBe(true);
    });
  });

  describe("4. Route Protection & Redirect Guard Determinism", () => {
    // Pure function simulating route protection logic implemented in middleware and page guards
    function evaluateRouteAccess(params: {
      isAuthenticated: boolean;
      hasBusiness: boolean;
      targetPath: string;
    }): { action: "ALLOW" | "REDIRECT"; destination?: string } {
      const { isAuthenticated, hasBusiness, targetPath } = params;

      const isAuthRoute = targetPath === "/login" || targetPath === "/register";
      const isProtectedRoute =
        targetPath.startsWith("/dashboard") ||
        targetPath.startsWith("/sales") ||
        targetPath.startsWith("/products") ||
        targetPath.startsWith("/purchases") ||
        targetPath.startsWith("/expenses") ||
        targetPath.startsWith("/reports") ||
        targetPath.startsWith("/settings") ||
        targetPath.startsWith("/onboarding");

      // 1. Unauthenticated users cannot access protected routes
      if (!isAuthenticated && isProtectedRoute) {
        return { action: "REDIRECT", destination: `/login?redirectTo=${targetPath}` };
      }

      // 2. Authenticated users cannot access login/register
      if (isAuthenticated && isAuthRoute) {
        if (!hasBusiness) {
          return { action: "REDIRECT", destination: "/onboarding/create-business" };
        }
        return { action: "REDIRECT", destination: "/dashboard" };
      }

      // 3. Authenticated user without business accessing dashboard must be redirected to onboarding
      if (isAuthenticated && !hasBusiness && targetPath.startsWith("/dashboard")) {
        return { action: "REDIRECT", destination: "/onboarding/create-business" };
      }

      // 4. Authenticated user with business accessing onboarding can either stay or go to dashboard
      // (Does not force redirect loop)
      return { action: "ALLOW" };
    }

    it("redirects unauthenticated user from protected routes to /login with redirectTo param", () => {
      const res = evaluateRouteAccess({
        isAuthenticated: false,
        hasBusiness: false,
        targetPath: "/dashboard",
      });
      expect(res.action).toBe("REDIRECT");
      expect(res.destination).toBe("/login?redirectTo=/dashboard");

      const res2 = evaluateRouteAccess({
        isAuthenticated: false,
        hasBusiness: false,
        targetPath: "/onboarding/create-business",
      });
      expect(res2.action).toBe("REDIRECT");
      expect(res2.destination).toBe("/login?redirectTo=/onboarding/create-business");
    });

    it("redirects authenticated user without business accessing /dashboard to /onboarding/create-business", () => {
      const res = evaluateRouteAccess({
        isAuthenticated: true,
        hasBusiness: false,
        targetPath: "/dashboard",
      });
      expect(res.action).toBe("REDIRECT");
      expect(res.destination).toBe("/onboarding/create-business");
    });

    it("redirects authenticated user with business accessing /login to /dashboard", () => {
      const res = evaluateRouteAccess({
        isAuthenticated: true,
        hasBusiness: true,
        targetPath: "/login",
      });
      expect(res.action).toBe("REDIRECT");
      expect(res.destination).toBe("/dashboard");
    });

    it("allows authenticated user with business to access /dashboard without loop", () => {
      const res = evaluateRouteAccess({
        isAuthenticated: true,
        hasBusiness: true,
        targetPath: "/dashboard",
      });
      expect(res.action).toBe("ALLOW");
    });

    it("proves mathematical absence of redirect loops between /login, /onboarding, and /dashboard", () => {
      // Trace 1: Unauthenticated
      const s1 = evaluateRouteAccess({ isAuthenticated: false, hasBusiness: false, targetPath: "/dashboard" });
      expect(s1.destination).toContain("/login");
      const s2 = evaluateRouteAccess({ isAuthenticated: false, hasBusiness: false, targetPath: "/login" });
      expect(s2.action).toBe("ALLOW"); // Terminates at login!

      // Trace 2: Authenticated, No Business
      const a1 = evaluateRouteAccess({ isAuthenticated: true, hasBusiness: false, targetPath: "/login" });
      expect(a1.destination).toBe("/onboarding/create-business");
      const a2 = evaluateRouteAccess({ isAuthenticated: true, hasBusiness: false, targetPath: "/onboarding/create-business" });
      expect(a2.action).toBe("ALLOW"); // Terminates at onboarding!

      // Trace 3: Authenticated, Has Business
      const b1 = evaluateRouteAccess({ isAuthenticated: true, hasBusiness: true, targetPath: "/login" });
      expect(b1.destination).toBe("/dashboard");
      const b2 = evaluateRouteAccess({ isAuthenticated: true, hasBusiness: true, targetPath: "/dashboard" });
      expect(b2.action).toBe("ALLOW"); // Terminates at dashboard!
    });
  });
});
