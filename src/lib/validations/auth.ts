import { z } from "zod";

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter"),
  email: z
    .string()
    .trim()
    .email("Format alamat email tidak valid")
    .max(255, "Email maksimal 255 karakter"),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter")
    .max(72, "Kata sandi maksimal 72 karakter"),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Format alamat email tidak valid"),
  password: z
    .string()
    .min(1, "Kata sandi wajib diisi"),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type SignInFormValues = z.infer<typeof signInSchema>;

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter"),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;

