/**
 * VeyraOS Transaction Service Layer Foundation
 *
 * Sesuai spesifikasi Phase 4, Substage 3.2.1:
 * - Terpisah dari UI dan Server Actions.
 * - Menggunakan Supabase server client resmi.
 * - Mengeksekusi mutasi stok & status hanya melalui Stored Procedure (RPC), bukan mutasi langsung.
 * - Menggunakan nomor faktur server-authoritative dari generateInvoiceNumber().
 * - Memvalidasi input melalui skema Zod sebelum memanggil database.
 * - Memeriksa otorisasi sesi pengguna & keanggotaan bisnis di sisi server (Defense-in-Depth).
 * - Memetakan error database ke response terpadu ApiResponse<T> tanpa membocorkan detail internal.
 * - Tidak menerima business_id dari klien sebagai bukti otorisasi mutlak.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generateInvoiceNumber } from "@/lib/invoice";
import {
  recordSaleSchema,
  recordPurchaseSchema,
  voidSaleSchema,
  uuidSchema,
} from "@/lib/validations";
import {
  mapDatabaseErrorToApiResponse,
  formatZodErrorDetails,
} from "./error-mapper";
import { verifyUserAndBusinessMembership } from "@/services/common/auth-guard";
import type {
  ApiResponse,
  RecordSaleInput,
  SaleReceiptResponse,
  RecordPurchaseInput,
  PurchaseReceiptResponse,
  VoidSaleInput,
  VoidSaleResponse,
  ProductItemResponse,
} from "@/types/api";

export interface TransactionServiceOptions {
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
   * Nomor invoice yang disuntikkan secara eksplisit (misal untuk determinisme pengujian).
   * Jika tidak diisi, dibuat otomatis menggunakan generateInvoiceNumber().
   */
  invoiceNumber?: string;
}

export interface GetProductsForTransactionOptions {
  supabase?: SupabaseClient;
  userId?: string;
  query?: string;
}

/**
 * Skema runtime untuk memvalidasi kembalian RPC record_sale_transaction.
 * Mencegah data malformed / corrupt lolos ke lapisan atas tanpa deteksi.
 */
const saleReceiptRpcSchema = z
  .object({
    sale_id: z.string().min(1).optional(),
    saleId: z.string().min(1).optional(),
    invoice_number: z.string().min(3).optional(),
    invoiceNumber: z.string().min(3).optional(),
    subtotal_amount: z.number().int().nonnegative().optional(),
    subtotalAmount: z.number().int().nonnegative().optional(),
    discount_amount: z.number().int().nonnegative().optional(),
    discountAmount: z.number().int().nonnegative().optional(),
    total_amount: z.number().int().nonnegative().optional(),
    totalAmount: z.number().int().nonnegative().optional(),
    payment_method: z.enum(["CASH", "BANK_TRANSFER"]).optional(),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]).optional(),
    transaction_date: z.string().min(1).optional(),
    transactionDate: z.string().min(1).optional(),
    items_count: z.number().int().positive().optional(),
    itemsCount: z.number().int().positive().optional(),
  })
  .transform((val) => {
    const saleId = val.sale_id ?? val.saleId;
    const invoiceNum = val.invoice_number ?? val.invoiceNumber;
    const subtotal = val.subtotal_amount ?? val.subtotalAmount;
    const discount = val.discount_amount ?? val.discountAmount;
    const total = val.total_amount ?? val.totalAmount;
    const paymentMethod = val.payment_method ?? val.paymentMethod;
    const txDate = val.transaction_date ?? val.transactionDate;
    const itemsCount = val.items_count ?? val.itemsCount;

    if (
      !saleId ||
      !invoiceNum ||
      subtotal === undefined ||
      discount === undefined ||
      total === undefined ||
      !paymentMethod ||
      !txDate ||
      itemsCount === undefined
    ) {
      return null;
    }

    return {
      saleId,
      invoiceNumber: invoiceNum,
      subtotalAmount: subtotal,
      discountAmount: discount,
      totalAmount: total,
      paymentMethod,
      transactionDate: txDate,
      itemsCount,
    } as SaleReceiptResponse;
  });

/**
 * Skema runtime untuk memvalidasi kembalian RPC record_purchase_transaction.
 */
