import { z } from "zod";
import { uuidSchema } from "./common";

export const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama usaha minimal 2 karakter")
    .max(60, "Nama usaha maksimal 60 karakter"),
  category: z
    .string()
    .trim()
    .max(50, "Kategori maksimal 50 karakter")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(20, "Nomor telepon maksimal 20 karakter")
    .optional(),
  address: z
    .string()
    .trim()
    .max(255, "Alamat maksimal 255 karakter")
    .optional(),
});

export const updateBusinessSchema = z
  .object({
    businessId: uuidSchema.optional(),
    name: z
      .string()
      .trim()
      .min(2, "Nama usaha minimal 2 karakter")
      .max(60, "Nama usaha maksimal 60 karakter")
      .optional(),
    category: z
      .string()
      .trim()
      .max(50, "Kategori maksimal 50 karakter")
      .optional(),
    phone: z
      .string()
      .trim()
      .max(20, "Nomor telepon maksimal 20 karakter")
      .optional(),
    address: z
      .string()
      .trim()
      .max(255, "Alamat maksimal 255 karakter")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.category !== undefined ||
      data.phone !== undefined ||
      data.address !== undefined,
    {
      message:
        "Setidaknya satu field metadata usaha harus disertakan untuk pembaruan",
    }
  );

export type CreateBusinessFormValues = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessFormValues = z.infer<typeof updateBusinessSchema>;
