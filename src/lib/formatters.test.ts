import { describe, it, expect } from "vitest";
import { formatRupiah, formatNumber, parseRupiah } from "./formatters";

describe("Centralized Financial Formatters (src/lib/formatters.ts) — Boundary & Remediation Suite", () => {
  describe("formatRupiah", () => {
    it("memformat 0 dengan benar", () => {
      expect(formatRupiah(0)).toMatch(/Rp\s*0/);
    });

    it("memformat nilai null, undefined, NaN, Infinity, -Infinity secara fail-safe sebagai Rp 0", () => {
      expect(formatRupiah(null)).toMatch(/Rp\s*0/);
      expect(formatRupiah(undefined)).toMatch(/Rp\s*0/);
      expect(formatRupiah(NaN)).toMatch(/Rp\s*0/);
      expect(formatRupiah(Infinity)).toMatch(/Rp\s*0/);
      expect(formatRupiah(-Infinity)).toMatch(/Rp\s*0/);
    });

    it("membulatkan nilai pecahan float ke integer terdekat (tanpa sen)", () => {
      expect(formatRupiah(1500.25)).toMatch(/Rp\s*1\.500/);
      expect(formatRupiah(1500.75)).toMatch(/Rp\s*1\.501/);
    });

    it("memformat bilangan bulat positif umum dengan pemisah ribuan titik", () => {
      expect(formatRupiah(25000)).toMatch(/Rp\s*25\.000/);
      expect(formatRupiah(1500000)).toMatch(/Rp\s*1\.500\.000/);
      expect(formatRupiah(99999)).toMatch(/Rp\s*99\.999/);
    });

    it("memformat bilangan bulat negatif dengan tanda minus", () => {
      const negativeResult = formatRupiah(-50000);
      expect(negativeResult).toMatch(/-.*Rp.*50\.000/);
    });

    it("memformat batas Number.MAX_SAFE_INTEGER dan Number.MIN_SAFE_INTEGER", () => {
      const maxSafe = Number.MAX_SAFE_INTEGER; // 9007199254740991
      const minSafe = Number.MIN_SAFE_INTEGER; // -9007199254740991
      expect(formatRupiah(maxSafe)).toContain("9.007.199.254.740.991");
      expect(formatRupiah(minSafe)).toContain("9.007.199.254.740.991");
      expect(formatRupiah(minSafe)).toMatch(/-.*Rp/);
    });

    it("mempertahankan presisi digit eksak untuk BigInt di atas MAX_SAFE_INTEGER", () => {
      const safeBig = BigInt(5000000);
      expect(formatRupiah(safeBig)).toMatch(/Rp\s*5\.000\.000/);

      // Dua BigInt berbeda di atas MAX_SAFE_INTEGER menghasilkan format yang berbeda dan eksak
      const bigVal1 = BigInt("9007199254740993");
      const bigVal2 = BigInt("9007199254740992");
      expect(formatRupiah(bigVal1)).toContain("9.007.199.254.740.993");
      expect(formatRupiah(bigVal2)).toContain("9.007.199.254.740.992");
      expect(formatRupiah(bigVal1)).not.toBe(formatRupiah(bigVal2));

      // Negatif BigInt sangat besar
      expect(formatRupiah(BigInt("-9007199254740993"))).toBe("-Rp 9.007.199.254.740.993");

      const hugeBig = BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10);
      const formattedHuge = formatRupiah(hugeBig);
      expect(formattedHuge).toContain("90.071.992.547.409.910");
    });

    it("menangani number di luar Number.MAX_SAFE_INTEGER secara fail-safe tanpa crash (presisi float yang tersedia)", () => {
      // Membuktikan keterbatasan tipe number: runtime JS membulatkan 9007199254740993 ke 9007199254740992
      const unsafeNumber = 9007199254740993;
      expect(unsafeNumber).toBe(9007199254740992);

      // formatRupiah memformat nilai float yang tersedia secara fail-safe tanpa crash
      const formatted = formatRupiah(unsafeNumber);
      expect(formatted).toContain("Rp");
      expect(formatted).toContain("9.007.199.254.740.992");

      // Number negatif di luar safe integer
      const negativeUnsafe = -9007199254740992;
      expect(formatRupiah(negativeUnsafe)).toContain("9.007.199.254.740.992");
    });
  });

  describe("formatNumber", () => {
    it("memformat 0 dan nilai non-finite secara fail-safe", () => {
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(null)).toBe("0");
      expect(formatNumber(undefined)).toBe("0");
      expect(formatNumber(NaN)).toBe("0");
      expect(formatNumber(Infinity)).toBe("0");
      expect(formatNumber(-Infinity)).toBe("0");
    });

    it("membulatkan nilai pecahan float", () => {
      expect(formatNumber(1500.4)).toBe("1.500");
      expect(formatNumber(1500.6)).toBe("1.501");
    });

    it("memformat angka positif dengan pemisah ribuan titik tanpa prefix Rp", () => {
      expect(formatNumber(1500)).toBe("1.500");
      expect(formatNumber(25000)).toBe("25.000");
      expect(formatNumber(1500000)).toBe("1.500.000");
      expect(formatNumber(100000000)).toBe("100.000.000");
    });

    it("memformat angka negatif", () => {
      expect(formatNumber(-25000)).toBe("-25.000");
    });

    it("memformat BigInt", () => {
      expect(formatNumber(BigInt(5000000))).toBe("5.000.000");
      expect(formatNumber(BigInt(-5000000))).toBe("-5.000.000");
    });

    it("memformat batas safe integer dan BigInt besar pada formatNumber", () => {
      expect(formatNumber(Number.MAX_SAFE_INTEGER)).toBe("9.007.199.254.740.991");
      expect(formatNumber(Number.MIN_SAFE_INTEGER)).toBe("-9.007.199.254.740.991");
      expect(formatNumber(BigInt("9007199254740993"))).toBe("9.007.199.254.740.993");
      expect(formatNumber(BigInt("-9007199254740993"))).toBe("-9.007.199.254.740.993");
    });
  });

  describe("parseRupiah", () => {
    it("mengonversi input kosong, null, undefined, atau string tanpa digit menjadi 0", () => {
      expect(parseRupiah("")).toBe(0);
      expect(parseRupiah("   ")).toBe(0);
      expect(parseRupiah(null)).toBe(0);
      expect(parseRupiah(undefined)).toBe(0);
      expect(parseRupiah("abc")).toBe(0);
      expect(parseRupiah(NaN)).toBe(0);
      expect(parseRupiah(Infinity)).toBe(0);
    });

    it("mengonversi angka murni dan membulatkan float", () => {
      expect(parseRupiah(25000)).toBe(25000);
      expect(parseRupiah(25000.7)).toBe(25001);
      expect(parseRupiah(0)).toBe(0);
    });

    it("mengonversi string angka polos", () => {
      expect(parseRupiah("25000")).toBe(25000);
      expect(parseRupiah("1500000")).toBe(1500000);
    });

    it("mengonversi string berformat Rupiah dengan titik dan spasi", () => {
      expect(parseRupiah("Rp 25.000")).toBe(25000);
      expect(parseRupiah("Rp 1.500.000")).toBe(1500000);
      expect(parseRupiah("Rp. 500.000")).toBe(500000);
      expect(parseRupiah("Rp50000")).toBe(50000);
    });

    it("menangani string dengan format paste acak", () => {
      expect(parseRupiah("  Rp 1.250.000,- ")).toBe(1250000);
      expect(parseRupiah("TOTAL: Rp 75.000")).toBe(75000);
    });

    it("menangani nilai negatif", () => {
      expect(parseRupiah("-Rp 50.000")).toBe(-50000);
      expect(parseRupiah("-50000")).toBe(-50000);
    });

    it("membatasi angka agar tidak melampaui Number.MAX_SAFE_INTEGER dan MIN_SAFE_INTEGER", () => {
      const hugeString = "999999999999999999999999999999";
      expect(parseRupiah(hugeString)).toBe(Number.MAX_SAFE_INTEGER);

      const hugeNegativeString = "-999999999999999999999999999999";
      expect(parseRupiah(hugeNegativeString)).toBe(Number.MIN_SAFE_INTEGER);
    });
  });
});
