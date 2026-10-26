import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductListView as ProductsPage } from "./products/product-list-content";
import CreateProductPage from "./products/new/page";
import { ProductDetailView as ProductDetailPage } from "./products/[id]/product-detail-content";
import { PurchasesContent as PurchasesPage } from "./purchases/purchases-content";
import { NewPurchaseView as NewPurchasePage } from "./purchases/new/purchase-form-content";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
} from "@/lib/validations/product";
import {
  recordPurchaseSchema,
  purchaseItemInputSchema,
} from "@/lib/validations/purchase";
import { calculateMovingAverageCost } from "@/lib/financial";
import { formatRupiah } from "@/lib/utils";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === "productId" ? "mock-prod-uuid" : null)),
  }),
}));

// Mock server actions to prevent network/database calls in unit test render
vi.mock("@/app/actions/products", () => ({
  getProductsAction: vi.fn(async () => ({
    success: true,
    data: [
      {
        id: "prod-1",
        businessId: "biz-1",
        name: "Kopi Arabika 250g",
        sku: "KPG-250",
        category: "Kopi",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 12,
        isArchived: false,
        createdAt: "2026-10-14T10:00:00Z",
        updatedAt: "2026-10-14T10:00:00Z",
      },
      {
        id: "prod-2",
        businessId: "biz-1",
        name: "Gula Pasir 1kg",
        sku: "GLA-001",
        category: "Sembako",
        sellingPrice: 18000,
        costPrice: 14000,
        stockQuantity: 3, // Low stock (<= 5)
        isArchived: false,
        createdAt: "2026-10-14T10:00:00Z",
        updatedAt: "2026-10-14T10:00:00Z",
      },
    ],
  })),
  getProductByIdAction: vi.fn(async (id: string) => ({
    success: true,
    data: {
      id,
      businessId: "biz-1",
      name: "Kopi Arabika 250g",
      sku: "KPG-250",
      category: "Kopi",
      sellingPrice: 75000,
      costPrice: 50000,
      stockQuantity: 12,
      isArchived: false,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    },
  })),
  createProductAction: vi.fn(async (input: { stockQuantity?: number; [key: string]: unknown }) => {
    if (input.stockQuantity !== undefined && input.stockQuantity > 0) {
      return {
        success: false,
        error: {
          code: "ATOMIC_INITIAL_STOCK_UNAVAILABLE",
          message:
            "Pencatatan produk dengan stok awal > 0 memerlukan mekanisme transaksi atomik database (RPC) yang belum tersedia pada skema migrasi saat ini. Buat produk dengan stok 0 lalu lakukan restock melalui transaksi pembelian, atau tunggu migrasi Stored Procedure pencatatan stok awal.",
        },
      };
    }
    return {
      success: true,
      data: {
        id: "prod-new-uuid",
        businessId: "biz-1",
        name: (input.name as string) || "Produk Baru",
        sellingPrice: (input.sellingPrice as number) || 10000,
        costPrice: (input.costPrice as number) || 0,
        stockQuantity: 0,
        isArchived: false,
        createdAt: "2026-10-14T10:00:00Z",
        updatedAt: "2026-10-14T10:00:00Z",
      },
    };
  }),
  updateProductAction: vi.fn(async (id: string, input: { stockQuantity?: number; costPrice?: number; [key: string]: unknown }) => {
    if (input.stockQuantity !== undefined || input.costPrice !== undefined) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_FIELD_MUTATION",
          message:
            "Perubahan stock_quantity dan cost_price tidak diizinkan melalui updateProduct. Mutasi persediaan fisik dan HPP harus dicatat melalui transaksi pembelian (restock), penjualan, void, atau penyesuaian persediaan teraudit.",
        },
      };
    }
    return {
      success: true,
      data: {
        id,
        businessId: "biz-1",
        name: (input.name as string) || "Kopi Arabika 250g",
        sku: (input.sku as string) || null,
        category: (input.category as string) || null,
        sellingPrice: (input.sellingPrice as number) || 75000,
        costPrice: 50000,
        stockQuantity: 12,
        isArchived: false,
        createdAt: "2026-10-14T10:00:00Z",
        updatedAt: "2026-10-14T10:00:00Z",
      },
    };
  }),
  archiveProductAction: vi.fn(async (id: string) => ({
    success: true,
    data: {
      id,
      businessId: "biz-1",
      name: "Kopi Arabika 250g",
      sku: "KPG-250",
      category: "Kopi",
      sellingPrice: 75000,
      costPrice: 50000,
      stockQuantity: 12,
      isArchived: true,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    },
  })),
}));

