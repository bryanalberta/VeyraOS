"use server";

import { cookies } from "next/headers";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
  uuidSchema,
} from "@/lib/validations";
import * as productService from "@/services/products/product.service";
import * as businessService from "@/services/business/business.service";
import { formatZodErrorDetails } from "@/services/transactions/error-mapper";
import type {
  ApiResponse,
  CreateProductInput,
  UpdateProductInput,
  GetProductsQuery,
  ProductItemResponse,
} from "@/types/api";
import {
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_OPTIONS,
} from "@/lib/constants/tenant-cookie";

export type CreateProductActionInput = Omit<CreateProductInput, "businessId"> & {
  businessId?: string;
};

export type GetProductsActionParams = Omit<GetProductsQuery, "businessId"> & {
  businessId?: string;
};

export type UpdateProductActionInput = Omit<UpdateProductInput, "businessId" | "productId"> & {
  productId?: string;
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
      // safe ignore: kegagalan membersihkan cookie tidak melemahkan penolakan otorisasi
    }
  }
}

/**
 * 1. Membuat Produk Baru pada Katalog Bisnis (createProductAction)
 */
export async function createProductAction(
  input: CreateProductActionInput
): Promise<ApiResponse<ProductItemResponse>> {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data input produk tidak valid",
      },
    };
  }

  // 1. Integritas Ledger Stok Awal (Defense-in-Depth):
  // Menolak stok awal > 0 sebelum mutasi karena RPC transaksi atomik multi-tabel belum tersedia
  if (input.stockQuantity !== undefined && input.stockQuantity > 0) {
    return {
      success: false,
      error: {
        code: "ATOMIC_INITIAL_STOCK_UNAVAILABLE",
        message:
          "Pencatatan produk dengan stok awal > 0 memerlukan mekanisme transaksi atomik database (RPC) yang belum tersedia pada skema migrasi saat ini. Buat produk dengan stok 0 lalu lakukan restock melalui transaksi pembelian, atau tunggu migrasi Stored Procedure pencatatan stok awal.",
      },
    };
  }

  // 2. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(input.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  // 3. Bentuk payload lengkap untuk service
  const servicePayload: CreateProductInput = {
    ...input,
    businessId,
  };

  // 4. Validasi skema Zod sebelum memanggil service
  const validationResult = createProductSchema.safeParse(servicePayload);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data produk yang dikirimkan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  // 5. Delegasikan ke Product Service Layer
  const result = await productService.createProduct(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 2. Membaca Daftar Produk dengan Filter dan Pencarian (getProductsAction)
 */
export async function getProductsAction(
  params?: GetProductsActionParams
): Promise<ApiResponse<ProductItemResponse[]>> {
  const effectiveParams = params ?? {};

  // 1. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(effectiveParams.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const queryParams: GetProductsQuery = {
    ...effectiveParams,
    businessId: tenantResolution.businessId,
  };

  // 2. Validasi parameter query
  const validationResult = getProductsQuerySchema.safeParse(queryParams);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter pencarian produk tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  // 3. Delegasikan ke Product Service Layer
  const result = await productService.getProducts(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 3. Mengambil Detail Satu Produk Berdasarkan ID (getProductByIdAction)
 */
export async function getProductByIdAction(
  productId: string,
  businessId?: string
): Promise<ApiResponse<ProductItemResponse>> {
  // 1. Validasi format UUID productId
  const idValidation = uuidSchema.safeParse(productId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk tidak valid",
        details: { id: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  // 2. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  // 3. Delegasikan ke Product Service Layer
  const result = await productService.getProductById(productId, tenantResolution.businessId);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 4. Memperbarui Metadata Produk (updateProductAction)
 *
 * Menerima productId dan UpdateProductActionInput, atau objek gabungan { productId, ...input }.
 * Mutasi langsung pada stockQuantity atau costPrice DITOLAK (FORBIDDEN_FIELD_MUTATION).
 */
export async function updateProductAction(
  productIdOrInput: string | (UpdateProductActionInput & { productId: string }),
  inputOrUndefined?: UpdateProductActionInput
): Promise<ApiResponse<ProductItemResponse>> {
  let productId: string;
  let input: UpdateProductActionInput;

  if (typeof productIdOrInput === "string") {
    productId = productIdOrInput;
    input = inputOrUndefined ?? {};
  } else if (productIdOrInput && typeof productIdOrInput === "object") {
    productId = productIdOrInput.productId;
    input = productIdOrInput;
  } else {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter pembaruan produk tidak valid",
      },
    };
  }

  // 1. Integritas Ledger Finansial & Stok (Defense-in-Depth):
  // DILARANG keras memutasi stok dan HPP secara langsung via updateProductAction.
  if (input.stockQuantity !== undefined || input.costPrice !== undefined) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN_FIELD_MUTATION",
        message:
          "Perubahan stock_quantity dan cost_price tidak diizinkan melalui updateProduct. Mutasi persediaan fisik dan HPP harus dicatat melalui transaksi pembelian (restock), penjualan, void, atau penyesuaian persediaan teraudit.",
      },
    };
  }

  // 2. Validasi format ID produk
  const idValidation = uuidSchema.safeParse(productId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk tidak valid",
        details: { id: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  // 3. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(input.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const payloadToValidate = {
    ...input,
    productId,
    businessId: tenantResolution.businessId,
  };

  // 4. Validasi skema Zod sebelum memanggil service
  const validationResult = updateProductSchema.safeParse(payloadToValidate);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembaruan produk tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  // 5. Delegasikan ke Product Service Layer
  const result = await productService.updateProduct(productId, validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 5. Mengarsipkan Produk (archiveProductAction)
 *
 * Menerapkan Soft-Delete (is_archived = true).
 */
export async function archiveProductAction(
  productIdOrInput: string | { productId: string; businessId?: string },
  businessIdOrUndefined?: string
): Promise<ApiResponse<ProductItemResponse>> {
  let productId: string;
  let businessId: string | undefined;

  if (typeof productIdOrInput === "string") {
    productId = productIdOrInput;
    businessId = businessIdOrUndefined;
  } else if (productIdOrInput && typeof productIdOrInput === "object") {
    productId = productIdOrInput.productId;
    businessId = productIdOrInput.businessId;
  } else {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk tidak valid",
      },
    };
  }

  // 1. Validasi format ID produk
  const idValidation = uuidSchema.safeParse(productId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk tidak valid",
        details: { id: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  // 2. Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  // 3. Delegasikan ke Product Service Layer
  const result = await productService.archiveProduct(productId, tenantResolution.businessId);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}
