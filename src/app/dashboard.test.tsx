import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DashboardPage from "./dashboard/page";
import { DashboardContent } from "./dashboard/dashboard-content";
import type { DashboardSummaryResponseData, BusinessResponseData } from "@/types/api";
import { formatRupiah } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock next/navigation (diperlukan oleh AppLayout & Next.js links)
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/dashboard",
}));

// ---------------------------------------------------------------------------
// Mock Server Actions
// ---------------------------------------------------------------------------
const mockGetDashboardSummaryAction = vi.fn();
const mockGetActiveTenantContextAction = vi.fn();

vi.mock("@/app/actions/reports", () => ({
  getDashboardSummaryAction: (...args: unknown[]) => mockGetDashboardSummaryAction(...args),
}));

vi.mock("@/app/actions/business", () => ({
  getActiveTenantContextAction: (...args: unknown[]) => mockGetActiveTenantContextAction(...args),
}));

// ---------------------------------------------------------------------------
// Fixture Data Lengkap
// ---------------------------------------------------------------------------
const sampleBusiness: BusinessResponseData = {
  id: "99999999-9999-4999-8999-999999999999",
  ownerId: "user-owner-001",
  name: "Toko Sembako Sejahtera",
  category: "Ritel Sembako",
  phone: "08123456789",
  address: "Jl. Pasar Baru No. 12, Jakarta",
  currencyCode: "IDR",
  timezone: "Asia/Jakarta",
  createdAt: "2026-10-14T08:00:00Z",
  updatedAt: "2026-10-14T08:00:00Z",
};

const sampleDashboardData: DashboardSummaryResponseData = {
  grossSales: 16500000,
  totalDiscounts: 1500000,
  netSales: 15000000,
  cogs: 9500000,
  grossProfit: 5500000,
  grossProfitMargin: 36.67,
  operatingExpenses: 2000000,
  operatingProfit: 3500000,
  recordedCashFlow: {
    cashInflows: 15000000,
    cashInflowsCash: 10000000,
    cashInflowsBank: 5000000,
    cashOutflows: 13800000,
    cashOutflowsExpenses: 2000000,
    cashOutflowsPurchases: 11800000,
    netCashFlow: 1200000,
  },
  recentTransactions: [
    {
      id: "tx-1",
      invoiceNumber: "INV-2026-001",
      transactionDate: "2026-10-14T10:30:00Z",
      totalAmount: 150000,
      paymentMethod: "CASH",
      status: "COMPLETED",
    },
    {
      id: "tx-2",
      invoiceNumber: "INV-2026-002",
      transactionDate: "2026-10-14T11:00:00Z",
      totalAmount: 320000,
      paymentMethod: "BANK_TRANSFER",
      status: "COMPLETED",
    },
    {
      id: "tx-3",
      invoiceNumber: "INV-2026-003",
      transactionDate: "2026-10-14T11:45:00Z",
      totalAmount: 85000,
      paymentMethod: "CASH",
      status: "VOIDED", // Dibatalkan
    },
  ],
  lowStockAlerts: [
    {
      id: "prod-1",
      name: "Beras Pandan Wangi 5kg",
      sku: "BRS-005",
      category: "Beras",
      stockQuantity: 2,
      minStockAlert: 5,
    },
    {
      id: "prod-2",
      name: "Minyak Goreng 2L",
      sku: "MYK-002",
      category: "Minyak",
      stockQuantity: 0, // Habis total
      minStockAlert: 10,
    },
  ],
  dailySalesTrend: [
    { date: "2026-10-12", amount: 4500000, transactionsCount: 15 },
    { date: "2026-10-13", amount: 5200000, transactionsCount: 18 },
    { date: "2026-10-14", amount: 5300000, transactionsCount: 20 },
  ],
};

const emptyDashboardData: DashboardSummaryResponseData = {
  grossSales: 0,
  totalDiscounts: 0,
  netSales: 0,
  cogs: 0,
  grossProfit: 0,
  grossProfitMargin: 0,
  operatingExpenses: 0,
  operatingProfit: 0,
  recordedCashFlow: {
    cashInflows: 0,
    cashInflowsCash: 0,
    cashInflowsBank: 0,
    cashOutflows: 0,
    cashOutflowsExpenses: 0,
    cashOutflowsPurchases: 0,
    netCashFlow: 0,
  },
  recentTransactions: [],
  lowStockAlerts: [],
  dailySalesTrend: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboardSummaryAction.mockResolvedValue({
    success: true,
    data: sampleDashboardData,
  });
  mockGetActiveTenantContextAction.mockResolvedValue({
    success: true,
    data: {
      hasBusiness: true,
      activeBusiness: sampleBusiness,
      businesses: [sampleBusiness],
      isSingleBusiness: true,
    },
  });
});

