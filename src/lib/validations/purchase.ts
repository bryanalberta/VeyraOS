import { z } from "zod";
import {
  uuidSchema,
  rupiahSchema,
  quantitySchema,
  idempotencyKeySchema,
  notesSchema,
} from "./common";

export const purchaseItemInputSchema = z.object({
  productId: uuidSchema,
  quantity: quantitySchema,
  unitPurchaseCost: rupiahSchema,
});

export const recordPurchaseSchema = z.object({
  businessId: uuidSchema,
  supplierName: z
    .string()
    .trim()
    .max(100, "Nama pemasok maksimal 100 karakter")
    .optional(),
  items: z
    .array(purchaseItemInputSchema)
    .min(1, "Minimal harus ada 1 item dalam pembelian persediaan"),
  notes: notesSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
});

export type PurchaseItemInputValues = z.infer<typeof purchaseItemInputSchema>;
export type RecordPurchaseInputValues = z.infer<typeof recordPurchaseSchema>;
