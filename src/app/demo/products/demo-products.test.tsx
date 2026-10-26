import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DemoProductsPage from "./page";
import { demoStoreService } from "@/services/demo/demo-store.service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/products",
}));

describe("DemoProductsPage (/demo/products)", () => {
  beforeEach(() => {
    // Mock local storage aman
    const mockStorage: Record<string, string> = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {}),
    };
    if (typeof window === "undefined") {
      (global as unknown as { window: unknown }).window = {
        localStorage: localStorageMock,
      };
    } else {
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        writable: true,
      });
    }

    demoStoreService.resetState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merender header dan 5 kartu KPI inventaris produk simulasi", () => {
    const html = renderToStaticMarkup(<DemoProductsPage />);

    expect(html).toContain("Katalog Produk &amp; Persediaan");
    expect(html).toContain("Toko Sembako Sejahtera");
    expect(html).toContain("Total Jenis Produk");
    expect(html).toContain("Total Fisik Barang");
    expect(html).toContain("Nilai Modal (HPP)");
    expect(html).toContain("Potensi Omzet");
    expect(html).toContain("Stok Menipis");
  });

  it("merender daftar produk awal dengan nama dan SKU", () => {
    const html = renderToStaticMarkup(<DemoProductsPage />);

    expect(html).toContain("Beras Ramos Super 5kg");
    expect(html).toContain("BRS-RMS-05");
    expect(html).toContain("Minyak Goreng Sawit 2L");
    expect(html).toContain("MYK-SWT-02");
  });

  it("mencakup tombol aksi 'Tambah Produk' dan 'Kasir POS Demo'", () => {
    const html = renderToStaticMarkup(<DemoProductsPage />);

    expect(html).toContain("Tambah Produk");
    expect(html).toContain("Kasir POS Demo");
    expect(html).toContain('id="demo-add-product-btn"');
  });

  it("mendukung operasi penambahan dan pembacaan produk baru di store demo", () => {
    const res = demoStoreService.createProduct({
      name: "Susu Kental Manis 370g",
      sku: "SKU-TEST-01",
      category: "Minuman",
      price: 14000,
      cogs: 11000,
      stockQuantity: 20,
      minStockAlert: 5,
      unit: "kaleng",
    });

    expect(res.success).toBe(true);

    const html = renderToStaticMarkup(<DemoProductsPage />);
    expect(html).toContain("Susu Kental Manis 370g");
    expect(html).toContain("SKU-TEST-01");
  });

  it("mendukung pembaruan data dan pengarsipan produk", () => {
    const updateRes = demoStoreService.updateProduct({
      id: "prod-001",
      name: "Beras Ramos Premium 5kg",
      price: 80000,
    });
    expect(updateRes.success).toBe(true);

    const archiveRes = demoStoreService.archiveProduct("prod-001");
    expect(archiveRes.success).toBe(true);

    const prod = demoStoreService.getProductById("prod-001");
    expect(prod?.isArchived).toBe(true);
  });
});
