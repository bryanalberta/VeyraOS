import { z } from "zod";
import { uuidSchema, pageSchema, pageSizeSchema } from "./common";
import { isoDateStringSchema, expenseCategorySchema } from "./expense";
import { saleStatusSchema } from "./sale";

/**
 * Tipe berkas ekspor CSV laporan yang diizinkan di VeyraOS MVP.
 */
export const reportExportTypeSchema = z.enum(["SALES", "EXPENSES", "STOCK"]);

/**
 * Validasi parameter kueri Dashboard & Financial Summary.
 */
export const dashboardQuerySchema = z
  .object({
    businessId: uuidSchema,
    startDate: isoDateStringSchema.optional(),
    endDate: isoDateStringSchema.optional(),
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

/**
 * Validasi parameter kueri Laporan Penjualan (berpaginasi).
 */
export const salesReportQuerySchema = z
  .object({
    businessId: uuidSchema,
    startDate: isoDateStringSchema.optional(),
    endDate: isoDateStringSchema.optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
    status: saleStatusSchema.optional(),
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

/**
 * Validasi parameter kueri Laporan Beban Operasional.
 */
export const expenseReportQuerySchema = z
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

/**
 * Validasi parameter kueri Laporan Persediaan & Valuasi Stok.
 */
export const stockReportQuerySchema = z.object({
  businessId: uuidSchema,
  category: z.string().trim().max(50, "Kategori maksimal 50 karakter").optional(),
  lowStockOnly: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

/**
 * Validasi parameter permintaan Ekspor Laporan CSV.
 */
export const exportReportQuerySchema = z
  .object({
    businessId: uuidSchema,
    type: reportExportTypeSchema,
    startDate: isoDateStringSchema.optional(),
    endDate: isoDateStringSchema.optional(),
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

export type DashboardQueryValues = z.infer<typeof dashboardQuerySchema>;
export type SalesReportQueryValues = z.infer<typeof salesReportQuerySchema>;
export type ExpenseReportQueryValues = z.infer<typeof expenseReportQuerySchema>;
export type StockReportQueryValues = z.infer<typeof stockReportQuerySchema>;
export type ExportReportQueryValues = z.infer<typeof exportReportQuerySchema>;
