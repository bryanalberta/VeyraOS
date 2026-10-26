/**
 * VeyraOS Application & Service Layer API Contracts
 *
 * Standarisasi DTO, payload request, dan response untuk Server Actions dan Route Handlers.
 * Menggunakan konvensi penamaan camelCase sesuai spesifikasi di docs/api-contracts.md.
 */

import type {
  PaymentMethod,
  SaleStatus,
  ExpenseCategory,
  BusinessRole,
} from "./database";

// ============================================================================
// 1. STANDARDIZED API RESPONSE ENVELOPE
// ============================================================================

export type ApiResponse<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, string[]>;
      };
    };

// ============================================================================
// 2. AUTHENTICATION & USER PROFILE DTOs
// ============================================================================

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthResponseData {
  userId: string;
  email: string;
  fullName: string;
  sessionEstablished: boolean;
  requiresEmailConfirmation: boolean;
}

export interface UserProfileResponseData {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  fullName: string;
}

// ============================================================================
// 3. BUSINESS CONTEXT DTOs
// ============================================================================

export interface CreateBusinessInput {
  name: string;
  category?: string;
  phone?: string;
  address?: string;
}

export interface UpdateBusinessInput {
  businessId?: string;
  name?: string;
  category?: string;
  phone?: string;
  address?: string;
}

export interface BusinessResponseData {
  id: string;
  ownerId: string;
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  currencyCode: "IDR";
  timezone: "Asia/Jakarta";
  createdAt: string;
  updatedAt: string;
}

export interface TenantContextResponse {
  hasBusiness: boolean;
  activeBusiness: BusinessResponseData | null;
  role: BusinessRole | null;
  availableBusinesses: BusinessResponseData[];
}

// ============================================================================
// 4. PRODUCT & INVENTORY DTOs
// ============================================================================

export interface CreateProductInput {
  businessId: string;
  name: string;
  sku?: string;
  category?: string;
  sellingPrice: number; // Integer IDR >= 0
  costPrice: number; // Integer IDR >= 0 (HPP awal)
  stockQuantity: number; // Integer >= 0
}

export interface UpdateProductInput {
  businessId: string;
  productId: string;
  name?: string;
  sku?: string;
  category?: string;
  sellingPrice?: number;
  costPrice?: number;
  stockQuantity?: number;
  isArchived?: boolean;
}

