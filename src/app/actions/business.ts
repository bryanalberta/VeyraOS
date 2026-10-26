"use server";

import { cookies } from "next/headers";
import { uuidSchema } from "@/lib/validations/common";
import { updateBusinessSchema } from "@/lib/validations/business";
import {
  createBusiness,
  updateBusiness,
  resolveTenantContext,
  type BusinessServiceOptions,
} from "@/services/business/business.service";
import type {
  ApiResponse,
  BusinessResponseData,
  TenantContextResponse,
  CreateBusinessInput,
  UpdateBusinessInput,
} from "@/types/api";
import {
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_OPTIONS,
} from "@/lib/constants/tenant-cookie";

/**
 * 1. Pembuatan Bisnis Baru (createBusinessAction)
 *
 * Menerima CreateBusinessInput, mendelegasikan ke service layer createBusiness.
 * Jika berhasil, otomatis menetapkan bisnis baru tersebut sebagai tenant aktif di cookie.
 * Jika gagal, cookie sama sekali tidak dipasang atau diubah.
 */
export async function createBusinessAction(
  input: CreateBusinessInput,
  options?: BusinessServiceOptions
): Promise<ApiResponse<BusinessResponseData>> {
  const result = await createBusiness(input, options);

  if (!result.success) {
    // Jangan memasang cookie jika pembuatan bisnis gagal
    return result;
  }

  // Setelah createBusinessAction berhasil, tetapkan bisnis yang baru dibuat sebagai tenant aktif.
  try {
    const cookieStore = await cookies();
    cookieStore.set(TENANT_COOKIE_NAME, result.data.id, TENANT_COOKIE_OPTIONS);
  } catch {
    // Pastikan kegagalan cookies() atau penulisan cookie ditangani dengan aman dan tidak menghasilkan respons sukses palsu
    return {
      success: false,
      error: {
        code: "COOKIE_WRITE_ERROR",
        message:
          "Bisnis berhasil dibuat, tetapi gagal menyimpan preferensi bisnis aktif. Silakan pilih bisnis secara manual.",
      },
    };
  }

  return result;
}

/**
 * 2. Mengganti Bisnis Aktif (switchActiveBusinessAction)
 *
 * Memvalidasi ID bisnis, memverifikasi keanggotaan/hak akses pengguna ke bisnis tersebut
 * sebelum menetapkan cookie veyra_active_business_id.
 */
export async function switchActiveBusinessAction(
  businessId: string,
  options?: BusinessServiceOptions
): Promise<ApiResponse<{ activeBusinessId: string }>> {
  const idValidation = uuidSchema.safeParse(businessId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID bisnis tidak valid",
        details: { businessId: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  // Validasi akses ke bisnis sebelum menetapkan cookie
  const tenantResult = await resolveTenantContext(businessId, options);
  if (!tenantResult.success) {
    // Jangan mengubah error database atau error tak terduga menjadi UNAUTHORIZED_BUSINESS
    // Jangan menetapkan cookie jika bisnis tidak dapat diakses
    return {
      success: false,
      error: tenantResult.error,
    };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(TENANT_COOKIE_NAME, businessId, TENANT_COOKIE_OPTIONS);
  } catch {
    return {
      success: false,
      error: {
        code: "COOKIE_WRITE_ERROR",
        message: "Gagal menyimpan preferensi bisnis aktif ke peramban",
      },
    };
  }

  return {
    success: true,
    data: {
      activeBusinessId: businessId,
    },
  };
}

/**
 * 3. Membaca Konteks Tenant Aktif (getActiveTenantContextAction)
 *
 * Membaca preferensi tenant dari cookie veyra_active_business_id di server.
 * Menerapkan prinsip Fail-Closed ketat: Jika cookie ada tapi tidak valid atau pengguna
 * bukan anggota, bersihkan cookie dan tolak seketika tanpa silent fallback ke bisnis lain.
 * Jika cookie kosong, tentukan bisnis default secara deterministik.
 */
export async function getActiveTenantContextAction(
  options?: BusinessServiceOptions
): Promise<ApiResponse<TenantContextResponse>> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return {
      success: false,
      error: {
        code: "COOKIE_READ_ERROR",
        message: "Gagal membaca sesi preferensi bisnis aktif dari peramban",
      },
    };
  }

  const rawCookieValue = cookieStore.get(TENANT_COOKIE_NAME)?.value;

  // Kasus 1: Cookie aktif ada
  if (rawCookieValue !== undefined && rawCookieValue.trim() !== "") {
    // Validasi format UUID cookie terlebih dahulu
    const idValidation = uuidSchema.safeParse(rawCookieValue);
    if (!idValidation.success) {
      // Cookie berisi UUID tidak valid: bersihkan cookie bila aman dilakukan
      try {
        cookieStore.delete(TENANT_COOKIE_NAME);
      } catch {
        // safe ignore
      }

      // Fail-closed: Tolak seketika tanpa silent fallback
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Format ID bisnis pada preferensi aktif tidak valid",
          details: {
            activeBusinessId: idValidation.error.issues.map((i) => i.message),
          },
        },
      };
    }

    const tenantResult = await resolveTenantContext(rawCookieValue, options);

    if (!tenantResult.success) {
      // Jika tenant tidak dapat diakses (UNAUTHORIZED_BUSINESS), bersihkan cookie
      if (tenantResult.error.code === "UNAUTHORIZED_BUSINESS") {
        try {
          cookieStore.delete(TENANT_COOKIE_NAME);
        } catch {
          // safe ignore
        }
      }

      // Fail-closed: Kembalikan error langsung, JANGAN fallback ke bisnis lain
      return tenantResult;
    }

    return tenantResult;
  }

  // Kasus 2: Cookie kosong/belum disetel
  const tenantResult = await resolveTenantContext(undefined, options);

  if (
    tenantResult.success &&
    tenantResult.data.hasBusiness &&
    tenantResult.data.activeBusiness
  ) {
    try {
      cookieStore.set(
        TENANT_COOKIE_NAME,
        tenantResult.data.activeBusiness.id,
        TENANT_COOKIE_OPTIONS
      );
    } catch {
      // Non-blocking saat menetapkan preferensi awal
    }
  }

  return tenantResult;
}

