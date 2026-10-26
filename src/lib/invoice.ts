/**
 * VeyraOS Cryptographically Secure Invoice Number Generator
 *
 * Sesuai spesifikasi Phase 4, Substage 3.1.4:
 * - Menghasilkan nomor faktur/invoice unik dengan entropi kriptografis tinggi.
 * - Menggunakan Node.js CSPRNG (crypto.randomBytes), bukan Math.random().
 * - Format konsisten dan mudah dibaca: [PREFIX]-[YYYYMMDD]-[RANDOM_SUFFIX]
 *   Contoh Penjualan: "INV-20261013-7X8M9NP2" (21 karakter)
 *   Contoh Pembelian: "PO-20261013-4B9WQ2Z8" (20 karakter)
 * - Kompatibel dengan skema SQL: VARCHAR(50), NOT NULL, CHECK (char_length(trim(invoice_number)) >= 3).
 * - Nomor invoice bersifat server-authoritative (tidak mempercayai input klien).
 * - Perlindungan akhir terhadap benturan adalah database unique constraint:
 *   uq_sales_invoice UNIQUE (business_id, invoice_number)
 *   uq_purchases_invoice UNIQUE (business_id, invoice_number)
 */

import crypto from "node:crypto";

/**
 * Alfabet Crockford Base32 yang disederhanakan:
 * 32 karakter alfanumerik kapital (0-9, A-Z tanpa I, L, O, U untuk menghindari ambiguitas visual).
 * Setiap karakter merepresentasikan tepat 5 bit informasi entropi.
 */
export const INVOICE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const INVOICE_CONSTRAINTS = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 50,
  DEFAULT_SUFFIX_LENGTH: 8,
  MIN_SUFFIX_LENGTH: 6,
  MAX_SUFFIX_LENGTH: 12,
  MAX_PREFIX_LENGTH: 10,
  MIN_PREFIX_LENGTH: 2,
} as const;

export type InvoiceType = "SALE" | "PURCHASE";

export interface GenerateInvoiceOptions {
  /**
   * Tipe transaksi: SALE menghasilkan prefix "INV", PURCHASE menghasilkan prefix "PO".
   * Default: "SALE".
   */
  type?: InvoiceType;

  /**
   * Prefix kustom opsional (2-10 huruf kapital A-Z).
   * Jika diberikan, mengabaikan prefix default dari tipe transaksi.
   */
  prefix?: string;

  /**
   * Tanggal transaksi acuan untuk komponen YYYYMMDD.
   * Default: waktu sekarang (new Date()).
   */
  date?: Date;

  /**
   * Panjang karakter acak suffix CSPRNG (6 - 12 karakter).
   * Default: 8 karakter (40 bit CSPRNG entropy ≈ 1,1 triliun kombinasi per hari per tenant).
   */
  suffixLength?: number;
}

export interface ParsedInvoiceNumber {
  prefix: string;
  dateStr: string;
  suffix: string;
  raw: string;
}

/**
 * Menghasilkan string acak berbasis Node.js CSPRNG (crypto.randomBytes)
 * tanpa modulo bias menggunakan 5-bit slicing ke alfabet Crockford Base32.
 */
export function generateSecureRandomSuffix(charCount: number = INVOICE_CONSTRAINTS.DEFAULT_SUFFIX_LENGTH): string {
  if (
    charCount < INVOICE_CONSTRAINTS.MIN_SUFFIX_LENGTH ||
    charCount > INVOICE_CONSTRAINTS.MAX_SUFFIX_LENGTH
  ) {
    throw new RangeError(
      `INVALID_SUFFIX_LENGTH: suffixLength must be between ${INVOICE_CONSTRAINTS.MIN_SUFFIX_LENGTH} and ${INVOICE_CONSTRAINTS.MAX_SUFFIX_LENGTH}`
    );
  }

  // Setiap karakter Crockford Base32 membutuhkan tepat 5 bit entropi.
  // Total bit yang dibutuhkan: charCount * 5 bit.
  const totalBitsNeeded = charCount * 5;
  const byteCount = Math.ceil(totalBitsNeeded / 8);
  const randomBuffer = crypto.randomBytes(byteCount);

  // Konversi buffer bytes ke BigInt bitstream
  let bitstream = BigInt(0);
  for (let i = 0; i < byteCount; i++) {
    bitstream = (bitstream << BigInt(8)) | BigInt(randomBuffer[i]);
  }

  // Geser bit ke kanan jika byteCount * 8 melebihi totalBitsNeeded untuk menyelaraskan bit awal
  const excessBits = BigInt(byteCount * 8 - totalBitsNeeded);
  bitstream = bitstream >> excessBits;

  // Ekstrak potongan 5 bit per karakter dari MSB ke LSB
  let result = "";
  for (let i = 0; i < charCount; i++) {
    const shift = BigInt((charCount - 1 - i) * 5);
    const charIndex = Number((bitstream >> shift) & BigInt(0x1f));
    result += INVOICE_ALPHABET[charIndex];
  }

  return result;
}

