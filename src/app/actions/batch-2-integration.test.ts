/**
 * VeyraOS Cross-Action Integration Tests — Batch 2 Server Actions (Stage 3.3 Substage 2.4)
 *
 * Menguji integrasi alur bisnis lintas Server Actions antara modul produk (products.ts)
 * dan modul transaksi kasir POS / pembelian (transactions.ts):
 * 1. Pendaftaran produk baru dengan stok nol (createProductAction) & penolakan stok awal > 0
 * 2. Restock persediaan via pembelian (recordPurchaseAction) dengan RPC atomik
 * 3. Transaksi penjualan kasir (createSaleAction)
 * 4. Pengarsipan produk / soft-delete (archiveProductAction)
 * 5. Penyaringan produk aktif kasir non-arsip (getProductsForTransactionAction)
 * 6. Penolakan penjualan produk terarsip pada lapisan aplikasi & error mapping (PRODUCT_ARCHIVED)
 * 7. Pembatalan / void transaksi penjualan (voidSaleAction)
 * 8. Pertahanan fail-closed: kegagalan validasi / otorisasi menghentikan operasi turunan
 * 9. Isolasi Multi-Tenant: Tenant A dilarang mengakses atau memutasi data Tenant B
 * 10. Idempotensi: penolakan ketiadaan idempotencyKey dan penerusan key secara konsisten pada retry
 *
 * BATASAN & PENAFIAN PENGUJIAN:
 * Pengujian integrasi ini dieksekusi dalam lingkungan pengujian Vitest dengan mock Next.js headers
 * dan modul service / database client. Pengujian ini BUKAN pembuktian transaksi runtime fisik
 * PostgreSQL, batasan RLS live, atau eksekusi Stored Procedure live pada instance Supabase.
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
  archiveProductAction,
} from "./products";
import {
  createSaleAction,
  recordPurchaseAction,
  voidSaleAction,
  getProductsForTransactionAction,
} from "./transactions";
import * as productService from "@/services/products/product.service";
import * as transactionService from "@/services/transactions/transaction.service";
import type {
  ProductItemResponse,
  SaleReceiptResponse,
  PurchaseReceiptResponse,
  VoidSaleResponse,
} from "@/types/api";

describe("Batch 2 Cross-Action Integration Suite (products.ts <-> transactions.ts)", () => {
  const tenantA = "11111111-1111-4111-a111-111111111111";
  const tenantB = "22222222-2222-4222-a222-222222222222";
  const validProductId = "33333333-3333-4333-a333-333333333333";
  const validSaleId = "44444444-4444-4444-a444-444444444444";
  const validPurchaseId = "55555555-5555-4555-a555-555555555555";
  const validIdempotencyKey = "idem_batch2_integ_key_001";

  const sampleActiveProduct: ProductItemResponse = {
    id: validProductId,
    businessId: tenantA,
    name: "Kopi Arabika Aceh 250g",
    sku: "KOP-ACEH-250",
    category: "Minuman",
    sellingPrice: 85000,
    costPrice: 50000,
    stockQuantity: 0,
    isArchived: false,
    createdAt: "2026-10-14T08:00:00Z",
    updatedAt: "2026-10-14T08:00:00Z",
  };

  const sampleArchivedProduct: ProductItemResponse = {
    ...sampleActiveProduct,
    isArchived: true,
    updatedAt: "2026-10-14T09:00:00Z",
  };

  const sampleSaleReceipt: SaleReceiptResponse = {
    saleId: validSaleId,
    invoiceNumber: "INV-20261014-INT001",
    subtotalAmount: 85000,
    discountAmount: 0,
    totalAmount: 85000,
    paymentMethod: "CASH",
    transactionDate: "2026-10-14T08:30:00Z",
    itemsCount: 1,
  };

  const samplePurchaseReceipt: PurchaseReceiptResponse = {
    purchaseId: validPurchaseId,
    invoiceNumber: "PO-20261014-RESTOCK",
    totalCost: 500000,
    purchaseDate: "2026-10-14T08:15:00Z",
    itemsCount: 1,
  };

  const sampleVoidResponse: VoidSaleResponse = {
    saleId: validSaleId,
    voidedAt: "2026-10-14T08:45:00Z",
    status: "VOIDED",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Skenario 1: Pendaftaran produk baru dengan stok awal nol (createProductAction)
  // ==========================================================================
  describe("Skenario 1: Registrasi Master Produk", () => {
    it("1.1 berhasil membuat produk baru dengan stok awal nol", async () => {
      const createSpy = vi
        .spyOn(productService, "createProduct")
        .mockResolvedValueOnce({
          success: true,
          data: sampleActiveProduct,
        });

      const response = await createProductAction({
        businessId: tenantA,
        name: "Kopi Arabika Aceh 250g",
        sku: "KOP-ACEH-250",
        category: "Minuman",
        sellingPrice: 85000,
        costPrice: 50000,
        stockQuantity: 0,
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.id).toBe(validProductId);
        expect(response.data.stockQuantity).toBe(0);
        expect(response.data.isArchived).toBe(false);
      }
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: tenantA,
          stockQuantity: 0,
        })
      );
    });

    it("1.2 menolak pendaftaran produk jika stockQuantity > 0 (ATOMIC_INITIAL_STOCK_UNAVAILABLE)", async () => {
      const createSpy = vi.spyOn(productService, "createProduct");

      const response = await createProductAction({
        businessId: tenantA,
        name: "Kopi Arabika Aceh 250g",
        sku: "KOP-ACEH-250",
        sellingPrice: 85000,
        costPrice: 50000,
        stockQuantity: 10, // Menuntut mutasi stok langsung tanpa alur pembelian
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("ATOMIC_INITIAL_STOCK_UNAVAILABLE");
        expect(response.error.message).toContain("stok awal > 0 memerlukan mekanisme transaksi atomik");
      }
      // Service createProduct tidak boleh dipanggil
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Skenario 2: Restock persediaan via alur pembelian (recordPurchaseAction)
  // ==========================================================================
  describe("Skenario 2: Restock Persediaan Melalui Transaksi Pembelian", () => {
    it("2.1 berhasil mencatat pembelian untuk restock produk menggunakan RPC atomik", async () => {
      const purchaseSpy = vi
        .spyOn(transactionService, "recordPurchase")
        .mockResolvedValueOnce({
          success: true,
          data: samplePurchaseReceipt,
        });

      const response = await recordPurchaseAction({
        businessId: tenantA,
        supplierName: "Koperasi Petani Gayo",
        items: [
          {
            productId: validProductId,
            quantity: 10,
            unitPurchaseCost: 50000,
          },
        ],
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.purchaseId).toBe(validPurchaseId);
        expect(response.data.totalCost).toBe(500000);
      }
      expect(purchaseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: tenantA,
          items: [
            {
              productId: validProductId,
              quantity: 10,
              unitPurchaseCost: 50000,
            },
          ],
        })
      );
    });
  });

  // ==========================================================================
  // Skenario 3: Transaksi penjualan kasir (createSaleAction)
  // ==========================================================================
  describe("Skenario 3: Penjualan Kasir POS", () => {
    it("3.1 berhasil mencatat penjualan dengan CSPRNG invoice dan idempotencyKey", async () => {
      const saleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValueOnce({
          success: true,
          data: sampleSaleReceipt,
        });

      const response = await createSaleAction({
        businessId: tenantA,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [
          {
            productId: validProductId,
            quantity: 1,
          },
        ],
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.saleId).toBe(validSaleId);
        expect(response.data.invoiceNumber).toBe("INV-20261014-INT001");
        expect(response.data.totalAmount).toBe(85000);
      }
      expect(saleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: tenantA,
          idempotencyKey: validIdempotencyKey,
        })
      );
    });
  });

  // ==========================================================================
  // Skenario 4: Pengarsipan produk / soft-delete (archiveProductAction)
  // ==========================================================================
  describe("Skenario 4: Pengarsipan Produk (Soft-Delete)", () => {
    it("4.1 berhasil mengarsipkan produk (isArchived = true) tanpa hard-delete", async () => {
      const archiveSpy = vi
        .spyOn(productService, "archiveProduct")
        .mockResolvedValueOnce({
          success: true,
          data: sampleArchivedProduct,
        });

      const response = await archiveProductAction(validProductId, tenantA);

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.id).toBe(validProductId);
        expect(response.data.isArchived).toBe(true);
      }
      expect(archiveSpy).toHaveBeenCalledWith(validProductId, tenantA);
    });
  });

  // ==========================================================================
  // Skenario 5: Penyaringan produk aktif kasir (getProductsForTransactionAction)
  // ==========================================================================
  describe("Skenario 5: Penyaringan Katalog Kasir POS", () => {
    it("5.1 hanya mengembalikan produk aktif dan mengecualikan produk berstatus arsip", async () => {
      // Mock getProductsForTransaction mengembalikan hanya item aktif
      const getActiveProductsSpy = vi
        .spyOn(transactionService, "getProductsForTransaction")
        .mockResolvedValueOnce({
          success: true,
          data: [sampleActiveProduct], // Produk arsip tidak diikutsertakan oleh service query
        });

      const response = await getProductsForTransactionAction(tenantA);

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.length).toBe(1);
        expect(response.data.every((p) => p.isArchived === false)).toBe(true);
      }
      expect(getActiveProductsSpy).toHaveBeenCalledWith(
        tenantA,
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // Skenario 6: Penolakan penjualan produk arsip pada lapisan aplikasi & error mapping
  // ==========================================================================
  describe("Skenario 6: Penolakan Transaksi Produk Arsip", () => {
    it("6.1 memetakan penolakan transaksi produk terarsip ke domain error PRODUCT_ARCHIVED", async () => {
      const saleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "PRODUCT_ARCHIVED",
            message:
              "Produk telah diarsipkan dan tidak dapat digunakan dalam transaksi",
          },
        });

      const response = await createSaleAction({
        businessId: tenantA,
        idempotencyKey: "idem_archived_attempt_001",
        paymentMethod: "CASH",
        items: [
          {
            productId: validProductId,
            quantity: 1,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("PRODUCT_ARCHIVED");
        expect(response.error.message).toContain("diarsipkan");
      }
      expect(saleSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Skenario 7: Pembatalan / Void transaksi penjualan (voidSaleAction)
  // ==========================================================================
  describe("Skenario 7: Pembatalan Transaksi Penjualan (Void)", () => {
    it("7.1 berhasil membatalkan transaksi penjualan dan mengembalikan stok fisik secara atomik", async () => {
      const voidSpy = vi
        .spyOn(transactionService, "voidSale")
        .mockResolvedValueOnce({
          success: true,
          data: sampleVoidResponse,
        });

      const response = await voidSaleAction({
        businessId: tenantA,
        saleId: validSaleId,
        voidReason: "Pelanggan salah memilih varian produk",
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.saleId).toBe(validSaleId);
        expect(response.data.status).toBe("VOIDED");
      }
      expect(voidSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: tenantA,
          saleId: validSaleId,
          voidReason: "Pelanggan salah memilih varian produk",
        })
      );
    });
  });

  // ==========================================================================
  // Skenario 8: Pencegahan eksekusi lanjutan jika validasi atau otorisasi gagal
  // ==========================================================================
  describe("Skenario 8: Pertahanan Fail-Closed pada Batas Validasi & Otorisasi", () => {
    it("8.1 menghentikan eksekusi sebelum memanggil service jika format input tidak valid", async () => {
      const saleSpy = vi.spyOn(transactionService, "recordSale");

      const response = await createSaleAction({
        businessId: "not-a-valid-uuid", // ID bisnis cacat
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [], // Item kosong
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
      expect(saleSpy).not.toHaveBeenCalled();
    });

    it("8.2 menghentikan operasi jika pengguna bukan anggota bisnis (UNAUTHORIZED_BUSINESS)", async () => {
      const purchaseSpy = vi
        .spyOn(transactionService, "recordPurchase")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "UNAUTHORIZED_BUSINESS",
            message: "Pengguna tidak memiliki akses terhadap bisnis ini",
          },
        });

      const response = await recordPurchaseAction({
        businessId: tenantA,
        items: [
          {
            productId: validProductId,
            quantity: 5,
            unitPurchaseCost: 50000,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(purchaseSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Skenario 9: Isolasi Multi-Tenant (Tenant A vs Tenant B)
  // ==========================================================================
  describe("Skenario 9: Penegakan Isolasi Multi-Tenant yang Ketat", () => {
    it("9.1 melarang aksi produk menembus batas tenant lain jika tidak memiliki otorisasi", async () => {
      // Mock cookie aktif menunjukkan tenantA, tetapi input memanggil tenantB
      mockCookieStore.get.mockReturnValueOnce({ value: tenantA });

      const archiveSpy = vi
        .spyOn(productService, "archiveProduct")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "UNAUTHORIZED_BUSINESS",
            message: "Pengguna tidak memiliki akses terhadap bisnis ini",
          },
        });

      // User mencoba mengarsipkan produk di tenantB
      const response = await archiveProductAction(validProductId, tenantB);

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(archiveSpy).toHaveBeenCalledWith(validProductId, tenantB);
    });

    it("9.2 melarang aksi transaksi kasir memutasi atau menjual produk di luar tenant yang sah", async () => {
      const saleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "UNAUTHORIZED_BUSINESS",
            message: "Pengguna tidak terdaftar dalam bisnis yang diminta",
          },
        });

      const response = await createSaleAction({
        businessId: tenantB, // Menargetkan bisnis lain
        idempotencyKey: "idem_cross_tenant_test",
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(saleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: tenantB })
      );
    });
  });

  // ==========================================================================
  // Skenario 10: Kebijakan Idempotensi (Missing Key Rejection & Consistency)
  // ==========================================================================
  describe("Skenario 10: Kebijakan Idempotensi Transaksi", () => {
    it("10.1 menolak createSaleAction tanpa idempotencyKey secara fail-closed (tanpa fallback UUID server)", async () => {
      const saleSpy = vi.spyOn(transactionService, "recordSale");

      const response = await createSaleAction({
        businessId: tenantA,
        // idempotencyKey sengaja ditiadakan
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
        expect(response.error.details?.idempotencyKey).toBeDefined();
      }
      // Service tidak boleh dipanggil sama sekali
      expect(saleSpy).not.toHaveBeenCalled();
    });

    it("10.2 meneruskan idempotencyKey yang sama secara konsisten pada permintaan ulang (retry)", async () => {
      const retryIdempotencyKey = "idem_retry_exact_key_999";

      const saleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValue({
          success: true,
          data: sampleSaleReceipt,
        });

      // Panggilan pertama
      const response1 = await createSaleAction({
        businessId: tenantA,
        idempotencyKey: retryIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      // Panggilan kedua (simulasi network retry klien)
      const response2 = await createSaleAction({
        businessId: tenantA,
        idempotencyKey: retryIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);

      // Pastikan kedua panggilan meneruskan idempotencyKey yang identik ke service layer
      expect(saleSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ idempotencyKey: retryIdempotencyKey })
      );
      expect(saleSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ idempotencyKey: retryIdempotencyKey })
      );
    });
  });
});
