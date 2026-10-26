/**
 * VeyraOS Central Type Definitions & Contracts
 *
 * Mengonsolidasikan dan mengekspor seluruh tipe domain, baris basis data,
 * serta DTO API terstandarisasi.
 */

// Re-export database row types and database enums (1-to-1 dengan PostgreSQL)
export * from "./database";

// Re-export application DTOs, API payloads, dan response envelope
export * from "./api";

// ============================================================================
// CONVENIENCE DOMAIN ALIASES (Backward-Compatible)
// ============================================================================

export type Profile = import("./database").ProfileRow;
export type Business = import("./database").BusinessRow;
export type BusinessMember = import("./database").BusinessMemberRow;
export type Product = import("./database").ProductRow;
export type Sale = import("./database").SaleRow;
export type SaleItem = import("./database").SaleItemRow;
export type InventoryPurchase = import("./database").InventoryPurchaseRow;
export type PurchaseItem = import("./database").PurchaseItemRow;
export type StockMovement = import("./database").StockMovementRow;
export type Expense = import("./database").ExpenseRow;
export type IdempotencyKey = import("./database").IdempotencyKeyRow;
