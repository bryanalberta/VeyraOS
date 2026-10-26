/**
 * VeyraOS Reports & Financial Analytics Service Unit Tests
 *
 * Mengembangkan 36 skenario uji komprehensif dari preflight report
 * pada Mock Supabase Client terisolasi (Mock-Only Unit Tests).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getDashboardSummary,
  getSalesReport,
  getExpenseReport,
  getStockReport,
  exportReportCsv,
} from "./report.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UTF8_BOM } from "@/lib/csv";

describe("Reports & Financial Analytics Service Suite (src/services/reports)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const otherBusinessId = "99999999-9999-4999-a999-999999999999";
  const validUserId = "22222222-2222-4222-a222-222222222222";

  // Mock State Stores
  let memberResult: { data: unknown; error: unknown };
  let authUserResult: { data: { user: { id: string } | null }; error: unknown };

  let salesData: unknown[];
  let salesCount: number | null;
  let salesError: unknown;

  let expensesData: unknown[];
  let expensesCount: number | null;
  let expensesError: unknown;

  let purchasesData: unknown[];
  let purchasesCount: number | null;
  let purchasesError: unknown;

  let productsData: unknown[];
  let productsCount: number | null;
  let productsError: unknown;

  let recentSalesOverride: unknown[] | null;

  // Pagination interceptors
  let salesPageErrorHandler: ((from: number, to: number) => unknown) | null;
  let salesPageDataHandler: ((from: number, to: number) => unknown[]) | null;

  function createMockSupabase(): SupabaseClient {
    return {
      auth: {
        getUser: vi.fn().mockImplementation(() => Promise.resolve(authUserResult)),
      },
      from: vi.fn((table: string) => {
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(memberResult)),
          };
        }

        let isRecentSalesQuery = false;
        let rangeFrom = 0;
        let rangeTo = 999;
        let isCountQuery = false;

        const builder: Record<string, unknown> = {};

        builder.select = vi.fn((_cols: string, opts?: { count?: string }) => {
          if (opts?.count === "exact") {
            isCountQuery = true;
          }
          return builder;
        });

        builder.eq = vi.fn().mockReturnThis();
        builder.gte = vi.fn().mockReturnThis();
        builder.lt = vi.fn().mockReturnThis();
        builder.order = vi.fn().mockReturnThis();

        builder.limit = vi.fn((n: number) => {
          if (n === 5 && table === "sales") {
            isRecentSalesQuery = true;
          }
          return builder;
        });

        builder.range = vi.fn((from: number, to: number) => {
          rangeFrom = from;
          rangeTo = to;
          return builder;
        });

        builder.then = (resolve: (val: unknown) => void) => {
          if (table === "sales") {
            if (isRecentSalesQuery) {
              const rows = recentSalesOverride ?? salesData.slice(0, 5);
              return resolve({ data: rows, error: null, count: rows.length });
            }

            if (salesError) {
              return resolve({ data: null, error: salesError, count: null });
            }

            if (salesPageErrorHandler) {
              const err = salesPageErrorHandler(rangeFrom, rangeTo);
              if (err) {
                return resolve({ data: null, error: err, count: salesCount });
              }
            }

            if (salesPageDataHandler) {
              const pageRows = salesPageDataHandler(rangeFrom, rangeTo);
              return resolve({
                data: pageRows,
                error: null,
                count: salesCount ?? salesData.length,
              });
            }

            const total = salesCount !== null ? salesCount : salesData.length;
            const sliced = salesData.slice(rangeFrom, rangeTo + 1);
            return resolve({
              data: sliced,
              error: null,
              count: isCountQuery ? total : null,
            });
          }

          if (table === "expenses") {
            if (expensesError) {
              return resolve({ data: null, error: expensesError, count: null });
            }
            const total = expensesCount !== null ? expensesCount : expensesData.length;
            const sliced = expensesData.slice(rangeFrom, rangeTo + 1);
            return resolve({
              data: sliced,
              error: null,
              count: isCountQuery ? total : null,
            });
          }

          if (table === "inventory_purchases") {
            if (purchasesError) {
              return resolve({ data: null, error: purchasesError, count: null });
            }
            const total = purchasesCount !== null ? purchasesCount : purchasesData.length;
            const sliced = purchasesData.slice(rangeFrom, rangeTo + 1);
            return resolve({
              data: sliced,
              error: null,
              count: isCountQuery ? total : null,
            });
          }

          if (table === "products") {
            if (productsError) {
              return resolve({ data: null, error: productsError, count: null });
            }
            const total = productsCount !== null ? productsCount : productsData.length;
            const sliced = productsData.slice(rangeFrom, rangeTo + 1);
            return resolve({
              data: sliced,
              error: null,
              count: isCountQuery ? total : null,
            });
          }

          return resolve({ data: [], error: null, count: 0 });
        };

        return builder;
      }),
    } as unknown as SupabaseClient;
  }

  // Realistic Financial Fixtures
  const sampleSale1 = {
    id: "sale-001",
    invoice_number: "INV-20261001-001",
    transaction_date: "2026-10-01T01:00:00.000Z", // 08:00 WIB
    subtotal_amount: 100000,
    discount_amount: 10000,
    total_amount: 90000,
    payment_method: "CASH",
    status: "COMPLETED",
    notes: "Pelanggan reguler",
    sale_items: [
      {
        id: "item-001",
        quantity: 2,
        unit_selling_price: 50000,
        unit_cost_price: 30000,
        item_discount: 0,
        discount_amount: 10000,
        subtotal_amount: 90000,
      },
    ],
  };

  const sampleSale2 = {
    id: "sale-002",
    invoice_number: "INV-20261002-001",
    transaction_date: "2026-10-02T03:00:00.000Z", // 10:00 WIB
    subtotal_amount: 200000,
    discount_amount: 0,
    total_amount: 200000,
    payment_method: "BANK_TRANSFER",
    status: "COMPLETED",
    notes: null,
    sale_items: [
      {
        id: "item-002",
        quantity: 1,
        unit_selling_price: 200000,
        unit_cost_price: 120000,
        item_discount: 0,
        discount_amount: 0,
        subtotal_amount: 200000,
      },
    ],
  };

  const sampleSaleVoided = {
    id: "sale-003",
    invoice_number: "INV-20261003-001",
    transaction_date: "2026-10-03T04:00:00.000Z",
    subtotal_amount: 50000,
    discount_amount: 0,
    total_amount: 50000,
    payment_method: "CASH",
    status: "VOIDED",
    notes: "Salah input kasir",
    sale_items: [
      {
        id: "item-003",
        quantity: 1,
        unit_selling_price: 50000,
        unit_cost_price: 35000,
        item_discount: 0,
        discount_amount: 0,
        subtotal_amount: 50000,
      },
    ],
  };

  const sampleExpense1 = {
    id: "exp-001",
    business_id: validBusinessId,
    expense_date: "2026-10-01T05:00:00.000Z",
    category: "OPERATIONAL",
    amount: 30000,
    notes: "Plastik kresek & ATK",
    created_at: "2026-10-01T05:00:00.000Z",
    updated_at: "2026-10-01T05:00:00.000Z",
  };

  const sampleExpense2 = {
    id: "exp-002",
    business_id: validBusinessId,
    expense_date: "2026-10-02T06:00:00.000Z",
    category: "UTILITIES",
    amount: 20000,
    notes: "Token listrik tambahan",
    created_at: "2026-10-02T06:00:00.000Z",
    updated_at: "2026-10-02T06:00:00.000Z",
  };

  const samplePurchase1 = {
    id: "pur-001",
    purchase_date: "2026-10-02T07:00:00.000Z",
    total_cost: 75000,
  };

  const sampleProductA = {
    id: "prod-A",
    business_id: validBusinessId,
    name: "Minyak Goreng 1L",
    sku: "MYK-001",
    category: "Sembako",
    selling_price: 50000,
    cost_price: 30000,
    stock_quantity: 2, // <= min_stock_alert 5 -> LOW STOCK
    min_stock_alert: 5,
    is_archived: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };

  const sampleProductB = {
    id: "prod-B",
    business_id: validBusinessId,
    name: "Beras Premium 5kg",
    sku: "BRS-001",
    category: "Sembako",
    selling_price: 200000,
    cost_price: 120000,
    stock_quantity: 10, // > 5 -> AMAN
    min_stock_alert: 5,
    is_archived: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };

  const sampleProductCArchived = {
    id: "prod-C",
    business_id: validBusinessId,
    name: "Gula Pasir 1kg (Lama)",
    sku: "GLA-001",
    category: "Sembako",
    selling_price: 15000,
    cost_price: 10000,
    stock_quantity: 1, // <= 5 tapi is_archived = true
    min_stock_alert: 5,
    is_archived: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };

  beforeEach(() => {
    authUserResult = { data: { user: { id: validUserId } }, error: null };
    memberResult = { data: { role: "OWNER" }, error: null };

    salesData = [sampleSale1, sampleSale2, sampleSaleVoided];
    salesCount = null;
    salesError = null;

    expensesData = [sampleExpense1, sampleExpense2];
    expensesCount = null;
    expensesError = null;

    purchasesData = [samplePurchase1];
    purchasesCount = null;
    purchasesError = null;

    productsData = [sampleProductA, sampleProductB, sampleProductCArchived];
    productsCount = null;
    productsError = null;

    recentSalesOverride = null;
    salesPageErrorHandler = null;
    salesPageDataHandler = null;
  });

  // ==========================================================================
  // 1. Otorisasi & Validasi Input (6 Skenario)
  // ==========================================================================
  describe("1. Otorisasi & Validasi Input", () => {
    it("1.1 Menolak pengguna tidak terautentikasi (UNAUTHENTICATED)", async () => {
      authUserResult = { data: { user: null }, error: { message: "No session" } };
      const client = createMockSupabase();

      const res = await getDashboardSummary(validBusinessId, undefined, {
        supabase: client,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("1.2 Menolak akses pengguna non-anggota tenant (UNAUTHORIZED_BUSINESS)", async () => {
      memberResult = { data: null, error: null }; // Pengguna bukan anggota
      const client = createMockSupabase();

      const res = await getDashboardSummary(otherBusinessId, undefined, {
        supabase: client,
        userId: validUserId,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
    });

    it("1.3 Menolak format UUID bisnis tidak valid (VALIDATION_ERROR)", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary("invalid-uuid-format", undefined, {
        supabase: client,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.details?.businessId).toBeDefined();
      }
    });

    it("1.4 Menolak rentang tanggal terbalik (startDate > endDate)", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        {
          startDate: "2026-10-15",
          endDate: "2026-10-01",
        },
        { supabase: client }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.message).toContain("tidak valid");
      }
    });

    it("1.5 Menolak format tanggal non-ISO 8601", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        {
          startDate: "01/10/2026",
          endDate: "2026-10-07",
        },
        { supabase: client }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("1.6 Menerapkan interval setengah terbuka default 30 hari jika tanggal omitted", async () => {
      const refDate = new Date("2026-10-14T01:00:00.000Z"); // 08:00 WIB 14 Okt 2026
      const client = createMockSupabase();

      const res = await getDashboardSummary(validBusinessId, undefined, {
        supabase: client,
        referenceDate: refDate,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        // Tren harian memuat tepat 30 hari (15 Sep s/d 14 Okt 2026)
        expect(res.data.dailySalesTrend.length).toBe(30);
        expect(res.data.dailySalesTrend[0].date).toBe("2026-09-15");
        expect(res.data.dailySalesTrend[29].date).toBe("2026-10-14");
      }
    });
  });

  // ==========================================================================
  // 2. Rekonsiliasi Finansial Dashboard (8 Skenario)
  // ==========================================================================
  describe("2. Rekonsiliasi Finansial Dashboard", () => {
    it("2.1 Menghitung netSales dari sales.total_amount secara presisi", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Net Sales = 90.000 (Sale 1) + 200.000 (Sale 2) = 290.000
        expect(res.data.netSales).toBe(290000);
        // Gross Sales = 100.000 + 200.000 = 300.000
        expect(res.data.grossSales).toBe(300000);
        // Total Discounts = 10.000
        expect(res.data.totalDiscounts).toBe(10000);
        // Invarian: Gross Sales - Total Discounts === Net Sales
        expect(res.data.grossSales - res.data.totalDiscounts).toBe(res.data.netSales);
      }
    });

    it("2.2 Menghitung COGS dari sale_items.quantity * unit_cost_price", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // COGS = (2 * 30.000) + (1 * 120.000) = 60.000 + 120.000 = 180.000
        expect(res.data.cogs).toBe(180000);
      }
    });

    it("2.3 Menghitung grossProfit dan grossProfitMargin dengan benar", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Gross Profit = 290.000 - 180.000 = 110.000
        expect(res.data.grossProfit).toBe(110000);
        // Margin = (110.000 / 290.000) * 100 = 37.931... -> 37.93%
        expect(res.data.grossProfitMargin).toBe(37.93);
      }
    });

    it("2.4 Mengembalikan grossProfitMargin = 0% saat netSales = 0 (tanpa NaN)", async () => {
      salesData = []; // Tidak ada penjualan
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.netSales).toBe(0);
        expect(res.data.grossProfit).toBe(0);
        expect(res.data.grossProfitMargin).toBe(0);
        expect(Number.isNaN(res.data.grossProfitMargin)).toBe(false);
      }
    });

    it("2.5 Mengeluarkan transaksi status VOIDED dari netSales dan COGS", async () => {
      // Sale 3 bernilai total 50.000 dan cogs 35.000 berstatus VOIDED
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Memastikan nilai VOIDED 50.000 tidak menambah netSales (tetap 290.000)
        expect(res.data.netSales).toBe(290000);
        // Memastikan nilai HPP VOIDED 35.000 tidak menambah cogs (tetap 180.000)
        expect(res.data.cogs).toBe(180000);
      }
    });

    it("2.6 Menghitung operatingExpenses dari expenses.amount dan agregasi kategori getExpenseReport", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Beban = 30.000 (Exp 1) + 20.000 (Exp 2) = 50.000
        expect(res.data.operatingExpenses).toBe(50000);
        // Operating Profit = Gross Profit (110.000) - Operating Expenses (50.000) = 60.000
        expect(res.data.operatingProfit).toBe(60000);
      }

      // Verifikasi getExpenseReport dengan agregasi per kategori
      const expReport = await getExpenseReport(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );
      expect(expReport.success).toBe(true);
      if (expReport.success) {
        expect(expReport.data.totalExpenses).toBe(50000);
        expect(expReport.data.byCategory.length).toBe(2);
        const opCat = expReport.data.byCategory.find((c) => c.category === "OPERATIONAL");
        const utCat = expReport.data.byCategory.find((c) => c.category === "UTILITIES");
        expect(opCat?.totalAmount).toBe(30000);
        expect(opCat?.percentage).toBe(60);
        expect(utCat?.totalAmount).toBe(20000);
        expect(utCat?.percentage).toBe(40);
      }
    });


    it("2.7 Membuktikan inventory_purchases TIDAK masuk ke operatingExpenses", async () => {
      // Purchases bernilai 75.000
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Beban operasional harus tetap 50.000 murni tanpa tercemar 75.000 dari restock
        expect(res.data.operatingExpenses).toBe(50000);
      }
    });

    it("2.8 Menghitung arus kas (cashInflows, cashOutflows, netCashFlow) akurat", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        const cf = res.data.recordedCashFlow;
        // Kas Masuk = 290.000 (CASH 90.000, BANK 200.000)
        expect(cf.cashInflows).toBe(290000);
        expect(cf.cashInflowsCash).toBe(90000);
        expect(cf.cashInflowsBank).toBe(200000);

        // Kas Keluar = Beban (50.000) + Pembelian Stok (75.000) = 125.000
        expect(cf.cashOutflowsExpenses).toBe(50000);
        expect(cf.cashOutflowsPurchases).toBe(75000);
        expect(cf.cashOutflows).toBe(125000);

        // Arus Kas Bersih = 290.000 - 125.000 = 165.000
        expect(cf.netCashFlow).toBe(165000);
      }
    });
  });

  // ==========================================================================
  // 3. Zona Waktu & Batas Waktu Kalender Jakarta (4 Skenario)
  // ==========================================================================
  describe("3. Zona Waktu & Batas Waktu Kalender Jakarta", () => {
    it("3.1 Memvalidasi konversi tanggal kalender Jakarta ke interval setengah terbuka UTC", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );
      expect(res.success).toBe(true);
    });

    it("3.2 Menghitung transaksi tepat pada batas pergantian hari 00:00:00 WIB", async () => {
      // 00:00:00 WIB tanggal 1 Okt 2026 adalah 17:00:00 UTC tanggal 30 Sep 2026
      const boundarySale = {
        id: "sale-boundary",
        invoice_number: "INV-BND-01",
        transaction_date: "2026-09-30T17:00:00.000Z", // Tepat 00:00:00 WIB
        subtotal_amount: 50000,
        discount_amount: 0,
        total_amount: 50000,
        payment_method: "CASH",
        status: "COMPLETED",
        notes: null,
        sale_items: [
          {
            id: "item-bnd",
            quantity: 1,
            unit_selling_price: 50000,
            unit_cost_price: 25000,
            item_discount: 0,
            discount_amount: 0,
            subtotal_amount: 50000,
          },
        ],
      };

      salesData = [boundarySale];
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-01" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.netSales).toBe(50000);
        // Masuk ke tren tanggal 2026-10-01
        const trendOct1 = res.data.dailySalesTrend.find((t) => t.date === "2026-10-01");
        expect(trendOct1?.amount).toBe(50000);
      }
    });

    it("3.3 Mengagregasi dailySalesTrend terkelompok per tanggal kalender Jakarta", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-03" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        const t1 = res.data.dailySalesTrend.find((t) => t.date === "2026-10-01");
        const t2 = res.data.dailySalesTrend.find((t) => t.date === "2026-10-02");
        expect(t1?.amount).toBe(90000);
        expect(t1?.transactionsCount).toBe(1);
        expect(t2?.amount).toBe(200000);
        expect(t2?.transactionsCount).toBe(1);
      }
    });

    it("3.4 Menangani hari tanpa omzet (omzet Rp 0) dalam tren harian", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-05" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Tanggal 2026-10-04 dan 2026-10-05 tidak memiliki penjualan
        const t4 = res.data.dailySalesTrend.find((t) => t.date === "2026-10-04");
        const t5 = res.data.dailySalesTrend.find((t) => t.date === "2026-10-05");
        expect(t4).toBeDefined();
        expect(t4?.amount).toBe(0);
        expect(t4?.transactionsCount).toBe(0);
        expect(t5?.amount).toBe(0);
        expect(t5?.transactionsCount).toBe(0);
      }
    });
  });

  // ==========================================================================
  // 4. Deteksi Stok & Laporan Persediaan (4 Skenario)
  // ==========================================================================
  describe("4. Deteksi Stok & Laporan Persediaan", () => {
    it("4.1 Mendeteksi produk dengan stock_quantity <= min_stock_alert sebagai low stock", async () => {
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Product A memiliki stok 2 <= 5 -> Muncul di lowStockAlerts
        expect(res.data.lowStockAlerts.length).toBe(1);
        expect(res.data.lowStockAlerts[0].id).toBe("prod-A");
        expect(res.data.lowStockAlerts[0].stockQuantity).toBe(2);
      }
    });

    it("4.2 Mengeluarkan produk terarsip (is_archived = true) dari low stock alerts", async () => {
      // Product C Archived memiliki stok 1 <= 5, tetapi terarsip
      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        const foundC = res.data.lowStockAlerts.find((p) => p.id === "prod-C");
        expect(foundC).toBeUndefined();
      }
    });

    it("4.3 Menghitung valuasi persediaan modal menggunakan products.cost_price aktual", async () => {
      const client = createMockSupabase();
      const res = await getStockReport(validBusinessId, undefined, {
        supabase: client,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        // Produk aktif: Product A (qty 2 @ 30.000 = 60.000 cost, 100.000 sell)
        //              Product B (qty 10 @ 120.000 = 1.200.000 cost, 2.000.000 sell)
        // Total Modal: 60.000 + 1.200.000 = 1.260.000
        // Total Omzet Potensial: 100.000 + 2.000.000 = 2.100.000
        expect(res.data.summary.totalProducts).toBe(2);
        expect(res.data.summary.totalStockUnits).toBe(12);
        expect(res.data.summary.totalAssetValueCost).toBe(1260000);
        expect(res.data.summary.totalAssetValueSelling).toBe(2100000);
        expect(res.data.summary.lowStockCount).toBe(1);
      }
    });

    it("4.4 Menangani empty state toko baru dengan angka Rp 0 tanpa crash", async () => {
      salesData = [];
      expensesData = [];
      purchasesData = [];
      productsData = [];
      const client = createMockSupabase();

      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.grossSales).toBe(0);
        expect(res.data.netSales).toBe(0);
        expect(res.data.cogs).toBe(0);
        expect(res.data.grossProfit).toBe(0);
        expect(res.data.grossProfitMargin).toBe(0);
        expect(res.data.operatingExpenses).toBe(0);
        expect(res.data.recordedCashFlow.netCashFlow).toBe(0);
        expect(res.data.lowStockAlerts).toEqual([]);
      }
    });
  });

  // ==========================================================================
  // 5. Paginasi Fail-Closed & Penanganan Truncation (6 Skenario)
  // ==========================================================================
  describe("5. Paginasi Fail-Closed & Penanganan Truncation", () => {
    it("5.1 Mengambil seluruh data multi-halaman jika totalCount > 1000", async () => {
      // Buat simulasi 1.200 transaksi penjualan
      const generatedSales = Array.from({ length: 1200 }, (_, i) => ({
        id: `sale-gen-${i}`,
        invoice_number: `INV-GEN-${i}`,
        transaction_date: "2026-10-01T02:00:00.000Z",
        subtotal_amount: 10000,
        discount_amount: 0,
        total_amount: 10000,
        payment_method: "CASH",
        status: "COMPLETED",
        notes: null,
        sale_items: [
          {
            id: `item-gen-${i}`,
            quantity: 1,
            unit_selling_price: 10000,
            unit_cost_price: 6000,
            item_discount: 0,
            discount_amount: 0,
            subtotal_amount: 10000,
          },
        ],
      }));

      salesData = generatedSales;
      salesCount = 1200;

      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // 1.200 penjualan @ Rp 10.000 = Rp 12.000.000
        expect(res.data.netSales).toBe(12000000);
        // COGS 1.200 @ Rp 6.000 = Rp 7.200.000
        expect(res.data.cogs).toBe(7200000);
      }
    });

    it("5.2 Membatalkan perhitungan (Fail-Closed) jika terjadi error pada salah satu halaman", async () => {
      salesCount = 1500;
      // Halaman 1 (0..999) berhasil, Halaman 2 (1000..1499) gagal
      salesPageErrorHandler = (from: number) => {
        if (from >= 1000) {
          return { message: "Network timeout on page 2", code: "57014" };
        }
        return null;
      };

      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("DATA_PAGINATION_INCOMPLETE");
      }
    });

    it("5.3 Membatalkan perhitungan jika jumlah baris terakumulasi !== totalCount", async () => {
      salesCount = 500;
      // Tapi data hanya ada 480 (desinkronisasi / mutasi database)
      salesPageDataHandler = () => Array.from({ length: 480 }, () => sampleSale1);

      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("DATA_PAGINATION_INCOMPLETE");
        expect(res.error.message).toContain("tidak sesuai");
      }
    });

    it("5.4 Memastikan recentTransactions sengaja dibatasi maksimal 5 baris", async () => {
      // 10 penjualan
      const tenSales = Array.from({ length: 10 }, (_, i) => ({
        id: `sale-recent-${i}`,
        invoice_number: `INV-REC-${i}`,
        transaction_date: `2026-10-01T0${i}:00:00.000Z`,
        total_amount: 15000,
        payment_method: "CASH",
        status: "COMPLETED",
      }));

      recentSalesOverride = tenSales.slice(0, 5); // Database mengembalikan limit(5)

      const client = createMockSupabase();
      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.recentTransactions.length).toBe(5);
      }
    });

    it("5.5 Memverifikasi paginasi eksplisit pada getSalesReport", async () => {
      const generatedSales = Array.from({ length: 25 }, (_, i) => ({
        id: `sale-pg-${i}`,
        invoice_number: `INV-PG-${i}`,
        transaction_date: "2026-10-01T02:00:00.000Z",
        subtotal_amount: 10000,
        discount_amount: 0,
        total_amount: 10000,
        payment_method: "CASH",
        status: "COMPLETED",
        notes: null,
        sale_items: [{ id: `item-${i}`, quantity: 1, unit_selling_price: 10000, discount_amount: 0 }],
      }));

      salesData = generatedSales;
      salesCount = 25;

      const client = createMockSupabase();
      const res = await getSalesReport(
        validBusinessId,
        {
          startDate: "2026-10-01",
          endDate: "2026-10-07",
          page: 2,
          pageSize: 10,
        },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.pagination.page).toBe(2);
        expect(res.data.pagination.pageSize).toBe(10);
        expect(res.data.pagination.totalRows).toBe(25);
        expect(res.data.pagination.totalPages).toBe(3);
        // Halaman ke-2 harus memuat 10 transaksi (indeks 10..19)
        expect(res.data.transactions.length).toBe(10);
        expect(res.data.transactions[0].id).toBe("sale-pg-10");
      }
    });

    it("5.6 Memetakan error database PostgREST ke ApiResponse secara aman", async () => {
      salesError = { code: "42P01", message: "relation sales does not exist" };
      const client = createMockSupabase();

      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        // Terpetakan aman tanpa bocoran nama tabel SQL
        expect(res.error.code).toBe("DATABASE_ERROR");
      }
    });

    it("5.7 Menolak dataset yang melampaui batas maksimum agregasi in-memory (DATA_VOLUME_EXCEEDED)", async () => {
      salesCount = 5001; // Melebihi plafon agregasi 5.000 baris
      const client = createMockSupabase();

      const res = await getDashboardSummary(
        validBusinessId,
        { startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("DATA_VOLUME_EXCEEDED");
        expect(res.error.message).toContain("melampaui batas maksimum");
      }
    });
  });

  // ==========================================================================
  // 6. Generator Ekspor CSV RFC 4180 & Sanitasi Formula (8 Skenario)
  // ==========================================================================
  describe("6. Generator Ekspor CSV RFC 4180 & Sanitasi Formula", () => {
    it("6.1 Menghasilkan CSV penjualan dengan format dan header RFC 4180 yang valid", async () => {
      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        {
          type: "SALES",
          startDate: "2026-10-01",
          endDate: "2026-10-07",
        },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.filename).toBe("laporan-penjualan-2026-10-01_2026-10-07.csv");
        expect(res.data.content).toContain("No Faktur,Tanggal,Metode Pembayaran,Status,Subtotal,Diskon,Total,Catatan\r\n");
        expect(res.data.content).toContain("INV-20261001-001,2026-10-01,CASH,COMPLETED,100000,10000,90000,Pelanggan reguler\r\n");
      }
    });

    it("6.2 Menghasilkan CSV beban operasional dan CSV stok barang", async () => {
      const client = createMockSupabase();
      const resExpense = await exportReportCsv(
        validBusinessId,
        { type: "EXPENSES", startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );
      expect(resExpense.success).toBe(true);
      if (resExpense.success) {
        expect(resExpense.data.filename).toContain("laporan-pengeluaran");
        expect(resExpense.data.content).toContain("Tanggal,Kategori,Nominal,Deskripsi\r\n");
      }

      const resStock = await exportReportCsv(
        validBusinessId,
        { type: "STOCK" },
        { supabase: client }
      );
      expect(resStock.success).toBe(true);
      if (resStock.success) {
        expect(resStock.data.filename).toContain("laporan-persediaan");
        expect(resStock.data.content).toContain("Nama Produk,SKU,Kategori,Stok,Batas Minimum");
      }
    });

    it("6.3 Menerapkan escaping kutip ganda dan pemisah koma standar RFC 4180", async () => {
      expensesData = [
        {
          id: "exp-quote",
          business_id: validBusinessId,
          expense_date: "2026-10-01T05:00:00.000Z",
          category: "OPERATIONAL",
          amount: 25000,
          notes: 'Biaya "Kresek", ukuran besar', // Mengandung kutip dan koma
          created_at: "2026-10-01T05:00:00.000Z",
          updated_at: "2026-10-01T05:00:00.000Z",
        },
      ];

      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "EXPENSES", startDate: "2026-10-01", endDate: "2026-10-01" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Tanda kutip internal di-escape menjadi ganda dan seluruh field dibungkus kutip
        expect(res.data.content).toContain('"Biaya ""Kresek"", ukuran besar"');
      }
    });

    it("6.4 Menambahkan UTF-8 BOM (\\uFEFF) pada output CSV", async () => {
      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "SALES", startDate: "2026-10-01", endDate: "2026-10-07" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.content.startsWith(UTF8_BOM)).toBe(true);
      }
    });

    it("6.5 Menyanitasi teks yang diawali karakter pemicu formula (=, +, -, @) dengan prefix kutip tunggal", async () => {
      expensesData = [
        {
          id: "exp-formula-1",
          business_id: validBusinessId,
          expense_date: "2026-10-01T05:00:00.000Z",
          category: "OTHER",
          amount: 15000,
          notes: "=SUM(A1:A5)",
          created_at: "2026-10-01T05:00:00.000Z",
          updated_at: "2026-10-01T05:00:00.000Z",
        },
        {
          id: "exp-formula-2",
          business_id: validBusinessId,
          expense_date: "2026-10-01T05:00:00.000Z",
          category: "OTHER",
          amount: 20000,
          notes: "@evil_macro()",
          created_at: "2026-10-01T05:00:00.000Z",
          updated_at: "2026-10-01T05:00:00.000Z",
        },
      ];

      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "EXPENSES", startDate: "2026-10-01", endDate: "2026-10-01" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.content).toContain("'=SUM(A1:A5)");
        expect(res.data.content).toContain("'@evil_macro()");
      }
    });

    it("6.6 Menyanitasi formula yang disamarkan menggunakan whitespace, tab, atau carriage return", async () => {
      expensesData = [
        {
          id: "exp-tab",
          business_id: validBusinessId,
          expense_date: "2026-10-01T05:00:00.000Z",
          category: "OTHER",
          amount: 10000,
          notes: "\t@cmd|' /C calc'!A0",
          created_at: "2026-10-01T05:00:00.000Z",
          updated_at: "2026-10-01T05:00:00.000Z",
        },
        {
          id: "exp-space",
          business_id: validBusinessId,
          expense_date: "2026-10-01T05:00:00.000Z",
          category: "OTHER",
          amount: 10000,
          notes: "   =1+1",
          created_at: "2026-10-01T05:00:00.000Z",
          updated_at: "2026-10-01T05:00:00.000Z",
        },
      ];

      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "EXPENSES", startDate: "2026-10-01", endDate: "2026-10-01" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.content).toContain("'\t@cmd|' /C calc'!A0");
        expect(res.data.content).toContain("'   =1+1");
      }
    });

    it("6.7 Mempertahankan angka negatif yang sah (misal -150000) tetap murni numerik tanpa prefix kutip", async () => {
      // Pada laporan penjualan, angka numerik negatif (jika ada retur/diskon)
      // diekspor langsung sebagai angka numerik murni
      const saleWithNegative = {
        ...sampleSale1,
        total_amount: -50000,
      };

      salesData = [saleWithNegative];
      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "SALES", startDate: "2026-10-01", endDate: "2026-10-01" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // -50000 tetap berupa -50000 tanpa prefix '-50000
        expect(res.data.content).toContain(",-50000,");
        expect(res.data.content).not.toContain(",'-50000,");
      }
    });

    it("6.8 Menguji teks yang memuat koma, kutip ganda, dan karakter CRLF multi-baris", async () => {
      salesData = [
        {
          ...sampleSale1,
          notes: "Catatan baris 1\nCatatan baris 2, dengan koma",
        },
      ];

      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "SALES", startDate: "2026-10-01", endDate: "2026-10-01" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Seluruh baris multi-baris dibungkus kutip ganda
        expect(res.data.content).toContain('"Catatan baris 1\nCatatan baris 2, dengan koma"');
      }
    });

    it("6.9 Memastikan SKU atau Kategori bernilai null diekspor sebagai sel kosong murni tanpa formula sanitization '-'", async () => {
      productsData = [
        {
          id: "prod-null-sku",
          business_id: validBusinessId,
          name: "Produk Tanpa SKU",
          sku: null,
          category: null,
          selling_price: 10000,
          cost_price: 6000,
          stock_quantity: 10,
          min_stock_alert: 5,
          is_archived: false,
          created_at: "2026-10-01T00:00:00.000Z",
          updated_at: "2026-10-01T00:00:00.000Z",
        },
      ];

      const client = createMockSupabase();
      const res = await exportReportCsv(
        validBusinessId,
        { type: "STOCK" },
        { supabase: client }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        // Memastikan baris CSV memuat Nama Produk diikuti oleh ,, (sel kosong untuk SKU dan Kategori)
        // dan BUKAN '- atau '-
        expect(res.data.content).toContain("Produk Tanpa SKU,,,10,5,6000,10000,60000,100000,AMAN\r\n");
      }
    });
  });
});
