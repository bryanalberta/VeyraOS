# VeyraOS --- Phased Implementation Roadmap & Execution Plan

**Versi:** 1.0  
**Status:** Usulan Rencana Pelaksanaan (Phase 3 Roadmap Baseline - UNEXECUTED PROPOSAL)  
**Produk:** VeyraOS  
**Prinsip Eksekusi:** Pembangunan Inkremental Bertahap Berdasarkan Dependensi Arsitektur  

---

## 1. Ikhtisar Tahapan Pengembangan (10 Tahapan Terpisah)

```
[Tahap 1: Fondasi Proyek] 
       │
       ▼
[Tahap 2: Skema DB & RLS] 
       │
       ▼
[Tahap 3: Autentikasi & Bisnis] 
       │
       ▼
[Tahap 4: Produk & Persediaan] 
       │
       ▼
[Tahap 5: Pembelian Restock & HPP] 
       │
       ▼
[Tahap 6: Penjualan POS & Void] 
       │
       ▼
[Tahap 7: Pengeluaran Operasional] 
       │
       ▼
[Tahap 8: Dashboard & Laporan] 
       │
       ▼
[Tahap 9: Ekspor CSV & Mode Demo] 
       │
       ▼
[Tahap 10: QA, Audit Keamanan & Deployment]
```

---

## 2. Rincian Tahapan, Dependensi, dan Kriteria Selesai (Definition of Done)

### Tahap 1: Fondasi Repository & Lingkungan Proyek
- **Deliverables:**
  - Inisialisasi Next.js 15 dengan TypeScript strict mode.
  - Konfigurasi Tailwind CSS v4 / v3.4 dengan variabel token Royal Violet (`globals.css`).
  - Setup Lucide React & shadcn/ui primitives.
  - Setup Vitest dan konfigurasi path alias (`@/*`).
- **Dependensi:** Tidak ada.
- **Pengujian:** `npm run build` dan `npm run test` berjalan sukses (smoke test).
- **Definition of Done:** Struktur direktori rapi, sistem styling token aktif, dan build produksi lokal lolos tanpa error TypeScript.
- **Risiko Utama:** Ketidakcocokan versi paket npm; dimitigasi dengan pinning versi stabil.

### Tahap 2: Skema Basis Data, Migrasi & Kebijakan RLS
- **Deliverables:**
  - File migrasi SQL terstruktur (`001_initial_schema.sql`, `002_rls_policies.sql`).
  - Stored procedures / functions PostgreSQL (`record_sale`, `record_purchase`, `void_sale`).
  - Validasi seluruh tipe moneter `BIGINT`.
- **Dependensi:** Tahap 1 selesai.
- **Pengujian:** Migrasi dijalankan pada local Supabase instance tanpa peringatan sintaks; pengujian unit SQL untuk constraint `CHECK (stock_quantity >= 0)`.
- **Definition of Done:** 10 tabel terbuat dengan constraint lengkap, RLS aktif di semua tabel, dan seed data dummy lokal berhasil di-load.
- **Risiko Utama:** Kesalahan penulisan fungsi RLS yang menyebabkan infinite loop query; dimitigasi dengan fungsi `SECURITY DEFINER` stabil.

### Tahap 3: Autentikasi & Onboarding Manajemen Bisnis
- **Deliverables:**
  - Supabase Auth integration via `@supabase/ssr`.
  - Halaman Masuk (`/login`), Daftar (`/register`), dan Onboarding Bisnis (`/onboarding/create-business`).
  - Komponen `BusinessSwitcher` dan Context `ActiveBusinessProvider`.
- **Dependensi:** Tahap 2 selesai.
- **Pengujian:** Uji registrasi pengguna baru, pembuatan bisnis pertama, dan pergantian bisnis aktif.
- **Definition of Done:** Rute privat terproteksi middleware; pengguna dapat membuat hingga 5 bisnis dan beralih antarbisnis dengan pergantian konteks instan.
- **Risiko Utama:** Sesi cookie hilang saat refresh; dimitigasi dengan penanganan middleware cookie Next.js terstandarisasi.

### Tahap 4: Fondasi Katalog Produk & Stok
- **Deliverables:**
  - CRUD Produk (`/products`, `/products/new`, `/products/:id`).
  - Mutasi stok awal (`stock_movements` tipe `INITIAL`).
  - Widget dan filter *"Stok Menipis"*.
  - Mekanisme Soft Delete / Arsip Produk.
