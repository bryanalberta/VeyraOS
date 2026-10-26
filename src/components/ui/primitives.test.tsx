import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";
import { Input } from "./input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Badge } from "./badge";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { Alert } from "./alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";

describe("UI Primitives Component Suite", () => {
  describe("Button Component", () => {
    it("renders primary button by default with text and button type", () => {
      const html = renderToStaticMarkup(<Button>Simpan Data</Button>);
      expect(html).toContain("<button");
      expect(html).toContain('type="button"');
      expect(html).toContain("Simpan Data");
      expect(html).toContain("bg-[#5B3CC4]");
      expect(html).toContain("text-white");
    });

    it("renders different variants (secondary, outline, outline-dark, ghost, destructive)", () => {
      const secHtml = renderToStaticMarkup(<Button variant="secondary">Batal</Button>);
      expect(secHtml).toContain("text-[#5B3CC4]");
      expect(secHtml).toContain("border-[#5B3CC4]");

      const outHtml = renderToStaticMarkup(<Button variant="outline">Ekspor</Button>);
      expect(outHtml).toContain("border-[#E7E3EC]");

      const darkHtml = renderToStaticMarkup(<Button variant="outline-dark">Masuk</Button>);
      expect(darkHtml).toContain("bg-white/10");
      expect(darkHtml).toContain("text-white");
      expect(darkHtml).toContain("border-white/60");

      const ghostHtml = renderToStaticMarkup(<Button variant="ghost">Kembali</Button>);
      expect(ghostHtml).toContain("bg-transparent");

      const destHtml = renderToStaticMarkup(<Button variant="destructive">Hapus</Button>);
      expect(destHtml).toContain("bg-[#C0392B]");
    });

    it("renders loading state with disabled attribute, aria-busy, and spinner", () => {
      const html = renderToStaticMarkup(<Button isLoading>Menyimpan</Button>);
      expect(html).toContain("disabled");
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("animate-spin");
      expect(html).toContain("Memuat...");
    });

    it("renders with custom icons (leftIcon, rightIcon)", () => {
      const html = renderToStaticMarkup(
        <Button
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Lanjut
        </Button>
      );
      expect(html).toContain("←");
      expect(html).toContain("→");
      expect(html).toContain("Lanjut");
    });

    it("applies minimum touch target sizing for mobile (min-h-[44px])", () => {
      const html = renderToStaticMarkup(<Button size="md">Sentuh</Button>);
      expect(html).toContain("min-h-[44px]");
    });
  });

  describe("Input Component", () => {
    it("renders accessible input with label and matching htmlFor id", () => {
      const html = renderToStaticMarkup(
        <Input id="product-name" label="Nama Produk" placeholder="Masukkan nama" />
      );
      expect(html).toContain('<label for="product-name"');
      expect(html).toContain('id="product-name"');
      expect(html).toContain('placeholder="Masukkan nama"');
      expect(html).toContain("Nama Produk");
    });

    it("renders required indicator asterisk when required", () => {
      const html = renderToStaticMarkup(
        <Input id="sku" label="Kode SKU" required />
      );
      expect(html).toContain("*");
      expect(html).toContain("required");
    });

    it("renders helper text and links aria-describedby", () => {
      const html = renderToStaticMarkup(
        <Input id="price" label="Harga Jual" helperText="Gunakan nominal Rupiah integer" />
      );
      expect(html).toContain('aria-describedby="price-helper"');
      expect(html).toContain('id="price-helper"');
      expect(html).toContain("Gunakan nominal Rupiah integer");
    });

    it("renders error state with role alert, aria-invalid, and error message", () => {
      const html = renderToStaticMarkup(
        <Input id="email" label="Email" errorMessage="Format email tidak valid" />
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="email-error"');
      expect(html).toContain('role="alert"');
      expect(html).toContain("Format email tidak valid");
      expect(html).toContain("border-[#C0392B]");
    });
  });

  describe("Card Component Family", () => {
    it("renders complete card structure with Header, Title, Description, Content, Footer", () => {
      const html = renderToStaticMarkup(
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Penjualan</CardTitle>
            <CardDescription>Performa 30 hari terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Rp 15.000.000</p>
          </CardContent>
          <CardFooter>
            <span>34 transaksi</span>
          </CardFooter>
        </Card>
      );
      expect(html).toContain("rounded-xl");
      expect(html).toContain("border-[#E7E3EC]");
      expect(html).toContain("Ringkasan Penjualan");
      expect(html).toContain("Performa 30 hari terakhir");
      expect(html).toContain("Rp 15.000.000");
      expect(html).toContain("34 transaksi");
    });
  });

  describe("Badge Component", () => {
    it("renders default lavender badge", () => {
      const html = renderToStaticMarkup(<Badge>Aktif</Badge>);
      expect(html).toContain("rounded-full");
      expect(html).toContain("text-[#5B3CC4]");
      expect(html).toContain("Aktif");
    });

    it("renders semantic status variants (success, warning, danger, demo)", () => {
      const succ = renderToStaticMarkup(<Badge variant="success">Stok Aman</Badge>);
      expect(succ).toContain("text-[#0E6251]");

      const warn = renderToStaticMarkup(<Badge variant="warning">Stok Menipis</Badge>);
      expect(warn).toContain("text-[#7D6608]");

      const dang = renderToStaticMarkup(<Badge variant="danger">Habis</Badge>);
      expect(dang).toContain("text-[#922B21]");

      const demo = renderToStaticMarkup(<Badge variant="demo">MODE DEMO</Badge>);
      expect(demo).toContain("bg-[#FFD54F]");
      expect(demo).toContain("text-[#25232B]");
    });

    it("renders badge with semantic icon for multi-sensory accessible feedback", () => {
      const html = renderToStaticMarkup(
        <Badge variant="success" icon={<span data-testid="check">✓</span>}>
          Lunas
        </Badge>
      );
      expect(html).toContain("✓");
      expect(html).toContain("Lunas");
    });
  });

  describe("Skeleton Component", () => {
    it("renders with shimmer class and aria-hidden for accessibility", () => {
      const html = renderToStaticMarkup(<Skeleton className="w-32 h-6" />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("animate-shimmer");
      expect(html).toContain("w-32 h-6");
    });
  });

  describe("EmptyState Component", () => {
    it("renders centered empty state with title, description, and action button", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="Belum Ada Produk"
          description="Tambahkan produk pertama untuk memulai pencatatan persediaan toko Anda."
          action={<Button>Tambah Produk</Button>}
        />
      );
      expect(html).toContain("Belum Ada Produk");
      expect(html).toContain("Tambahkan produk pertama");
      expect(html).toContain("Tambah Produk");
      expect(html).toContain("border-dashed");
    });
  });

  describe("Alert Component", () => {
    it("renders danger alert with role alert", () => {
      const html = renderToStaticMarkup(
        <Alert variant="danger" title="Gagal Menyimpan">
          Koneksi ke server terputus.
        </Alert>
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain("Gagal Menyimpan");
      expect(html).toContain("Koneksi ke server terputus");
      expect(html).toContain("border-[#F5B7B1]");
    });

    it("renders info alert with role status", () => {
      const html = renderToStaticMarkup(
        <Alert variant="info" title="Informasi Onboarding">
          Lengkapi data profil usaha Anda.
        </Alert>
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("Informasi Onboarding");
    });
  });

  describe("Table Component Family", () => {
    it("renders accessible table structure with headers, rows, and responsive wrapper", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Stok</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Beras Ramos 5kg</TableCell>
              <TableCell>12 unit</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(html).toContain("overflow-x-auto");
      expect(html).toContain("<table");
      expect(html).toContain("<thead");
      expect(html).toContain("<tbody");
      expect(html).toContain("Nama Barang");
      expect(html).toContain("Beras Ramos 5kg");
      expect(html).toContain("12 unit");
    });
  });
});
