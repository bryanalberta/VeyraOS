/**
 * VeyraOS Server Actions Unit Tests — Product Catalog & Master Inventory (Stage 3.3 Batch 2 Substage 2.3)
 *
 * Menguji aksi server products.ts dalam lingkungan mock terisolasi:
 * - createProductAction
 * - getProductsAction
 * - getProductByIdAction
 * - updateProductAction
 * - archiveProductAction
 *
 * Menjamin kepatuhan terhadap prinsip:
 * 1. Validasi Zod pada boundary action: input cacat dihentikan sebelum memanggil service.
 * 2. Tenant Context resolution (eksplisit vs cookie veyra_active_business_id).
 * 3. Fail-Closed & Anti-Silent Fallback jika cookie rusak atau pengguna bukan anggota.
 * 4. Pendelegasian murni ke Product Service Layer tanpa bypass otorisasi.
 * 5. Perlindungan Integritas Ledger Finansial & Persediaan:
 *    - Penolakan mutasi langsung stock_quantity / cost_price (FORBIDDEN_FIELD_MUTATION).
 *    - Penolakan stok awal > 0 sebelum ada RPC atomik (ATOMIC_INITIAL_STOCK_UNAVAILABLE).
 * 6. Soft-delete archiving.
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

import {
  createProductAction,
  getProductsAction,
  getProductByIdAction,
  updateProductAction,
  archiveProductAction,
  type CreateProductActionInput,
} from "./products";
import * as productService from "@/services/products/product.service";
import * as businessService from "@/services/business/business.service";
import type { ProductItemResponse } from "@/types/api";

describe("Product Server Actions Suite (src/app/actions/products.ts)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const otherBusinessId = "22222222-2222-4222-a222-222222222222";
  const validProductId = "33333333-3333-4333-a333-333333333333";

  const sampleProductItem: ProductItemResponse = {
    id: validProductId,
    businessId: validBusinessId,
    name: "Kopi Arabika Gayo 250g",
    sku: "KOP-GAYO-01",
    category: "Minuman",
    sellingPrice: 75000,
    costPrice: 50000,
    stockQuantity: 0,
    isArchived: false,
    createdAt: "2026-10-14T00:00:00Z",
    updatedAt: "2026-10-14T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. createProductAction
  // ==========================================================================
  describe("createProductAction()", () => {
    it("1.1 menolak input null atau bukan object dan TIDAK memanggil service", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction(null as unknown as CreateProductActionInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.2 menolak nama produk kosong dan TIDAK memanggil service", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        businessId: validBusinessId,
        name: "",
        sellingPrice: 50000,
        costPrice: 35000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.name).toBeDefined();
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.3 menolak harga jual non-positif (<= 0) dan TIDAK memanggil service", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        businessId: validBusinessId,
        name: "Produk Murah",
        sellingPrice: 0,
        costPrice: 0,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.sellingPrice).toBeDefined();
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.4 menolak harga pokok (HPP) negatif (< 0) dan TIDAK memanggil service", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        businessId: validBusinessId,
        name: "Produk Minus",
        sellingPrice: 50000,
        costPrice: -1000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.costPrice).toBeDefined();
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.5 menolak pembuatan produk dengan stok awal > 0 (ATOMIC_INITIAL_STOCK_UNAVAILABLE) sebelum mutasi", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        businessId: validBusinessId,
        name: "Produk Stok Awal",
        sellingPrice: 50000,
        costPrice: 35000,
        stockQuantity: 15,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ATOMIC_INITIAL_STOCK_UNAVAILABLE");
        expect(result.error.message).toContain("stok awal > 0 memerlukan mekanisme transaksi atomik");
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.6 menolak jika format businessId eksplisit bukan UUID valid", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        businessId: "invalid-uuid-format",
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID bisnis tidak valid");
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.7 pembuatan produk berhasil dengan business ID eksplisit", async () => {
      const createSpy = vi
        .spyOn(productService, "createProduct")
        .mockResolvedValueOnce({
          success: true,
          data: sampleProductItem,
        });

      const result = await createProductAction({
        businessId: validBusinessId,
        name: "Kopi Arabika Gayo 250g",
        sku: "KOP-GAYO-01",
        category: "Minuman",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validProductId);
        expect(result.data.name).toBe("Kopi Arabika Gayo 250g");
        expect(result.data.stockQuantity).toBe(0);
      }
      expect(createSpy).toHaveBeenCalledWith({
        businessId: validBusinessId,
        name: "Kopi Arabika Gayo 250g",
        sku: "KOP-GAYO-01",
        category: "Minuman",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });
    });

    it("1.8 resolusi tenant dari cookie: saat businessId ditiadakan, membaca dari cookie veyra_active_business_id", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const createSpy = vi
        .spyOn(productService, "createProduct")
        .mockResolvedValueOnce({
          success: true,
          data: sampleProductItem,
        });

      const result = await createProductAction({
        name: "Kopi Arabika Gayo 250g",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(true);
      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          name: "Kopi Arabika Gayo 250g",
        })
      );
    });

    it("1.9 resolusi tenant saat cookie rusak/bukan UUID: membersihkan cookie dan menolak seketika (Fail-Closed)", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "corrupted-uuid-string" });
      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID bisnis pada preferensi aktif tidak valid");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.10 resolusi tenant saat cookie kosong: memanggil resolveTenantContext untuk default business", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);

      vi.spyOn(businessService, "resolveTenantContext").mockResolvedValueOnce({
        success: true,
        data: {
          hasBusiness: true,
          activeBusiness: {
            id: otherBusinessId,
            ownerId: "33333333-3333-4333-a333-333333333333",
            name: "Toko Cabang",
            category: "Retail",
            phone: null,
            address: null,
            currencyCode: "IDR",
            timezone: "Asia/Jakarta",
            createdAt: "2026-10-14T00:00:00Z",
            updatedAt: "2026-10-14T00:00:00Z",
          },
          role: "OWNER",
          availableBusinesses: [],
        },
      });

      const createSpy = vi
        .spyOn(productService, "createProduct")
        .mockResolvedValueOnce({
          success: true,
          data: { ...sampleProductItem, businessId: otherBusinessId },
        });

      const result = await createProductAction({
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: otherBusinessId,
        })
      );
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "veyra_active_business_id",
        otherBusinessId,
        expect.any(Object)
      );
    });

    it("1.11 penolakan ketika pengguna tidak memiliki bisnis aktif (ACTIVE_BUSINESS_REQUIRED)", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);

      vi.spyOn(businessService, "resolveTenantContext").mockResolvedValueOnce({
        success: true,
        data: {
          hasBusiness: false,
          activeBusiness: null,
          role: null,
          availableBusinesses: [],
        },
      });

      const createSpy = vi.spyOn(productService, "createProduct");

      const result = await createProductAction({
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ACTIVE_BUSINESS_REQUIRED");
      }
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("1.12 penolakan pengguna yang bukan anggota bisnis (UNAUTHORIZED_BUSINESS) dan pembersihan cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      vi.spyOn(productService, "createProduct").mockResolvedValueOnce({
        success: false,
        error: {
          code: "UNAUTHORIZED_BUSINESS",
          message: "Pengguna tidak terdaftar sebagai anggota pada bisnis ini",
        },
      });

      const result = await createProductAction({
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
    });

    it("1.13 kegagalan pembersihan cookie tidak melemahkan penolakan UNAUTHORIZED_BUSINESS", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });
      mockCookieStore.delete.mockImplementationOnce(() => {
        throw new Error("Cookie deletion failed");
      });

      vi.spyOn(productService, "createProduct").mockResolvedValueOnce({
        success: false,
        error: {
          code: "UNAUTHORIZED_BUSINESS",
          message: "Pengguna tidak terdaftar sebagai anggota pada bisnis ini",
        },
      });

      const result = await createProductAction({
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
    });

    it("1.14 pemetaan kegagalan autentikasi sesi (UNAUTHENTICATED) dari service", async () => {
      vi.spyOn(productService, "createProduct").mockResolvedValueOnce({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      });

      const result = await createProductAction({
        businessId: validBusinessId,
        name: "Kopi Arabika",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHENTICATED");
      }
    });
  });

  // ==========================================================================
  // 2. getProductsAction
  // ==========================================================================
  describe("getProductsAction()", () => {
    it("2.1 membaca daftar produk menggunakan cookie bisnis aktif saat params kosong", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const getProductsSpy = vi
        .spyOn(productService, "getProducts")
        .mockResolvedValueOnce({
          success: true,
          data: [sampleProductItem],
        });

      const result = await getProductsAction();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(validProductId);
      }
      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getProductsSpy).toHaveBeenCalledWith({
        businessId: validBusinessId,
      });
    });

    it("2.2 meneruskan seluruh parameter filter pencarian ke service layer", async () => {
      const getProductsSpy = vi
        .spyOn(productService, "getProducts")
        .mockResolvedValueOnce({
          success: true,
          data: [sampleProductItem],
        });

      const result = await getProductsAction({
        businessId: validBusinessId,
        query: "Gayo",
        category: "Minuman",
        lowStockOnly: true,
        includeArchived: false,
      });

      expect(result.success).toBe(true);
      expect(getProductsSpy).toHaveBeenCalledWith({
        businessId: validBusinessId,
        query: "Gayo",
        category: "Minuman",
        lowStockOnly: true,
        includeArchived: false,
      });
    });

    it("2.3 menolak jika format businessId tidak valid", async () => {
      const getProductsSpy = vi.spyOn(productService, "getProducts");

      const result = await getProductsAction({
        businessId: "invalid-uuid",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(getProductsSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. getProductByIdAction
  // ==========================================================================
  describe("getProductByIdAction()", () => {
    it("3.1 menolak jika productId bukan UUID valid dan TIDAK memanggil service", async () => {
      const getByIdSpy = vi.spyOn(productService, "getProductById");

      const result = await getProductByIdAction("not-a-uuid", validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.id).toBeDefined();
      }
      expect(getByIdSpy).not.toHaveBeenCalled();
    });

    it("3.2 membaca detail produk berhasil dengan businessId eksplisit", async () => {
      const getByIdSpy = vi
        .spyOn(productService, "getProductById")
        .mockResolvedValueOnce({
          success: true,
          data: sampleProductItem,
        });

      const result = await getProductByIdAction(validProductId, validBusinessId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Kopi Arabika Gayo 250g");
      }
      expect(getByIdSpy).toHaveBeenCalledWith(validProductId, validBusinessId);
    });

    it("3.3 membaca detail produk berhasil menggunakan active business cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const getByIdSpy = vi
        .spyOn(productService, "getProductById")
        .mockResolvedValueOnce({
          success: true,
          data: sampleProductItem,
        });

      const result = await getProductByIdAction(validProductId);

      expect(result.success).toBe(true);
      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getByIdSpy).toHaveBeenCalledWith(validProductId, validBusinessId);
    });

    it("3.4 memetakan error NOT_FOUND jika produk tidak ditemukan", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      vi.spyOn(productService, "getProductById").mockResolvedValueOnce({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Produk tidak ditemukan dalam katalog bisnis ini",
        },
      });

      const result = await getProductByIdAction(validProductId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  // ==========================================================================
  // 4. updateProductAction
  // ==========================================================================
  describe("updateProductAction()", () => {
    it("4.1 menolak mutasi langsung stockQuantity (FORBIDDEN_FIELD_MUTATION) dan TIDAK memanggil service", async () => {
      const updateSpy = vi.spyOn(productService, "updateProduct");

      const result = await updateProductAction(validProductId, {
        businessId: validBusinessId,
        stockQuantity: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN_FIELD_MUTATION");
        expect(result.error.message).toContain("Perubahan stock_quantity dan cost_price tidak diizinkan");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("4.2 menolak mutasi langsung costPrice (FORBIDDEN_FIELD_MUTATION) dan TIDAK memanggil service", async () => {
      const updateSpy = vi.spyOn(productService, "updateProduct");

      const result = await updateProductAction({
        productId: validProductId,
        businessId: validBusinessId,
        costPrice: 40000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN_FIELD_MUTATION");
        expect(result.error.message).toContain("Perubahan stock_quantity dan cost_price tidak diizinkan");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("4.3 menolak jika productId bukan UUID valid", async () => {
      const updateSpy = vi.spyOn(productService, "updateProduct");

      const result = await updateProductAction("invalid-id", {
        businessId: validBusinessId,
        name: "Nama Baru",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.id).toBeDefined();
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("4.4 pembaruan metadata produk berhasil dengan signature (id, input)", async () => {
      const updatedProduct = {
        ...sampleProductItem,
        name: "Kopi Arabika Gayo Super 250g",
        sellingPrice: 80000,
      };

      const updateSpy = vi
        .spyOn(productService, "updateProduct")
        .mockResolvedValueOnce({
          success: true,
          data: updatedProduct,
        });

      const result = await updateProductAction(validProductId, {
        businessId: validBusinessId,
        name: "Kopi Arabika Gayo Super 250g",
        sellingPrice: 80000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Kopi Arabika Gayo Super 250g");
        expect(result.data.sellingPrice).toBe(80000);
      }
      expect(updateSpy).toHaveBeenCalledWith(
        validProductId,
        expect.objectContaining({
          productId: validProductId,
          businessId: validBusinessId,
          name: "Kopi Arabika Gayo Super 250g",
          sellingPrice: 80000,
        })
      );
    });

    it("4.5 pembaruan metadata produk berhasil dengan signature objek gabungan ({ productId, ...input })", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const updatedProduct = {
        ...sampleProductItem,
        category: "Kopi Spesialti",
      };

      const updateSpy = vi
        .spyOn(productService, "updateProduct")
        .mockResolvedValueOnce({
          success: true,
          data: updatedProduct,
        });

      const result = await updateProductAction({
        productId: validProductId,
        category: "Kopi Spesialti",
      });

      expect(result.success).toBe(true);
      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(updateSpy).toHaveBeenCalledWith(
        validProductId,
        expect.objectContaining({
          productId: validProductId,
          businessId: validBusinessId,
          category: "Kopi Spesialti",
        })
      );
    });
  });

  // ==========================================================================
  // 5. archiveProductAction
  // ==========================================================================
  describe("archiveProductAction()", () => {
    it("5.1 menolak jika productId bukan UUID valid dan TIDAK memanggil service", async () => {
      const archiveSpy = vi.spyOn(productService, "archiveProduct");

      const result = await archiveProductAction("invalid-product-id", validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.id).toBeDefined();
      }
      expect(archiveSpy).not.toHaveBeenCalled();
    });

    it("5.2 pengarsipan produk (soft-delete) berhasil dengan signature (id, businessId)", async () => {
      const archivedProduct = {
        ...sampleProductItem,
        isArchived: true,
      };

      const archiveSpy = vi
        .spyOn(productService, "archiveProduct")
        .mockResolvedValueOnce({
          success: true,
          data: archivedProduct,
        });

      const result = await archiveProductAction(validProductId, validBusinessId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isArchived).toBe(true);
      }
      expect(archiveSpy).toHaveBeenCalledWith(validProductId, validBusinessId);
    });

    it("5.3 pengarsipan produk berhasil menggunakan cookie bisnis aktif dan signature objek", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const archivedProduct = {
        ...sampleProductItem,
        isArchived: true,
      };

      const archiveSpy = vi
        .spyOn(productService, "archiveProduct")
        .mockResolvedValueOnce({
          success: true,
          data: archivedProduct,
        });

      const result = await archiveProductAction({ productId: validProductId });

      expect(result.success).toBe(true);
      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(archiveSpy).toHaveBeenCalledWith(validProductId, validBusinessId);
    });

    it("5.4 pemetaan error NOT_FOUND jika produk yang akan diarsipkan tidak ditemukan", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      vi.spyOn(productService, "archiveProduct").mockResolvedValueOnce({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Produk tidak ditemukan dalam katalog bisnis ini",
        },
      });

      const result = await archiveProductAction(validProductId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });
});
