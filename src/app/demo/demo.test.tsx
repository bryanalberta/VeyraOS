import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoSidebar, DEMO_NAV_ITEMS } from "@/components/demo/demo-sidebar";
import { DemoLayout } from "@/components/demo/demo-layout";
import DemoGatewayPage from "./page";
import DemoDashboardPage from "./dashboard/page";
import { demoStoreService } from "@/services/demo/demo-store.service";
import { formatRupiah } from "@/lib/utils";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/demo/dashboard",
}));

describe("Demo UI Components & Route Testing", () => {
  beforeEach(() => {
    demoStoreService.resetState();
  });

  // -------------------------------------------------------------------------
  // 1. Pengujian DemoBanner
  // -------------------------------------------------------------------------
  describe("DemoBanner", () => {
    it("merender penanda mode demo dengan lencana visual yang jelas", () => {
      const html = renderToStaticMarkup(<DemoBanner />);
      expect(html).toContain("MODE DEMO — SIMULASI");
      expect(html).toContain("Toko Sembako Sejahtera");
      expect(html).toContain("terisolasi dari database produksi");
    });

    it("menyediakan tombol reset data dan tautan ke registrasi akun nyata", () => {
      const html = renderToStaticMarkup(<DemoBanner />);
      expect(html).toContain("Reset Data");
      expect(html).toContain('href="/register"');
      expect(html).toContain("Daftar Akun Nyata");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Pengujian DemoSidebar
  // -------------------------------------------------------------------------
  describe("DemoSidebar", () => {
    it("merender brand header VeyraOS dengan lencana DEMO", () => {
      const html = renderToStaticMarkup(<DemoSidebar currentPath="/demo/dashboard" />);
      expect(html).toContain("VeyraOS");
      expect(html).toContain("DEMO");
      expect(html).toContain("Simulasi Lokal Sandboxed");
    });

    it("menampilkan konteks bisnis Toko Sembako Sejahtera", () => {
      const html = renderToStaticMarkup(<DemoSidebar currentPath="/demo/dashboard" />);
      expect(html).toContain("Toko Sembako Sejahtera");
      expect(html).toContain("Kelontong / Sembako");
    });

    it("menghubungkan seluruh rute modul demo aktif (/demo/dashboard, /demo/sales, /demo/products, /demo/expenses, /demo/purchases, /demo/reports, /demo/settings) serta TIDAK menghubungkan ke rute produksi", () => {
      const html = renderToStaticMarkup(<DemoSidebar currentPath="/demo/dashboard" />);
      // Rute demo aktif
      expect(html).toContain('href="/demo/dashboard"');
      expect(html).toContain('href="/demo/sales"');
      expect(html).toContain('href="/demo/products"');
      expect(html).toContain('href="/demo/expenses"');
      expect(html).toContain('href="/demo/purchases"');
      expect(html).toContain('href="/demo/reports"');
      expect(html).toContain('href="/demo/settings"');

      // Memastikan TIDAK ADA tautan langsung ke rute produksi tanpa prefix /demo/
      expect(html).not.toContain('href="/sales"');
      expect(html).not.toContain('href="/products"');
      expect(html).not.toContain('href="/expenses"');
      expect(html).not.toContain('href="/purchases"');
      expect(html).not.toContain('href="/reports"');
      expect(html).not.toContain('href="/settings"');
      expect(html).not.toContain('href="/dashboard"');
    });

    it("memastikan seluruh modul navigasi demo kini aktif tanpa status terkunci", () => {
      const html = renderToStaticMarkup(<DemoSidebar currentPath="/demo/dashboard" />);
      expect(html).not.toContain("Segera");
      expect(html).not.toContain('aria-disabled="true"');
    });

    it("memiliki daftar item navigasi dengan pemetaan yang benar", () => {
      const dashboardItem = DEMO_NAV_ITEMS.find((i) => i.label === "Ringkasan");
      expect(dashboardItem?.isAvailable).toBe(true);
      expect(dashboardItem?.href).toBe("/demo/dashboard");

      const salesItem = DEMO_NAV_ITEMS.find((i) => i.label === "Penjualan");
      expect(salesItem?.isAvailable).toBe(true);
      expect(salesItem?.href).toBe("/demo/sales");
      expect(salesItem?.stageNote).toBeUndefined();

      const inventoryItem = DEMO_NAV_ITEMS.find((i) => i.label === "Produk & Stok");
      expect(inventoryItem?.isAvailable).toBe(true);
      expect(inventoryItem?.href).toBe("/demo/products");

      const expenseItem = DEMO_NAV_ITEMS.find((i) => i.label === "Pengeluaran");
      expect(expenseItem?.isAvailable).toBe(true);
      expect(expenseItem?.href).toBe("/demo/expenses");

      const purchaseItem = DEMO_NAV_ITEMS.find((i) => i.label === "Pembelian");
      expect(purchaseItem?.isAvailable).toBe(true);
      expect(purchaseItem?.href).toBe("/demo/purchases");

      const reportItem = DEMO_NAV_ITEMS.find((i) => i.label === "Laporan");
      expect(reportItem?.isAvailable).toBe(true);
      expect(reportItem?.href).toBe("/demo/reports");

      const settingsItem = DEMO_NAV_ITEMS.find((i) => i.label === "Pengaturan");
      expect(settingsItem?.isAvailable).toBe(true);
      expect(settingsItem?.href).toBe("/demo/settings");
      expect(settingsItem?.stageNote).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Pengujian DemoGatewayPage (/demo)
  // -------------------------------------------------------------------------
  describe("DemoGatewayPage (/demo)", () => {
    it("merender kartu gateway penyiapan simulasi Toko Sembako Sejahtera", () => {
      const html = renderToStaticMarkup(<DemoGatewayPage />);
      expect(html).toContain("VeyraOS Mode Demo");
      expect(html).toContain("Toko Sembako Sejahtera");
      expect(html).toContain("Terisolasi Penuh &amp; Aman");
      expect(html).toContain('href="/demo/dashboard"');
      expect(html).toContain("Buka Dashboard Simulasi Sekarang");
      expect(html).toContain('href="/login"');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Pengujian DemoLayout
  // -------------------------------------------------------------------------
  describe("DemoLayout", () => {
    it("membungkus konten dengan DemoBanner, DemoSidebar, dan TopBar", () => {
      const html = renderToStaticMarkup(
        <DemoLayout title="Halaman Uji">
          <div data-testid="konten-anak">Konten Anak</div>
        </DemoLayout>
      );
      expect(html).toContain("MODE DEMO — SIMULASI");
      expect(html).toContain("Halaman Uji");
      expect(html).toContain("Konten Anak");
      expect(html).toContain("Lewati ke konten demo");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Pengujian DemoDashboardPage (/demo/dashboard)
  // -------------------------------------------------------------------------
  describe("DemoDashboardPage (/demo/dashboard)", () => {
    it("merender dashboard dengan profil Toko Sembako Sejahtera lengkap", () => {
      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Dashboard Performa Toko");
      expect(html).toContain("Toko Sembako Sejahtera");
      expect(html).toContain("Jl. Surya Kencana No. 45, Bogor Tengah, Kota Bogor");
      expect(html).toContain("081298765432");
    });

    it("merender 6 kartu KPI finansial dengan angka terformat Rupiah tanpa desimal", () => {
      const summary = demoStoreService.getDashboardSummary();
      const html = renderToStaticMarkup(<DemoDashboardPage />);

      // 1. Penjualan Bersih
      expect(html).toContain("Penjualan Bersih (Net Sales)");
      expect(html).toContain(formatRupiah(summary.netSales));

      // 2. HPP
      expect(html).toContain("Harga Pokok Penjualan (HPP)");
      expect(html).toContain(formatRupiah(summary.cogs));

      // 3. Laba Kotor & Margin
      expect(html).toContain("Laba Kotor (Gross Profit)");
      expect(html).toContain(formatRupiah(summary.grossProfit));
      expect(html).toContain(`${summary.grossProfitMargin}% margin`);

      // 4. Beban Operasional
      expect(html).toContain("Beban Operasional");
      expect(html).toContain(formatRupiah(summary.operatingExpenses));

      // 5. Laba Operasional Sederhana
      expect(html).toContain("Laba Operasional Sederhana");
      expect(html).toContain(formatRupiah(summary.operatingProfit));

      // 6. Arus Kas Bersih
      expect(html).toContain("Arus Kas Bersih (Cash Flow)");
      expect(html).toContain(formatRupiah(summary.recordedCashFlow.netCashFlow));
    });

    it("merender grafik SVG tren penjualan harian dan tabel screen reader", () => {
      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Tren Penjualan Harian (Simulasi)");
      expect(html).toContain("<svg");
      expect(html).toContain("Tabel Data Tren Penjualan Harian Mode Demo");
    });

    it("merender tabel 5 transaksi kasir terbaru dari dataset seed", () => {
      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Transaksi Kasir Terbaru");
      expect(html).toContain("No. Invoice");
      expect(html).toContain("INV-20261015-0027");
    });

    it("merender peringatan stok rendah untuk produk yang berada di bawah batas minimum", () => {
      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Peringatan Stok Rendah");
      expect(html).toContain("Sabun Cuci Piring Jeruk Nipis 750ml");
      expect(html).toContain("Air Mineral Galon 19L (Isi Ulang Resmi)");
    });

    it("merender banner edukasi akuntansi UMKM anti-double-count", () => {
      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Prinsip Akuntansi UMKM Disiplin (Anti-Double-Count)");
      expect(html).toContain("Pembelian restock barang dagang dicatat sebagai arus kas keluar dan aset persediaan");
    });

    it("merender call-to-action pendaftaran akun nyata dengan tautan /register", () => {
      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Siap Mengelola Bisnis Nyata Anda dengan VeyraOS?");
      expect(html).toContain('href="/register"');
      expect(html).toContain("Daftar Akun Nyata Gratis");
    });

    it("mematuhi kontrak useSyncExternalStore: getState stabil, subscribe bersih, dan bebas dari peringatan infinite loop", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      const consoleWarnSpy = vi.spyOn(console, "warn");

      // Render berulang untuk memvalidasi getSnapshot caching
      const html1 = renderToStaticMarkup(<DemoDashboardPage />);
      const html2 = renderToStaticMarkup(<DemoDashboardPage />);

      expect(html1).toBe(html2);
      expect(html1).toContain("Dashboard Performa Toko");

      // Memastikan tidak ada peringatan React mengenai snapshot tidak ter-cache atau maximum update depth
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("The result of getSnapshot should be cached")
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Maximum update depth exceeded")
      );
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("The result of getSnapshot should be cached")
      );

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it("merefleksikan perubahan store secara reaktif ketika saveState dipanggil", () => {
      demoStoreService.saveState((prev) => ({
        ...prev,
        business: {
          ...prev.business,
          name: "Toko Sembako Maju Jaya",
        },
      }));

      const html = renderToStaticMarkup(<DemoDashboardPage />);
      expect(html).toContain("Toko Sembako Maju Jaya");

      // Reset kembali ke seed awal untuk isolasi test lain
      demoStoreService.resetState();
      const resetHtml = renderToStaticMarkup(<DemoDashboardPage />);
      expect(resetHtml).toContain("Toko Sembako Sejahtera");
    });
  });
});
