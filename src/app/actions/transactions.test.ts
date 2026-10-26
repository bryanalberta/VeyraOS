/**
 * VeyraOS Server Actions Unit Tests — POS Transactions & Purchases (Stage 3.3 Batch 2)
 *
 * Menguji aksi server transactions.ts dalam lingkungan mock terisolasi:
 * - createSaleAction
 * - recordPurchaseAction
 * - voidSaleAction
 * - getProductsForTransactionAction
 *
 * Menjamin kepatuhan terhadap prinsip:
 * 1. Validasi Zod pada boundary action: input cacat dihentikan sebelum memanggil service.
 * 2. Tenant Context resolution (eksplisit vs cookie veyra_active_business_id).
 * 3. Fail-Closed & Anti-Silent Fallback jika cookie rusak atau pengguna bukan anggota.
 * 4. Pendelegasian murni ke Transaction Service Layer tanpa rekalkulasi finansial ad-hoc.
 * 5. Pemetaan error domain terpadu (STOCK_INSUFFICIENT, PRODUCT_ARCHIVED, UNAUTHORIZED_BUSINESS, dll.).
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
  createSaleAction,
  recordPurchaseAction,
  voidSaleAction,
  getProductsForTransactionAction,
  type CreateSaleActionInput,
} from "./transactions";
import * as transactionService from "@/services/transactions/transaction.service";
import * as businessService from "@/services/business/business.service";
import type {
  SaleReceiptResponse,
  PurchaseReceiptResponse,
  VoidSaleResponse,
  ProductItemResponse,
} from "@/types/api";
import type { PaymentMethod } from "@/types/database";

describe("Transaction Server Actions Suite (src/app/actions/transactions.ts)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const otherBusinessId = "22222222-2222-4222-a222-222222222222";
  const validProductId = "33333333-3333-4333-a333-333333333333";
  const validSaleId = "44444444-4444-4444-a444-444444444444";
  const validIdempotencyKey = "idem_key_test_12345";

  const sampleSaleReceipt: SaleReceiptResponse = {
    saleId: validSaleId,
    invoiceNumber: "INV-20261014-ABCDEF",
    subtotalAmount: 150000,
    discountAmount: 10000,
    totalAmount: 140000,
    paymentMethod: "CASH",
    transactionDate: "2026-10-14T02:00:00Z",
    itemsCount: 1,
  };

  const samplePurchaseReceipt: PurchaseReceiptResponse = {
    purchaseId: "55555555-5555-4555-a555-555555555555",
    invoiceNumber: "PO-20261014-XYZ789",
    totalCost: 500000,
    purchaseDate: "2026-10-14T02:00:00Z",
    itemsCount: 1,
  };

  const sampleVoidResponse: VoidSaleResponse = {
    saleId: validSaleId,
    status: "VOIDED",
    voidedAt: "2026-10-14T02:30:00Z",
  };

  const sampleProductItem: ProductItemResponse = {
    id: validProductId,
    businessId: validBusinessId,
    name: "Beras Premium 5kg",
    sku: "BRS-01",
    category: "Sembako",
    sellingPrice: 75000,
    costPrice: 60000,
    stockQuantity: 20,
    isArchived: false,
    createdAt: "2026-10-14T00:00:00Z",
    updatedAt: "2026-10-14T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. createSaleAction
  // ==========================================================================
  describe("createSaleAction()", () => {
    it("1.1 menolak input tidak valid (bukan object atau null) dan TIDAK memanggil service", async () => {
      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction(null as unknown as CreateSaleActionInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });

    it("1.2 menolak keranjang kosong (items = []) dan TIDAK memanggil service", async () => {
      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction({
        businessId: validBusinessId,
        paymentMethod: "CASH",
        items: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.items).toBeDefined();
        expect(result.error.details?.items[0]).toContain("Minimal harus ada 1 item");
      }
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });

    it("1.3 menolak diskon negatif atau metode pembayaran tidak sah dan TIDAK memanggil service", async () => {
      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction({
        businessId: validBusinessId,
        paymentMethod: "CREDIT_CARD" as unknown as PaymentMethod,
        transactionDiscount: -5000,
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.paymentMethod).toBeDefined();
        expect(result.error.details?.transactionDiscount).toBeDefined();
      }
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });

    it("1.4 menolak kunci idempotensi yang terlalu pendek (< 8 karakter)", async () => {
      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction({
        businessId: validBusinessId,
        idempotencyKey: "short",
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.idempotencyKey).toBeDefined();
      }
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });

    it("1.5 penjualan berhasil dengan business ID eksplisit", async () => {
      const recordSaleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValueOnce({
          success: true,
          data: sampleSaleReceipt,
        });

      const result = await createSaleAction({
        businessId: validBusinessId,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 2, itemDiscount: 0 }],
        transactionDiscount: 10000,
        notes: "Penjualan Kasir POS 1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleId).toBe(validSaleId);
        expect(result.data.invoiceNumber).toBe("INV-20261014-ABCDEF");
        expect(result.data.totalAmount).toBe(140000);
      }
      expect(recordSaleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          paymentMethod: "CASH",
          idempotencyKey: validIdempotencyKey,
          transactionDiscount: 10000,
        })
      );
    });

    it("1.6 resolusi tenant dari cookie: saat businessId ditiadakan, membaca dari cookie veyra_active_business_id", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const recordSaleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValueOnce({
          success: true,
          data: sampleSaleReceipt,
        });

      const result = await createSaleAction({
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "BANK_TRANSFER",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(true);
      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(recordSaleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          paymentMethod: "BANK_TRANSFER",
        })
      );
    });

    it("1.7 resolusi tenant saat cookie rusak/bukan UUID: membersihkan cookie dan menolak seketika (Fail-Closed)", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "corrupted-invalid-uuid" });
      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction({
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID bisnis pada preferensi aktif tidak valid");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });

    it("1.8 resolusi tenant saat cookie kosong: memanggil resolveTenantContext untuk default business", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);

      vi.spyOn(businessService, "resolveTenantContext").mockResolvedValueOnce({
        success: true,
        data: {
          hasBusiness: true,
          activeBusiness: {
            id: otherBusinessId,
            ownerId: "22222222-2222-4222-a222-222222222222",
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

      const recordSaleSpy = vi
        .spyOn(transactionService, "recordSale")
        .mockResolvedValueOnce({
          success: true,
          data: sampleSaleReceipt,
        });

      const result = await createSaleAction({
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(true);
      expect(recordSaleSpy).toHaveBeenCalledWith(
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

    it("1.9 penolakan ketika pengguna tidak memiliki bisnis aktif (ACTIVE_BUSINESS_REQUIRED)", async () => {
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

      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction({
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ACTIVE_BUSINESS_REQUIRED");
      }
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });

    it("1.10 penolakan pengguna yang bukan anggota bisnis (UNAUTHORIZED_BUSINESS) dan pembersihan cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      vi.spyOn(transactionService, "recordSale").mockResolvedValueOnce({
        success: false,
        error: {
          code: "UNAUTHORIZED_BUSINESS",
          message: "Pengguna tidak terdaftar sebagai anggota pada bisnis ini",
        },
      });

      const result = await createSaleAction({
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      // Memastikan cookie yang tidak sah dibersihkan
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
    });

    it("1.11 pemetaan kegagalan autentikasi sesi (UNAUTHENTICATED) dari service", async () => {
      vi.spyOn(transactionService, "recordSale").mockResolvedValueOnce({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      });

      const result = await createSaleAction({
        businessId: validBusinessId,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("1.12 pemetaan kegagalan RPC database STOCK_INSUFFICIENT secara aman", async () => {
      vi.spyOn(transactionService, "recordSale").mockResolvedValueOnce({
        success: false,
        error: {
          code: "STOCK_INSUFFICIENT",
          message: 'Produk "Beras Premium 5kg" sisa 2, diminta total 5',
        },
      });

      const result = await createSaleAction({
        businessId: validBusinessId,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 5 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STOCK_INSUFFICIENT");
        expect(result.error.message).toContain("sisa 2, diminta total 5");
      }
    });

    it("1.13 pemetaan kegagalan RPC database PRODUCT_ARCHIVED (kontrak error terencana)", async () => {
      vi.spyOn(transactionService, "recordSale").mockResolvedValueOnce({
        success: false,
        error: {
          code: "PRODUCT_ARCHIVED",
          message: 'Produk "Beras Premium 5kg" telah diarsipkan dan tidak dapat dijual',
        },
      });

      const result = await createSaleAction({
        businessId: validBusinessId,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PRODUCT_ARCHIVED");
        expect(result.error.message).toContain("telah diarsipkan");
      }
    });

    it("1.14 menolak transaksi jika idempotencyKey tidak disertakan atau kosong (SEC-3.3-06 fail-closed)", async () => {
      const recordSaleSpy = vi.spyOn(transactionService, "recordSale");

      const result = await createSaleAction({
        businessId: validBusinessId,
        paymentMethod: "CASH",
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.idempotencyKey).toBeDefined();
      }
      expect(recordSaleSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. recordPurchaseAction
  // ==========================================================================
  describe("recordPurchaseAction()", () => {
    it("2.1 menolak input pembelian dengan items kosong dan TIDAK memanggil service", async () => {
      const recordPurchaseSpy = vi.spyOn(transactionService, "recordPurchase");

      const result = await recordPurchaseAction({
        businessId: validBusinessId,
        items: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.items).toBeDefined();
      }
      expect(recordPurchaseSpy).not.toHaveBeenCalled();
    });

    it("2.2 pembelian persediaan (restock) berhasil melalui service", async () => {
      const recordPurchaseSpy = vi
        .spyOn(transactionService, "recordPurchase")
        .mockResolvedValueOnce({
          success: true,
          data: samplePurchaseReceipt,
        });

      const result = await recordPurchaseAction({
        businessId: validBusinessId,
        supplierName: "PT Sumber Pangan Sejahtera",
        items: [
          {
            productId: validProductId,
            quantity: 10,
            unitPurchaseCost: 50000,
          },
        ],
        notes: "Restock Beras Mingguan",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purchaseId).toBe("55555555-5555-4555-a555-555555555555");
        expect(result.data.totalCost).toBe(500000);
      }
      expect(recordPurchaseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          supplierName: "PT Sumber Pangan Sejahtera",
        })
      );
    });

    it("2.3 pembelian persediaan berhasil dengan resolusi tenant dari cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const recordPurchaseSpy = vi
        .spyOn(transactionService, "recordPurchase")
        .mockResolvedValueOnce({
          success: true,
          data: samplePurchaseReceipt,
        });

      const result = await recordPurchaseAction({
        items: [
          {
            productId: validProductId,
            quantity: 5,
            unitPurchaseCost: 60000,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(recordPurchaseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
        })
      );
    });
  });

  // ==========================================================================
  // 3. voidSaleAction
  // ==========================================================================
  describe("voidSaleAction()", () => {
    it("3.1 menolak alasan pembatalan yang terlalu pendek (< 5 karakter) dan TIDAK memanggil service", async () => {
      const voidSaleSpy = vi.spyOn(transactionService, "voidSale");

      const result = await voidSaleAction({
        businessId: validBusinessId,
        saleId: validSaleId,
        voidReason: "bad", // Hanya 3 karakter
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.voidReason).toBeDefined();
        expect(result.error.details?.voidReason[0]).toContain("minimal 5 karakter");
      }
      expect(voidSaleSpy).not.toHaveBeenCalled();
    });

    it("3.2 void penjualan berhasil dieksekusi melalui service", async () => {
      const voidSaleSpy = vi
        .spyOn(transactionService, "voidSale")
        .mockResolvedValueOnce({
          success: true,
          data: sampleVoidResponse,
        });

      const result = await voidSaleAction({
        businessId: validBusinessId,
        saleId: validSaleId,
        voidReason: "Pelanggan membatalkan pesanan di kasir",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("VOIDED");
        expect(result.data.saleId).toBe(validSaleId);
      }
      expect(voidSaleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          saleId: validSaleId,
          voidReason: "Pelanggan membatalkan pesanan di kasir",
        })
      );
    });

    it("3.3 memetakan error SALE_ALREADY_VOIDED dari service", async () => {
      vi.spyOn(transactionService, "voidSale").mockResolvedValueOnce({
        success: false,
        error: {
          code: "SALE_ALREADY_VOIDED",
          message: "Transaksi penjualan ini sudah pernah dibatalkan sebelumnya",
        },
      });

      const result = await voidSaleAction({
        businessId: validBusinessId,
        saleId: validSaleId,
        voidReason: "Salah input nominal pembayaran",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SALE_ALREADY_VOIDED");
      }
    });
  });

  // ==========================================================================
  // 4. getProductsForTransactionAction
  // ==========================================================================
  describe("getProductsForTransactionAction()", () => {
    it("4.1 membaca daftar produk kasir berhasil menggunakan active tenant cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const getProductsSpy = vi
        .spyOn(transactionService, "getProductsForTransaction")
        .mockResolvedValueOnce({
          success: true,
          data: [sampleProductItem],
        });

      const result = await getProductsForTransactionAction();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe("Beras Premium 5kg");
      }
      expect(getProductsSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ query: undefined })
      );
    });

    it("4.2 meneruskan filter pencarian query ke service layer", async () => {
      const getProductsSpy = vi
        .spyOn(transactionService, "getProductsForTransaction")
        .mockResolvedValueOnce({
          success: true,
          data: [sampleProductItem],
        });

      const result = await getProductsForTransactionAction(validBusinessId, "Beras");

      expect(result.success).toBe(true);
      expect(getProductsSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ query: "Beras" })
      );
    });

    it("4.3 menolak jika format businessId eksplisit tidak valid", async () => {
      const getProductsSpy = vi.spyOn(transactionService, "getProductsForTransaction");

      const result = await getProductsForTransactionAction("invalid-uuid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(getProductsSpy).not.toHaveBeenCalled();
    });
  });
});