export interface ProductItemResponse {
  id: string;
  businessId: string;
  name: string;
  sku: string | null;
  category: string | null;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetProductsQuery {
  businessId: string;
  query?: string;
  category?: string;
  lowStockOnly?: boolean;
  includeArchived?: boolean;
}

// ============================================================================
// 5. SALES & POS TRANSACTION DTOs
// ============================================================================

export interface SaleItemInput {
  productId: string;
  quantity: number; // Integer > 0
  itemDiscount?: number; // Integer IDR >= 0
}

export interface RecordSaleInput {
  businessId: string;
  idempotencyKey: string; // Kunci unik minimal 8 karakter
  paymentMethod: PaymentMethod;
  items: SaleItemInput[];
  transactionDiscount?: number; // Integer IDR >= 0
  notes?: string;
}

export interface SaleReceiptResponse {
  saleId: string;
  invoiceNumber: string;
  subtotalAmount: number; // Subtotal sebelum diskon transaksi global
  discountAmount: number; // Nilai diskon transaksi global
  totalAmount: number; // Total bersih yang dibayar pelanggan
  paymentMethod: PaymentMethod;
  transactionDate: string;
  itemsCount: number;
}

export interface VoidSaleInput {
  businessId: string;
  saleId: string;
  voidReason: string; // Wajib minimal 5 karakter
  idempotencyKey?: string;
}

export interface VoidSaleResponse {
  saleId: string;
  status: "VOIDED";
  voidedAt: string;
}

export interface SaleSummaryItem {
  id: string;
  invoiceNumber: string;
  transactionDate: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
}

// ============================================================================
// 6. INVENTORY PURCHASES (RESTOCK) DTOs
// ============================================================================

export interface PurchaseItemInput {
  productId: string;
  quantity: number; // Integer > 0
  unitPurchaseCost: number; // Integer IDR >= 0
}

export interface RecordPurchaseInput {
  businessId: string;
  supplierName?: string;
  items: PurchaseItemInput[];
  notes?: string;
  idempotencyKey?: string;
}

export interface PurchaseReceiptResponse {
  purchaseId: string;
  invoiceNumber: string;
  totalCost: number;
  purchaseDate: string;
  itemsCount: number;
}

// ============================================================================
// 7. OPERATIONAL EXPENSES DTOs
// ============================================================================

export interface RecordExpenseInput {
  businessId: string;
  category: ExpenseCategory;
  amount: number; // Integer IDR > 0
  description: string; // Wajib minimal 2 karakter
  expenseDate?: string; // Default waktu sekarang
}

export interface UpdateExpenseInput {
  businessId: string;
  expenseId?: string;
  category?: ExpenseCategory;
  amount?: number; // Integer IDR > 0
  description?: string; // Minimal 2 karakter jika diisi
  expenseDate?: string;
}

export interface ExpenseResponseData {
  id: string;
  businessId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetExpensesQuery {
  businessId: string;
  startDate?: string;
  endDate?: string;
  category?: ExpenseCategory;
}

// ============================================================================
// 8. DASHBOARD & FINANCIAL REPORTS DTOs
// ============================================================================

export type ReportExportType = "SALES" | "EXPENSES" | "STOCK";

export interface DashboardQueryParams {
  businessId?: string;
  startDate?: string; // ISO 8601 (YYYY-MM-DD atau full ISO string)
  endDate?: string;   // ISO 8601 (YYYY-MM-DD atau full ISO string)
}

export interface LowStockItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  stockQuantity: number;
  minStockAlert: number;
}

export interface DailySalesTrendItem {
  date: string; // YYYY-MM-DD (Asia/Jakarta)
  amount: number; // Net sales hari tersebut
  transactionsCount: number;
}

export interface CashFlowSummary {
  cashInflows: number;           // Total kas masuk dari penjualan COMPLETED
  cashInflowsCash: number;       // Rincian penerimaan tunai (CASH)
  cashInflowsBank: number;       // Rincian penerimaan transfer bank (BANK_TRANSFER)
  cashOutflows: number;          // Total kas keluar = beban operasional + pembelian stok
  cashOutflowsExpenses: number;  // Rincian beban operasional (expenses)
  cashOutflowsPurchases: number; // Rincian pembelian restock (inventory_purchases)
  netCashFlow: number;           // cashInflows - cashOutflows
}

export interface DashboardSummaryResponseData {
  grossSales: number;            // Total omzet kotor sebelum seluruh potongan diskon
  totalDiscounts: number;        // Akumulasi seluruh diskon yang diberikan (item + nota)
  netSales: number;              // Penjualan bersih (setelah diskon, mengeluarkan VOIDED)
  cogs: number;                  // Total HPP historis barang terjual (sale_items.unit_cost_price)
  grossProfit: number;           // netSales - cogs
  grossProfitMargin: number;     // Persentase 0 - 100 dengan 2 desimal
  operatingExpenses: number;     // Total pengeluaran operasional dari tabel expenses
  operatingProfit: number;       // grossProfit - operatingExpenses
  recordedCashFlow: CashFlowSummary;
  recentTransactions: SaleSummaryItem[]; // Maksimal 5 transaksi penjualan terbaru
  lowStockAlerts: LowStockItem[];
  dailySalesTrend: DailySalesTrendItem[];
}

/** Alias untuk kompatibilitas ke belakang */
export type DashboardSummaryResponse = DashboardSummaryResponseData;

// --- Sales Report DTOs ---

export interface GetSalesReportQuery {
  businessId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  status?: SaleStatus;
}

export interface SalesReportTransactionItem {
  id: string;
  invoiceNumber: string;
  transactionDate: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  itemsCount: number;
}

export interface SalesReportResponseData {
  period: { startDate: string; endDate: string };
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  summary: {
    totalTransactions: number;
    completedTransactions: number;
    voidedTransactions: number;
    grossSales: number;
    totalDiscounts: number;
    netSales: number;
  };
  transactions: SalesReportTransactionItem[];
}

// --- Expense Report DTOs ---

export interface GetExpenseReportQuery {
  businessId?: string;
  startDate?: string;
  endDate?: string;
  category?: ExpenseCategory;
}

export interface ExpenseReportCategorySummary {
  category: ExpenseCategory;
  totalAmount: number;
  count: number;
  percentage: number; // 0 - 100 dengan 2 desimal
}

export interface ExpenseReportItem {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
}

export interface ExpenseReportResponseData {
  period: { startDate: string; endDate: string };
  totalExpenses: number;
  byCategory: ExpenseReportCategorySummary[];
  expenses: ExpenseReportItem[];
}

// --- Stock Report DTOs ---

export interface GetStockReportQuery {
  businessId?: string;
  category?: string;
  lowStockOnly?: boolean;
  isArchived?: boolean;
}

export interface StockReportItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  stockQuantity: number;
  minStockAlert: number;
  costPrice: number;        // Nilai MWAC aktif saat ini (products.cost_price)
  sellingPrice: number;     // Nilai harga jual aktif (products.selling_price)
  assetValueCost: number;   // stockQuantity * costPrice
  assetValueSelling: number;// stockQuantity * sellingPrice
  isLowStock: boolean;
  isArchived: boolean;
}

export interface StockReportResponseData {
  summary: {
    totalProducts: number;
    totalStockUnits: number;
    totalAssetValueCost: number;     // Total modal aset stok
    totalAssetValueSelling: number;  // Total potensi omzet aset stok
    lowStockCount: number;
  };
  items: StockReportItem[];
}

// --- CSV Export DTOs ---

export interface ExportReportInput {
  businessId?: string;
  type: ReportExportType;
  startDate?: string;
  endDate?: string;
}


/** Alias untuk kompatibilitas ke belakang */
export type ExportReportQuery = ExportReportInput;

export interface ReportCsvResult {
  filename: string;
  content: string; // CSV text (RFC 4180 dengan UTF-8 BOM)
  rowCount: number;
  mimeType: "text/csv; charset=utf-8";
}
