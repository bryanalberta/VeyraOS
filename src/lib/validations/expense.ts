import { z } from "zod";
import { uuidSchema, rupiahPositiveSchema } from "./common";

export const expenseCategorySchema = z.enum([
  "OPERATIONAL",
  "SALARY",
  "UTILITIES",
  "RENT",
  "MARKETING",
  "MAINTENANCE",
  "SUPPLIES",
  "OTHER",
]);

export const recordExpenseSchema = z.object({
  businessId: uuidSchema,
  category: expenseCategorySchema,
  amount: rupiahPositiveSchema,
  description: z
    .string()
    .trim()
    .min(2, "Deskripsi pengeluaran minimal 2 karakter")
    .max(500, "Deskripsi pengeluaran maksimal 500 karakter"),
  expenseDate: z
    .string()
    .datetime({ message: "Format tanggal pengeluaran harus ISO 8601" })
    .optional(),
});

export const updateExpenseSchema = z.object({
  businessId: uuidSchema,
  expenseId: uuidSchema,
  category: expenseCategorySchema.optional(),
  amount: rupiahPositiveSchema.optional(),
  description: z
    .string()
    .trim()
    .min(2, "Deskripsi pengeluaran minimal 2 karakter")
    .max(500, "Deskripsi pengeluaran maksimal 500 karakter")
    .optional(),
  expenseDate: z
    .string()
    .datetime({ message: "Format tanggal pengeluaran harus ISO 8601" })
    .optional(),
});

/**
 * Validasi string tanggal/waktu ISO 8601 (mendukung format tanggal YYYY-MM-DD
 * maupun format datetime lengkap ISO 8601 seperti YYYY-MM-DDTHH:mm:ssZ).
 */
export const isoDateStringSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      const isoRegex =
        /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
      if (!isoRegex.test(val)) return false;
      const parsed = new Date(val);
      return !isNaN(parsed.getTime());
    },
    {
      message:
        "Format tanggal harus berupa ISO 8601 yang valid (contoh: YYYY-MM-DD atau YYYY-MM-DDTHH:mm:ssZ)",
    }
  );

export const getExpensesQuerySchema = z
  .object({
    businessId: uuidSchema,
    startDate: isoDateStringSchema.optional(),
    endDate: isoDateStringSchema.optional(),
    category: expenseCategorySchema.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message:
        "Tanggal mulai (startDate) tidak boleh lebih besar dari tanggal akhir (endDate)",
      path: ["startDate"],
    }
  );

export type RecordExpenseInputValues = z.infer<typeof recordExpenseSchema>;
export type UpdateExpenseInputValues = z.infer<typeof updateExpenseSchema>;
export type GetExpensesQueryValues = z.infer<typeof getExpensesQuerySchema>;
