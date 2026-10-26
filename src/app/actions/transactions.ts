"use server";

import { cookies } from "next/headers";
import {
  recordSaleSchema,
  recordPurchaseSchema,
  voidSaleSchema,
  uuidSchema,
} from "@/lib/validations";
import * as transactionService from "@/services/transactions/transaction.service";
import * as businessService from "@/services/business/business.service";
import { formatZodErrorDetails } from "@/services/transactions/error-mapper";
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
import {
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_OPTIONS,
} from "@/lib/constants/tenant-cookie";

export type CreateSaleActionInput = Omit<RecordSaleInput, "businessId" | "idempotencyKey"> & {
  businessId?: string;
  idempotencyKey?: string;
};

export type RecordPurchaseActionInput = Omit<RecordPurchaseInput, "businessId"> & {
  businessId?: string;
};

export type VoidSaleActionInput = Omit<VoidSaleInput, "businessId"> & {
  businessId?: string;
};

/**
 * Helper internal untuk menyelesaikan businessId target secara server-authoritative:
 * 1. Jika businessId eksplisit dikirimkan, validasi format UUID.
 * 2. Jika tidak dikirimkan, baca cookie preferensi aktif veyra_active_business_id.
 * 3. Jika cookie rusak, bersihkan dan tolak seketika (fail-closed, anti-silent fallback).
 * 4. Jika cookie kosong, selesaikan bisnis default secara deterministik.
 */
async function resolveEffectiveBusinessId(
  explicitBusinessId?: string
): Promise<
  | { success: true; businessId: string; fromCookie: boolean }
  | { success: false; response: ApiResponse<never> }
> {
  // 1. Business ID eksplisit
  if (explicitBusinessId !== undefined && explicitBusinessId.trim() !== "") {
    const idValidation = uuidSchema.safeParse(explicitBusinessId);
    if (!idValidation.success) {
      return {
        success: false,
        response: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Format ID bisnis tidak valid",
            details: {
              businessId: idValidation.error.issues.map((i) => i.message),
            },
          },
        },
      };
    }
    return { success: true, businessId: explicitBusinessId, fromCookie: false };
  }

  // 2. Baca dari cookie
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return {
      success: false,
      response: {
        success: false,
        error: {
          code: "COOKIE_READ_ERROR",
          message: "Gagal membaca sesi preferensi bisnis aktif dari peramban",
        },
      },
    };
  }

  const rawCookieValue = cookieStore.get(TENANT_COOKIE_NAME)?.value;

  // 2A. Cookie terisi
  if (rawCookieValue !== undefined && rawCookieValue.trim() !== "") {
    const idValidation = uuidSchema.safeParse(rawCookieValue);
    if (!idValidation.success) {
      // Hapus cookie yang rusak
      try {
        cookieStore.delete(TENANT_COOKIE_NAME);
      } catch {
        // safe ignore
      }

      // Fail-closed: Tolak seketika tanpa silent fallback
      return {
        success: false,
        response: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Format ID bisnis pada preferensi aktif tidak valid",
            details: {
              activeBusinessId: idValidation.error.issues.map((i) => i.message),
            },
          },
        },
      };
    }

    return { success: true, businessId: rawCookieValue, fromCookie: true };
  }

  // 2B. Cookie kosong -> Selesaikan bisnis default pengguna
  const tenantResult = await businessService.resolveTenantContext(undefined);

  if (!tenantResult.success) {
    return {
      success: false,
      response: tenantResult,
    };
  }

  if (!tenantResult.data.hasBusiness || !tenantResult.data.activeBusiness) {
    return {
      success: false,
      response: {
        success: false,
        error: {
          code: "ACTIVE_BUSINESS_REQUIRED",
          message: "Bisnis aktif belum dipilih atau pengguna belum memiliki bisnis",
        },
      },
    };
  }

  // Simpan preferensi default ke cookie bila aman dilakukan
  try {
    cookieStore.set(
      TENANT_COOKIE_NAME,
      tenantResult.data.activeBusiness.id,
      TENANT_COOKIE_OPTIONS
    );
  } catch {
    // safe ignore
  }

  return {
    success: true,
    businessId: tenantResult.data.activeBusiness.id,
    fromCookie: false,
  };
}

