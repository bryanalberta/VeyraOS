/**
 * VeyraOS Product Catalog & Master Inventory Service Unit Tests
 *
 * Sesuai kriteria Substage 3.2.2A:
 * - Pengujian unit menggunakan Mock Supabase Client terisolasi (Mock-Only Unit Tests).
 * - Tidak terhubung ke PostgreSQL runtime live.
 * - Menguji validasi Zod, verifikasi autentikasi, otorisasi tenant, isolasi multi-tenant,
 *   ledger safety (pencegahan mutasi langsung stok/HPP, atomisitas stok awal),
 *   pencarian & filter, soft-delete archiving, dan error mapping.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  archiveProduct,
} from "./product.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateProductInput } from "@/types/api";

describe("Product Catalog & Master Inventory Service Suite (src/services/products)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const otherBusinessId = "99999999-9999-4999-a999-999999999999";
  const validUserId = "22222222-2222-4222-a222-222222222222";
  const validProductId = "33333333-3333-4333-a333-333333333333";

  let mockSupabase: SupabaseClient;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockAuth: { getUser: ReturnType<typeof vi.fn> };
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let eqSpy: ReturnType<typeof vi.fn>;
  let lteSpy: ReturnType<typeof vi.fn>;
  let orSpy: ReturnType<typeof vi.fn>;

  let productsQueryResult: { data: unknown; error: unknown };
  let businessMemberResult: { data: unknown; error: unknown };

  const sampleProductRow = {
    id: validProductId,
    business_id: validBusinessId,
    name: "Kopi Arabika 250g",
    sku: "KOP-ARA-01",
    category: "Minuman",
    selling_price: 65000,
    cost_price: 45000,
    stock_quantity: 0,
    is_archived: false,
    created_at: "2026-10-13T10:00:00Z",
    updated_at: "2026-10-13T10:00:00Z",
  };

  beforeEach(() => {
    insertSpy = vi.fn();
    updateSpy = vi.fn();
    deleteSpy = vi.fn();
    selectSpy = vi.fn();
    eqSpy = vi.fn();
    lteSpy = vi.fn();
    orSpy = vi.fn();

    productsQueryResult = { data: sampleProductRow, error: null };
    businessMemberResult = { data: { role: "OWNER" }, error: null };

    mockFrom = vi.fn((table: string) => {
      if (table === "business_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve(businessMemberResult)
          ),
        };
      }

      if (table === "products") {
        const queryBuilder: Record<string, unknown> = {};

        queryBuilder.select = selectSpy.mockImplementation(() => queryBuilder);
        queryBuilder.insert = insertSpy.mockImplementation(() => queryBuilder);
        queryBuilder.update = updateSpy.mockImplementation(() => queryBuilder);
        queryBuilder.delete = deleteSpy.mockImplementation(() => queryBuilder);
        queryBuilder.eq = eqSpy.mockImplementation(() => queryBuilder);
        queryBuilder.lte = lteSpy.mockImplementation(() => queryBuilder);
        queryBuilder.or = orSpy.mockImplementation(() => queryBuilder);
        queryBuilder.order = vi.fn().mockImplementation(() => queryBuilder);
        queryBuilder.single = vi.fn().mockImplementation(() =>
          Promise.resolve(productsQueryResult)
        );
        queryBuilder.maybeSingle = vi.fn().mockImplementation(() =>
          Promise.resolve(productsQueryResult)
        );
        queryBuilder.then = (resolve: (val: unknown) => void) =>
          resolve(
            Array.isArray(productsQueryResult.data)
              ? productsQueryResult
              : {
                  data: productsQueryResult.data ? [productsQueryResult.data] : [],
                  error: productsQueryResult.error,
                }
          );

        return queryBuilder;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: validUserId, email: "owner@veyraos.com" } },
        error: null,
      }),
    };

    mockSupabase = {
      auth: mockAuth,
      from: mockFrom,
    } as unknown as SupabaseClient;
  });

  // ==========================================================================
  // 1. VALIDASI INPUT TIDAK VALID (ZOD SCHEMAS)
  // ==========================================================================
  describe("Input Validation Guards (Zod)", () => {
    it("createProduct: menolak nama kosong, harga jual nol/negatif, dan stok negatif", async () => {
      const invalidInputs: CreateProductInput[] = [
        {
          businessId: validBusinessId,
          name: "",
          sellingPrice: 50000,
          costPrice: 30000,
          stockQuantity: 0,
        },
        {
          businessId: validBusinessId,
          name: "Produk X",
          sellingPrice: 0, // SQL CHECK constraint selling_price > 0
          costPrice: 30000,
          stockQuantity: 0,
        },
        {
          businessId: validBusinessId,
          name: "Produk Y",
          sellingPrice: 50000,
          costPrice: -100,
          stockQuantity: 0,
        },
        {
          businessId: validBusinessId,
          name: "Produk Z",
          sellingPrice: 50000,
          costPrice: 30000,
          stockQuantity: -5,
        },
        {
          businessId: "invalid-uuid",
          name: "Produk W",
          sellingPrice: 50000,
          costPrice: 30000,
          stockQuantity: 0,
        },
      ];

      for (const input of invalidInputs) {
        const res = await createProduct(input, { supabase: mockSupabase });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("VALIDATION_ERROR");
          expect(res.error.details).toBeDefined();
        }
      }

      // Pastikan database tidak pernah disentuh
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("getProductById: menolak format UUID id atau businessId yang salah", async () => {
      const res1 = await getProductById("not-a-uuid", validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error.code).toBe("VALIDATION_ERROR");
      }

      const res2 = await getProductById(validProductId, "bad-biz-uuid", {
        supabase: mockSupabase,
      });
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("archiveProduct: menolak format UUID yang tidak valid", async () => {
      const res = await archiveProduct("bad-id", validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. VERIFIKASI AUTENTIKASI DAN OTORISASI ANGGOTA BISNIS
  // ==========================================================================
  describe("Authentication & Business Membership Authorization", () => {
    it("menolak operasi ketika sesi pengguna tidak terautentikasi (UNAUTHENTICATED)", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No active session" },
      });

      const res = await createProduct(
        {
          businessId: validBusinessId,
          name: "Produk Autentikasi",
          sellingPrice: 10000,
          costPrice: 5000,
          stockQuantity: 0,
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("menolak operasi ketika pengguna bukan anggota dari bisnis target (UNAUTHORIZED_BUSINESS)", async () => {
      businessMemberResult = { data: null, error: null };

      const res = await createProduct(
        {
          businessId: validBusinessId,
          name: "Produk Akses Ditolak",
          sellingPrice: 10000,
          costPrice: 5000,
          stockQuantity: 0,
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. ISOLASI TENANT PADA OPERASI BACA DAN TULIS
  // ==========================================================================
  describe("Multi-Tenant Isolation Safeguards", () => {
    it("getProducts: menyertakan filter business_id wajib pada query", async () => {
      await getProducts(
        { businessId: validBusinessId },
        { supabase: mockSupabase }
      );

      expect(eqSpy).toHaveBeenCalledWith("business_id", validBusinessId);
    });

    it("getProductById: menolak mengembalikan produk milik tenant lain", async () => {
      // Mock produk tidak ditemukan ketika difilter dengan businessId berbeda
      productsQueryResult = { data: null, error: null };

      const res = await getProductById(validProductId, otherBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NOT_FOUND");
      }
    });

    it("updateProduct: membatasi pembaruan hanya pada business_id pemilik", async () => {
      await updateProduct(
        validProductId,
        {
          businessId: validBusinessId,
          productId: validProductId,
          name: "Nama Baru",
        },
        { supabase: mockSupabase }
      );

      expect(eqSpy).toHaveBeenCalledWith("business_id", validBusinessId);
      expect(eqSpy).toHaveBeenCalledWith("id", validProductId);
    });
  });

  // ==========================================================================
  // 4. PEMBUATAN PRODUK & LEDGER INITIAL STOCK SAFETY
  // ==========================================================================
  describe("Product Creation & Initial Stock Ledger Integrity", () => {
    it("pembuatan produk dengan stok awal 0 berhasil tanpa resiko ledger", async () => {
      const res = await createProduct(
        {
          businessId: validBusinessId,
          name: "Kopi Arabika 250g",
          sku: "KOP-ARA-01",
          category: "Minuman",
          sellingPrice: 65000,
          costPrice: 45000,
          stockQuantity: 0,
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe(validProductId);
        expect(res.data.name).toBe("Kopi Arabika 250g");
        expect(res.data.stockQuantity).toBe(0);
        expect(res.data.sellingPrice).toBe(65000);
        expect(res.data.costPrice).toBe(45000);
        expect(res.data.isArchived).toBe(false);
      }

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: validBusinessId,
          stock_quantity: 0,
        })
      );
    });

    it("pembuatan produk dengan stok awal positif DITOLAK demi mencegah ledger desinkronisasi (ATOMIC_INITIAL_STOCK_UNAVAILABLE)", async () => {
      // Sesuai Section 4 instruksi: Operasi atomik multi-tabel belum tersedia di skema 001-011.
      // Jangan melakukan rangkaian penulisan terpisah atau menambah RPC diam-diam.
      const res = await createProduct(
        {
          businessId: validBusinessId,
          name: "Gula Pasir 1kg",
          sku: "GLA-01",
          sellingPrice: 18000,
          costPrice: 14000,
          stockQuantity: 50, // Positif
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("ATOMIC_INITIAL_STOCK_UNAVAILABLE");
        expect(res.error.message).toContain("mekanisme transaksi atomik");
      }

      // Pastikan tidak ada penulisan terpisah yang bocor ke tabel products
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 5. PENCEGAHAN MUTASI LANGSUNG STOK DAN HPP (updateProduct)
  // ==========================================================================
  describe("Direct Stock and Cost Price Mutation Guard (updateProduct)", () => {
    it("menolak pembaruan yang menyertakan stockQuantity secara langsung (FORBIDDEN_FIELD_MUTATION)", async () => {
      const res = await updateProduct(
        validProductId,
        {
          businessId: validBusinessId,
          productId: validProductId,
          stockQuantity: 100, // Ilegal
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN_FIELD_MUTATION");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("menolak pembaruan yang menyertakan costPrice secara langsung (FORBIDDEN_FIELD_MUTATION)", async () => {
      const res = await updateProduct(
        validProductId,
        {
          businessId: validBusinessId,
          productId: validProductId,
          costPrice: 40000, // Ilegal (HPP bergerak via MWAC)
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN_FIELD_MUTATION");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("mengizinkan pembaruan metadata yang sah (nama, SKU, kategori, harga jual)", async () => {
      const res = await updateProduct(
        validProductId,
        {
          businessId: validBusinessId,
          productId: validProductId,
          name: "Kopi Arabika Premium 250g",
          sellingPrice: 70000,
          category: "Kopi",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Kopi Arabika Premium 250g",
          selling_price: 70000,
          category: "Kopi",
        })
      );
    });
  });

  // ==========================================================================
  // 6. PENCARIAN, FILTER, DAN STOK MENIPIS (getProducts)
  // ==========================================================================
  describe("Search, Filter, and Inventory Status Queries", () => {
    it("menerapkan filter teks query pada nama dan sku", async () => {
      await getProducts(
        {
          businessId: validBusinessId,
          query: "Arabika",
        },
        { supabase: mockSupabase }
      );

      expect(orSpy).toHaveBeenCalledWith(
        expect.stringContaining("name.ilike.%Arabika%")
      );
    });

    it("menerapkan filter kategori produk", async () => {
      await getProducts(
        {
          businessId: validBusinessId,
          category: "Minuman",
        },
        { supabase: mockSupabase }
      );

      expect(eqSpy).toHaveBeenCalledWith("category", "Minuman");
    });

    it("menerapkan filter stok menipis (lowStockOnly) dengan threshold stock_quantity <= 5", async () => {
      await getProducts(
        {
          businessId: validBusinessId,
          lowStockOnly: true,
        },
        { supabase: mockSupabase }
      );

      expect(lteSpy).toHaveBeenCalledWith("stock_quantity", 5);
    });

    it("secara default hanya menampilkan produk aktif (is_archived = false)", async () => {
      await getProducts(
        { businessId: validBusinessId },
        { supabase: mockSupabase }
      );

      expect(eqSpy).toHaveBeenCalledWith("is_archived", false);
    });
  });

  // ==========================================================================
  // 7. PENGARSIPAN DAN PENOLAKAN HARD DELETE
  // ==========================================================================
  describe("Soft-Delete Archiving Safeguards", () => {
    it("archiveProduct: melakukan soft-delete dengan mengubah is_archived = true", async () => {
      const res = await archiveProduct(validProductId, validBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({ is_archived: true });
      expect(eqSpy).toHaveBeenCalledWith("id", validProductId);
      expect(eqSpy).toHaveBeenCalledWith("business_id", validBusinessId);
    });

    it("menolak keras segala operasi hard delete pada tabel produk", async () => {
      await archiveProduct(validProductId, validBusinessId, {
        supabase: mockSupabase,
      });

      // Tabel produk tidak boleh dipanggil melalui fungsi .delete()
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 8. PENANGANAN ERROR DATABASE
  // ==========================================================================
  describe("Database Error Mapping Sanitization", () => {
    it("memetakan benturan indeks keunikan SKU ke kode SKU_ALREADY_EXISTS", async () => {
      productsQueryResult = {
        data: null,
        error: {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "uq_products_sku_per_business"',
          details: "Key (business_id, sku)=(...) already exists.",
        },
      };

      const res = await createProduct(
        {
          businessId: validBusinessId,
          name: "Kopi Duplikat",
          sku: "KOP-DUPLIKAT",
          sellingPrice: 50000,
          costPrice: 30000,
          stockQuantity: 0,
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("SKU_ALREADY_EXISTS");
        expect(res.error.message).toContain("SKU produk sudah digunakan");
      }
    });

    it("memetakan error jaringan ke kode NETWORK_ERROR tanpa membocorkan kredensial", async () => {
      productsQueryResult = {
        data: null,
        error: {
          message: "Fetch failed: ECONNREFUSED 127.0.0.1:5432",
        },
      };

      const res = await createProduct(
        {
          businessId: validBusinessId,
          name: "Produk Error Jaringan",
          sellingPrice: 50000,
          costPrice: 30000,
          stockQuantity: 0,
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NETWORK_ERROR");
        expect(res.error.message).not.toContain("ECONNREFUSED");
      }
    });
  });
});
