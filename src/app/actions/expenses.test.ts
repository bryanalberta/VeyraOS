/**
 * VeyraOS Server Actions Unit Tests — Operational Expense Management (Stage 3.3 Batch 3)
 *
 * Menguji aksi server expenses.ts dalam lingkungan mock terisolasi:
 * - recordExpenseAction
 * - getExpensesAction
 * - getExpenseByIdAction
 * - updateExpenseAction
 * - deleteExpenseAction
 *
 * Menjamin kepatuhan terhadap prinsip:
 * 1. Validasi Zod pada boundary action: input cacat dihentikan sebelum memanggil service.
 * 2. Tenant Context resolution (eksplisit vs cookie veyra_active_business_id).
 * 3. Fail-Closed & Anti-Silent Fallback jika cookie rusak atau pengguna bukan anggota.
 * 4. Pendelegasian murni ke Expense Service Layer tanpa bypass otorisasi.
 * 5. Perlindungan non-destruktif: deleteExpenseAction wajib menolak hard-delete (DESTRUCTIVE_DELETION_FORBIDDEN).
 *
 * Keterbatasan: Pengujian unit ini menggunakan mock Next.js headers dan Supabase client,
 * dan bukan merupakan bukti perilaku database fisik PostgreSQL atau RLS runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  recordExpenseAction,
  getExpensesAction,
  getExpenseByIdAction,
  updateExpenseAction,
  deleteExpenseAction,
  type RecordExpenseActionInput,
} from "./expenses";
import * as expenseService from "@/services/expenses/expense.service";
import * as businessService from "@/services/business/business.service";
import type { ExpenseResponseData } from "@/types/api";

describe("Operational Expense Server Actions Suite (src/app/actions/expenses.ts)", () => {
  const validBusinessId = "11111111-1111-4111-a111-111111111111";
  const validExpenseId = "33333333-3333-4333-a333-333333333333";

  const sampleExpenseItem: ExpenseResponseData = {
    id: validExpenseId,
    businessId: validBusinessId,
    category: "OPERATIONAL",
    amount: 150000,
    description: "Biaya listrik dan kebersihan toko",
    expenseDate: "2026-10-14T08:00:00Z",
    createdAt: "2026-10-14T08:00:00Z",
    updatedAt: "2026-10-14T08:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. recordExpenseAction
  // ==========================================================================
  describe("1. recordExpenseAction", () => {
    it("1.1 menolak input non-objek / null secara fail-closed", async () => {
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction(
        null as unknown as RecordExpenseActionInput
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.2 menolak kategori pengeluaran yang tidak valid", async () => {
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction({
        businessId: validBusinessId,
        category: "INVALID_CAT" as unknown as "OPERATIONAL",
        amount: 50000,
        description: "Beli kantong plastik",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.category).toBeDefined();
      }
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.3 menolak nominal pengeluaran non-positif (<= 0)", async () => {
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction({
        businessId: validBusinessId,
        category: "OPERATIONAL",
        amount: 0,
        description: "Beli kantong plastik",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.amount).toBeDefined();
      }
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.4 menolak deskripsi pengeluaran yang terlalu pendek (< 2 karakter)", async () => {
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction({
        businessId: validBusinessId,
        category: "OPERATIONAL",
        amount: 50000,
        description: "A",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.description).toBeDefined();
      }
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.5 menolak format tanggal expenseDate yang bukan format ISO 8601", async () => {
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction({
        businessId: validBusinessId,
        category: "OPERATIONAL",
        amount: 50000,
        description: "Biaya air PAM",
        expenseDate: "14-10-2026 10:00",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.expenseDate).toBeDefined();
      }
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.6 menolak jika format businessId eksplisit bukan UUID valid", async () => {
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction({
        businessId: "invalid-uuid-format",
        category: "OPERATIONAL",
        amount: 50000,
        description: "Biaya parkir",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID bisnis tidak valid");
      }
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.7 resolusi tenant dari cookie: saat businessId ditiadakan, membaca dari cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const recordSpy = vi
        .spyOn(expenseService, "recordExpense")
        .mockResolvedValueOnce({
          success: true,
          data: sampleExpenseItem,
        });

      const result = await recordExpenseAction({
        category: "OPERATIONAL",
        amount: 150000,
        description: "Biaya listrik dan kebersihan toko",
      });

      expect(mockCookieStore.get).toHaveBeenCalledWith("veyra_active_business_id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.businessId).toBe(validBusinessId);
      }
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: validBusinessId })
      );
    });

    it("1.8 resolusi tenant saat cookie rusak/bukan UUID: membersihkan cookie dan menolak (Fail-Closed)", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "corrupted-invalid-uuid" });
      const recordSpy = vi.spyOn(expenseService, "recordExpense");

      const result = await recordExpenseAction({
        category: "OPERATIONAL",
        amount: 150000,
        description: "Biaya listrik dan kebersihan toko",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID bisnis pada preferensi aktif tidak valid");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it("1.9 resolusi tenant saat cookie kosong: memanggil resolveTenantContext", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);

      vi.spyOn(businessService, "resolveTenantContext").mockResolvedValueOnce({
        success: true,
        data: {
          hasBusiness: true,
          activeBusiness: {
            id: validBusinessId,
            name: "Toko Sembako Sejahtera",
            ownerId: "user-1",
            category: "Retail",
            phone: null,
            address: null,
            currencyCode: "IDR",
            timezone: "Asia/Jakarta",
            createdAt: "2026-10-14T00:00:00Z",
            updatedAt: "2026-10-14T00:00:00Z",
          },
          role: "OWNER",
          availableBusinesses: [],
        },
      });

      const recordSpy = vi
        .spyOn(expenseService, "recordExpense")
        .mockResolvedValueOnce({
          success: true,
          data: sampleExpenseItem,
        });

      const result = await recordExpenseAction({
        category: "OPERATIONAL",
        amount: 150000,
        description: "Biaya listrik dan kebersihan toko",
      });

      expect(result.success).toBe(true);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "veyra_active_business_id",
        validBusinessId,
        expect.any(Object)
      );
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: validBusinessId })
      );
    });

    it("1.10 penolakan saat pengguna bukan anggota bisnis (UNAUTHORIZED_BUSINESS) dan pembersihan cookie", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: validBusinessId });

      const recordSpy = vi
        .spyOn(expenseService, "recordExpense")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "UNAUTHORIZED_BUSINESS",
            message: "Pengguna bukan anggota dari bisnis ini",
          },
        });

      const result = await recordExpenseAction({
        category: "OPERATIONAL",
        amount: 150000,
        description: "Biaya listrik dan kebersihan toko",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
      }
      expect(mockCookieStore.delete).toHaveBeenCalledWith("veyra_active_business_id");
      expect(recordSpy).toHaveBeenCalled();
    });

    it("1.11 berhasil mencatat pengeluaran operasional baru", async () => {
      const recordSpy = vi
        .spyOn(expenseService, "recordExpense")
        .mockResolvedValueOnce({
          success: true,
          data: sampleExpenseItem,
        });

      const result = await recordExpenseAction({
        businessId: validBusinessId,
        category: "OPERATIONAL",
        amount: 150000,
        description: "Biaya listrik dan kebersihan toko",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validExpenseId);
        expect(result.data.amount).toBe(150000);
      }
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          amount: 150000,
        })
      );
    });
  });

  // ==========================================================================
  // 2. getExpensesAction
  // ==========================================================================
  describe("2. getExpensesAction", () => {
    it("2.1 menolak rentang tanggal terbalik (startDate > endDate)", async () => {
      const getSpy = vi.spyOn(expenseService, "getExpenses");

      const result = await getExpensesAction({
        businessId: validBusinessId,
        startDate: "2026-10-15T00:00:00Z",
        endDate: "2026-10-10T00:00:00Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Parameter filter pengeluaran tidak valid");
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("2.2 berhasil membaca riwayat pengeluaran dengan filter", async () => {
      const getSpy = vi
        .spyOn(expenseService, "getExpenses")
        .mockResolvedValueOnce({
          success: true,
          data: [sampleExpenseItem],
        });

      const result = await getExpensesAction({
        businessId: validBusinessId,
        category: "OPERATIONAL",
        startDate: "2026-10-01T00:00:00Z",
        endDate: "2026-10-31T23:59:59Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].id).toBe(validExpenseId);
      }
      expect(getSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: validBusinessId,
          category: "OPERATIONAL",
        })
      );
    });
  });

  // ==========================================================================
  // 3. getExpenseByIdAction
  // ==========================================================================
  describe("3. getExpenseByIdAction", () => {
    it("3.1 menolak format id yang bukan UUID valid", async () => {
      const getSpy = vi.spyOn(expenseService, "getExpenseById");

      const result = await getExpenseByIdAction("invalid-id", validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID pengeluaran tidak valid");
      }
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("3.2 berhasil membaca detail pengeluaran per ID", async () => {
      const getSpy = vi
        .spyOn(expenseService, "getExpenseById")
        .mockResolvedValueOnce({
          success: true,
          data: sampleExpenseItem,
        });

      const result = await getExpenseByIdAction(validExpenseId, validBusinessId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validExpenseId);
      }
      expect(getSpy).toHaveBeenCalledWith(validExpenseId, validBusinessId);
    });

    it("3.3 mengembalikan NOT_FOUND jika pengeluaran tidak ditemukan", async () => {
      vi.spyOn(expenseService, "getExpenseById").mockResolvedValueOnce({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Catatan pengeluaran tidak ditemukan",
        },
      });

      const result = await getExpenseByIdAction(validExpenseId, validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  // ==========================================================================
  // 4. updateExpenseAction
  // ==========================================================================
  describe("4. updateExpenseAction", () => {
    it("4.1 menolak jika expenseId tidak disertakan pada pemanggilan bentuk objek", async () => {
      const updateSpy = vi.spyOn(expenseService, "updateExpense");

      const result = await updateExpenseAction({
        businessId: validBusinessId,
        amount: 200000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("ID pengeluaran wajib disertakan");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("4.2 menolak jika format expenseId bukan UUID valid", async () => {
      const updateSpy = vi.spyOn(expenseService, "updateExpense");

      const result = await updateExpenseAction("invalid-expense-uuid", {
        businessId: validBusinessId,
        amount: 200000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID pengeluaran tidak valid");
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("4.3 menolak pembaruan nominal jika non-positif (<= 0)", async () => {
      const updateSpy = vi.spyOn(expenseService, "updateExpense");

      const result = await updateExpenseAction(validExpenseId, {
        businessId: validBusinessId,
        amount: -5000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.details?.amount).toBeDefined();
      }
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("4.4 berhasil memperbarui pengeluaran dengan signature (id, input)", async () => {
      const updatedItem: ExpenseResponseData = {
        ...sampleExpenseItem,
        amount: 200000,
        description: "Biaya listrik bertambah",
      };

      const updateSpy = vi
        .spyOn(expenseService, "updateExpense")
        .mockResolvedValueOnce({
          success: true,
          data: updatedItem,
        });

      const result = await updateExpenseAction(validExpenseId, {
        businessId: validBusinessId,
        amount: 200000,
        description: "Biaya listrik bertambah",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(200000);
      }
      expect(updateSpy).toHaveBeenCalledWith(
        validExpenseId,
        expect.objectContaining({
          expenseId: validExpenseId,
          businessId: validBusinessId,
          amount: 200000,
        })
      );
    });

    it("4.5 berhasil memperbarui pengeluaran dengan signature ({ expenseId, ...input })", async () => {
      const updatedItem: ExpenseResponseData = {
        ...sampleExpenseItem,
        amount: 175000,
      };

      const updateSpy = vi
        .spyOn(expenseService, "updateExpense")
        .mockResolvedValueOnce({
          success: true,
          data: updatedItem,
        });

      const result = await updateExpenseAction({
        expenseId: validExpenseId,
        businessId: validBusinessId,
        amount: 175000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(175000);
      }
      expect(updateSpy).toHaveBeenCalledWith(
        validExpenseId,
        expect.objectContaining({
          expenseId: validExpenseId,
          businessId: validBusinessId,
          amount: 175000,
        })
      );
    });
  });

  // ==========================================================================
  // 5. deleteExpenseAction (Non-Destructive Integrity)
  // ==========================================================================
  describe("5. deleteExpenseAction", () => {
    it("5.1 menolak format id yang bukan UUID valid", async () => {
      const deleteSpy = vi.spyOn(expenseService, "deleteExpense");

      const result = await deleteExpenseAction("not-a-uuid", validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Format ID pengeluaran tidak valid");
      }
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("5.2 menegakkan pertahanan non-destruktif: menolak hard delete dengan DESTRUCTIVE_DELETION_FORBIDDEN", async () => {
      const deleteSpy = vi
        .spyOn(expenseService, "deleteExpense")
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: "DESTRUCTIVE_DELETION_FORBIDDEN",
            message:
              "Penghapusan destruktif terhadap catatan pengeluaran historis tidak diizinkan demi menjaga integritas laporan finansial. Gunakan pembaruan catatan melalui updateExpense jika diperlukan koreksi administratif.",
          },
        });

      const result = await deleteExpenseAction(validExpenseId, validBusinessId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("DESTRUCTIVE_DELETION_FORBIDDEN");
        expect(result.error.message).toContain("tidak diizinkan");
      }
      expect(deleteSpy).toHaveBeenCalledWith(validExpenseId, validBusinessId);
    });
  });
});
