/**
 * VeyraOS Database Schema Types
 *
 * Pemetaan 1-ke-1 langsung dengan skema fisik PostgreSQL 15+ pada migrasi 001–009.
 * Menggunakan penamaan snake_case sesuai representasi tabel basis data Supabase.
 */

// ============================================================================
// 1. ENUMS & LITERALS
// ============================================================================

export type PaymentMethod = "CASH" | "BANK_TRANSFER";

export type SaleStatus = "COMPLETED" | "VOIDED";

export type BusinessRole = "OWNER";

export type ExpenseCategory =
  | "OPERATIONAL"
  | "SALARY"
  | "UTILITIES"
  | "RENT"
  | "MARKETING"
  | "MAINTENANCE"
  | "SUPPLIES"
  | "OTHER";

export type StockMovementType =
  | "INITIAL_STOCK"
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_DAMAGE"
  | "ADJUSTMENT_LOSS"
  | "VOID_SALE";

export type IdempotencyActionType =
  | "RECORD_SALE"
  | "RECORD_PURCHASE"
  | "VOID_SALE";

// ============================================================================
// 2. DATABASE TABLE ROWS (1-to-1 dengan PostgreSQL)
// ============================================================================

/** 20261013000001_extensions_and_core.sql - profiles */
export interface ProfileRow {
  id: string; // UUID references auth.users(id)
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

/** 20261013000001_extensions_and_core.sql - businesses */
export interface BusinessRow {
  id: string; // UUID PRIMARY KEY
  owner_id: string; // UUID references profiles(id)
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  currency_code: "IDR";
  timezone: "Asia/Jakarta";
  created_at: string;
  updated_at: string;
}

/** 20261013000001_extensions_and_core.sql - business_members */
export interface BusinessMemberRow {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessRole;
  created_at: string;
}

/** 20261013000002_products_and_inventory.sql - products */
export interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  selling_price: number; // BIGINT >= 0
  cost_price: number; // BIGINT >= 0 (HPP MWAC)
  stock_quantity: number; // INTEGER >= 0
  min_stock_alert: number; // INTEGER >= 0 (default 5)
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/** 20261013000003_sales_and_items.sql - sales */
export interface SaleRow {
  id: string;
  business_id: string;
  invoice_number: string;
  transaction_date: string;
  subtotal_amount: number; // BIGINT >= 0 (subtotal kotor minus diskon item, sebelum diskon transaksi)
  discount_amount: number; // BIGINT >= 0 (diskon transaksi nota)
  total_amount: number; // BIGINT >= 0 (total bersih = subtotal - discount)
  payment_method: PaymentMethod;
  status: SaleStatus;
  void_reason: string | null;
  voided_at: string | null;
  notes: string | null;
  created_at: string;
}

/** 20261013000003_sales_and_items.sql - sale_items */
export interface SaleItemRow {
  id: string;
  sale_id: string;
  business_id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_selling_price: number; // BIGINT >= 0
  unit_cost_price: number; // BIGINT >= 0 (snapshot HPP saat transaksi)
  quantity: number; // INTEGER > 0
  discount_amount: number; // BIGINT >= 0 (diskon per-item + porsi diskon transaksi teralokasi)
  subtotal_amount: number; // BIGINT >= 0 ((qty * selling_price) - discount_amount)
  created_at: string;
}

/** 20261013000004_purchases_and_items.sql - inventory_purchases */
export interface InventoryPurchaseRow {
  id: string;
  business_id: string;
  invoice_number: string;
  purchase_date: string;
  supplier_name: string | null;
  total_cost: number; // BIGINT >= 0
  notes: string | null;
  created_at: string;
}

/** 20261013000004_purchases_and_items.sql - purchase_items */
export interface PurchaseItemRow {
  id: string;
  purchase_id: string;
  business_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number; // INTEGER > 0
  unit_purchase_cost: number; // BIGINT >= 0
  subtotal_cost: number; // BIGINT >= 0 (quantity * unit_purchase_cost)
  created_at: string;
}

/** 20261013000005_stock_movements.sql - stock_movements */
export interface StockMovementRow {
  id: string;
  business_id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity_delta: number; // INTEGER != 0
  previous_quantity: number; // INTEGER >= 0
  new_quantity: number; // INTEGER >= 0
  reference_id: string | null; // UUID (sale_id atau purchase_id)
  notes: string | null;
  created_at: string;
}

/** 20261013000006_expenses.sql - expenses */
export interface ExpenseRow {
  id: string;
  business_id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number; // BIGINT > 0
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** 20261013000007_idempotency_keys.sql & 000009 - idempotency_keys */
export interface IdempotencyKeyRow {
  id: string;
  business_id: string;
  key: string;
  action_type: IdempotencyActionType;
  response_payload: Record<string, unknown>;
  user_id: string | null;
  request_payload: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// 3. STORED PROCEDURE PAYLOAD CONTRACTS (Migration 009)
// ============================================================================

/** Item payload JSON yang dikirimkan ke parameter p_items di record_sale_transaction */
export interface RecordSaleItemRpcPayload {
  productId?: string;
  product_id?: string;
  quantity: number;
  itemDiscount?: number;
  item_discount?: number;
}

/** Nilai kembalian JSONB dari record_sale_transaction */
export interface RecordSaleRpcResponse {
  sale_id: string;
  invoice_number: string;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  transaction_date: string;
  items_count: number;
}

/** Item payload JSON yang dikirimkan ke parameter p_items di record_purchase_transaction */
export interface RecordPurchaseItemRpcPayload {
  productId?: string;
  product_id?: string;
  quantity: number;
  unitPurchaseCost?: number;
  unit_purchase_cost?: number;
}

/** Nilai kembalian JSONB dari record_purchase_transaction */
export interface RecordPurchaseRpcResponse {
  purchase_id: string;
  invoice_number: string;
  total_cost: number;
  purchase_date: string;
  items_count: number;
}

/** Nilai kembalian JSONB dari void_sale_transaction */
export interface VoidSaleRpcResponse {
  sale_id: string;
  status: "VOIDED";
  voided_at: string;
}
