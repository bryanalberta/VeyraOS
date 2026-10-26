import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPublicEnv, getServerEnv, hasPublicSupabaseEnv } from "./env";

describe("Environment Configuration (src/lib/env.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone process.env before each test to isolate test cases
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getPublicEnv()", () => {
    it("successfully parses valid public environment variables with publishable key", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test_mock_publishable_key_12345";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      const config = getPublicEnv();
      expect(config.NEXT_PUBLIC_SUPABASE_URL).toBe("https://mock-project.supabase.co");
      expect(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("pk_test_mock_publishable_key_12345");
      expect(config.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    });

    it("falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY when publishable key is not set", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key_mock_fallback_67890";

      const config = getPublicEnv();
      expect(config.NEXT_PUBLIC_SUPABASE_URL).toBe("https://mock-project.supabase.co");
      expect(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon_key_mock_fallback_67890");
    });

    it("throws a descriptive error when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock_key";

      expect(() => getPublicEnv()).toThrow(
        /Invalid public environment variables: NEXT_PUBLIC_SUPABASE_URL/
      );
    });

    it("throws a descriptive error when NEXT_PUBLIC_SUPABASE_URL is not a valid URL", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "invalid-url-format";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock_key";

      expect(() => getPublicEnv()).toThrow(
        /NEXT_PUBLIC_SUPABASE_URL must be a valid URL/
      );
    });

    it("throws a descriptive error when publishable/anon key is missing", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => getPublicEnv()).toThrow(
        /Invalid public environment variables: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
      );
    });
  });

  describe("hasPublicSupabaseEnv()", () => {
    it("returns true when real-looking environment variables are set", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyzcompany.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_token_live";

      expect(hasPublicSupabaseEnv()).toBe(true);
    });

    it("returns false when variables contain template placeholders", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project-id.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "your-supabase-placeholder-key";

      expect(hasPublicSupabaseEnv()).toBe(false);
    });

    it("returns false when variables are absent", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(hasPublicSupabaseEnv()).toBe(false);
    });
  });

  describe("getServerEnv()", () => {
    it("successfully parses server variables when running in server context", () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "secret_service_role_key";

      const config = getServerEnv();
      expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe("secret_service_role_key");
    });

    it("throws a security violation if called in a browser environment", () => {
      // Mock window global to simulate browser runtime
      // @ts-expect-error Mocking window for testing
      global.window = {} as unknown as Window;

      expect(() => getServerEnv()).toThrow(
        /Attempted to access server-only environment variables in the browser/
      );

      // Clean up global.window
      // @ts-expect-error Clean up mock window
      delete global.window;
    });
  });
});