/**
 * Membersihkan cookie tenant jika ID bermasalah berasal dari pembacaan cookie
 */
async function cleanTenantCookieIfFromCookie(fromCookie: boolean) {
  if (fromCookie) {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(TENANT_COOKIE_NAME);
    } catch {
      // safe ignore
    }
  }
}

/**
 * 1. Mencatat Transaksi Penjualan Kasir POS (createSaleAction)
 */
export async function createSaleAction(
  input: CreateSaleActionInput
): Promise<ApiResponse<SaleReceiptResponse>> {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data input transaksi penjualan tidak valid",
      },
    };
  }

  // 1. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(input.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  // 2. Bentuk payload lengkap untuk service layer.
  // PENTING (SEC-3.3-06): Jangan pernah membangkitkan UUID acak di server jika idempotencyKey tidak ada.
  // Pembangkitan UUID di server memberikan rasa aman semu (false sense of idempotency) karena
  // setiap network retry otomatis dari browser akan menghasilkan UUID baru yang berbeda,
  // sehingga lolos dari deduplikasi Stored Procedure PostgreSQL dan menyebabkan pencatatan ganda.
  // Ketiadaan idempotencyKey ditangani secara fail-closed oleh skema Zod (recordSaleSchema).
  const servicePayload: RecordSaleInput = {
    ...input,
    businessId,
    idempotencyKey: input.idempotencyKey as string,
  };

  // 3. Validasi skema Zod sebelum memanggil service (mencegah pemanggilan mutasi jika input cacat)
  const validationResult = recordSaleSchema.safeParse(servicePayload);
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

  // 4. Delegasikan ke Transaction Service Layer
  const result = await transactionService.recordSale(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 2. Mencatat Pembelian Persediaan / Restock (recordPurchaseAction)
 */
export async function recordPurchaseAction(
  input: RecordPurchaseActionInput
): Promise<ApiResponse<PurchaseReceiptResponse>> {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data input pembelian persediaan tidak valid",
      },
    };
  }

  // 1. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(input.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  // 2. Bentuk payload lengkap untuk service
  const servicePayload: RecordPurchaseInput = {
    ...input,
    businessId,
  };

  // 3. Validasi skema Zod sebelum memanggil service
  const validationResult = recordPurchaseSchema.safeParse(servicePayload);
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

  // 4. Delegasikan ke Transaction Service Layer
  const result = await transactionService.recordPurchase(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 3. Membatalkan Transaksi Penjualan / Void Sale (voidSaleAction)
 */
export async function voidSaleAction(
  input: VoidSaleActionInput
): Promise<ApiResponse<VoidSaleResponse>> {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data input pembatalan transaksi tidak valid",
      },
    };
  }

  // 1. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(input.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  // 2. Bentuk payload lengkap untuk service
  const servicePayload: VoidSaleInput = {
    ...input,
    businessId,
  };

  // 3. Validasi skema Zod sebelum memanggil service
  const validationResult = voidSaleSchema.safeParse(servicePayload);
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

  // 4. Delegasikan ke Transaction Service Layer
  const result = await transactionService.voidSale(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 4. Membaca Produk Aktif untuk Antarmuka Kasir POS (getProductsForTransactionAction)
 */
export async function getProductsForTransactionAction(
  businessId?: string,
  query?: string
): Promise<ApiResponse<ProductItemResponse[]>> {
  // 1. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const serviceOptions: transactionService.GetProductsForTransactionOptions = {
    query,
  };

  const result = await transactionService.getProductsForTransaction(
    tenantResolution.businessId,
    serviceOptions
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}
