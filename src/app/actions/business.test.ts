/**
 * VeyraOS Server Actions Unit Tests — Business & Tenant Context (Batch 1)
 *
 * Menguji aksi server business.ts dalam lingkungan mock terisolasi:
 * - createBusinessAction
 * - switchActiveBusinessAction
 * - getActiveTenantContextAction
 *
 * Menjamin kepatuhan terhadap prinsip:
 * 1. Cookie adalah preferensi, bukan bukti otorisasi.
 * 2. Anti-Silent Fallback ketat (fail-closed jika cookie tidak sah atau bukan anggota).
 * 3. Tidak ada false success bila penulisan cookie gagal.
 * 4. Pembedaan tegas tipe error (auth, authz, validasi, db/infrastruktur).
 *
 * Keterbatasan: Pengujian unit ini menggunakan mock Next.js headers dan Supabase client,
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
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

import {
  createBusinessAction,
  switchActiveBusinessAction,
  getActiveTenantContextAction,
  updateBusinessAction,
} from "./business";

function createThenableQuery(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const payload = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const query: Record<string, unknown> = {};
  query.select = vi.fn().mockReturnValue(query);
  query.insert = vi.fn().mockReturnValue(query);
  query.update = vi.fn().mockReturnValue(query);
  query.delete = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.in = vi.fn().mockReturnValue(query);
  query.order = vi.fn().mockReturnValue(query);
  query.single = vi.fn().mockImplementation(() => Promise.resolve(payload));
  query.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(payload));
  query.then = (resolve: (val: unknown) => void) => resolve(payload);
  return query;
}

describe("Business & Tenant Context Server Actions Suite (src/app/actions/business.ts)", () => {
  const validUserId = "11111111-1111-4111-a111-111111111111";
  const validBusinessId = "33333333-3333-4333-a333-333333333333";
  const otherBusinessId = "44444444-4444-4444-a444-444444444444";
  const unauthorizedBizId = "99999999-9999-4999-a999-999999999999";

  const sampleBusinessRow = {
    id: validBusinessId,
    owner_id: validUserId,
    name: "Toko Sembako Berkah",
    category: "Retail",
    phone: "08123456789",
    address: "Jl. Sudirman No. 1",
    currency_code: "IDR",
    timezone: "Asia/Jakarta",
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBusinessAction()", () => {
    it("2.1 menolak input Zod tidak valid (nama toko < 2 karakter)", async () => {
      const result = await createBusinessAction({ name: " " });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.name).toBeDefined();
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.2 menolak jika pengguna belum terautentikasi (UNAUTHENTICATED) dan tidak memasang cookie", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No session" },
      });

      const result = await createBusinessAction({ name: "Toko Baru" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHENTICATED");
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.3 menolak jika batas 5 bisnis tercapai (BUSINESS_LIMIT_REACHED) dan tidak memasang cookie", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // businesses count query -> count 5
      mockSupabaseClient.from.mockReturnValueOnce(
        createThenableQuery({ count: 5, error: null })
      );

      const result = await createBusinessAction({ name: "Toko Keenam" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("BUSINESS_LIMIT_REACHED");
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.4 berhasil membuat bisnis baru dan otomatis menetapkan cookie tenant aktif", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // 1. businesses count -> 0
      // 2. businesses insert -> sampleBusinessRow
      mockSupabaseClient.from
        .mockReturnValueOnce(createThenableQuery({ count: 0, error: null }))
        .mockReturnValueOnce(createThenableQuery({ data: sampleBusinessRow, error: null }));

      const result = await createBusinessAction({ name: "Toko Sembako Berkah" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validBusinessId);
        expect(result.data.name).toBe("Toko Sembako Berkah");
      }
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "veyra_active_business_id",
        validBusinessId,
        expect.objectContaining({
          httpOnly: true,
          path: "/",
          sameSite: "lax",
        })
      );
    });

    it("2.5 menangani kegagalan penulisan cookie secara aman tanpa false success", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(createThenableQuery({ count: 0, error: null }))
        .mockReturnValueOnce(createThenableQuery({ data: sampleBusinessRow, error: null }));

      // Simulasikan kegagalan penulisan cookie
      mockCookieStore.set.mockImplementationOnce(() => {
        throw new Error("Cookie storage quota exceeded or read-only context");
      });

      const result = await createBusinessAction({ name: "Toko Sembako Berkah" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("COOKIE_WRITE_ERROR");
        expect(result.error.message).toContain("gagal menyimpan preferensi bisnis aktif");
      }
    });

    it("2.6 tidak memasang cookie jika pembuatan bisnis gagal karena database error", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(createThenableQuery({ count: 0, error: null }))
        .mockReturnValueOnce(
          createThenableQuery({
            data: null,
            error: { message: "Database connection lost", code: "08006" },
          })
        );

      const result = await createBusinessAction({ name: "Toko Gagal" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("DATABASE_ERROR");
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });
  });

  describe("switchActiveBusinessAction()", () => {
    it("2.7 menolak format UUID bisnis yang tidak valid", async () => {
      const result = await switchActiveBusinessAction("invalid-uuid-format");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.businessId).toBeDefined();
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.8 menolak dan tidak memasang cookie jika pengguna bukan anggota bisnis (UNAUTHORIZED_BUSINESS)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // 1. business_members query: user hanya anggota validBusinessId
      // 2. businesses query: mengembalikan [sampleBusinessRow]
      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ business_id: validBusinessId, role: "OWNER" }],
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [sampleBusinessRow],
            error: null,
          })
        );

      const result = await switchActiveBusinessAction(unauthorizedBizId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.9 membedakan kegagalan database dan tidak mengubahnya menjadi UNAUTHORIZED_BUSINESS", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // Simulasikan database error saat query business_members
      mockSupabaseClient.from.mockReturnValueOnce(
        createThenableQuery({
          data: null,
          error: { message: "Internal DB connection failed", code: "08006" },
        })
      );

      const result = await switchActiveBusinessAction(validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("DATABASE_ERROR");
        expect(result.error.code).not.toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.10 berhasil mengganti bisnis aktif dan memperbarui cookie tenant", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const otherBusinessRow = {
        ...sampleBusinessRow,
        id: otherBusinessId,
        name: "Cabang Kedua",
      };

      // 1. business_members query
      // 2. businesses query
      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: [
              { business_id: validBusinessId, role: "OWNER" },
              { business_id: otherBusinessId, role: "OWNER" },
            ],
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [sampleBusinessRow, otherBusinessRow],
            error: null,
          })
        );

      const result = await switchActiveBusinessAction(otherBusinessId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeBusinessId).toBe(otherBusinessId);
      }
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "veyra_active_business_id",
        otherBusinessId,
        expect.objectContaining({
          httpOnly: true,
          path: "/",
        })
      );
    });

    it("2.11 menangani kegagalan penulisan cookie pada switchAction secara aman", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ business_id: validBusinessId, role: "OWNER" }],
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [sampleBusinessRow],
            error: null,
          })
        );

      mockCookieStore.set.mockImplementationOnce(() => {
        throw new Error("Cannot set cookie in current environment");
      });

      const result = await switchActiveBusinessAction(validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("COOKIE_WRITE_ERROR");
      }
    });
  });

  describe("getActiveTenantContextAction()", () => {
    it("2.12 membaca konteks tenant dari cookie yang valid secara server-authoritative", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ business_id: validBusinessId, role: "OWNER" }],
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [sampleBusinessRow],
            error: null,
          })
        );

      const result = await getActiveTenantContextAction();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasBusiness).toBe(true);
        expect(result.data.activeBusiness?.id).toBe(validBusinessId);
        expect(result.data.role).toBe("OWNER");
      }
    });

    it("2.13 fail-closed dan membersihkan cookie jika cookie berisi format UUID rusak/tidak valid", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "not-a-valid-uuid" });

      const result = await getActiveTenantContextAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      // Memastikan cookie rusak dibersihkan
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      // Memastikan TIDAK ADA fallback diam-diam ke bisnis default
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("2.14 fail-closed dan membersihkan cookie jika cookie merujuk bisnis yang bukan hak aksesnya (UNAUTHORIZED_BUSINESS)", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: unauthorizedBizId });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ business_id: validBusinessId, role: "OWNER" }],
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [sampleBusinessRow],
            error: null,
          })
        );

      const result = await getActiveTenantContextAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      // Memastikan cookie yang tidak diotorisasi dibersihkan
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      // Memastikan tidak diam-diam mengembalikan sampleBusinessRow sebagai activeBusiness
    });

    it("2.15 menangani kondisi cookie kosong (belum disetel) dengan resolusi deterministik default", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: [{ business_id: validBusinessId, role: "OWNER" }],
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: [sampleBusinessRow],
            error: null,
          })
        );

      const result = await getActiveTenantContextAction();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasBusiness).toBe(true);
        expect(result.data.activeBusiness?.id).toBe(validBusinessId);
      }
      // Menetapkan preferensi awal pada cookie
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "veyra_active_business_id",
        validBusinessId,
        expect.any(Object)
      );
    });

    it("2.16 menangani pengguna dengan 0 bisnis (empty state) tanpa memasang cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce(
        createThenableQuery({
          data: [],
          error: null,
        })
      );

      const result = await getActiveTenantContextAction();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasBusiness).toBe(false);
        expect(result.data.activeBusiness).toBeNull();
        expect(result.data.availableBusinesses).toEqual([]);
      }
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("2.17 mempertahankan kode DATABASE_ERROR saat resolusi konteks gagal karena gangguan infrastruktur", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce(
        createThenableQuery({
          data: null,
          error: { message: "Internal storage engine failure", code: "XX000" },
        })
      );

      const result = await getActiveTenantContextAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("DATABASE_ERROR");
        expect(result.error.code).not.toBe("UNAUTHORIZED_BUSINESS");
      }
      // Jangan membersihkan cookie jika terjadi error sementara database
      expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });
  });

  describe("updateBusinessAction()", () => {
    it("2.18 menolak payload tanpa satupun field metadata yang diperbarui", async () => {
      const result = await updateBusinessAction({
        businessId: validBusinessId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Data pembaruan bisnis tidak valid");
      }
    });

    it("2.19 menolak nama usaha kurang dari 2 karakter", async () => {
      const result = await updateBusinessAction({
        businessId: validBusinessId,
        name: "A",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.name).toBeDefined();
      }
    });

    it("2.20 menolak format UUID bisnis eksplisit yang tidak valid", async () => {
      const result = await updateBusinessAction({
        businessId: "invalid-uuid-format",
        name: "Nama Toko Baru",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.businessId).toBeDefined();
      }
    });

    it("2.21 menolak jika pengguna belum terautentikasi (UNAUTHENTICATED)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No session" },
      });

      const result = await updateBusinessAction({
        businessId: validBusinessId,
        name: "Nama Toko Baru",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("2.22 menolak jika pengguna bukan pemilik bisnis (FORBIDDEN_NOT_OWNER)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: "user-staf-bukan-pemilik" } },
        error: null,
      });

      // businesses fetch -> owner_id adalah validUserId, bukan user-staf
      mockSupabaseClient.from.mockReturnValueOnce(
        createThenableQuery({
          data: { id: validBusinessId, owner_id: validUserId },
          error: null,
        })
      );

      const result = await updateBusinessAction({
        businessId: validBusinessId,
        name: "Upaya Ubah Nama Toko",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN_NOT_OWNER");
        expect(result.error.message).toContain("Hanya pemilik bisnis");
      }
    });

    it("2.23 menolak jika bisnis tidak ditemukan (NOT_FOUND)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      // businesses fetch -> null
      mockSupabaseClient.from.mockReturnValueOnce(
        createThenableQuery({
          data: null,
          error: null,
        })
      );

      const result = await updateBusinessAction({
        businessId: validBusinessId,
        name: "Nama Toko Baru",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("2.24 berhasil memperbarui metadata bisnis saat dipanggil oleh pemilik sah", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const updatedRow = {
        ...sampleBusinessRow,
        name: "Toko Sembako Berkah Mandiri",
        phone: "08199999999",
      };

      // 1. businesses select (id, owner_id)
      // 2. businesses update
      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: { id: validBusinessId, owner_id: validUserId },
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: updatedRow,
            error: null,
          })
        );

      const result = await updateBusinessAction({
        businessId: validBusinessId,
        name: "Toko Sembako Berkah Mandiri",
        phone: "08199999999",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Toko Sembako Berkah Mandiri");
        expect(result.data.phone).toBe("08199999999");
      }
    });

    it("2.25 menyelesaikan businessId dari cookie aktif secara server-authoritative jika tidak disediakan", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: validUserId } },
        error: null,
      });

      const updatedRow = {
        ...sampleBusinessRow,
        address: "Jl. Gatot Subroto No. 99",
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(
          createThenableQuery({
            data: { id: validBusinessId, owner_id: validUserId },
            error: null,
          })
        )
        .mockReturnValueOnce(
          createThenableQuery({
            data: updatedRow,
            error: null,
          })
        );

      const result = await updateBusinessAction({
        address: "Jl. Gatot Subroto No. 99",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe("Jl. Gatot Subroto No. 99");
      }
    });
  });
});

