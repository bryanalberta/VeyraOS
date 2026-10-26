/**
 * VeyraOS Server Actions Unit Tests — Financial Reporting & Business Analytics (Stage 3.3 Batch 3)
 *
 * Menguji aksi server reports.ts dalam lingkungan mock terisolasi:
 * - getDashboardSummaryAction
 * - getSalesReportAction
 * - getExpenseReportAction
 * - getStockReportAction
 * - exportReportCsvAction
 *
 * Menjamin kepatuhan terhadap prinsip:
 * 1. Validasi Zod pada boundary action: rentang tanggal terbalik, tipe ekspor invalid, dsb.
 * 2. Tenant Context resolution (eksplisit vs cookie veyra_active_business_id).
 * 3. Fail-Closed & Anti-Silent Fallback jika cookie rusak atau pengguna bukan anggota.
 * 4. Pendelegasian murni ke Report Service Layer tanpa mengubah logika matematis finansial.
 * 5. Integritas CSV export (RFC 4180, UTF-8 BOM, sanitasi CWE-1236).
 *
 * Keterbatasan: Pengujian unit ini menggunakan mock Next.js headers dan Supabase client,
 * dan bukan merupakan bukti perilaku database fisik PostgreSQL atau RLS runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  getDashboardSummaryAction,
  getSalesReportAction,
  getExpenseReportAction,
  getStockReportAction,
  exportReportCsvAction,
} from "./reports";
import * as reportService from "@/services/reports/report.service";
import * as businessService from "@/services/business/business.service";
import { UTF8_BOM } from "@/lib/csv";
import type {
  DashboardSummaryResponseData,
  SalesReportResponseData,
  ExpenseReportResponseData,
  StockReportResponseData,
  ReportCsvResult,
} from "@/types/api";

describe("Financial Reporting Server Actions Suite (src/app/actions/reports.ts)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";

  const sampleDashboardData: DashboardSummaryResponseData = {
    grossSales: 1500000,
    totalDiscounts: 50000,
    netSales: 1450000,
    cogs: 900000,
    grossProfit: 550000,
    grossProfitMargin: 37.93,
    operatingExpenses: 200000,
    operatingProfit: 350000,
    recordedCashFlow: {
      cashInflows: 1450000,
      cashInflowsCash: 1000000,
      cashInflowsBank: 450000,
      cashOutflows: 700000,
      cashOutflowsExpenses: 200000,
      cashOutflowsPurchases: 500000,
      netCashFlow: 750000,
    },
    recentTransactions: [],
    lowStockAlerts: [],
    dailySalesTrend: [
      {
        date: "2026-10-14",
        amount: 1450000,
        transactionsCount: 5,
      },
    ],
  };

  const sampleSalesReport: SalesReportResponseData = {
    period: { startDate: "2026-10-01", endDate: "2026-10-14" },
    pagination: {
      page: 1,
      pageSize: 20,
      totalRows: 1,
      totalPages: 1,
    },
    summary: {
      totalTransactions: 1,
      completedTransactions: 1,
      voidedTransactions: 0,
      grossSales: 150000,
      totalDiscounts: 10000,
      netSales: 140000,
    },
    transactions: [
      {
        id: "sale-1",
        invoiceNumber: "INV-20261014-001",
        transactionDate: "2026-10-14T03:00:00Z",
        subtotalAmount: 150000,
        discountAmount: 10000,
        totalAmount: 140000,
        paymentMethod: "CASH",
        status: "COMPLETED",
        itemsCount: 2,
      },
    ],
  };

  const sampleExpenseReport: ExpenseReportResponseData = {
    period: { startDate: "2026-10-01", endDate: "2026-10-14" },
    totalExpenses: 250000,
    byCategory: [
      {
        category: "OPERATIONAL",
        totalAmount: 250000,
        count: 2,
        percentage: 100,
      },
    ],
    expenses: [
      {
        id: "exp-1",
        expenseDate: "2026-10-14T02:00:00Z",
        category: "OPERATIONAL",
        amount: 150000,
        description: "Beli kantong kresek",
      },
    ],
  };

  const sampleStockReport: StockReportResponseData = {
    summary: {
      totalProducts: 5,
      totalStockUnits: 120,
      totalAssetValueCost: 6000000,
      totalAssetValueSelling: 9000000,
      lowStockCount: 1,
    },
    items: [
      {
        id: "prod-1",
        name: "Beras Pandan Wangi 5kg",
        sku: "BRS-PW-05",
        category: "Sembako",
        stockQuantity: 20,
        minStockAlert: 5,
        costPrice: 65000,
        sellingPrice: 85000,
        assetValueCost: 1300000,
        assetValueSelling: 1700000,
        isLowStock: false,
        isArchived: false,
      },
    ],
  };

  const sampleCsvResult: ReportCsvResult = {
    filename: "laporan-penjualan-2026-10-14.csv",
    content: `${UTF8_BOM}"No. Faktur","Tanggal","Total"\n"INV-001","2026-10-14",140000`,
    rowCount: 1,
    mimeType: "text/csv; charset=utf-8",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. getDashboardSummaryAction
  // ==========================================================================
  describe("1. getDashboardSummaryAction", () => {
    it("1.1 menolak rentang tanggal terbalik (startDate > endDate)", async () => {
      const getSpy = vi.spyOn(reportService, "getDashboardSummary");

      const result = await getDashboardSummaryAction({
        businessId: validBusinessId,
        startDate: "2026-10-15T00:00:00Z",
        endDate: "2026-10-10T00:00:00Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Parameter kueri dashboard tidak valid");
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("1.2 menolak format tanggal yang tidak valid", async () => {
      const getSpy = vi.spyOn(reportService, "getDashboardSummary");

      const result = await getDashboardSummaryAction({
        businessId: validBusinessId,
        startDate: "invalid-date",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("1.3 resolusi tenant dari cookie jika businessId ditiadakan", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const getSpy = vi
        .spyOn(reportService, "getDashboardSummary")
        .mockResolvedValueOnce({
          success: true,
          data: sampleDashboardData,
        });

      const result = await getDashboardSummaryAction();

      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.netSales).toBe(1450000);
        expect(result.data.operatingProfit).toBe(350000);
      }
      expect(getSpy).toHaveBeenCalledWith(validBusinessId, expect.any(Object));
    });

    it("1.4 penolakan fail-closed saat cookie rusak", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "not-a-uuid" });
      const getSpy = vi.spyOn(reportService, "getDashboardSummary");

      const result = await getDashboardSummaryAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("1.5 penolakan saat pengguna bukan anggota bisnis (UNAUTHORIZED_BUSINESS) dan pembersihan cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const getSpy = vi
        .spyOn(reportService, "getDashboardSummary")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "UNAUTHORIZED_BUSINESS",
            message: "Pengguna bukan anggota dari bisnis ini",
          },
        });

      const result = await getDashboardSummaryAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getSpy).toHaveBeenCalled();
    });

    it("1.6 berhasil membaca agregasi KPI 6-kartu dan analitik harian", async () => {
      const getSpy = vi
        .spyOn(reportService, "getDashboardSummary")
        .mockResolvedValueOnce({
          success: true,
          data: sampleDashboardData,
        });

      const result = await getDashboardSummaryAction(
        { startDate: "2026-10-01", endDate: "2026-10-14" },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.grossSales).toBe(1500000);
        expect(result.data.totalDiscounts).toBe(50000);
        expect(result.data.cogs).toBe(900000);
        expect(result.data.recordedCashFlow.netCashFlow).toBe(750000);
      }
      expect(getSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ startDate: "2026-10-01" })
      );
    });

    it("1.7 resolusi tenant saat cookie kosong tanpa bisnis aktif mengembalikan ACTIVE_BUSINESS_REQUIRED", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);
      vi.spyOn(businessService, "resolveTenantContext").mockResolvedValueOnce({
        success: true,
        data: {
          hasBusiness: false,
          activeBusiness: null,
          role: null,
          availableBusinesses: [],
        },
      });

      const result = await getDashboardSummaryAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ACTIVE_BUSINESS_REQUIRED");
      }
    });
  });

  // ==========================================================================
  // 2. getSalesReportAction
  // ==========================================================================
  describe("2. getSalesReportAction", () => {
    it("2.1 menolak paginasi invalid (page < 1 atau pageSize < 1)", async () => {
      const getSpy = vi.spyOn(reportService, "getSalesReport");

      const result = await getSalesReportAction({
        businessId: validBusinessId,
        page: 0,
        pageSize: 20,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.page).toBeDefined();
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("2.2 menolak status transaksi penjualan yang tidak dikenal", async () => {
      const getSpy = vi.spyOn(reportService, "getSalesReport");

      const result = await getSalesReportAction({
        businessId: validBusinessId,
        status: "UNKNOWN_STATUS" as unknown as "COMPLETED",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.status).toBeDefined();
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("2.3 berhasil membaca laporan penjualan berpaginasi", async () => {
      const getSpy = vi
        .spyOn(reportService, "getSalesReport")
        .mockResolvedValueOnce({
          success: true,
          data: sampleSalesReport,
        });

      const result = await getSalesReportAction(
        { page: 1, pageSize: 20 },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactions.length).toBe(1);
        expect(result.data.summary.netSales).toBe(140000);
      }
      expect(getSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("2.4 resolusi tenant saat cookie rusak: membersihkan cookie dan menolak seketika", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "corrupted-uuid" });
      const getSpy = vi.spyOn(reportService, "getSalesReport");

      const result = await getSalesReportAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("2.5 penolakan saat pengguna bukan anggota bisnis dan pembersihan cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });
      const getSpy = vi
        .spyOn(reportService, "getSalesReport")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "UNAUTHORIZED_BUSINESS",
            message: "Bukan anggota",
          },
        });

      const result = await getSalesReportAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. getExpenseReportAction
  // ==========================================================================
  describe("3. getExpenseReportAction", () => {
    it("3.1 menolak kategori beban yang tidak valid", async () => {
      const getSpy = vi.spyOn(reportService, "getExpenseReport");

      const result = await getExpenseReportAction({
        businessId: validBusinessId,
        category: "INVALID" as unknown as "OPERATIONAL",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.category).toBeDefined();
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("3.2 berhasil membaca laporan beban operasional per kategori", async () => {
      const getSpy = vi
        .spyOn(reportService, "getExpenseReport")
        .mockResolvedValueOnce({
          success: true,
          data: sampleExpenseReport,
        });

      const result = await getExpenseReportAction(
        { category: "OPERATIONAL" },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalExpenses).toBe(250000);
        expect(result.data.byCategory[0].category).toBe("OPERATIONAL");
        expect(result.data.byCategory[0].percentage).toBe(100);
      }
      expect(getSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ category: "OPERATIONAL" })
      );
    });

    it("3.3 resolusi tenant saat cookie rusak: membersihkan cookie dan menolak seketika", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "invalid-cookie-val" });
      const getSpy = vi.spyOn(reportService, "getExpenseReport");

      const result = await getExpenseReportAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. getStockReportAction
  // ==========================================================================
  describe("4. getStockReportAction", () => {
    it("4.1 menolak format kategori melebihi 50 karakter", async () => {
      const getSpy = vi.spyOn(reportService, "getStockReport");

      const result = await getStockReportAction({
        businessId: validBusinessId,
        category: "A".repeat(55),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.category).toBeDefined();
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("4.2 berhasil membaca laporan persediaan & valuasi modal MWAC", async () => {
      const getSpy = vi
        .spyOn(reportService, "getStockReport")
        .mockResolvedValueOnce({
          success: true,
          data: sampleStockReport,
        });

      const result = await getStockReportAction(
        { lowStockOnly: false },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary.totalProducts).toBe(5);
        expect(result.data.summary.totalAssetValueCost).toBe(6000000);
        expect(result.data.summary.totalAssetValueSelling).toBe(9000000);
      }
      expect(getSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ lowStockOnly: false })
      );
    });

    it("4.3 resolusi tenant saat cookie rusak: membersihkan cookie dan menolak seketika", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "corrupted-val" });
      const getSpy = vi.spyOn(reportService, "getStockReport");

      const result = await getStockReportAction();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 5. exportReportCsvAction
  // ==========================================================================
  describe("5. exportReportCsvAction", () => {
    it("5.1 menolak jenis ekspor yang tidak dikenal", async () => {
      const exportSpy = vi.spyOn(reportService, "exportReportCsv");

      const result = await exportReportCsvAction({
        businessId: validBusinessId,
        type: "CUSTOM_TYPE" as unknown as "SALES",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.type).toBeDefined();
      }
      expect(exportSpy).not.toHaveBeenCalled();
    });

    it("5.2 menolak ekspor dengan rentang tanggal terbalik", async () => {
      const exportSpy = vi.spyOn(reportService, "exportReportCsv");

      const result = await exportReportCsvAction({
        businessId: validBusinessId,
        type: "SALES",
        startDate: "2026-10-20",
        endDate: "2026-10-10",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(exportSpy).not.toHaveBeenCalled();
    });

    it("5.3 berhasil mengekspor CSV penjualan berstandar RFC 4180 dengan UTF-8 BOM", async () => {
      const exportSpy = vi
        .spyOn(reportService, "exportReportCsv")
        .mockResolvedValueOnce({
          success: true,
          data: sampleCsvResult,
        });

      const result = await exportReportCsvAction(
        { type: "SALES" },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toContain("laporan-penjualan");
        expect(result.data.content.startsWith(UTF8_BOM)).toBe(true);
        expect(result.data.mimeType).toBe("text/csv; charset=utf-8");
      }
      expect(exportSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ type: "SALES" })
      );
    });

    it("5.4 berhasil mengekspor CSV beban operasional", async () => {
      const exportSpy = vi
        .spyOn(reportService, "exportReportCsv")
        .mockResolvedValueOnce({
          success: true,
          data: {
            filename: "laporan-beban-2026-10-14.csv",
            content: `${UTF8_BOM}"Tanggal","Kategori","Nominal"\n"2026-10-14","OPERATIONAL",250000`,
            rowCount: 1,
            mimeType: "text/csv; charset=utf-8",
          },
        });

      const result = await exportReportCsvAction(
        { type: "EXPENSES" },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toContain("laporan-beban");
      }
      expect(exportSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ type: "EXPENSES" })
      );
    });

    it("5.5 berhasil mengekspor CSV persediaan stok (STOCK)", async () => {
      const exportSpy = vi
        .spyOn(reportService, "exportReportCsv")
        .mockResolvedValueOnce({
          success: true,
          data: {
            filename: "laporan-persediaan-2026-10-14.csv",
            content: `${UTF8_BOM}"Nama Produk","SKU","Stok","HPP"\n"Beras","BRS-01",20,65000`,
            rowCount: 1,
            mimeType: "text/csv; charset=utf-8",
          },
        });

      const result = await exportReportCsvAction(
        { type: "STOCK" },
        validBusinessId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toContain("laporan-persediaan");
      }
      expect(exportSpy).toHaveBeenCalledWith(
        validBusinessId,
        expect.objectContaining({ type: "STOCK" })
      );
    });

    it("5.6 resolusi tenant saat cookie rusak: membersihkan cookie dan menolak seketika", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "broken-cookie" });
      const exportSpy = vi.spyOn(reportService, "exportReportCsv");

      const result = await exportReportCsvAction({ type: "SALES" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(exportSpy).not.toHaveBeenCalled();
    });
  });
});
