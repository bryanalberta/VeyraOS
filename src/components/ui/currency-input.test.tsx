import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrencyInput, calculateCursorPosition } from "./currency-input";

describe("Shared UI Primitive: CurrencyInput — Comprehensive & Remediation Suite", () => {
  it("merender input nominal Rupiah dengan prefix Rp dan id yang terhubung", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput id="expense-amount" label="Nominal Pengeluaran" value={50000} />
    );
    expect(html).toContain('<label for="expense-amount"');
    expect(html).toContain('id="expense-amount"');
    expect(html).toContain("Nominal Pengeluaran");
    expect(html).toContain("Rp");
    expect(html).toContain('value="50.000"');
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
  });

  it("kontrak nilai kosong: merender nilai kosong saat nilai integer bernilai 0 agar placeholder muncul", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput id="zero-amount" label="Harga Beli" value={0} placeholder="0" />
    );
    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="0"');
  });

  it("merender nominal besar dengan pemisah ribuan titik", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput id="large-amount" label="Modal Usaha" value={125000000} />
    );
    expect(html).toContain('value="125.000.000"');
  });

  it("merender pesan error dan status invalid jika errorMessage diberikan", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput
        id="error-amount"
        label="Harga Jual"
        errorMessage="Harga jual minimal Rp 1.000"
      />
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Harga jual minimal Rp 1.000");
    expect(html).toContain("border-[#C0392B]");
  });

  it("merender helperText jika tidak ada error", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput
        id="helper-amount"
        label="Diskon"
        helperText="Masukkan diskon nominal langsung."
      />
    );
    expect(html).toContain("Masukkan diskon nominal langsung.");
    expect(html).toContain("text-[#716D7A]");
  });

  it("dapat menyembunyikan prefix jika hidePrefix=true", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput id="no-prefix" label="Kuantitas Uang" hidePrefix value={10000} />
    );
    expect(html).not.toContain('<span class="absolute left-3 text-xs font-bold text-[#716D7A] select-none pointer-events-none" aria-hidden="true">Rp</span>');
  });

  it("menerapkan disabled state saat disabled=true", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput id="disabled-amount" label="Total Terkunci" disabled value={75000} />
    );
    expect(html).toContain("disabled");
    expect(html).toContain("disabled:cursor-not-allowed");
  });

  it("mendukung defaultValue pada komponen uncontrolled", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput id="uncontrolled-amount" label="Biaya" defaultValue={250000} />
    );
    expect(html).toContain('value="250.000"');
  });

  describe("Algoritma calculateCursorPosition & Preservasi Kursor", () => {
    it("menghitung posisi kursor ke 0 jika seluruh digit dihapus", () => {
      expect(calculateCursorPosition("", 0, "")).toBe(0);
      expect(calculateCursorPosition("   ", 2, "")).toBe(0);
    });

    it("mempertahankan posisi kursor saat mengetik di awal", () => {
      // User mengetik digit '5' di awal "000" -> "5000", terformat menjadi "5.000"
      // Posisi kursor sebelum format: 1 (setelah '5'). Digit sebelum: 1. Posisi baru: 1.
      expect(calculateCursorPosition("5000", 1, "5.000")).toBe(1);
    });

    it("memperhitungkan penambahan titik ribuan saat kursor berada di tengah digit", () => {
      // User mengetik digit '5' di tengah "10.000" -> "105.000"
      // rawText: "105000", cursor di index 3 (setelah '105').
      // formattedText: "105.000" -> 3 digit sebelum kursor ('1', '0', '5') -> posisi kursor baru: 3
      expect(calculateCursorPosition("105000", 3, "105.000")).toBe(3);

      // User mengetik digit '0' yang memicu perpindahan blok ribuan
      // rawText: "1000000", cursor di index 4 (setelah '1000') -> formatted "1.000.000"
      // digit sebelum: 4 ('1', '0', '0', '0') -> di "1.000.000", digit ke-4 ada di index 5
      expect(calculateCursorPosition("1000000", 4, "1.000.000")).toBe(5);
    });

    it("menangani penghapusan karakter di tengah ribuan dengan aman", () => {
      // User menghapus angka di tengah "1.500.000"
      // rawText: "150000", cursor di index 2 (setelah '15') -> formatted "150.000"
      // digit sebelum: 2 -> posisi baru di formatted adalah index 2
      expect(calculateCursorPosition("150000", 2, "150.000")).toBe(2);
    });
  });

  describe("Kontrak Angka Nol, Input Kosong, dan Batas", () => {
    it("memvalidasi dan menormalisasi batas min dan max pada render", () => {
      // Jika value melebihi max, komponen yang di-render meng-clamp ke max
      const htmlOverMax = renderToStaticMarkup(
        <CurrencyInput id="max-test" value={500000} max={100000} />
      );
      expect(htmlOverMax).toContain('value="100.000"');

      // Jika value di bawah min, komponen meng-clamp ke min
      const htmlUnderMin = renderToStaticMarkup(
        <CurrencyInput id="min-test" value={5000} min={10000} />
      );
      expect(htmlUnderMin).toContain('value="10.000"');
    });

    it("menormalisasi min negatif menjadi 0 secara aman", () => {
      const htmlNegativeMin = renderToStaticMarkup(
        <CurrencyInput id="neg-min-test" value={0} min={-5000} />
      );
      expect(htmlNegativeMin).toContain('value=""');
      expect(htmlNegativeMin).toContain('placeholder="0"');
    });
  });
});
