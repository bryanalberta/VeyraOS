import { describe, expect, it, vi } from "vitest";
import {
  generateInvoiceNumber,
  isValidInvoiceNumber,
  parseInvoiceNumber,
  generateSecureRandomSuffix,
  formatDateToUtcDateString,
  INVOICE_CONSTRAINTS,
  INVOICE_ALPHABET,
} from "./invoice";

describe("Invoice Number Generator & Validator (src/lib/invoice.ts)", () => {
  describe("1. Format & SQL Constraint Compatibility", () => {
    it("menghasilkan nomor invoice penjualan default dengan format INV-YYYYMMDD-XXXXXXXX (21 karakter)", () => {
      const fixedDate = new Date("2026-10-13T12:00:00Z");
      const invoice = generateInvoiceNumber({ type: "SALE", date: fixedDate });

      expect(invoice).toMatch(/^INV-20261013-[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(invoice.length).toBe(21);
      expect(invoice.length).toBeLessThanOrEqual(INVOICE_CONSTRAINTS.MAX_LENGTH);
      expect(invoice.length).toBeGreaterThanOrEqual(INVOICE_CONSTRAINTS.MIN_LENGTH);
      expect(isValidInvoiceNumber(invoice)).toBe(true);
    });

    it("menghasilkan nomor invoice pembelian (restock) dengan format PO-YYYYMMDD-XXXXXXXX (20 karakter)", () => {
      const fixedDate = new Date("2026-10-13T12:00:00Z");
      const invoice = generateInvoiceNumber({ type: "PURCHASE", date: fixedDate });

      expect(invoice).toMatch(/^PO-20261013-[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(invoice.length).toBe(20);
      expect(isValidInvoiceNumber(invoice)).toBe(true);
    });

    it("mendukung prefix kustom yang valid (misal TRX, RETUR, POS)", () => {
      const fixedDate = new Date("2026-10-13T00:00:00Z");
      const invoice = generateInvoiceNumber({
        prefix: "POS",
        date: fixedDate,
      });

      expect(invoice).toMatch(/^POS-20261013-[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(isValidInvoiceNumber(invoice)).toBe(true);
    });

    it("panjang karakter selalu mematuhi batas SQL VARCHAR(50) untuk berbagai panjang suffix", () => {
      for (let len = INVOICE_CONSTRAINTS.MIN_SUFFIX_LENGTH; len <= INVOICE_CONSTRAINTS.MAX_SUFFIX_LENGTH; len++) {
        const invoice = generateInvoiceNumber({ suffixLength: len });
        expect(invoice.length).toBeLessThanOrEqual(50);
        expect(invoice.length).toBeGreaterThanOrEqual(3);
        expect(isValidInvoiceNumber(invoice)).toBe(true);
      }
    });
  });

  describe("2. Node.js CSPRNG Security & Zero Math.random() Dependency", () => {
    it("TIDAK memanggil Math.random() sama sekali selama proses pembuatan invoice", () => {
      const mathRandomSpy = vi.spyOn(Math, "random");

      // Generate 100 invoice berturut-turut
      for (let i = 0; i < 100; i++) {
        generateInvoiceNumber();
      }

      expect(mathRandomSpy).not.toHaveBeenCalled();
      mathRandomSpy.mockRestore();
    });

    it("hanya menggunakan karakter dari alfabet Crockford Base32 yang ditentukan (tanpa I, L, O, U)", () => {
      for (let i = 0; i < 50; i++) {
        const suffix = generateSecureRandomSuffix(8);
        for (const char of suffix) {
          expect(INVOICE_ALPHABET).toContain(char);
          expect(["I", "L", "O", "U"]).not.toContain(char);
        }
      }
    });

    it("uji keunikan probabilistik: 10.000 invoice berturut-turut pada tanggal yang sama memiliki 0 benturan (kolisi)", () => {
      const generatedSet = new Set<string>();
      const sampleSize = 10000;
      const testDate = new Date("2026-10-13T10:00:00Z");

      for (let i = 0; i < sampleSize; i++) {
        const inv = generateInvoiceNumber({ date: testDate });
        generatedSet.add(inv);
      }

      // Seluruh 10.000 invoice harus unik
      expect(generatedSet.size).toBe(sampleSize);
    });
  });

  describe("3. Input Validation & Error Handling", () => {
    it("melempar error jika prefix tidak valid (kurang dari 2 huruf atau lebih dari 10 huruf)", () => {
      expect(() => generateInvoiceNumber({ prefix: "A" })).toThrowError(/INVALID_PREFIX/);
      expect(() => generateInvoiceNumber({ prefix: "TOOLONGPREFIX" })).toThrowError(/INVALID_PREFIX/);
      expect(() => generateInvoiceNumber({ prefix: "inv12" })).toThrowError(/INVALID_PREFIX/);
    });

    it("melempar error jika date tidak valid (NaN)", () => {
      expect(() => generateInvoiceNumber({ date: new Date("invalid-date") })).toThrowError(
        /INVALID_DATE/
      );
    });

    it("melempar RangeError jika suffixLength di luar batas 6..12", () => {
      expect(() => generateInvoiceNumber({ suffixLength: 5 })).toThrowError(/INVALID_SUFFIX_LENGTH/);
      expect(() => generateInvoiceNumber({ suffixLength: 13 })).toThrowError(/INVALID_SUFFIX_LENGTH/);
    });

    it("formatDateToUtcDateString mengembalikan format YYYYMMDD secara konsisten", () => {
      const date = new Date(Date.UTC(2026, 9, 13)); // Bulan Oktober (index 9) tanggal 13
      expect(formatDateToUtcDateString(date)).toBe("20261013");
    });
  });

  describe("4. Validator & Parser", () => {
    it("isValidInvoiceNumber menolak input non-string, string kosong, atau dengan whitespace", () => {
      expect(isValidInvoiceNumber(null)).toBe(false);
      expect(isValidInvoiceNumber(undefined)).toBe(false);
      expect(isValidInvoiceNumber(12345)).toBe(false);
      expect(isValidInvoiceNumber("")).toBe(false);
      expect(isValidInvoiceNumber("   ")).toBe(false);
      expect(isValidInvoiceNumber(" INV-20261013-7X8M9NP2")).toBe(false);
      expect(isValidInvoiceNumber("INV-20261013-7X8M9NP2 ")).toBe(false);
    });

    it("isValidInvoiceNumber menolak invoice dengan karakter terlarang (I, L, O, U, huruf kecil, simbol)", () => {
      // Huruf kecil
      expect(isValidInvoiceNumber("inv-20261013-7x8m9np2")).toBe(false);
      // Karakter ambigu
      expect(isValidInvoiceNumber("INV-20261013-7X8MINP2")).toBe(false); // Mengandung I
      expect(isValidInvoiceNumber("INV-20261013-7X8MONP2")).toBe(false); // Mengandung O
      expect(isValidInvoiceNumber("INV-20261013-7X8MLNP2")).toBe(false); // Mengandung L
      expect(isValidInvoiceNumber("INV-20261013-7X8MUNP2")).toBe(false); // Mengandung U
      // Simbol
      expect(isValidInvoiceNumber("INV-20261013-7X8M#NP2")).toBe(false);
    });

    it("isValidInvoiceNumber menolak invoice dengan panjang melebihi 50 karakter", () => {
      const longInvoice = "INV-20261013-" + "A".repeat(40);
      expect(longInvoice.length).toBeGreaterThan(50);
      expect(isValidInvoiceNumber(longInvoice)).toBe(false);
    });

    it("parseInvoiceNumber berhasil mengurai invoice valid dan mengembalikan null untuk invoice tidak valid", () => {
      const valid = "INV-20261013-7X8M9NP2";
      const parsed = parseInvoiceNumber(valid);
      expect(parsed).toEqual({
        prefix: "INV",
        dateStr: "20261013",
        suffix: "7X8M9NP2",
        raw: valid,
      });

      expect(parseInvoiceNumber("INVALID_INVOICE")).toBeNull();
    });
  });
});
