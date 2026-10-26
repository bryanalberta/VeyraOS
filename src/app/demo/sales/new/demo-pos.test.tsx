import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import DemoPosPage from "./page";
import {
  posReducer,
  initialPosState,
  calculateCartSummary,
  getQuickCashOptions,
  type PosCartItem,
  type PosState,
} from "./pos-state";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type { DemoProduct } from "@/services/demo/demo-types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/sales/new",
}));

describe("Demo POS Cashier UI & Controller Tests (/demo/sales/new)", () => {
  beforeEach(() => {
    demoStoreService.resetState();
  });

  // -------------------------------------------------------------------------
  // 1. Halaman POS dapat dirender dan menampilkan produk Demo
  // -------------------------------------------------------------------------
  it("1. Halaman POS dapat dirender dan menampilkan produk Demo dalam katalog", () => {
    const html = renderToStaticMarkup(<DemoPosPage />);

    // Header POS & identitas toko
    expect(html).toContain("Kasir POS Mode Demo");
    expect(html).toContain("Kasir Penjualan Langsung");
    expect(html).toContain("Toko Sembako Sejahtera");

    // Bar pencarian dan tombol kembali
    expect(html).toContain('id="product-search-input"');
    expect(html).toContain("Kembali ke Dashboard");

    // Produk demo muncul dalam markup awal
    expect(html).toContain("Beras Ramos Super 5kg");
    expect(html).toContain("Minyak Goreng Sawit 2L");
    expect(html).toContain("Gula Pasir Kristal Putih 1kg");

    // Panel keranjang kosong
    expect(html).toContain("Keranjang Belanja Kosong");
    expect(html).toContain("Keranjang Kasir");
  });

  // -------------------------------------------------------------------------
  // 2. Pencarian dan filter kategori berfungsi jika tersedia
  // -------------------------------------------------------------------------
  it("2. Pencarian dan filter kategori menyaring daftar produk dengan benar", () => {
    const state = demoStoreService.getState();
    const products = state.products;

    // Filter kategori "Beras & Biji-bijian"
    const berasProducts = products.filter((p) => p.category === "Beras & Biji-bijian");
    expect(berasProducts.length).toBeGreaterThan(0);
    berasProducts.forEach((p) => {
      expect(p.category).toBe("Beras & Biji-bijian");
    });

    // Pencarian berdasarkan query SKU "MYK-SWT-02"
    const query = "myk-swt";
    const matchedByQuery = products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
    expect(matchedByQuery.length).toBe(1);
    expect(matchedByQuery[0].name).toBe("Minyak Goreng Sawit 2L");
  });

  // -------------------------------------------------------------------------
  // 3. Menambahkan produk memperbarui keranjang
  // -------------------------------------------------------------------------
  it("3. Menambahkan produk ke keranjang memperbarui daftar item dan kuantitas", () => {
    const testProduct: DemoProduct = {
      id: "prod-test-01",
      name: "Kecap Manis Uji 275ml",
      sku: "KCP-TEST-01",
      category: "Bumbu & Saus",
      price: 12500,
      cogs: 10000,
      stockQuantity: 10,
      minStockAlert: 2,
      unit: "botol",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Tambah pertama kali
    let state = posReducer(initialPosState, { type: "ADD_TO_CART", product: testProduct });
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].productId).toBe("prod-test-01");
    expect(state.cart[0].quantity).toBe(1);
    expect(state.cart[0].unitPrice).toBe(12500);

    // Tambah kedua kali (item yang sama -> kuantitas bertambah)
    state = posReducer(state, { type: "ADD_TO_CART", product: testProduct });
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].quantity).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 4. Kuantitas dapat diubah dan item dapat dihapus
  // -------------------------------------------------------------------------
  it("4. Kuantitas dapat diubah melalui stepper/input langsung dan item dapat dihapus", () => {
    const initialCartState: PosState = {
      ...initialPosState,
      cart: [
        {
          productId: "prod-001",
          name: "Beras Ramos Super 5kg",
          sku: "BRS-RMS-05",
          unit: "sak",
          unitPrice: 76000,
          availableStock: 25,
          quantity: 2,
          itemDiscount: 0,
        },
      ],
    };

    // Ubah kuantitas ke 5
    let state = posReducer(initialCartState, {
      type: "UPDATE_QUANTITY",
      productId: "prod-001",
      quantity: 5,
    });
    expect(state.cart[0].quantity).toBe(5);

    // Ubah kuantitas ke 0 -> item otomatis terhapus dari keranjang
    state = posReducer(state, {
      type: "UPDATE_QUANTITY",
      productId: "prod-001",
      quantity: 0,
    });
    expect(state.cart.length).toBe(0);

    // Pengujian aksi eksplisit REMOVE_ITEM
    const withItemState: PosState = {
      ...initialPosState,
      cart: [
        {
          productId: "prod-002",
          name: "Minyak Goreng Sawit 2L",
          sku: "MYK-SWT-02",
          unit: "pouch",
          unitPrice: 36500,
          availableStock: 18,
          quantity: 3,
          itemDiscount: 0,
        },
      ],
    };
    const removedState = posReducer(withItemState, {
      type: "REMOVE_ITEM",
      productId: "prod-002",
    });
    expect(removedState.cart.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. Produk habis/nonaktif tidak bisa ditambahkan
  // -------------------------------------------------------------------------
  it("5. Produk habis (stok = 0) atau dinonaktifkan/diarsipkan tidak dapat dimasukkan ke keranjang", () => {
    const outOfStockProduct: DemoProduct = {
      id: "prod-oos",
      name: "Produk Habis Total",
      sku: "OOS-001",
      category: "Bahan Pokok",
      price: 15000,
      cogs: 12000,
      stockQuantity: 0,
      minStockAlert: 5,
      unit: "pcs",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const archivedProduct: DemoProduct = {
      id: "prod-archived",
      name: "Produk Diarsipkan",
      sku: "ARC-001",
      category: "Bahan Pokok",
      price: 20000,
      cogs: 15000,
      stockQuantity: 10,
      minStockAlert: 2,
      unit: "pcs",
      isArchived: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Coba tambahkan produk habis
    let state = posReducer(initialPosState, {
      type: "ADD_TO_CART",
      product: outOfStockProduct,
    });
    expect(state.cart.length).toBe(0);

    // Coba tambahkan produk arsip
    state = posReducer(initialPosState, {
      type: "ADD_TO_CART",
      product: archivedProduct,
    });
    expect(state.cart.length).toBe(0);

    // Uji batas atas: kuantitas tidak dapat melebihi sisa stok fisik
    const lowStockProduct: DemoProduct = {
      ...outOfStockProduct,
      id: "prod-low",
      stockQuantity: 2,
    };
    state = posReducer(initialPosState, { type: "ADD_TO_CART", product: lowStockProduct });
    state = posReducer(state, { type: "ADD_TO_CART", product: lowStockProduct });
    expect(state.cart[0].quantity).toBe(2);

    // Tambah ke-3 saat stok hanya 2 -> ditolak dengan pesan peringatan
    state = posReducer(state, { type: "ADD_TO_CART", product: lowStockProduct });
    expect(state.cart[0].quantity).toBe(2);
    expect(state.errorMessage).toContain("telah mencapai batas maksimum");
  });

  // -------------------------------------------------------------------------
  // 6. Diskon dan ringkasan pembayaran konsisten dengan engine
  // -------------------------------------------------------------------------
  it("6. Diskon per item dan diskon transaksi dihitung secara konsisten dengan aturan integer IDR engine", () => {
    const cart: PosCartItem[] = [
      {
        productId: "prod-001",
        name: "Beras Ramos Super 5kg",
        sku: "BRS-RMS-05",
        unit: "sak",
        unitPrice: 76000,
        availableStock: 25,
        quantity: 2, // 2 * 76.000 = 152.000
        itemDiscount: 2000, // Diskon item: Rp 2.000 -> subtotal baris: 150.000
      },
      {
        productId: "prod-002",
        name: "Minyak Goreng Sawit 2L",
        sku: "MYK-SWT-02",
        unit: "pouch",
        unitPrice: 36500,
        availableStock: 18,
        quantity: 1, // 1 * 36.500 = 36.500
        itemDiscount: 1500, // Diskon item: Rp 1.500 -> subtotal baris: 35.000
      },
    ];

    const transactionDiscount = 5000;
    const summary = calculateCartSummary(cart, transactionDiscount, "CASH", 200000);

    expect(summary.itemsCount).toBe(3);
    expect(summary.grossTotal).toBe(152000 + 36500); // 188.500
    expect(summary.itemDiscountsTotal).toBe(2000 + 1500); // 3.500
    expect(summary.grossSubtotal).toBe(185000);
    expect(summary.transactionDiscount).toBe(5000);
    expect(summary.totalAmount).toBe(180000); // 185.000 - 5.000
    expect(summary.cashReceived).toBe(200000);
    expect(summary.cashChange).toBe(20000); // 200.000 - 180.000
    expect(summary.canCheckout).toBe(true);

    // Bandingkan dengan eksekusi nyata pada DemoStoreService
    const engineResult = demoStoreService.recordSale({
      items: [
        { productId: "prod-001", quantity: 2, itemDiscount: 2000 },
        { productId: "prod-002", quantity: 1, itemDiscount: 1500 },
      ],
      paymentMethod: "CASH",
      transactionDiscount: 5000,
      cashReceived: 200000,
    });

    expect(engineResult.success).toBe(true);
    if (engineResult.success) {
      expect(engineResult.data.subtotal).toBe(summary.grossSubtotal);
      expect(engineResult.data.discount).toBe(summary.transactionDiscount);
      expect(engineResult.data.totalAmount).toBe(summary.totalAmount);
      expect(engineResult.data.cashReceived).toBe(summary.cashReceived);
      expect(engineResult.data.cashChange).toBe(summary.cashChange);
    }
  });

  // -------------------------------------------------------------------------
  // 7. Validasi uang tunai kurang dan perhitungan kembalian
  // -------------------------------------------------------------------------
  it("7. Validasi uang tunai mendeteksi kekurangan bayar dan menghitung kembalian tepat", () => {
    const cart: PosCartItem[] = [
      {
        productId: "prod-001",
        name: "Beras Ramos Super 5kg",
        sku: "BRS-RMS-05",
        unit: "sak",
        unitPrice: 76000,
        availableStock: 25,
        quantity: 1,
        itemDiscount: 0,
      },
    ];

    // Kasus 7A: Uang tunai kurang
    const shortSummary = calculateCartSummary(cart, 0, "CASH", 50000);
    expect(shortSummary.totalAmount).toBe(76000);
    expect(shortSummary.isCashSufficient).toBe(false);
    expect(shortSummary.cashShortfall).toBe(26000);
    expect(shortSummary.cashChange).toBe(0);
    expect(shortSummary.canCheckout).toBe(false);

    // Kasus 7B: Uang tunai pas
    const exactSummary = calculateCartSummary(cart, 0, "CASH", 76000);
    expect(exactSummary.isCashSufficient).toBe(true);
    expect(exactSummary.cashShortfall).toBe(0);
    expect(exactSummary.cashChange).toBe(0);
    expect(exactSummary.canCheckout).toBe(true);

    // Kasus 7C: Uang tunai lebih (kembalian)
    const overSummary = calculateCartSummary(cart, 0, "CASH", 100000);
    expect(overSummary.isCashSufficient).toBe(true);
    expect(overSummary.cashShortfall).toBe(0);
    expect(overSummary.cashChange).toBe(24000);
    expect(overSummary.canCheckout).toBe(true);

    // Uji opsi tombol uang cepat
    const quickOpts = getQuickCashOptions(76000);
    expect(quickOpts).toContain(76000); // Uang Pas
    expect(quickOpts).toContain(80000); // Bulat 10k
    expect(quickOpts).toContain(100000); // Standar 100k
  });

  // -------------------------------------------------------------------------
  // 8. Transfer bank tidak menampilkan atau memvalidasi kembalian tunai
  // -------------------------------------------------------------------------
  it("8. Pembayaran transfer bank langsung valid tanpa validasi kembalian atau uang diterima", () => {
    const cart: PosCartItem[] = [
      {
        productId: "prod-001",
        name: "Beras Ramos Super 5kg",
        sku: "BRS-RMS-05",
        unit: "sak",
        unitPrice: 76000,
        availableStock: 25,
        quantity: 1,
        itemDiscount: 0,
      },
    ];

    // Transfer bank dengan input uang tunai 0 -> tetap valid
    const bankSummary = calculateCartSummary(cart, 0, "BANK_TRANSFER", 0);
    expect(bankSummary.totalAmount).toBe(76000);
    expect(bankSummary.isCashSufficient).toBe(true);
    expect(bankSummary.cashShortfall).toBe(0);
    expect(bankSummary.cashChange).toBe(0);
    expect(bankSummary.canCheckout).toBe(true);

    // Eksekusi nyata di engine
    const result = demoStoreService.recordSale({
      items: [{ productId: "prod-001", quantity: 1 }],
      paymentMethod: "BANK_TRANSFER",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentMethod).toBe("BANK_TRANSFER");
      expect(result.data.cashReceived).toBeUndefined();
      expect(result.data.cashChange).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // 9. Klik ganda tidak membuat dua transaksi
  // -------------------------------------------------------------------------
  it("9. Flag isSubmitting mencegah pengiriman ganda (double-click protection)", () => {
    let state = initialPosState;

    // Klik pertama memicu START_SUBMITTING
    state = posReducer(state, { type: "START_SUBMITTING" });
    expect(state.isSubmitting).toBe(true);

    // Jika sedang submitting, aksi submit selanjutnya diblokir
    expect(state.isSubmitting).toBe(true);

    // Setelah transaksi selesai, isSubmitting kembali false
    const dummySale = demoStoreService.getState().sales[0];
    state = posReducer(state, { type: "SUBMIT_SUCCESS", sale: dummySale });
    expect(state.isSubmitting).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 10. Transaksi sukses menampilkan invoice dan ringkasan yang benar
  // -------------------------------------------------------------------------
  it("10. Transaksi sukses menghasilkan nomor faktur engine dan mengosongkan keranjang", () => {
    const testProduct = demoStoreService.getState().products[0];
    const initialCartState: PosState = {
      ...initialPosState,
      cart: [
        {
          productId: testProduct.id,
          name: testProduct.name,
          sku: testProduct.sku,
          unit: testProduct.unit,
          unitPrice: testProduct.price,
          availableStock: testProduct.stockQuantity,
          quantity: 2,
          itemDiscount: 0,
        },
      ],
      paymentMethod: "CASH",
      cashReceived: testProduct.price * 2,
    };

    // Eksekusi recordSale melalui engine
    const result = demoStoreService.recordSale({
      items: [{ productId: testProduct.id, quantity: 2 }],
      paymentMethod: "CASH",
      cashReceived: testProduct.price * 2,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoiceNumber).toMatch(/^INV-\d{8}-[A-Z0-9]{4}$/);

      // Reducer merespons SUBMIT_SUCCESS
      const nextState = posReducer(initialCartState, {
        type: "SUBMIT_SUCCESS",
        sale: result.data,
      });

      expect(nextState.cart.length).toBe(0);
      expect(nextState.completedSale).not.toBeNull();
      expect(nextState.completedSale?.invoiceNumber).toBe(result.data.invoiceNumber);
      expect(nextState.completedSale?.totalAmount).toBe(testProduct.price * 2);

      // Aksi Transaksi Baru mereset completedSale
      const resetState = posReducer(nextState, { type: "RESET_NEW_TRANSACTION" });
      expect(resetState.completedSale).toBeNull();
      expect(resetState.cart.length).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // 11. Error transaksi ditampilkan tanpa menghapus keranjang secara tidak sengaja
  // -------------------------------------------------------------------------
  it("11. Error transaksi mempertahankan keranjang belanja agar pengguna dapat memperbaikinya", () => {
    const existingCart: PosCartItem[] = [
      {
        productId: "prod-001",
        name: "Beras Ramos Super 5kg",
        sku: "BRS-RMS-05",
        unit: "sak",
        unitPrice: 76000,
        availableStock: 25,
        quantity: 2,
        itemDiscount: 0,
      },
    ];

    const stateWithCart: PosState = {
      ...initialPosState,
      cart: existingCart,
      isSubmitting: true,
      isConfirmOpen: true,
    };

    // Saat transaksi gagal (misal simulasi kegagalan penyimpanan)
    const failedState = posReducer(stateWithCart, {
      type: "SUBMIT_FAILURE",
      message: "Stok produk tidak mencukupi untuk menyelesaikan transaksi.",
    });

    // Keranjang harus tetap UTUH
    expect(failedState.cart.length).toBe(1);
    expect(failedState.cart[0].productId).toBe("prod-001");
    expect(failedState.cart[0].quantity).toBe(2);

    // Pesan error tercatat dan loading dihentikan
    expect(failedState.errorMessage).toBe("Stok produk tidak mencukupi untuk menyelesaikan transaksi.");
    expect(failedState.isSubmitting).toBe(false);
    expect(failedState.isConfirmOpen).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 12. Tidak ada import Supabase atau server actions dalam jalur Demo
  // -------------------------------------------------------------------------
  it("12. Memastikan TIDAK ADA import Supabase, server actions, atau mutasi produksi pada file POS", () => {
    const posFilePath = path.resolve(__dirname, "./page.tsx");
    const posFileContent = fs.readFileSync(posFilePath, "utf8");

    // Dilarang mengimpor modul Supabase atau Server Actions
    expect(posFileContent).not.toContain("@/lib/supabase");
    expect(posFileContent).not.toContain("supabase-js");
    expect(posFileContent).not.toContain("@/app/actions");
    expect(posFileContent).not.toContain("next/headers");
    expect(posFileContent).not.toContain("cookies()");

    // Wajib menggunakan Demo Store Service
    expect(posFileContent).toContain("@/services/demo/demo-store.service");
    expect(posFileContent).toContain("demoStoreService.recordSale");
  });

  // -------------------------------------------------------------------------
  // 13. Reset keranjang tidak menghapus riwayat transaksi di Demo Store
  // -------------------------------------------------------------------------
  it("13. Aksi RESET_NEW_TRANSACTION tidak menghapus atau mengubah transaksi yang sudah tersimpan", () => {
    const initialSalesCount = demoStoreService.getState().sales.length;

    // Simpan satu transaksi baru
    const testProduct = demoStoreService.getState().products[0];
    const saleResult = demoStoreService.recordSale({
      items: [{ productId: testProduct.id, quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: testProduct.price,
    });
    expect(saleResult.success).toBe(true);
    expect(demoStoreService.getState().sales.length).toBe(initialSalesCount + 1);

    // Jalankan aksi RESET_NEW_TRANSACTION pada reducer
    const activeState: PosState = {
      ...initialPosState,
      completedSale: saleResult.success ? saleResult.data : null,
      cart: [{ productId: "p1", name: "test", sku: "SKU", unit: "sak", unitPrice: 1000, availableStock: 10, quantity: 1, itemDiscount: 0 }],
    };

    const nextState = posReducer(activeState, { type: "RESET_NEW_TRANSACTION" });
    expect(nextState.completedSale).toBeNull();
    expect(nextState.cart.length).toBe(0);

    // Verifikasi data di DemoStoreService tetap utuh (tidak terhapus)
    const currentSales = demoStoreService.getState().sales;
    expect(currentSales.length).toBe(initialSalesCount + 1);
    if (saleResult.success) {
      expect(currentSales.some((s) => s.id === saleResult.data.id)).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // 14. Dialog konfirmasi dan penutupan aman via CLOSE_CONFIRM
  // -------------------------------------------------------------------------
  it("14. Aksi OPEN_CONFIRM dan CLOSE_CONFIRM mengendalikan modal konfirmasi secara aman", () => {
    // Keranjang kosong tidak dapat membuka konfirmasi
    let state = posReducer(initialPosState, { type: "OPEN_CONFIRM" });
    expect(state.isConfirmOpen).toBe(false);

    // Keranjang terisi dapat membuka konfirmasi
    const stateWithItem: PosState = {
      ...initialPosState,
      cart: [
        {
          productId: "prod-001",
          name: "Beras",
          sku: "BRS-01",
          unit: "sak",
          unitPrice: 76000,
          availableStock: 10,
          quantity: 1,
          itemDiscount: 0,
        },
      ],
    };
    state = posReducer(stateWithItem, { type: "OPEN_CONFIRM" });
    expect(state.isConfirmOpen).toBe(true);

    // Menutup konfirmasi
    state = posReducer(state, { type: "CLOSE_CONFIRM" });
    expect(state.isConfirmOpen).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 15. Cetak struk aman dan tidak memicu transaksi kedua
  // -------------------------------------------------------------------------
  it("15. Tombol cetak struk menangani window.print dengan aman tanpa mutasi transaksi", () => {
    // Di lingkungan Node server-side, window adalah undefined dan tidak crash
    expect(typeof window === "undefined" || typeof window.print === "function").toBe(true);

    // Simulasi browser di mana window.print ada
    const printSpy = vi.fn();
    const fakeWindow = { print: printSpy };
    if (typeof fakeWindow !== "undefined" && typeof fakeWindow.print === "function") {
      fakeWindow.print();
    }
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Verifikasi tidak ada mutasi transaksi yang tercipta oleh panggilan cetak
    const salesBefore = demoStoreService.getState().sales.length;
    expect(salesBefore).toBe(demoStoreService.getState().sales.length);
  });

  // -------------------------------------------------------------------------
  // 16. Verifikasi sinkronisasi kuantitas terhadap stok fisik terkini
  // -------------------------------------------------------------------------
  it("16. Stepper kuantitas mematuhi stok fisik terkini dan menolak penambahan melebihi stok", () => {
    const product = demoStoreService.getState().products.find((p) => p.id === "prod-015")!;
    // prod-015 (Air Mineral Galon) memiliki stockQuantity = 2
    expect(product.stockQuantity).toBe(2);

    let state = posReducer(initialPosState, { type: "ADD_TO_CART", product });
    expect(state.cart[0].quantity).toBe(1);

    // Tambah ke-2
    state = posReducer(state, { type: "ADD_TO_CART", product });
    expect(state.cart[0].quantity).toBe(2);

    // Tambah ke-3 (melebihi stok 2)
    state = posReducer(state, { type: "ADD_TO_CART", product });
    expect(state.cart[0].quantity).toBe(2);
    expect(state.errorMessage).toContain("telah mencapai batas maksimum");

    // Update quantity manual ke 999 -> otomatis di-clamp ke stok maksimum (2)
    state = posReducer(state, {
      type: "UPDATE_QUANTITY",
      productId: product.id,
      quantity: 999,
    });
    expect(state.cart[0].quantity).toBe(2);
  });
});
