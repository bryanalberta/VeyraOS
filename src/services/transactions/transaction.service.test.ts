import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordSale,
  recordPurchase,
  voidSale,
  getProductsForTransaction,
} from "./transaction.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecordSaleInput,
  RecordPurchaseInput,
  VoidSaleInput,
} from "@/types/api";

describe("Transaction Service Layer Suite (src/services/transactions)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const validUserId = "22222222-2222-4222-a222-222222222222";
  const validProductId = "33333333-3333-4333-a333-333333333333";
  const validSaleId = "44444444-4444-4444-a444-444444444444";
  const validIdempotencyKey = "idem_key_test_12345";

  let mockSupabase: SupabaseClient;
  let mockRpc: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockAuth: { getUser: ReturnType<typeof vi.fn> };
  let updateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRpc = vi.fn();
    updateSpy = vi.fn();

    mockFrom = vi.fn((table: string) => {
      if (table === "business_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: "OWNER" },
            error: null,
          }),
        };
      }

      if (table === "products") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: validProductId,
                business_id: validBusinessId,
                name: "Beras Premium 5kg",
                sku: "BRS-01",
                category: "Sembako",
                selling_price: 75000,
                cost_price: 60000,
                stock_quantity: 25,
                is_archived: false,
                created_at: "2026-10-13T10:00:00Z",
                updated_at: "2026-10-13T10:00:00Z",
              },
            ],
            error: null,
          }),
          update: updateSpy, // Untuk memverifikasi service TIDAK memutasi stok secara langsung
        };
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
      rpc: mockRpc,
    } as unknown as SupabaseClient;
  });

  describe("1. recordSale", () => {
    const validSaleInput: RecordSaleInput = {
      businessId: validBusinessId,
      idempotencyKey: validIdempotencyKey,
      paymentMethod: "CASH",
      items: [{ productId: validProductId, quantity: 2, itemDiscount: 0 }],
      transactionDiscount: 5000,
      notes: "Nota Penjualan Tunai",
    };

    it("berhasil mencatat penjualan, menggunakan invoice server, memanggil RPC, dan memformat respon", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          sale_id: "sale-new-uuid-001",
          invoice_number: "INV-20261013-ABCDEF12",
          subtotal_amount: 150000,
          discount_amount: 5000,
          total_amount: 145000,
          payment_method: "CASH",
          transaction_date: "2026-10-13T12:00:00Z",
          items_count: 1,
        },
        error: null,
      });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.saleId).toBe("sale-new-uuid-001");
        expect(response.data.invoiceNumber).toMatch(/^INV-/);
        expect(response.data.totalAmount).toBe(145000);
        expect(response.data.paymentMethod).toBe("CASH");
      }

      // Verifikasi RPC dipanggil dengan parameter yang benar
      expect(mockRpc).toHaveBeenCalledWith("record_sale_transaction", expect.objectContaining({
        p_business_id: validBusinessId,
        p_payment_method: "CASH",
        p_discount_amount: 5000,
        p_idempotency_key: validIdempotencyKey,
      }));

      // Buktikan TIDAK ADA mutasi stok langsung dari service
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("menolak transaksi jika input tidak lolos validasi Zod tanpa memanggil database", async () => {
      const invalidInput = {
        businessId: validBusinessId,
        idempotencyKey: "short", // < 8 karakter
        paymentMethod: "INVALID_METHOD",
        items: [], // Kosong!
      } as unknown as RecordSaleInput;

      const response = await recordSale(invalidInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
        expect(response.error.details).toBeDefined();
      }

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("menolak transaksi jika pengguna belum terautentikasi (unauthenticated)", async () => {
      mockAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("UNAUTHENTICATED");
      }

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("menolak transaksi jika pengguna bukan anggota bisnis pemilik (unauthorized)", async () => {
      mockFrom.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // Bukan anggota!
      }));

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("memetakan error RPC STOCK_INSUFFICIENT dengan pesan ramah", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'STOCK_INSUFFICIENT: Produk "Beras" sisa 1, diminta 2' },
      });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("STOCK_INSUFFICIENT");
        expect(response.error.message).toContain("sisa 1, diminta 2");
      }
    });

    it("memetakan error RPC IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD" },
      });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
      }
    });

    it("memetakan benturan invoice PostgreSQL (code 23505 pada uq_sales_invoice) menjadi INVOICE_COLLISION", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_sales_invoice"' },
      });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("INVOICE_COLLISION");
      }
    });

    it("menangani respon RPC yang tidak sesuai kontrak (malformed RPC response)", async () => {
      mockRpc.mockResolvedValueOnce({
        data: "bukan objek tanda terima valid",
        error: null,
      });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("MALFORMED_RPC_RESPONSE");
      }
    });

    it("menangani kegagalan jaringan atau timeout secara aman", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "TypeError: fetch failed (network timeout)" },
      });

      const response = await recordSale(validSaleInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("NETWORK_ERROR");
      }
    });
  });

  describe("2. recordPurchase", () => {
    const validPurchaseInput: RecordPurchaseInput = {
      businessId: validBusinessId,
      supplierName: "Grosir Beras Utama",
      items: [{ productId: validProductId, quantity: 10, unitPurchaseCost: 65000 }],
      notes: "Restock Beras 10 sak",
      idempotencyKey: "idem_key_purch_001",
    };

    it("berhasil mencatat pembelian restock dan menghasilkan nomor faktur PO di server", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          purchase_id: "purch-uuid-001",
          invoice_number: "PO-20261013-XYZ98765",
          total_cost: 650000,
          purchase_date: "2026-10-13T14:00:00Z",
          items_count: 1,
        },
        error: null,
      });

      const response = await recordPurchase(validPurchaseInput, { supabase: mockSupabase });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.purchaseId).toBe("purch-uuid-001");
        expect(response.data.invoiceNumber).toMatch(/^PO-/);
        expect(response.data.totalCost).toBe(650000);
      }

      expect(mockRpc).toHaveBeenCalledWith("record_purchase_transaction", expect.objectContaining({
        p_business_id: validBusinessId,
        p_supplier_name: "Grosir Beras Utama",
      }));

      // Memastikan tidak ada mutasi stok langsung dari TypeScript service
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("menolak pembelian jika kuantitas item atau harga beli tidak valid", async () => {
      const invalidPurchase = {
        businessId: validBusinessId,
        items: [{ productId: validProductId, quantity: -5, unitPurchaseCost: -1000 }],
      } as unknown as RecordPurchaseInput;

      const response = await recordPurchase(invalidPurchase, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("menangani respon RPC pembelian yang tidak sesuai kontrak (malformed RPC response)", async () => {
      mockRpc.mockResolvedValueOnce({
        data: { corrupt_data: true },
        error: null,
      });

      const response = await recordPurchase(validPurchaseInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("MALFORMED_RPC_RESPONSE");
      }
    });
  });

  describe("3. voidSale", () => {
    const validVoidInput: VoidSaleInput = {
      businessId: validBusinessId,
      saleId: validSaleId,
      voidReason: "Pelanggan salah memilih varian barang dan minta refund",
      idempotencyKey: "idem_void_sale_001",
    };

    it("berhasil membatalkan penjualan melalui RPC void_sale_transaction", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          sale_id: validSaleId,
          status: "VOIDED",
          voided_at: "2026-10-13T16:00:00Z",
        },
        error: null,
      });

      const response = await voidSale(validVoidInput, { supabase: mockSupabase });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.saleId).toBe(validSaleId);
        expect(response.data.status).toBe("VOIDED");
      }

      expect(mockRpc).toHaveBeenCalledWith("void_sale_transaction", expect.objectContaining({
        p_sale_id: validSaleId,
        p_void_reason: validVoidInput.voidReason,
      }));

      // Memastikan pemulihan stok dieksekusi oleh RPC, bukan service
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("menolak pembatalan jika alasan pembatalan kurang dari 5 karakter", async () => {
      const invalidVoid: VoidSaleInput = {
        ...validVoidInput,
        voidReason: "x", // Kurang dari 5 karakter
      };

      const response = await voidSale(invalidVoid, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("menangani respon RPC pembatalan yang tidak sesuai kontrak (malformed void RPC response)", async () => {
      mockRpc.mockResolvedValueOnce({
        data: { sale_id: validSaleId, status: "INVALID_STATUS" }, // status bukan VOIDED
        error: null,
      });

      const response = await voidSale(validVoidInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("MALFORMED_RPC_RESPONSE");
      }
    });

    it("memetakan error SALE_ALREADY_VOIDED dari database", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "SALE_ALREADY_VOIDED: sale is already voided" },
      });

      const response = await voidSale(validVoidInput, { supabase: mockSupabase });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("SALE_ALREADY_VOIDED");
      }
    });
  });

  describe("4. getProductsForTransaction", () => {
    it("berhasil mengambil daftar produk aktif milik tenant terotorisasi", async () => {
      const response = await getProductsForTransaction(validBusinessId, {
        supabase: mockSupabase,
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.length).toBe(1);
        expect(response.data[0].id).toBe(validProductId);
        expect(response.data[0].name).toBe("Beras Premium 5kg");
        expect(response.data[0].stockQuantity).toBe(25);
      }
    });

    it("menolak query jika format ID bisnis tidak valid (bukan UUID)", async () => {
      const response = await getProductsForTransaction("invalid-uuid", {
        supabase: mockSupabase,
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
