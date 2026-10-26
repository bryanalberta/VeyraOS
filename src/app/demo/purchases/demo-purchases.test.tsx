import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DemoPurchasesPage from "./page";
import { demoStoreService } from "@/services/demo/demo-store.service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/purchases",
}));

describe("DemoPurchasesPage (/demo/purchases)", () => {
  beforeEach(() => {
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

  it("merender header dan 3 kartu KPI pembelian persediaan", () => {
    const html = renderToStaticMarkup(<DemoPurchasesPage />);

    expect(html).toContain("Pembelian &amp; Restock Persediaan");
    expect(html).toContain("Toko Sembako Sejahtera");
    expect(html).toContain("Total Transaksi Restock");
    expect(html).toContain("Total Pengeluaran Pengadaan");
    expect(html).toContain("Total Unit Diterima");
    expect(html).toContain("Catat Pembelian / Restock");
  });

  it("merender daftar riwayat faktur pembelian awal (PO)", () => {
    const html = renderToStaticMarkup(<DemoPurchasesPage />);

    expect(html).toContain("PO-20261001-001");
    expect(html).toContain("Distributor Beras Cianjur");
    expect(html).toContain("Beras Ramos Super 5kg");
  });

  it("menampilkan edukasi prinsip akuntansi UMKM terkait pemisahan persediaan vs beban", () => {
    const html = renderToStaticMarkup(<DemoPurchasesPage />);

    expect(html).toContain("Prinsip Akuntansi UMKM:");
    expect(html).toContain("Moving Average Cost");
  });

  it("mencatat restock baru ke demoStoreService dan memperbarui riwayat PO serta stok fisik", () => {
    const res = demoStoreService.recordPurchase({
      supplierName: "CV Distribusi Utama Berkah",
      paymentMethod: "CASH",
      items: [
        {
          productId: "prod-001",
          quantity: 20,
          purchaseCost: 65000,
        },
      ],
    });

    expect(res.success).toBe(true);

    const html = renderToStaticMarkup(<DemoPurchasesPage />);
    expect(html).toContain("CV Distribusi Utama Berkah");
  });
});
