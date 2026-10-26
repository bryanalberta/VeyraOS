"use server";

/**
 * VeyraOS Server Actions — Operational Expense Management (Stage 3.3 Batch 3)
 *
 * Mengimplementasikan antarmuka Server Actions untuk pengelolaan beban operasional:
 * 1. recordExpenseAction — Pencatatan beban operasional baru dengan kategori baku dan Rupiah positif.
 * 2. getExpensesAction — Pembacaan riwayat beban operasional dengan filter tanggal dan kategori.
 * 3. getExpenseByIdAction — Pembacaan rincian satu catatan beban operasional.
 * 4. updateExpenseAction — Pembaruan administratif metadata catatan beban operasional.
 * 5. deleteExpenseAction — Menolak penghapusan fisik destruktif (DESTRUCTIVE_DELETION_FORBIDDEN)
 *    demi integritas jejak audit dan laporan finansial historis.
 *
 * PRINSIP ARSITEKTUR & KEAMANAN:
 * - Server-Authoritative: businessId diselesaikan di server (eksplisit atau cookie preferensi aktif).
 * - Anti-Silent Fallback: Cookie rusak dibersihkan dan ditolak seketika (fail-closed).
 * - Tidak mengekspos dependency injection atau opsi konfigurasi internal pada kontrak publik.
 * - Validasi input ketat menggunakan Zod sebelum mendelegasikan ke service layer.
 */

import { cookies } from "next/headers";
import {
  recordExpenseSchema,
  updateExpenseSchema,
  getExpensesQuerySchema,
  uuidSchema,
} from "@/lib/validations";
import { formatZodErrorDetails } from "@/services/transactions/error-mapper";
import * as expenseService from "@/services/expenses/expense.service";
import * as businessService from "@/services/business/business.service";
import {
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_OPTIONS,
} from "@/lib/constants/tenant-cookie";
import type {
  ApiResponse,
  RecordExpenseInput,
  UpdateExpenseInput,
  GetExpensesQuery,
  ExpenseResponseData,
} from "@/types/api";
import type { ExpenseCategory } from "@/types/database";

export interface RecordExpenseActionInput {
  businessId?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate?: string;
}

export interface GetExpensesActionParams {
  businessId?: string;
  startDate?: string;
  endDate?: string;
  category?: ExpenseCategory;
}

export interface UpdateExpenseActionInput {
  expenseId?: string;
  businessId?: string;
  category?: ExpenseCategory;
  amount?: number;
  description?: string;
  expenseDate?: string;
}

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
 * 1. Mencatat Pengeluaran Operasional Baru (recordExpenseAction)
 */
export async function recordExpenseAction(
  input: RecordExpenseActionInput
): Promise<ApiResponse<ExpenseResponseData>> {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data input pengeluaran operasional tidak valid",
      },
    };
  }

  // Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(input.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  // Bentuk payload lengkap untuk service
  const servicePayload: RecordExpenseInput = {
    ...input,
    businessId,
  };

  // Validasi skema Zod sebelum memanggil service
  const validationResult = recordExpenseSchema.safeParse(servicePayload);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pengeluaran operasional yang dikirimkan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  // Panggil service layer
  const result = await expenseService.recordExpense(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 2. Membaca Daftar Riwayat Pengeluaran Operasional (getExpensesAction)
 */
export async function getExpensesAction(
  params?: GetExpensesActionParams
): Promise<ApiResponse<ExpenseResponseData[]>> {
  // Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(params?.businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  const queryPayload: GetExpensesQuery = {
    ...params,
    businessId,
  };

  // Validasi parameter query menggunakan Zod
  const validationResult = getExpensesQuerySchema.safeParse(queryPayload);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter filter pengeluaran tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await expenseService.getExpenses(validationResult.data);

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 3. Membaca Rincian Satu Pengeluaran per ID (getExpenseByIdAction)
 */
export async function getExpenseByIdAction(
  id: string,
  businessId?: string
): Promise<ApiResponse<ExpenseResponseData>> {
  const idValidation = uuidSchema.safeParse(id);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID pengeluaran tidak valid",
        details: {
          id: idValidation.error.issues.map((i) => i.message),
        },
      },
    };
  }

  const tenantResolution = await resolveEffectiveBusinessId(businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const result = await expenseService.getExpenseById(
    id,
    tenantResolution.businessId
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 4. Memperbarui Catatan Pengeluaran Operasional (updateExpenseAction)
 * Mendukung dua bentuk pemanggilan:
 * 1. updateExpenseAction(id, input)
 * 2. updateExpenseAction({ expenseId, ...input })
 */
export async function updateExpenseAction(
  idOrInput: string | UpdateExpenseActionInput,
  inputOrBusinessId?: UpdateExpenseActionInput | string
): Promise<ApiResponse<ExpenseResponseData>> {
  let expenseId: string;
  let updateData: UpdateExpenseActionInput;
  let explicitBusinessId: string | undefined;

  if (typeof idOrInput === "string") {
    expenseId = idOrInput;
    updateData = (inputOrBusinessId as UpdateExpenseActionInput) ?? {};
    explicitBusinessId = updateData.businessId;
  } else if (idOrInput && typeof idOrInput === "object") {
    if (!idOrInput.expenseId) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "ID pengeluaran wajib disertakan pada pembaruan catatan",
        },
      };
    }
    expenseId = idOrInput.expenseId;
    updateData = idOrInput;
    explicitBusinessId =
      typeof inputOrBusinessId === "string"
        ? inputOrBusinessId
        : idOrInput.businessId;
  } else {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter pembaruan pengeluaran tidak valid",
      },
    };
  }

  // Validasi ID pengeluaran
  const idValidation = uuidSchema.safeParse(expenseId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID pengeluaran tidak valid",
        details: {
          id: idValidation.error.issues.map((i) => i.message),
        },
      },
    };
  }

  // Selesaikan businessId secara server-authoritative
  const tenantResolution = await resolveEffectiveBusinessId(explicitBusinessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const businessId = tenantResolution.businessId;

  // Bentuk payload lengkap untuk service
  const servicePayload: UpdateExpenseInput = {
    ...updateData,
    expenseId,
    businessId,
  };

  // Validasi skema Zod sebelum memanggil service
  const validationResult = updateExpenseSchema.safeParse(servicePayload);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembaruan pengeluaran tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await expenseService.updateExpense(
    expenseId,
    validationResult.data
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 5. Menolak Penghapusan Fisik Beban Operasional (deleteExpenseAction)
 *
 * Menerapkan prinsip non-destruktif: seluruh catatan pengeluaran historis
 * dilarang keras dihapus secara permanen demi menjaga integritas jejak audit
 * dan laporan finansial (DESTRUCTIVE_DELETION_FORBIDDEN).
 */
export async function deleteExpenseAction(
  id: string,
  businessId?: string
): Promise<ApiResponse<ExpenseResponseData>> {
  const idValidation = uuidSchema.safeParse(id);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID pengeluaran tidak valid",
        details: {
          id: idValidation.error.issues.map((i) => i.message),
        },
      },
    };
  }

  const tenantResolution = await resolveEffectiveBusinessId(businessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const result = await expenseService.deleteExpense(
    id,
    tenantResolution.businessId
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}
