/**
 * VeyraOS Operational Expense Service Layer
 *
 * Sesuai spesifikasi Phase 4, Substage 3.2.2B:
 * - Terpisah dari UI dan Server Actions.
 * - Menggunakan Supabase server client resmi.
 * - Memeriksa otorisasi sesi pengguna & keanggotaan bisnis di sisi server (Defense-in-Depth).
 * - Tidak mempercayai businessId dari klien tanpa verifikasi server.
 * - Memvalidasi seluruh input menggunakan skema Zod (recordExpenseSchema, updateExpenseSchema, getExpensesQuerySchema, uuidSchema).
 * - Menjaga isolasi multi-tenant pada seluruh operasi baca dan tulis (business_id).
 * - Mendukung operasi: recordExpense, getExpenses, getExpenseById, updateExpense, deleteExpense.
 * - Penghapusan beban operasional (deleteExpense) didukung secara eksplisit oleh skema database & kebijakan RLS
 *   (expenses_delete_member) sebagai pencatatan pengeluaran kas independen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  recordExpenseSchema,
  updateExpenseSchema,
  getExpensesQuerySchema,
  uuidSchema,
} from "@/lib/validations";
import {
  mapDatabaseErrorToApiResponse,
  formatZodErrorDetails,
} from "@/services/transactions/error-mapper";
import { verifyUserAndBusinessMembership } from "@/services/common/auth-guard";
import type {
  ApiResponse,
  RecordExpenseInput,
  UpdateExpenseInput,
  GetExpensesQuery,
  ExpenseResponseData,
} from "@/types/api";
import type { ExpenseCategory } from "@/types/database";

export interface ExpenseServiceOptions {
  /**
   * Klien Supabase opsional untuk Dependency Injection / Unit Testing dengan Mock.
   * Jika tidak disediakan, memanggil createClient() dari @/lib/supabase/server.
   */
  supabase?: SupabaseClient;

  /**
   * User ID opsional untuk pengujian mock terisolasi.
   */
  userId?: string;
}

