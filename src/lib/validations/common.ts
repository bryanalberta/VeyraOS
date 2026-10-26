import { z } from "zod";

/**
 * Validasi ID UUID standar (RFC 4122)
 */
export const uuidSchema = z
  .string()
  .trim()
  .uuid("Format ID harus berupa UUID yang valid");

/**
 * Validasi nilai moneter Rupiah (Integer IDR non-negatif).
 * Mencegah bilangan desimal/floating point dan batasan integer aman JavaScript.
 */
export const rupiahSchema = z
  .number()
  .int("Nominal Rupiah harus berupa bilangan bulat tanpa sen")
  .min(0, "Nominal Rupiah tidak boleh bernilai negatif")
  .max(
    Number.MAX_SAFE_INTEGER,
    "Nominal Rupiah melebihi batas angka aman sistem"
  );

/**
 * Validasi nilai moneter Rupiah yang harus bernilai positif (> 0),
 * contoh: nominal pengeluaran, harga jual produk.
 */
export const rupiahPositiveSchema = z
  .number()
  .int("Nominal Rupiah harus berupa bilangan bulat tanpa sen")
  .min(1, "Nominal Rupiah harus lebih besar dari 0")
  .max(
    Number.MAX_SAFE_INTEGER,
    "Nominal Rupiah melebihi batas angka aman sistem"
  );

/**
 * Validasi kuantitas item (Integer positif > 0, dibatasi oleh PostgreSQL INTEGER max 2.147.483.647)
 */
export const quantitySchema = z
  .number()
  .int("Kuantitas harus berupa bilangan bulat")
  .min(1, "Kuantitas minimal adalah 1 unit")
  .max(2_147_483_647, "Kuantitas melebihi batas integer sistem (2.147.483.647 unit)");

/**
 * Validasi stok persediaan produk (Integer non-negatif >= 0, dibatasi oleh PostgreSQL INTEGER max 2.147.483.647)
 */
export const stockQuantitySchema = z
  .number()
  .int("Stok produk harus berupa bilangan bulat")
  .min(0, "Stok produk tidak boleh bernilai negatif")
  .max(2_147_483_647, "Stok produk melebihi batas integer sistem (2.147.483.647 unit)");

/**
 * Validasi kunci idempotensi (8 - 128 karakter, sesuai constraint tabel SQL idempotency_keys)
 */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency key minimal 8 karakter")
  .max(128, "Idempotency key maksimal 128 karakter");

/**
 * Validasi catatan opsional (teks maksimal 500 karakter)
 */
export const notesSchema = z
  .string()
  .trim()
  .max(500, "Catatan maksimal 500 karakter")
  .optional();

/**
 * Validasi nomor halaman untuk query paginasi (Integer positif >= 1, default 1)
 */
export const pageSchema = z.coerce
  .number()
  .int("Nomor halaman harus berupa bilangan bulat")
  .min(1, "Halaman minimal adalah 1")
  .default(1);

/**
 * Validasi ukuran per halaman untuk query paginasi (Integer positif 1 - 100, default 50)
 */
export const pageSizeSchema = z.coerce
  .number()
  .int("Jumlah item per halaman harus berupa bilangan bulat")
  .min(1, "Jumlah item per halaman minimal 1")
  .max(100, "Jumlah item per halaman maksimal 100")
  .default(50);
