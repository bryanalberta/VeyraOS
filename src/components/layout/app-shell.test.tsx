import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sidebar, NAV_ITEMS } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileNav } from "./mobile-nav";
import { AppLayout } from "./app-layout";

describe("App Shell Component Suite", () => {
  describe("Sidebar Component", () => {
    it("renders VeyraOS brand and subtitle", () => {
      const html = renderToStaticMarkup(<Sidebar currentPath="/dashboard" />);
      expect(html).toContain("VeyraOS");
      expect(html).toContain("Manajemen UMKM");
      expect(html).toContain("<aside");
      expect(html).toContain('aria-label="Sidebar Navigasi"');
    });

    it("renders active business slot with name and category", () => {
      const html = renderToStaticMarkup(
        <Sidebar
          activeBusinessName="Toko Sembako Berkah"
          businessCategory="Kelontong"
          currentPath="/dashboard"
        />
      );
      expect(html).toContain("Toko Sembako Berkah");
      expect(html).toContain("Kelontong");
      expect(html).toContain('aria-label="Pilih atau ganti bisnis aktif"');
    });

    it("renders all 7 MVP navigation links with proper hrefs", () => {
      const html = renderToStaticMarkup(<Sidebar currentPath="/dashboard" />);
      expect(NAV_ITEMS).toHaveLength(7);

      NAV_ITEMS.forEach((item) => {
        expect(html).toContain(`href="${item.href}"`);
        const expectedText = item.label.replace("&", "&amp;");
        expect(html).toContain(expectedText);
      });
    });

    it("marks active page with aria-current='page' and active styles", () => {
      const html = renderToStaticMarkup(<Sidebar currentPath="/products" />);
      expect(html).toContain('href="/products"');
      expect(html).toContain('aria-current="page"');
    });
  });

  describe("TopBar Component", () => {
    it("renders page title and header landmark", () => {
      const html = renderToStaticMarkup(<TopBar title="Katalog Produk &amp; Stok" />);
      expect(html).toContain("<header");
      expect(html).toContain('aria-label="Bilah Atas Aplikasi"');
      expect(html).toContain("Katalog Produk &amp; Stok");
    });

    it("renders mobile menu hamburger button with accessible label", () => {
      const onToggle = () => {};
      const html = renderToStaticMarkup(<TopBar onMenuToggle={onToggle} />);
      expect(html).toContain('aria-label="Buka menu navigasi"');
    });

    it("renders user avatar initial and name", () => {
      const html = renderToStaticMarkup(
        <TopBar userName="Budi Santoso" userEmail="budi@example.com" />
      );
      expect(html).toContain("B"); // Initial
      expect(html).toContain("Budi Santoso");
      expect(html).toContain("budi@example.com");
    });
  });

  describe("MobileNav Component", () => {
    it("renders mobile navigation landmark with 4 primary links and more button", () => {
      const html = renderToStaticMarkup(<MobileNav currentPath="/sales" />);
      expect(html).toContain("<nav");
      expect(html).toContain('aria-label="Navigasi Bawah Ponsel"');
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('href="/sales"');
      expect(html).toContain('href="/products"');
      expect(html).toContain('href="/reports"');
      expect(html).toContain("Lainnya");
      expect(html).toContain('aria-label="Buka menu navigasi lainnya"');
    });

    it("marks active mobile link with aria-current='page'", () => {
      const html = renderToStaticMarkup(<MobileNav currentPath="/sales" />);
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('href="/sales"');
    });
  });

  describe("AppLayout Integration", () => {
    it("renders skip-to-content accessibility link pointing to #main-content", () => {
      const html = renderToStaticMarkup(
        <AppLayout title="Dashboard">
          <div>Konten Utama</div>
        </AppLayout>
      );
      expect(html).toContain('href="#main-content"');
      expect(html).toContain("Lewati ke konten utama");
      expect(html).toContain('id="main-content"');
      expect(html).toContain("Konten Utama");
    });

    it("assembles Sidebar, TopBar, and MobileNav into a coherent structure", () => {
      const html = renderToStaticMarkup(
        <AppLayout
          title="Manajemen Pengeluaran"
          activeBusinessName="Warung Kopi Sejahtera"
          currentPath="/expenses"
        >
          <div data-testid="child-content">Daftar Biaya Operasional</div>
        </AppLayout>
      );

      expect(html).toContain("VeyraOS");
      expect(html).toContain("Warung Kopi Sejahtera");
      expect(html).toContain("Manajemen Pengeluaran");
      expect(html).toContain("Daftar Biaya Operasional");
      expect(html).toContain("<aside");
      expect(html).toContain("<header");
      expect(html).toContain("<main");
      expect(html).toContain("<nav");
    });
  });
});
