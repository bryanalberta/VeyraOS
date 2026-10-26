import { z } from "zod";
import {
  uuidSchema,
  rupiahSchema,
  rupiahPositiveSchema,
  stockQuantitySchema,
} from "./common";

export const createProductSchema = z.object({
  businessId: uuidSchema,
  name: z
    .string()
    .trim()
    .min(1, "Nama produk minimal 1 karakter")
    .max(200, "Nama produk maksimal 200 karakter"),
  sku: z
    .string()
    .trim()
    .max(50, "SKU maksimal 50 karakter")
    .optional(),
  category: z
    .string()
    .trim()
    .max(50, "Kategori maksimal 50 karakter")
    .optional(),
  sellingPrice: rupiahPositiveSchema,
  costPrice: rupiahSchema,
  stockQuantity: stockQuantitySchema,
});

export const updateProductSchema = z.object({
  businessId: uuidSchema,
  productId: uuidSchema,
  name: z
    .string()
    .trim()
    .min(1, "Nama produk minimal 1 karakter")
    .max(200, "Nama produk maksimal 200 karakter")
    .optional(),
  sku: z
    .string()
    .trim()
    .max(50, "SKU maksimal 50 karakter")
    .optional(),
  category: z
    .string()
    .trim()
    .max(50, "Kategori maksimal 50 karakter")
    .optional(),
  sellingPrice: rupiahPositiveSchema.optional(),
  costPrice: rupiahSchema.optional(),
  stockQuantity: stockQuantitySchema.optional(),
  isArchived: z.boolean().optional(),
});

export const getProductsQuerySchema = z.object({
  businessId: uuidSchema,
  query: z.string().trim().optional(),
  category: z.string().trim().optional(),
  lowStockOnly: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
});

export type CreateProductInputValues = z.infer<typeof createProductSchema>;
export type UpdateProductInputValues = z.infer<typeof updateProductSchema>;
export type GetProductsQueryValues = z.infer<typeof getProductsQuerySchema>;
