/**
 * VeyraOS Tenant Management — Shared Tenant Cookie Constants
 *
 * Konstanta tunggal dan terpadu untuk preferensi tenant aktif (active business)
 * berbasis cookie pada lapisan Next.js Server Actions:
 * - src/app/actions/auth.ts (pembersihan cookie saat sign out)
 * - src/app/actions/business.ts (pembacaan, penetapan, dan reset preferensi)
 * - src/app/actions/transactions.ts (resolusi tenant server-authoritative)
 * - src/app/actions/products.ts (resolusi tenant server-authoritative)
 *
 * PRINSIP KEAMANAN & ARSITEKTUR:
 * 1. Cookie ini MURNI berfungsi sebagai preferensi UI convenience antar navigasi.
 * 2. Cookie ini TIDAK PERNAH diperlakukan sebagai mekanisme autentikasi.
 * 3. Seluruh Server Actions WAJIB memvalidasi sesi Supabase Auth aktif dan
 *    keanggotaan bisnis pengguna di database sebelum menyetujui operasi bisnis apa pun.
 * 4. Jika nilai cookie tidak valid atau pengguna bukan anggota bisnis terkait,
 *    Server Actions secara tegas menolak eksekusi (Fail-Closed & Anti-Silent Fallback).
 */

export const TENANT_COOKIE_NAME = "veyra_active_business_id" as const;

export const TENANT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 hari dalam hitungan detik
} as const;

export type TenantCookieOptions = typeof TENANT_COOKIE_OPTIONS;
