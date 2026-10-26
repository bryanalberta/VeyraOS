/**
 * VeyraOS Business Profile & Tenant Context Service Unit Tests
 *
 * Sesuai kriteria Substage 3.2.2C:
 * - Pengujian unit menggunakan Mock Supabase Client terisolasi (Mock-Only Unit Tests).
 * - Tidak menyatakan mock sebagai bukti RLS runtime, transaksi atomik, atau konkurensi PostgreSQL.
 * - Menguji 7 operasi: getUserProfile, updateUserProfile, createBusiness, getMyBusinesses,
 *   getBusinessById, updateBusiness, resolveTenantContext.
 * - Menguji otorisasi, isolasi multi-tenant, whitelist proteksi field sistem, anti-silent-fallback,
 *   resolusi deterministik, kuota batas 5 bisnis, dan error mapping.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getUserProfile,
  updateUserProfile,
  createBusiness,
  getMyBusinesses,
  getBusinessById,
  updateBusiness,
  resolveTenantContext,
} from "./business.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateBusinessInput,
  UpdateBusinessInput,
  UpdateProfileInput,
} from "@/types/api";

describe("Business Profile & Tenant Context Service Suite (src/services/business)", () => {
  const validUserId = "11111111-1111-4111-a111-111111111111";
  const otherUserId = "22222222-2222-4222-a222-222222222222";
  const validBusinessId = "33333333-3333-4333-a333-333333333333";
  const secondBusinessId = "44444444-4444-4444-a444-444444444444";
  const unauthorizedBizId = "99999999-9999-4999-a999-999999999999";

  let mockSupabase: SupabaseClient;
  let mockAuth: { getUser: ReturnType<typeof vi.fn> };
  let mockFrom: ReturnType<typeof vi.fn>;

  // Spies untuk menginspeksi payload SQL dan pemanggilan query
  let profileSelectSpy: ReturnType<typeof vi.fn>;
  let profileUpdateSpy: ReturnType<typeof vi.fn>;
  let businessSelectSpy: ReturnType<typeof vi.fn>;
  let businessInsertSpy: ReturnType<typeof vi.fn>;
  let businessUpdateSpy: ReturnType<typeof vi.fn>;
  let memberSelectSpy: ReturnType<typeof vi.fn>;

  // Variabel state kontrol respons mock
  let profileQueryResult: { data: unknown; error: unknown };
  let businessCountResult: { count: number | null; error: unknown };
  let businessSingleResult: { data: unknown; error: unknown };
  let businessUpdateResult: { data: unknown; error: unknown };
  let businessListResult: { data: unknown; error: unknown };
  let memberSingleResult: { data: unknown; error: unknown };
  let memberListResult: { data: unknown; error: unknown };

  const sampleProfileRow = {
    id: validUserId,
    full_name: "Budi Santoso",
    email: "budi@veyraos.com",
    created_at: "2026-10-10T10:00:00Z",
    updated_at: "2026-10-10T10:00:00Z",
  };

  const sampleBusinessRow1 = {
    id: validBusinessId,
    owner_id: validUserId,
    name: "Toko Sembako Berkah",
    category: "Sembako",
    phone: "081234567890",
    address: "Jl. Pasar Lama No. 1",
    currency_code: "IDR",
    timezone: "Asia/Jakarta",
    created_at: "2026-10-10T08:00:00Z",
    updated_at: "2026-10-10T08:00:00Z",
  };

  const sampleBusinessRow2 = {
    id: secondBusinessId,
    owner_id: validUserId,
    name: "Toko Elektronik Maju",
    category: "Elektronik",
    phone: "081299998888",
    address: "Jl. Gatot Subroto No. 45",
    currency_code: "IDR",
    timezone: "Asia/Jakarta",
    created_at: "2026-10-11T09:00:00Z",
    updated_at: "2026-10-11T09:00:00Z",
  };

  beforeEach(() => {
    profileSelectSpy = vi.fn();
    profileUpdateSpy = vi.fn();
    businessSelectSpy = vi.fn();
    businessInsertSpy = vi.fn();
    businessUpdateSpy = vi.fn();
    memberSelectSpy = vi.fn();

    profileQueryResult = { data: sampleProfileRow, error: null };
    businessCountResult = { count: 1, error: null };
    businessSingleResult = { data: sampleBusinessRow1, error: null };
    businessUpdateResult = { data: sampleBusinessRow1, error: null };
    businessListResult = { data: [sampleBusinessRow1, sampleBusinessRow2], error: null };
    memberSingleResult = { data: { role: "OWNER" }, error: null };
    memberListResult = {
      data: [{ business_id: validBusinessId }, { business_id: secondBusinessId }],
      error: null,
    };

    mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: validUserId, email: "budi@veyraos.com" } },
        error: null,
      }),
    };

    mockFrom = vi.fn((table: string) => {
      if (table === "profiles") {
        const queryBuilder: Record<string, unknown> = {};
        queryBuilder.select = profileSelectSpy.mockImplementation(() => queryBuilder);
        queryBuilder.update = profileUpdateSpy.mockImplementation(() => queryBuilder);
        queryBuilder.eq = vi.fn().mockImplementation(() => queryBuilder);
        queryBuilder.maybeSingle = vi.fn().mockImplementation(() =>
          Promise.resolve(profileQueryResult)
        );
        queryBuilder.single = vi.fn().mockImplementation(() =>
          Promise.resolve(profileQueryResult)
        );
        return queryBuilder;
      }

      if (table === "businesses") {
        let isCountHeadQuery = false;
        let isUpdateQuery = false;
        const queryBuilder: Record<string, unknown> = {};

        queryBuilder.select = businessSelectSpy.mockImplementation((columns, opts) => {
          if (opts?.head === true || opts?.count) {
            isCountHeadQuery = true;
          }
          return queryBuilder;
        });
        queryBuilder.insert = businessInsertSpy.mockImplementation(() => queryBuilder);
        queryBuilder.update = businessUpdateSpy.mockImplementation(() => {
          isUpdateQuery = true;
          return queryBuilder;
        });
        queryBuilder.eq = vi.fn().mockImplementation(() => queryBuilder);
        queryBuilder.in = vi.fn().mockImplementation(() => queryBuilder);
        queryBuilder.order = vi.fn().mockImplementation(() => queryBuilder);
        queryBuilder.single = vi.fn().mockImplementation(() =>
          Promise.resolve(businessSingleResult)
        );
        queryBuilder.maybeSingle = vi.fn().mockImplementation(() => {
          if (isUpdateQuery) {
            return Promise.resolve(businessUpdateResult);
          }
          return Promise.resolve(businessSingleResult);
        });
        // Mendukung await langsung pada query count atau select list
        queryBuilder.then = (resolve: (val: unknown) => void) => {
          if (isCountHeadQuery) {
            resolve({
              count: businessCountResult.count,
              error: businessCountResult.error,
            });
          } else {
            resolve(businessListResult);
          }
        };
        return queryBuilder;
      }

      if (table === "business_members") {
        const queryBuilder: Record<string, unknown> = {};
        queryBuilder.select = memberSelectSpy.mockImplementation(() => queryBuilder);
        queryBuilder.eq = vi.fn().mockImplementation(() => queryBuilder);
        queryBuilder.maybeSingle = vi.fn().mockImplementation(() =>
          Promise.resolve(memberSingleResult)
        );
        queryBuilder.then = (resolve: (val: unknown) => void) => {
          resolve(memberListResult);
        };
        return queryBuilder;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockSupabase = {
      auth: mockAuth,
      from: mockFrom,
    } as unknown as SupabaseClient;
  });

  // ==========================================================================
  // 1. OPERASI getUserProfile
  // ==========================================================================
  describe("1. getUserProfile", () => {
    it("1.1 menolak pengguna tidak terautentikasi (UNAUTHENTICATED)", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid session" },
      });

      const res = await getUserProfile({ supabase: mockSupabase });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
        expect(res.error.message).toMatch(/belum terautentikasi/);
      }
    });

    it("1.2 berhasil mengambil profil pengguna dengan pemetaan DTO yang benar", async () => {
      const res = await getUserProfile({ supabase: mockSupabase });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe(validUserId);
        expect(res.data.fullName).toBe("Budi Santoso");
        expect(res.data.email).toBe("budi@veyraos.com");
        expect(res.data.createdAt).toBe("2026-10-10T10:00:00Z");
        expect(res.data.updatedAt).toBe("2026-10-10T10:00:00Z");
      }
    });

    it("1.3 mengembalikan NOT_FOUND saat baris profil tidak ditemukan di database", async () => {
      profileQueryResult = { data: null, error: null };

      const res = await getUserProfile({ supabase: mockSupabase });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NOT_FOUND");
        expect(res.error.message).toMatch(/Profil pengguna tidak ditemukan/);
      }
    });

    it("1.4 memetakan database error pada query profil secara aman", async () => {
      profileQueryResult = {
        data: null,
        error: { code: "PGRST301", message: "JWT expired or database error" },
      };

      const res = await getUserProfile({ supabase: mockSupabase });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // 2. OPERASI updateUserProfile
  // ==========================================================================
  describe("2. updateUserProfile", () => {
    it("2.1 menolak format nama tidak valid (kurang dari 2 atau lebih dari 100 karakter)", async () => {
      const invalidInputs: UpdateProfileInput[] = [
        { fullName: "A" },
        { fullName: "" },
        { fullName: "   " },
        { fullName: "A".repeat(101) },
      ];

      for (const input of invalidInputs) {
        const res = await updateUserProfile(input, { supabase: mockSupabase });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("VALIDATION_ERROR");
          expect(res.error.details?.fullName).toBeDefined();
        }
      }
      expect(profileUpdateSpy).not.toHaveBeenCalled();
    });

    it("2.2 menolak pembaruan jika sesi pengguna tidak terautentikasi", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No active session" },
      });

      const res = await updateUserProfile(
        { fullName: "Budi Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
      expect(profileUpdateSpy).not.toHaveBeenCalled();
    });

    it("2.3 berhasil memperbarui profil dengan fullName yang valid", async () => {
      const updatedRow = { ...sampleProfileRow, full_name: "Budi Santoso Baru" };
      profileQueryResult = { data: updatedRow, error: null };

      const res = await updateUserProfile(
        { fullName: "Budi Santoso Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.fullName).toBe("Budi Santoso Baru");
      }
      expect(profileUpdateSpy).toHaveBeenCalledWith({
        full_name: "Budi Santoso Baru",
      });
    });

    it("2.4 membuktikan field sistem immutable (email, id, timestamps) tidak dikirim dalam payload update", async () => {
      // Mensimulasikan pemanggil yang mencoba menyusupkan email dan id
      const maliciousPayload = {
        fullName: "Budi Santoso",
        email: "hacker@evil.com",
        id: "evil-uuid",
      } as unknown as UpdateProfileInput;

      await updateUserProfile(maliciousPayload, { supabase: mockSupabase });

      expect(profileUpdateSpy).toHaveBeenCalledTimes(1);
      const updateArg = profileUpdateSpy.mock.calls[0][0];
      // Hanya full_name yang boleh berada dalam payload update SQL
      expect(updateArg).toEqual({ full_name: "Budi Santoso" });
      expect(updateArg.email).toBeUndefined();
      expect(updateArg.id).toBeUndefined();
    });

    it("2.5 mengembalikan NOT_FOUND jika baris profil tidak ditemukan saat pembaruan", async () => {
      profileQueryResult = { data: null, error: null };

      const res = await updateUserProfile(
        { fullName: "Budi Santoso" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NOT_FOUND");
      }
    });

    it("2.6 memetakan database error pada operasi pembaruan profil", async () => {
      profileQueryResult = {
        data: null,
        error: { code: "23505", message: "Unique violation on profile" },
      };

      const res = await updateUserProfile(
        { fullName: "Budi Santoso" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // 3. OPERASI createBusiness
  // ==========================================================================
  describe("3. createBusiness", () => {
    it("3.1 menolak input bisnis tidak valid (nama < 2 karakter atau > 60 karakter)", async () => {
      const invalidInputs: CreateBusinessInput[] = [
        { name: "T" },
        { name: "" },
        { name: "T".repeat(61) },
      ];

      for (const input of invalidInputs) {
        const res = await createBusiness(input, { supabase: mockSupabase });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("VALIDATION_ERROR");
        }
      }
      expect(businessInsertSpy).not.toHaveBeenCalled();
    });

    it("3.2 menolak pembuatan bisnis saat pengguna tidak terautentikasi", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No session" },
      });

      const res = await createBusiness(
        { name: "Toko Berkah" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
      expect(businessInsertSpy).not.toHaveBeenCalled();
    });

    it("3.3 menolak pembuatan bisnis saat batas kuota awal tercapai (count >= 5 -> BUSINESS_LIMIT_REACHED)", async () => {
      businessCountResult = { count: 5, error: null };

      const res = await createBusiness(
        { name: "Toko Usaha Keenam" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("BUSINESS_LIMIT_REACHED");
        expect(res.error.message).toMatch(/maksimal 5 bisnis/);
      }
      expect(businessInsertSpy).not.toHaveBeenCalled();
    });

    it("3.4 berhasil membuat bisnis saat kuota < 5 dengan penetapan owner_id server-authoritative", async () => {
      businessCountResult = { count: 2, error: null };
      businessSingleResult = { data: sampleBusinessRow1, error: null };

      const res = await createBusiness(
        {
          name: "Toko Sembako Berkah",
          category: "Sembako",
          phone: "081234567890",
          address: "Jl. Pasar Lama No. 1",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Toko Sembako Berkah");
        expect(res.data.ownerId).toBe(validUserId);
        expect(res.data.currencyCode).toBe("IDR");
        expect(res.data.timezone).toBe("Asia/Jakarta");
      }

      expect(businessInsertSpy).toHaveBeenCalledTimes(1);
      const inserted = businessInsertSpy.mock.calls[0][0];
      expect(inserted.owner_id).toBe(validUserId);
      expect(inserted.name).toBe("Toko Sembako Berkah");
      expect(inserted.category).toBe("Sembako");
    });

    it("3.5 membuktikan field sistem (currency_code, timezone, id) tidak disuntikkan dari input pengguna", async () => {
      businessCountResult = { count: 0, error: null };
      const maliciousPayload = {
        name: "Toko Sembako",
        currency_code: "USD",
        timezone: "America/New_York",
        id: "fake-id",
      } as unknown as CreateBusinessInput;

      await createBusiness(maliciousPayload, { supabase: mockSupabase });

      expect(businessInsertSpy).toHaveBeenCalledTimes(1);
      const inserted = businessInsertSpy.mock.calls[0][0];
      // currency_code dan timezone dibiarkan default oleh schema database
      expect(inserted.currency_code).toBeUndefined();
      expect(inserted.timezone).toBeUndefined();
      expect(inserted.id).toBeUndefined();
      expect(inserted.owner_id).toBe(validUserId);
    });

    it("3.6 memetakan database error pada saat pengecekan kuota count", async () => {
      businessCountResult = {
        count: null,
        error: { code: "57014", message: "Query timeout" },
      };

      const res = await createBusiness(
        { name: "Toko Sembako" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      expect(businessInsertSpy).not.toHaveBeenCalled();
    });

    it("3.7 memetakan database error pada saat insert data bisnis", async () => {
      businessCountResult = { count: 1, error: null };
      businessSingleResult = {
        data: null,
        error: { code: "23505", message: "Unique constraint violation" },
      };

      const res = await createBusiness(
        { name: "Toko Sembako" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 4. OPERASI getMyBusinesses
  // ==========================================================================
  describe("4. getMyBusinesses", () => {
    it("4.1 menolak pengguna tidak terautentikasi (UNAUTHENTICATED)", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No session" },
      });

      const res = await getMyBusinesses({ supabase: mockSupabase });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("4.2 mengembalikan array kosong [] saat pengguna belum memiliki keanggotaan bisnis", async () => {
      memberListResult = { data: [], error: null };

      const res = await getMyBusinesses({ supabase: mockSupabase });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toEqual([]);
      }
      expect(businessSelectSpy).not.toHaveBeenCalled();
    });

    it("4.3 mengembalikan daftar multi-bisnis terurut deterministik", async () => {
      memberListResult = {
        data: [{ business_id: validBusinessId }, { business_id: secondBusinessId }],
        error: null,
      };
      businessListResult = {
        data: [sampleBusinessRow1, sampleBusinessRow2],
        error: null,
      };

      const res = await getMyBusinesses({ supabase: mockSupabase });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(2);
        expect(res.data[0].id).toBe(validBusinessId);
        expect(res.data[1].id).toBe(secondBusinessId);
      }
    });

    it("4.4 memetakan database error pada query business_members", async () => {
      memberListResult = {
        data: null,
        error: { code: "42P01", message: "relation does not exist" },
      };

      const res = await getMyBusinesses({ supabase: mockSupabase });
      expect(res.success).toBe(false);
    });

    it("4.5 memetakan database error pada query data bisnis", async () => {
      memberListResult = {
        data: [{ business_id: validBusinessId }],
        error: null,
      };
      businessListResult = {
        data: null,
        error: { code: "08006", message: "Connection failure" },
      };

      const res = await getMyBusinesses({ supabase: mockSupabase });
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 5. OPERASI getBusinessById
  // ==========================================================================
  describe("5. getBusinessById", () => {
    it("5.1 menolak format UUID bisnis yang tidak valid (VALIDATION_ERROR)", async () => {
      const res = await getBusinessById("bukan-uuid", { supabase: mockSupabase });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("5.2 menolak pengguna yang tidak memiliki keanggotaan pada bisnis target (UNAUTHORIZED_BUSINESS)", async () => {
      memberSingleResult = { data: null, error: null };

      const res = await getBusinessById(unauthorizedBizId, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
        expect(res.error.message).toMatch(/tidak terdaftar sebagai anggota/);
      }
    });

    it("5.3 berhasil mengambil data detail bisnis jika pengguna adalah anggota sah", async () => {
      memberSingleResult = { data: { role: "OWNER" }, error: null };
      businessSingleResult = { data: sampleBusinessRow1, error: null };

      const res = await getBusinessById(validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe(validBusinessId);
        expect(res.data.name).toBe("Toko Sembako Berkah");
        expect(res.data.ownerId).toBe(validUserId);
      }
    });

    it("5.4 mengembalikan NOT_FOUND jika baris bisnis tidak ditemukan di database", async () => {
      memberSingleResult = { data: { role: "OWNER" }, error: null };
      businessSingleResult = { data: null, error: null };

      const res = await getBusinessById(validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NOT_FOUND");
      }
    });

    it("5.5 memetakan database error pada query detail bisnis", async () => {
      memberSingleResult = { data: { role: "OWNER" }, error: null };
      businessSingleResult = {
        data: null,
        error: { code: "XX000", message: "Internal server error" },
      };

      const res = await getBusinessById(validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 6. OPERASI updateBusiness
  // ==========================================================================
  describe("6. updateBusiness", () => {
    it("6.1 menolak format UUID bisnis yang tidak valid pada argumen URL", async () => {
      const res = await updateBusiness(
        "invalid-id",
        { name: "Nama Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
      expect(businessUpdateSpy).not.toHaveBeenCalled();
    });

    it("6.2 menolak payload pembaruan yang kosong tanpa field metadata (VALIDATION_ERROR)", async () => {
      const res = await updateBusiness(validBusinessId, {} as UpdateBusinessInput, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
      expect(businessUpdateSpy).not.toHaveBeenCalled();
    });

    it("6.3 menolak jika businessId dalam body tidak cocok dengan ID pada argumen URL", async () => {
      const res = await updateBusiness(
        validBusinessId,
        { businessId: secondBusinessId, name: "Nama Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.message).toMatch(/tidak cocok/);
      }
      expect(businessUpdateSpy).not.toHaveBeenCalled();
    });

    it("6.4 menolak pembaruan jika sesi pengguna belum terautentikasi", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No session" },
      });

      const res = await updateBusiness(
        validBusinessId,
        { name: "Nama Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
      expect(businessUpdateSpy).not.toHaveBeenCalled();
    });

    it("6.5 mengembalikan NOT_FOUND jika bisnis tidak ditemukan saat verifikasi kepemilikan", async () => {
      businessSingleResult = { data: null, error: null };

      const res = await updateBusiness(
        validBusinessId,
        { name: "Nama Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NOT_FOUND");
      }
      expect(businessUpdateSpy).not.toHaveBeenCalled();
    });

    it("6.6 menolak pembaruan bisnis oleh non-pemilik (FORBIDDEN_NOT_OWNER)", async () => {
      // Bisnis ini dimiliki oleh otherUserId, bukan validUserId
      businessSingleResult = {
        data: { id: validBusinessId, owner_id: otherUserId },
        error: null,
      };

      const res = await updateBusiness(
        validBusinessId,
        { name: "Nama Dibajak" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN_NOT_OWNER");
        expect(res.error.message).toMatch(/Hanya pemilik bisnis/);
      }
      expect(businessUpdateSpy).not.toHaveBeenCalled();
    });

    it("6.7 berhasil memperbarui metadata bisnis oleh pemilik sah", async () => {
      // Bisnis dimiliki oleh validUserId
      const updatedRow = {
        ...sampleBusinessRow1,
        name: "Toko Sembako Berkah Jaya",
        phone: "081211112222",
      };
      businessSingleResult = { data: sampleBusinessRow1, error: null };
      businessUpdateResult = { data: updatedRow, error: null };

      const res = await updateBusiness(
        validBusinessId,
        { name: "Toko Sembako Berkah Jaya", phone: "081211112222" },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Toko Sembako Berkah Jaya");
        expect(res.data.phone).toBe("081211112222");
      }

      expect(businessUpdateSpy).toHaveBeenCalledTimes(1);
      const updatePayload = businessUpdateSpy.mock.calls[0][0];
      expect(updatePayload).toEqual({
        name: "Toko Sembako Berkah Jaya",
        phone: "081211112222",
      });
    });

    it("6.8 membuktikan field sistem immutable (id, owner_id, currency_code, timezone) dibersihkan dari payload update", async () => {
      businessSingleResult = { data: sampleBusinessRow1, error: null };

      const maliciousPayload = {
        name: "Toko Baru",
        owner_id: "other-user-uuid",
        currency_code: "USD",
        timezone: "America/New_York",
        id: "evil-biz-uuid",
      } as unknown as UpdateBusinessInput;

      await updateBusiness(validBusinessId, maliciousPayload, {
        supabase: mockSupabase,
      });

      expect(businessUpdateSpy).toHaveBeenCalledTimes(1);
      const updatePayload = businessUpdateSpy.mock.calls[0][0];
      expect(updatePayload.name).toBe("Toko Baru");
      expect(updatePayload.owner_id).toBeUndefined();
      expect(updatePayload.currency_code).toBeUndefined();
      expect(updatePayload.timezone).toBeUndefined();
      expect(updatePayload.id).toBeUndefined();
    });

    it("6.9 memetakan database error pada saat eksekusi update", async () => {
      // Step 1 check lolos (pemilik sah)
      businessSingleResult = { data: sampleBusinessRow1, error: null };
      // Step 4 eksekusi update mengembalikan database error
      businessUpdateResult = {
        data: null,
        error: { code: "40001", message: "Serialization failure" },
      };

      const res = await updateBusiness(
        validBusinessId,
        { name: "Toko Baru" },
        { supabase: mockSupabase }
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // 7. OPERASI resolveTenantContext
  // ==========================================================================
  describe("7. resolveTenantContext", () => {
    it("7.1 menolak format requestedBusinessId yang tidak valid (VALIDATION_ERROR)", async () => {
      const res = await resolveTenantContext("bukan-uuid", {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("7.2 menolak resolusi jika sesi pengguna belum terautentikasi (UNAUTHENTICATED)", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No session" },
      });

      const res = await resolveTenantContext(undefined, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("7.3 meresolusikan tenant nol-bisnis ketika pengguna belum memiliki bisnis apa pun", async () => {
      memberListResult = { data: [], error: null };

      const res = await resolveTenantContext(undefined, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.hasBusiness).toBe(false);
        expect(res.data.activeBusiness).toBeNull();
        expect(res.data.role).toBeNull();
        expect(res.data.availableBusinesses).toEqual([]);
      }
    });

    it("7.4 menolak jika pengguna nol-bisnis meminta requestedBusinessId (UNAUTHORIZED_BUSINESS)", async () => {
      memberListResult = { data: [], error: null };

      const res = await resolveTenantContext(validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
        expect(res.error.message).toMatch(/tidak terdaftar sebagai anggota/);
      }
    });

    it("7.5 berhasil meresolusikan bisnis yang cocok ketika requestedBusinessId sah", async () => {
      memberListResult = {
        data: [{ business_id: validBusinessId }, { business_id: secondBusinessId }],
        error: null,
      };
      businessListResult = {
        data: [sampleBusinessRow1, sampleBusinessRow2],
        error: null,
      };

      const res = await resolveTenantContext(secondBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.hasBusiness).toBe(true);
        expect(res.data.activeBusiness?.id).toBe(secondBusinessId);
        expect(res.data.activeBusiness?.name).toBe("Toko Elektronik Maju");
        expect(res.data.availableBusinesses.length).toBe(2);
      }
    });

    it("7.6 menolak requestedBusinessId tidak sah tanpa silent fallback (Anti-Silent-Fallback -> UNAUTHORIZED_BUSINESS)", async () => {
      memberListResult = {
        data: [{ business_id: validBusinessId }],
        error: null,
      };
      businessListResult = {
        data: [sampleBusinessRow1],
        error: null,
      };

      // Meminta bisnis unauthorizedBizId yang bukan milik pengguna
      const res = await resolveTenantContext(unauthorizedBizId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
        expect(res.error.message).toMatch(/tidak terdaftar sebagai anggota/);
      }
    });

    it("7.7 memilih default bisnis pertama secara deterministik ketika requestedBusinessId ditiadakan (omitted)", async () => {
      memberListResult = {
        data: [{ business_id: validBusinessId }, { business_id: secondBusinessId }],
        error: null,
      };
      // Urutan deterministik: created_at ASC, id ASC
      businessListResult = {
        data: [sampleBusinessRow1, sampleBusinessRow2],
        error: null,
      };

      const res = await resolveTenantContext(undefined, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.hasBusiness).toBe(true);
        expect(res.data.activeBusiness?.id).toBe(validBusinessId);
        expect(res.data.availableBusinesses.length).toBe(2);
      }
    });

    it("7.8 mempropagasi error jika getMyBusinesses gagal saat pengambilan data", async () => {
      memberListResult = {
        data: null,
        error: { code: "57P01", message: "admin shutdown" },
      };

      const res = await resolveTenantContext(undefined, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
    });
  });
});
