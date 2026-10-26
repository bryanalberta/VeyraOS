import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Select } from "./select";

describe("Shared UI Primitive: Select", () => {
  it("merender select dengan label dan id yang terhubung", () => {
    const html = renderToStaticMarkup(
      <Select
        id="payment-method"
        label="Metode Pembayaran"
        options={[
          { value: "CASH", label: "Tunai" },
          { value: "QRIS", label: "QRIS" },
        ]}
      />
    );
    expect(html).toContain('<label for="payment-method"');
    expect(html).toContain('id="payment-method"');
    expect(html).toContain("Metode Pembayaran");
    expect(html).toContain('value="CASH"');
    expect(html).toContain("Tunai");
    expect(html).toContain('value="QRIS"');
    expect(html).toContain("QRIS");
  });

  it("merender option dari prop children", () => {
    const html = renderToStaticMarkup(
      <Select id="category-select" label="Kategori">
        <option value="fnb">Makanan & Minuman</option>
        <option value="retail">Ritel</option>
      </Select>
    );
    expect(html).toContain('value="fnb"');
    expect(html).toContain("Makanan &amp; Minuman");
    expect(html).toContain('value="retail"');
    expect(html).toContain("Ritel");
  });

  it("merender indikator wajib diisi (asterisk) jika required=true", () => {
    const html = renderToStaticMarkup(
      <Select id="required-select" label="Pilih Toko" required />
    );
    expect(html).toContain("*");
    expect(html).toContain("text-[#C0392B]");
  });

  it("merender errorMessage dan aria-invalid jika ada kesalahan", () => {
    const html = renderToStaticMarkup(
      <Select
        id="error-select"
        label="Pilih Akun"
        errorMessage="Akun kas wajib dipilih."
      />
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Akun kas wajib dipilih.");
    expect(html).toContain("border-[#C0392B]");
  });

  it("merender helperText jika tidak ada error", () => {
    const html = renderToStaticMarkup(
      <Select
        id="helper-select"
        label="Periode"
        helperText="Pilih rentang waktu laporan."
      />
    );
    expect(html).toContain("Pilih rentang waktu laporan.");
    expect(html).toContain("text-[#716D7A]");
  });

  it("menerapkan disabled state saat disabled=true", () => {
    const html = renderToStaticMarkup(
      <Select id="disabled-select" label="Terkunci" disabled />
    );
    expect(html).toContain("disabled");
    expect(html).toContain("disabled:cursor-not-allowed");
  });

  it("menyertakan icon panah kustom dan styling appearance-none", () => {
    const html = renderToStaticMarkup(
      <Select id="styled-select" label="Pilihan" />
    );
    expect(html).toContain("appearance-none");
    expect(html).toContain("pr-10");
  });
});
