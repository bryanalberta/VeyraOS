import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DemoReportsPage from "./page";
import { demoStoreService } from "@/services/demo/demo-store.service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/reports",
}));

describe("DemoReportsPage (/demo/reports)", () => {
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

  it("merender header dan 3 tab pilihan jenis laporan simulasi", () => {
    const html = renderToStaticMarkup(<DemoReportsPage />);

    expect(html).toContain("Laporan Keuangan &amp; Operasional");
    expect(html).toContain("Toko Sembako Sejahtera");
    expect(html).toContain("Laporan Penjualan");
    expect(html).toContain("Beban Operasional");
    expect(html).toContain("Stok &amp; Valuasi Persediaan");
    expect(html).toContain("Ekspor CSV Klien");
    expect(html).toContain('id="demo-export-csv-btn"');
  });

  it("merender 6 kartu KPI ringkasan penjualan bersih pada tab default", () => {
    const html = renderToStaticMarkup(<DemoReportsPage />);

    expect(html).toContain("Penjualan Bersih");
    expect(html).toContain("Penjualan Kotor");
    expect(html).toContain("Total Diskon");
    expect(html).toContain("Total Transaksi");
    expect(html).toContain("Selesai / Lunas");
    expect(html).toContain("Dibatalkan");
  });

  it("merender daftar transaksi kasir dengan nomor faktur", () => {
    const html = renderToStaticMarkup(<DemoReportsPage />);

    expect(html).toContain("Daftar Transaksi Kasir");
  });
});
