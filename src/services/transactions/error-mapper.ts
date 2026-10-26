/**
 * VeyraOS Service Layer — Database Error Mapper & Sanitizer
 *
 * Menerjemahkan error mentah PostgreSQL / PostgREST / RPC / Jaringan ke dalam format
 * respon domain terpadu ApiResponse<never> tanpa membocorkan detail internal database,
 * skema tabel, atau credential sistem.
 */

import { z } from "zod";
import type { ApiResponse } from "@/types/api";

export interface DatabaseErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Memformat ZodError menjadi Record<string, string[]> yang ramah UI form
 */
export function formatZodErrorDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const pathKey = issue.path.join(".") || "root";
    if (!details[pathKey]) {
      details[pathKey] = [];
    }
    details[pathKey].push(issue.message);
  }

  return details;
}

/**
 * Memetakan error database / RPC / Supabase ke ApiResponse error envelope
 */
export function mapDatabaseErrorToApiResponse<T = never>(error: unknown): ApiResponse<T> {
  if (!error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan sistem yang tidak terduga",
      },
    };
  }

  const err = error as DatabaseErrorLike;
  const message = (err.message ?? "").trim();
  const code = (err.code ?? "").trim();

  // 1. Error Domain Tertentu dari Stored Procedure (RAISE EXCEPTION)
  if (message.includes("STOCK_INSUFFICIENT")) {
    return {
      success: false,
      error: {
        code: "STOCK_INSUFFICIENT",
        message: message.replace(/^STOCK_INSUFFICIENT:\s*/, "") || "Stok produk tidak mencukupi untuk transaksi ini",
      },
    };
  }

  if (message.includes("PRODUCT_NOT_FOUND")) {
    return {
      success: false,
      error: {
        code: "PRODUCT_NOT_FOUND",
        message: "Satu atau lebih produk tidak ditemukan dalam katalog bisnis ini",
      },
    };
  }

  if (message.includes("PRODUCT_ARCHIVED")) {
    return {
      success: false,
      error: {
        code: "PRODUCT_ARCHIVED",
        message:
          message.replace(/^PRODUCT_ARCHIVED:?\s*/, "").trim() ||
          "Produk telah diarsipkan dan tidak dapat digunakan dalam transaksi",
      },
    };
  }

  if (message.includes("INVALID_DISCOUNT")) {
    return {
      success: false,
      error: {
        code: "INVALID_DISCOUNT",
        message: "Nominal diskon tidak valid atau melebihi total subtotal",
      },
    };
  }

  if (message.includes("UNAUTHORIZED_BUSINESS")) {
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED_BUSINESS",
        message: "Pengguna tidak memiliki hak akses atau keanggotaan pada bisnis ini",
      },
    };
  }

  if (message.includes("SALE_ALREADY_VOIDED")) {
    return {
      success: false,
      error: {
        code: "SALE_ALREADY_VOIDED",
        message: "Transaksi penjualan ini sudah pernah dibatalkan sebelumnya",
      },
    };
  }

  if (message.includes("SALE_NOT_FOUND")) {
    return {
      success: false,
      error: {
        code: "SALE_NOT_FOUND",
        message: "Data transaksi penjualan tidak ditemukan",
      },
    };
  }

  if (message.includes("INVALID_VOID_REASON")) {
    return {
      success: false,
      error: {
        code: "INVALID_VOID_REASON",
        message: "Alasan pembatalan transaksi minimal 5 karakter",
      },
    };
  }

  if (message.includes("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD")) {
    return {
      success: false,
      error: {
        code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
        message: "Kunci idempotensi sudah pernah digunakan dengan data transaksi yang berbeda",
      },
    };
  }

  if (message.includes("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION")) {
    return {
      success: false,
      error: {
        code: "IDEMPOTENCY_ACTION_MISMATCH",
        message: "Kunci idempotensi sudah pernah digunakan untuk jenis operasi transaksi lain",
      },
    };
  }

  if (message.includes("IDEMPOTENCY_KEY_REUSED_BY_DIFFERENT_USER")) {
    return {
      success: false,
      error: {
        code: "IDEMPOTENCY_USER_MISMATCH",
        message: "Kunci idempotensi terikat pada pengguna lain",
      },
    };
  }

  if (message.includes("INVALID_IDEMPOTENCY_KEY")) {
    return {
      success: false,
      error: {
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Kunci idempotensi tidak valid (panjang harus antara 8 dan 128 karakter)",
      },
    };
  }

  if (message.includes("INVALID_INVOICE_NUMBER")) {
    return {
      success: false,
      error: {
        code: "INVALID_INVOICE_NUMBER",
        message: "Nomor faktur tidak valid atau kurang dari 3 karakter",
      },
    };
  }

  if (message.includes("EMPTY_SALE_ITEMS") || message.includes("EMPTY_PURCHASE_ITEMS")) {
    return {
      success: false,
      error: {
        code: "EMPTY_ITEMS",
        message: "Transaksi harus memuat minimal satu item produk",
      },
    };
  }

  if (message.includes("INVALID_PURCHASE_COST")) {
    return {
      success: false,
      error: {
        code: "INVALID_PURCHASE_COST",
        message: "Harga beli satuan tidak boleh bernilai negatif",
      },
    };
  }

  // 2. Kode Error PostgreSQL Standar (SQLSTATE)
  if (code === "23505") {
    // Unique Violation
    if (message.includes("uq_sales_invoice") || message.includes("uq_purchases_invoice")) {
      return {
        success: false,
        error: {
          code: "INVOICE_COLLISION",
          message: "Terjadi benturan nomor faktur pada sistem, silakan coba kembali",
        },
      };
    }

    if (message.includes("uq_idempotency_key")) {
      return {
        success: false,
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "Transaksi dengan kunci idempotensi ini sedang diproses atau sudah tercatat",
        },
      };
    }

    if (
      message.includes("uq_products_sku_per_business") ||
      Boolean(err.details && err.details.includes("uq_products_sku_per_business"))
    ) {
      return {
        success: false,
        error: {
          code: "SKU_ALREADY_EXISTS",
          message: "SKU produk sudah digunakan dalam bisnis ini",
        },
      };
    }

    return {
      success: false,
      error: {
        code: "UNIQUE_VIOLATION",
        message: "Data transaksi melanggar batasan keunikan sistem",
      },
    };
  }

  if (code === "23503") {
    // Foreign Key Violation
    return {
      success: false,
      error: {
        code: "FOREIGN_KEY_VIOLATION",
        message: "Referensi data (produk atau bisnis) tidak ditemukan di database",
      },
    };
  }

  if (code === "23514") {
    // Check Constraint Violation
    return {
      success: false,
      error: {
        code: "CHECK_CONSTRAINT_VIOLATION",
        message: "Nilai transaksi melanggar batasan validasi integritas finansial database",
      },
    };
  }

  // 3. Masalah Koneksi Jaringan & Timeout
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("timeout")
  ) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Gagal terhubung ke layanan basis data, silakan periksa koneksi internet Anda",
      },
    };
  }

  // 4. Default Sanitized Internal Error (Jangan membocorkan query atau struktur DB)
  return {
    success: false,
    error: {
      code: "DATABASE_ERROR",
      message: "Terjadi kendala pada basis data saat memproses transaksi",
    },
  };
}