- **Dependensi:** Tahap 3 selesai.
- **Pengujian:** Uji validasi harga $> 0$, pencegahan duplicate SKU per bisnis, dan pengecekan ledger mutasi stok.
- **Definition of Done:** Produk dapat ditambah, diedit, dicari, dan diarsipkan; stok tercatat transparan di tabel mutasi.
- **Risiko Utama:** Penghapusan produk yang merusak integritas relasi; dimitigasi dengan memblokir hard delete via database foreign key `RESTRICT`.

### Tahap 5: Pembelian Persediaan & Rekalkulasi HPP
- **Deliverables:**
  - Formulir Pembelian Stok Restock (`/purchases/new`) dan daftar riwayat (`/purchases`).
  - Logika hitung otomatis Moving Weighted Average Cost di database / server.
  - Penambahan saldo stok produk secara atomik.
- **Dependensi:** Tahap 4 selesai.
- **Pengujian:** Unit test kalkulasi moving average cost saat restock (kasus stok 0, harga beda, pembulatan integer).
- **Definition of Done:** Restock berhasil menambah stok seketika dan memperbarui nilai `products.cost_price` tanpa selisih pembulatan.
- **Risiko Utama:** Pembelian stok terhitung ganda sebagai biaya operasional; dicegah melalui pemisahan tabel dan query.

### Tahap 6: Transaksi Penjualan Kasir Cepat (POS) & Pembatalan (Void)
- **Deliverables:**
  - Antarmuka kasir cepat (`/sales/new`) dengan pencarian instan dan keranjang transaksi.
  - Perhitungan diskon per item & diskon transaksi.
  - Pemotongan stok atomik dan pencatatan snapshot harga/HPP pada `sale_items`.
  - Alur Pembatalan Total (`/sales/:id` -> Modal Void dengan alasan wajib).
- **Dependensi:** Tahap 4 dan Tahap 5 selesai.
- **Pengujian:** Uji transaksi atomik, penolakan stok tidak cukup, dan uji konkurensi (dua kasir membeli stok 1). Uji pembalikan stok saat void.
- **Definition of Done:** Penjualan berhasil memotong stok dan mencatat snapshot biaya; pembatalan berhasil membalikkan stok tepat satu kali.
- **Risiko Utama:** Inkonsistensi data jika koneksi terputus di tengah simpan; dimitigasi dengan stored procedure transaksi tunggal.

### Tahap 7: Pencatatan Pengeluaran Operasional
- **Deliverables:**
  - Buku catatan pengeluaran operasional (`/expenses`).
  - Kategori biaya bawaan (Sewa, Listrik, Gaji, dll.) dan input nominal Rupiah integer.
  - Peringatan visual pencegahan pencatatan stok di menu pengeluaran.
- **Dependensi:** Tahap 3 selesai.
- **Pengujian:** Uji simpan pengeluaran dan verifikasi isolasi tenant.
- **Definition of Done:** Pengeluaran tersimpan rapi dan dapat disaring berdasarkan kategori dan tanggal.

### Tahap 8: Dashboard Bisnis & Laporan Finansial
- **Deliverables:**
  - Dashboard KPI (`/dashboard`): 6 Kartu Metrik, grafik tren penjualan harian (Recharts), transaksi terbaru, peringatan stok.
  - Laporan Keuangan Sederhana (`/reports`): Laba Rugi Sederhana (Omzet, HPP, Laba Kotor, Laba Operasional) dan Ringkasan Arus Kas Masuk/Keluar.
  - Filter rentang tanggal terstandarisasi waktu `Asia/Jakarta`.
- **Dependensi:** Tahap 4, 5, 6, dan 7 selesai.
- **Pengujian:** Rekonsiliasi angka laporan terhadap data sumber transaksi (selisih Rp 0).
- **Definition of Done:** Angka dashboard dan laporan cocok $100\%$ dengan kalkulasi matematis riil transaksi.
- **Risiko Utama:** Pergeseran tanggal akibat zona waktu UTC; dimitigasi dengan penguncian filter rentang tanggal berbasis zona waktu Jakarta.

### Tahap 9: Ekspor CSV & Mode Demo Terisolasi
- **Deliverables:**
  - Endpoint Route Handler ekspor CSV (`/api/reports/export`).
  - Rute khusus Mode Demo (`/demo/*`) dengan adapter penyimpanan lokal (*In-Memory / LocalStorage Store*).
  - Banner persisten Mode Demo dan fungsi reset instan ($< 500$ ms).
  - Seed dataset realistis toko sembako Indonesia (*"Toko Sembako Sejahtera"*).
