/**
 * VeyraOS Operational Expense Service Unit Tests
 *
 * Sesuai kriteria Substage 3.2.2B:
 * - Pengujian unit menggunakan Mock Supabase Client terisolasi (Mock-Only Unit Tests).
 * - Menguji validasi Zod, verifikasi autentikasi, otorisasi tenant, isolasi multi-tenant,
 *   pencatatan pengeluaran, filter & sorting rentang tanggal, pembaruan, penghapusan,
 *   dan error mapping.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "./expense.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecordExpenseInput,
  GetExpensesQuery,
  UpdateExpenseInput,
} from "@/types/api";

describe("Operational Expense Service Suite (src/services/expenses)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const otherBusinessId = "99999999-9999-4999-a999-999999999999";
  const validUserId = "22222222-2222-4222-a222-222222222222";
  const validExpenseId = "55555555-5555-4555-a555-555555555555";

  let mockSupabase: SupabaseClient;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockAuth: { getUser: ReturnType<typeof vi.fn> };
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let eqSpy: ReturnType<typeof vi.fn>;
  let gteSpy: ReturnType<typeof vi.fn>;
  let lteSpy: ReturnType<typeof vi.fn>;
  let orderSpy: ReturnType<typeof vi.fn>;

  let expensesQueryResult: { data: unknown; error: unknown };
  let businessMemberResult: { data: unknown; error: unknown };

  const sampleExpenseRow = {
    id: validExpenseId,
    business_id: validBusinessId,
    expense_date: "2026-10-13T10:00:00Z",
    category: "OPERATIONAL",
    amount: 150000,
    notes: "Biaya kebersihan dan plastik kresek",
    created_at: "2026-10-13T10:00:00Z",
    updated_at: "2026-10-13T10:00:00Z",
  };

  beforeEach(() => {
    insertSpy = vi.fn();
    updateSpy = vi.fn();
    deleteSpy = vi.fn();
    selectSpy = vi.fn();
    eqSpy = vi.fn();
    gteSpy = vi.fn();
    lteSpy = vi.fn();
    orderSpy = vi.fn();

    expensesQueryResult = { data: sampleExpenseRow, error: null };
    businessMemberResult = { data: { role: "OWNER" }, error: null };

    mockFrom = vi.fn((table: string) => {
      if (table === "business_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve(businessMemberResult)
          ),
        };
      }

      if (table === "expenses") {
        const queryBuilder: Record<string, unknown> = {};

        queryBuilder.select = selectSpy.mockImplementation(() => queryBuilder);
        queryBuilder.insert = insertSpy.mockImplementation(() => queryBuilder);
        queryBuilder.update = updateSpy.mockImplementation(() => queryBuilder);
        queryBuilder.delete = deleteSpy.mockImplementation(() => queryBuilder);
        queryBuilder.eq = eqSpy.mockImplementation(() => queryBuilder);
        queryBuilder.gte = gteSpy.mockImplementation(() => queryBuilder);
        queryBuilder.lte = lteSpy.mockImplementation(() => queryBuilder);
        queryBuilder.order = orderSpy.mockImplementation(() => queryBuilder);
        queryBuilder.single = vi.fn().mockImplementation(() =>
          Promise.resolve(expensesQueryResult)
        );
        queryBuilder.maybeSingle = vi.fn().mockImplementation(() =>
          Promise.resolve(expensesQueryResult)
        );
        queryBuilder.then = (resolve: (val: unknown) => void) =>
          resolve(
            Array.isArray(expensesQueryResult.data)
              ? expensesQueryResult
              : {
                  data: expensesQueryResult.data ? [expensesQueryResult.data] : [],
                  error: expensesQueryResult.error,
                }
          );

        return queryBuilder;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: validUserId, email: "owner@veyraos.com" } },
        error: null,
      }),
    };

    mockSupabase = {
      auth: mockAuth,
      from: mockFrom,
    } as unknown as SupabaseClient;
  });

  // ==========================================================================
  // 1. VALIDASI INPUT TIDAK VALID (ZOD SCHEMAS)
  // ==========================================================================
  describe("Input Validation Guards (Zod)", () => {
    it("recordExpense: menolak kategori tidak dikenal, nominal nol/negatif, dan deskripsi < 2 karakter", async () => {
      const invalidInputs: RecordExpenseInput[] = [
        {
          businessId: validBusinessId,
          category: "INVALID_CAT" as unknown as "OPERATIONAL",
          amount: 50000,
          description: "Beli Alat Tulis",
        },
        {
          businessId: validBusinessId,
          category: "OPERATIONAL",
          amount: 0, // SQL CHECK constraint amount > 0
          description: "Beli Alat Tulis",
        },
        {
          businessId: validBusinessId,
          category: "OPERATIONAL",
          amount: -25000,
          description: "Beli Alat Tulis",
        },
        {
          businessId: validBusinessId,
          category: "OPERATIONAL",
          amount: 50000.75, // Desimal sen dilarang
          description: "Beli Alat Tulis",
        },
        {
          businessId: validBusinessId,
          category: "OPERATIONAL",
          amount: 50000,
          description: "A", // < 2 karakter
        },
        {
          businessId: "invalid-uuid",
          category: "OPERATIONAL",
          amount: 50000,
          description: "Beli Alat Tulis",
        },
      ];

      for (const input of invalidInputs) {
        const res = await recordExpense(input, { supabase: mockSupabase });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("VALIDATION_ERROR");
          expect(res.error.details).toBeDefined();
        }
      }

      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("getExpenses: menolak format businessId yang bukan UUID", async () => {
      const res = await getExpenses(
        { businessId: "bad-uuid" },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("getExpenseById: menolak ID pengeluaran atau businessId yang bukan UUID", async () => {
      const res1 = await getExpenseById("bad-id", validBusinessId, {
        supabase: mockSupabase,
      });
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error.code).toBe("VALIDATION_ERROR");
      }

      const res2 = await getExpenseById(validExpenseId, "bad-biz-id", {
        supabase: mockSupabase,
      });
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("updateExpense: menolak ID mismatch antara URL argumen dan payload body", async () => {
      const res = await updateExpense(
        validExpenseId,
        {
          businessId: validBusinessId,
          expenseId: "66666666-6666-4666-a666-666666666666", // Beda dengan validExpenseId
          amount: 200000,
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.message).toContain("tidak cocok");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("deleteExpense: menolak ID yang tidak valid", async () => {
      const res = await deleteExpense("bad-id", validBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
      }
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. VERIFIKASI AUTENTIKASI DAN OTORISASI KEANGGOTAAN BISNIS
  // ==========================================================================
  describe("Authentication & Business Membership Authorization", () => {
    it("menolak operasi ketika sesi pengguna tidak terautentikasi (UNAUTHENTICATED)", async () => {
      mockAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "No active session" },
      });

      const res = await recordExpense(
        {
          businessId: validBusinessId,
          category: "RENT",
          amount: 2500000,
          description: "Sewa Toko Bulan Ini",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHENTICATED");
      }
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("menolak operasi ketika pengguna bukan anggota dari bisnis target (UNAUTHORIZED_BUSINESS)", async () => {
      businessMemberResult = { data: null, error: null };

      const res = await recordExpense(
        {
          businessId: validBusinessId,
          category: "UTILITIES",
          amount: 450000,
          description: "Tagihan Listrik PLN",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. ISOLASI TENANT PADA OPERASI BACA DAN TULIS
  // ==========================================================================
  describe("Multi-Tenant Isolation Safeguards", () => {
    it("getExpenses: menyertakan filter business_id wajib pada query", async () => {
      await getExpenses(
        { businessId: validBusinessId },
        { supabase: mockSupabase }
      );

      expect(eqSpy).toHaveBeenCalledWith("business_id", validBusinessId);
    });

    it("getExpenseById: menolak mengembalikan pengeluaran milik bisnis lain (NOT_FOUND)", async () => {
      expensesQueryResult = { data: null, error: null };

      const res = await getExpenseById(validExpenseId, otherBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NOT_FOUND");
      }
    });

    it("updateExpense: membatasi pembaruan hanya pada business_id target", async () => {
      await updateExpense(
        validExpenseId,
        {
          businessId: validBusinessId,
          amount: 175000,
        },
        { supabase: mockSupabase }
      );

      expect(eqSpy).toHaveBeenCalledWith("business_id", validBusinessId);
      expect(eqSpy).toHaveBeenCalledWith("id", validExpenseId);
    });

    it("deleteExpense: menolak penghapusan pada bisnis yang tidak diotorisasi (UNAUTHORIZED_BUSINESS)", async () => {
      businessMemberResult = { data: null, error: null };

      const res = await deleteExpense(validExpenseId, otherBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. PENCATATAN PENGELUARAN (recordExpense)
  // ==========================================================================
  describe("Expense Recording (recordExpense)", () => {
    it("berhasil mencatat pengeluaran operasional dan memetakan field secara benar", async () => {
      const input: RecordExpenseInput = {
        businessId: validBusinessId,
        category: "OPERATIONAL",
        amount: 150000,
        description: "Biaya kebersihan dan plastik kresek",
        expenseDate: "2026-10-13T10:00:00Z",
      };

      const res = await recordExpense(input, { supabase: mockSupabase });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe(validExpenseId);
        expect(res.data.businessId).toBe(validBusinessId);
        expect(res.data.category).toBe("OPERATIONAL");
        expect(res.data.amount).toBe(150000);
        expect(res.data.description).toBe("Biaya kebersihan dan plastik kresek");
        expect(res.data.expenseDate).toBe("2026-10-13T10:00:00Z");
      }

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: validBusinessId,
          category: "OPERATIONAL",
          amount: 150000,
          notes: "Biaya kebersihan dan plastik kresek",
        })
      );
    });
  });

  // ==========================================================================
  // 5. QUERY DAN FILTER PENGELUARAN (getExpenses)
  // ==========================================================================
  describe("Expense Querying & Filtering (getExpenses)", () => {
    it("menerima filter tanggal valid dengan format ISO datetime lengkap", async () => {
      const params: GetExpensesQuery = {
        businessId: validBusinessId,
        category: "SALARY",
        startDate: "2026-10-01T00:00:00Z",
        endDate: "2026-10-31T23:59:59Z",
      };

      const res = await getExpenses(params, { supabase: mockSupabase });

      expect(res.success).toBe(true);
      expect(eqSpy).toHaveBeenCalledWith("category", "SALARY");
      expect(gteSpy).toHaveBeenCalledWith("expense_date", "2026-10-01T00:00:00Z");
      expect(lteSpy).toHaveBeenCalledWith("expense_date", "2026-10-31T23:59:59Z");
      expect(orderSpy).toHaveBeenCalledWith("expense_date", { ascending: false });
    });

    it("menerima filter tanggal valid dengan format ISO date (YYYY-MM-DD)", async () => {
      const params: GetExpensesQuery = {
        businessId: validBusinessId,
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      };

      const res = await getExpenses(params, { supabase: mockSupabase });

      expect(res.success).toBe(true);
      expect(gteSpy).toHaveBeenCalledWith("expense_date", "2026-10-01");
      expect(lteSpy).toHaveBeenCalledWith("expense_date", "2026-10-31");
    });

    it("menolak filter tanggal dengan format tidak valid sebelum query Supabase dilakukan", async () => {
      const invalidDateInputs: GetExpensesQuery[] = [
        { businessId: validBusinessId, startDate: "not-a-date" },
        { businessId: validBusinessId, endDate: "2026/10/31" },
        { businessId: validBusinessId, startDate: "2026-13-45" },
        { businessId: validBusinessId, endDate: "invalid-string" },
      ];

      for (const input of invalidDateInputs) {
        const res = await getExpenses(input, { supabase: mockSupabase });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("VALIDATION_ERROR");
          expect(res.error.message).toContain("tidak valid");
        }
      }

      // Memastikan query Supabase expenses tidak pernah dipanggil saat validasi gagal
      expect(selectSpy).not.toHaveBeenCalled();
    });

    it("menolak filter rentang tanggal terbalik (startDate > endDate) dengan VALIDATION_ERROR", async () => {
      const res = await getExpenses(
        {
          businessId: validBusinessId,
          startDate: "2026-10-31T00:00:00Z",
          endDate: "2026-10-01T00:00:00Z",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.details?.startDate).toBeDefined();
        expect(res.error.details?.startDate[0]).toContain(
          "tidak boleh lebih besar dari tanggal akhir"
        );
      }

      // Memastikan query Supabase tidak dijalankan
      expect(selectSpy).not.toHaveBeenCalled();
    });

    it("berhasil memfilter ketika hanya startDate yang diberikan", async () => {
      const res = await getExpenses(
        {
          businessId: validBusinessId,
          startDate: "2026-10-01T00:00:00Z",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      expect(gteSpy).toHaveBeenCalledWith("expense_date", "2026-10-01T00:00:00Z");
      expect(lteSpy).not.toHaveBeenCalled();
    });

    it("berhasil memfilter ketika hanya endDate yang diberikan", async () => {
      const res = await getExpenses(
        {
          businessId: validBusinessId,
          endDate: "2026-10-31T23:59:59Z",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      expect(lteSpy).toHaveBeenCalledWith("expense_date", "2026-10-31T23:59:59Z");
      expect(gteSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 6. PEMBARUAN PENGELUARAN (updateExpense)
  // ==========================================================================
  describe("Expense Updating (updateExpense)", () => {
    it("berhasil memperbarui field yang diizinkan (kategori, nominal, deskripsi)", async () => {
      const input: UpdateExpenseInput = {
        businessId: validBusinessId,
        category: "MAINTENANCE",
        amount: 220000,
        description: "Servis AC Toko",
      };

      const res = await updateExpense(validExpenseId, input, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "MAINTENANCE",
          amount: 220000,
          notes: "Servis AC Toko",
        })
      );
    });

    it("mengembalikan data pengeluaran saat ini jika tidak ada field yang diubah", async () => {
      const res = await updateExpense(
        validExpenseId,
        { businessId: validBusinessId },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 7. KEBIJAKAN PENGHAPUSAN PENGELUARAN (deleteExpense - Anti-Destructive)
  // ==========================================================================
  describe("Expense Deletion Policy (deleteExpense - Anti-Destructive)", () => {
    it("menolak penghapusan destruktif catatan historis dengan kode DESTRUCTIVE_DELETION_FORBIDDEN", async () => {
      const res = await deleteExpense(validExpenseId, validBusinessId, {
        supabase: mockSupabase,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("DESTRUCTIVE_DELETION_FORBIDDEN");
        expect(res.error.message).toMatch(
          /Penghapusan destruktif terhadap catatan pengeluaran historis tidak diizinkan/
        );
      }
    });

    it("memverifikasi bahwa Supabase .delete() tidak pernah dipanggil (hard delete dicegah)", async () => {
      await deleteExpense(validExpenseId, validBusinessId, {
        supabase: mockSupabase,
      });

      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 8. PENANGANAN ERROR DATABASE
  // ==========================================================================
  describe("Database Error Mapping Sanitization", () => {
    it("memetakan error jaringan ke kode NETWORK_ERROR tanpa membocorkan kredensial", async () => {
      expensesQueryResult = {
        data: null,
        error: {
          message: "Fetch failed: ECONNREFUSED 127.0.0.1:5432",
        },
      };

      const res = await recordExpense(
        {
          businessId: validBusinessId,
          category: "MARKETING",
          amount: 500000,
          description: "Iklan Media Sosial",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("NETWORK_ERROR");
        expect(res.error.message).not.toContain("ECONNREFUSED");
      }
    });

    it("memetakan error database umum ke kode DATABASE_ERROR", async () => {
      expensesQueryResult = {
        data: null,
        error: {
          code: "XX000",
          message: "Internal postgres error",
        },
      };

      const res = await recordExpense(
        {
          businessId: validBusinessId,
          category: "OTHER",
          amount: 50000,
          description: "Pengeluaran Tak Terduga",
        },
        { supabase: mockSupabase }
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("DATABASE_ERROR");
      }
    });
  });
});