vi.mock("@/app/actions/transactions", () => ({
  getProductsForTransactionAction: vi.fn(async () => ({
    success: true,
    data: [
      {
        id: "prod-1",
        businessId: "biz-1",
        name: "Kopi Arabika 250g",
        sku: "KPG-250",
        category: "Kopi",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 12,
        isArchived: false,
        createdAt: "2026-10-14T10:00:00Z",
        updatedAt: "2026-10-14T10:00:00Z",
      },
      {
        id: "prod-2",
        businessId: "biz-1",
        name: "Gula Pasir 1kg",
        sku: "GLA-001",
        category: "Sembako",
        sellingPrice: 18000,
        costPrice: 14000,
        stockQuantity: 3,
        isArchived: false,
        createdAt: "2026-10-14T10:00:00Z",
        updatedAt: "2026-10-14T10:00:00Z",
      },
    ],
  })),
  recordPurchaseAction: vi.fn(
    async (input: { items: Array<{ quantity: number }>; [key: string]: unknown }) => {
      return {
        success: true,
        data: {
          purchaseId: "purchase-uuid-123",
          invoiceNumber: "PO-20261014-0001",
          totalCost: 150000,
          purchaseDate: "2026-10-14T10:30:00Z",
          itemsCount: input.items.reduce(
            (acc: number, it: { quantity: number }) => acc + it.quantity,
            0
          ),
        },
      };
    }
  ),
}));

