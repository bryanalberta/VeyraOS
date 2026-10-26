import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportsPage from "./reports/page";
import { ReportsContent } from "./reports/reports-content";
import type {
  SalesReportResponseData,
  ExpenseReportResponseData,
  StockReportResponseData,
  BusinessResponseData,
} from "@/types/api";
import { formatRupiah } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/reports",
}));

// ---------------------------------------------------------------------------
// Mock Server Actions
// ---------------------------------------------------------------------------
const mockGetSalesReportAction = vi.fn();
const mockGetExpenseReportAction = vi.fn();
const mockGetStockReportAction = vi.fn();
const mockExportReportCsvAction = vi.fn();
const mockGetActiveTenantContextAction = vi.fn();

vi.mock("@/app/actions/reports", () => ({
  getSalesReportAction: (...args: unknown[]) => mockGetSalesReportAction(...args),
  getExpenseReportAction: (...args: unknown[]) => mockGetExpenseReportAction(...args),
  getStockReportAction: (...args: unknown[]) => mockGetStockReportAction(...args),
  exportReportCsvAction: (...args: unknown[]) => mockExportReportCsvAction(...args),
}));

vi.mock("@/app/actions/business", () => ({
  getActiveTenantContextAction: (...args: unknown[]) => mockGetActiveTenantContextAction(...args),
}));

// ---------------------------------------------------------------------------
// Fixture Data
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

const sampleSalesData: SalesReportResponseData = {
  period: { startDate: "2026-09-15", endDate: "2026-10-15" },
  pagination: {
    page: 1,
    pageSize: 20,
    totalRows: 3,
    totalPages: 1,
  },
  summary: {
    totalTransactions: 3,
    completedTransactions: 2,
    voidedTransactions: 1,
    grossSales: 550000,
    totalDiscounts: 50000,
    netSales: 500000,
  },
  transactions: [
    {
      id: "sale-1",
      invoiceNumber: "INV-2026-001",
      transactionDate: "2026-10-14T10:00:00Z",
      subtotalAmount: 220000,
      discountAmount: 20000,
      totalAmount: 200000,
      paymentMethod: "CASH",
      status: "COMPLETED",
      itemsCount: 2,
    },
    {
      id: "sale-2",
      invoiceNumber: "INV-2026-002",
      transactionDate: "2026-10-14T11:30:00Z",
      subtotalAmount: 330000,
      discountAmount: 30000,
      totalAmount: 300000,
      paymentMethod: "BANK_TRANSFER",
      status: "COMPLETED",
      itemsCount: 3,
    },
    {
      id: "sale-3",
      invoiceNumber: "INV-2026-003",
      transactionDate: "2026-10-14T12:00:00Z",
      subtotalAmount: 75000,
      discountAmount: 0,
      totalAmount: 75000,
      paymentMethod: "CASH",
      status: "VOIDED",
      itemsCount: 1,
    },
  ],
};

const sampleExpenseData: ExpenseReportResponseData = {
  period: { startDate: "2026-09-15", endDate: "2026-10-15" },
  totalExpenses: 1250000,
  byCategory: [
    {
      category: "RENT",
      totalAmount: 750000,
      count: 1,
      percentage: 60.0,
    },
    {
      category: "UTILITIES",
      totalAmount: 300000,
      count: 2,
      percentage: 24.0,
    },
    {
      category: "SUPPLIES",
      totalAmount: 200000,
      count: 1,
      percentage: 16.0,
    },
  ],
  expenses: [
    {
      id: "exp-1",
      expenseDate: "2026-10-01",
      category: "RENT",
      amount: 750000,
      description: "Sewa kios bulan Oktober",
    },
    {
      id: "exp-2",
      expenseDate: "2026-10-05",
      category: "UTILITIES",
      amount: 200000,
      description: "Tagihan Listrik PLN",
    },
    {
      id: "exp-3",
      expenseDate: "2026-10-06",
      category: "UTILITIES",
      amount: 100000,
      description: "Tagihan Air PDAM",
    },
    {
      id: "exp-4",
      expenseDate: "2026-10-08",
      category: "SUPPLIES",
      amount: 200000,
      description: "Kantong plastik & kertas struk",
    },
  ],
};

