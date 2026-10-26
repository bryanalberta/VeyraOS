import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DemoExpensesPage from "./page";
import { demoStoreService } from "@/services/demo/demo-store.service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/expenses",
}));

describe("DemoExpensesPage (/demo/expenses)", () => {
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

  it("merender header dan kartu ringkasan KPI beban operasional", () => {
    const html = renderToStaticMarkup(<DemoExpensesPage />);

    expect(html).toContain("Buku Pengeluaran Operasional");
    expect(html).toContain("Toko Sembako Sejahtera");
    expect(html).toContain("Total Beban Operasional");
    expect(html).toContain("Komposisi Beban per Kategori");
    expect(html).toContain("Catat Pengeluaran Baru");
  });

  it("merender daftar catatan pengeluaran awal dari seed data", () => {
    const html = renderToStaticMarkup(<DemoExpensesPage />);

    expect(html).toContain("Sewa Tempat");
    expect(html).toContain("Listrik &amp; Air");
  });

  it("menampilkan edukasi akuntansi UMKM terkait pemisahan biaya operasional dari persediaan", () => {
    const html = renderToStaticMarkup(<DemoExpensesPage />);

    expect(html).toContain("Prinsip Akuntansi UMKM:");
    expect(html).toContain("beban operasional toko murni");
  });

  it("mencatat beban operasional baru dan menghapusnya di demoStoreService", () => {
    const res = demoStoreService.recordExpense({
      category: "Konsumsi & Logistik Toko",
      amount: 45000,
      description: "Air galon & kopi kasir shift pagi",
      paymentMethod: "CASH",
    });

    expect(res.success).toBe(true);

    const html = renderToStaticMarkup(<DemoExpensesPage />);
    expect(html).toContain("Air galon &amp; kopi kasir shift pagi");

    if (res.success) {
      const del = demoStoreService.deleteExpense(res.data.id);
      expect(del.success).toBe(true);
    }
  });
});
