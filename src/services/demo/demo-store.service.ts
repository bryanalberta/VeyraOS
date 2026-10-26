/**
 * VeyraOS — Sandboxed Demo Store Service (Client-Side Storage Adapter)
 * Menyediakan adapter terisolasi penuh untuk mengelola state Mode Demo lokal
 * dengan LocalStorage dan In-Memory Fallback transparan jika LocalStorage tidak tersedia/error.
 * Sesuai PRD v1.1 dan docs/stage-5.7-step-4a-demo-preflight-audit.md.
 */

import {
  DEMO_STORAGE_KEY,
  DEMO_STORE_VERSION,
  type DemoStoreState,
  type DemoDashboardSummary,
  type DailySalesTrendItem,
  type DemoProduct,
  type DemoSale,
  type DemoSaleItem,
  type DemoPurchase,
  type DemoExpense,
  type DemoBusinessProfile,
  type RecordDemoSaleInput,
  type VoidDemoSaleInput,
  type CreateDemoProductInput,
  type UpdateDemoProductInput,
  type RecordDemoPurchaseInput,
  type RecordDemoExpenseInput,
  type UpdateDemoBusinessProfileInput,
  type DemoTransactionResult,
} from "./demo-types";
import { getFreshDemoSeed } from "./demo-seed-data";
import { generateDemoInvoiceNumber } from "./demo-invoice";

class DemoStoreService {
  private snapshot: DemoStoreState;
  private readonly serverSnapshot: DemoStoreState;
  private listeners: Set<() => void> = new Set();
  private initialized: boolean = false;

  constructor() {
    const initialSeed = getFreshDemoSeed();
    this.snapshot = initialSeed;
    this.serverSnapshot = initialSeed;
  }

