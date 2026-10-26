/**
 * VeyraOS — Definisi Tipe Data Mode Demo Sandboxing (Client-Side)
 * Sesuai PRD v1.1 dan docs/stage-5.7-step-4a-demo-preflight-audit.md.
 * Seluruh nilai moneter menggunakan bilangan bulat integer IDR tanpa desimal pecahan.
 */

export const DEMO_STORAGE_KEY = "veyra_demo_store_v1";
export const DEMO_STORE_VERSION = 1;

export interface DemoBusinessProfile {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  currency: "IDR";
  timezone: "Asia/Jakarta";
  receiptFooter?: string;
  receiptPaperSize?: "58mm" | "80mm";
}

export interface UpdateDemoBusinessProfileInput {
  name?: string;
  category?: string;
  phone?: string;
  address?: string;
  receiptFooter?: string;
  receiptPaperSize?: "58mm" | "80mm";
}

export interface DemoProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number; // Harga jual integer IDR
  cogs: number; // Snapshot HPP / harga beli integer IDR
  stockQuantity: number;
  minStockAlert: number;
  unit: string;
  isArchived?: boolean; // Status aktif / arsip produk (opsional, default false/aktif)
  createdAt: string;
  updatedAt: string;
}

export interface DemoSaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Snapshot harga jual integer IDR saat penjualan
  costPrice: number; // Snapshot HPP integer IDR saat penjualan
  itemDiscount?: number; // Diskon baris barang integer IDR (opsional, default 0)
  subtotal: number; // (quantity * unitPrice) - (itemDiscount || 0)
  allocatedTransactionDiscount?: number; // Alokasi proporsional diskon transaksi (opsional)
  netAmount?: number; // subtotal - (allocatedTransactionDiscount || 0) (opsional)
}

export type DemoPaymentMethod = "CASH" | "BANK_TRANSFER";
export type DemoSaleStatus = "COMPLETED" | "VOIDED";

export interface DemoSale {
  id: string;
  invoiceNumber: string;
  transactionDate: string; // ISO 8601 string
  items: DemoSaleItem[];
  subtotal: number; // Total harga kotor seluruh baris item
  discount: number; // Diskon level transaksi
  totalAmount: number; // subtotal - discount (penjualan bersih)
  totalCogs: number; // sum(item.quantity * item.costPrice)
  grossProfit: number; // totalAmount - totalCogs
  paymentMethod: DemoPaymentMethod;
  status: DemoSaleStatus;
  cashReceived?: number; // Uang tunai diserahkan (jika CASH)
  cashChange?: number; // Uang kembalian tunai (jika CASH)
  notes?: string;
  voidReason?: string;
  voidedAt?: string;
}

export interface RecordDemoSaleItemInput {
  productId: string;
  quantity: number;
  itemDiscount?: number;
}

export interface RecordDemoSaleInput {
  items: RecordDemoSaleItemInput[];
  paymentMethod: DemoPaymentMethod;
  transactionDiscount?: number;
  notes?: string;
  cashReceived?: number;
  transactionDate?: string;
  invoiceNumber?: string;
}

export interface VoidDemoSaleInput {
  saleId: string;
  voidReason: string;
  voidedAt?: string;
}

export type DemoStoreErrorCode =
  | "EMPTY_CART"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "INVALID_QUANTITY"
  | "INSUFFICIENT_STOCK"
  | "INVALID_DISCOUNT"
  | "INVALID_PAYMENT"
  | "INSUFFICIENT_CASH"
  | "SALE_NOT_FOUND"
  | "ALREADY_VOIDED"
  | "INVALID_VOID_REASON"
  | "INVOICE_GENERATION_FAILED"
  | "DUPLICATE_SKU"
  | "INVALID_PRICE"
  | "INVALID_COST"
  | "EXPENSE_NOT_FOUND"
  | "STORAGE_ERROR";

export interface DemoStoreError {
  code: DemoStoreErrorCode;
  message: string;
  details?: unknown;
}

export type DemoTransactionResult<T> =
  | { success: true; data: T }
  | { success: false; error: DemoStoreError };

export interface CreateDemoProductInput {
  name: string;
  sku: string;
  category: string;
  price: number;
  cogs: number;
  stockQuantity: number;
  minStockAlert: number;
  unit: string;
}

export interface UpdateDemoProductInput {
  id: string;
  name?: string;
  sku?: string;
  category?: string;
  price?: number;
  cogs?: number;
  stockQuantity?: number;
  minStockAlert?: number;
  unit?: string;
}

export interface RecordDemoPurchaseItemInput {
  productId: string;
  quantity: number;
  purchaseCost: number;
}

export interface RecordDemoPurchaseInput {
  supplierName?: string;
  purchaseDate?: string;
  paymentMethod?: DemoPaymentMethod;
  notes?: string;
  items: RecordDemoPurchaseItemInput[];
}

export interface RecordDemoExpenseInput {
  expenseDate?: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod?: DemoPaymentMethod;
}

export interface DemoPurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  purchaseCost: number;
  subtotal: number;
}

export interface DemoPurchase {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  items: DemoPurchaseItem[];
  totalAmount: number;
  paymentMethod: DemoPaymentMethod;
  notes?: string;
}

export interface DemoExpense {
  id: string;
  expenseDate: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod: DemoPaymentMethod;
}

export interface DemoStoreState {
  version: number;
  lastResetAt: string;
  business: DemoBusinessProfile;
  products: DemoProduct[];
  sales: DemoSale[];
  purchases: DemoPurchase[];
  expenses: DemoExpense[];
}

export interface DailySalesTrendItem {
  date: string; // YYYY-MM-DD
  amount: number;
  transactionsCount: number;
}

export interface DemoDashboardSummary {
  grossSales: number;
  totalDiscounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: number;
  operatingProfit: number;
  recordedCashFlow: {
    cashInflows: number;
    cashOutflows: number;
    netCashFlow: number;
  };
  dailySalesTrend: DailySalesTrendItem[];
  recentTransactions: Array<{
    id: string;
    invoiceNumber: string;
    transactionDate: string;
    paymentMethod: DemoPaymentMethod;
    totalAmount: number;
    status: DemoSaleStatus;
  }>;
  lowStockAlerts: Array<{
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    minStockAlert: number;
    category: string;
  }>;
  inventoryValuation: number;
}