export interface UpdateBusinessActionInput {
  businessId?: string;
  name?: string;
  category?: string;
  phone?: string;
  address?: string;
}

/**
 * 4. Memperbarui Metadata Bisnis (updateBusinessAction)
 *
 * Menerima UpdateBusinessActionInput, menyelesaikan businessId secara server-authoritative
 * (dari input eksplisit jika ada, atau membaca preferensi cookie aktif).
 * Memvalidasi input melalui updateBusinessSchema.
 * Memanggil businessService.updateBusiness untuk memeriksa otorisasi pemilik (FORBIDDEN_NOT_OWNER)
 * dan memperbarui data bisnis secara aman.
 */
export async function updateBusinessAction(
  input: UpdateBusinessActionInput,
  options?: BusinessServiceOptions
): Promise<ApiResponse<BusinessResponseData>> {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembaruan bisnis tidak valid",
      },
    };
  }

  // 1. Tentukan target businessId secara server-authoritative
  let targetBusinessId = input.businessId?.trim();

  if (targetBusinessId) {
    const idValidation = uuidSchema.safeParse(targetBusinessId);
    if (!idValidation.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Format ID bisnis tidak valid",
          details: { businessId: idValidation.error.issues.map((i) => i.message) },
        },
      };
    }
  } else {
    // Baca dari preferensi tenant aktif (cookie / default)
    let cookieStore: Awaited<ReturnType<typeof cookies>>;
    try {
      cookieStore = await cookies();
    } catch {
      return {
        success: false,
        error: {
          code: "COOKIE_READ_ERROR",
          message: "Gagal membaca sesi preferensi bisnis aktif dari peramban",
        },
      };
    }

    const rawCookieValue = cookieStore.get(TENANT_COOKIE_NAME)?.value;
    if (rawCookieValue !== undefined && rawCookieValue.trim() !== "") {
      const idValidation = uuidSchema.safeParse(rawCookieValue);
      if (!idValidation.success) {
        try {
          cookieStore.delete(TENANT_COOKIE_NAME);
        } catch {
          // safe ignore
        }
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Format ID bisnis pada preferensi aktif tidak valid",
            details: {
              activeBusinessId: idValidation.error.issues.map((i) => i.message),
            },
          },
        };
      }
      targetBusinessId = rawCookieValue;
    } else {
      // Cookie kosong -> selesaikan default
      const tenantResult = await resolveTenantContext(undefined, options);
      if (!tenantResult.success) {
        return tenantResult;
      }
      if (!tenantResult.data.hasBusiness || !tenantResult.data.activeBusiness) {
        return {
          success: false,
          error: {
            code: "ACTIVE_BUSINESS_REQUIRED",
            message: "Bisnis aktif belum dipilih atau pengguna belum memiliki bisnis",
          },
        };
      }
      targetBusinessId = tenantResult.data.activeBusiness.id;
    }
  }

  // 2. Validasi input menggunakan updateBusinessSchema
  const payloadToValidate: UpdateBusinessInput = {
    ...input,
    businessId: targetBusinessId,
  };

  const validationResult = updateBusinessSchema.safeParse(payloadToValidate);
  if (!validationResult.success) {
    const errorDetails: Record<string, string[]> = {};
    for (const issue of validationResult.error.issues) {
      const field = issue.path.join(".") || "business";
      if (!errorDetails[field]) errorDetails[field] = [];
      errorDetails[field].push(issue.message);
    }
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembaruan bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  // 3. Panggil service layer updateBusiness
  return updateBusiness(targetBusinessId, validationResult.data, options);
}