- **Dependensi:** Tahap 8 selesai.
- **Pengujian:** Uji unduh CSV valid format RFC 4180; uji E2E Playwright membuktikan nol request jaringan ke database riil saat berada di Mode Demo.
- **Definition of Done:** Ekspor CSV berfungsi cepat; Mode Demo dapat digunakan penuh tanpa akun dan dapat direset tanpa efek samping.

### Tahap 10: Pengujian QA Komprehensif, Audit Keamanan & Deployment
- **Deliverables:**
  - Pelaksanaan seluruh pengujian E2E Playwright (mobile 360px & desktop).
  - Audit aksesibilitas (kontras warna WCAG AA, navigasi keyboard).
  - Audit keamanan RLS (penetrasi antar-tenant).
  - Setup CI/CD GitHub Actions & deployment produksi ke Vercel.
- **Dependensi:** Seluruh Tahap 1–9 selesai.
- **Pengujian:** 100% tes otomatis lulus pada build pipeline.
- **Definition of Done:** Aplikasi aktif di domain Vercel dengan HTTPS, Core Web Vitals memenuhi target, dan dokumentasi penyerahan lengkap.
- **Risiko Utama:** Kebocoran variabel rahasia ke bundle produksi; dimitigasi dengan audit environment variables.

---

## 3. Log Status Pelaksanaan Substage (Phase 4 Service Layer)

