import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @supabase/ssr module
const mockCreateServerClient = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

import { createClient, isServerComponentCookieError } from "./server";
import type { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

describe("Supabase Server Client (src/lib/supabase/server.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreateServerClient.mockReset();
    mockCreateServerClient.mockReturnValue({ mock: "server_client" });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockCookieStore = (options?: {
    getAllReturn?: Array<{ name: string; value: string }>;
    setImplementation?: (name: string, value: string, options?: unknown) => void;
  }): CookieStore => ({
    getAll: vi.fn().mockReturnValue(options?.getAllReturn ?? [{ name: "sb-auth-token", value: "token123" }]),
    set: vi.fn().mockImplementation(options?.setImplementation ?? vi.fn()),
    get: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    size: 1,
    [Symbol.iterator]: vi.fn(),
  });

  describe("isServerComponentCookieError()", () => {
    it("returns true for canonical Next.js Server Component cookie error", () => {
      const canonicalError = new Error(
        "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options"
      );
      expect(isServerComponentCookieError(canonicalError)).toBe(true);
    });

    it("returns false for errors that merely contain the word 'cookie'", () => {
      expect(isServerComponentCookieError(new Error("Invalid cookie header value"))).toBe(false);
      expect(isServerComponentCookieError(new Error("cookieStore.set failed unexpectedly"))).toBe(false);
      expect(isServerComponentCookieError(new Error("Cookie database offline"))).toBe(false);
    });

    it("returns false for errors that merely contain 'Server Component'", () => {
      expect(isServerComponentCookieError(new Error("Server Component crashed"))).toBe(false);
      expect(isServerComponentCookieError(new Error("Timeout inside Server Component render"))).toBe(false);
    });

    it("returns false for non-Error values", () => {
      expect(isServerComponentCookieError("string error")).toBe(false);
      expect(isServerComponentCookieError(null)).toBe(false);
      expect(isServerComponentCookieError({ message: "Cookies can only be modified" })).toBe(false);
    });
  });

  describe("createClient() Cookie Adapter", () => {
    it("calls createServerClient with public URL and publishable key", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      const mockCookieStore = createMockCookieStore();

      const client = await createClient(mockCookieStore);
      expect(client).toBeDefined();
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        "https://mock-app.supabase.co",
        "pk_mock_test_token_123",
        expect.objectContaining({
          cookies: expect.any(Object),
        })
      );
    });

    it("throws descriptive error when required environment variables are missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const mockCookieStore = createMockCookieStore();

      await expect(createClient(mockCookieStore)).rejects.toThrow(
        /\[VeyraOS Configuration Error\] Invalid public environment variables/
      );
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    });

    it("reads cookies via cookieStore.getAll() correctly", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      let capturedCookieAdapter: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options: unknown }>) => void;
      } | null = null;

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        capturedCookieAdapter = options.cookies;
        return {};
      });

      const mockCookieStore = createMockCookieStore({
        getAllReturn: [{ name: "session-cookie", value: "abc" }],
      });

      await createClient(mockCookieStore);

      expect(capturedCookieAdapter).toBeDefined();
      const cookies = capturedCookieAdapter!.getAll();
      expect(cookies).toEqual([{ name: "session-cookie", value: "abc" }]);
      expect(mockCookieStore.getAll).toHaveBeenCalled();
    });

    it("sets cookies successfully in write-capable contexts (e.g. Server Actions)", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      let capturedCookieAdapter: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options: unknown }>) => void;
      } | null = null;

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        capturedCookieAdapter = options.cookies;
        return {};
      });

      const mockCookieStore = createMockCookieStore();

      await createClient(mockCookieStore);

      expect(() => {
        capturedCookieAdapter!.setAll([
          { name: "token", value: "val1", options: { path: "/" } },
        ]);
      }).not.toThrow();

      expect(mockCookieStore.set).toHaveBeenCalledWith("token", "val1", { path: "/" });
    });

    it("safely catches canonical Server Component cookie modification restriction without crashing", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      let capturedCookieAdapter: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options: unknown }>) => void;
      } | null = null;

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        capturedCookieAdapter = options.cookies;
        return {};
      });

      const mockCookieStore = createMockCookieStore({
        setImplementation: () => {
          throw new Error(
            "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options"
          );
        },
      });

      await createClient(mockCookieStore);

      expect(() => {
        capturedCookieAdapter!.setAll([
          { name: "token", value: "val1", options: { path: "/" } },
        ]);
      }).not.toThrow();
    });

    it("rethrows error when error message only contains the word 'cookie' without Server Component restriction", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      let capturedCookieAdapter: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options: unknown }>) => void;
      } | null = null;

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        capturedCookieAdapter = options.cookies;
        return {};
      });

      const mockCookieStore = createMockCookieStore({
        setImplementation: () => {
          throw new Error("Invalid cookie header formatting");
        },
      });

      await createClient(mockCookieStore);

      expect(() => {
        capturedCookieAdapter!.setAll([
          { name: "token", value: "val1", options: { path: "/" } },
        ]);
      }).toThrow("Invalid cookie header formatting");
    });

    it("rethrows error when error message only contains 'Server Component' without cookie restriction", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      let capturedCookieAdapter: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options: unknown }>) => void;
      } | null = null;

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        capturedCookieAdapter = options.cookies;
        return {};
      });

      const mockCookieStore = createMockCookieStore({
        setImplementation: () => {
          throw new Error("Server Component execution timed out");
        },
      });

      await createClient(mockCookieStore);

      expect(() => {
        capturedCookieAdapter!.setAll([
          { name: "token", value: "val1", options: { path: "/" } },
        ]);
      }).toThrow("Server Component execution timed out");
    });

    it("rethrows unexpected arbitrary non-cookie errors during setAll", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

      let capturedCookieAdapter: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options: unknown }>) => void;
      } | null = null;

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        capturedCookieAdapter = options.cookies;
        return {};
      });

      const mockCookieStore = createMockCookieStore({
        setImplementation: () => {
          throw new Error("Fatal: Out of Memory");
        },
      });

      await createClient(mockCookieStore);

      expect(() => {
        capturedCookieAdapter!.setAll([
          { name: "token", value: "val1", options: { path: "/" } },
        ]);
      }).toThrow("Fatal: Out of Memory");
    });
  });
});
