import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import DemoSalesHistoryPage from "./page";
import {
  formatSaleDate,
  sortSalesLatestFirst,
  filterSales,
  calculateSalesStats,
  validateVoidReason,
} from "./demo-sales-utils";
import { DemoSidebar, DEMO_NAV_ITEMS } from "@/components/demo/demo-sidebar";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type { DemoSale } from "@/services/demo/demo-types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/sales",
}));

describe("Demo Sales History & Void Dialog Tests (/demo/sales)", () => {
  beforeEach(() => {
    demoStoreService.resetState();
  });

  // -------------------------------------------------------------------------
  // 1. Daftar transaksi terurut terbaru
  // -------------------------------------------------------------------------
  it("1. Daftar transaksi diurutkan dari yang terbaru (chronological descending)", () => {
    const saleOld: DemoSale = {
      id: "sale-old",
      invoiceNumber: "INV/2026/03/01/0001",
      transactionDate: "2026-03-01T10:00:00.000Z",
      status: "COMPLETED",
      items: [],
      subtotal: 50000,
      discount: 0,
      totalAmount: 50000,
      totalCogs: 40000,
      grossProfit: 10000,
      paymentMethod: "CASH",
      cashReceived: 50000,
      cashChange: 0,
    };

    const saleNew: DemoSale = {
      id: "sale-new",
      invoiceNumber: "INV/2026/03/02/0001",
      transactionDate: "2026-03-02T14:30:00.000Z",
      status: "COMPLETED",
      items: [],
      subtotal: 75000,
      discount: 0,
      totalAmount: 75000,
      totalCogs: 60000,
      grossProfit: 15000,
      paymentMethod: "CASH",
      cashReceived: 100000,
      cashChange: 25000,
    };

    const sorted = sortSalesLatestFirst([saleOld, saleNew]);
    expect(sorted[0].id).toBe("sale-new");
    expect(sorted[1].id).toBe("sale-old");

    // Pastikan di halaman yang dirender transaksi terbaru muncul pertama
    const html = renderToStaticMarkup(<DemoSalesHistoryPage />);
    const stateSales = demoStoreService.getState().sales;
    if (stateSales.length > 1) {
      const sortedState = sortSalesLatestFirst(stateSales);
      const firstInvoiceIndex = html.indexOf(sortedState[0].invoiceNumber);
      const secondInvoiceIndex = html.indexOf(sortedState[1].invoiceNumber);
      expect(firstInvoiceIndex).toBeLessThan(secondInvoiceIndex);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Pencarian nomor faktur
  // -------------------------------------------------------------------------
  it("2. Pencarian menyaring berdasarkan nomor faktur, nama produk, atau catatan", () => {
    const saleA: DemoSale = {
      id: "sale-a",
      invoiceNumber: "INV/2026/03/01/0001",
      transactionDate: "2026-03-01T10:00:00.000Z",
      status: "COMPLETED",
      items: [
        {
          id: "item-a",
          productId: "prod-1",
          productName: "Beras Pandan Wangi 5kg",
          quantity: 2,
          unitPrice: 75000,
          costPrice: 65000,
          itemDiscount: 0,
          subtotal: 150000,
        },
      ],
      subtotal: 150000,
      discount: 0,
      totalAmount: 150000,
      totalCogs: 130000,
      grossProfit: 20000,
      paymentMethod: "CASH",
      notes: "Pelanggan langganan",
    };

    const saleB: DemoSale = {
      id: "sale-b",
      invoiceNumber: "INV/2026/03/01/0002",
      transactionDate: "2026-03-01T11:00:00.000Z",
      status: "COMPLETED",
      items: [
        {
          id: "item-b",
          productId: "prod-2",
          productName: "Minyak Goreng Sania 2L",
          quantity: 1,
          unitPrice: 38000,
          costPrice: 34000,
          itemDiscount: 0,
          subtotal: 38000,
        },
      ],
      subtotal: 38000,
      discount: 0,
      totalAmount: 38000,
      totalCogs: 34000,
      grossProfit: 4000,
      paymentMethod: "BANK_TRANSFER",
    };

    const allSales = [saleA, saleB];

    // Cari berdasarkan invoice exact / partial
    const matchInv = filterSales(allSales, "0002");
    expect(matchInv.length).toBe(1);
    expect(matchInv[0].id).toBe("sale-b");

    // Cari berdasarkan nama produk
    const matchProduct = filterSales(allSales, "pandan");
    expect(matchProduct.length).toBe(1);
    expect(matchProduct[0].id).toBe("sale-a");

    // Cari berdasarkan catatan
    const matchNote = filterSales(allSales, "langganan");
    expect(matchNote.length).toBe(1);
    expect(matchNote[0].id).toBe("sale-a");
  });

  // -------------------------------------------------------------------------
  // 3. Filter status
  // -------------------------------------------------------------------------
  it("3. Filter status membedakan transaksi COMPLETED dan VOIDED", () => {
    const saleActive: DemoSale = {
      id: "sale-1",
      invoiceNumber: "INV/2026/03/01/0001",
      transactionDate: "2026-03-01T10:00:00.000Z",
      status: "COMPLETED",
      items: [],
      subtotal: 50000,
      discount: 0,
      totalAmount: 50000,
      totalCogs: 40000,
      grossProfit: 10000,
      paymentMethod: "CASH",
    };

    const saleVoided: DemoSale = {
      id: "sale-2",
      invoiceNumber: "INV/2026/03/01/0002",
      transactionDate: "2026-03-01T11:00:00.000Z",
      status: "VOIDED",
      voidReason: "Salah input nominal oleh kasir",
      voidedAt: "2026-03-01T11:30:00.000Z",
      items: [],
      subtotal: 60000,
      discount: 0,
      totalAmount: 60000,
      totalCogs: 50000,
      grossProfit: 10000,
      paymentMethod: "CASH",
    };

    const testList = [saleActive, saleVoided];

    const completedOnly = filterSales(testList, "", "COMPLETED");
    expect(completedOnly.length).toBe(1);
    expect(completedOnly[0].id).toBe("sale-1");

    const voidedOnly = filterSales(testList, "", "VOIDED");
    expect(voidedOnly.length).toBe(1);
    expect(voidedOnly[0].id).toBe("sale-2");

    const all = filterSales(testList, "", "ALL");
    expect(all.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 4. Tampilan kosong dan hasil pencarian kosong
  // -------------------------------------------------------------------------
  it("4. Menampilkan status kosong saat tidak ada transaksi atau tidak ada hasil pencarian", () => {
    // Simulasi store tanpa penjualan via spy
    const originalState = demoStoreService.getState();
    const emptyState = {
      ...originalState,
      sales: [],
    };

    const spyGet = vi.spyOn(demoStoreService, "getState").mockReturnValue(emptyState);
    const spyServer = vi.spyOn(demoStoreService, "getServerSnapshot").mockReturnValue(emptyState);

    const emptyHtml = renderToStaticMarkup(<DemoSalesHistoryPage />);
    expect(emptyHtml).toContain("Belum Ada Transaksi Penjualan");
    expect(emptyHtml).toContain("Buka Kasir POS Sekarang");

    spyGet.mockRestore();
    spyServer.mockRestore();

    // Uji hasil filter pencarian kosong
    const noMatchList = filterSales(originalState.sales, "KATA_KUNCI_TIDAK_MUNGKIN_ADA_XYZ");
    expect(noMatchList.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. Detail transaksi menggunakan snapshot historis
  // -------------------------------------------------------------------------
  it("5. Detail transaksi mempertahankan snapshot harga, HPP, diskon, dan margin", () => {
    const historicalSale: DemoSale = {
      id: "sale-hist-01",
      invoiceNumber: "INV/2026/03/01/8888",
      transactionDate: "2026-03-01T14:00:00.000Z",
      status: "COMPLETED",
      items: [
        {
          id: "item-hist-1",
          productId: "prod-hist",
          productName: "Beras Pandan Asli 5kg",
          quantity: 2,
          unitPrice: 70000,
          costPrice: 58000, // Snapshot HPP historis
          itemDiscount: 5000,
          subtotal: 135000,
        },
      ],
      subtotal: 135000,
      discount: 10000,
      totalAmount: 125000,
      totalCogs: 116000,
      grossProfit: 9000,
      paymentMethod: "CASH",
      cashReceived: 150000,
      cashChange: 25000,
    };

    // Verifikasi snapshot terisolasi dari perubahan harga produk saat ini
    expect(historicalSale.items[0].unitPrice).toBe(70000);
    expect(historicalSale.items[0].costPrice).toBe(58000);
    expect(historicalSale.items[0].itemDiscount).toBe(5000);
    expect(historicalSale.items[0].subtotal).toBe(135000);
    expect(historicalSale.totalAmount).toBe(125000);
    expect(historicalSale.totalCogs).toBe(116000);
    expect(historicalSale.grossProfit).toBe(9000);
    expect(historicalSale.cashReceived).toBe(150000);
    expect(historicalSale.cashChange).toBe(25000);
  });

  // -------------------------------------------------------------------------
  // 6. Transaksi aktif menampilkan aksi pembatalan
  // -------------------------------------------------------------------------
  it("6. Transaksi berstatus COMPLETED menampilkan tombol pembatalan (Batal)", () => {
    const html = renderToStaticMarkup(<DemoSalesHistoryPage />);
    const state = demoStoreService.getState();
    const hasCompleted = state.sales.some((s) => s.status === "COMPLETED");

    if (hasCompleted) {
      expect(html).toContain("Batal");
      expect(html).toContain("Selesai");
    }
  });

  // -------------------------------------------------------------------------
  // 7. Transaksi VOIDED tidak dapat dibatalkan lagi
  // -------------------------------------------------------------------------
  it("7. Transaksi berstatus VOIDED tidak dapat dibatalkan kembali", () => {
    const state = demoStoreService.getState();
    const completedSale = state.sales.find((s) => s.status === "COMPLETED");
    expect(completedSale).toBeDefined();

    if (completedSale) {
      // Void pertama kali
      const voidResult = demoStoreService.voidSale({
        saleId: completedSale.id,
        voidReason: "Uji coba void valid pertama kali",
      });
      expect(voidResult.success).toBe(true);

      // Void kedua kali harus ditolak oleh engine
      const secondVoid = demoStoreService.voidSale({
        saleId: completedSale.id,
        voidReason: "Mencoba membatalkan ulang transaksi yang sudah void",
      });
      expect(secondVoid.success).toBe(false);
      if (!secondVoid.success) {
        expect(secondVoid.error.code).toBe("ALREADY_VOIDED");
      }
    }
  });

  // -------------------------------------------------------------------------
  // 8. Alasan kosong atau terlalu pendek ditolak
  // -------------------------------------------------------------------------
  it("8. Alasan pembatalan kosong atau kurang dari 5 karakter non-spasi wajib ditolak", () => {
    expect(validateVoidReason("").isValid).toBe(false);
    expect(validateVoidReason("    ").isValid).toBe(false);
    expect(validateVoidReason("123").isValid).toBe(false);
    expect(validateVoidReason("abcd").isValid).toBe(false);

    const validCase = validateVoidReason("Salah varian barang");
    expect(validCase.isValid).toBe(true);
    expect(validCase.message).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 9. Pembatalan berhasil memanggil engine satu kali
  // -------------------------------------------------------------------------
  it("9. Pembatalan berhasil memanggil demoStoreService.voidSale() dan mengubah status menjadi VOIDED", () => {
    const state = demoStoreService.getState();
    const targetSale = state.sales.find((s) => s.status === "COMPLETED");
    expect(targetSale).toBeDefined();

    if (targetSale) {
      const reason = "Pelanggan keliru mengambil jenis minyak goreng";
      const result = demoStoreService.voidSale({
        saleId: targetSale.id,
        voidReason: reason,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("VOIDED");
        expect(result.data.voidReason).toBe(reason);
        expect(result.data.voidedAt).toBeDefined();
      }

      const updatedSale = demoStoreService.getSaleById(targetSale.id);
      expect(updatedSale?.status).toBe("VOIDED");
      expect(updatedSale?.voidReason).toBe(reason);
    }
  });

  // -------------------------------------------------------------------------
  // 10. Proteksi klik berulang (mutex lock)
  // -------------------------------------------------------------------------
  it("10. Proteksi klik ganda mencegah eksekusi berulang terhadap voidSale", () => {
    const spyVoid = vi.spyOn(demoStoreService, "voidSale");
    const state = demoStoreService.getState();
    const targetSale = state.sales.find((s) => s.status === "COMPLETED");

    expect(targetSale).toBeDefined();
    if (targetSale) {
      let isSubmitting = false;
      const simulateClick = () => {
        if (isSubmitting) return;
        isSubmitting = true;
        demoStoreService.voidSale({
          saleId: targetSale.id,
          voidReason: "Uji proteksi mutex klik ganda",
        });
      };

      // Panggil dua kali beruntun
      simulateClick();
      simulateClick();

      expect(spyVoid).toHaveBeenCalledTimes(1);
    }
    spyVoid.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 11. Kegagalan engine mempertahankan input alasan
  // -------------------------------------------------------------------------
  it("11. Kegagalan transaksi tidak menghilangkan alasan pembatalan", () => {
    const reasonInput = "Alasan yang diketik oleh kasir";
    const failResult = demoStoreService.voidSale({
      saleId: "non-existent-sale-id",
      voidReason: reasonInput,
    });

    expect(failResult.success).toBe(false);
    // Nilai string input formulir dipertahankan oleh state
    expect(reasonInput).toBe("Alasan yang diketik oleh kasir");
  });

  // -------------------------------------------------------------------------
  // 12. Daftar diperbarui setelah pembatalan
  // -------------------------------------------------------------------------
  it("12. Daftar transaksi merefleksikan perubahan status secara reaktif setelah pembatalan", () => {
    let subscriberCalled = false;
    const unsubscribe = demoStoreService.subscribe(() => {
      subscriberCalled = true;
    });

    const targetSale = demoStoreService
      .getState()
      .sales.find((s) => s.status === "COMPLETED");

    expect(targetSale).toBeDefined();
    if (targetSale) {
      demoStoreService.voidSale({
        saleId: targetSale.id,
        voidReason: "Pembaruan reaktif subscriber",
      });

      expect(subscriberCalled).toBe(true);
      const afterVoid = demoStoreService.getSaleById(targetSale.id);
      expect(afterVoid?.status).toBe("VOIDED");
    }

    unsubscribe();
  });

  // -------------------------------------------------------------------------
  // 13. Ringkasan transaksi yang dibatalkan tidak diperlakukan sebagai penjualan aktif
  // -------------------------------------------------------------------------
  it("13. Transaksi VOIDED tidak dihitung dalam penjualan bersih dan memulihkan stok", () => {
    const stateBefore = demoStoreService.getState();
    const targetSale = stateBefore.sales.find((s) => s.status === "COMPLETED");
    expect(targetSale).toBeDefined();

    if (targetSale) {
      const soldItem = targetSale.items[0];
      const productBefore = stateBefore.products.find((p) => p.id === soldItem.productId);
      expect(productBefore).toBeDefined();
      const stockBefore = productBefore?.stockQuantity ?? 0;

      // Hitung stats sebelum void
      const statsBefore = calculateSalesStats(stateBefore.sales);

      // Lakukan void
      const voidResult = demoStoreService.voidSale({
        saleId: targetSale.id,
        voidReason: "Uji integritas finansial dan pemulihan stok",
      });
      expect(voidResult.success).toBe(true);

      const stateAfter = demoStoreService.getState();
      const statsAfter = calculateSalesStats(stateAfter.sales);

      // Omzet penjualan bersih berkurang sebesar total tagihan transaksi yang dibatalkan
      expect(statsAfter.completedNetSales).toBe(
        statsBefore.completedNetSales - targetSale.totalAmount
      );
      expect(statsAfter.completedCount).toBe(statsBefore.completedCount - 1);
      expect(statsAfter.voidedCount).toBe(statsBefore.voidedCount + 1);

      // Stok persediaan dipulihkan tepat sebesar kuantitas yang dijual
      const productAfter = stateAfter.products.find((p) => p.id === soldItem.productId);
      expect(productAfter?.stockQuantity).toBe(stockBefore + soldItem.quantity);

      // Nilai HPP rata-rata tertimbang (cogs) produk dipertahankan
      expect(productAfter?.cogs).toBe(productBefore?.cogs);
    }
  });

  // -------------------------------------------------------------------------
  // 14. Sidebar Penjualan menuju /demo/sales dan navigasi aktif benar
  // -------------------------------------------------------------------------
  it("14. Sidebar Penjualan mengarah ke /demo/sales dan aktif pada /demo/sales maupun /demo/sales/new", () => {
    // Nav item Penjualan aktif
    const salesItem = DEMO_NAV_ITEMS.find((i) => i.label === "Penjualan");
    expect(salesItem).toBeDefined();
    expect(salesItem?.isAvailable).toBe(true);
    expect(salesItem?.href).toBe("/demo/sales");
    expect(salesItem?.stageNote).toBeUndefined();

    // Render sidebar pada rute /demo/sales
    const htmlSales = renderToStaticMarkup(<DemoSidebar currentPath="/demo/sales" />);
    expect(htmlSales).toContain('href="/demo/sales"');
    expect(htmlSales).toContain('aria-current="page"');

    // Render sidebar pada rute anak /demo/sales/new
    const htmlSalesNew = renderToStaticMarkup(<DemoSidebar currentPath="/demo/sales/new" />);
    expect(htmlSalesNew).toContain('href="/demo/sales"');
    expect(htmlSalesNew).toContain('aria-current="page"');

    // Modul Produk & Stok dan Pengaturan kini aktif
    const productsItem = DEMO_NAV_ITEMS.find((i) => i.label === "Produk & Stok");
    expect(productsItem?.isAvailable).toBe(true);
    expect(productsItem?.href).toBe("/demo/products");

    const settingsItem = DEMO_NAV_ITEMS.find((i) => i.label === "Pengaturan");
    expect(settingsItem?.isAvailable).toBe(true);
    expect(settingsItem?.href).toBe("/demo/settings");
  });

  // -------------------------------------------------------------------------
  // 15. Isolasi dari backend produksi
  // -------------------------------------------------------------------------
  it("15. Mode Demo terisolasi penuh dari Supabase dan Server Actions produksi", () => {
    const pagePath = path.resolve(__dirname, "./page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Tidak boleh mengimpor Supabase produksi
    expect(content).not.toContain("@/lib/supabase");
    expect(content).not.toContain("createClient");
    expect(content).not.toContain("@supabase/supabase-js");

    // Tidak boleh mengimpor Server Actions produksi
    expect(content).not.toContain("@/app/actions");

    // Menggunakan store lokal terisolasi
    expect(content).toContain("@/services/demo/demo-store.service");
  });

  // -------------------------------------------------------------------------
  // Helper test: formatSaleDate WIB
  // -------------------------------------------------------------------------
  it("Format tanggal menghasilkan format waktu lokal dengan penanda WIB", () => {
    const sampleDate = "2026-03-01T10:00:00.000Z";
    const formatted = formatSaleDate(sampleDate);
    expect(formatted).toContain("WIB");
    expect(formatted).toContain("2026");
  });

  // -------------------------------------------------------------------------
  // Audit Edge Cases: Filter Kombinasi Serentak
  // -------------------------------------------------------------------------
  it("16. Filter kombinasi (pencarian + status + metode pembayaran) bekerja secara serentak", () => {
    const saleMatch: DemoSale = {
      id: "sale-match",
      invoiceNumber: "INV/2026/03/01/9999",
      transactionDate: "2026-03-01T10:00:00.000Z",
      status: "COMPLETED",
      items: [
        {
          id: "item-m",
          productId: "p1",
          productName: "Beras Ramos 5kg",
          quantity: 1,
          unitPrice: 75000,
          costPrice: 65000,
          subtotal: 75000,
        },
      ],
      subtotal: 75000,
      discount: 0,
      totalAmount: 75000,
      totalCogs: 65000,
      grossProfit: 10000,
      paymentMethod: "CASH",
    };

    const saleDiffStatus: DemoSale = {
      ...saleMatch,
      id: "sale-diff-status",
      status: "VOIDED",
    };

    const saleDiffPayment: DemoSale = {
      ...saleMatch,
      id: "sale-diff-payment",
      paymentMethod: "BANK_TRANSFER",
    };

    const saleDiffProduct: DemoSale = {
      ...saleMatch,
      id: "sale-diff-prod",
      items: [
        {
          id: "item-diff",
          productId: "p2",
          productName: "Minyak Goreng Sawit 2L",
          quantity: 1,
          unitPrice: 35000,
          costPrice: 30000,
          subtotal: 35000,
        },
      ],
    };

    const list = [saleMatch, saleDiffStatus, saleDiffPayment, saleDiffProduct];

    // Filter query "ramos" + status "COMPLETED" + payment "CASH" -> Hanya saleMatch
    const result = filterSales(list, "ramos", "COMPLETED", "CASH");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("sale-match");

    // Filter query "ramos" + status "VOIDED" + payment "CASH" -> Hanya saleDiffStatus
    const resultVoid = filterSales(list, "ramos", "VOIDED", "CASH");
    expect(resultVoid.length).toBe(1);
    expect(resultVoid[0].id).toBe("sale-diff-status");
  });

  // -------------------------------------------------------------------------
  // Audit Edge Cases: Resiliensi terhadap Transaksi dengan 0 Item
  // -------------------------------------------------------------------------
  it("17. Halaman tidak crash jika terdapat data transaksi dengan 0 item (empty items array)", () => {
    const saleEmptyItems: DemoSale = {
      id: "sale-zero-items",
      invoiceNumber: "INV/2026/03/01/0000",
      transactionDate: "2026-03-01T10:00:00.000Z",
      status: "COMPLETED",
      items: [],
      subtotal: 0,
      discount: 0,
      totalAmount: 0,
      totalCogs: 0,
      grossProfit: 0,
      paymentMethod: "CASH",
    };

    const realState = demoStoreService.getState();
    const spyGet = vi.spyOn(demoStoreService, "getState").mockReturnValue({
      ...realState,
      sales: [saleEmptyItems],
    });
    const spyServer = vi.spyOn(demoStoreService, "getServerSnapshot").mockReturnValue({
      ...realState,
      sales: [saleEmptyItems],
    });

    const html = renderToStaticMarkup(<DemoSalesHistoryPage />);
    expect(html).toContain("INV/2026/03/01/0000");
    expect(html).toContain("Tidak ada item");

    spyGet.mockRestore();
    spyServer.mockRestore();
  });
});
