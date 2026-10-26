import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCard } from "./stat-card";

describe("Shared UI Primitive: StatCard — Comprehensive & Remediation Suite", () => {
  it("merender kartu non-interaktif sebagai elemen div tanpa button role", () => {
    const html = renderToStaticMarkup(
      <StatCard title="Total Transaksi" value="1.248" />
    );
    expect(html).toContain("<div");
    expect(html).not.toContain("<button");
    expect(html).toContain("Total Transaksi");
    expect(html).toContain("1.248");
  });

  it("merender kartu interaktif sebagai elemen native button type='button' jika onClick diberikan", () => {
    const handleClick = vi.fn();
    const html = renderToStaticMarkup(
      <StatCard
        id="clickable-card"
        title="Klik Detail Omzet"
        value="Rp 50.000.000"
        onClick={handleClick}
      />
    );
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain('id="clickable-card"');
    expect(html).toContain("cursor-pointer");
  });

  it("menerapkan class font-financial jika isFinancial=true", () => {
    const html = renderToStaticMarkup(
      <StatCard title="Omzet Bersih" value="Rp 25.400.000" isFinancial={true} />
    );
    expect(html).toContain("font-financial");
    expect(html).toContain("Rp 25.400.000");
  });

  it("merender icon aksen Royal Violet berlatar lavender tint", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Kas Masuk"
        value="Rp 12.000.000"
        icon={<span data-testid="wallet-icon">💰</span>}
      />
    );
    expect(html).toContain("💰");
    expect(html).toContain("bg-[#EAE4FF]");
    expect(html).toContain("text-[#5B3CC4]");
  });

  it("merender badge trend positif dengan warna hijau dan label", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Laba Kotor"
        value="Rp 8.500.000"
        trend={{ value: "+14.2%", isPositive: true, label: "vs minggu lalu" }}
      />
    );
    expect(html).toContain("+14.2%");
    expect(html).toContain("vs minggu lalu");
    expect(html).toContain("bg-[#E8F8F0]");
    expect(html).toContain("text-[#0E6251]");
  });

  it("merender badge trend negatif dengan warna merah", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Beban Operasional"
        value="Rp 3.200.000"
        trend={{ value: "-5.0%", isPositive: false }}
      />
    );
    expect(html).toContain("-5.0%");
    expect(html).toContain("bg-[#FDEDEC]");
    expect(html).toContain("text-[#922B21]");
  });

  it("merender skeleton placeholder saat isLoading=true", () => {
    const html = renderToStaticMarkup(
      <StatCard title="Memuat Data" value="Rp 0" isLoading={true} />
    );
    expect(html).toContain("animate-shimmer");
    expect(html).not.toContain("text-xl sm:text-2xl font-bold");
  });

  it("men-disable button saat disabled=true pada kartu interaktif", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Kartu Nonaktif"
        value="0"
        onClick={() => {}}
        disabled={true}
      />
    );
    expect(html).toContain("<button");
    expect(html).toContain("disabled");
  });

  it("men-disable button kartu interaktif saat isLoading=true", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Sedang Memuat"
        value="Rp 0"
        onClick={() => {}}
        isLoading={true}
      />
    );
    expect(html).toContain("<button");
    expect(html).toContain("disabled");
    expect(html).toContain("animate-shimmer");
  });

  it("merender subtitle mandiri jika trend tidak disediakan", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Total Pelanggan"
        value="350"
        subtitle="Pelanggan terdaftar bulan ini"
      />
    );
    expect(html).toContain("Pelanggan terdaftar bulan ini");
  });

  it("menyertakan kelas focus-visible ring pada kartu interaktif", () => {
    const html = renderToStaticMarkup(
      <StatCard
        title="Aksi Cepat"
        value="Lihat Laporan"
        onClick={() => {}}
      />
    );
    expect(html).toContain("focus-visible:ring-3");
    expect(html).toContain("focus-visible:ring-[rgba(91,60,196,0.28)]");
  });
});
