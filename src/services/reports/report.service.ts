/**
 * VeyraOS Reports & Financial Analytics Service Layer
 *
 * Sesuai spesifikasi Phase 4, Substage 3.2.3:
 * - Terpisah dari UI dan Server Actions.
 * - Menggunakan Supabase server client resmi.
 * - Memeriksa otorisasi sesi pengguna & keanggotaan bisnis di sisi server (Defense-in-Depth).
 * - Tidak mempercayai businessId dari klien tanpa verifikasi server.
 * - Menjaga isolasi multi-tenant pada seluruh operasi baca (business_id).
 * - Invarian Finansial:
 *   - Gross Sales = sum(sale_items.quantity * sale_items.unit_selling_price) untuk COMPLETED
 *   - Total Discounts = sum(sale_items.discount_amount) (anti-double-counting)
 *   - Net Sales = Gross Sales - Total Discounts = sum(sales.total_amount) untuk COMPLETED
 *   - COGS = sum(sale_items.quantity * sale_items.unit_cost_price)
 *   - Transaksi VOIDED dikeluarkan dari omzet, diskon, HPP, laba, dan kas masuk
 *   - Beban Operasional = sum(expenses.amount)
 *   - Pembelian Stok (inventory_purchases) TIDAK masuk ke beban operasional maupun COGS saat dibeli
 *   - Kas Masuk = Penjualan COMPLETED (CASH + BANK_TRANSFER)
 *   - Kas Keluar = Beban Operasional + Pembelian Stok
 *   - Valuasi Stok = stock_quantity * cost_price (MWAC aktif)
 * - Paginasi Fail-Closed: Seluruh data agregasi diambil lengkap. Jika terjadi error halaman
 *   atau baris terakumulasi !== totalCount, batalkan perhitungan seketika (DATA_PAGINATION_INCOMPLETE).
 * - Zona Waktu: Interval setengah terbuka [startUtc, nextDayUtc) berbasis Asia/Jakarta (UTC+7).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  dashboardQuerySchema,
  salesReportQuerySchema,
  expenseReportQuerySchema,
  stockReportQuerySchema,
  exportReportQuerySchema,
} from "@/lib/validations/report";
import {
  mapDatabaseErrorToApiResponse,
  formatZodErrorDetails,
} from "@/services/transactions/error-mapper";
import { verifyUserAndBusinessMembership } from "@/services/common/auth-guard";
import {
  calculateGrossProfit,
  calculateGrossProfitMargin,
  calculateOperatingProfit,
  calculateNetCashFlow,
  formatJakartaDate,
  parseJakartaDateBoundary,
  safeBigIntToNumber,
  safeNumberToBigInt,
} from "@/lib/financial";
import { buildCsvDocument } from "@/lib/csv";
import type {
  ApiResponse,
  DashboardQueryParams,
  DashboardSummaryResponseData,
  GetSalesReportQuery,
  SalesReportResponseData,
  SalesReportTransactionItem,
  GetExpenseReportQuery,
  ExpenseReportResponseData,
  ExpenseReportCategorySummary,
  ExpenseReportItem,
  GetStockReportQuery,
  StockReportResponseData,
  StockReportItem,
  LowStockItem,
  DailySalesTrendItem,
  CashFlowSummary,
  ExportReportInput,
  ReportCsvResult,
  SaleSummaryItem,
} from "@/types/api";
import type { ExpenseCategory, PaymentMethod, SaleStatus } from "@/types/database";

export interface ReportServiceOptions {
  /**
   * Klien Supabase opsional untuk Dependency Injection / Unit Testing dengan Mock.
   * Jika tidak disediakan, memanggil createClient() dari @/lib/supabase/server.
   */
  supabase?: SupabaseClient;

  /**
   * User ID opsional untuk pengujian mock terisolasi.
   */
  userId?: string;

  /**
   * Tanggal referensi opsional untuk pengujian batas waktu (default: new Date()).
   */
  referenceDate?: Date;
}

// ============================================================================
// Internal Database Row Interfaces
// ============================================================================

interface SaleItemDatabaseRow {
  id: string;
  quantity: number;
  unit_selling_price: number | string;
  unit_cost_price: number | string;
  item_discount: number | string;
  discount_amount: number | string;
  subtotal_amount: number | string;
}

