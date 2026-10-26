/**
 * VeyraOS — Centralized Financial & Currency Formatters
 * 
 * Modul terpusat untuk pemformatan mata uang Rupiah Indonesia (IDR) dan angka finansial.
 * Mengutamakan presisi integer (tanpa floating point loss) dan kompatibilitas
 * penuh dengan seluruh modul transaksi, laporan, dan mode demo.
 * 
 * Kontrak Spesifikasi Finansial VeyraOS:
 * 1. Presisi Mata Uang: Rupiah Indonesia (IDR) tidak menggunakan sen/pecahan. Semua nilai
 *    pecahan (float) otomatis dibulatkan ke integer terdekat (Math.round).
 * 2. Fail-Safe Non-Finite: Input non-finite (NaN, Infinity, -Infinity), null, atau undefined
 *    secara fail-safe menghasilkan "Rp 0" (atau "0") tanpa melempar unhandled exception di UI.
 * 3. Nilai Negatif: Didukung secara deterministik dengan tanda minus di depan ("-Rp 50.000" atau "-50.000").
 * 4. Batas Presisi MAX_SAFE_INTEGER & Kontrak Number vs BigInt:
 *    - Untuk tipe `number`: Bilangan di luar rentang safe integer [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
 *      (±9.007.199.254.740.991) telah kehilangan presisi floating-point IEEE-754 sebelum diterima oleh fungsi ini.
 *      Konversi internal ke BigInt(Math.trunc(amount)) bertindak sebagai fail-safe agar pemformat tidak mengalami
 *      overflow/crash dan memformat nilai float yang tersedia, namun TIDAK dapat memulihkan digit yang telah hilang.
 *    - Untuk tipe `bigint`: Presisi digit eksak dipertahankan 100% tanpa batas aman IEEE-754.
 *      Untuk nominal di atas 9 kuadriliun Rupiah yang membutuhkan presisi eksak hingga digit satuan,
 *      pemanggil WAJIB meneruskan nilai sebagai tipe `bigint` (misal: 9007199254740993n atau BigInt("...")).
 * 5. Parsing Rupiah (parseRupiah): Selalu menghasilkan safe integer murni (0 jika kosong/invalid,
 *    dan di-clamp ke batas Number.MAX_SAFE_INTEGER / Number.MIN_SAFE_INTEGER).
 */

/**
 * Memformat angka (number | bigint | null | undefined) ke format Rupiah Indonesia (IDR).
 * Menghasilkan string berformat resmi, misal: "Rp 1.500.000", "Rp 0", atau "-Rp 50.000".
 * 
 * Mendukung number aman, BigInt aman, serta BigInt sangat besar yang melebihi
 * Number.MAX_SAFE_INTEGER dengan presisi digit eksak. Untuk tipe number yang melebihi
 * safe integer, diformat secara fail-safe tanpa crash menggunakan representasi float yang tersedia.
 */
export function formatRupiah(amount: number | bigint | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "Rp 0";
  }

  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

  // Penanganan BigInt
  if (typeof amount === "bigint") {
    if (amount <= maxSafe && amount >= minSafe) {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(amount));
    }

    // Untuk BigInt sangat besar yang melebihi batas presisi number JavaScript, format berbasis string
    const zeroBig = BigInt(0);
    const isNegative = amount < zeroBig;
    const absVal = isNegative ? -amount : amount;
    const formattedNum = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${isNegative ? "-Rp " : "Rp "}${formattedNum}`;
  }

  // Penanganan number: validasi non-finite (NaN, Infinity, -Infinity)
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || Number.isNaN(amount)) {
      return "Rp 0";
    }

    // Bulatkan nilai pecahan ke integer Rupiah terdekat
    const rounded = Math.round(amount);

    // Jika nilai number melampaui safe integer, delegasikan ke penanganan BigInt
    if (!Number.isSafeInteger(rounded)) {
      try {
        const bigVal = BigInt(Math.trunc(amount));
        return formatRupiah(bigVal);
      } catch {
        return "Rp 0";
      }
    }

    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  }

  return "Rp 0";
}

/**
 * Memformat angka ke string dengan pemisah ribuan titik Indonesia tanpa prefix "Rp".
 * Contoh: 1500000 -> "1.500.000", -25000 -> "-25.000", 0 -> "0".
 * Menangani pecahan (dibulatkan), non-finite (kembali "0"), dan nilai negatif.
 */
export function formatNumber(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) {
    return "0";
  }

  if (typeof value === "bigint") {
    const isNegative = value < BigInt(0);
    const absVal = isNegative ? -value : value;
    const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return isNegative ? `-${formatted}` : formatted;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return "0";
    }

    const isNegative = value < 0;
    const rounded = Math.round(value);

    if (!Number.isSafeInteger(rounded)) {
      try {
        const bigVal = BigInt(Math.trunc(value));
        return formatNumber(bigVal);
      } catch {
        return "0";
      }
    }

    const absVal = Math.abs(rounded);
    const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return isNegative ? `-${formatted}` : formatted;
  }

  return "0";
}

/**
 * Mengonversi string input berformat Rupiah atau angka mentah menjadi integer murni (IDR).
 * Menghilangkan karakter non-digit (kecuali minus di awal), mengabaikan pecahan/desimal.
 * 
 * Kontrak Nilai Kosong & Batas:
 * - String kosong, spasi, atau tanpa digit -> menghasilkan 0.
 * - Nilai float -> dibulatkan ke integer (Math.round).
 * - Melebihi Number.MAX_SAFE_INTEGER -> di-clamp ke Number.MAX_SAFE_INTEGER.
 * - Kurang dari Number.MIN_SAFE_INTEGER -> di-clamp ke Number.MIN_SAFE_INTEGER.
 * 
 * Contoh:
 * - "Rp 1.500.000" -> 1500000
 * - "1.500.000"    -> 1500000
 * - "25000"        -> 25000
 * - "" / null      -> 0
 * - "-Rp 50.000"   -> -50000
 */
export function parseRupiah(input: string | number | null | undefined): number {
  if (input === null || input === undefined) {
    return 0;
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || Number.isNaN(input)) return 0;
    const rounded = Math.round(input);
    if (rounded > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
    if (rounded < Number.MIN_SAFE_INTEGER) return Number.MIN_SAFE_INTEGER;
    return rounded;
  }

  const trimmed = String(input).trim();
  if (!trimmed) {
    return 0;
  }

  const isNegative = trimmed.startsWith("-") || trimmed.includes("-Rp") || trimmed.includes("-(Rp");
  const cleanDigits = trimmed.replace(/\D/g, "");

  if (!cleanDigits) {
    return 0;
  }

  const parsed = parseInt(cleanDigits, 10);
  if (isNaN(parsed)) {
    return 0;
  }

  const finalValue = isNegative ? -parsed : parsed;

  // Batas aman Integer JavaScript
  if (finalValue > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (finalValue < Number.MIN_SAFE_INTEGER) {
    return Number.MIN_SAFE_INTEGER;
  }

  return finalValue;
}
