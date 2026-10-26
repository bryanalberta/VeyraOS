import { describe, it, expect } from "vitest";
import {
  generateDemoInvoiceNumber,
  formatJakartaDateString,
  generateRandomSuffix,
  DEMO_INVOICE_ALPHABET,
} from "./demo-invoice";

describe("demo-invoice — Browser-Safe Demo Invoice Generator", () => {
  it("memformat tanggal ke format 8 digit YYYYMMDD dalam zona waktu Asia/Jakarta", () => {
    // 2026-10-15 15:30:00 UTC = 2026-10-15 22:30:00 WIB (Asia/Jakarta, UTC+7)
    const testDate = new Date("2026-10-15T15:30:00Z");
    const formatted = formatJakartaDateString(testDate);
    expect(formatted).toBe("20261015");
  });

  it("memformat pergantian hari di zona waktu Asia/Jakarta dengan tepat", () => {
    // 2026-10-15 23:00:00 UTC = 2026-10-16 06:00:00 WIB
    const testDate = new Date("2026-10-15T23:00:00Z");
    const formatted = formatJakartaDateString(testDate);
    expect(formatted).toBe("20261016");
  });

  it("melempar TypeError jika tanggal yang diberikan invalid", () => {
    expect(() => formatJakartaDateString(new Date("invalid-date"))).toThrow(
      "INVALID_DATE"
    );
  });

  it("menghasilkan suffix acak dengan panjang default 4 karakter dari alfabet Crockford Base32", () => {
    const suffix = generateRandomSuffix();
    expect(suffix.length).toBe(4);
    for (const char of suffix) {
      expect(DEMO_INVOICE_ALPHABET).toContain(char);
    }
  });

  it("menghasilkan suffix deterministik dengan fungsi acak yang disuntikkan (dependency injection)", () => {
    // Indeks ke-0 = '0', Indeks ke-1 = '1', dsb.
    // alphabet length = 32. 0/32 = 0, 1/32 = 0.03125, dst.
    const mockValues = [0, 1 / 32, 2 / 32, 3 / 32];
    let callIdx = 0;
    const randomFn = () => mockValues[callIdx++] ?? 0;

    const suffix = generateRandomSuffix(4, randomFn);
    expect(suffix).toBe("0123");
  });

  it("melempar RangeError jika panjang suffix <= 0", () => {
    expect(() => generateRandomSuffix(0)).toThrow("INVALID_SUFFIX_LENGTH");
  });

  it("menghasilkan nomor faktur dengan format baku INV-YYYYMMDD-XXXX", () => {
    const testDate = new Date("2026-10-15T10:00:00Z");
    const invoice = generateDemoInvoiceNumber({ date: testDate });
    expect(invoice).toMatch(/^INV-20261015-[0-9A-Z]{4}$/);
  });

  it("menghindari benturan nomor faktur yang sudah ada di dataset", () => {
    const testDate = new Date("2026-10-15T10:00:00Z");

    // Simulasi: percobaan pertama bentrok, percobaan kedua berhasil
    let callCount = 0;
    const randomFn = () => {
      // 4 panggilan pertama menghasilkan 'AAAA' (indeks 10) -> 10/32 = 0.3125
      // 4 panggilan berikutnya menghasilkan 'BBBB' (indeks 11) -> 11/32 = 0.34375
      callCount++;
      return callCount <= 4 ? 10 / 32 : 11 / 32;
    };

    const existingSales = [{ invoiceNumber: "INV-20261015-AAAA" }];
    const invoice = generateDemoInvoiceNumber({
      date: testDate,
      existingSales,
      randomFn,
    });

    expect(invoice).toBe("INV-20261015-BBBB");
    expect(invoice).not.toBe("INV-20261015-AAAA");
  });

  it("melempar error jika batas maksimal percobaan tabrakan tercapai", () => {
    const testDate = new Date("2026-10-15T10:00:00Z");
    // Selalu menghasilkan suffix '0000'
    const randomFn = () => 0;
    const existingSales = [{ invoiceNumber: "INV-20261015-0000" }];

    expect(() =>
      generateDemoInvoiceNumber({
        date: testDate,
        existingSales,
        randomFn,
        maxAttempts: 5,
      })
    ).toThrow("INVOICE_GENERATION_FAILED");
  });
});
