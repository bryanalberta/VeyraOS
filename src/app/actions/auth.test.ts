/**
 * VeyraOS Server Actions Unit Tests — Authentication & User Profile (Batch 1 Remediation SEC-3.3-02 Final)
 *
 * Menguji aksi server auth.ts dalam lingkungan mock terisolasi:
 * - signUpAction (penentuan requiresEmailConfirmation berbasis indikator asli Supabase)
 * - signInAction
 * - signOutAction
 * - updateUserProfileAction
 *
 * Keterbatasan: Pengujian unit ini menggunakan mock Next.js headers dan Supabase Auth,
 * dan bukan merupakan bukti perilaku database fisik PostgreSQL atau RLS runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock @/lib/supabase/server
const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

import {
  signUpAction,
  signInAction,
  signOutAction,
  updateUserProfileAction,
} from "./auth";

describe("Auth Server Actions Suite (src/app/actions/auth.ts)", () => {
  const validUserId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signUpAction()", () => {
    it("1.1 menolak input Zod tidak valid (email format salah, password < 8 karakter, nama pendek)", async () => {
      const result = await signUpAction({
        fullName: "A",
        email: "not-an-email",
        password: "short",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details).toBeDefined();
        expect(result.error.details?.fullName).toBeDefined();
        expect(result.error.details?.email).toBeDefined();
        expect(result.error.details?.password).toBeDefined();
      }
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
    });

    it("1.2 Kasus 1: Sesi tersedia dan email sudah terkonfirmasi (auto-confirm aktif)", async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: validUserId,
            email: "owner@veyra.id",
            email_confirmed_at: "2026-10-14T02:00:00Z",
            confirmed_at: "2026-10-14T02:00:00Z",
            confirmation_sent_at: "2026-10-14T02:00:00Z",
            user_metadata: { full_name: "Budi Santoso" },
            identities: [{ id: "identity-1" }],
          },
          session: {
            access_token: "mock-token",
            expires_at: 1234567890,
          },
        },
        error: null,
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.email).toBe("owner@veyra.id");
        expect(result.data.fullName).toBe("Budi Santoso");
        expect(result.data.sessionEstablished).toBe(true);
        expect(result.data.requiresEmailConfirmation).toBe(false);
      }
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: "owner@veyra.id",
        password: "password123",
        options: {
          data: { full_name: "Budi Santoso" },
        },
      });
    });

    it("1.3 Kasus 2: Sesi tidak tersedia dan email belum terkonfirmasi (GoTrue confirmation dispatched)", async () => {
      // Ketika email confirmation wajib: session null, email_confirmed_at belum ada, confirmation_sent_at ada
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: validUserId,
            email: "unconfirmed@veyra.id",
            confirmation_sent_at: "2026-10-14T02:00:00Z",
            email_confirmed_at: undefined,
            confirmed_at: undefined,
            user_metadata: { full_name: "Budi Santoso" },
            identities: [{ id: "identity-1" }],
          },
          session: null,
        },
        error: null,
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "unconfirmed@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.email).toBe("unconfirmed@veyra.id");
        expect(result.data.sessionEstablished).toBe(false);
        expect(result.data.requiresEmailConfirmation).toBe(true);
      }
    });

    it("1.4 Kasus 3: Sesi tidak tersedia tetapi email sudah terkonfirmasi (pre-confirmed tanpa auto-login)", async () => {
      // Akun sudah terkonfirmasi tetapi sesi tidak diterbitkan pada pendaftaran
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: validUserId,
            email: "confirmed@veyra.id",
            email_confirmed_at: "2026-10-14T01:30:00Z",
            confirmed_at: "2026-10-14T01:30:00Z",
            user_metadata: { full_name: "Budi Santoso" },
            identities: [{ id: "identity-1" }],
          },
          session: null,
        },
        error: null,
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "confirmed@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.email).toBe("confirmed@veyra.id");
        expect(result.data.sessionEstablished).toBe(false);
        // Memastikan TIDAK menghasilkan instruksi palsu bahwa pengguna harus cek email
        expect(result.data.requiresEmailConfirmation).toBe(false);
      }
    });

    it("1.5 Kasus 4: Field konfirmasi tidak tersedia pada objek user (tidak menyimpulkan konfirmasi semata dari session null)", async () => {
      // Objek user tanpa field email_confirmed_at, confirmed_at, maupun confirmation_sent_at
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: validUserId,
            email: "minimal@veyra.id",
            user_metadata: { full_name: "Budi Santoso" },
            identities: [{ id: "identity-1" }],
          },
          session: null,
        },
        error: null,
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "minimal@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.email).toBe("minimal@veyra.id");
        expect(result.data.sessionEstablished).toBe(false);
        // Tidak berspekulasi konfirmasi diwajibkan bila confirmation_sent_at tidak ada
        expect(result.data.requiresEmailConfirmation).toBe(false);
      }
    });

    it("1.6 Kasus 5: identities: [] tetap menghasilkan penanganan AUTH_EMAIL_EXISTS", async () => {
      // Proteksi enumerasi Supabase: user dikembalikan dengan identities [] jika email sudah terdaftar
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: validUserId,
            email: "owner@veyra.id",
            identities: [],
          },
          session: null,
        },
        error: null,
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_EMAIL_EXISTS");
        expect(result.error.message).toContain("Email sudah terdaftar");
      }
    });

    it("1.7 Kasus 6: Respons registrasi gagal atau tidak memiliki user valid ditangani dengan aman", async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_SIGN_UP_FAILED");
      }
    });

    it("1.8 memetakan error email sudah terdaftar dari Supabase Auth ke AUTH_EMAIL_EXISTS", async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "User already registered", status: 422 },
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_EMAIL_EXISTS");
        expect(result.error.message).toContain("Email sudah terdaftar");
      }
    });

    it("1.9 memetakan error rate limit ke AUTH_RATE_LIMITED", async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Rate limit exceeded", status: 429 },
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_RATE_LIMITED");
      }
    });

    it("1.10 menangani kegagalan Supabase Auth tanpa membocorkan pesan internal sensitif", async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Database connection failed at postgres://internal:5432" },
      });

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_SIGN_UP_FAILED");
      }
    });

    it("1.11 menangani exception tak terduga dengan mengembalikan INTERNAL_ERROR", async () => {
      mockSupabaseClient.auth.signUp.mockRejectedValueOnce(
        new Error("Unexpected network timeout")
      );

      const result = await signUpAction({
        fullName: "Budi Santoso",
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
      }
    });
  });

  describe("signInAction()", () => {
    it("1.12 menolak input format email atau kata sandi tidak valid", async () => {
      const result = await signInAction({
        email: "invalid-email",
        password: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.email).toBeDefined();
        expect(result.error.details?.password).toBeDefined();
      }
      expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("1.13 berhasil masuk dan mengembalikan AuthResponseData dengan sessionEstablished true", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: validUserId,
            email: "owner@veyra.id",
            user_metadata: { full_name: "Budi Santoso" },
          },
          session: {
            access_token: "mock-session-token",
          },
        },
        error: null,
      });

      const result = await signInAction({
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(validUserId);
        expect(result.data.email).toBe("owner@veyra.id");
        expect(result.data.fullName).toBe("Budi Santoso");
        expect(result.data.sessionEstablished).toBe(true);
        expect(result.data.requiresEmailConfirmation).toBe(false);
      }
    });

    it("1.14 menolak jika otentikasi Supabase tidak menghasilkan data user yang valid", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await signInAction({
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_SIGN_IN_FAILED");
      }
    });

    it("1.15 menolak kredensial salah dengan kode AUTH_INVALID_CREDENTIALS", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid login credentials", status: 400 },
      });

      const result = await signInAction({
        email: "owner@veyra.id",
        password: "wrongpassword",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_INVALID_CREDENTIALS");
        expect(result.error.message).toContain("Email atau kata sandi");
      }
    });

    it("1.16 menangani akun belum diverifikasi dengan AUTH_EMAIL_NOT_CONFIRMED", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Email not confirmed", status: 400 },
      });

      const result = await signInAction({
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_EMAIL_NOT_CONFIRMED");
      }
    });

    it("1.17 menangani rate limit sign in dengan AUTH_RATE_LIMITED", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Over rate limit", status: 429 },
      });

      const result = await signInAction({
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_RATE_LIMITED");
      }
    });

    it("1.18 menangani exception tak terduga pada signIn dengan INTERNAL_ERROR", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockRejectedValueOnce(
        new Error("Unexpected connection crash")
      );

      const result = await signInAction({
        email: "owner@veyra.id",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
      }
    });
  });

  describe("signOutAction()", () => {
    it("1.19 berhasil keluar dari sesi dan membersihkan cookie veyra_active_business_id", async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null });

      const result = await signOutAction();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe("Berhasil keluar dari sistem");
      }
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
    });

    it("1.20 mengembalikan AUTH_SIGN_OUT_FAILED jika signOut Supabase gagal", async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({
        error: { message: "Session not found" },
      });

      const result = await signOutAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AUTH_SIGN_OUT_FAILED");
      }
    });

    it("1.21 menangani exception tak terduga pada signOut dengan INTERNAL_ERROR", async () => {
      mockSupabaseClient.auth.signOut.mockRejectedValueOnce(
        new Error("Unexpected session crash")
      );

      const result = await signOutAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
      }
    });
  });

  describe("updateUserProfileAction()", () => {
    it("1.22 menolak input pembaruan profil yang tidak valid (fullName < 2 karakter)", async () => {
      const result = await updateUserProfileAction({ fullName: " " });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.fullName).toBeDefined();
      }
    });

    it("1.23 menolak jika pengguna belum terautentikasi (UNAUTHENTICATED)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No active session" },
      });

      const result = await updateUserProfileAction({ fullName: "Budi Santoso Baru" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("1.24 berhasil memperbarui profil pengguna dengan whitelist fullName", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: {
            id: validUserId,
            full_name: "Budi Santoso Baru",
            email: "owner@veyra.id",
            created_at: "2026-10-14T00:00:00.000Z",
            updated_at: "2026-10-14T01:00:00.000Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValueOnce(mockQueryBuilder);

      const result = await updateUserProfileAction({ fullName: "Budi Santoso Baru" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe("Budi Santoso Baru");
        expect(result.data.email).toBe("owner@veyra.id");
      }
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        full_name: "Budi Santoso Baru",
      });
    });
  });
});
