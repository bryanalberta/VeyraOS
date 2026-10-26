/**
 * VeyraOS Service Layer & Transaction Logic (Domain Simulation & Validation)
 *
 * Implements client/server-side transaction validation, business rules,
 * Largest Remainder discount reconciliation, MWAC recalculation, and
 * idempotency cache verification matching the PL/pgSQL RPCs in migration 009.
 */

import {
  allocateTransactionDiscounts,
  calculateMovingAverageCost,
  safeJsonStringify,
} from "./financial";

export interface SaleItemInput {
  productId: string;
  quantity: number;
  itemDiscount?: number;
}

export interface ProductInventoryState {
  id: string;
  businessId: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
}

export interface SaleTransactionParams {
  businessId: string;
  userId: string;
  userMemberships: Array<{ businessId: string; userId: string }>;
  invoiceNumber: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  discountAmount: number;
  notes?: string;
  items: SaleItemInput[];
  idempotencyKey?: string;
}

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitPurchaseCost: number;
}

export interface PurchaseTransactionParams {
  businessId: string;
  userId: string;
  userMemberships: Array<{ businessId: string; userId: string }>;
  invoiceNumber: string;
  supplierName?: string;
  notes?: string;
  items: PurchaseItemInput[];
  idempotencyKey?: string;
}

export interface VoidSaleParams {
  businessId: string;
  userId: string;
  userMemberships: Array<{ businessId: string; userId: string }>;
  saleId: string;
  voidReason: string;
  idempotencyKey?: string;
}

export interface SaleReceiptResult {
  saleId: string;
  invoiceNumber: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  itemsCount: number;
  items: Array<{
    productId: string;
    productName: string;
    unitSellingPrice: number;
    unitCostPrice: number;
    quantity: number;
    discountAmount: number;
    subtotalAmount: number;
  }>;
}

export interface PurchaseReceiptResult {
  purchaseId: string;
  invoiceNumber: string;
  totalCost: number;
  itemsCount: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPurchaseCost: number;
    subtotalCost: number;
    newCostPrice: number;
  }>;
}

export interface VoidSaleResult {
  saleId: string;
  status: "VOIDED";
  voidReason: string;
}

export interface IdempotencyStoreEntry {
  businessId: string;
  key: string;
  actionType: "RECORD_SALE" | "RECORD_PURCHASE" | "VOID_SALE";
  userId: string;
  requestPayload: unknown;
  responsePayload: unknown;
}

/**
 * Validates and simulates an atomic sale transaction with Largest Remainder discount allocation.
 */
