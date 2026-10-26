# VeyraOS

<div align="center">

![VeyraOS Banner](https://raw.githubusercontent.com/bryanalberta/VeyraOS/main/.github/assets/banner.png)

### *Run your business. Know your numbers.*

Platform manajemen operasional kasir Point-of-Sale (POS), kontrol stok inventaris bergerak (*Moving Average Cost HPP*), pencatatan pengeluaran operasional, dan analitik finansial terintegrasi yang dirancang khusus untuk UMKM Indonesia.

[![CI/CD Pipeline](https://github.com/bryanalberta/VeyraOS/actions/workflows/ci.yml/badge.svg)](https://github.com/bryanalberta/VeyraOS/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3ECF8E?logo=supabase)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Tests-958%20Passed-brightgreen?logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-Private%20%2F%20MIT-violet)](#)

[Jelajahi Mode Demo](http://localhost:3000/demo) • [Dokumentasi Lengkap](docs/) • [Laporan Tahap 10](docs/stage-10-comprehensive-qa-and-security-report.md)

</div>

---

## 🌟 Mengapa VeyraOS?

Banyak pemilik toko kelontong, minimarket, dan UMKM ritel di Indonesia mencatat transaksi kasir secara manual di buku tulis atau aplikasi kasir yang terisolasi dari pencatatan modal restock dan biaya operasional. Akibatnya:
- **Keuntungan semu:** Tidak mengetahui apakah uang di laci kasir adalah laba bersih atau uang belanja kulakan berikutnya.
- **HPP meleset:** Harga beli barang dari distributor naik-turun, namun harga pokok penjualan (HPP) tidak diperbarui secara tertimbang (*moving average*).
- **Stok bocor:** Tidak ada riwayat pergerakan stok (*stock movement ledger*) yang melacak setiap penjualan, pembelian, atau pembatalan faktur.

**VeyraOS menyelesaikan masalah ini secara mendasar** dengan menggabungkan kecepatan kasir POS modern, ketepatan matematika keuangan Rupiah integer murni (bebas *floating-point error*), dan isolasi database multi-tenant berstandar enterprise.

---

## ✨ Fitur-Fitur Utama

### 🛒 1. Kasir Penjualan Langsung (POS) & Riwayat Transaksi
- **Pencarian Cepat & Kategori:** Temukan produk dalam hitungan milidetik berdasarkan nama, SKU barcode, atau kategori barang.
- **Kalkulasi Kembalian & Multi-Metode Bayar:** Mendukung Tunai (Cash), QRIS, Transfer Bank, dan Debit dengan kalkulator kembalian otomatis.
- **Alokasi Diskon Matematis (Largest Remainder Method):** Membagi diskon nota ke setiap item secara proporsional hingga selisih tepat **Rp 0**.
- **Pembatalan Faktur Aman (Void Sale):** Pembatalan transaksi kasir wajib menyertakan alasan minimal 5 karakter, mengembalikan stok fisik secara atomik, dan mencatat pergerakan stok tanpa merusak snapshot HPP lama.

### 📦 2. Manajemen Produk & Inventaris Cerdas
- **Moving Weighted Average Cost (MWAC):** Setiap kali toko mencatat faktur pembelian restock, sistem otomatis menghitung ulang HPP barang secara tertimbang sesuai rumus akuntansi standar:
  $$\text{HPP Baru} = \frac{(\text{Stok Lama} \times \text{HPP Lama}) + (\text{Qty Beli} \times \text{Harga Beli})}{\text{Total Stok Baru}}$$
- **Peringatan Stok Menipis (Low Stock Alert):** Indikator visual otomatis saat sisa stok fisik berada di bawah ambang batas minimum.
- **Pencegahan Stok Negatif:** Mesin database menolak transaksi kasir jika kuantitas barang melebihi stok fisik yang tersedia.

### 💸 3. Pencatatan Beban & Pengeluaran Operasional
- **Segregasi Biaya yang Ketat:** Memisahkan beban operasional (Sewa Toko, Listrik & Air, Gaji Karyawan, Transportasi, Pemeliharaan) dari pembelian barang dagangan agar laporan laba rugi tidak terdistorsi.
- **Visualisasi Komposisi Beban:** Grafik progress bar komposisi pengeluaran per kategori untuk identifikasi pos biaya yang boros.

### 📊 4. Dashboard Finansial & Laporan Bisnis
- **6 KPI Metrik Bisnis:** Total Penjualan Bersih, Total HPP, Laba Kotor, Pengeluaran Operasional, Laba Bersih Operasional, dan Estimasi Nilai Aset Stok.
- **Tipografi Finansial Monospaced (`.font-financial`):** Menggunakan tabular numbers (`font-variant-numeric: tabular-nums`) sehingga angka ribuan rupiah selalu sejajar vertikal dan nyaman dibaca.
- **Ekspor CSV Klien & Server:** Unduh laporan transaksi penjualan, pembelian, dan valuasi stok ke format CSV (RFC 4180) untuk pembukuan akuntansi eksternal.

### 🧪 5. Mode Demo Sandboxed Mandiri (`/demo`)
- **Eksplorasi Penuh Tanpa Login:** Pengunjung dapat mencoba seluruh 7 modul aplikasi (Ringkasan, Kasir POS, Produk, Pembelian, Pengeluaran, Laporan, Pengaturan) secara instan.
- **Dataset Realistis Indonesia:** Dilengkapi data awal *"Toko Sembako Sejahtera"* (Beras Ramos, Minyak Goreng, Gula Pasir, Telur, dll.).
- **Zero Network Traffic:** Berjalan murni di memori dan localStorage peramban tanpa koneksi ke database produksi Supabase.
- **Pratinjau Struk Kasir Thermal:** Simulasi live preview nota kasir ukuran 58mm / 80mm yang bereaksi seketika terhadap perubahan nama toko dan footer nota.

---

## 🔒 Arsitektur Keamanan & Multi-Tenant (RLS)

VeyraOS menerapkan pendekatan keamanan pertahanan berlapis ganda (*Defense-in-Depth*):

```
+-------------------------------------------------------------+
|             Layer 3: Client / Browser Sandbox               |
|  - In-Memory State & React 19 useSyncExternalStore          |
|  - Validasi Input Zod, Sanitasi XSS & Anti Floating-Point  |
+-------------------------------------------------------------+
                              │
+-------------------------------------------------------------+
|             Layer 2: Server Actions & Authorization         |
|  - Dependency Injection (Supabase Server Client)            |
|  - Middleware Proteksi Rute & Tenant Context Cookie         |
|  - Validasi Keanggotaan Bisnis (src/lib/security.ts)        |
+-------------------------------------------------------------+
                              │
+-------------------------------------------------------------+
|             Layer 1: PostgreSQL RDBMS & Supabase            |
|  - Row-Level Security (RLS) aktif pada seluruh 11 tabel     |
|  - Composite Foreign Key (business_id, product_id)          |
|  - Atomic Stored Procedures PL/pgSQL & Idempotency Guards   |
|  - Least-Privilege Grants (anon role revoked total)         |
+-------------------------------------------------------------+
```

---

## 🛠️ Tech Stack

- **Frontend & App Framework:** [Next.js 16 (App Router)](https://nextjs.org/) dengan [Turbopack](https://turbo.build/)
- **Core Engine:** [React 19](https://react.dev/)
- **Bahasa:** [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode, 0 any bypass)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) dengan palet warna terkurasi *Royal Violet* (`#5B3CC4`)
- **Komponen Ikon:** [Lucide React](https://lucide.dev/)
- **Validasi Skema:** [Zod](https://zod.dev/)
- **Database Backend:** [Supabase](https://supabase.com/) (PostgreSQL 15+, Row-Level Security, PL/pgSQL Stored Procedures)
- **Unit & Integration Testing:** [Vitest 5.0.4](https://vitest.dev/)
- **End-to-End Testing:** [Playwright](https://playwright.dev/)
- **CI/CD Automation:** GitHub Actions

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat Sistem
- Node.js versi `20.x` atau lebih baru
- npm versi `10.x` atau lebih baru

### 2. Kloning Repositori
```bash
git clone https://github.com/bryanalberta/VeyraOS.git
cd VeyraOS
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Lingkungan (.env.local)
Salin berkas template lingkungan:
```bash
cp .env.example .env.local
```
Sesuaikan kredensial Supabase Anda pada `.env.local` (atau biarkan default untuk langsung menjelajahi Mode Demo):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban Anda di [http://localhost:3000](http://localhost:3000). Untuk mencoba simulasi kasir tanpa login akun, langsung buka [http://localhost:3000/demo](http://localhost:3000/demo).

---

## 🧪 Pengujian & Verifikasi Kualitas

VeyraOS dilengkapi dengan rangkaian pengujian otomatis yang komprehensif:

```bash
# Menjalankan seluruh unit test suite (50 test files, 958 tests)
npm run test

# Menjalankan validasi tipe TypeScript secara ketat
npm run type-check

# Menjalankan pengecekan gaya kode & ESLint
npm run lint

# Menjalankan verifikasi Next.js production build
npm run build
```

---

## 📁 Struktur Direktori Utama

```
VeyraOS/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline CI/CD GitHub Actions
├── docs/                        # Dokumentasi PRD, Arsitektur, & Laporan Audit
├── src/
│   ├── app/                     # Next.js App Router (Halaman & Layouts)
│   │   ├── (auth)/              # Halaman Login & Registrasi
│   │   ├── dashboard/           # Dashboard Analitik Finansial
│   │   ├── demo/                # Sub-sistem Sandboxing Mode Demo (7 Modul)
│   │   ├── expenses/            # Buku Pengeluaran Operasional
│   │   ├── onboarding/          # Wizard Pembentukan Bisnis Baru
│   │   ├── products/            # Katalog Produk & Master Stok
│   │   ├── purchases/           # Faktur Pembelian Restock (Moving Average HPP)
│   │   ├── reports/             # Laporan Finansial & Valuasi Persediaan
│   │   ├── sales/               # Kasir POS & Riwayat Transaksi Penjualan
│   │   └── settings/            # Pengaturan Profil Usaha Produksi
│   ├── components/              # Komponen Antarmuka Reusable (UI & Layout)
│   ├── lib/                     # Utilitas Matematika Finansial, Keamanan, & Supabase
│   ├── services/                # Business Logic & Service Layer
│   └── types/                   # Definisi Kontrak Tipe Data TypeScript
└── supabase/
    └── migrations/              # 12 Berkas Migrasi SQL (RLS & Stored Procedures)
```

---

## 📄 Lisensi & Hak Cipta

Hak Cipta © 2026 **VeyraOS** — Dikembangkan untuk memajukan daya saing dan kesehatan finansial UMKM Indonesia.
Dilisensikan di bawah lisensi MIT.