  /**
   * Memeriksa ketersediaan dan kemampuan baca-tulis window.localStorage secara aman.
   */
  public isStorageAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const testKey = "__veyra_storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mendaftarkan listener untuk memantau perubahan state atau event reset.
   * Mengembalikan fungsi unregister.
   */
  public subscribe = (listener: () => void): () => void => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("[VeyraOS Demo Store] Error in listener:", err);
      }
    });
  }

  /**
   * Memvalidasi apakah objek data tersimpan memiliki struktur state demo yang sah.
   */
  private isValidState(obj: unknown): obj is DemoStoreState {
    if (!obj || typeof obj !== "object") return false;
    const s = obj as Record<string, unknown>;
    return (
      s.version === DEMO_STORE_VERSION &&
      typeof s.business === "object" &&
      s.business !== null &&
      Array.isArray(s.products) &&
      Array.isArray(s.sales) &&
      Array.isArray(s.purchases) &&
      Array.isArray(s.expenses)
    );
  }

  /**
   * Inisialisasi awal membaca dari localStorage jika ada data tersimpan yang sah.
   * Dipanggil secara idempoten saat pembacaan pertama di peramban tanpa memicu notifikasi berulang.
   */
  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (typeof window === "undefined" || !this.isStorageAvailable()) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) {
        // Belum ada data di localStorage, inisialisasi dengan seed baru
        const fresh = getFreshDemoSeed();
        this.saveRawToStorage(fresh);
        this.snapshot = fresh;
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      if (this.isValidState(parsed)) {
        this.snapshot = parsed;
        return;
      }

      // Versi tidak cocok atau data rusak: pulihkan ke seed awal
      console.warn(
        "[VeyraOS Demo Store] Data tersimpan tidak valid atau versi usang. Memulihkan ke seed awal."
      );
      const fresh = getFreshDemoSeed();
      this.saveRawToStorage(fresh);
      this.snapshot = fresh;
    } catch (err) {
      console.warn(
        "[VeyraOS Demo Store] Gagal membaca localStorage, beralih ke in-memory fallback:",
        err
      );
      this.snapshot = getFreshDemoSeed();
    }
  }

  /**
   * Membaca snapshot state demo saat ini.
   * Mengembalikan referensi snapshot yang stabil (cached snapshot) selama state belum berubah.
   * Memenuhi kontrak React useSyncExternalStore untuk mencegah infinite loop dan tearing.
   */
  public getState = (): DemoStoreState => {
    this.ensureInitialized();
    return this.snapshot;
  };

  /**
   * Mengembalikan snapshot statis yang aman untuk render sisi server (SSR) dan prerendering.
   * Mengembalikan snapshot memori aktif tanpa menyentuh window maupun localStorage.
   */
  public getServerSnapshot = (): DemoStoreState => {
    return this.snapshot;
  };

  /**
   * Helper internal untuk menyimpan data ke localStorage dengan try/catch aman.
   */
  private saveRawToStorage(state: DemoStoreState): boolean {
    if (typeof window === "undefined" || !this.isStorageAvailable()) {
      return false;
    }

    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.warn("[VeyraOS Demo Store] Gagal menulis ke localStorage (mungkin kuota penuh):", err);
      return false;
    }
  }

  /**
   * Memperbarui state demo secara aman.
   * Menerima objek state baru atau updater callback function.
   * Membuat snapshot baru yang stabil dan memberi tahu subscriber secara idempoten.
   */
  public saveState = (
    updater: DemoStoreState | ((prev: DemoStoreState) => DemoStoreState)
  ): DemoStoreState => {
    this.ensureInitialized();
    const currentState = this.snapshot;
    const nextState =
      typeof updater === "function" ? updater(currentState) : updater;

    // Pastikan versi tetap sesuai
    const sanitizedState: DemoStoreState = {
      ...nextState,
      version: DEMO_STORE_VERSION,
    };

    // Buat snapshot baru yang terisolasi dan stabil
    this.snapshot = JSON.parse(JSON.stringify(sanitizedState));
    this.initialized = true;

    // Simpan ke storage jika tersedia
    this.saveRawToStorage(this.snapshot);

    // Notifikasi seluruh subscriber UI bahwa ada snapshot baru
    this.notifyListeners();

    return this.snapshot;
  };

  /**
   * Mereset seluruh data demo kembali ke seed awal ("Toko Sembako Sejahtera").
   * Seluruh perubahan mutasi lokal terhapus seketika, snapshot baru diterbitkan, dan UI diperbarui.
   */
  public resetState = (): DemoStoreState => {
    const fresh = getFreshDemoSeed();
    fresh.lastResetAt = new Date().toISOString();

    this.snapshot = fresh;
    this.initialized = true;

    if (this.isStorageAvailable()) {
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
      } catch (err) {
        console.warn("[VeyraOS Demo Store] Gagal mereset localStorage:", err);
      }
    }

    this.notifyListeners();
    return this.snapshot;
  };

  /**
   * Memperbarui profil bisnis simulasi lokal secara atomik.
   */
  public updateBusinessProfile = (
    input: UpdateDemoBusinessProfileInput
  ): DemoTransactionResult<DemoBusinessProfile> => {
    if (!input || (input.name !== undefined && !input.name.trim())) {
      return {
        success: false,
        error: { code: "STORAGE_ERROR", message: "Nama bisnis tidak boleh kosong." },
      };
    }

    let updatedProfile: DemoBusinessProfile | null = null;

    this.saveState((prev) => {
      updatedProfile = {
        ...prev.business,
        name: input.name !== undefined ? input.name.trim() : prev.business.name,
        category: input.category !== undefined ? input.category.trim() : prev.business.category,
        phone: input.phone !== undefined ? input.phone.trim() : prev.business.phone,
        address: input.address !== undefined ? input.address.trim() : prev.business.address,
        receiptFooter:
          input.receiptFooter !== undefined ? input.receiptFooter.trim() : prev.business.receiptFooter,
        receiptPaperSize: input.receiptPaperSize || prev.business.receiptPaperSize || "58mm",
      };

      return {
        ...prev,
        business: updatedProfile,
      };
    });

    return {
      success: true,
      data: updatedProfile!,
    };
  };

  /**
   * Mengosongkan data transaksi (penjualan, pembelian, beban) tanpa menghapus katalog produk.
   */
  public clearTransactionsOnly = (): DemoStoreState => {
    return this.saveState((prev) => ({
      ...prev,
      sales: [],
      purchases: [],
      expenses: [],
    }));
  };

  // -------------------------------------------------------------------------
  // Helper Getters untuk kemudahan akses entitas
  // -------------------------------------------------------------------------
  public getBusinessProfile(): DemoBusinessProfile {
    return this.getState().business;
  }

  public getProducts(): DemoProduct[] {
    return this.getState().products;
  }

  public getSales(): DemoSale[] {
    return this.getState().sales;
  }

  public getSaleById = (id: string): DemoSale | undefined => {
    return this.getState().sales.find((s) => s.id === id);
  };

  public getProductById = (id: string): DemoProduct | undefined => {
    return this.getState().products.find((p) => p.id === id);
  };

  public getPurchases = (): DemoPurchase[] => {
    return this.getState().purchases;
  };

  public getExpenses = (): DemoExpense[] => {
    return this.getState().expenses;
  };

  /**
   * Menambah produk baru ke katalog demo lokal.
   */
  public createProduct = (
    input: CreateDemoProductInput
  ): DemoTransactionResult<DemoProduct> => {
    if (!input || !input.name?.trim()) {
      return {
        success: false,
        error: { code: "PRODUCT_NOT_FOUND", message: "Nama produk wajib diisi." },
      };
    }
    const cleanSku = (input.sku || "").trim();
    if (!cleanSku) {
      return {
        success: false,
        error: { code: "DUPLICATE_SKU", message: "SKU produk wajib diisi." },
      };
    }
    const existingSku = this.getState().products.some(
      (p) => !p.isArchived && p.sku.toLowerCase() === cleanSku.toLowerCase()
    );
    if (existingSku) {
      return {
        success: false,
        error: { code: "DUPLICATE_SKU", message: `SKU '${cleanSku}' sudah digunakan.` },
      };
    }
    if (typeof input.price !== "number" || input.price <= 0) {
      return {
        success: false,
        error: { code: "INVALID_PRICE", message: "Harga jual harus lebih besar dari 0." },
      };
    }
    if (typeof input.cogs !== "number" || input.cogs < 0) {
      return {
        success: false,
        error: { code: "INVALID_COST", message: "HPP tidak boleh bernilai negatif." },
      };
    }

    const newProd: DemoProduct = {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name.trim(),
      sku: cleanSku,
      category: input.category?.trim() || "Umum",
      price: Math.round(input.price),
      cogs: Math.round(input.cogs),
      stockQuantity: Math.max(0, Math.round(input.stockQuantity || 0)),
      minStockAlert: Math.max(0, Math.round(input.minStockAlert || 5)),
      unit: input.unit?.trim() || "pcs",
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveState((prev) => ({
      ...prev,
      products: [newProd, ...prev.products],
    }));

    return { success: true, data: newProd };
  };

  /**
   * Memperbarui data produk demo.
   */
  public updateProduct = (
    input: UpdateDemoProductInput
  ): DemoTransactionResult<DemoProduct> => {
    const state = this.getState();
    const existing = state.products.find((p) => p.id === input.id);
    if (!existing) {
      return {
        success: false,
        error: { code: "PRODUCT_NOT_FOUND", message: "Produk tidak ditemukan." },
      };
    }

    if (input.sku !== undefined) {
      const cleanSku = input.sku.trim();
      if (!cleanSku) {
        return {
          success: false,
          error: { code: "DUPLICATE_SKU", message: "SKU tidak boleh kosong." },
        };
      }
      const duplicate = state.products.some(
        (p) => p.id !== input.id && !p.isArchived && p.sku.toLowerCase() === cleanSku.toLowerCase()
      );
      if (duplicate) {
        return {
          success: false,
          error: { code: "DUPLICATE_SKU", message: `SKU '${cleanSku}' sudah digunakan oleh produk lain.` },
        };
      }
    }

    if (input.price !== undefined && (typeof input.price !== "number" || input.price <= 0)) {
      return {
        success: false,
        error: { code: "INVALID_PRICE", message: "Harga jual harus lebih besar dari 0." },
      };
    }

    if (input.cogs !== undefined && (typeof input.cogs !== "number" || input.cogs < 0)) {
      return {
        success: false,
        error: { code: "INVALID_COST", message: "HPP tidak boleh bernilai negatif." },
      };
    }

    let updatedProd: DemoProduct = { ...existing };

    this.saveState((prev) => {
      const products = prev.products.map((p) => {
        if (p.id !== input.id) return p;
        updatedProd = {
          ...p,
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.sku !== undefined ? { sku: input.sku.trim() } : {}),
          ...(input.category !== undefined ? { category: input.category.trim() } : {}),
          ...(input.price !== undefined ? { price: Math.round(input.price) } : {}),
          ...(input.cogs !== undefined ? { cogs: Math.round(input.cogs) } : {}),
          ...(input.stockQuantity !== undefined ? { stockQuantity: Math.max(0, Math.round(input.stockQuantity)) } : {}),
          ...(input.minStockAlert !== undefined ? { minStockAlert: Math.max(0, Math.round(input.minStockAlert)) } : {}),
          ...(input.unit !== undefined ? { unit: input.unit.trim() } : {}),
          updatedAt: new Date().toISOString(),
        };
        return updatedProd;
      });
      return { ...prev, products };
    });

    return { success: true, data: updatedProd };
  };

  /**
   * Mengarsipkan produk demo (soft delete).
   */
  public archiveProduct = (productId: string): DemoTransactionResult<DemoProduct> => {
    const state = this.getState();
    const existing = state.products.find((p) => p.id === productId);
    if (!existing) {
      return {
        success: false,
        error: { code: "PRODUCT_NOT_FOUND", message: "Produk tidak ditemukan." },
      };
    }

    let archivedProd: DemoProduct = { ...existing, isArchived: true, updatedAt: new Date().toISOString() };
    this.saveState((prev) => ({
      ...prev,
      products: prev.products.map((p) => {
        if (p.id === productId) {
          archivedProd = { ...p, isArchived: true, updatedAt: new Date().toISOString() };
          return archivedProd;
        }
        return p;
      }),
    }));

    return { success: true, data: archivedProd };
  };

  /**
   * Mencatat pembelian restock persediaan dan rekalkulasi Moving Weighted Average Cost HPP.
   */
  public recordPurchase = (
    input: RecordDemoPurchaseInput
  ): DemoTransactionResult<DemoPurchase> => {
    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      return {
        success: false,
        error: { code: "PRODUCT_NOT_FOUND", message: "Minimal harus ada 1 produk restock." },
      };
    }

    const state = this.getState();
    const productMap = new Map(state.products.map((p) => [p.id, p]));

    for (const item of input.items) {
      if (!productMap.has(item.productId)) {
        return {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: `Produk ID '${item.productId}' tidak ditemukan.` },
        };
      }
      if (item.quantity <= 0) {
        return {
          success: false,
          error: { code: "INVALID_QUANTITY", message: "Kuantitas restock harus lebih dari 0." },
        };
      }
      if (item.purchaseCost < 0) {
        return {
          success: false,
          error: { code: "INVALID_COST", message: "Harga beli tidak boleh negatif." },
        };
      }
    }

    const purchaseItems = input.items.map((item, idx) => {
      const prod = productMap.get(item.productId)!;
      return {
        id: `pitem-${Date.now()}-${idx}`,
        productId: prod.id,
        productName: prod.name,
        quantity: Math.round(item.quantity),
        purchaseCost: Math.round(item.purchaseCost),
        subtotal: Math.round(item.quantity) * Math.round(item.purchaseCost),
      };
    });

    const totalAmount = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);

    const purchaseNumber = `PO/${new Date().getFullYear()}/${String(
      state.purchases.length + 1
    ).padStart(4, "0")}`;

    const newPurchase: DemoPurchase = {
      id: `pch-${Date.now()}`,
      purchaseNumber,
      purchaseDate: input.purchaseDate || new Date().toISOString(),
      supplierName: input.supplierName?.trim() || "Pemasok Utama",
      items: purchaseItems,
      totalAmount,
      paymentMethod: input.paymentMethod || "CASH",
      notes: input.notes,
    };

    // Mutasi atomik: update stok dan HPP moving average setiap produk yang dibeli
    this.saveState((prev) => {
      const updatedProducts = prev.products.map((prod) => {
        const itemPurchased = input.items.find((it) => it.productId === prod.id);
        if (!itemPurchased) return prod;

        const currentStock = prod.stockQuantity;
        const currentCogs = prod.cogs;
        const addedQty = Math.round(itemPurchased.quantity);
        const addedCost = Math.round(itemPurchased.purchaseCost);

        const newStock = currentStock + addedQty;
        const newCogs =
          newStock > 0
            ? Math.round((currentStock * currentCogs + addedQty * addedCost) / newStock)
            : addedCost;

        return {
          ...prod,
          stockQuantity: newStock,
          cogs: newCogs,
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        ...prev,
        products: updatedProducts,
        purchases: [newPurchase, ...prev.purchases],
      };
    });

    return { success: true, data: newPurchase };
  };

  /**
   * Mencatat pengeluaran operasional baru.
   */
  public recordExpense = (
    input: RecordDemoExpenseInput
  ): DemoTransactionResult<DemoExpense> => {
    if (!input || !input.category?.trim()) {
      return {
        success: false,
        error: { code: "STORAGE_ERROR", message: "Kategori pengeluaran wajib diisi." },
      };
    }
    if (typeof input.amount !== "number" || input.amount <= 0) {
      return {
        success: false,
        error: { code: "STORAGE_ERROR", message: "Nominal pengeluaran harus lebih besar dari 0." },
      };
    }

    const newExpense: DemoExpense = {
      id: `exp-${Date.now()}`,
      expenseDate: input.expenseDate || new Date().toISOString(),
      category: input.category.trim(),
      amount: Math.round(input.amount),
      description: input.description?.trim() || "",
      paymentMethod: input.paymentMethod || "CASH",
    };

    this.saveState((prev) => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses],
    }));

    return { success: true, data: newExpense };
  };

  /**
   * Menghapus catatan pengeluaran operasional.
   */
  public deleteExpense = (expenseId: string): DemoTransactionResult<boolean> => {
    const state = this.getState();
    const existing = state.expenses.find((e) => e.id === expenseId);
    if (!existing) {
      return {
        success: false,
        error: { code: "EXPENSE_NOT_FOUND", message: "Catatan pengeluaran tidak ditemukan." },
      };
    }

    this.saveState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }));

    return { success: true, data: true };
  };

  /**
   * Mencatat transaksi penjualan baru (Point of Sale / POS) secara atomik.
   *
   * Tahapan:
   * 1. Validasi keranjang tidak kosong dan kuantitas positif.
   * 2. Agregasi kuantitas untuk validasi stok jika ada duplikasi produk.
   * 3. Validasi stok fisik, status aktif, dan harga/HPP produk.
   * 4. Validasi diskon item dan diskon transaksi.
   * 5. Validasi metode pembayaran (Tunai / Transfer Bank) dan uang tunai diterima.
   * 6. Alokasi diskon transaksi ke baris item secara deterministik.
   * 7. Perhitungan HPP, penjualan bersih, laba kotor, dan kembalian tunai.
   * 8. Pembuatan nomor faktur unik bebas benturan.
   * 9. Eksekusi mutasi atomik: kurangi stok & simpan transaksi baru via saveState().
   */
  public recordSale = (
    input: RecordDemoSaleInput
  ): DemoTransactionResult<DemoSale> => {
    if (!input || typeof input !== "object") {
      return {
        success: false,
        error: {
          code: "INVALID_PAYMENT",
          message: "Payload transaksi tidak valid.",
        },
      };
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      return {
        success: false,
        error: {
          code: "EMPTY_CART",
          message: "Keranjang belanja tidak boleh kosong. Minimal tambahkan 1 produk.",
        },
      };
    }

    // 1. Validasi format dasar setiap baris item
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      if (!item || typeof item !== "object") {
        return {
          success: false,
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: `Item ke-${i + 1} tidak valid.`,
          },
        };
      }

      if (!item.productId || typeof item.productId !== "string" || !item.productId.trim()) {
        return {
          success: false,
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: `Item ke-${i + 1} tidak memiliki ID produk yang valid.`,
          },
        };
      }

      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return {
          success: false,
          error: {
            code: "INVALID_QUANTITY",
            message: `Kuantitas untuk produk ID "${item.productId}" harus berupa bilangan bulat positif (>= 1).`,
            details: { productId: item.productId, quantity: item.quantity },
          },
        };
      }

      if (item.itemDiscount !== undefined) {
        if (
          typeof item.itemDiscount !== "number" ||
          !Number.isInteger(item.itemDiscount) ||
          item.itemDiscount < 0
        ) {
          return {
            success: false,
            error: {
              code: "INVALID_DISCOUNT",
              message: `Diskon item untuk produk ID "${item.productId}" harus berupa bilangan bulat tidak negatif (>= 0).`,
              details: { productId: item.productId, itemDiscount: item.itemDiscount },
            },
          };
        }
      }
    }

    // 2. Baca state aktif saat ini
    const state = this.getState();

    // 3. Agregasi kuantitas untuk mendeteksi duplikasi produk dalam keranjang
    const aggregatedQuantities = new Map<string, number>();
    for (const item of input.items) {
      const current = aggregatedQuantities.get(item.productId) || 0;
      aggregatedQuantities.set(item.productId, current + item.quantity);
    }

    // 4. Validasi keberadaan, status aktif, dan ketersediaan stok fisik produk
    for (const [productId, requestedTotalQty] of aggregatedQuantities.entries()) {
      const product = state.products.find((p) => p.id === productId);
      if (!product) {
        return {
          success: false,
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: `Produk dengan ID "${productId}" tidak ditemukan dalam katalog barang.`,
            details: { productId },
          },
        };
      }

      if (product.isArchived) {
        return {
          success: false,
          error: {
            code: "PRODUCT_INACTIVE",
            message: `Produk "${product.name}" sedang dinonaktifkan/diarsipkan dan tidak dapat dijual.`,
            details: { productId, name: product.name },
          },
        };
      }

      if (
        !Number.isInteger(product.price) ||
        product.price < 0 ||
        !Number.isInteger(product.cogs) ||
        product.cogs < 0
      ) {
        return {
          success: false,
          error: {
            code: "STORAGE_ERROR",
            message: `Data harga jual atau HPP produk "${product.name}" tidak valid.`,
            details: { productId, price: product.price, cogs: product.cogs },
          },
        };
      }

      if (product.stockQuantity < requestedTotalQty) {
        return {
          success: false,
          error: {
            code: "INSUFFICIENT_STOCK",
            message: `Stok produk "${product.name}" tidak mencukupi (tersedia: ${product.stockQuantity}, total diminta: ${requestedTotalQty}).`,
            details: {
              productId,
              name: product.name,
              available: product.stockQuantity,
              requested: requestedTotalQty,
            },
          },
        };
      }
    }

    // 5. Validasi diskon baris barang & hitung subtotal
    const preparedItems: DemoSaleItem[] = [];
    const itemSubtotals: number[] = [];
    let grossSubtotal = 0;
    const now = input.transactionDate || new Date().toISOString();
    const txTimestamp = Date.now();

    for (let i = 0; i < input.items.length; i++) {
      const itemInput = input.items[i];
      const product = state.products.find((p) => p.id === itemInput.productId)!;

      const unitPrice = product.price;
      const costPrice = product.cogs;
      const grossLine = itemInput.quantity * unitPrice;
      const itemDiscount = itemInput.itemDiscount || 0;

      if (itemDiscount > grossLine) {
        return {
          success: false,
          error: {
            code: "INVALID_DISCOUNT",
            message: `Diskon item untuk "${product.name}" (Rp ${itemDiscount}) melebihi nilai kotor baris barang (Rp ${grossLine}).`,
            details: { productId: product.id, grossLine, itemDiscount },
          },
        };
      }

      const lineSubtotal = grossLine - itemDiscount;
      grossSubtotal += lineSubtotal;
      itemSubtotals.push(lineSubtotal);

      const itemId = `si-${txTimestamp}-${i + 1}-${Math.random().toString(36).substring(2, 6)}`;
      preparedItems.push({
        id: itemId,
        productId: product.id,
        productName: product.name,
        quantity: itemInput.quantity,
        unitPrice,
        costPrice,
        itemDiscount,
        subtotal: lineSubtotal,
      });
    }

    // 6. Validasi diskon transaksi
    const txDiscount = input.transactionDiscount || 0;
    if (
      typeof txDiscount !== "number" ||
      !Number.isInteger(txDiscount) ||
      txDiscount < 0
    ) {
      return {
        success: false,
        error: {
          code: "INVALID_DISCOUNT",
          message: "Diskon transaksi harus berupa bilangan bulat tidak negatif.",
        },
      };
    }

    if (txDiscount > grossSubtotal) {
      return {
        success: false,
        error: {
          code: "INVALID_DISCOUNT",
          message: `Diskon transaksi (Rp ${txDiscount}) tidak boleh melebihi subtotal belanja (Rp ${grossSubtotal}).`,
          details: { grossSubtotal, transactionDiscount: txDiscount },
        },
      };
    }

    const totalAmount = grossSubtotal - txDiscount;
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return {
        success: false,
        error: {
          code: "INVALID_DISCOUNT",
          message: "Perhitungan total pembayaran menghasilkan nilai yang tidak valid.",
        },
      };
    }

    // 7. Validasi metode pembayaran
    if (
      input.paymentMethod !== "CASH" &&
      input.paymentMethod !== "BANK_TRANSFER"
    ) {
      return {
        success: false,
        error: {
          code: "INVALID_PAYMENT",
          message: "Metode pembayaran tidak valid. Hanya Tunai (CASH) dan Transfer Bank (BANK_TRANSFER) yang didukung.",
        },
      };
    }

    let cashReceived: number | undefined = undefined;
    let cashChange: number | undefined = undefined;

    if (input.paymentMethod === "CASH") {
      if (
        input.cashReceived === undefined ||
        typeof input.cashReceived !== "number" ||
        !Number.isInteger(input.cashReceived) ||
        input.cashReceived < 0
      ) {
        return {
          success: false,
          error: {
            code: "INVALID_PAYMENT",
            message: "Nominal uang tunai yang diterima wajib diisi dan berupa bilangan bulat tidak negatif.",
          },
        };
      }

      if (input.cashReceived < totalAmount) {
        return {
          success: false,
          error: {
            code: "INSUFFICIENT_CASH",
            message: `Uang tunai yang diterima (Rp ${input.cashReceived}) kurang dari total tagihan (Rp ${totalAmount}).`,
            details: {
              required: totalAmount,
              received: input.cashReceived,
              shortfall: totalAmount - input.cashReceived,
            },
          },
        };
      }

      cashReceived = input.cashReceived;
      cashChange = cashReceived - totalAmount;
    } else {
      // BANK_TRANSFER: transaksi langsung lunas
      cashReceived = undefined;
      cashChange = 0;
    }

    // 8. Alokasikan diskon transaksi ke setiap baris item secara proporsional
    const allocatedDiscounts = allocateTransactionDiscount(itemSubtotals, txDiscount);
    let totalCogs = 0;
    for (let i = 0; i < preparedItems.length; i++) {
      const item = preparedItems[i];
      item.allocatedTransactionDiscount = allocatedDiscounts[i];
      item.netAmount = item.subtotal - allocatedDiscounts[i];
      totalCogs += item.quantity * item.costPrice;
    }

    const grossProfit = totalAmount - totalCogs;

    // 9. Bangkitkan nomor faktur unik (menggunakan generator invoice khusus Demo)
    let invoiceNumber: string;
    if (input.invoiceNumber) {
      invoiceNumber = input.invoiceNumber;
    } else {
      try {
        invoiceNumber = generateDemoInvoiceNumber({
          date: input.transactionDate ? new Date(input.transactionDate) : new Date(),
          existingSales: state.sales,
        });
      } catch (err) {
        return {
          success: false,
          error: {
            code: "INVOICE_GENERATION_FAILED",
            message: (err as Error).message || "Gagal menghasilkan nomor faktur unik.",
          },
        };
      }
    }

    // 10. Susun objek transaksi penjualan baru
    const saleId = `sale-${txTimestamp}-${Math.random().toString(36).substring(2, 7)}`;
    const newSale: DemoSale = {
      id: saleId,
      invoiceNumber,
      transactionDate: now,
      items: preparedItems,
      subtotal: grossSubtotal,
      discount: txDiscount,
      totalAmount,
      totalCogs,
      grossProfit,
      paymentMethod: input.paymentMethod,
      status: "COMPLETED",
      cashReceived,
      cashChange,
      notes: input.notes?.trim() || undefined,
    };

    // 11. Mutasi State secara ATOMIK melalui saveState()
    this.saveState((prev) => {
      const nextProducts = prev.products.map((p) => {
        const requestedQty = aggregatedQuantities.get(p.id);
        if (requestedQty) {
          return {
            ...p,
            stockQuantity: p.stockQuantity - requestedQty,
            updatedAt: now,
          };
        }
        return p;
      });

      return {
        ...prev,
        products: nextProducts,
        sales: [newSale, ...prev.sales],
      };
    });

    return {
      success: true,
      data: newSale,
    };
  };

  /**
   * Membatalkan transaksi penjualan (Void Sale) dengan alasan yang valid.
   *
   * Tahapan:
   * 1. Validasi keberadaan saleId dan alasan pembatalan (minimal 5 karakter non-spasi).
   * 2. Periksa status transaksi (menolak jika sudah VOIDED).
   * 3. Pulihkan kuantitas stok produk tepat satu kali.
   * 4. Pertahankan harga pokok rata-rata berjalan (cogs/MWAC) produk aktif.
   * 5. Perbarui status transaksi menjadi VOIDED beserta catatan alasan dan waktu void.
   * 6. Eksekusi mutasi atomik via saveState().
   */
  public voidSale = (
    input: VoidDemoSaleInput
  ): DemoTransactionResult<DemoSale> => {
    if (!input || typeof input !== "object") {
      return {
        success: false,
        error: {
          code: "INVALID_VOID_REASON",
          message: "Payload pembatalan transaksi tidak valid.",
        },
      };
    }

    if (!input.saleId || typeof input.saleId !== "string" || !input.saleId.trim()) {
      return {
        success: false,
        error: {
          code: "SALE_NOT_FOUND",
          message: "ID transaksi penjualan wajib diisi.",
        },
      };
    }

    const trimmedReason = input.voidReason ? input.voidReason.trim() : "";
    if (trimmedReason.length < 5) {
      return {
        success: false,
        error: {
          code: "INVALID_VOID_REASON",
          message: "Alasan pembatalan transaksi wajib diisi minimal 5 karakter non-spasi.",
        },
      };
    }

    const state = this.getState();
    const targetSale = state.sales.find((s) => s.id === input.saleId);

    if (!targetSale) {
      return {
        success: false,
        error: {
          code: "SALE_NOT_FOUND",
          message: `Transaksi penjualan dengan ID "${input.saleId}" tidak ditemukan.`,
        },
      };
    }

    if (targetSale.status === "VOIDED") {
      return {
        success: false,
        error: {
          code: "ALREADY_VOIDED",
          message: `Transaksi dengan nomor faktur "${targetSale.invoiceNumber}" sudah dibatalkan sebelumnya.`,
        },
      };
    }

    // Agregasi kuantitas yang harus dipulihkan per produk
    const restoreMap = new Map<string, number>();
    for (const item of targetSale.items) {
      restoreMap.set(
        item.productId,
        (restoreMap.get(item.productId) || 0) + item.quantity
      );
    }

    const voidedAt = input.voidedAt || new Date().toISOString();
    let updatedSale: DemoSale | undefined = undefined;

    // Eksekusi mutasi atomik via saveState()
    this.saveState((prev) => {
      const nextProducts = prev.products.map((p) => {
        const restoreQty = restoreMap.get(p.id);
        if (restoreQty) {
          return {
            ...p,
            stockQuantity: p.stockQuantity + restoreQty,
            updatedAt: voidedAt,
            // Catatan PRD v1.1: MWAC/cogs berjalan produk tetap dipertahankan
          };
        }
        return p;
      });

      const nextSales = prev.sales.map((s) => {
        if (s.id === input.saleId) {
          updatedSale = {
            ...s,
            status: "VOIDED" as const,
            voidReason: trimmedReason,
            voidedAt,
          };
          return updatedSale;
        }
        return s;
      });

      return {
        ...prev,
        products: nextProducts,
        sales: nextSales,
      };
    });

    return {
      success: true,
      data: updatedSale!,
    };
  };

  /**
   * Menghitung ringkasan performa finansial dan operasional dashboard simulasi
   * secara deterministik dari dataset aktif.
   *
   * Formula Keuangan Baku (PRD v1.1):
   * 1. Penjualan Bersih (Net Sales) = Omzet Kotor - Diskon
   * 2. HPP (COGS) = Total HPP Transaksi Penjualan Lunas (COMPLETED)
   * 3. Laba Kotor = Penjualan Bersih - HPP
   * 4. Beban Operasional = Total Beban Kas Toko
   * 5. Laba Bersih Operasional = Laba Kotor - Beban Operasional
   * 6. Arus Kas Bersih = Kas Masuk - (Kas Keluar Pembelian + Kas Keluar Beban)
   *
   * *Pemisahan Disiplin:* Pembelian restock persediaan barang dagang hanya
   * dihitung sebagai arus kas keluar dan aset persediaan, BUKAN beban operasional.
   */
  public getDashboardSummary(
    startDate?: string,
    endDate?: string
  ): DemoDashboardSummary {
    const state = this.getState();

    // Normalisasi rentang tanggal (YYYY-MM-DD)
    const startFilter = startDate ? startDate.slice(0, 10) : undefined;
    const endFilter = endDate ? endDate.slice(0, 10) : undefined;

    // Filter transaksi penjualan dalam rentang tanggal
    const filteredSales = state.sales.filter((sale) => {
      const saleDate = sale.transactionDate.slice(0, 10);
      if (startFilter && saleDate < startFilter) return false;
      if (endFilter && saleDate > endFilter) return false;
      return true;
    });

    // Transaksi lunas saja yang masuk perhitungan omzet & HPP
    const completedSales = filteredSales.filter(
      (sale) => sale.status === "COMPLETED"
    );

    let grossSales = 0;
    let totalDiscounts = 0;
    let netSales = 0;
    let cogs = 0;

    for (const sale of completedSales) {
      grossSales += sale.subtotal;
      totalDiscounts += sale.discount;
      netSales += sale.totalAmount;
      cogs += sale.totalCogs;
    }

    const grossProfit = netSales - cogs;
    const grossProfitMargin =
      netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0;

    // Filter pengeluaran operasional
    const filteredExpenses = state.expenses.filter((exp) => {
      const expDate = exp.expenseDate.slice(0, 10);
      if (startFilter && expDate < startFilter) return false;
      if (endFilter && expDate > endFilter) return false;
      return true;
    });

    const operatingExpenses = filteredExpenses.reduce(
      (sum, exp) => sum + exp.amount,
      0
    );

    const operatingProfit = grossProfit - operatingExpenses;

    // Filter pembelian persediaan (untuk arus kas keluar)
    const filteredPurchases = state.purchases.filter((pch) => {
      const pchDate = pch.purchaseDate.slice(0, 10);
      if (startFilter && pchDate < startFilter) return false;
      if (endFilter && pchDate > endFilter) return false;
      return true;
    });

    const totalPurchasesAmount = filteredPurchases.reduce(
      (sum, pch) => sum + pch.totalAmount,
      0
    );

    // Arus kas riil
    const cashInflows = netSales;
    const cashOutflows = totalPurchasesAmount + operatingExpenses;
    const netCashFlow = cashInflows - cashOutflows;

    // Tren Penjualan Harian (dikelompokkan per tanggal transaksi)
    const trendMap = new Map<string, { amount: number; count: number }>();

    for (const sale of completedSales) {
      const dateKey = sale.transactionDate.slice(0, 10);
      const existing = trendMap.get(dateKey) || { amount: 0, count: 0 };
      existing.amount += sale.totalAmount;
      existing.count += 1;
      trendMap.set(dateKey, existing);
    }

    const dailySalesTrend: DailySalesTrendItem[] = Array.from(
      trendMap.entries()
    )
      .map(([date, val]) => ({
        date,
        amount: val.amount,
        transactionsCount: val.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 5 Transaksi Terbaru (urut berdasarkan tanggal terbaru)
    const recentTransactions = [...filteredSales]
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 5)
      .map((sale) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        transactionDate: sale.transactionDate,
        paymentMethod: sale.paymentMethod,
        totalAmount: sale.totalAmount,
        status: sale.status,
      }));

    // Peringatan Stok Rendah (stockQuantity <= minStockAlert)
    const lowStockAlerts = state.products
      .filter((prod) => prod.stockQuantity <= prod.minStockAlert)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .map((prod) => ({
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        stockQuantity: prod.stockQuantity,
        minStockAlert: prod.minStockAlert,
        category: prod.category,
      }));

    // Nilai Valuasi Persediaan
    const inventoryValuation = state.products.reduce(
      (sum, prod) => sum + prod.stockQuantity * prod.cogs,
      0
    );

    return {
      grossSales,
      totalDiscounts,
      netSales,
      cogs,
      grossProfit,
      grossProfitMargin,
      operatingExpenses,
      operatingProfit,
      recordedCashFlow: {
        cashInflows,
        cashOutflows,
        netCashFlow,
      },
      dailySalesTrend,
      recentTransactions,
      lowStockAlerts,
      inventoryValuation,
    };
  }
}

