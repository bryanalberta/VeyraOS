"use server";

/**
 * VeyraOS Server Actions — Financial Reporting & Business Analytics (Stage 3.3 Batch 3)
 *
 * Mengimplementasikan antarmuka Server Actions untuk laporan finansial dan analitik:
 * 1. getDashboardSummaryAction — Ringkasan 6 kartu KPI, tren omzet Jakarta WIB, 5 transaksi terbaru, dan peringatan stok.
 * 2. getSalesReportAction — Laporan penjualan berpaginasi dengan ringkasan omzet, diskon, dan transaksi dibatalkan (VOIDED).
 * 3. getExpenseReportAction — Laporan beban operasional teragregasi per kategori dan persentase.
 * 4. getStockReportAction — Laporan valuasi modal aset persediaan (MWAC) dan potensi omzet.
 * 5. exportReportCsvAction — Ekspor data ke format CSV RFC 4180 dengan mitigasi Formula Injection (CWE-1236) dan UTF-8 BOM.
 *
 * PRINSIP ARSITEKTUR & KEAMANAN:
 * - Server-Authoritative: businessId diselesaikan di server (eksplisit atau cookie preferensi aktif).
 * - Anti-Silent Fallback: Cookie rusak dibersihkan dan ditolak seketika (fail-closed).
 * - Peniadaan parameter Dependency Injection publik (pola SEC-3.3-05).
 * - Seluruh validasi input diproses menggunakan Zod sebelum mendelegasikan ke service layer.
 */

import { cookies } from "next/headers";
import {
  dashboardQuerySchema,
  salesReportQuerySchema,
  expenseReportQuerySchema,
  stockReportQuerySchema,
  exportReportQuerySchema,
} from "@/lib/validations/report";
import { uuidSchema } from "@/lib/validations/common";
import { formatZodErrorDetails } from "@/services/transactions/error-mapper";
import * as reportService from "@/services/reports/report.service";
import * as businessService from "@/services/business/business.service";
import {
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_OPTIONS,
} from "@/lib/constants/tenant-cookie";
import type {
  ApiResponse,
  DashboardQueryParams,
  DashboardSummaryResponseData,
  GetSalesReportQuery,
  SalesReportResponseData,
  GetExpenseReportQuery,
  ExpenseReportResponseData,
  GetStockReportQuery,
  StockReportResponseData,
  ExportReportInput,
  ReportCsvResult,
} from "@/types/api";

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
 * 1. Membaca Ringkasan Dashboard KPI & Analitik Harian (getDashboardSummaryAction)
 */
export async function getDashboardSummaryAction(
  params?: DashboardQueryParams,
  businessId?: string
): Promise<ApiResponse<DashboardSummaryResponseData>> {
  const explicitBusinessId = params?.businessId ?? businessId;
  const tenantResolution = await resolveEffectiveBusinessId(explicitBusinessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const targetBusinessId = tenantResolution.businessId;

  const validationResult = dashboardQuerySchema.safeParse({
    ...params,
    businessId: targetBusinessId,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri dashboard tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await reportService.getDashboardSummary(
    targetBusinessId,
    validationResult.data
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 2. Membaca Laporan Penjualan (getSalesReportAction)
 */
export async function getSalesReportAction(
  query?: GetSalesReportQuery,
  businessId?: string
): Promise<ApiResponse<SalesReportResponseData>> {
  const explicitBusinessId = query?.businessId ?? businessId;
  const tenantResolution = await resolveEffectiveBusinessId(explicitBusinessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const targetBusinessId = tenantResolution.businessId;

  const validationResult = salesReportQuerySchema.safeParse({
    ...query,
    businessId: targetBusinessId,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri laporan penjualan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await reportService.getSalesReport(
    targetBusinessId,
    validationResult.data
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 3. Membaca Laporan Beban Operasional per Kategori (getExpenseReportAction)
 */
export async function getExpenseReportAction(
  query?: GetExpenseReportQuery,
  businessId?: string
): Promise<ApiResponse<ExpenseReportResponseData>> {
  const explicitBusinessId = query?.businessId ?? businessId;
  const tenantResolution = await resolveEffectiveBusinessId(explicitBusinessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const targetBusinessId = tenantResolution.businessId;

  const validationResult = expenseReportQuerySchema.safeParse({
    ...query,
    businessId: targetBusinessId,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri laporan pengeluaran tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await reportService.getExpenseReport(
    targetBusinessId,
    validationResult.data
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 4. Membaca Laporan Persediaan & Valuasi Modal MWAC (getStockReportAction)
 */
export async function getStockReportAction(
  query?: GetStockReportQuery,
  businessId?: string
): Promise<ApiResponse<StockReportResponseData>> {
  const explicitBusinessId = query?.businessId ?? businessId;
  const tenantResolution = await resolveEffectiveBusinessId(explicitBusinessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const targetBusinessId = tenantResolution.businessId;

  const validationResult = stockReportQuerySchema.safeParse({
    ...query,
    businessId: targetBusinessId,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter kueri laporan stok tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await reportService.getStockReport(
    targetBusinessId,
    validationResult.data
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}

/**
 * 5. Mengekspor Data Laporan ke CSV (exportReportCsvAction)
 * Menghasilkan file CSV RFC 4180 dengan UTF-8 BOM dan mitigasi Formula Injection CWE-1236.
 */
export async function exportReportCsvAction(
  input: ExportReportInput,
  businessId?: string
): Promise<ApiResponse<ReportCsvResult>> {
  const explicitBusinessId = input?.businessId ?? businessId;
  const tenantResolution = await resolveEffectiveBusinessId(explicitBusinessId);
  if (!tenantResolution.success) {
    return tenantResolution.response;
  }

  const targetBusinessId = tenantResolution.businessId;

  const validationResult = exportReportQuerySchema.safeParse({
    ...input,
    businessId: targetBusinessId,
  });

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter ekspor CSV tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const result = await reportService.exportReportCsv(
    targetBusinessId,
    validationResult.data
  );

  if (!result.success && result.error.code === "UNAUTHORIZED_BUSINESS") {
    await cleanTenantCookieIfFromCookie(tenantResolution.fromCookie);
  }

  return result;
}
