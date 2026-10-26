/**
 * Utilitas CSV RFC 4180 dengan Mitigasi CSV Formula Injection (CWE-1236) & Dukungan UTF-8 BOM.
 *
 * Spesifikasi VeyraOS Phase 4, Substage 3.2.3:
 * 1. Pembedaan tipe data:
 *    - Nilai numerik moneter & kuantitas (number) diekspor murni sebagai angka.
 *    - Nilai numerik negatif sah (misal: -150000) DILARANG diberi prefix tanda kutip tunggal
 *      agar spreadsheet pengguna tetap membacanya sebagai tipe data Number.
 * 2. Mitigasi Formula Injection (CWE-1236):
 *    - Sel teks string yang diawali oleh salah satu karakter pemicu { '=', '+', '-', '@', '\t', '\r' }
 *      diberi prefix tanda kutip tunggal (').
 * 3. Escaping RFC 4180:
 *    - Sel yang memuat koma (,), tanda kutip ganda ("), atau newline (\n / \r) dibungkus tanda kutip ganda ("...").
 *    - Tanda kutip ganda di dalam sel di-escape menjadi dua kutip ganda berturutan ("").
 * 4. Header UTF-8 BOM (\uFEFF):
 *    - Menjamin deteksi encoding otomatis UTF-8 pada Microsoft Excel di lingkungan Windows / locale ID.
 */

export const UTF8_BOM = "\uFEFF";

const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Menyanitasi sel teks string dari risiko CSV Formula Injection (CWE-1236).
 */
export function sanitizeCsvStringCell(value: string): string {
  if (!value) {
    return "";
  }

  // Periksa apakah teks (atau teks setelah spasi awal di-trim) diawali karakter pemicu
  const trimmed = value.trimStart();
  if (trimmed.length > 0 && FORMULA_TRIGGER_CHARS.has(trimmed[0])) {
    return `'${value}`;
  }

  if (value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0])) {
    return `'${value}`;
  }

  return value;
}

/**
 * Memformat sel individual untuk CSV RFC 4180 dengan perlindungan formula injection.
 */
export function formatCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    // Angka sah (positif, nol, atau negatif) diekspor langsung sebagai representasi numerik murni
    return Number.isFinite(value) ? String(value) : "0";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const sanitized = sanitizeCsvStringCell(String(value));

  // Escaping RFC 4180 jika mengandung tanda kutip, koma, atau newline
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * Membangun dokumen CSV lengkap berekstensi RFC 4180 dengan UTF-8 Byte Order Mark (BOM).
 */
export function buildCsvDocument(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const headerLine = headers.map((h) => formatCsvCell(h)).join(",");
  const rowLines = rows.map((row) => row.map((cell) => formatCsvCell(cell)).join(","));

  const body = rowLines.length > 0 ? `${headerLine}\r\n${rowLines.join("\r\n")}\r\n` : `${headerLine}\r\n`;

  return `${UTF8_BOM}${body}`;
}
