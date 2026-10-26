import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @supabase/ssr module
const mockCreateBrowserClient = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}));

import { createClient } from "./client";

describe("Supabase Browser Client (src/lib/supabase/client.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreateBrowserClient.mockReset();
    mockCreateBrowserClient.mockReturnValue({ mock: "browser_client" });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("calls createBrowserClient with valid public credentials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";

    const client = createClient();
    expect(client).toBeDefined();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://mock-app.supabase.co",
      "pk_mock_test_token_123"
    );
  });

  it("throws descriptive configuration error when public env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => createClient()).toThrow(
      /\[VeyraOS Configuration Error\] Invalid public environment variables/
    );
    expect(mockCreateBrowserClient).not.toHaveBeenCalled();
  });

  it("never passes server-only secrets to createBrowserClient", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-app.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_mock_test_token_123";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super_secret_service_role_key";

    createClient();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://mock-app.supabase.co",
      "pk_mock_test_token_123"
    );
    expect(mockCreateBrowserClient).not.toHaveBeenCalledWith(
      expect.anything(),
      "super_secret_service_role_key"
    );
  });
});