/**
 * Format objek Date menjadi string tanggal UTC 8 digit "YYYYMMDD".
 */
export function formatDateToUtcDateString(date: Date): string {
  if (isNaN(date.getTime())) {
    throw new TypeError("INVALID_DATE: date must be a valid Date instance");
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

/**
 * Menghasilkan nomor faktur (invoice number) unik terstandarisasi.
 *
 * Karakteristik:
 * - Entropi kriptografis tinggi melalui crypto.randomBytes() (tanpa Math.random()).
 * - Format: [PREFIX]-[YYYYMMDD]-[RANDOM_SUFFIX]
 * - Panjang standar 20-21 karakter (sangat aman dalam batas SQL VARCHAR(50)).
 * - Deterministik dalam struktur tanggal dan validasi format.
 *
 * PERHATIAN ARSITEKTUR:
 * Utilitas ini menghasilkan nomor faktur dengan probabilitas benturan mendekati nol
 * (~1 banding 1 triliun per hari per bisnis). Namun, di lingkungan terdistribusi/multi-worker,
 * DATABASE UNIQUE CONSTRAINT (uq_sales_invoice / uq_purchases_invoice) tetap merupakan
 * penjamin keunikan mutlak terakhir (last line of defense).
 */
export function generateInvoiceNumber(options: GenerateInvoiceOptions = {}): string {
  const {
    type = "SALE",
    prefix: customPrefix,
    date = new Date(),
    suffixLength = INVOICE_CONSTRAINTS.DEFAULT_SUFFIX_LENGTH,
  } = options;

  let selectedPrefix: string;

  if (customPrefix !== undefined) {
    const trimmedPrefix = customPrefix.trim().toUpperCase();
    if (
      trimmedPrefix.length < INVOICE_CONSTRAINTS.MIN_PREFIX_LENGTH ||
      trimmedPrefix.length > INVOICE_CONSTRAINTS.MAX_PREFIX_LENGTH ||
      !/^[A-Z]+$/.test(trimmedPrefix)
    ) {
      throw new Error(
        `INVALID_PREFIX: prefix must be between ${INVOICE_CONSTRAINTS.MIN_PREFIX_LENGTH} and ${INVOICE_CONSTRAINTS.MAX_PREFIX_LENGTH} uppercase letters`
      );
    }
    selectedPrefix = trimmedPrefix;
  } else {
    selectedPrefix = type === "PURCHASE" ? "PO" : "INV";
  }

  const dateStr = formatDateToUtcDateString(date);
  const suffix = generateSecureRandomSuffix(suffixLength);

  const invoiceNumber = `${selectedPrefix}-${dateStr}-${suffix}`;

  // Validasi batas SQL VARCHAR(50) dan CHECK (char_length(trim(invoice_number)) >= 3)
  if (
    invoiceNumber.length < INVOICE_CONSTRAINTS.MIN_LENGTH ||
    invoiceNumber.length > INVOICE_CONSTRAINTS.MAX_LENGTH
  ) {
    throw new Error(
      `INVOICE_LENGTH_OVERFLOW: generated invoice length ${invoiceNumber.length} violates database constraint (3..50)`
    );
  }

  return invoiceNumber;
}

/**
 * Regex validasi struktur nomor invoice VeyraOS:
 * - Prefix: 2-10 huruf kapital ASCII
 * - Tanggal: 8 digit angka YYYYMMDD (tahun 2000-2099)
 * - Suffix: 6-12 karakter Crockford Base32
 */
export const INVOICE_REGEX = /^[A-Z]{2,10}-(?:20\d{2})(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-[0-9A-HJKMNP-TV-Z]{6,12}$/;

/**
 * Memvalidasi apakah nomor faktur memiliki format yang benar dan kompatibel dengan constraint database.
 */
export function isValidInvoiceNumber(invoice: unknown): boolean {
  if (typeof invoice !== "string") {
    return false;
  }

  const trimmed = invoice.trim();
  if (trimmed !== invoice) {
    return false; // Dilarang mengandung leading/trailing whitespace
  }

  if (
    trimmed.length < INVOICE_CONSTRAINTS.MIN_LENGTH ||
    trimmed.length > INVOICE_CONSTRAINTS.MAX_LENGTH
  ) {
    return false;
  }

  return INVOICE_REGEX.test(trimmed);
}

/**
 * Mengurai (parse) komponen nomor faktur jika valid.
 */
export function parseInvoiceNumber(invoice: string): ParsedInvoiceNumber | null {
  if (!isValidInvoiceNumber(invoice)) {
    return null;
  }

  const parts = invoice.split("-");
  if (parts.length !== 3) {
    return null;
  }

  return {
    prefix: parts[0],
    dateStr: parts[1],
    suffix: parts[2],
    raw: invoice,
  };
}