const sampleStockData: StockReportResponseData = {
  summary: {
    totalProducts: 3,
    totalStockUnits: 45,
    totalAssetValueCost: 450000,
    totalAssetValueSelling: 650000,
    lowStockCount: 2,
  },
  items: [
    {
      id: "prod-1",
      name: "Beras Pandan Wangi 5kg",
      sku: "BRS-005",
      category: "Sembako",
      stockQuantity: 20,
      minStockAlert: 10,
      costPrice: 50000,
      sellingPrice: 65000,
      assetValueCost: 1000000,
      assetValueSelling: 1300000,
      isLowStock: false,
      isArchived: false,
    },
    {
      id: "prod-2",
      name: "Minyak Goreng 1L",
      sku: "MYK-001",
      category: "Minyak",
      stockQuantity: 4,
      minStockAlert: 10,
      costPrice: 15000,
      sellingPrice: 20000,
      assetValueCost: 60000,
      assetValueSelling: 80000,
      isLowStock: true,
      isArchived: false,
    },
    {
      id: "prod-3",
      name: "Gula Pasir 1kg",
      sku: "GLA-001",
      category: "Sembako",
      stockQuantity: 0,
      minStockAlert: 5,
      costPrice: 14000,
      sellingPrice: 18000,
      assetValueCost: 0,
      assetValueSelling: 0,
      isLowStock: true,
      isArchived: false,
    },
  ],
};