interface SaleWithItemsRow {
  id: string;
  invoice_number: string;
  transaction_date: string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  payment_method: PaymentMethod;
  status: SaleStatus;
  notes: string | null;
  sale_items?: SaleItemDatabaseRow[] | null;
}

interface ExpenseDatabaseRow {
  id: string;
  business_id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InventoryPurchaseDatabaseRow {
  id: string;
  purchase_date: string;
  total_cost: number | string;
}

interface ProductDatabaseRow {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number;
  min_stock_alert: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Fail-Closed Comprehensive Pagination Helper
// ============================================================================

interface PaginatedFetchResult {
  data: unknown;
  error: unknown;
  count: number | null;
}

type PageFetcher = (from: number, to: number) => PromiseLike<PaginatedFetchResult>;

/**
 * Batas maksimum baris data agregasi in-memory Node.js (MVP ceiling).
 * Mencegah konsumsi memori berlebih dan timeout serverless pada volume data besar.
 */
const MAX_PAGINATION_RECORDS = 5000;

/**
 * Mengambil seluruh data multi-halaman dengan jaminan integritas Fail-Closed.
 * Jika terjadi error jaringan pada salah satu halaman, atau jika akumulasi baris !== count,
 * hentikan proses dan gagalkan perhitungan dengan kode DATA_PAGINATION_INCOMPLETE.
 */
async function fetchCompleteDataset<T>(
  fetchPage: PageFetcher,
  pageSize: number = 1000
): Promise<
  | { success: true; data: T[] }
  | { success: false; errorCode: string; message: string; rawError?: unknown }
> {
  const firstPage = await fetchPage(0, pageSize - 1);
  if (firstPage.error) {
    return {
      success: false,
      errorCode: "DATABASE_ERROR",
      message: "Gagal mengambil data dari database",
      rawError: firstPage.error,
    };
  }

  if (firstPage.count === null || firstPage.count === undefined) {
    return {
      success: false,
      errorCode: "DATA_PAGINATION_INCOMPLETE",
      message: "Gagal memverifikasi jumlah baris database yang diharapkan",
    };
  }

  const expectedTotal = firstPage.count;
  if (expectedTotal === 0) {
    return { success: true, data: [] };
  }

  // Pengaman volume: Gagalkan jika volume dataset melampaui batas agregasi in-memory
  if (expectedTotal > MAX_PAGINATION_RECORDS) {
    return {
      success: false,
      errorCode: "DATA_VOLUME_EXCEEDED",
      message: `Jumlah data transaksi (${expectedTotal}) melampaui batas maksimum agregasi in-memory (${MAX_PAGINATION_RECORDS} baris). Silakan persempit rentang tanggal pelaporan atau gunakan Stored Procedure RPC database.`,
    };
  }

  const accumulated: T[] = [...((firstPage.data as T[] | null) ?? [])];

  while (accumulated.length < expectedTotal) {
    const from = accumulated.length;
    const to = from + pageSize - 1;

    const nextPage = await fetchPage(from, to);
    if (nextPage.error) {
      return {
        success: false,
        errorCode: "DATA_PAGINATION_INCOMPLETE",
        message: "Gagal mengambil halaman berikutnya selama agregasi finansial",
        rawError: nextPage.error,
      };
    }

    const pageRows = (nextPage.data as T[] | null) ?? [];
    if (pageRows.length === 0) {
      break;
    }

    accumulated.push(...pageRows);
  }

  // Jaminan Fail-Closed: data terakumulasi wajib persis sama dengan total baris
  if (accumulated.length !== expectedTotal) {
    return {
      success: false,
      errorCode: "DATA_PAGINATION_INCOMPLETE",
      message: `Integritas data paginasi gagal: baris terakumulasi (${accumulated.length}) tidak sesuai dengan total baris database (${expectedTotal})`,
    };
  }

  return { success: true, data: accumulated };
}

// ============================================================================
// 1. getDashboardSummary
// ============================================================================

export async function getDashboardSummary(
  businessId: string,
  params?: DashboardQueryParams,
  options?: ReportServiceOptions
): Promise<ApiResponse<DashboardSummaryResponseData>> {
  // 1. Validasi Input Zod
  const validationResult = dashboardQuerySchema.safeParse({
    businessId,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri ringkasan dashboard tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Autentikasi & Verifikasi Keanggotaan Bisnis (Defense-in-Depth)
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response;
  }

  // 3. Penyelesaian Rentang Tanggal Asia/Jakarta (Interval Setengah Terbuka)
  let dateRange;
  try {
    dateRange = parseJakartaDateBoundary(
      validated.startDate,
      validated.endDate,
      30,
      options?.referenceDate
    );
  } catch (err) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Rentang tanggal tidak valid",
      },
    };
  }