interface ExpenseDatabaseRow {
  id: string;
  business_id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const EXPENSE_SELECT_COLUMNS =
  "id, business_id, expense_date, category, amount, notes, created_at, updated_at";

/**
 * Memetakan baris database pengeluaran ke DTO ExpenseResponseData bertipe aman
 */
function mapExpenseRowToResponse(row: ExpenseDatabaseRow): ExpenseResponseData {
  return {
    id: row.id,
    businessId: row.business_id,
    category: row.category,
    amount: Number(row.amount),
    description: row.notes ?? "",
    expenseDate: row.expense_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 1. Mencatat Pengeluaran Operasional Baru (recordExpense)
 */
export async function recordExpense(
  input: RecordExpenseInput,
  options?: ExpenseServiceOptions
): Promise<ApiResponse<ExpenseResponseData>> {
  // 1. Validasi input menggunakan Zod
  const validationResult = recordExpenseSchema.safeParse(input);
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

  const validated = validationResult.data;

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis di sisi server
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Simpan catatan pengeluaran ke tabel expenses
  try {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        business_id: validated.businessId,
        category: validated.category,
        amount: validated.amount,
        notes: validated.description,
        expense_date: validated.expenseDate ?? new Date().toISOString(),
      })
      .select(EXPENSE_SELECT_COLUMNS)
      .single();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "Gagal menyimpan catatan pengeluaran ke basis data",
        },
      };
    }

    return {
      success: true,
      data: mapExpenseRowToResponse(data as unknown as ExpenseDatabaseRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 2. Mengambil Daftar Pengeluaran dengan Filter dan Pengurutan (getExpenses)
 */
export async function getExpenses(
  params: GetExpensesQuery,
  options?: ExpenseServiceOptions
): Promise<ApiResponse<ExpenseResponseData[]>> {
  // 1. Validasi parameter query
  const validationResult = getExpensesQuerySchema.safeParse(params);
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

  const validated = validationResult.data;

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Eksekusi query dengan isolasi multi-tenant yang ketat
  try {
    let query = supabase
      .from("expenses")
      .select(EXPENSE_SELECT_COLUMNS)
      .eq("business_id", validated.businessId);

    if (validated.category) {
      query = query.eq("category", validated.category);
    }

    if (validated.startDate) {
      query = query.gte("expense_date", validated.startDate);
    }

    if (validated.endDate) {
      query = query.lte("expense_date", validated.endDate);
    }

    // Urutkan kronologis terbaru (sesuai idx_expenses_business_date)
    query = query.order("expense_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    const rows = (data || []) as unknown as ExpenseDatabaseRow[];
    return {
      success: true,
      data: rows.map(mapExpenseRowToResponse),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 3. Mengambil Detail Satu Pengeluaran Berdasarkan ID (getExpenseById)
 */
export async function getExpenseById(
  id: string,
  businessId: string,
  options?: ExpenseServiceOptions
): Promise<ApiResponse<ExpenseResponseData>> {
  // 1. Validasi ID dan businessId
  const idValidation = uuidSchema.safeParse(id);
  const businessIdValidation = uuidSchema.safeParse(businessId);

  if (!idValidation.success || !businessIdValidation.success) {
    const errorDetails: Record<string, string[]> = {};
    if (!idValidation.success) {
      errorDetails.id = idValidation.error.issues.map((i) => i.message);
    }
    if (!businessIdValidation.success) {
      errorDetails.businessId = businessIdValidation.error.issues.map((i) => i.message);
    }

    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID pengeluaran atau ID bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Ambil pengeluaran dengan filter business_id wajib
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select(EXPENSE_SELECT_COLUMNS)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Catatan pengeluaran tidak ditemukan dalam bisnis ini",
        },
      };
    }

    return {
      success: true,
      data: mapExpenseRowToResponse(data as unknown as ExpenseDatabaseRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 4. Memperbarui Catatan Pengeluaran (updateExpense)
 */
export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
  options?: ExpenseServiceOptions
): Promise<ApiResponse<ExpenseResponseData>> {
  // 1. Validasi ID pengeluaran dan deteksi ID mismatch
  const idValidation = uuidSchema.safeParse(id);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID pengeluaran tidak valid",
        details: { id: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  if (input.expenseId && input.expenseId !== id) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "ID pengeluaran pada URL tidak cocok dengan payload",
        details: { expenseId: ["ID pengeluaran pada URL tidak cocok dengan payload"] },
      },
    };
  }

  const payloadToValidate = {
    ...input,
    expenseId: id,
  };

  const validationResult = updateExpenseSchema.safeParse(payloadToValidate);
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

  const validated = validationResult.data;

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Susun hanya field yang diizinkan untuk di-update (whitelist ketat)
  const updateData: Record<string, unknown> = {};
  if (validated.category !== undefined) updateData.category = validated.category;
  if (validated.amount !== undefined) updateData.amount = validated.amount;
  if (validated.description !== undefined) updateData.notes = validated.description;
  if (validated.expenseDate !== undefined) updateData.expense_date = validated.expenseDate;

  // Jika tidak ada perubahan field yang dikirim, kembalikan data saat ini
  if (Object.keys(updateData).length === 0) {
    return getExpenseById(id, validated.businessId, options);
  }

  // 5. Eksekusi pembaruan dengan batasan tenant wajib
  try {
    const { data, error } = await supabase
      .from("expenses")
      .update(updateData)
      .eq("id", id)
      .eq("business_id", validated.businessId)
      .select(EXPENSE_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Catatan pengeluaran tidak ditemukan dalam bisnis ini",
        },
      };
    }

    return {
      success: true,
      data: mapExpenseRowToResponse(data as unknown as ExpenseDatabaseRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 5. Penghapusan Catatan Pengeluaran (deleteExpense)
 *
 * PERINGATAN KEBIJAKAN FINANSIAL (ACT-3.2.2B-01 & PRD Bagian 5 Butir 6):
 * VeyraOS melarang keras penghapusan fisik (hard delete) destruktif terhadap catatan
 * beban pengeluaran operasional historis demi menjaga integritas laporan laba rugi,
 * arus kas, dan jejak audit.
 *
 * Jalur hard delete fisik melalui PostgREST ditutup di lapisan service layer aplikasi.
 * Jika terdapat kesalahan entri administratif, pengguna diarahkan untuk melakukan koreksi
 * melalui pembaruan catatan (updateExpense). Mekanisme pembatalan/arsip formal (soft-delete)
 * akan dirancang terpisah pada tahap schema & migration forward-only berikutnya.
 */
export async function deleteExpense(
  id: string,
  businessId: string,
  options?: ExpenseServiceOptions
): Promise<ApiResponse<ExpenseResponseData>> {
  // 1. Validasi ID dan businessId
  const idValidation = uuidSchema.safeParse(id);
  const businessIdValidation = uuidSchema.safeParse(businessId);

  if (!idValidation.success || !businessIdValidation.success) {
    const errorDetails: Record<string, string[]> = {};
    if (!idValidation.success) {
      errorDetails.id = idValidation.error.issues.map((i) => i.message);
    }
    if (!businessIdValidation.success) {
      errorDetails.businessId = businessIdValidation.error.issues.map((i) => i.message);
    }

    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID pengeluaran atau ID bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Tolak penghapusan destruktif (hard delete) demi integritas data finansial historis
  return {
    success: false,
    error: {
      code: "DESTRUCTIVE_DELETION_FORBIDDEN",
      message:
        "Penghapusan destruktif terhadap catatan pengeluaran historis tidak diizinkan demi menjaga integritas laporan finansial. Gunakan pembaruan catatan melalui updateExpense jika diperlukan koreksi administratif.",
    },
  };
}
