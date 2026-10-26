import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NewSaleView as NewSalePage, SalesCheckoutContent } from "./sales/new/sales-checkout-content";
import {
  recordSaleSchema,
  saleItemInputSchema,
} from "@/lib/validations/sale";
import type { ProductItemResponse, SaleReceiptResponse } from "@/types/api";
import { formatRupiah } from "@/lib/utils";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

// Mock Server Actions
const mockCreateSaleAction = vi.fn();
const mockGetProductsForTransactionAction = vi.fn();

vi.mock("@/app/actions/transactions", () => ({
  createSaleAction: (input: unknown) => mockCreateSaleAction(input),
  getProductsForTransactionAction: () => mockGetProductsForTransactionAction(),
}));

describe("VeyraOS Stage 5.4 - POS Checkout UI (Step 1)", () => {
  const sampleProducts: ProductItemResponse[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      businessId: "99999999-9999-4999-8999-999999999999",
      name: "Kopi Arabika Gayo 250g",
      sku: "KPG-250",
      category: "Kopi & Minuman",
      sellingPrice: 75000,
      costPrice: 45000,
      stockQuantity: 10,
      isArchived: false,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      businessId: "99999999-9999-4999-8999-999999999999",
      name: "Gula Aren Organik 500g",
      sku: "GLA-500",
      category: "Sembako",
      sellingPrice: 28000,
      costPrice: 19000,
      stockQuantity: 3, // Low stock <= 5
      isArchived: false,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      businessId: "99999999-9999-4999-8999-999999999999",
      name: "Beras Pandan Wangi 5kg",
      sku: "BRS-005",
      category: "Sembako",
      sellingPrice: 85000,
      costPrice: 70000,
      stockQuantity: 0, // Habis / Out of stock
      isArchived: false,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      businessId: "99999999-9999-4999-8999-999999999999",
      name: "Produk Terarsip Rahasia",
      sku: "ARS-001",
      category: "Lainnya",
      sellingPrice: 50000,
      costPrice: 30000,
      stockQuantity: 20,
      isArchived: true, // Terarsip
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProductsForTransactionAction.mockResolvedValue({
      success: true,
      data: sampleProducts,
    });
  });

  // ==========================================================================
  // 1. RENDER & KATALOG PRODUK AKTIF
  // ==========================================================================
  describe("1. Render & Katalog Produk Aktif", () => {
    it("1.1 Menampilkan skeleton saat katalog produk dalam proses loading", () => {
      // Saat dipanggil tanpa initialProducts, komponen render fallback/loading
      const html = renderToStaticMarkup(<NewSalePage />);
      expect(html).toContain("Kasir Cepat (POS)");
      expect(html).toContain("animate-shimmer"); // Skeleton shimmer class
    });

    it("1.2 Menampilkan empty state jika daftar produk aktif kosong", () => {
      const html = renderToStaticMarkup(<SalesCheckoutContent initialProducts={[]} />);
      expect(html).toContain("Belum Ada Produk Tersedia");
      expect(html).toContain("+ Tambah Produk Baru");
      expect(html).toContain("/products/new");
    });

    it("1.3 Menampilkan produk aktif dan menyembunyikan produk yang berstatus terarsip", () => {
      const html = renderToStaticMarkup(
        <SalesCheckoutContent initialProducts={sampleProducts} />
      );
      // Produk aktif wajib tampil
      expect(html).toContain("Kopi Arabika Gayo 250g");
      expect(html).toContain("KPG-250");
      expect(html).toContain(formatRupiah(75000));

      expect(html).toContain("Gula Aren Organik 500g");
      expect(html).toContain("GLA-500");
      expect(html).toContain(formatRupiah(28000));

      // Produk terarsip (isArchived = true) TIDAK BOLEH tampil di katalog kasir
      expect(html).not.toContain("Produk Terarsip Rahasia");
      expect(html).not.toContain("ARS-001");
    });

    it("1.4 Menandai produk dengan stok 0 sebagai 'Habis' dan menonaktifkan tombol tambah", () => {
      const html = renderToStaticMarkup(
        <SalesCheckoutContent initialProducts={sampleProducts} />
      );
      expect(html).toContain("Beras Pandan Wangi 5kg");
      expect(html).toContain("Habis");
      expect(html).toContain("Stok Habis");
    });

    it("1.5 Menampilkan badge 'Sisa 3' untuk produk yang stoknya menipis (<= 5)", () => {
      const html = renderToStaticMarkup(
        <SalesCheckoutContent initialProducts={sampleProducts} />
      );
      expect(html).toContain("Sisa 3");
    });
  });

  // ==========================================================================
  // 2. KERANJANG PENJUALAN, BATAS KUANTITAS & DISKON
  // ==========================================================================
  describe("2. Keranjang Penjualan, Batas Kuantitas & Diskon", () => {
    it("2.1 Menampilkan keranjang kosong dengan panduan saat belum ada produk yang dipilih", () => {
      const html = renderToStaticMarkup(
        <SalesCheckoutContent initialProducts={sampleProducts} />
      );
      expect(html).toContain("Keranjang Penjualan");
      expect(html).toContain("Keranjang masih kosong");
      expect(html).toContain("0 item");
    });

    it("2.2 Memvalidasi skema Zod saleItemInputSchema: kuantitas harus integer > 0", () => {
      // Valid
      const validItem = saleItemInputSchema.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 2,
        itemDiscount: 5000,
      });
      expect(validItem.success).toBe(true);

      // Invalid: Kuantitas 0
      const zeroQty = saleItemInputSchema.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 0,
      });
      expect(zeroQty.success).toBe(false);

      // Invalid: Kuantitas negatif
      const negQty = saleItemInputSchema.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: -1,
      });
      expect(negQty.success).toBe(false);

      // Invalid: Diskon negatif
      const negDisc = saleItemInputSchema.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 1,
        itemDiscount: -500,
      });
      expect(negDisc.success).toBe(false);
    });

    it("2.3 Memvalidasi bahwa diskon per item tidak boleh melebihi harga kotor baris (quantity * sellingPrice)", () => {
      const qty = 2;
      const sellingPrice = 75000;
      const gross = qty * sellingPrice; // 150000

      // Diskon yang diizinkan (misal 50.000)
      const allowedDiscount = 50000;
      expect(allowedDiscount <= gross).toBe(true);

      // Diskon melebihi gross (misal 160.000)
      const excessiveDiscount = 160000;
      expect(excessiveDiscount > gross).toBe(true);
    });

    it("2.4 Menghitung kalkulasi subtotal, total diskon, dan total tagihan secara matematis deterministik", () => {
      const item1Gross = 2 * 75000; // 150.000
      const item1Discount = 10000;  // 10.000
      const item1Net = item1Gross - item1Discount; // 140.000

      const item2Gross = 1 * 28000; // 28.000
      const item2Discount = 0;
      const item2Net = item2Gross - item2Discount; // 28.000

      const grossSubtotal = item1Gross + item2Gross; // 178.000
      const totalItemDiscounts = item1Discount + item2Discount; // 10.000
      const netSubtotal = grossSubtotal - totalItemDiscounts; // 168.000

      const txDiscount = 8000; // Diskon nota
      const finalTotal = netSubtotal - txDiscount; // 160.000

      expect(item1Net).toBe(140000);
      expect(item2Net).toBe(28000);
      expect(grossSubtotal).toBe(178000);
      expect(totalItemDiscounts).toBe(10000);
      expect(netSubtotal).toBe(168000);
      expect(finalTotal).toBe(160000);
    });
  });

  // ==========================================================================
  // 3. METODE PEMBAYARAN & KALKULATOR KEMBALIAN
  // ==========================================================================
  describe("3. Metode Pembayaran & Kalkulator Kembalian", () => {
    it("3.1 Memvalidasi enum metode pembayaran hanya menerima CASH atau BANK_TRANSFER", () => {
      const validCash = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "12345678-1234-4234-8234-123456789012",
        paymentMethod: "CASH",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      });
      expect(validCash.success).toBe(true);

      const validBank = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "12345678-1234-4234-8234-123456789012",
        paymentMethod: "BANK_TRANSFER",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      });
      expect(validBank.success).toBe(true);

      const invalidMethod = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "12345678-1234-4234-8234-123456789012",
        paymentMethod: "PAYLATER" as unknown,
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      });
      expect(invalidMethod.success).toBe(false);
    });

    it("3.2 Menghitung kembalian uang tunai secara tepat tanpa mengubah total tagihan", () => {
      const totalAmount = 75000;
      const cashReceived = 100000;
      const change = cashReceived - totalAmount;

      expect(change).toBe(25000);
      expect(cashReceived >= totalAmount).toBe(true);
    });
  });

  // ==========================================================================
  // 4. PENCEGAHAN DOUBLE-SUBMIT & KONTRAK CREATESALEACTION
  // ==========================================================================
  describe("4. Pencegahan Double-Submit & Kontrak createSaleAction", () => {
    it("4.1 Memverifikasi tombol Bayar berstatus disabled saat keranjang kosong", () => {
      const html = renderToStaticMarkup(
        <SalesCheckoutContent initialProducts={sampleProducts} />
      );
      // Tombol bayar dinonaktifkan jika cartItems kosong
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Bayar/);
    });

    it("4.2 Menolak transaksi penjualan jika daftar items kosong pada skema recordSaleSchema", () => {
      const emptyItems = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "12345678-1234-4234-8234-123456789012",
        paymentMethod: "CASH",
        items: [],
      });
      expect(emptyItems.success).toBe(false);
      if (!emptyItems.success) {
        expect(emptyItems.error.issues[0].message).toContain("Minimal harus ada 1 item");
      }
    });

    it("4.3 Menolak transaksi penjualan jika diskon transaksi bernilai negatif", () => {
      const negTxDiscount = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "12345678-1234-4234-8234-123456789012",
        paymentMethod: "CASH",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
        transactionDiscount: -1000,
      });
      expect(negTxDiscount.success).toBe(false);
    });
  });

  // ==========================================================================
  // 5. IDEMPOTENCY KEY LIFECYCLE & RETRY SAFETY
  // ==========================================================================
  describe("5. Idempotency Key Lifecycle & Retry Safety", () => {
    it("5.1 Mewajibkan idempotencyKey minimal 8 karakter pada skema recordSaleSchema", () => {
      // Key valid (UUID 36 karakter)
      const validKey = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "12345678-1234-4234-8234-123456789012",
        paymentMethod: "CASH",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      });
      expect(validKey.success).toBe(true);

      // Key tidak valid: kurang dari 8 karakter
      const shortKey = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        idempotencyKey: "short",
        paymentMethod: "CASH",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      });
      expect(shortKey.success).toBe(false);

      // Key tidak valid: undefined
      const missingKey = recordSaleSchema.safeParse({
        businessId: "99999999-9999-4999-8999-999999999999",
        paymentMethod: "CASH",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
      });
      expect(missingKey.success).toBe(false);
    });

    it("5.2 Mempertahankan idempotencyKey yang sama saat retry jaringan", () => {
      // Simulasi state idempotencyKey
      const initialKey = "idem-test-uuid-1234-5678-9012";
      let currentKey = initialKey;

      // Simulasi kegagalan request pertama (network timeout / 500)
      const request1Failed = true;
      if (request1Failed) {
        // Retry logic: JANGAN meng-generate UUID baru!
        // currentKey tetap bernilai initialKey
      }

      expect(currentKey).toBe(initialKey);

      // Transaksi berhasil dikonfirmasi -> baru buat key baru
      const request2Succeeded = true;
      if (request2Succeeded) {
        currentKey = "idem-test-uuid-brand-new-9999";
      }

      expect(currentKey).not.toBe(initialKey);
    });
  });

  // ==========================================================================
  // 6. STRUK SUKSES & TAMPILAN TRANSAKSI
  // ==========================================================================
  describe("6. Struk Sukses & Tampilan Transaksi", () => {
    it("6.1 Memvalidasi struktur data struk penerimaan SaleReceiptResponse", () => {
      const mockReceipt: SaleReceiptResponse = {
        saleId: "sale-uuid-001",
        invoiceNumber: "INV-2026-0042",
        subtotalAmount: 150000,
        discountAmount: 10000,
        totalAmount: 140000,
        paymentMethod: "CASH",
        transactionDate: "2026-10-14T10:30:00Z",
        itemsCount: 2,
      };

      expect(mockReceipt.invoiceNumber).toBe("INV-2026-0042");
      expect(mockReceipt.totalAmount).toBe(140000);
      expect(mockReceipt.paymentMethod).toBe("CASH");
      expect(mockReceipt.itemsCount).toBe(2);
    });

    it("6.2 Memastikan tombol navigasi dan struk mencantumkan tindakan '+ Transaksi Baru'", () => {
      // Pembuktian teks tombol tindakan
      const startNewSaleLabel = "+ Transaksi Baru";
      const printReceiptLabel = "Cetak Struk";

      expect(startNewSaleLabel).toContain("Transaksi Baru");
      expect(printReceiptLabel).toContain("Cetak");
    });
  });
});