  const { startUtc, nextDayUtc } = dateRange;

  try {
    // 4. Pengambilan Data Lengkap (Fail-Closed Pagination)
    // 4.1 Penjualan beserta item
    const salesResult = await fetchCompleteDataset<SaleWithItemsRow>((from, to) =>
      supabase
        .from("sales")
        .select(
          "id, invoice_number, transaction_date, subtotal_amount, discount_amount, total_amount, payment_method, status, notes, sale_items(id, quantity, unit_selling_price, unit_cost_price, item_discount, discount_amount, subtotal_amount)",
          { count: "exact" }
        )
        .eq("business_id", businessId)
        .gte("transaction_date", startUtc)
        .lt("transaction_date", nextDayUtc)
        .order("transaction_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (!salesResult.success) {
      if (salesResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: salesResult.errorCode,
            message: salesResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(salesResult.rawError);
    }

    // 4.2 Beban Operasional
    const expensesResult = await fetchCompleteDataset<ExpenseDatabaseRow>((from, to) =>
      supabase
        .from("expenses")
        .select("id, business_id, expense_date, category, amount, notes, created_at, updated_at", { count: "exact" })
        .eq("business_id", businessId)
        .gte("expense_date", startUtc)
        .lt("expense_date", nextDayUtc)
        .order("expense_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (!expensesResult.success) {
      if (expensesResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: expensesResult.errorCode,
            message: expensesResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(expensesResult.rawError);
    }

    // 4.3 Pembelian Stok (Hanya untuk Arus Kas Keluar)
    const purchasesResult = await fetchCompleteDataset<InventoryPurchaseDatabaseRow>((from, to) =>
      supabase
        .from("inventory_purchases")
        .select("id, purchase_date, total_cost", { count: "exact" })
        .eq("business_id", businessId)
        .gte("purchase_date", startUtc)
        .lt("purchase_date", nextDayUtc)
        .order("purchase_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (!purchasesResult.success) {
      if (purchasesResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: purchasesResult.errorCode,
            message: purchasesResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(purchasesResult.rawError);
    }

    // 4.4 Master Produk untuk Deteksi Stok Menipis (Hanya Produk Aktif)
    const productsResult = await fetchCompleteDataset<ProductDatabaseRow>((from, to) =>
      supabase
        .from("products")
        .select(
          "id, business_id, name, sku, category, selling_price, cost_price, stock_quantity, min_stock_alert, is_archived, created_at, updated_at",
          { count: "exact" }
        )
        .eq("business_id", businessId)
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (!productsResult.success) {
      if (productsResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: productsResult.errorCode,
            message: productsResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(productsResult.rawError);
    }

    // 4.5 Kueri Terpisah: Lima Transaksi Terbaru Toko (Sengaja Dibatasi 5 Baris)
    const { data: recentSalesRows, error: recentSalesError } = await supabase
      .from("sales")
      .select("id, invoice_number, transaction_date, total_amount, payment_method, status")
      .eq("business_id", businessId)
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: true })
      .limit(5);

    if (recentSalesError) {
      return mapDatabaseErrorToApiResponse(recentSalesError);
    }

    const recentTransactions: SaleSummaryItem[] = (recentSalesRows ?? []).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      transactionDate: row.transaction_date,
      totalAmount: Number(row.total_amount),
      paymentMethod: row.payment_method,
      status: row.status,
    }));

    // 5. Agregasi Finansial Presisi (BigInt Arithmetic)
    const allSales = salesResult.data;
    const completedSales = allSales.filter((s) => s.status === "COMPLETED");

    let bigGrossSales = BigInt(0);
    let bigTotalDiscounts = BigInt(0);
    let bigNetSales = BigInt(0);
    let bigCogs = BigInt(0);
    let bigInflowsCash = BigInt(0);
    let bigInflowsBank = BigInt(0);

    for (const sale of completedSales) {
      const saleTotal = safeNumberToBigInt(Number(sale.total_amount), "sale total amount");
      bigNetSales += saleTotal;

      if (sale.payment_method === "CASH") {
        bigInflowsCash += saleTotal;
      } else if (sale.payment_method === "BANK_TRANSFER") {
        bigInflowsBank += saleTotal;
      }

      if (sale.sale_items && Array.isArray(sale.sale_items)) {
        for (const item of sale.sale_items) {
          const qty = BigInt(item.quantity);
          const unitSelling = safeNumberToBigInt(Number(item.unit_selling_price), "unit selling price");
          const unitCost = safeNumberToBigInt(Number(item.unit_cost_price), "unit cost price");
          const discount = safeNumberToBigInt(Number(item.discount_amount), "item discount amount");

          bigGrossSales += qty * unitSelling;
          bigTotalDiscounts += discount;
          bigCogs += qty * unitCost;
        }
      }
    }

    const grossSales = safeBigIntToNumber(bigGrossSales, "Gross Sales");
    const totalDiscounts = safeBigIntToNumber(bigTotalDiscounts, "Total Discounts");
    const netSales = safeBigIntToNumber(bigNetSales, "Net Sales");
    const cogs = safeBigIntToNumber(bigCogs, "COGS");

    const grossProfit = calculateGrossProfit(netSales, cogs);
    const grossProfitMargin = calculateGrossProfitMargin(grossProfit, netSales);

    // Beban Operasional
    let bigOperatingExpenses = BigInt(0);
    for (const exp of expensesResult.data) {
      bigOperatingExpenses += safeNumberToBigInt(Number(exp.amount), "expense amount");
    }
    const operatingExpenses = safeBigIntToNumber(bigOperatingExpenses, "Operating Expenses");
    const operatingProfit = calculateOperatingProfit(grossProfit, operatingExpenses);

    // Arus Kas
    const cashInflows = safeBigIntToNumber(bigNetSales, "Cash Inflows");
    const cashInflowsCash = safeBigIntToNumber(bigInflowsCash, "Cash Inflows (Cash)");
    const cashInflowsBank = safeBigIntToNumber(bigInflowsBank, "Cash Inflows (Bank)");

    let bigPurchasesCost = BigInt(0);
    for (const p of purchasesResult.data) {
      bigPurchasesCost += safeNumberToBigInt(Number(p.total_cost), "purchase cost");
    }
    const cashOutflowsPurchases = safeBigIntToNumber(bigPurchasesCost, "Purchases Cash Outflows");
    const cashOutflowsExpenses = operatingExpenses;
    const cashOutflows = cashOutflowsExpenses + cashOutflowsPurchases;
    const netCashFlow = calculateNetCashFlow(cashInflows, cashOutflows);

    const recordedCashFlow: CashFlowSummary = {
      cashInflows,
      cashInflowsCash,
      cashInflowsBank,
      cashOutflows,
      cashOutflowsExpenses,
      cashOutflowsPurchases,
      netCashFlow,
    };

    // 6. Tren Penjualan Harian Kalender Jakarta (Menangani hari omzet Rp 0)
    const trendMap = new Map<string, { amount: number; transactionsCount: number }>();

    // Buat entri untuk setiap hari dari startDate hingga endDate
    const [sy, sm, sd] = dateRange.startDate.split("-").map(Number);
    const [ey, em, ed] = dateRange.endDate.split("-").map(Number);
    let currDate = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));
    const endDateObj = new Date(Date.UTC(ey, em - 1, ed, 0, 0, 0));

    while (currDate <= endDateObj) {
      const y = currDate.getUTCFullYear();
      const m = String(currDate.getUTCMonth() + 1).padStart(2, "0");
      const d = String(currDate.getUTCDate()).padStart(2, "0");
      trendMap.set(`${y}-${m}-${d}`, { amount: 0, transactionsCount: 0 });
      currDate = new Date(currDate.getTime() + 24 * 60 * 60 * 1000);
    }

    for (const sale of completedSales) {
      const dateKey = formatJakartaDate(sale.transaction_date);
      const entry = trendMap.get(dateKey);
      if (entry) {
        entry.amount += Number(sale.total_amount);
        entry.transactionsCount += 1;
      } else {
        trendMap.set(dateKey, { amount: Number(sale.total_amount), transactionsCount: 1 });
      }
    }

    const dailySalesTrend: DailySalesTrendItem[] = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        transactionsCount: data.transactionsCount,
      }));

    // 7. Peringatan Stok Menipis (Produk aktif dengan stock_quantity <= min_stock_alert)
    const lowStockAlerts: LowStockItem[] = productsResult.data
      .filter((p) => !p.is_archived && p.stock_quantity <= (p.min_stock_alert ?? 5))
      .sort((a, b) => a.stock_quantity - b.stock_quantity)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        stockQuantity: p.stock_quantity,
        minStockAlert: p.min_stock_alert ?? 5,
      }));

    return {
      success: true,
      data: {
        grossSales,
        totalDiscounts,
        netSales,
        cogs,
        grossProfit,
        grossProfitMargin,
        operatingExpenses,
        operatingProfit,
        recordedCashFlow,
        recentTransactions,
        lowStockAlerts,
        dailySalesTrend,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat menyusun ringkasan dashboard",
      },
    };
  }
}