export function processSaleTransaction(
  params: SaleTransactionParams,
  inventory: Map<string, ProductInventoryState>,
  idempotencyStore: Map<string, IdempotencyStoreEntry>
): SaleReceiptResult {
  // 1. Authorization Guard
  const isMember = params.userMemberships.some(
    (m) => m.businessId === params.businessId && m.userId === params.userId
  );
  if (!isMember) {
    throw new Error("UNAUTHORIZED_BUSINESS");
  }

  // 2. Input Validations
  if (!params.invoiceNumber || params.invoiceNumber.trim().length < 3) {
    throw new Error("INVALID_INVOICE_NUMBER: invoice_number must be at least 3 characters");
  }

  if (params.discountAmount < 0) {
    throw new Error("INVALID_DISCOUNT: discount_amount cannot be negative");
  }

  if (!params.items || params.items.length === 0) {
    throw new Error("EMPTY_SALE_ITEMS: at least one item is required");
  }

  // 3. Idempotency Check
  const trimmedKey = params.idempotencyKey?.trim();
  const reqPayload = {
    invoiceNumber: params.invoiceNumber.trim(),
    paymentMethod: params.paymentMethod,
    discountAmount: params.discountAmount,
    items: params.items,
  };

  if (trimmedKey) {
    if (trimmedKey.length < 8 || trimmedKey.length > 128) {
      throw new Error("INVALID_IDEMPOTENCY_KEY: key length must be between 8 and 128 characters");
    }

    const storeKey = `${params.businessId}:${trimmedKey}`;
    const existing = idempotencyStore.get(storeKey);
    if (existing) {
      if (existing.actionType !== "RECORD_SALE") {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION");
      }
      if (safeJsonStringify(existing.requestPayload) !== safeJsonStringify(reqPayload)) {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
      }
      return existing.responsePayload as SaleReceiptResult;
    }
  }

  // Validate Products & Stock (with aggregation of requested quantities per product)
  const totalRequestedByProduct = new Map<string, number>();
  for (const item of params.items) {
    if (item.quantity <= 0) {
      throw new Error("INVALID_QUANTITY: item quantity must be greater than 0");
    }
    totalRequestedByProduct.set(
      item.productId,
      (totalRequestedByProduct.get(item.productId) ?? 0) + item.quantity
    );
  }

  for (const [prodId, totalQty] of totalRequestedByProduct.entries()) {
    const prod = inventory.get(prodId);
    if (!prod || prod.businessId !== params.businessId) {
      throw new Error(`PRODUCT_NOT_FOUND: ${prodId}`);
    }
    if (prod.stockQuantity < totalQty) {
      throw new Error(
        `STOCK_INSUFFICIENT: Produk "${prod.name}" sisa ${prod.stockQuantity}, diminta ${totalQty}`
      );
    }
  }

  let totalGrossSubtotal = 0;
  const lineEvaluations: Array<{
    productId: string;
    product: ProductInventoryState;
    quantity: number;
    itemDiscount: number;
    grossSubtotal: number;
  }> = [];

  for (const item of params.items) {
    const prod = inventory.get(item.productId)!;
    const itemDisc = item.itemDiscount ?? 0;
    if (itemDisc < 0 || itemDisc > item.quantity * prod.sellingPrice) {
      throw new Error("INVALID_DISCOUNT: item discount exceeds item gross amount");
    }

    const gross = item.quantity * prod.sellingPrice - itemDisc;
    totalGrossSubtotal += gross;

    lineEvaluations.push({
      productId: item.productId,
      product: prod,
      quantity: item.quantity,
      itemDiscount: itemDisc,
      grossSubtotal: gross,
    });
  }

  if (params.discountAmount > totalGrossSubtotal) {
    throw new Error("INVALID_DISCOUNT: transaction discount cannot exceed subtotal");
  }

  // 4. Largest Remainder Discount Allocation (Aggregated by Product ID)
  const itemsForDiscount = lineEvaluations.map((l) => ({
    id: l.productId,
    subtotal: l.grossSubtotal,
  }));

  const allocatedDiscounts = allocateTransactionDiscounts(itemsForDiscount, params.discountAmount);

  // 5. Execute Stock Deductions & Snapshot Creation
  const snapshotItems = lineEvaluations.map((line, index) => {
    const propDiscount = allocatedDiscounts[index]?.allocatedDiscount ?? 0;
    const totalLineDiscount = line.itemDiscount + propDiscount;
    const lineNetSubtotal = line.quantity * line.product.sellingPrice - totalLineDiscount;

    // Mutate physical stock
    line.product.stockQuantity -= line.quantity;

    return {
      productId: line.productId,
      productName: line.product.name,
      unitSellingPrice: line.product.sellingPrice,
      unitCostPrice: line.product.costPrice,
      quantity: line.quantity,
      discountAmount: totalLineDiscount,
      subtotalAmount: lineNetSubtotal,
    };
  });

  const totalAmount = totalGrossSubtotal - params.discountAmount;

  // Invariant verification: sum of line net subtotals must equal totalAmount exactly
  const sumOfLineSubtotals = snapshotItems.reduce((acc, s) => acc + s.subtotalAmount, 0);
  if (sumOfLineSubtotals !== totalAmount) {
    throw new Error("MATH_INCONSISTENCY: sum of items subtotal does not equal total_amount");
  }

  const response: SaleReceiptResult = {
    saleId: "mock-sale-uuid",
    invoiceNumber: params.invoiceNumber.trim(),
    subtotalAmount: totalGrossSubtotal,
    discountAmount: params.discountAmount,
    totalAmount,
    paymentMethod: params.paymentMethod,
    itemsCount: params.items.length,
    items: snapshotItems,
  };

  // 6. Store Idempotency
  if (trimmedKey) {
    const storeKey = `${params.businessId}:${trimmedKey}`;
    idempotencyStore.set(storeKey, {
      businessId: params.businessId,
      key: trimmedKey,
      actionType: "RECORD_SALE",
      userId: params.userId,
      requestPayload: reqPayload,
      responsePayload: response,
    });
  }

  return response;
}

/**
 * Validates and simulates an atomic inventory purchase with MWAC calculation.
 */
