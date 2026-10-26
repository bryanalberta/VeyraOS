/**
 * VeyraOS — Browser-Safe Invoice Number Generator for Demo Mode
 *
 * Sesuai PRD v1.1 dan docs/stage-4c-demo-sales-preflight-audit.md.
 * Menghasilkan nomor faktur berformat [PREFIX]-[YYYYMMDD]-[XXXX] (contoh: "INV-20261015-8K4M")
 * murni di sisi peramban (client-side) tanpa dependensi modul Node.js `node:crypto`.
 *
 * Menggunakan zona waktu Asia/Jakarta (WIB) secara deterministik,
 * karakter Crockford Base32 bebas ambiguitas, deteksi tabrakan (collision-resistance),
 * serta mendukung dependency injection untuk pengujian unit deterministik.
 */

export const DEMO_INVOICE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const DEFAULT_DEMO_INVOICE_PREFIX = "INV";
export const DEFAULT_DEMO_SUFFIX_LENGTH = 4;
export const DEFAULT_MAX_COLLISION_ATTEMPTS = 50;

export interface GenerateDemoInvoiceOptions {
  /**
   * Tanggal acuan untuk segmen YYYYMMDD dalam zona waktu Asia/Jakarta.
   * Default: new Date() waktu sekarang.
   */
  date?: Date;

  /**
   * Daftar transaksi penjualan yang sudah ada untuk memeriksa benturan nomor faktur.
   */
  existingSales?: Array<{ invoiceNumber: string }>;

  /**
   * Fungsi penghasil angka acak [0, 1) opsional untuk pengujian deterministik.
   * Jika tidak disuntikkan, menggunakan Web Crypto API (crypto.getRandomValues)
   * dengan fallback aman ke Math.random().
   */
  randomFn?: () => number;

  /**
   * Batas maksimal percobaan menghasilkan nomor baru jika terjadi tabrakan.
   * Default: 50 percobaan.
   */
  maxAttempts?: number;

  /**
   * Prefix faktur. Default: "INV".
   */
  prefix?: string;

  /**
   * Panjang karakter suffix Crockford Base32. Default: 4 karakter.
   */
  suffixLength?: number;
}

/**
 * Mengubah objek Date menjadi string tanggal 8 digit "YYYYMMDD"
 * dalam zona waktu Asia/Jakarta (WIB).
 */
export function formatJakartaDateString(date: Date = new Date()): string {
  if (isNaN(date.getTime())) {
    throw new TypeError("INVALID_DATE: Tanggal yang diberikan tidak valid.");
  }

  // Format YYYY-MM-DD menggunakan locale standar en-CA dengan zona waktu Asia/Jakarta
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formatted = formatter.format(date); // Format: "YYYY-MM-DD"
  return formatted.replace(/-/g, "");
}

/**
 * Menghasilkan string suffix acak dari karakter Crockford Base32
 * tanpa dependensi ke runtime server Node.js.
 */
export function generateRandomSuffix(
  length: number = DEFAULT_DEMO_SUFFIX_LENGTH,
  randomFn?: () => number
): string {
  if (length <= 0) {
    throw new RangeError("INVALID_SUFFIX_LENGTH: Panjang suffix harus lebih besar dari 0.");
  }

  let result = "";
  const alphabetLength = DEMO_INVOICE_ALPHABET.length;

  if (randomFn) {
    // Mode deterministik (misal untuk unit test)
    for (let i = 0; i < length; i++) {
      const rand = randomFn();
      const clamped = Math.max(0, Math.min(0.999999999, rand));
      const index = Math.floor(clamped * alphabetLength);
      result += DEMO_INVOICE_ALPHABET[index];
    }
    return result;
  }

  // Mode Web Crypto API browser standar (jika tersedia)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      const index = randomBytes[i] % alphabetLength;
      result += DEMO_INVOICE_ALPHABET[index];
    }
    return result;
  }

  // Fallback ke Math.random
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * alphabetLength);
    result += DEMO_INVOICE_ALPHABET[index];
  }

  return result;
}

/**
 * Menghasilkan nomor faktur penjualan demo unik yang aman dari benturan lokal.
 *
 * Pola: [PREFIX]-[YYYYMMDD]-[XXXX]
 * Contoh: "INV-20261015-7X8M"
 */
export function generateDemoInvoiceNumber(
  options: GenerateDemoInvoiceOptions = {}
): string {
  const {
    date = new Date(),
    existingSales = [],
    randomFn,
    maxAttempts = DEFAULT_MAX_COLLISION_ATTEMPTS,
    prefix = DEFAULT_DEMO_INVOICE_PREFIX,
    suffixLength = DEFAULT_DEMO_SUFFIX_LENGTH,
  } = options;

  const dateStr = formatJakartaDateString(date);
  const existingSet = new Set(existingSales.map((s) => s.invoiceNumber));

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const suffix = generateRandomSuffix(suffixLength, randomFn);
    const candidate = `${prefix}-${dateStr}-${suffix}`;

    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `INVOICE_GENERATION_FAILED: Gagal menghasilkan nomor faktur unik setelah ${maxAttempts} percobaan benturan.`
  );
}