// ============================================================================
// 2. getSalesReport
// ============================================================================

export async function getSalesReport(
  businessId: string,
  query?: GetSalesReportQuery,
  options?: ReportServiceOptions
): Promise<ApiResponse<SalesReportResponseData>> {
  // 1. Validasi Input Zod
  const validationResult = salesReportQuerySchema.safeParse({
    businessId,
    startDate: query?.startDate,
    endDate: query?.endDate,
    page: query?.page,
    pageSize: query?.pageSize,
    status: query?.status,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri laporan penjualan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Autentikasi & Verifikasi Keanggotaan Bisnis
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response;
  }

  // 3. Penyelesaian Rentang Tanggal Asia/Jakarta
  let dateRange;
  try {
    dateRange = parseJakartaDateBoundary(
      validated.startDate,
      validated.endDate,
      30,
      options?.referenceDate
    );
  } catch (err) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Rentang tanggal tidak valid",
      },
    };
  }

  const { startUtc, nextDayUtc } = dateRange;

  try {
    // 4. Ambil seluruh transaksi dalam jendela tanggal secara fail-closed
    let baseQuery = supabase
      .from("sales")
      .select(
        "id, invoice_number, transaction_date, subtotal_amount, discount_amount, total_amount, payment_method, status, notes, sale_items(id, quantity, unit_selling_price, discount_amount)",
        { count: "exact" }
      )
      .eq("business_id", businessId)
      .gte("transaction_date", startUtc)
      .lt("transaction_date", nextDayUtc)
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: true });

    if (validated.status) {
      baseQuery = baseQuery.eq("status", validated.status);
    }

    const salesResult = await fetchCompleteDataset<SaleWithItemsRow>((from, to) =>
      baseQuery.range(from, to)
    );

    if (!salesResult.success) {
      if (salesResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: salesResult.errorCode,
            message: salesResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(salesResult.rawError);
    }

    const allSales = salesResult.data;
    const completedSales = allSales.filter((s) => s.status === "COMPLETED");
    const voidedSales = allSales.filter((s) => s.status === "VOIDED");

    // Hitung ringkasan penjualan (summary)
    let bigGross = BigInt(0);
    let bigDiscounts = BigInt(0);
    let bigNet = BigInt(0);

    for (const sale of completedSales) {
      bigNet += safeNumberToBigInt(Number(sale.total_amount));
      if (sale.sale_items && Array.isArray(sale.sale_items)) {
        for (const item of sale.sale_items) {
          const qty = BigInt(item.quantity);
          const price = safeNumberToBigInt(Number(item.unit_selling_price));
          const disc = safeNumberToBigInt(Number(item.discount_amount));
          bigGross += qty * price;
          bigDiscounts += disc;
        }
      }
    }

    const grossSales = safeBigIntToNumber(bigGross, "Gross Sales");
    const totalDiscounts = safeBigIntToNumber(bigDiscounts, "Total Discounts");
    const netSales = safeBigIntToNumber(bigNet, "Net Sales");

    // Paginasi eksplisit
    const page = validated.page;
    const pageSize = validated.pageSize;
    const totalRows = allSales.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    const offset = (page - 1) * pageSize;
    const paginatedSlice = allSales.slice(offset, offset + pageSize);

    const transactions: SalesReportTransactionItem[] = paginatedSlice.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      transactionDate: sale.transaction_date,
      subtotalAmount: Number(sale.subtotal_amount),
      discountAmount: Number(sale.discount_amount),
      totalAmount: Number(sale.total_amount),
      paymentMethod: sale.payment_method,
      status: sale.status,
      itemsCount: sale.sale_items?.length ?? 0,
    }));

    return {
      success: true,
      data: {
        period: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        pagination: {
          page,
          pageSize,
          totalRows,
          totalPages,
        },
        summary: {
          totalTransactions: allSales.length,
          completedTransactions: completedSales.length,
          voidedTransactions: voidedSales.length,
          grossSales,
          totalDiscounts,
          netSales,
        },
        transactions,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Terjadi kendala saat menyusun laporan penjualan",
      },
    };
  }
}