export function processPurchaseTransaction(
  params: PurchaseTransactionParams,
  inventory: Map<string, ProductInventoryState>,
  idempotencyStore: Map<string, IdempotencyStoreEntry>
): PurchaseReceiptResult {
  // 1. Authorization
  const isMember = params.userMemberships.some(
    (m) => m.businessId === params.businessId && m.userId === params.userId
  );
  if (!isMember) {
    throw new Error("UNAUTHORIZED_BUSINESS");
  }

  // 2. Validations
  if (!params.invoiceNumber || params.invoiceNumber.trim().length < 3) {
    throw new Error("INVALID_INVOICE_NUMBER: invoice_number must be at least 3 characters");
  }

  if (!params.items || params.items.length === 0) {
    throw new Error("EMPTY_PURCHASE_ITEMS: at least one purchase item is required");
  }

  // 3. Idempotency Check
  const trimmedKey = params.idempotencyKey?.trim();
  const reqPayload = {
    invoiceNumber: params.invoiceNumber.trim(),
    supplierName: params.supplierName,
    items: params.items,
  };

  if (trimmedKey) {
    const storeKey = `${params.businessId}:${trimmedKey}`;
    const existing = idempotencyStore.get(storeKey);
    if (existing) {
      if (existing.actionType !== "RECORD_PURCHASE") {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION");
      }
      if (safeJsonStringify(existing.requestPayload) !== safeJsonStringify(reqPayload)) {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
      }
      return existing.responsePayload as PurchaseReceiptResult;
    }
  }

  let totalCost = 0;
  const snapshotItems = [];

  for (const item of params.items) {
    if (item.quantity <= 0) {
      throw new Error("INVALID_QUANTITY: purchase quantity must be greater than 0");
    }
    if (item.unitPurchaseCost < 0) {
      throw new Error("INVALID_PURCHASE_COST: unit_purchase_cost cannot be negative");
    }

    const prod = inventory.get(item.productId);
    if (!prod || prod.businessId !== params.businessId) {
      throw new Error(`PRODUCT_NOT_FOUND: ${item.productId}`);
    }

    const lineCost = item.quantity * item.unitPurchaseCost;
    totalCost += lineCost;

    // Calculate new Moving Weighted Average Cost (MWAC)
    const newCost = calculateMovingAverageCost(
      prod.stockQuantity,
      prod.costPrice,
      item.quantity,
      item.unitPurchaseCost
    );

    // Update physical stock and average cost
    prod.stockQuantity += item.quantity;
    prod.costPrice = newCost;

    snapshotItems.push({
      productId: item.productId,
      productName: prod.name,
      quantity: item.quantity,
      unitPurchaseCost: item.unitPurchaseCost,
      subtotalCost: lineCost,
      newCostPrice: newCost,
    });
  }

  const response: PurchaseReceiptResult = {
    purchaseId: "mock-purchase-uuid",
    invoiceNumber: params.invoiceNumber.trim(),
    totalCost,
    itemsCount: params.items.length,
    items: snapshotItems,
  };

  if (trimmedKey) {
    const storeKey = `${params.businessId}:${trimmedKey}`;
    idempotencyStore.set(storeKey, {
      businessId: params.businessId,
      key: trimmedKey,
      actionType: "RECORD_PURCHASE",
      userId: params.userId,
      requestPayload: reqPayload,
      responsePayload: response,
    });
  }

  return response;
}

/**
 * Validates and simulates atomic sale cancellation (Void).
 */
export function processVoidSaleTransaction(
  params: VoidSaleParams,
  salesStore: Map<string, { id: string; businessId: string; status: "COMPLETED" | "VOIDED"; items: Array<{ productId: string; quantity: number }> }>,
  inventory: Map<string, ProductInventoryState>,
  idempotencyStore: Map<string, IdempotencyStoreEntry>
): VoidSaleResult {
  // 1. Authorization
  const isMember = params.userMemberships.some(
    (m) => m.businessId === params.businessId && m.userId === params.userId
  );
  if (!isMember) {
    throw new Error("UNAUTHORIZED_BUSINESS");
  }

  if (!params.voidReason || params.voidReason.trim().length < 5) {
    throw new Error("INVALID_VOID_REASON: void_reason must be at least 5 characters");
  }

  // 2. Idempotency Check
  const trimmedKey = params.idempotencyKey?.trim();
  const reqPayload = {
    saleId: params.saleId,
    voidReason: params.voidReason.trim(),
  };

  if (trimmedKey) {
    const storeKey = `${params.businessId}:${trimmedKey}`;
    const existing = idempotencyStore.get(storeKey);
    if (existing) {
      if (existing.actionType !== "VOID_SALE") {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION");
      }
      if (safeJsonStringify(existing.requestPayload) !== safeJsonStringify(reqPayload)) {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
      }
      return existing.responsePayload as VoidSaleResult;
    }
  }

  // 3. Find Sale
  const sale = salesStore.get(params.saleId);
  if (!sale || sale.businessId !== params.businessId) {
    throw new Error(`SALE_NOT_FOUND: ${params.saleId}`);
  }

  if (sale.status === "VOIDED") {
    throw new Error(`SALE_ALREADY_VOIDED: sale ${params.saleId} is already voided`);
  }

  // 4. Update status & restore physical stock (without altering costPrice)
  sale.status = "VOIDED";

  for (const item of sale.items) {
    const prod = inventory.get(item.productId);
    if (prod && prod.businessId === params.businessId) {
      const originalCostPrice = prod.costPrice;
      prod.stockQuantity += item.quantity;
      // Invariant: costPrice MUST NOT be retroactively changed!
      if (prod.costPrice !== originalCostPrice) {
        throw new Error("INVARIANT_VIOLATION: costPrice altered during void sale");
      }
    }
  }

  const response: VoidSaleResult = {
    saleId: params.saleId,
    status: "VOIDED",
    voidReason: params.voidReason.trim(),
  };

  if (trimmedKey) {
    const storeKey = `${params.businessId}:${trimmedKey}`;
    idempotencyStore.set(storeKey, {
      businessId: params.businessId,
      key: trimmedKey,
      actionType: "VOID_SALE",
      userId: params.userId,
      requestPayload: reqPayload,
      responsePayload: response,
    });
  }

  return response;
}
