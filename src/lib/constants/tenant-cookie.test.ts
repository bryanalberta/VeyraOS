import { describe, it, expect } from "vitest";
import {
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_OPTIONS,
} from "./tenant-cookie";

describe("Tenant Cookie Constants Suite (src/lib/constants/tenant-cookie.ts)", () => {
  it("mendefinisikan TENANT_COOKIE_NAME yang tepat dan konsisten", () => {
    expect(TENANT_COOKIE_NAME).toBe("veyra_active_business_id");
  });

  it("menerapkan konfigurasi cookie yang aman (HttpOnly, SameSite=Lax, Path=/)", () => {
    expect(TENANT_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(TENANT_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(TENANT_COOKIE_OPTIONS.path).toBe("/");
    expect(TENANT_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("memiliki flag secure yang sesuai dengan environment production", () => {
    const isProd = process.env.NODE_ENV === "production";
    expect(TENANT_COOKIE_OPTIONS.secure).toBe(isProd);
  });
});
