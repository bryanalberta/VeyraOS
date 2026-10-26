import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  CheckCircle2,
  Clock,
  Lock,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";

// ---------------------------------------------------------------------------
// UI Component: Landing Page View
// ---------------------------------------------------------------------------

export function LandingPageView() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#25232B] flex flex-col font-sans selection:bg-[#EAE4FF] selection:text-[#392477]">
      {/* ----------------------------------------------------------------- */}
      {/* Navbar Header                                                     */}
      {/* ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full bg-[#FAF9F6]/90 backdrop-blur-md border-b border-[#E7E3EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Identity */}
          <Link
            href="/"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-lg p-1"
          >
            <BrandLogo
              size="lg"
              showTagline
              tagline="Business &amp; Finance Engine"
            />
          </Link>

          {/* Quick Nav Anchors (Desktop) */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#716D7A]"
            aria-label="Navigasi Utama"
          >
            <a
              href="#fitur"
              className="hover:text-[#5B3CC4] transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5B3CC4] rounded"
            >
              Fitur Utama
            </a>
            <a
              href="#keunggulan"
              className="hover:text-[#5B3CC4] transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5B3CC4] rounded"
            >
              Keunggulan
            </a>
            <a
              href="#arsitektur"
              className="hover:text-[#5B3CC4] transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5B3CC4] rounded"
            >
              Keamanan &amp; Presisi
            </a>
          </nav>

          {/* Action Navigation */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="font-medium text-xs sm:text-sm px-3 sm:px-4"
              >
                Masuk
              </Button>
            </Link>
            <Link href="/register">
              <Button
                variant="primary"
                size="sm"
                className="font-semibold text-xs sm:text-sm px-3.5 sm:px-4 shadow-sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Daftar Bisnis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Main Content                                                      */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 px-4 sm:px-6 lg:px-8 border-b border-[#E7E3EC]">
          {/* Subtle Ambient Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#EAE4FF]/50 to-[#F6F3FF]/40 blur-3xl pointer-events-none -z-10"
            aria-hidden="true"
          />

          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE4FF] text-[#392477] text-xs font-semibold tracking-wide border border-[#5B3CC4]/15 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#5B3CC4]" />
              <span>Sistem Operasi Bisnis UMKM Indonesia</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#25232B] leading-[1.15]">
              Run your business.{" "}
              <span className="text-[#5B3CC4] block sm:inline">
                Know your numbers.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-[#716D7A] leading-relaxed max-w-2xl mx-auto">
              Aplikasi web terpadu untuk pencatatan kasir cepat (POS), kalkulasi
              HPP persediaan otomatis, dan buku pengeluaran operasional.
              Didesain dengan integritas keuangan presisi tanpa pembulatan
              desimal bias.
            </p>

            {/* Dual CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto font-semibold px-8 py-3 text-base shadow-sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Mulai Kelola Toko Gratis
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto font-medium px-7 py-3 text-base bg-white"
                  leftIcon={<Store className="w-4 h-4 text-[#5B3CC4]" />}
                >
                  Masuk ke Toko Anda
                </Button>
              </Link>
            </div>

            {/* Architecture Highlights Pill Row */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs text-[#716D7A]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E7E3EC]">
                <Calculator className="w-3.5 h-3.5 text-[#5B3CC4]" />
                <span className="font-medium text-[#25232B]">
                  100% Integer Math (BIGINT)
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E7E3EC]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1E824C]" />
                <span className="font-medium text-[#25232B]">
                  Isolasi Multi-Tenant RLS
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E7E3EC]">
                <Clock className="w-3.5 h-3.5 text-[#5B3CC4]" />
                <span className="font-medium text-[#25232B]">
                  Waktu Indonesia (WIB)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* 4 Feature Pillars Section                                       */}
        {/* --------------------------------------------------------------- */}
        <section
          id="fitur"
          className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-[#5B3CC4] uppercase">
              Fondasi Operasional &amp; Finansial
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#25232B] tracking-tight">
              Dirancang untuk Kejelasan Angka Bisnis Anda
            </h3>
            <p className="text-sm sm:text-base text-[#716D7A]">
              Setiap modul dibangun secara spesifik untuk memecahkan kendala
              nyata pencatatan toko ritel dan usaha kecil di Indonesia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1: Kasir POS */}
            <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] shadow-2xs hover:border-[#5B3CC4]/40 transition-colors flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-[#F6F3FF] flex items-center justify-center text-[#5B3CC4]">
                  <Receipt className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Kasir Penjualan Kilat (POS)
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  Pencatatan transaksi kilat, hitung diskon otomatis, struk
                  nota, multi-metode pembayaran tunai &amp; transfer, serta
                  audit pembatalan nota (*void*).
                </p>
              </div>
              <div className="pt-3 border-t border-[#F0EDF5]">
                <Badge variant="outline" className="text-[11px] font-medium text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]">
                  Multi-Metode Pembayaran
                </Badge>
              </div>
            </div>

            {/* Pillar 2: Manajemen Stok & HPP */}
            <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] shadow-2xs hover:border-[#5B3CC4]/40 transition-colors flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-[#F6F3FF] flex items-center justify-center text-[#5B3CC4]">
                  <Boxes className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Stok &amp; HPP Bergerak (MWAC)
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  Penilaian harga pokok persediaan akurat menggunakan metode
                  Moving Weighted Average Cost. HPP otomatis dihitung ulang
                  setiap kali restock dicatat.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F0EDF5]">
                <Badge variant="outline" className="text-[11px] font-medium text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]">
                  Moving Average Otomatis
                </Badge>
              </div>
            </div>

            {/* Pillar 3: Beban Operasional */}
            <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] shadow-2xs hover:border-[#5B3CC4]/40 transition-colors flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-[#F6F3FF] flex items-center justify-center text-[#5B3CC4]">
                  <Wallet className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Buku Beban Operasional
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  Pencatatan 8 kategori beban usaha dengan sistem peringatan
                  visual anti-double-count terhadap pembelian persediaan barang
                  dagang.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F0EDF5]">
                <Badge variant="outline" className="text-[11px] font-medium text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]">
                  Anti Double-Count Stok
                </Badge>
              </div>
            </div>

            {/* Pillar 4: Laporan & Dashboard */}
            <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] shadow-2xs hover:border-[#5B3CC4]/40 transition-colors flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-[#F6F3FF] flex items-center justify-center text-[#5B3CC4]">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Dashboard &amp; Laba Bersih
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  6 metrik KPI performa, grafik tren omzet harian berbasis zona
                  WIB, dan unduh laporan komprehensif berstandar CSV RFC 4180
                  kapan saja.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F0EDF5]">
                <Badge variant="outline" className="text-[11px] font-medium text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]">
                  Ekspor Laporan CSV
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Architecture & Trust Section                                    */}
        {/* --------------------------------------------------------------- */}
        <section
          id="arsitektur"
          className="py-16 bg-[#F6F3FF] border-y border-[#E7E3EC] px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-12 space-y-2">
              <h2 className="text-xs font-bold tracking-widest text-[#5B3CC4] uppercase">
                Standar Rekayasa Perangkat Lunak
              </h2>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#25232B] tracking-tight">
                Keamanan dan Integritas Tanpa Kompromi
              </h3>
              <p className="text-sm sm:text-base text-[#716D7A]">
                Dibangun dengan fondasi teknis yang kokoh untuk melindungi data
                sensitif dan kepastian angka keuangan usaha Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] space-y-3 shadow-2xs">
                <div className="w-10 h-10 rounded-lg bg-[#EAE4FF] text-[#392477] flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5 text-[#5B3CC4]" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Kalkulasi Moneter Integer
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  Semua nilai Rupiah disimpan dan dikalkulasi dalam bilangan bulat
                  penuh (BIGINT). Bebas dari kelemahan pembulatan pecahan desimal
                  floating-point pada neraca laba rugi.
                </p>
              </div>

              <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] space-y-3 shadow-2xs">
                <div className="w-10 h-10 rounded-lg bg-[#EAE4FF] text-[#392477] flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5 text-[#5B3CC4]" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Isolasi Multi-Tenant Berlapis
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  Pemisahan data antarbisnis ditegakkan pada tingkat kernel
                  basis data menggunakan PostgreSQL Row Level Security (RLS) dan
                  composite foreign keys server-authoritative.
                </p>
              </div>

              <div className="p-6 bg-white rounded-xl border border-[#E7E3EC] space-y-3 shadow-2xs">
                <div className="w-10 h-10 rounded-lg bg-[#EAE4FF] text-[#392477] flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#1E824C]" />
                </div>
                <h4 className="font-bold text-[#25232B] text-base">
                  Aksesibilitas &amp; Desain Nyaman
                </h4>
                <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  Palet Royal Violet yang elegan, kontras teks berstandar WCAG
                  2.2 AA, dan ergonomi antarmuka yang optimal di layar smartphone
                  360px hingga layar desktop toko.
                </p>
              </div>
            </div>

            {/* Demo Mode Notice Box (Faktual & Transparan) */}
            <div className="mt-8 p-4 sm:p-5 rounded-xl bg-white border border-[#E7E3EC] flex items-start gap-3.5 shadow-2xs">
              <Store className="w-5 h-5 text-[#5B3CC4] shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-[#716D7A] space-y-1">
                <p className="font-semibold text-[#25232B]">
                  Informasi Akses Mode Demo Terisolasi
                </p>
                <p className="leading-relaxed">
                  Mode Demo terisolasi lokal (simulasi mandiri *Toko Sembako
                  Sejahtera* tanpa pembuatan akun) dijadwalkan pada rilis pengujian
                  browser berikutnya. Seluruh fitur produksi di atas sudah aktif
                  penuh untuk digunakan secara nyata melalui pendaftaran akun
                  bisnis baru.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Bottom CTA Banner                                               */}
        {/* --------------------------------------------------------------- */}
        <section
          id="keunggulan"
          className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6"
        >
          <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-b from-[#392477] to-[#25232B] text-white shadow-md space-y-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Siap Mengetahui Angka Finansial Bisnis Anda Secara Presisi?
            </h2>
            <p className="text-sm sm:text-base text-[#FAF9F6]/85 max-w-2xl mx-auto leading-relaxed">
              Bergabunglah dengan pelaku usaha yang mengandalkan VeyraOS untuk
              pencatatan transaksi kasir, stok ber-HPP akurat, dan laporan laba
              bersih harian yang rapi.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto font-semibold px-8 py-3 bg-[#5B3CC4] hover:bg-[#4930A5] text-white shadow-sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Daftar Akun Bisnis Baru
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button
                  variant="outline-dark"
                  size="lg"
                  className="w-full sm:w-auto font-medium px-8 py-3 text-white"
                  leftIcon={<Store className="w-4 h-4 text-white" aria-hidden="true" />}
                >
                  Masuk ke Toko Anda
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* Footer                                                            */}
      {/* ----------------------------------------------------------------- */}
      <footer className="w-full border-t border-[#E7E3EC] bg-white py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-[#716D7A] space-y-2">
        <div className="flex items-center justify-center font-semibold text-[#25232B]">
          <BrandLogo size="sm" />
        </div>
        <p>
          &copy; 2026 VeyraOS. Hak Cipta Dilindungi Undang-Undang. Platform
          Manajemen Operasional &amp; Keuangan UMKM Indonesia.
        </p>
      </footer>
    </div>
  );
}
