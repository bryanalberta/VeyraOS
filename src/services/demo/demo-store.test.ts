import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  DemoStoreService,
  demoStoreService,
  allocateTransactionDiscount,
} from "./demo-store.service";
import { DEFAULT_DEMO_SEED } from "./demo-seed-data";
import { DEMO_STORAGE_KEY, DEMO_STORE_VERSION } from "./demo-types";

describe("DemoStoreService — Fondasi Store Sandboxing Mode Demo", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock global window & localStorage untuk lingkungan Node
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    // Definisikan window jika belum ada di node env
    const storageInstance = localStorageMock as unknown as Storage;
    if (typeof window === "undefined") {
      (global as unknown as { window: unknown }).window = {
        localStorage: storageInstance,
      };
    } else {
      Object.defineProperty(window, "localStorage", {
        value: storageInstance,
        writable: true,
      });
    }

    demoStoreService.resetState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Skenario 1-3: Inisialisasi, Isolasi Mutasi, Read/Write
  // -------------------------------------------------------------------------
  it("Skenario 1: Memuat seed awal lengkap dengan profil Toko Sembako Sejahtera", () => {
    const state = demoStoreService.getState();

    expect(state.business.name).toBe("Toko Sembako Sejahtera");
    expect(state.business.currency).toBe("IDR");
    expect(state.business.timezone).toBe("Asia/Jakarta");
    expect(state.products.length).toBe(15);
    expect(state.purchases.length).toBe(5);
    expect(state.sales.length).toBe(27);
    expect(state.expenses.length).toBe(8);
  });

  it("Skenario 2: Stabilitas Snapshot — pemanggilan getState() berulang tanpa perubahan state mengembalikan referensi yang sama (useSyncExternalStore contract)", () => {
    const state1 = demoStoreService.getState();
    const state2 = demoStoreService.getState();
    const state3 = demoStoreService.getState();

    // Membuktikan stabilitas referensi snapshot (tidak membuat objek baru setiap pemanggilan)
    expect(state1).toBe(state2);
    expect(state2).toBe(state3);
    expect(DEFAULT_DEMO_SEED.products[0].price).toBe(76000);
  });

  it("Skenario 2B: Imutabilitas & Snapshot Baru — perubahan state via saveState menghasilkan snapshot baru yang stabil", () => {
    const initialSnapshot = demoStoreService.getState();

    const nextSnapshot = demoStoreService.saveState((prev) => ({
      ...prev,
      business: { ...prev.business, name: "Toko Sembako Sejahtera (Updated)" },
    }));

    // Referensi snapshot berubah
    expect(nextSnapshot).not.toBe(initialSnapshot);
    // Pemanggilan berikutnya mengembalikan referensi snapshot baru yang stabil
    expect(demoStoreService.getState()).toBe(nextSnapshot);
    // Seed awal master tidak pernah terpengaruh
    expect(DEFAULT_DEMO_SEED.business.name).toBe("Toko Sembako Sejahtera");
  });

  it("Skenario 3: Read/Write state menyimpan perubahan ke memori dan storage", () => {
    const state = demoStoreService.getState();
    const updatedProducts = [...state.products];
    updatedProducts[0] = {
      ...updatedProducts[0],
      name: "Beras Ramos Super 5kg (Promo)",
      price: 72000,
    };

    const saved = demoStoreService.saveState({
      ...state,
      products: updatedProducts,
    });

    expect(saved.products[0].name).toBe("Beras Ramos Super 5kg (Promo)");
    expect(saved.products[0].price).toBe(72000);

    const reRead = demoStoreService.getState();
    expect(reRead.products[0].name).toBe("Beras Ramos Super 5kg (Promo)");
    expect(reRead.products[0].price).toBe(72000);
  });

  it("Skenario 4: Fungsi updater pada saveState dapat menghitung state baru dari previous state", () => {
    demoStoreService.saveState((prev) => ({
      ...prev,
      business: {
        ...prev.business,
        name: "Toko Sembako Sejahtera Cabang 2",
      },
    }));

    const state = demoStoreService.getState();
    expect(state.business.name).toBe("Toko Sembako Sejahtera Cabang 2");
  });

  // -------------------------------------------------------------------------
  // Skenario 5-7: Reset State & Fallback Penyimpanan
  // -------------------------------------------------------------------------
  it("Skenario 5: Reset state mengembalikan seluruh data kembali ke kondisi seed awal", () => {
    // Ubah beberapa data
    demoStoreService.saveState((prev) => ({
      ...prev,
      business: { ...prev.business, name: "Toko Modifikasi" },
      products: [],
      sales: [],
    }));

    expect(demoStoreService.getState().products.length).toBe(0);

    // Lakukan reset
    const reset = demoStoreService.resetState();
    expect(reset.business.name).toBe("Toko Sembako Sejahtera");
    expect(reset.products.length).toBe(15);
    expect(reset.sales.length).toBe(27);

    const afterReset = demoStoreService.getState();
    expect(afterReset.products.length).toBe(15);
    expect(afterReset.sales.length).toBe(27);
  });

  it("Skenario 6: resetState memperbarui timestamp lastResetAt", () => {
    const beforeReset = demoStoreService.getState().lastResetAt;
    const reset = demoStoreService.resetState();
    expect(reset.lastResetAt).toBeDefined();
    expect(typeof reset.lastResetAt).toBe("string");
    expect(reset.lastResetAt).not.toBe("");
    expect(beforeReset).toBeDefined();
  });

  it("Skenario 7: In-memory fallback saat localStorage tidak tersedia (window undefined atau null)", () => {
    const isolatedService = new DemoStoreService();
    // Simulasikan storage tidak tersedia
    vi.spyOn(isolatedService, "isStorageAvailable").mockReturnValue(false);

    const state = isolatedService.getState();
    expect(state.business.name).toBe("Toko Sembako Sejahtera");

    isolatedService.saveState((prev) => ({
      ...prev,
      business: { ...prev.business, name: "Bisnis In Memory" },
    }));

    expect(isolatedService.getState().business.name).toBe("Bisnis In Memory");
  });

  it("Skenario 8: localStorage melempar QuotaExceededError — tetap aman di memori tanpa crash", () => {
    const isolatedService = new DemoStoreService();
    vi.spyOn(isolatedService, "isStorageAvailable").mockReturnValue(true);

    // Mock localStorage.setItem melempar error kuota
    window.localStorage.setItem = vi.fn().mockImplementation(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    expect(() => {
      isolatedService.saveState((prev) => ({
        ...prev,
        business: { ...prev.business, name: "Bisnis Simpan Gagal" },
      }));
    }).not.toThrow();

    // Nilai tetap tersimpan di in-memory fallback
    expect(isolatedService.getState().business.name).toBe("Bisnis Simpan Gagal");
  });

  // -------------------------------------------------------------------------
  // Skenario 9-11: Penanganan Data Rusak & Inkonsistensi Versi
  // -------------------------------------------------------------------------
  it("Skenario 9: Data tersimpan rusak (corrupted JSON) — otomatis pulih ke seed awal", () => {
    mockStorage[DEMO_STORAGE_KEY] = "{ corrupt JSON data !?#";

    const isolatedService = new DemoStoreService();
    const state = isolatedService.getState();

    expect(state.business.name).toBe("Toko Sembako Sejahtera");
    expect(state.products.length).toBe(15);
  });

  it("Skenario 10: Versi data tersimpan tidak cocok — otomatis reset ke seed v1", () => {
    const outdatedState = {
      version: 999, // versi beda
      business: { name: "Versi Usang" },
      products: [],
    };
    mockStorage[DEMO_STORAGE_KEY] = JSON.stringify(outdatedState);

    const isolatedService = new DemoStoreService();
    const state = isolatedService.getState();

    expect(state.version).toBe(DEMO_STORE_VERSION);
    expect(state.business.name).toBe("Toko Sembako Sejahtera");
    expect(state.products.length).toBe(15);
  });

  it("Skenario 11: Konsistensi sekuensial antar operasi berturut-turut", () => {
    const service = new DemoStoreService();

    // 1. Initial
    expect(service.getState().products.length).toBe(15);

    // 2. Add product
    service.saveState((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          id: "prod-new-01",
          name: "Produk Tambahan",
          sku: "PRD-NEW",
          category: "Lain-lain",
          price: 10000,
          cogs: 8000,
          stockQuantity: 10,
          minStockAlert: 2,
          unit: "pcs",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    expect(service.getState().products.length).toBe(16);

    // 3. Reset
    service.resetState();
    expect(service.getState().products.length).toBe(15);
  });

  it("Skenario 12: Tidak ada ketergantungan pada server-side localStorage (SSR Safe)", () => {
    // Hapus sementara window
    const originalWindow = global.window;
    // @ts-expect-error Simulating server render
    delete global.window;

    try {
      const ssrService = new DemoStoreService();
      const state = ssrService.getState();
      expect(state.business.name).toBe("Toko Sembako Sejahtera");
      expect(state.products.length).toBe(15);
    } finally {
      global.window = originalWindow;
    }
  });

  // -------------------------------------------------------------------------
  // Skenario 13-16: Integritas Finansial & Dashboard Metrik
  // -------------------------------------------------------------------------
  it("Skenario 13: Perhitungan dashboard summary sesuai data seed riil", () => {
    const summary = demoStoreService.getDashboardSummary();

    // Hitung manual dari 25 completed sales
    const state = demoStoreService.getState();
    const completedSales = state.sales.filter((s) => s.status === "COMPLETED");

    const expectedNetSales = completedSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const expectedCogs = completedSales.reduce((sum, s) => sum + s.totalCogs, 0);
    const expectedGrossProfit = expectedNetSales - expectedCogs;
    const expectedOpEx = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const expectedOperatingProfit = expectedGrossProfit - expectedOpEx;

    expect(summary.netSales).toBe(expectedNetSales);
    expect(summary.cogs).toBe(expectedCogs);
    expect(summary.grossProfit).toBe(expectedGrossProfit);
    expect(summary.operatingExpenses).toBe(expectedOpEx);
    expect(summary.operatingProfit).toBe(expectedOperatingProfit);
    expect(summary.grossProfitMargin).toBe(
      Math.round((expectedGrossProfit / expectedNetSales) * 100)
    );
  });

  it("Skenario 14: Transaksi VOIDED tidak dihitung ke dalam omzet, HPP, atau laba kotor", () => {
    const state = demoStoreService.getState();
    const voidedSales = state.sales.filter((s) => s.status === "VOIDED");
    expect(voidedSales.length).toBe(2);

    const summary = demoStoreService.getDashboardSummary();

    // Pastikan nilai invoice VOIDED tidak termasuk dalam omzet bersih
    const voidedTotal = voidedSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const allSalesTotal = state.sales.reduce((sum, s) => sum + s.totalAmount, 0);

    expect(summary.netSales).toBe(allSalesTotal - voidedTotal);
  });

  it("Skenario 15: Pemisahan Beban vs Pembelian Stok — pembelian restock TIDAK dihitung sebagai beban operasional", () => {
    const state = demoStoreService.getState();
    const summary = demoStoreService.getDashboardSummary();

    const totalPurchases = state.purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    expect(totalPurchases).toBeGreaterThan(0);

    // Beban operasional hanya berasal dari tabel beban (expenses), bukan pembelian stok
    const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    expect(summary.operatingExpenses).toBe(totalExpenses);
    expect(summary.operatingExpenses).not.toContain(totalPurchases);

    // Arus kas keluar mencakup pembelian persediaan + beban operasional
    expect(summary.recordedCashFlow.cashOutflows).toBe(totalPurchases + totalExpenses);
    expect(summary.recordedCashFlow.cashInflows).toBe(summary.netSales);
    expect(summary.recordedCashFlow.netCashFlow).toBe(
      summary.netSales - (totalPurchases + totalExpenses)
    );
  });

  it("Skenario 16: Peringatan stok rendah mendeteksi produk dengan stockQuantity <= minStockAlert", () => {
    const summary = demoStoreService.getDashboardSummary();

    expect(summary.lowStockAlerts.length).toBeGreaterThan(0);
    for (const alert of summary.lowStockAlerts) {
      expect(alert.stockQuantity).toBeLessThanOrEqual(alert.minStockAlert);
    }

    // Sabun cuci piring (stok: 3, min: 5) dan Air Galon (stok: 2, min: 4) harus terdeteksi
    const lowStockNames = summary.lowStockAlerts.map((a) => a.name);
    expect(lowStockNames).toContain("Sabun Cuci Piring Jeruk Nipis 750ml");
    expect(lowStockNames).toContain("Air Mineral Galon 19L (Isi Ulang Resmi)");
  });

  it("Skenario 17: Filter rentang tanggal pada getDashboardSummary bekerja secara akurat", () => {
    // Filter hanya transaksi tanggal 2026-10-15
    const summaryToday = demoStoreService.getDashboardSummary("2026-10-15", "2026-10-15");

    expect(summaryToday.dailySalesTrend.length).toBe(1);
    expect(summaryToday.dailySalesTrend[0].date).toBe("2026-10-15");
    expect(summaryToday.netSales).toBe(summaryToday.dailySalesTrend[0].amount);
  });

  // -------------------------------------------------------------------------
  // Skenario 18-20: Mekanisme Reaktivitas Listener (Subscriber Pattern)
  // -------------------------------------------------------------------------
  it("Skenario 18: Listener menerima notifikasi saat saveState dipanggil", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    demoStoreService.saveState((prev) => ({
      ...prev,
      business: { ...prev.business, phone: "089999999999" },
    }));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("Skenario 19: Listener menerima notifikasi saat resetState dipanggil", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    demoStoreService.resetState();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("Skenario 20: Unsubscribe menghentikan pengiriman notifikasi ke listener", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    unsubscribe();
    demoStoreService.resetState();

    expect(listener).not.toHaveBeenCalled();
  });

  it("Skenario 21: Membaca snapshot (getState / getServerSnapshot) tidak memicu notifikasi atau mutasi", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    const s1 = demoStoreService.getState();
    const s2 = demoStoreService.getState();
    const ss1 = demoStoreService.getServerSnapshot();
    const ss2 = demoStoreService.getServerSnapshot();

    expect(s1).toBe(s2);
    expect(ss1).toBe(ss2);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("Skenario 22: getServerSnapshot mengembalikan referensi snapshot yang stabil tanpa mengakses storage", () => {
    const ss1 = demoStoreService.getServerSnapshot();
    const ss2 = demoStoreService.getServerSnapshot();

    expect(ss1).toBe(ss2);
    expect(ss1.business.name).toBe("Toko Sembako Sejahtera");
    expect(ss1.products.length).toBe(15);
  });

  it("Skenario 23: Reset memulihkan seed data secara idempoten dan tidak menimbulkan infinite loop", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    const reset1 = demoStoreService.resetState();
    expect(listener).toHaveBeenCalledTimes(1);

    const s1 = demoStoreService.getState();
    const s2 = demoStoreService.getState();
    expect(s1).toBe(reset1);
    expect(s2).toBe(reset1);

    unsubscribe();
  });

  it("Skenario 24: Mount, update, dan unmount subscriber tidak menimbulkan kebocoran listener", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    const unsubA = demoStoreService.subscribe(listenerA);
    const unsubB = demoStoreService.subscribe(listenerB);

    demoStoreService.saveState((prev) => ({
      ...prev,
      business: { ...prev.business, phone: "081111111111" },
    }));

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubA();

    demoStoreService.saveState((prev) => ({
      ...prev,
      business: { ...prev.business, phone: "082222222222" },
    }));

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(2);

    unsubB();
  });

  it("Skenario 25: Simulasi kontrak useSyncExternalStore (getSnapshot tearing check) lulus tanpa re-render loop", () => {
    const getSnapshot = demoStoreService.getState;
    const subscribe = demoStoreService.subscribe;

    const renderSnapshot = getSnapshot();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    const effectSnapshot = getSnapshot();
    expect(Object.is(renderSnapshot, effectSnapshot)).toBe(true);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("DemoStoreService — Stage 4C Batch 1: Transaction Engine", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    const storageInstance = localStorageMock as unknown as Storage;
    if (typeof window === "undefined") {
      (global as unknown as { window: unknown }).window = {
        localStorage: storageInstance,
      };
    } else {
      Object.defineProperty(window, "localStorage", {
        value: storageInstance,
        writable: true,
      });
    }

    demoStoreService.resetState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Penjualan valid mengurangi stok dan menyimpan snapshot transaksi
  it("Skenario 1: Penjualan valid mengurangi stok dan menyimpan snapshot transaksi", () => {
    const initialProduct = demoStoreService.getState().products.find((p) => p.id === "prod-001")!;
    expect(initialProduct.stockQuantity).toBe(25);

    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 2 }],
      paymentMethod: "CASH",
      cashReceived: 200000,
      notes: "Pembelian Beras Ramos 2 karung",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const sale = result.data;
    expect(sale.items.length).toBe(1);
    expect(sale.items[0].productId).toBe("prod-001");
    expect(sale.items[0].productName).toBe("Beras Ramos Super 5kg");
    expect(sale.items[0].quantity).toBe(2);
    expect(sale.items[0].unitPrice).toBe(76000);
    expect(sale.items[0].costPrice).toBe(68000);
    expect(sale.items[0].subtotal).toBe(152000);
    expect(sale.subtotal).toBe(152000);
    expect(sale.discount).toBe(0);
    expect(sale.totalAmount).toBe(152000);
    expect(sale.totalCogs).toBe(136000);
    expect(sale.grossProfit).toBe(16000);
    expect(sale.status).toBe("COMPLETED");
    expect(sale.cashReceived).toBe(200000);
    expect(sale.cashChange).toBe(48000);

    // Verifikasi stok berkurang di store (25 - 2 = 23)
    const updatedProduct = demoStoreService.getState().products.find((p) => p.id === "prod-001")!;
    expect(updatedProduct.stockQuantity).toBe(23);

    // Verifikasi getSaleById dapat menemukan transaksi
    const retrievedSale = demoStoreService.getSaleById(sale.id);
    expect(retrievedSale).toBeDefined();
    expect(retrievedSale?.invoiceNumber).toBe(sale.invoiceNumber);
  });

  // 2. Daftar item kosong ditolak
  it("Skenario 2: Daftar item kosong ditolak dengan kode EMPTY_CART", () => {
    const result = demoStoreService.recordSale({
      items: [],
      paymentMethod: "CASH",
      cashReceived: 50000,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("EMPTY_CART");
  });

  // 3. Produk tidak ditemukan ditolak
  it("Skenario 3: Produk tidak ditemukan ditolak dengan kode PRODUCT_NOT_FOUND", () => {
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-invalid-999", quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: 50000,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PRODUCT_NOT_FOUND");
    }

    // Uji ketahanan terhadap item null/non-object
    const resNullItem = demoStoreService.recordSale({
      items: [null as unknown as { productId: string; quantity: number }],
      paymentMethod: "CASH",
      cashReceived: 50000,
    });
    expect(resNullItem.success).toBe(false);
    if (!resNullItem.success) {
      expect(resNullItem.error.code).toBe("PRODUCT_NOT_FOUND");
    }
  });

  // 4. Produk arsip/nonaktif ditolak
  it("Skenario 4: Produk arsip/nonaktif ditolak dengan kode PRODUCT_INACTIVE", () => {
    // Nonaktifkan prod-001
    demoStoreService.saveState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === "prod-001" ? { ...p, isArchived: true } : p
      ),
    }));

    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: 100000,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PRODUCT_INACTIVE");
  });

  // 5. Kuantitas nol, negatif, pecahan, atau tidak valid ditolak
  it("Skenario 5: Kuantitas nol, negatif, atau pecahan ditolak dengan kode INVALID_QUANTITY", () => {
    const resZero = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 0 }],
      paymentMethod: "CASH",
      cashReceived: 50000,
    });
    expect(resZero.success).toBe(false);
    if (!resZero.success) expect(resZero.error.code).toBe("INVALID_QUANTITY");

    const resNegative = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: -2 }],
      paymentMethod: "CASH",
      cashReceived: 50000,
    });
    expect(resNegative.success).toBe(false);
    if (!resNegative.success) expect(resNegative.error.code).toBe("INVALID_QUANTITY");

    const resDecimal = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1.5 }],
      paymentMethod: "CASH",
      cashReceived: 50000,
    });
    expect(resDecimal.success).toBe(false);
    if (!resDecimal.success) expect(resDecimal.error.code).toBe("INVALID_QUANTITY");
  });

  // 6. Stok tidak cukup ditolak
  it("Skenario 6: Stok tidak cukup ditolak dengan kode INSUFFICIENT_STOCK", () => {
    // prod-015 stok awalnya 2
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-015", quantity: 5 }],
      paymentMethod: "CASH",
      cashReceived: 200000,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INSUFFICIENT_STOCK");

    // Pastikan stok tetap utuh
    const product = demoStoreService.getState().products.find((p) => p.id === "prod-015")!;
    expect(product.stockQuantity).toBe(2);
  });

  // 7. Duplikasi produk dalam beberapa item tidak melewati validasi stok
  it("Skenario 7: Duplikasi produk dalam beberapa baris keranjang diagregasi dan dicek terhadap stok", () => {
    // prod-015 stok awalnya 2. Di keranjang ada 2 baris: baris 1 = 2, baris 2 = 1. Total = 3 > 2.
    const result = demoStoreService.recordSale({
      items: [
        { productId: "prod-015", quantity: 2 },
        { productId: "prod-015", quantity: 1 },
      ],
      paymentMethod: "CASH",
      cashReceived: 200000,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INSUFFICIENT_STOCK");
  });

  // 8. Diskon tidak valid ditolak
  it("Skenario 8: Diskon item negatif atau melebihi harga baris, serta diskon transaksi melebihi subtotal ditolak", () => {
    // Diskon item negatif
    const resNegItem = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1, itemDiscount: -5000 }],
      paymentMethod: "CASH",
      cashReceived: 100000,
    });
    expect(resNegItem.success).toBe(false);
    if (!resNegItem.success) expect(resNegItem.error.code).toBe("INVALID_DISCOUNT");

    // Diskon item melebihi harga kotor (harga: 76.000, diskon: 80.000)
    const resOverItem = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1, itemDiscount: 80000 }],
      paymentMethod: "CASH",
      cashReceived: 100000,
    });
    expect(resOverItem.success).toBe(false);
    if (!resOverItem.success) expect(resOverItem.error.code).toBe("INVALID_DISCOUNT");

    // Diskon transaksi negatif
    const resNegTx = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      transactionDiscount: -1000,
      paymentMethod: "CASH",
      cashReceived: 100000,
    });
    expect(resNegTx.success).toBe(false);
    if (!resNegTx.success) expect(resNegTx.error.code).toBe("INVALID_DISCOUNT");

    // Diskon transaksi melebihi subtotal (subtotal: 76.000, diskon: 100.000)
    const resOverTx = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      transactionDiscount: 100000,
      paymentMethod: "CASH",
      cashReceived: 100000,
    });
    expect(resOverTx.success).toBe(false);
    if (!resOverTx.success) expect(resOverTx.error.code).toBe("INVALID_DISCOUNT");
  });

  // 9. Total pembayaran dan HPP dihitung benar
  it("Skenario 9: Total pembayaran, diskon item, diskon transaksi, HPP, dan laba kotor dihitung akurat", () => {
    // prod-001: price 76000, cogs 68000 (qty 2 -> gross 152000, itemDiscount 2000 -> subtotal 150000, cogs 136000)
    // prod-002: price 36500, cogs 32000 (qty 1 -> gross 36500, itemDiscount 500 -> subtotal 36000, cogs 32000)
    // Gross Subtotal = 186000
    // Transaction Discount = 6000
    // Net Total Amount = 180000
    // Total COGS = 168000
    // Gross Profit = 180000 - 168000 = 12000
    const result = demoStoreService.recordSale({
      items: [
        { productId: "prod-001", quantity: 2, itemDiscount: 2000 },
        { productId: "prod-002", quantity: 1, itemDiscount: 500 },
      ],
      transactionDiscount: 6000,
      paymentMethod: "CASH",
      cashReceived: 200000,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const sale = result.data;
    expect(sale.subtotal).toBe(186000);
    expect(sale.discount).toBe(6000);
    expect(sale.totalAmount).toBe(180000);
    expect(sale.totalCogs).toBe(168000);
    expect(sale.grossProfit).toBe(12000);
    expect(sale.cashChange).toBe(20000);
  });

  // 10. Alokasi diskon item/transaksi deterministik dan tidak dihitung dua kali
  it("Skenario 10: Alokasi diskon transaksi ke baris item deterministik dan tidak dihitung ganda", () => {
    const allocations = allocateTransactionDiscount([150000, 36000], 6000);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(6000);

    const result = demoStoreService.recordSale({
      items: [
        { productId: "prod-001", quantity: 2, itemDiscount: 2000 },
        { productId: "prod-002", quantity: 1, itemDiscount: 500 },
      ],
      transactionDiscount: 6000,
      paymentMethod: "CASH",
      cashReceived: 200000,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const sale = result.data;
    const item1 = sale.items[0];
    const item2 = sale.items[1];

    expect(item1.allocatedTransactionDiscount! + item2.allocatedTransactionDiscount!).toBe(6000);
    expect(item1.netAmount! + item2.netAmount!).toBe(180000);
  });

  // 11. Pembayaran tunai kurang ditolak
  it("Skenario 11: Pembayaran tunai kurang ditolak dengan kode INSUFFICIENT_CASH", () => {
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: 50000, // Total 76.000
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INSUFFICIENT_CASH");
  });

  // 12. Pembayaran tunai cukup menghasilkan kembalian yang benar
  it("Skenario 12: Pembayaran tunai menghasilkan perhitungan kembalian yang benar", () => {
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: 100000, // Total 76.000, kembalian 24.000
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cashReceived).toBe(100000);
    expect(result.data.cashChange).toBe(24000);
  });

  // 13. Transfer bank tidak menghasilkan aturan kembalian tunai yang keliru
  it("Skenario 13: Transfer bank tidak menerapkan aturan uang tunai atau kembalian keliru", () => {
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.paymentMethod).toBe("BANK_TRANSFER");
    expect(result.data.cashReceived).toBeUndefined();
    expect(result.data.cashChange).toBe(0);
  });

  // 14. Kegagalan validasi tidak mengubah stok, penjualan, snapshot, atau notifikasi subscriber
  it("Skenario 14: Kegagalan validasi tidak menimbulkan perubahan parsial pada stok atau notifikasi subscriber", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    const snapshotBefore = demoStoreService.getState();
    const stockBefore = snapshotBefore.products.find((p) => p.id === "prod-001")!.stockQuantity;
    const salesCountBefore = snapshotBefore.sales.length;

    // Eksekusi transaksi yang gagal (uang tunai kurang)
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: 10000,
    });

    expect(result.success).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    const snapshotAfter = demoStoreService.getState();
    expect(snapshotAfter).toBe(snapshotBefore); // Referensi snapshot tetap identik
    expect(snapshotAfter.products.find((p) => p.id === "prod-001")!.stockQuantity).toBe(stockBefore);
    expect(snapshotAfter.sales.length).toBe(salesCountBefore);

    unsubscribe();
  });

  // 15. Penjualan yang berhasil hanya menerbitkan satu perubahan state konsisten
  it("Skenario 15: Penjualan yang berhasil hanya menerbitkan tepat satu kali pembaruan snapshot dan notifikasi", () => {
    const listener = vi.fn();
    const unsubscribe = demoStoreService.subscribe(listener);

    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    expect(result.success).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  // 16. Pembatalan dengan alasan kosong atau terlalu pendek ditolak
  it("Skenario 16: Pembatalan dengan alasan kosong atau kurang dari 5 karakter ditolak", () => {
    const state = demoStoreService.getState();
    const activeSale = state.sales.find((s) => s.status === "COMPLETED")!;

    // Alasan kosong
    const resEmpty = demoStoreService.voidSale({
      saleId: activeSale.id,
      voidReason: "",
    });
    expect(resEmpty.success).toBe(false);
    if (!resEmpty.success) expect(resEmpty.error.code).toBe("INVALID_VOID_REASON");

    // Alasan hanya spasi
    const resSpaces = demoStoreService.voidSale({
      saleId: activeSale.id,
      voidReason: "    ",
    });
    expect(resSpaces.success).toBe(false);
    if (!resSpaces.success) expect(resSpaces.error.code).toBe("INVALID_VOID_REASON");

    // Alasan terlalu pendek (< 5 karakter)
    const resShort = demoStoreService.voidSale({
      saleId: activeSale.id,
      voidReason: "bad",
    });
    expect(resShort.success).toBe(false);
    if (!resShort.success) expect(resShort.error.code).toBe("INVALID_VOID_REASON");

    const resVeryShort = demoStoreService.voidSale({
      saleId: activeSale.id,
      voidReason: "test",
    });
    expect(resVeryShort.success).toBe(false);
    if (!resVeryShort.success) expect(resVeryShort.error.code).toBe("INVALID_VOID_REASON");
  });

  // 17. Pembatalan memulihkan stok tepat satu kali
  it("Skenario 17: Pembatalan transaksi memulihkan stok produk tepat satu kali", () => {
    // 1. Buat penjualan baru: beli 2 prod-001 (stok 25 -> 23)
    const saleResult = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 2 }],
      paymentMethod: "BANK_TRANSFER",
    });
    expect(saleResult.success).toBe(true);
    if (!saleResult.success) return;

    expect(demoStoreService.getState().products.find((p) => p.id === "prod-001")!.stockQuantity).toBe(23);

    // 2. Batalkan transaksi
    const voidResult = demoStoreService.voidSale({
      saleId: saleResult.data.id,
      voidReason: "Pelanggan salah memilih varian beras dan meminta pembatalan",
    });

    expect(voidResult.success).toBe(true);
    if (!voidResult.success) return;

    expect(voidResult.data.status).toBe("VOIDED");
    expect(voidResult.data.voidReason).toBe("Pelanggan salah memilih varian beras dan meminta pembatalan");
    expect(voidResult.data.voidedAt).toBeDefined();

    // 3. Stok harus kembali utuh ke 25
    const restoredProduct = demoStoreService.getState().products.find((p) => p.id === "prod-001")!;
    expect(restoredProduct.stockQuantity).toBe(25);
  });

  // 18. Pembatalan transaksi yang sudah dibatalkan ditolak
  it("Skenario 18: Pembatalan transaksi yang statusnya sudah VOIDED ditolak dengan kode ALREADY_VOIDED", () => {
    const state = demoStoreService.getState();
    const alreadyVoidedSale = state.sales.find((s) => s.status === "VOIDED")!;

    const result = demoStoreService.voidSale({
      saleId: alreadyVoidedSale.id,
      voidReason: "Mencoba membatalkan ulang transaksi yang sudah void",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("ALREADY_VOIDED");
  });

  // 19. Snapshot harga dan HPP transaksi lama tetap sama setelah data produk berubah
  it("Skenario 19: Snapshot harga dan HPP transaksi lama tidak berubah saat harga produk dimodifikasi", () => {
    const saleResult = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });
    expect(saleResult.success).toBe(true);
    if (!saleResult.success) return;

    const saleId = saleResult.data.id;

    // Ubah harga dan HPP master produk di katalog
    demoStoreService.saveState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === "prod-001" ? { ...p, price: 99000, cogs: 88000 } : p
      ),
    }));

    // Periksa snapshot pada transaksi lama
    const saleAfter = demoStoreService.getSaleById(saleId)!;
    expect(saleAfter.items[0].unitPrice).toBe(76000);
    expect(saleAfter.items[0].costPrice).toBe(68000);
  });

  // 20. Transaksi batal tidak dihitung sebagai penjualan aktif
  it("Skenario 20: Transaksi berstatus VOIDED otomatis dikeluarkan dari ringkasan penjualan dashboard", () => {
    const summaryBefore = demoStoreService.getDashboardSummary();

    const saleResult = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });
    expect(saleResult.success).toBe(true);
    if (!saleResult.success) return;

    const summaryWithSale = demoStoreService.getDashboardSummary();
    expect(summaryWithSale.netSales).toBe(summaryBefore.netSales + 76000);

    // Batalkan transaksi
    demoStoreService.voidSale({
      saleId: saleResult.data.id,
      voidReason: "Pembatalan transaksi untuk uji isolasi dashboard",
    });

    const summaryAfterVoid = demoStoreService.getDashboardSummary();
    expect(summaryAfterVoid.netSales).toBe(summaryBefore.netSales);
    expect(summaryAfterVoid.cogs).toBe(summaryBefore.cogs);
    expect(summaryAfterVoid.grossProfit).toBe(summaryBefore.grossProfit);
  });

  // 21. Nomor invoice tidak bentrok dengan invoice yang sudah ada
  it("Skenario 21: Nomor invoice yang dihasilkan unik dan tidak berbenturan dengan transaksi yang ada", () => {
    const res1 = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });
    const res2 = demoStoreService.recordSale({
      items: [{ productId: "prod-002", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    if (!res1.success || !res2.success) return;

    expect(res1.data.invoiceNumber).toMatch(/^INV-\d{8}-[0-9A-Z]{4}$/);
    expect(res2.data.invoiceNumber).toMatch(/^INV-\d{8}-[0-9A-Z]{4}$/);
    expect(res1.data.invoiceNumber).not.toBe(res2.data.invoiceNumber);
  });

  // 22. Reset Demo mengembalikan data seed dan membersihkan mutasi sesi sesuai kontrak
  it("Skenario 22: Reset Demo membersihkan mutasi transaksi baru dan memulihkan seed data awal", () => {
    demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 2 }],
      paymentMethod: "BANK_TRANSFER",
    });
    expect(demoStoreService.getState().sales.length).toBe(28);

    demoStoreService.resetState();

    expect(demoStoreService.getState().sales.length).toBe(27);
    expect(demoStoreService.getState().products.find((p) => p.id === "prod-001")!.stockQuantity).toBe(25);
  });

  // 23. Penyimpanan lokal rusak atau tidak tersedia tidak membuat state menjadi korup
  it("Skenario 23: Penyimpanan lokal yang melempar error kuota tetap mempertahankan state di memori tanpa crash", () => {
    // Simulasikan setItem melempar error kuota penuh
    const setItemMock = vi.fn().mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: setItemMock,
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    expect(result.success).toBe(true);
    expect(demoStoreService.getState().products.find((p) => p.id === "prod-001")!.stockQuantity).toBe(24);
  });

  // 24. getState() tetap mengembalikan snapshot referensi stabil di antara mutasi
  it("Skenario 24: getState() mengembalikan referensi snapshot yang sama di antara pemanggilan", () => {
    const s1 = demoStoreService.getState();
    const s2 = demoStoreService.getState();
    expect(s1).toBe(s2);

    demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    const s3 = demoStoreService.getState();
    const s4 = demoStoreService.getState();
    expect(s3).not.toBe(s1);
    expect(s3).toBe(s4);
  });

  // 25. Perilaku subscriber tetap kompatibel dengan useSyncExternalStore
  it("Skenario 25: Perilaku subscriber dan snapshot mematuhi kontrak useSyncExternalStore", () => {
    const getSnapshot = demoStoreService.getState;
    const subscribe = demoStoreService.subscribe;

    const snap1 = getSnapshot();
    const listener = vi.fn();
    const unsub = subscribe(listener);

    const snap2 = getSnapshot();
    expect(Object.is(snap1, snap2)).toBe(true);
    expect(listener).not.toHaveBeenCalled();

    demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const snap3 = getSnapshot();
    expect(Object.is(snap1, snap3)).toBe(false);

    unsub();
  });

  // -------------------------------------------------------------------------
  // Skenario 26-30: Operasi Produk, Pembelian Restock, dan Pengeluaran Demo
  // -------------------------------------------------------------------------
  it("Skenario 26: createProduct() menambah produk baru dan menolak SKU duplikat", () => {
    const resSuccess = demoStoreService.createProduct({
      name: "Kecap Manis Botol 600ml",
      sku: "KCP-MNS-60",
      category: "Bumbu & Pemanis",
      price: 24000,
      cogs: 20000,
      stockQuantity: 10,
      minStockAlert: 2,
      unit: "botol",
    });

    expect(resSuccess.success).toBe(true);
    if (resSuccess.success) {
      expect(resSuccess.data.sku).toBe("KCP-MNS-60");
      expect(resSuccess.data.price).toBe(24000);
      expect(demoStoreService.getProductById(resSuccess.data.id)).toBeDefined();
    }

    // Coba SKU duplikat
    const resDuplicate = demoStoreService.createProduct({
      name: "Kecap Manis Tiruan",
      sku: "KCP-MNS-60",
      category: "Bumbu & Pemanis",
      price: 22000,
      cogs: 18000,
      stockQuantity: 5,
      minStockAlert: 2,
      unit: "botol",
    });
    expect(resDuplicate.success).toBe(false);
    if (!resDuplicate.success) {
      expect(resDuplicate.error.code).toBe("DUPLICATE_SKU");
    }
  });

  it("Skenario 27: updateProduct() dan archiveProduct() berfungsi dengan benar", () => {
    const updateRes = demoStoreService.updateProduct({
      id: "prod-001",
      name: "Beras Ramos Super 5kg (Revisi)",
      price: 78000,
    });
    expect(updateRes.success).toBe(true);
    expect(demoStoreService.getProductById("prod-001")?.price).toBe(78000);
    expect(demoStoreService.getProductById("prod-001")?.name).toBe("Beras Ramos Super 5kg (Revisi)");

    // Archive
    const archiveRes = demoStoreService.archiveProduct("prod-001");
    expect(archiveRes.success).toBe(true);
    expect(demoStoreService.getProductById("prod-001")?.isArchived).toBe(true);
  });

  it("Skenario 28: recordPurchase() menambah stok dan mereposisi Moving Weighted Average Cost HPP", () => {
    // prod-002: Minyak Goreng Sawit 2L (stok awal 18, cogs awal 32.000)
    // Beli 12 unit dengan harga beli baru Rp 35.000
    // Total stok baru: 18 + 12 = 30
    // HPP baru: (18 * 32.000 + 12 * 35.000) / 30 = (576.000 + 420.000) / 30 = 996.000 / 30 = 33.200
    const purchaseRes = demoStoreService.recordPurchase({
      supplierName: "PT Sumber Pangan Makmur",
      paymentMethod: "CASH",
      items: [
        {
          productId: "prod-002",
          quantity: 12,
          purchaseCost: 35000,
        },
      ],
    });

    expect(purchaseRes.success).toBe(true);
    const updatedProd = demoStoreService.getProductById("prod-002")!;
    expect(updatedProd.stockQuantity).toBe(30);
    expect(updatedProd.cogs).toBe(33200);

    const purchases = demoStoreService.getPurchases();
    expect(purchases[0].supplierName).toBe("PT Sumber Pangan Makmur");
    expect(purchases[0].totalAmount).toBe(420000);
  });

  it("Skenario 29: recordExpense() dan deleteExpense() mencatat dan menghapus beban operasional", () => {
    const expRes = demoStoreService.recordExpense({
      category: "Listrik & Air",
      amount: 150000,
      description: "Token listrik kasir bulan berjalan",
      paymentMethod: "CASH",
    });

    expect(expRes.success).toBe(true);
    if (expRes.success) {
      const expId = expRes.data.id;
      expect(demoStoreService.getExpenses().some((e) => e.id === expId)).toBe(true);

      const delRes = demoStoreService.deleteExpense(expId);
      expect(delRes.success).toBe(true);
      expect(demoStoreService.getExpenses().some((e) => e.id === expId)).toBe(false);
    }
  });

  it("Skenario 30: updateBusinessProfile() memperbarui nama, kategori, kontak, dan preferensi struk toko", () => {
    // Validasi penolakan nama kosong
    const invalidRes = demoStoreService.updateBusinessProfile({ name: "   " });
    expect(invalidRes.success).toBe(false);

    // Pembaruan profil sukses
    const updateRes = demoStoreService.updateBusinessProfile({
      name: "Toko Berkah Kelontong",
      category: "Kelontong / Sembako",
      phone: "081233445566",
      address: "Jl. Veteran No. 10, Jakarta Pusat",
      receiptFooter: "Terima kasih banyak atas kunjungan Anda!",
      receiptPaperSize: "80mm",
    });

    expect(updateRes.success).toBe(true);
    if (updateRes.success) {
      expect(updateRes.data.name).toBe("Toko Berkah Kelontong");
      expect(updateRes.data.receiptPaperSize).toBe("80mm");
    }

    const currentProfile = demoStoreService.getBusinessProfile();
    expect(currentProfile.name).toBe("Toko Berkah Kelontong");
    expect(currentProfile.phone).toBe("081233445566");
    expect(currentProfile.receiptPaperSize).toBe("80mm");
  });

  it("Skenario 31: clearTransactionsOnly() menghapus transaksi tetapi mempertahankan katalog produk", () => {
    expect(demoStoreService.getSales().length).toBeGreaterThan(0);
    expect(demoStoreService.getPurchases().length).toBeGreaterThan(0);
    expect(demoStoreService.getExpenses().length).toBeGreaterThan(0);
    const initialProductCount = demoStoreService.getProducts().length;

    demoStoreService.clearTransactionsOnly();

    expect(demoStoreService.getSales()).toEqual([]);
    expect(demoStoreService.getPurchases()).toEqual([]);
    expect(demoStoreService.getExpenses()).toEqual([]);
    expect(demoStoreService.getProducts().length).toBe(initialProductCount);
  });
});