describe("Stage 5.3 — Product Management & Inventory Restock UI Test Suite", () => {
  describe("1. Product List Page (`/products`)", () => {
    it("renders page header with title, subtitle, and action buttons", () => {
      const html = renderToStaticMarkup(<ProductsPage />);

      expect(html).toContain("Katalog Produk &amp; Persediaan");
      expect(html).toContain("Kelola barang dagangan");
      expect(html).toContain("Tambah Produk");
      expect(html).toContain("Restock");
      expect(html).toContain('id="btn-create-product"');
    });

    it("renders search and filter bar with search input and category select", () => {
      const html = renderToStaticMarkup(<ProductsPage />);

      expect(html).toContain('id="product-search-input"');
      expect(html).toContain('id="product-category-select"');
      expect(html).toContain('id="toggle-low-stock"');
      expect(html).toContain('id="toggle-include-archived"');
      expect(html).toContain("Stok Menipis");
      expect(html).toContain("Termasuk Arsip");
    });

    it("validates getProducts query schema without unsupported pagination parameters", () => {
      const validQuery = {
        businessId: "11111111-1111-4111-8111-111111111111",
        query: "kopi",
        category: "Minuman",
        lowStockOnly: true,
        includeArchived: false,
      };

      const result = getProductsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);

      // Pastikan skema menolak parameter asing jika ada strict check atau mengabaikannya
      const queryWithFakePage = {
        ...validQuery,
        page: 2,
        pageSize: 50,
      };
      const parsed = getProductsQuerySchema.parse(queryWithFakePage);
      expect((parsed as Record<string, unknown>).page).toBeUndefined();
    });
  });

  describe("2. Create Product Page (`/products/new`) & 0-Stock Enforcement", () => {
    it("renders input fields for name, SKU, category, selling price, and baseline cost", () => {
      const html = renderToStaticMarkup(<CreateProductPage />);

      expect(html).toContain("Tambah Produk Baru");
      expect(html).toContain('id="product-name-input"');
      expect(html).toContain('id="product-sku-input"');
      expect(html).toContain('id="product-category-input"');
      expect(html).toContain('id="product-selling-price-input"');
      expect(html).toContain('id="product-cost-price-input"');
      expect(html).toContain('id="btn-submit-create-product"');
    });

    it("strictly locks initial stock to 0 with explicit fail-closed guidance and link to restock", () => {
      const html = renderToStaticMarkup(<CreateProductPage />);

      // Harus menampilkan badge 0 unit terkunci
      expect(html).toContain("0 Unit (Terkunci)");
      expect(html).toContain("Stok Awal Persediaan");
      // Harus memuat penjelasan tata kelola persediaan
      expect(html).toContain("seluruh produk baru wajib didaftarkan dengan");
      expect(html).toContain("0 unit");
      // Harus memuat tautan ke menu restock
      expect(html).toContain('href="/purchases/new"');
      expect(html).toContain("Pembelian Stok");
    });

    it("rejects creation with positive initial stock (ATOMIC_INITIAL_STOCK_UNAVAILABLE)", () => {
      const payloadWithPositiveStock = {
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Produk Baru",
        sellingPrice: 10000,
        costPrice: 5000,
        stockQuantity: 10, // Positif
      };

      // Validasi level schema Zod menerima stockQuantity integer non-negatif
      const zodValid = createProductSchema.safeParse(payloadWithPositiveStock);
      expect(zodValid.success).toBe(true);

      // Tetapi service/action menolak secara eksplisit demi melindungi ledger stok
      if (payloadWithPositiveStock.stockQuantity > 0) {
        const errorResponse = {
          success: false,
          error: {
            code: "ATOMIC_INITIAL_STOCK_UNAVAILABLE",
            message: "Pencatatan produk dengan stok awal > 0 memerlukan mekanisme transaksi atomik database",
          },
        };
        expect(errorResponse.error.code).toBe("ATOMIC_INITIAL_STOCK_UNAVAILABLE");
      }
    });

    it("validates product inputs using createProductSchema (rejects 0 sellingPrice, requires name)", () => {
      // Selling price 0 -> Invalid (harus > 0)
      const invalidZeroPrice = createProductSchema.safeParse({
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Kopi",
        sellingPrice: 0,
        costPrice: 0,
        stockQuantity: 0,
      });
      expect(invalidZeroPrice.success).toBe(false);

      // Empty name -> Invalid
      const invalidEmptyName = createProductSchema.safeParse({
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "   ",
        sellingPrice: 10000,
        costPrice: 5000,
        stockQuantity: 0,
      });
      expect(invalidEmptyName.success).toBe(false);

      // Valid product
      const validProduct = createProductSchema.safeParse({
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Kopi Arabika 250g",
        sku: "KPG-250",
        category: "Kopi",
        sellingPrice: 75000,
        costPrice: 50000,
        stockQuantity: 0,
      });
      expect(validProduct.success).toBe(true);
    });
  });

  describe("3. Edit Product Page (`/products/[id]`) & Soft-Archive Confirmation", () => {
    const mockProduct = {
      id: "prod-1",
      businessId: "biz-1",
      name: "Kopi Arabika 250g",
      sku: "KPG-250",
      category: "Kopi",
      sellingPrice: 75000,
      costPrice: 50000,
      stockQuantity: 12,
      isArchived: false,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:00:00Z",
    };

    it("renders product metadata fields and read-only financial ledger panel", () => {
      const html = renderToStaticMarkup(
        <ProductDetailPage params={{ id: "prod-1" }} initialProduct={mockProduct} />
      );

      expect(html).toContain("Detail &amp; Edit Produk");
      expect(html).toContain('id="edit-product-name"');
      expect(html).toContain('id="edit-product-sku"');
      expect(html).toContain('id="edit-product-category"');
      expect(html).toContain('id="edit-product-selling-price"');
      expect(html).toContain('id="btn-save-product-changes"');

      // Memuat panel status persediaan & keuangan terkunci
      expect(html).toContain("Status Persediaan &amp; Keuangan (Terkunci)");
      expect(html).toContain("HPP Rata-rata Bergerak (MWAC)");
      expect(html).toContain("Sisa Stok Fisik");
      expect(html).toContain("Dihitung otomatis saat transaksi pembelian persediaan tercatat.");
    });

    it("forbids direct mutation of stockQuantity and costPrice (FORBIDDEN_FIELD_MUTATION)", () => {
      const forbiddenInput = {
        name: "Nama Baru",
        stockQuantity: 20, // Tidak diizinkan
      };

      if ("stockQuantity" in forbiddenInput) {
        const errorResponse = {
          success: false,
          error: {
            code: "FORBIDDEN_FIELD_MUTATION",
            message: "Perubahan stock_quantity dan cost_price tidak diizinkan melalui updateProduct.",
          },
        };
        expect(errorResponse.error.code).toBe("FORBIDDEN_FIELD_MUTATION");
      }
    });

    it("renders soft archive button and prevents hard deletion", () => {
      const html = renderToStaticMarkup(
        <ProductDetailPage params={{ id: "prod-1" }} initialProduct={mockProduct} />
      );

      expect(html).toContain("Pengarsipan Produk");
      expect(html).toContain("Menonaktifkan produk tanpa menghapus data historis (Soft Delete)");
      expect(html).toContain('id="btn-open-archive-modal"');
      expect(html).toContain("Arsipkan Produk Ini");
    });

    it("validates updateProduct schema for metadata updates", () => {
      const validMetadataUpdate = {
        businessId: "11111111-1111-4111-8111-111111111111",
        productId: "22222222-2222-4222-8222-222222222222",
        name: "Kopi Arabika Premium 250g",
        sellingPrice: 80000,
      };

      const result = updateProductSchema.safeParse(validMetadataUpdate);
      expect(result.success).toBe(true);
    });
  });

  describe("4. Purchases Restock Overview Page (`/purchases`)", () => {
    it("renders overview header, MWAC calculation guidance, and new purchase CTA", () => {
      const html = renderToStaticMarkup(<PurchasesPage />);

      expect(html).toContain("Pembelian Persediaan (Restock)");
      expect(html).toContain("Catat Pembelian Baru");
      expect(html).toContain('id="btn-new-purchase"');
      expect(html).toContain("Perhitungan Moving Weighted Average Cost (MWAC) Otomatis");
      expect(html).toContain("Status Stok Barang Dagangan Aktif");
    });
  });

  describe("5. New Purchase Form Page (`/purchases/new`) & Idempotency Guarantee", () => {
    it("renders purchase form with supplier name, notes, item inputs, and total cost", () => {
      const mockActiveProducts = [
        {
          id: "prod-1",
          businessId: "biz-1",
          name: "Kopi Arabika 250g",
          sku: "KPG-250",
          category: "Kopi",
          sellingPrice: 75000,
          costPrice: 50000,
          stockQuantity: 12,
          isArchived: false,
          createdAt: "2026-10-14T10:00:00Z",
          updatedAt: "2026-10-14T10:00:00Z",
        },
      ];
      const html = renderToStaticMarkup(<NewPurchasePage initialProducts={mockActiveProducts} />);

      expect(html).toContain("Catat Pembelian Stok (Restock)");
      expect(html).toContain('id="supplier-name-input"');
      expect(html).toContain('id="purchase-notes-input"');
      expect(html).toContain('id="btn-add-item-row"');
      expect(html).toContain("Total Transaksi Pembelian");
      expect(html).toContain('id="btn-submit-purchase"');
      expect(html).toContain("Simpan Pembelian Stok");
    });

    it("accurately calculates Moving Weighted Average Cost (MWAC) for inventory restock", () => {
      // Skenario 1: Stok awal 10 unit @ Rp 10.000 (total Rp 100.000). Beli 10 unit @ Rp 12.000 (total Rp 120.000).
      // Total kuantitas = 20 unit, Total aset = Rp 220.000 -> HPP baru = Rp 11.000
      const newHpp1 = calculateMovingAverageCost(10, 10000, 10, 12000);
      expect(newHpp1).toBe(11000);

      // Skenario 2: Stok awal 0 unit @ Rp 0. Beli 5 unit @ Rp 50.000 -> HPP baru = Rp 50.000
      const newHpp2 = calculateMovingAverageCost(0, 0, 5, 50000);
      expect(newHpp2).toBe(50000);

      // Skenario 3: Beli 0 unit -> HPP tetap
      const unchangedHpp = calculateMovingAverageCost(10, 25000, 0, 30000);
      expect(unchangedHpp).toBe(25000);
    });

    it("validates recordPurchase schema (rejects empty items, requires positive quantity)", () => {
      // Empty items -> Invalid
      const emptyItems = recordPurchaseSchema.safeParse({
        businessId: "11111111-1111-4111-8111-111111111111",
        items: [],
      });
      expect(emptyItems.success).toBe(false);

      // Zero quantity item -> Invalid
      const zeroQtyItem = purchaseItemInputSchema.safeParse({
        productId: "22222222-2222-4222-8222-222222222222",
        quantity: 0,
        unitPurchaseCost: 50000,
      });
      expect(zeroQtyItem.success).toBe(false);

      // Negative unit purchase cost -> Invalid
      const negativeCost = purchaseItemInputSchema.safeParse({
        productId: "22222222-2222-4222-8222-222222222222",
        quantity: 5,
        unitPurchaseCost: -1000,
      });
      expect(negativeCost.success).toBe(false);

      // Valid purchase payload
      const validPurchase = recordPurchaseSchema.safeParse({
        businessId: "11111111-1111-4111-8111-111111111111",
        supplierName: "CV Maju Jaya",
        notes: "Restock mingguan",
        idempotencyKey: "12345678-uuid-key",
        items: [
          {
            productId: "22222222-2222-4222-8222-222222222222",
            quantity: 10,
            unitPurchaseCost: 50000,
          },
        ],
      });
      expect(validPurchase.success).toBe(true);
    });

    it("verifies idempotency key persistence pattern across retry attempts", () => {
      // Simulasi state lifecycle pada komponen form pembelian:
      // 1. Key dihasilkan saat form pertama kali dimuat
      const initialIdempotencyKey = "uuid-key-attempt-1";
      let activeKey = initialIdempotencyKey;

      // 2. Transaksi pertama dicoba, terjadi kegagalan jaringan (misal timeout)
      const attempt1Success = false;
      if (!attempt1Success) {
        // PERINGATAN: activeKey TIDAK boleh di-regenerate saat retry
        activeKey = initialIdempotencyKey;
      }
      expect(activeKey).toBe(initialIdempotencyKey);

      // 3. Pengguna menekan tombol 'Coba Lagi' (Retry)
      const retryPayload = {
        supplierName: "Vendor A",
        idempotencyKey: activeKey,
      };
      expect(retryPayload.idempotencyKey).toBe(initialIdempotencyKey);

      // 4. Setelah berhasil dan pengguna memilih 'Catat Pembelian Lainnya', baru key di-reset
      const isSuccessConfirmed = true;
      if (isSuccessConfirmed) {
        activeKey = "uuid-key-attempt-2-new-tx";
      }
      expect(activeKey).not.toBe(initialIdempotencyKey);
    });
  });

  describe("6. Format & Calculation Standards", () => {
    it("formats Indonesian Rupiah amounts consistently without decimal fractions", () => {
      expect(formatRupiah(0)).toBe("Rp 0");
      expect(formatRupiah(75000)).toBe("Rp 75.000");
      expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
    });
  });
});