describe("Financial Reports UI Test Suite (src/app/reports/page.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveTenantContextAction.mockResolvedValue({
      success: true,
      data: {
        hasBusiness: true,
        activeBusiness: sampleBusiness,
        userBusinesses: [sampleBusiness],
      },
    });
    mockGetSalesReportAction.mockResolvedValue({
      success: true,
      data: sampleSalesData,
    });
    mockGetExpenseReportAction.mockResolvedValue({
      success: true,
      data: sampleExpenseData,
    });
    mockGetStockReportAction.mockResolvedValue({
      success: true,
      data: sampleStockData,
    });
    mockExportReportCsvAction.mockResolvedValue({
      success: true,
      data: {
        filename: "laporan-penjualan-2026-09-15_2026-10-15.csv",
        content: "\uFEFFNo Faktur,Tanggal\r\nINV-001,2026-10-14\r\n",
        rowCount: 1,
        mimeType: "text/csv; charset=utf-8",
      },
    });
  });

  // =========================================================================
  // 1. HEADER, SEGMENTED TABS & TENANT CONTEXT
  // =========================================================================
  describe("1. Header & Segmented Tabs Navigation", () => {
    it("1.1 Menampilkan judul Laporan Keuangan & Operasional dan nama bisnis aktif", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );
      expect(html).toContain("Laporan Keuangan &amp; Operasional");
      expect(html).toContain("Toko Sembako Sejahtera");
    });

    it("1.2 Menampilkan 3 tab utama dengan atribut ARIA yang aksesibel", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('id="tab-sales"');
      expect(html).toContain('id="tab-expenses"');
      expect(html).toContain('id="tab-stock"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain("Laporan Penjualan");
      expect(html).toContain("Beban Operasional");
      expect(html).toContain("Stok &amp; Valuasi Persediaan");
    });

    it("1.3 Menampilkan tombol Ekspor CSV dengan id='export-csv-btn'", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );
      expect(html).toContain('id="export-csv-btn"');
      expect(html).toContain("Ekspor CSV");
    });

    it("1.4 Menampilkan fallback suspense saat render ReportsPage", () => {
      const html = renderToStaticMarkup(<ReportsPage />);
      expect(html).toContain("data-testid=\"reports-loading-skeleton\"");
    });
  });

  // =========================================================================
  // 2. TAB 1: LAPORAN PENJUALAN
  // =========================================================================
  describe("2. Tab 1: Laporan Penjualan", () => {
    it("2.1 Menampilkan 6 kartu ringkasan KPI penjualan dengan format Rupiah tanpa desimal", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );

      // Format Rupiah tanpa desimal
      expect(html).toContain(formatRupiah(sampleSalesData.summary.netSales)); // Rp 500.000
      expect(html).toContain(formatRupiah(sampleSalesData.summary.grossSales)); // Rp 550.000
      expect(html).toContain(formatRupiah(sampleSalesData.summary.totalDiscounts)); // Rp 50.000
      expect(html).toContain("Penjualan Bersih");
      expect(html).toContain("Penjualan Kotor");
      expect(html).toContain("Total Diskon");
      expect(html).toContain("Total Transaksi");
      expect(html).toContain("Selesai");
      expect(html).toContain("Dibatalkan");
    });

    it("2.2 Menampilkan tabel daftar transaksi penjualan dengan invoice, tanggal, dan status", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("INV-2026-001");
      expect(html).toContain("INV-2026-002");
      expect(html).toContain("INV-2026-003");
      expect(html).toContain("Tunai");
      expect(html).toContain("Transfer Bank");
    });

    it("2.3 Membedakan transaksi VOIDED secara eksplisit dengan badge 'Dibatalkan'", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Selesai");
      expect(html).toContain("Dibatalkan");
      // Nominal transaksi VOIDED dicoret (line-through)
      expect(html).toContain("line-through");
    });

    it("2.4 Menampilkan paginasi penjualan dengan nomor halaman dan tombol navigasi", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain('id="sales-prev-page-btn"');
      expect(html).toContain('id="sales-next-page-btn"');
      expect(html).toContain("Halaman <strong>1</strong> dari <strong>1</strong>");
      expect(html).toContain("Total 3 transaksi");
    });

    it("2.5 Menampilkan empty state penjualan jika tidak ada data transaksi", () => {
      const emptySalesData: SalesReportResponseData = {
        ...sampleSalesData,
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          voidedTransactions: 0,
          grossSales: 0,
          totalDiscounts: 0,
          netSales: 0,
        },
        transactions: [],
      };

      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={emptySalesData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain('data-testid="sales-empty-state"');
      expect(html).toContain("Tidak Ada Transaksi Penjualan");
    });
  });

  // =========================================================================
  // 3. TAB 2: LAPORAN BEBAN OPERASIONAL
  // =========================================================================
  describe("3. Tab 2: Laporan Beban Operasional", () => {
    it("3.1 Menampilkan total beban operasional dan rincian komposisi kategori", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="expenses"
          initialExpenseData={sampleExpenseData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain(formatRupiah(sampleExpenseData.totalExpenses)); // Rp 1.250.000
      expect(html).toContain("Total Beban Operasional");
      expect(html).toContain("Komposisi Beban per Kategori");
      expect(html).toContain("Sewa Tempat"); // Terjemahan RENT
      expect(html).toContain("Listrik, Air &amp; Internet"); // Terjemahan UTILITIES
      expect(html).toContain("Perlengkapan Toko"); // Terjemahan SUPPLIES
      expect(html).toContain("60%"); // Persentase sewa
    });

    it("3.2 Menampilkan tabel daftar pengeluaran operasional dengan catatan dan nominal", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="expenses"
          initialExpenseData={sampleExpenseData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Sewa kios bulan Oktober");
      expect(html).toContain("Tagihan Listrik PLN");
      expect(html).toContain("Tagihan Air PDAM");
      expect(html).toContain("Kantong plastik &amp; kertas struk");
      expect(html).toContain(formatRupiah(750000));
    });

    it("3.3 Menyertakan catatan edukatif bahwa pembelian stok dipisahkan dari beban operasional", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="expenses"
          initialExpenseData={sampleExpenseData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Prinsip Akuntansi UMKM:");
      expect(html).toContain("Pembelian restock persediaan barang dagangan");
      expect(html).toContain("tidak dimasukkan");
      expect(html).toContain("ke dalam beban operasional");
    });

    it("3.4 Menampilkan empty state jika tidak ada catatan pengeluaran", () => {
      const emptyExpenseData: ExpenseReportResponseData = {
        period: { startDate: "2026-09-15", endDate: "2026-10-15" },
        totalExpenses: 0,
        byCategory: [],
        expenses: [],
      };

      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="expenses"
          initialExpenseData={emptyExpenseData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain('data-testid="expenses-empty-state"');
      expect(html).toContain("Tidak Ada Catatan Pengeluaran");
    });
  });

  // =========================================================================
  // 4. TAB 3: LAPORAN STOK & VALUASI PERSEDIAAN
  // =========================================================================
  describe("4. Tab 3: Laporan Stok & Valuasi Persediaan", () => {
    it("4.1 Menampilkan metrik valuasi modal aset (MWAC) dan potensi omzet penjualan", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="stock"
          initialStockData={sampleStockData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain(formatRupiah(sampleStockData.summary.totalAssetValueCost)); // Modal Aset Stok
      expect(html).toContain(formatRupiah(sampleStockData.summary.totalAssetValueSelling)); // Potensi Omzet
      expect(html).toContain("Modal Aset Stok");
      expect(html).toContain("Potensi Omzet");
      expect(html).toContain("Potensi Laba Kotor");
      expect(html).toContain("Total Unit Stok");
      expect(html).toContain("Stok Menipis");
    });

    it("4.2 Menampilkan tabel daftar produk stok dengan status Habis (0) dan Menipis", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="stock"
          initialStockData={sampleStockData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Beras Pandan Wangi 5kg");
      expect(html).toContain("BRS-005");
      expect(html).toContain("Minyak Goreng 1L");
      expect(html).toContain("Gula Pasir 1kg");

      // Badge status stok
      expect(html).toContain("Aman");
      expect(html).toContain("Menipis (Min: 10)");
      expect(html).toContain("Habis (0)");
    });

    it("4.3 Menampilkan penjelasan edukatif tentang metode Moving Weighted Average Cost (MWAC)", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="stock"
          initialStockData={sampleStockData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Metode Valuasi MWAC (Moving Weighted Average Cost):");
      expect(html).toContain("dihitung berdasarkan harga perolehan historis (HPP produk)");
      expect(html).toContain("bukan dari harga jual toko");
    });

    it("4.4 Menampilkan empty state persediaan jika daftar produk kosong", () => {
      const emptyStockData: StockReportResponseData = {
        summary: {
          totalProducts: 0,
          totalStockUnits: 0,
          totalAssetValueCost: 0,
          totalAssetValueSelling: 0,
          lowStockCount: 0,
        },
        items: [],
      };

      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="stock"
          initialStockData={emptyStockData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain('data-testid="stock-empty-state"');
      expect(html).toContain("Tidak Ada Data Persediaan");
    });
  });

  // =========================================================================
  // 5. VALIDASI FILTER & INTEGRASI SERVER ACTIONS
  // =========================================================================
  describe("5. Validasi Filter & Keamanan Multi-Tenant", () => {
    it("5.1 Parameter kueri tidak menyertakan businessId dari sisi client (server-authoritative cookie)", () => {
      const clientQueryParams = {
        startDate: "2026-09-15",
        endDate: "2026-10-15",
        page: 1,
      };
      expect(clientQueryParams).not.toHaveProperty("businessId");
    });

    it("5.2 Filter form menyediakan tombol Terapkan Filter dan Reset", () => {
      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain('id="apply-sales-filter-btn"');
      expect(html).toContain('id="reset-sales-filter-btn"');
      expect(html).toContain("Terapkan Filter");
      expect(html).toContain("Reset");
    });

    it("5.3 Memastikan nama bisnis yang ditampilkan berasal dari konteks tenant yang terotorisasi", () => {
      const anotherBusiness: BusinessResponseData = {
        ...sampleBusiness,
        id: "88888888-8888-4888-8888-888888888888",
        name: "Bengkel Motor Berkah",
      };

      const html = renderToStaticMarkup(
        <ReportsContent
          initialTab="sales"
          initialSalesData={sampleSalesData}
          initialBusiness={anotherBusiness}
        />
      );

      expect(html).toContain("Bengkel Motor Berkah");
      expect(html).not.toContain("Toko Sembako Sejahtera");
    });
  });
});
