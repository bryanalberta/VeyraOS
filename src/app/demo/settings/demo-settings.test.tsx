import * as React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DemoSettingsPage from "./page";
import { demoStoreService } from "@/services/demo/demo-store.service";

describe("Modul Pengaturan Mode Demo (/demo/settings)", () => {
  beforeEach(() => {
    // Pastikan lingkungan Node terisolasi dari window crash
    if (typeof window === "undefined") {
      const storageMock: Record<string, string> = {};
      (global as unknown as { window: unknown }).window = {
        localStorage: {
          getItem: (key: string) => storageMock[key] || null,
          setItem: (key: string, val: string) => {
            storageMock[key] = val;
          },
          removeItem: (key: string) => {
            delete storageMock[key];
          },
          clear: () => {
            Object.keys(storageMock).forEach((k) => delete storageMock[k]);
          },
        },
      };
    }
    demoStoreService.resetState();
  });

  it("Skenario 1: Merender judul halaman dan identitas toko awal Toko Sembako Sejahtera", () => {
    const html = renderToStaticMarkup(<DemoSettingsPage />);

    expect(html).toContain("Pengaturan Mode Demo");
    expect(html).toContain("Toko Sembako Sejahtera");
    expect(html).toContain("Kelontong / Sembako");
    expect(html).toContain("Jl. Surya Kencana No. 45");
  });

  it("Skenario 2: Merender preferensi ukuran kertas struk kasir 58mm dan 80mm", () => {
    const html = renderToStaticMarkup(<DemoSettingsPage />);

    expect(html).toContain("Thermal 58mm (Kecil)");
    expect(html).toContain("Thermal 80mm (Besar)");
    expect(html).toContain("Pesan Catatan Kaki Struk (Receipt Footer)");
  });

  it("Skenario 3: Merender live preview nota kasir dengan nama toko dan footer struk", () => {
    const html = renderToStaticMarkup(<DemoSettingsPage />);

    expect(html).toContain("Pratinjau Struk Kasir");
    expect(html).toContain("receipt-live-preview");
    expect(html).toContain("TOTAL:");
    expect(html).toContain("TUNAI (CASH):");
    expect(html).toContain("Terima kasih atas kunjungan Anda!");
  });

  it("Skenario 4: Merender kontrol penyimpanan, ringkasan entitas, dan tombol reset/ekspor", () => {
    const html = renderToStaticMarkup(<DemoSettingsPage />);

    expect(html).toContain("Kontrol Penyimpanan &amp; Reset Simulasi");
    expect(html).toContain("Ekspor Backup JSON");
    expect(html).toContain("Kosongkan Transaksi Saja");
    expect(html).toContain("Reset ke Seed Awal");
    expect(html).toContain("Siap Beralih ke Akun Nyata VeyraOS?");
  });
});
