import { describe, it, expect } from "vitest";
import {
  UTF8_BOM,
  sanitizeCsvStringCell,
  formatCsvCell,
  buildCsvDocument,
} from "./csv";

describe("CSV Generation & Formula Injection Mitigation (src/lib/csv.ts)", () => {
  describe("sanitizeCsvStringCell", () => {
    it("menyanitasi teks yang diawali karakter pemicu formula (=, +, -, @)", () => {
      expect(sanitizeCsvStringCell("=SUM(A1:A5)")).toBe("'=SUM(A1:A5)");
      expect(sanitizeCsvStringCell("+123456")).toBe("'+123456");
      expect(sanitizeCsvStringCell("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
      expect(sanitizeCsvStringCell("@evil_site")).toBe("'@evil_site");
    });

    it("menyanitasi formula yang diawali whitespace, tab (\\t), atau carriage return (\\r)", () => {
      expect(sanitizeCsvStringCell("   =1+1")).toBe("'   =1+1");
      expect(sanitizeCsvStringCell("\t@SUM(1,2)")).toBe("'\t@SUM(1,2)");
      expect(sanitizeCsvStringCell("\r-calc")).toBe("'\r-calc");
    });

    it("membiarkan teks biasa tanpa modifikasi", () => {
      expect(sanitizeCsvStringCell("Penjualan Beras")).toBe("Penjualan Beras");
      expect(sanitizeCsvStringCell("INV-20261014-0001")).toBe("INV-20261014-0001");
      expect(sanitizeCsvStringCell("")).toBe("");
    });
  });

  describe("formatCsvCell", () => {
    it("mempertahankan angka numerik negatif sah murni tanpa tanda kutip tunggal", () => {
      // Nominal negatif sah pada laporan laba/arus kas (misal: laba negatif -150000)
      expect(formatCsvCell(-150000)).toBe("-150000");
      expect(formatCsvCell(-25)).toBe("-25");
      expect(formatCsvCell(0)).toBe("0");
      expect(formatCsvCell(500000)).toBe("500000");
    });

    it("memformat nilai boolean dan null/undefined dengan benar", () => {
      expect(formatCsvCell(true)).toBe("true");
      expect(formatCsvCell(false)).toBe("false");
      expect(formatCsvCell(null)).toBe("");
      expect(formatCsvCell(undefined)).toBe("");
    });

    it("menerapkan escaping RFC 4180 untuk teks yang memuat koma, kutip ganda, atau newline", () => {
      expect(formatCsvCell('Beras "Super", Pandan')).toBe('"Beras ""Super"", Pandan"');
      expect(formatCsvCell("Baris 1\nBaris 2")).toBe('"Baris 1\nBaris 2"');
      expect(formatCsvCell("Catatan, penting")).toBe('"Catatan, penting"');
    });

    it("menggabungkan sanitasi formula injection dengan escaping RFC 4180 jika diperlukan", () => {
      // Formula dengan koma
      const cellWithFormulaAndComma = formatCsvCell("=SUM(A1, B1)");
      // Terlebih dahulu diberi kutip tunggal: '=SUM(A1, B1)
      // Karena memuat koma, dibungkus kutip ganda: "'=SUM(A1, B1)"
      expect(cellWithFormulaAndComma).toBe('"\'=SUM(A1, B1)"');
    });
  });

  describe("buildCsvDocument", () => {
    it("menghasilkan dokumen CSV ber-BOM UTF-8 dengan CRLF line breaks", () => {
      const headers = ["No Invoice", "Tanggal", "Total"];
      const rows = [
        ["INV-001", "2026-10-14", 150000],
        ["INV-002", "2026-10-14", 250000],
      ];

      const csv = buildCsvDocument(headers, rows);

      expect(csv.startsWith(UTF8_BOM)).toBe(true);
      expect(csv).toContain("No Invoice,Tanggal,Total\r\n");
      expect(csv).toContain("INV-001,2026-10-14,150000\r\n");
      expect(csv).toContain("INV-002,2026-10-14,250000\r\n");
    });

    it("menghasilkan header saja jika baris data kosong", () => {
      const headers = ["Kategori", "Jumlah"];
      const csv = buildCsvDocument(headers, []);

      expect(csv.startsWith(UTF8_BOM)).toBe(true);
      expect(csv).toBe(`${UTF8_BOM}Kategori,Jumlah\r\n`);
    });
  });
});
