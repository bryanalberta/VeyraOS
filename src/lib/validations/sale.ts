import { z } from "zod";
import {
  uuidSchema,
  rupiahSchema,
  quantitySchema,
  idempotencyKeySchema,
  notesSchema,
} from "./common";

export const paymentMethodSchema = z.enum(["CASH", "BANK_TRANSFER"]);
export const saleStatusSchema = z.enum(["COMPLETED", "VOIDED"]);


export const saleItemInputSchema = z.object({
  productId: uuidSchema,
  quantity: quantitySchema,
  itemDiscount: rupiahSchema.optional().default(0),
});

export const recordSaleSchema = z.object({
  businessId: uuidSchema,
  idempotencyKey: idempotencyKeySchema,
  paymentMethod: paymentMethodSchema,
  items: z
    .array(saleItemInputSchema)
    .min(1, "Minimal harus ada 1 item dalam transaksi penjualan"),
  transactionDiscount: rupiahSchema.optional().default(0),
  notes: notesSchema,
});

export const voidSaleSchema = z.object({
  businessId: uuidSchema,
  saleId: uuidSchema,
  voidReason: z
    .string()
    .trim()
    .min(5, "Alasan pembatalan minimal 5 karakter")
    .max(500, "Alasan pembatalan maksimal 500 karakter"),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export type SaleItemInputValues = z.infer<typeof saleItemInputSchema>;
export type RecordSaleInputValues = z.infer<typeof recordSaleSchema>;
export type VoidSaleInputValues = z.infer<typeof voidSaleSchema>;
export type SaleStatusValues = z.infer<typeof saleStatusSchema>;