// ============================================================================
// 3. getExpenseReport
// ============================================================================

export async function getExpenseReport(
  businessId: string,
  query?: GetExpenseReportQuery,
  options?: ReportServiceOptions
): Promise<ApiResponse<ExpenseReportResponseData>> {
  // 1. Validasi Input Zod
  const validationResult = expenseReportQuerySchema.safeParse({
    businessId,
    startDate: query?.startDate,
    endDate: query?.endDate,
    category: query?.category,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri laporan beban tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Autentikasi & Verifikasi Keanggotaan Bisnis
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response;
  }

  // 3. Penyelesaian Rentang Tanggal Asia/Jakarta
  let dateRange;
  try {
    dateRange = parseJakartaDateBoundary(
      validated.startDate,
      validated.endDate,
      30,
      options?.referenceDate
    );
  } catch (err) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Rentang tanggal tidak valid",
      },
    };
  }

  const { startUtc, nextDayUtc } = dateRange;

  try {
    let baseQuery = supabase
      .from("expenses")
      .select("id, business_id, expense_date, category, amount, notes, created_at, updated_at", { count: "exact" })
      .eq("business_id", businessId)
      .gte("expense_date", startUtc)
      .lt("expense_date", nextDayUtc)
      .order("expense_date", { ascending: false })
      .order("id", { ascending: true });

    if (validated.category) {
      baseQuery = baseQuery.eq("category", validated.category);
    }

    const expensesResult = await fetchCompleteDataset<ExpenseDatabaseRow>((from, to) =>
      baseQuery.range(from, to)
    );

    if (!expensesResult.success) {
      if (expensesResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: expensesResult.errorCode,
            message: expensesResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(expensesResult.rawError);
    }

    const allExpenses = expensesResult.data;

    let bigTotal = BigInt(0);
    const categoryMap = new Map<ExpenseCategory, { total: bigint; count: number }>();

    for (const exp of allExpenses) {
      const amt = safeNumberToBigInt(Number(exp.amount));
      bigTotal += amt;

      const current = categoryMap.get(exp.category) ?? { total: BigInt(0), count: 0 };
      current.total += amt;
      current.count += 1;
      categoryMap.set(exp.category, current);
    }

    const totalExpenses = safeBigIntToNumber(bigTotal, "Total Expenses");

    const byCategory: ExpenseReportCategorySummary[] = Array.from(categoryMap.entries())
      .map(([cat, val]) => {
        const catTotal = safeBigIntToNumber(val.total, `Category ${cat}`);
        const percentage =
          totalExpenses > 0
            ? Math.round((catTotal / totalExpenses) * 10000) / 100
            : 0;
        return {
          category: cat,
          totalAmount: catTotal,
          count: val.count,
          percentage,
        };
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const expenses: ExpenseReportItem[] = allExpenses.map((exp) => ({
      id: exp.id,
      expenseDate: exp.expense_date,
      category: exp.category,
      amount: Number(exp.amount),
      description: exp.notes ?? "",
    }));

    return {
      success: true,
      data: {
        period: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        totalExpenses,
        byCategory,
        expenses,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Terjadi kendala saat menyusun laporan beban operasional",
      },
    };
  }
}

// ============================================================================
// 4. getStockReport
// ============================================================================

export async function getStockReport(
  businessId: string,
  query?: GetStockReportQuery,
  options?: ReportServiceOptions
): Promise<ApiResponse<StockReportResponseData>> {
  // 1. Validasi Input Zod
  const validationResult = stockReportQuerySchema.safeParse({
    businessId,
    category: query?.category,
    lowStockOnly: query?.lowStockOnly,
    isArchived: query?.isArchived,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri laporan stok tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Autentikasi & Verifikasi Keanggotaan Bisnis
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response;
  }

  try {
    let baseQuery = supabase
      .from("products")
      .select(
        "id, business_id, name, sku, category, selling_price, cost_price, stock_quantity, min_stock_alert, is_archived, created_at, updated_at",
        { count: "exact" }
      )
      .eq("business_id", businessId)
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    if (validated.category) {
      baseQuery = baseQuery.eq("category", validated.category);
    }

    if (validated.isArchived !== undefined) {
      baseQuery = baseQuery.eq("is_archived", validated.isArchived);
    } else {
      // Default: Hanya produk aktif jika tidak ditentukan
      baseQuery = baseQuery.eq("is_archived", false);
    }

    const productsResult = await fetchCompleteDataset<ProductDatabaseRow>((from, to) =>
      baseQuery.range(from, to)
    );

    if (!productsResult.success) {
      if (productsResult.errorCode !== "DATABASE_ERROR") {
        return {
          success: false,
          error: {
            code: productsResult.errorCode,
            message: productsResult.message,
          },
        };
      }
      return mapDatabaseErrorToApiResponse(productsResult.rawError);
    }

    let products = productsResult.data;

    if (validated.isArchived !== undefined) {
      products = products.filter((p) => p.is_archived === validated.isArchived);
    } else {
      products = products.filter((p) => !p.is_archived);
    }

    if (validated.lowStockOnly) {

      products = products.filter((p) => p.stock_quantity <= (p.min_stock_alert ?? 5));
    }

    let bigTotalUnits = BigInt(0);
    let bigTotalAssetCost = BigInt(0);
    let bigTotalAssetSelling = BigInt(0);
    let lowStockCount = 0;

    const items: StockReportItem[] = products.map((p) => {
      const stockQty = p.stock_quantity;
      const minAlert = p.min_stock_alert ?? 5;
      const costPrice = Number(p.cost_price);
      const sellingPrice = Number(p.selling_price);

      const bigQty = BigInt(stockQty);
      const bigCost = safeNumberToBigInt(costPrice);
      const bigSelling = safeNumberToBigInt(sellingPrice);

      const assetValueCost = safeBigIntToNumber(bigQty * bigCost);
      const assetValueSelling = safeBigIntToNumber(bigQty * bigSelling);
      const isLowStock = stockQty <= minAlert;

      bigTotalUnits += bigQty;
      bigTotalAssetCost += bigQty * bigCost;
      bigTotalAssetSelling += bigQty * bigSelling;

      if (isLowStock) {
        lowStockCount += 1;
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        stockQuantity: stockQty,
        minStockAlert: minAlert,
        costPrice,
        sellingPrice,
        assetValueCost,
        assetValueSelling,
        isLowStock,
        isArchived: p.is_archived,
      };
    });

    const summary = {
      totalProducts: items.length,
      totalStockUnits: safeBigIntToNumber(bigTotalUnits, "Total Stock Units"),
      totalAssetValueCost: safeBigIntToNumber(bigTotalAssetCost, "Total Asset Cost"),
      totalAssetValueSelling: safeBigIntToNumber(bigTotalAssetSelling, "Total Asset Selling"),
      lowStockCount,
    };

    return {
      success: true,
      data: {
        summary,
        items,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Terjadi kendala saat menyusun laporan stok",
      },
    };
  }
}

// ============================================================================
// 5. exportReportCsv
// ============================================================================

export async function exportReportCsv(
  businessId: string,
  input: ExportReportInput,
  options?: ReportServiceOptions
): Promise<ApiResponse<ReportCsvResult>> {
  // 1. Validasi Input Zod
  const validationResult = exportReportQuerySchema.safeParse({
    businessId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter permintaan ekspor laporan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Autentikasi & Verifikasi Keanggotaan Bisnis
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response;
  }

  // 3. Penyelesaian Rentang Tanggal Asia/Jakarta
  let dateRange;
  try {
    dateRange = parseJakartaDateBoundary(
      validated.startDate,
      validated.endDate,
      30,
      options?.referenceDate
    );
  } catch (err) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Rentang tanggal tidak valid",
      },
    };
  }

  const { startUtc, nextDayUtc, startDate, endDate } = dateRange;

  try {
    let headers: string[] = [];
    let rows: Array<Array<string | number | boolean | null | undefined>> = [];
    let filename = "";

    switch (validated.type) {
      case "SALES": {
        filename = `laporan-penjualan-${startDate}_${endDate}.csv`;
        headers = [
          "No Faktur",
          "Tanggal",
          "Metode Pembayaran",
          "Status",
          "Subtotal",
          "Diskon",
          "Total",
          "Catatan",
        ];

        const salesResult = await fetchCompleteDataset<SaleWithItemsRow>((from, to) =>
          supabase
            .from("sales")
            .select(
              "id, invoice_number, transaction_date, subtotal_amount, discount_amount, total_amount, payment_method, status, notes",
              { count: "exact" }
            )
            .eq("business_id", businessId)
            .gte("transaction_date", startUtc)
            .lt("transaction_date", nextDayUtc)
            .order("transaction_date", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to)
        );

        if (!salesResult.success) {
          if (salesResult.errorCode !== "DATABASE_ERROR") {
            return {
              success: false,
              error: {
                code: salesResult.errorCode,
                message: salesResult.message,
              },
            };
          }
          return mapDatabaseErrorToApiResponse(salesResult.rawError);
        }

        rows = salesResult.data.map((sale) => [
          sale.invoice_number,
          formatJakartaDate(sale.transaction_date),
          sale.payment_method,
          sale.status,
          Number(sale.subtotal_amount),
          Number(sale.discount_amount),
          Number(sale.total_amount),
          sale.notes ?? "",
        ]);
        break;
      }

      case "EXPENSES": {
        filename = `laporan-pengeluaran-${startDate}_${endDate}.csv`;
        headers = ["Tanggal", "Kategori", "Nominal", "Deskripsi"];

        const expensesResult = await fetchCompleteDataset<ExpenseDatabaseRow>((from, to) =>
          supabase
            .from("expenses")
            .select(
              "id, business_id, expense_date, category, amount, notes, created_at, updated_at",
              { count: "exact" }
            )
            .eq("business_id", businessId)
            .gte("expense_date", startUtc)
            .lt("expense_date", nextDayUtc)
            .order("expense_date", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to)
        );

        if (!expensesResult.success) {
          if (expensesResult.errorCode !== "DATABASE_ERROR") {
            return {
              success: false,
              error: {
                code: expensesResult.errorCode,
                message: expensesResult.message,
              },
            };
          }
          return mapDatabaseErrorToApiResponse(expensesResult.rawError);
        }

        rows = expensesResult.data.map((exp) => [
          formatJakartaDate(exp.expense_date),
          exp.category,
          Number(exp.amount),
          exp.notes ?? "",
        ]);
        break;
      }

      case "STOCK": {
        filename = `laporan-persediaan-${endDate}.csv`;
        headers = [
          "Nama Produk",
          "SKU",
          "Kategori",
          "Stok",
          "Batas Minimum",
          "Harga Beli (HPP)",
          "Harga Jual",
          "Nilai Aset Modal",
          "Potensi Omzet",
          "Status Stok",
        ];

        const productsResult = await fetchCompleteDataset<ProductDatabaseRow>((from, to) =>
          supabase
            .from("products")
            .select(
              "id, business_id, name, sku, category, selling_price, cost_price, stock_quantity, min_stock_alert, is_archived, created_at, updated_at",
              { count: "exact" }
            )
            .eq("business_id", businessId)
            .eq("is_archived", false)
            .order("name", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
        );


        if (!productsResult.success) {
          if (productsResult.errorCode !== "DATABASE_ERROR") {
            return {
              success: false,
              error: {
                code: productsResult.errorCode,
                message: productsResult.message,
              },
            };
          }
          return mapDatabaseErrorToApiResponse(productsResult.rawError);
        }

        rows = productsResult.data.map((p) => {
          const qty = p.stock_quantity;
          const cost = Number(p.cost_price);
          const sell = Number(p.selling_price);
          const minAlert = p.min_stock_alert ?? 5;
          return [
            p.name,
            p.sku ?? "",
            p.category ?? "",
            qty,
            minAlert,
            cost,
            sell,
            qty * cost,
            qty * sell,
            qty <= minAlert ? "MENIPIS" : "AMAN",
          ];
        });
        break;
      }
    }

    const csvContent = buildCsvDocument(headers, rows);

    return {
      success: true,
      data: {
        filename,
        content: csvContent,
        rowCount: rows.length,
        mimeType: "text/csv; charset=utf-8",
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Terjadi kendala saat mengekspor laporan CSV",
      },
    };
  }
}