const purchaseReceiptRpcSchema = z
  .object({
    purchase_id: z.string().min(1).optional(),
    purchaseId: z.string().min(1).optional(),
    invoice_number: z.string().min(3).optional(),
    invoiceNumber: z.string().min(3).optional(),
    total_cost: z.number().int().nonnegative().optional(),
    totalCost: z.number().int().nonnegative().optional(),
    purchase_date: z.string().min(1).optional(),
    purchaseDate: z.string().min(1).optional(),
    items_count: z.number().int().positive().optional(),
    itemsCount: z.number().int().positive().optional(),
  })
  .transform((val) => {
    const purchaseId = val.purchase_id ?? val.purchaseId;
    const invoiceNum = val.invoice_number ?? val.invoiceNumber;
    const totalCost = val.total_cost ?? val.totalCost;
    const purchaseDate = val.purchase_date ?? val.purchaseDate;
    const itemsCount = val.items_count ?? val.itemsCount;

    if (
      !purchaseId ||
      !invoiceNum ||
      totalCost === undefined ||
      !purchaseDate ||
      itemsCount === undefined
    ) {
      return null;
    }

    return {
      purchaseId,
      invoiceNumber: invoiceNum,
      totalCost,
      purchaseDate,
      itemsCount,
    } as PurchaseReceiptResponse;
  });

/**
 * Skema runtime untuk memvalidasi kembalian RPC void_sale_transaction.
 */
const voidSaleRpcSchema = z
  .object({
    sale_id: z.string().min(1).optional(),
    saleId: z.string().min(1).optional(),
    status: z.literal("VOIDED"),
    voided_at: z.string().min(1).optional(),
    voidedAt: z.string().min(1).optional(),
  })
  .transform((val) => {
    const saleId = val.sale_id ?? val.saleId;
    const voidedAt = val.voided_at ?? val.voidedAt;

    if (!saleId || !voidedAt) {
      return null;
    }

    return {
      saleId,
      status: "VOIDED" as const,
      voidedAt,
    } as VoidSaleResponse;
  });


/**
 * 1. Mencatat Transaksi Penjualan (Sales POS)
 * Memvalidasi payload, menghasilkan nomor invoice server, dan memanggil RPC record_sale_transaction.
 */
export async function recordSale(
  input: RecordSaleInput,
  options?: TransactionServiceOptions
): Promise<ApiResponse<SaleReceiptResponse>> {
  // 1. Validasi Input melalui Zod Schema
  const validationResult = recordSaleSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data transaksi penjualan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Verifikasi Autentikasi & Otorisasi Bisnis di Server
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response as ApiResponse<SaleReceiptResponse>;
  }

  // 3. Buat Nomor Invoice Server-Authoritative
  const invoiceNumber =
    options?.invoiceNumber ?? generateInvoiceNumber({ type: "SALE" });

  // 4. Panggil Stored Procedure Atomik PostgreSQL
  const rpcPayload = {
    p_business_id: validated.businessId,
    p_invoice_number: invoiceNumber,
    p_payment_method: validated.paymentMethod,
    p_discount_amount: validated.transactionDiscount ?? 0,
    p_notes: validated.notes ?? null,
    p_items: validated.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      item_discount: item.itemDiscount ?? 0,
    })),
    p_idempotency_key: validated.idempotencyKey,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "record_sale_transaction",
    rpcPayload
  );

  if (rpcError) {
    return mapDatabaseErrorToApiResponse<SaleReceiptResponse>(rpcError);
  }

  // 5. Validasi & Format Kontrak Kembalian RPC
  const parsedReceipt = saleReceiptRpcSchema.safeParse(rpcData);
  if (!parsedReceipt.success || !parsedReceipt.data) {
    return {
      success: false,
      error: {
        code: "MALFORMED_RPC_RESPONSE",
        message: "Respon dari database tidak sesuai dengan kontrak transaksi penjualan",
      },
    };
  }

  return {
    success: true,
    data: parsedReceipt.data,
  };
}

/**
 * 2. Mencatat Pembelian Persediaan (Restock Restock)
 * Memvalidasi payload, menghasilkan nomor faktur PO, dan memanggil RPC record_purchase_transaction.
 */