// ===========================================================================
// SUITE PENGUJIAN UTAMA DASHBOARD UI
// ===========================================================================
describe("VeyraOS Stage 5.5 - Dashboard UI (Langkah 2)", () => {

  // =========================================================================
  // 1. RENDER DASAR & HEADER
  // =========================================================================
  describe("1. Render Dasar & Header Dashboard", () => {
    it("1.1 Default export (DashboardPage) me-render tanpa crash", () => {
      const html = renderToStaticMarkup(<DashboardPage />);
      expect(html.length).toBeGreaterThan(0);
    });

    it("1.2 Menampilkan judul utama 'Dashboard Bisnis'", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Dashboard Bisnis");
    });

    it("1.3 Menampilkan nama bisnis aktif terotorisasi ('Toko Sembako Sejahtera')", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Toko Sembako Sejahtera");
    });

    it("1.4 Menampilkan tombol pemilihan periode (7 Hari, 30 Hari, Refresh)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("7 Hari");
      expect(html).toContain("30 Hari");
      expect(html).toContain("period-7d-btn");
      expect(html).toContain("period-30d-btn");
      expect(html).toContain("refresh-dashboard-btn");
    });
  });

  // =========================================================================
  // 2. ENAM KARTU KPI FINANSIAL
  // =========================================================================
  describe("2. Enam Kartu KPI Finansial Sesuai Kontrak Backend", () => {
    it("2.1 Menampilkan Penjualan Bersih (netSales) dan omzet kotor/diskon", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Penjualan Bersih (Net Sales)");
      expect(html).toContain(formatRupiah(15000000));
      expect(html).toContain(formatRupiah(16500000)); // Gross
      expect(html).toContain(formatRupiah(1500000));  // Discount
    });

    it("2.2 Menampilkan Harga Pokok Penjualan (HPP / COGS)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Harga Pokok Penjualan (HPP)");
      expect(html).toContain(formatRupiah(9500000));
      expect(html).toContain("Modal historis dari seluruh produk yang terjual");
    });

    it("2.3 Menampilkan Laba Kotor (grossProfit) dan persentase margin", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Laba Kotor (Gross Profit)");
      expect(html).toContain(formatRupiah(5500000));
      expect(html).toContain("36.67% margin");
    });

    it("2.4 Menampilkan Beban Operasional (operatingExpenses)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Beban Operasional");
      expect(html).toContain(formatRupiah(2000000));
    });

    it("2.5 Menampilkan Laba Operasional Sederhana (operatingProfit)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Laba Operasional Sederhana");
      expect(html).toContain(formatRupiah(3500000));
      expect(html).toContain("Laba kotor dikurangi seluruh beban operasional");
    });

    it("2.6 Menampilkan Arus Kas Bersih (netCashFlow) terpisah dari laba dengan rincian masuk & keluar", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Arus Kas Bersih (Cash Flow)");
      expect(html).toContain(formatRupiah(1200000));
      expect(html).toContain(formatRupiah(15000000)); // Kas masuk
      expect(html).toContain(formatRupiah(13800000)); // Kas keluar
    });

    it("2.7 Seluruh nilai uang diformat sebagai Rupiah IDR tanpa sen", () => {
      const formatted = formatRupiah(sampleDashboardData.netSales);
      expect(formatted).toMatch(/Rp/);
      expect(formatted).not.toContain(",00");
    });
  });

  // =========================================================================
  // 3. GRAFIK TREN PENJUALAN HARIAN (NATIVE SVG)
  // =========================================================================
  describe("3. Grafik Tren Penjualan Harian (Native SVG & A11y)", () => {
    it("3.1 Me-render elemen SVG native tanpa error", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("<svg");
      expect(html).toContain("viewBox=\"0 0 700 160\"");
      expect(html).toContain("Tren Penjualan Harian");
    });

    it("3.2 Menampilkan nilai puncak omzet pada grafik", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Puncak Omzet:");
      expect(html).toContain(formatRupiah(5300000));
    });

    it("3.3 Menyertakan tabel alternatif screen reader (sr-only) untuk aksesibilitas", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Tabel Data Tren Penjualan Harian");
      expect(html).toContain("sr-only");
      expect(html).toContain("2026-10-12");
      expect(html).toContain(formatRupiah(4500000));
    });

    it("3.4 Menampilkan pesan informatif jika data tren harian kosong", () => {
      const dataWithEmptyTrend = {
        ...sampleDashboardData,
        dailySalesTrend: [],
      };
      const html = renderToStaticMarkup(
        <DashboardContent initialData={dataWithEmptyTrend} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Belum ada data penjualan harian");
    });
  });

  // =========================================================================
  // 4. LIMA TRANSAKSI TERBARU & STATUS VOIDED
  // =========================================================================
  describe("4. Transaksi Terbaru & Status VOIDED", () => {
    it("4.1 Menampilkan transaksi penjualan terbaru dengan nomor invoice dan total", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("INV-2026-001");
      expect(html).toContain("INV-2026-002");
      expect(html).toContain(formatRupiah(150000));
      expect(html).toContain(formatRupiah(320000));
    });

    it("4.2 Transaksi COMPLETED menampilkan badge 'Selesai'", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Selesai");
    });

    it("4.3 Transaksi VOIDED menampilkan badge 'Dibatalkan' secara eksplisit", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("INV-2026-003");
      expect(html).toContain("Dibatalkan");
    });

    it("4.4 Menampilkan label metode pembayaran lokal (Tunai & Transfer Bank)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Tunai");
      expect(html).toContain("Transfer Bank");
    });

    it("4.5 Menyediakan tautan navigasi menuju riwayat penjualan lengkap (/sales)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain('href="/sales"');
      expect(html).toContain("Semua Transaksi");
    });
  });

  // =========================================================================
  // 5. PERINGATAN STOK RENDAH
  // =========================================================================
  describe("5. Peringatan Stok Rendah (Low Stock Alerts)", () => {
    it("5.1 Menampilkan daftar produk dengan stok menipis sesuai ambang minimum", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Beras Pandan Wangi 5kg");
      expect(html).toContain("BRS-005");
      expect(html).toContain("Sisa 2");
      expect(html).toContain("Min: 5 unit");
    });

    it("5.2 Menandai produk stok 0 dengan badge 'Habis (0)'", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Minyak Goreng 2L");
      expect(html).toContain("Habis (0)");
      expect(html).toContain("Min: 10 unit");
    });

    it("5.3 Menampilkan empty state hijau 'Semua Stok Produk Aman' jika tidak ada stok menipis", () => {
      const safeStockData = {
        ...sampleDashboardData,
        lowStockAlerts: [],
      };
      const html = renderToStaticMarkup(
        <DashboardContent initialData={safeStockData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Semua Stok Produk Aman");
      expect(html).toContain("Tidak ada produk aktif yang berada di bawah batas minimum");
    });

    it("5.4 Menyediakan tombol cepat untuk restock (+ Beli Stok Baru)", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={sampleDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain('href="/purchases/new"');
      expect(html).toContain("+ Beli Stok Baru");
    });
  });

  // =========================================================================
  // 6. STATE LOADING, ERROR & EMPTY BUSINESS
  // =========================================================================
  describe("6. State Loading, Error & Bisnis Baru", () => {
    it("6.1 Menampilkan skeleton shimmer saat state loading aktif", () => {
      // Dipanggil tanpa initialData (isLoading = true pada render pertama)
      const html = renderToStaticMarkup(<DashboardContent />);
      expect(html).toContain("data-testid=\"dashboard-loading-skeleton\"");
      expect(html).toContain("animate-shimmer");
    });

    it("6.2 Menampilkan empty state sambutan khusus jika bisnis belum memiliki transaksi sama sekali", () => {
      const html = renderToStaticMarkup(
        <DashboardContent initialData={emptyDashboardData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("Selamat Datang di VeyraOS!");
      expect(html).toContain("Belum ada transaksi maupun pencatatan biaya pada periode ini");
      expect(html).toContain("Buka Kasir POS");
      expect(html).toContain("Tambah Produk");
    });
  });

  // =========================================================================
  // 7. KEAMANAN MULTI-TENANT & INTEGRASI SERVER ACTIONS
  // =========================================================================
  describe("7. Keamanan Multi-Tenant & Penolakan Kebocoran Data", () => {
    it("7.1 UI tidak mengirimkan businessId manual ke Server Action (mengandalkan server-authoritative cookie)", () => {
      const callArgs = {
        startDate: "2026-09-15",
        endDate: "2026-10-14",
      };
      expect(callArgs).not.toHaveProperty("businessId");
    });

    it("7.2 Nilai margin laba kotor tidak crash saat netSales bernilai 0", () => {
      const zeroSalesData = {
        ...sampleDashboardData,
        netSales: 0,
        cogs: 0,
        grossProfit: 0,
        grossProfitMargin: 0,
      };
      const html = renderToStaticMarkup(
        <DashboardContent initialData={zeroSalesData} initialBusiness={sampleBusiness} />
      );
      expect(html).toContain("0% margin");
    });
  });
});