/**
 * Mengalokasikan diskon transaksi ke baris item secara proporsional
 * menggunakan metode Largest Remainder (Hamilton-Webster) agar total alokasi
 * tepat sama dengan transactionDiscount dalam bilangan bulat integer IDR.
 *
 * Mencegah pembulatan mengambang (floating-point drift) dan menjamin:
 * 1. Setiap alokasi diskon bernilai integer >= 0.
 * 2. Alokasi untuk setiap item tidak melebihi subtotal item tersebut.
 * 3. Total alokasi sama persis dengan transactionDiscount.
 */
export function allocateTransactionDiscount(
  itemSubtotals: number[],
  transactionDiscount: number
): number[] {
  if (transactionDiscount <= 0 || itemSubtotals.length === 0) {
    return itemSubtotals.map(() => 0);
  }

  const totalGross = itemSubtotals.reduce((sum, s) => sum + s, 0);
  if (totalGross <= 0) {
    return itemSubtotals.map(() => 0);
  }

  // Jika diskon transaksi sama atau melebihi total subtotal, alokasikan sebesar subtotal masing-masing
  if (transactionDiscount >= totalGross) {
    return [...itemSubtotals];
  }

  // 1. Hitung alokasi teoritis dan floor integer
  const unrounded = itemSubtotals.map((s) => (s / totalGross) * transactionDiscount);
  const floors = unrounded.map((u) => Math.floor(u));
  const remainders = unrounded.map((u, i) => ({
    index: i,
    remainder: u - floors[i],
    subtotal: itemSubtotals[i],
  }));

  const allocatedSum = floors.reduce((sum, f) => sum + f, 0);
  let discrepancy = transactionDiscount - allocatedSum;

  // 2. Urutkan berdasarkan remainder terbesar descending; tie-breaker index ascending
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  // 3. Distribusikan selisih sisa 1 rupiah ke item dengan remainder tertinggi
  const finalAllocations = [...floors];
  for (let i = 0; i < remainders.length && discrepancy > 0; i++) {
    const itemIdx = remainders[i].index;
    if (finalAllocations[itemIdx] < itemSubtotals[itemIdx]) {
      finalAllocations[itemIdx] += 1;
      discrepancy -= 1;
    }
  }

  return finalAllocations;
}

// Singleton export untuk konsistensi seluruh aplikasi
export const demoStoreService = new DemoStoreService();
export { DemoStoreService };