export async function recordPurchase(
  input: RecordPurchaseInput,
  options?: TransactionServiceOptions
): Promise<ApiResponse<PurchaseReceiptResponse>> {
  // 1. Validasi Input melalui Zod Schema
  const validationResult = recordPurchaseSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembelian persediaan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Verifikasi Autentikasi & Otorisasi Bisnis di Server
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response as ApiResponse<PurchaseReceiptResponse>;
  }

  // 3. Buat Nomor Faktur Pembelian Server-Authoritative
  const invoiceNumber =
    options?.invoiceNumber ?? generateInvoiceNumber({ type: "PURCHASE" });

  // 4. Panggil Stored Procedure Atomik PostgreSQL
  const rpcPayload = {
    p_business_id: validated.businessId,
    p_invoice_number: invoiceNumber,
    p_supplier_name: validated.supplierName ?? null,
    p_notes: validated.notes ?? null,
    p_items: validated.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_purchase_cost: item.unitPurchaseCost,
    })),
    p_idempotency_key: validated.idempotencyKey ?? null,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "record_purchase_transaction",
    rpcPayload
  );

  if (rpcError) {
    return mapDatabaseErrorToApiResponse<PurchaseReceiptResponse>(rpcError);
  }

  // 5. Validasi & Format Kontrak Kembalian RPC
  const parsedPurchase = purchaseReceiptRpcSchema.safeParse(rpcData);
  if (!parsedPurchase.success || !parsedPurchase.data) {
    return {
      success: false,
      error: {
        code: "MALFORMED_RPC_RESPONSE",
        message: "Respon dari database tidak sesuai dengan kontrak transaksi pembelian",
      },
    };
  }

  return {
    success: true,
    data: parsedPurchase.data,
  };
}

/**
 * 3. Membatalkan Transaksi Penjualan (Void Sale)
 * Memvalidasi alasan pembatalan dan memanggil RPC void_sale_transaction.
 */
export async function voidSale(
  input: VoidSaleInput,
  options?: TransactionServiceOptions
): Promise<ApiResponse<VoidSaleResponse>> {
  // 1. Validasi Input melalui Zod Schema
  const validationResult = voidSaleSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembatalan transaksi tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  // 2. Verifikasi Autentikasi & Otorisasi Bisnis di Server
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response as ApiResponse<VoidSaleResponse>;
  }

  // 3. Panggil Stored Procedure Atomik PostgreSQL
  const rpcPayload = {
    p_business_id: validated.businessId,
    p_sale_id: validated.saleId,
    p_void_reason: validated.voidReason,
    p_idempotency_key: validated.idempotencyKey ?? null,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "void_sale_transaction",
    rpcPayload
  );

  if (rpcError) {
    return mapDatabaseErrorToApiResponse<VoidSaleResponse>(rpcError);
  }

  // 4. Validasi & Format Kontrak Kembalian RPC
  const parsedVoid = voidSaleRpcSchema.safeParse(rpcData);
  if (!parsedVoid.success || !parsedVoid.data) {
    return {
      success: false,
      error: {
        code: "MALFORMED_RPC_RESPONSE",
        message: "Respon dari database tidak sesuai dengan kontrak pembatalan penjualan",
      },
    };
  }

  return {
    success: true,
    data: parsedVoid.data,
  };
}

/**
 * 4. Membaca Produk Aktif untuk Transaksi Kasir / Restock
 * Mengambil produk yang belum diarsipkan dari tabel products milik tenant terotorisasi.
 */
export async function getProductsForTransaction(
  businessId: string,
  options?: GetProductsForTransactionOptions
): Promise<ApiResponse<ProductItemResponse[]>> {
  // Validasi format UUID businessId
  const idValidation = uuidSchema.safeParse(businessId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID bisnis tidak valid",
      },
    };
  }

  const supabase = options?.supabase ?? (await createClient());

  // Verifikasi Autentikasi & Otorisasi Bisnis di Server
  const authCheck = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authCheck.success) {
    return authCheck.response as ApiResponse<ProductItemResponse[]>;
  }

  // Query produk aktif
  let queryBuilder = supabase
    .from("products")
    .select(
      "id, business_id, name, sku, category, selling_price, cost_price, stock_quantity, is_archived, created_at, updated_at"
    )
    .eq("business_id", businessId)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (options?.query && options.query.trim()) {
    queryBuilder = queryBuilder.ilike("name", `%${options.query.trim()}%`);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return mapDatabaseErrorToApiResponse<ProductItemResponse[]>(error);
  }

  const products: ProductItemResponse[] = (data ?? []).map((p) => ({
    id: p.id,
    businessId: p.business_id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    sellingPrice: p.selling_price,
    costPrice: p.cost_price,
    stockQuantity: p.stock_quantity,
    isArchived: p.is_archived,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return {
    success: true,
    data: products,
  };
}