| Substage | Ruang Lingkup & Deliverable | Status Resmi | Dokumen Validasi & Audit |
|---|---|---|---|
| **Stage 3.1** | Foundations (SSR Client, Data Contracts, CSPRNG Invoice, Discount Allocation) | **PASS** | [`docs/stage-3.1.4-validation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.1.4-validation-report.md) |
| **Substage 3.2.1** | Transaction Service Layer (`recordSale`, `recordPurchase`, `voidSale`) | **PASS** | [`docs/stage-3.2.1-validation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.1-validation-report.md) |
| **Substage 3.2.2A** | Product Catalog & Master Inventory Service | **PASS WITH CONDITIONS** | [`docs/stage-3.2.2A-final-closure.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.2A-final-closure.md) |
| **Substage 3.2.2B** | Operational Expense Service | **PASS WITH CONDITIONS** | [`docs/stage-3.2.2B-final-closure.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.2B-final-closure.md) |
| **Substage 3.2.2C** | Business Profile & Tenant Context Service | **PASS WITH CONDITIONS (STAGE PASS)** | [`docs/stage-3.2.2C-validation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.2C-validation-report.md) |
| **Stage 3.3 (Batch 1)** | Server Actions Auth & Tenant Context Cookie (`auth.ts`, `business.ts`) | **PASS WITH CONDITIONS (AUDITED & SEC-3.3-02 REMEDIATED)** | [`docs/stage-3.3-batch-1-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-1-report.md), [`docs/stage-3.3-batch-1-security-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-1-security-audit.md), [`docs/stage-3.3-batch-1-final-review.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-1-final-review.md) |
| **Stage 3.3 (Batch 2 - Substage 2.1)** | Error Mapper Audit & Forward Compatibility (`PRODUCT_ARCHIVED`) | **PASS** | [`docs/stage-3.3-substage-2.1-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-substage-2.1-report.md) |
| **Stage 3.3 (Batch 2 - Substage 2.2)** | Transaction Server Actions (`transactions.ts`, DI & Idempotency Remediated) | **PASS WITH CONDITIONS (AUDITED & REMEDIATED)** | [`docs/stage-3.3-substage-2.2-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-substage-2.2-report.md), [`docs/stage-3.3-substage-2.2-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-substage-2.2-closure-audit.md), [`docs/stage-3.3-substage-2.2-remediation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-substage-2.2-remediation-report.md) |
| **Stage 3.3 (Batch 2 - Substage 2.3)** | Product Catalog Server Actions (`products.ts`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-3.3-substage-2.3-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-substage-2.3-report.md), [`docs/stage-3.3-substage-2.3-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-substage-2.3-closure-audit.md) |
| **Stage 3.3 (Batch 2 - Substage 2.4)** | Batch 2 Consolidated Integration Validation & Cookie Consolidation | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-3.3-batch-2-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-2-report.md), [`docs/stage-3.3-batch-2-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-2-closure-audit.md) |
| **Stage 3.3 (Batch 2 - Substage 2.5)** | Batch 2 Gate Review & Batch 3 Preflight Authorization | **PASS WITH CONDITIONS (AUTHORIZED)** | [`docs/stage-3.3-batch-3-preflight-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-3-preflight-report.md) |
| **Stage 3.3 (Batch 3)** | Operational Expense & Financial Reporting Server Actions (`expenses.ts`, `reports.ts`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-3.3-batch-3-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-3-report.md), [`docs/stage-3.3-batch-3-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.3-batch-3-closure-audit.md) |
| **Stage 5.1** | UI Primitives & App Shell Layout Foundation | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.1-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.1-implementation-report.md), [`docs/stage-5.1-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.1-closure-audit.md) |
| **Stage 5.2** | Authentication & Business Onboarding UI (`/login`, `/register`, `/onboarding/create-business`, Middleware) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.2-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.2-implementation-report.md), [`docs/stage-5.2-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.2-closure-audit.md) |
| **Stage 5.3** | Product Management & Inventory Restock UI (`/products`, `/products/new`, `/products/[id]`, `/purchases`, `/purchases/new`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.3-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.3-implementation-report.md), [`docs/stage-5.3-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.3-closure-audit.md) |
| **Stage 5.4 (Langkah 1)** | POS Checkout UI (`/sales/new`) | **PASS WITH CONDITIONS (ALL GATES PASSED)** | POS Cashier UI & cart calculations verified |
| **Stage 5.4 (Langkah 2)** | Sales History & Void Transaction UI (`/sales`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.4-step-2-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.4-step-2-implementation-report.md), [`docs/stage-5.4-step-2-closure-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.4-step-2-closure-audit.md), [`docs/stage-5.4-step-2-verification-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.4-step-2-verification-audit.md) |
| **Stage 5.4 (Langkah 3)** | Final Integration Audit (`/sales/new`, `/sales`) | **PASS WITH CONDITIONS (FINAL INTEGRATION AUDITED)** | [`docs/stage-5.4-final-integration-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.4-final-integration-audit.md) |
| **Stage 5.5 (Langkah 1)** | Dashboard & Financial Reports UI Readiness Audit (`/dashboard`, `/reports`) | **READY WITH CONDITIONS (READINESS AUDITED)** | [`docs/stage-5.5-readiness-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.5-readiness-audit.md) |
| **Stage 5.5 (Langkah 2)** | Dashboard UI Implementation (`/dashboard`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.5-step-2-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.5-step-2-implementation-report.md) |
| **Stage 5.5 (Langkah 3)** | Financial Reports UI Implementation (`/reports`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.5-step-3-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.5-step-3-implementation-report.md) |
| **Stage 5.5 (Langkah 4)** | Final Integration Audit (`/dashboard`, `/reports`) | **PASS WITH CONDITIONS (FINAL INTEGRATION AUDITED)** | [`docs/stage-5.5-final-integration-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.5-final-integration-audit.md) |
| **Stage 5.5 (Penutupan)** | Dashboard Bisnis & Laporan Finansial UI (`/dashboard`, `/reports`) — Validasi live PostgreSQL/RLS, browser E2E, dan unduhan fisik CSV dialokasikan ke Tahap 10 | **PASS WITH CONDITIONS** | [`docs/stage-5.5-final-integration-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.5-final-integration-audit.md) |
| **Stage 5.6 (Langkah 1)** | Operational Expense UI Preflight Audit (`/expenses`) | **READY WITH CONDITIONS (PREFLIGHT AUDITED)** | [`docs/stage-5.6-step-1-preflight-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.6-step-1-preflight-audit.md) |
| **Stage 5.6 (Langkah 2)** | Operational Expense UI Implementation (`/expenses`) | **PASS WITH CONDITIONS (AUDITED & ALL GATES PASSED)** | [`docs/stage-5.6-step-2-implementation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.6-step-2-implementation-report.md) |
| **Stage 5.6 (Langkah 3)** | Operational Expense UI Unit Testing (`/expenses`) | **PASS (100% UNIT TESTS & GATES PASSED)** | [`docs/stage-5.6-step-3-test-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.6-step-3-test-report.md) |
| **Stage 5.6 (Langkah 4)** | Final Integration Audit (`/expenses`) | **PASS WITH CONDITIONS (FINAL INTEGRATION AUDITED)** | [`docs/stage-5.6-final-integration-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.6-final-integration-audit.md) |
| **Stage 5.6 (Penutupan)** | Buku Pengeluaran Operasional UI (`/expenses`) — Validasi live PostgreSQL/RLS dan browser E2E Playwright dialokasikan ke Tahap 10 | **PASS WITH CONDITIONS** | [`docs/stage-5.6-final-integration-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.6-final-integration-audit.md) |


