# VeyraOS — Pre-UI Readiness Audit Report
## Evaluasi Kesiapan Arsitektur, Layanan, Server Actions, & Fondasi Testing Menuju Fase 5 (UI Implementation Layer)

**Proyek:** VeyraOS  
**Fase Saat Ini:** Transisi dari Phase 4 (Application & Service Layer) ke Phase 5 (UI Implementation Layer)  
**Status Audit:** **READY WITH CONDITIONS (SIAP DENGAN SYARAT)**  
**Tanggal Audit:** 14 Oktober 2026  
**Auditor:** Principal Systems Architect & Lead Security Reviewer  

---

## 1. Ringkasan Eksekutif (Executive Summary)

Audit independen read-only ini dilakukan untuk mengevaluasi secara menyeluruh apakah dokumentasi, arsitektur sistem, lapisan layanan (*service layer*), integrasi Server Actions Next.js, dan infrastruktur pengujian telah mencapai tingkat kematangan dan stabilitas yang memadai untuk memulai **Fase 5: UI Implementation Layer**.

### Hasil Evaluasi Kunci:
1. **Penyelesaian Phase 4 (Stage 3.1 – Stage 3.3):**  
   Seluruh 11 modul fungsional MVP pada tingkat layanan dan Server Actions telah selesai diimplementasikan secara terstruktur. Seluruh 3 batch Server Actions (Batch 1: Auth & Business, Batch 2: Transactions & Products, Batch 3: Expenses & Reports) telah lulus audit penutupan (*closure audits*) dan mematuhi batas arsitektur Next.js 15/16.
2. **Kualitas Pengujian Otomatis:**  
   Suite pengujian unit saat ini memiliki **483 skenario pengujian yang lulus $100\%$ tanpa kegagalan** di 23 berkas pengujian. Seluruh 4 *Quality Gates* (`npm test`, `npm run type-check`, `npm run lint`, `npm run build`) berada pada status hijau (*exit code 0*).
3. **Fondasi Desain & Token Styling:**  
   Berkas `src/app/globals.css` telah mengonfigurasi seluruh token warna resmi (Royal Violet `#5B3CC4`, Warm Ivory `#FAF9F6`, Charcoal `#25232B`, Lavender Tint, status semantik) dan typography Plus Jakarta Sans dengan dukungan angka tabular (`tabular-nums`).
4. **Klasifikasi Kesiapan Resmi:**  
   $$\textbf{READY WITH CONDITIONS}$$  
   Sistem dinyatakan siap memasuki implementasi antarmuka pengguna (UI) secara bertahap, dengan syarat wajib mengintegrasikan mitigasi antarmuka untuk 4 risiko terbuka backend dan menegakkan isolasi penuh Mode Demo.

---

## 2. Bukti yang Diverifikasi (Verified Evidence)

Audit ini memeriksa secara langsung berkas-berkas spesifikasi, source code, dan laporan validasi:

### 2.1 Keselarasan Roadmap vs Status Aktual
| Substage / Batch | Dokumen Rujukan | Status Resmi di Roadmap | Verifikasi Source Code & Artifacts |
|---|---|---|---|
| **Stage 3.1** | `docs/stage-3.1.4-validation-report.md` | **PASS** | Validasi SSR Client, tipe database, generator invoice CSPRNG, dan alokasi diskon LRM. |
| **Substage 3.2.1** | `docs/stage-3.2.1-validation-report.md` | **PASS** | Layanan `recordSale`, `recordPurchase`, `voidSale` terverifikasi di `src/services/transactions/`. |
| **Substage 3.2.2A** | `docs/stage-3.2.2A-final-closure.md` | **PASS WITH CONDITIONS** | Layanan produk & mutasi persediaan di `src/services/products/`. |
| **Substage 3.2.2B** | `docs/stage-3.2.2B-final-closure.md` | **PASS WITH CONDITIONS** | Layanan beban operasional di `src/services/expenses/`. |
| **Substage 3.2.2C** | `docs/stage-3.2.2C-validation-report.md` | **PASS WITH CONDITIONS** | Layanan profil bisnis & konteks multi-tenant di `src/services/business/`. |
| **Substage 3.2.3** | `docs/stage-3.2.3-validation-report.md` | **PASS** | Layanan pelaporan finansial & agregasi KPI di `src/services/reports/`. |
| **Stage 3.3 (Batch 1)** | `docs/stage-3.3-batch-1-report.md` | **PASS WITH CONDITIONS** | Server Actions `auth.ts` dan `business.ts` terverifikasi. |
| **Stage 3.3 (Batch 2)** | `docs/stage-3.3-batch-2-report.md` | **PASS WITH CONDITIONS** | Server Actions `transactions.ts`, `products.ts`, konsolidasi cookie, mitigasi SEC-3.3-05. |
| **Stage 3.3 (Batch 3)** | `docs/stage-3.3-batch-3-report.md` | **PASS WITH CONDITIONS** | Server Actions `expenses.ts`, `reports.ts`, ekspor CSV RFC 4180, mitigasi CWE-1236. |

### 2.2 Pembedaan Tegas Bukti: Source Code vs Mock Unit Tests vs Database Runtime
Auditor menegaskan klasifikasi pembuktian sistem saat ini:
- **Tingkat Source Code & Kontrak Tipe:** **VERIFIED (100% PROVEN)**. Seluruh skema Zod, DTO TypeScript (`src/types/api.ts`), Server Actions, dan service functions tersedia lengkap dengan strict type checking tanpa `any`.
- **Tingkat Mock Unit Tests (Vitest):** **VERIFIED (100% PROVEN)**. 483 skenario pengujian membuktikan logika matematika finansial, pemetaan error, alokasi diskon, sanitasi CSV, isolasi cookie, dan penolakan fail-closed.
- **Tingkat PostgreSQL Runtime & Live RLS:** **UNVERIFIED / PENDING**. Pengujian belum pernah dijalankan terhadap PostgreSQL Supabase live dengan JWT nyata multi-user. Verifikasi ini wajib dilakukan pada tahap QA terdedikasi sebelum deployment produksi.

---

## 3. Matriks Temuan Audit Kesiapan UI (P0, P1, P2)

| ID | Prioritas | Area | Ringkasan Temuan | Dampak pada UI & Mitigasi Wajib |
|---|---|---|---|---|
| **FIND-P0-01** | **P0 (Blocker)** | **Server Action / Transaksi** | `createSaleAction` mewajibkan `idempotencyKey` UUID dari klien secara strictly fail-closed. | **UI Kasir POS Wajib Menghasilkan UUID:** Klien kasir (`/sales/new`) wajib membangkitkan `crypto.randomUUID()` saat keranjang dibuat dan mempertahankannya saat terjadi network retry. Tombol bayar wajib dinonaktifkan saat pengiriman berlangsung untuk mencegah double submit. |
| **FIND-P0-02** | **P0 (Blocker)** | **Server Action / Produk** | `createProductAction` menolak pendaftaran produk dengan `initialStock > 0` (`ATOMIC_INITIAL_STOCK_UNAVAILABLE`). | **Form Tambah Produk Wajib Menyesuaikan:** Input `initialStock` pada `/products/new` wajib dinonaktifkan/dihilangkan dengan pesan bantuan: *"Stok awal ditambahkan melalui alur Pembelian Persediaan (Restock) untuk memastikan pencatatan modal HPP yang akurat."* |
| **FIND-P0-03** | **P0 (Blocker)** | **Mode Demo** | `DemoBusinessService` belum diimplementasikan di sisi klien. | **Adapter In-Memory Klien Wajib Dibangun:** Halaman `/demo/*` dilarang memanggil Server Actions produksi. Wajib disediakan adapter penyimpanan lokal (*In-Memory Store*) yang memuat dataset simulasi *"Toko Sembako Sejahtera"* dan mendukung tombol reset instan $< 500$ ms. |
| **FIND-P1-01** | **P1 (High)** | **Server Action / Beban** | `deleteExpenseAction` mengembalikan `DESTRUCTIVE_DELETION_FORBIDDEN`. | **UI Pengeluaran Tidak Menyediakan Tombol Hard-Delete:** Pada `/expenses`, tombol hapus permanen ditiadakan atau digantikan dengan label status informatif *"Pencatatan Permanen untuk Jejak Audit Buku Kas"*. |
| **FIND-P1-02** | **P1 (High)** | **Database Migration** | Migration 012 (`reject_archived_products_in_sales.sql`) belum diaplikasikan di DB live. | **UI Kasir POS Wajib Memfilter Produk Arsip:** Antarmuka katalog kasir `/sales/new` wajib menyaring `is_archived = false` di sisi presentasi agar kasir tidak dapat memilih produk yang sudah tidak aktif. |
| **FIND-P1-03** | **P1 (High)** | **Sesi & Onboarding** | Pengguna yang belum memiliki bisnis akan ditolak oleh Server Actions produk/transaksi/laporan (`UNAUTHORIZED_BUSINESS`). | **Route Guard / Middleware Onboarding Wajib:** Sesi login pengguna baru yang belum memiliki bisnis harus dicegat dan diarahkan secara otomatis ke `/onboarding/create-business`. |
| **FIND-P2-01** | **P2 (Medium)** | **Input Rupiah** | Format input moneter memerlukan penanganan angka integer bersih tanpa desimal sen. | **Komponen `CurrencyInput` Terstandarisasi:** Diperlukan komponen input bersama dengan masking otomatis pemisah ribuan titik (`Rp 1.500.000`) yang mengembalikan nilai murni `number` integer ke form state. |
| **FIND-P2-02** | **P2 (Medium)** | **Aksesibilitas Mobile** | Target sentuh minimum 44px dan transformasi tabel ke kartu data vertikal di mobile (360px). | **Komponen `Table` Adaptif:** Seluruh tabel transaksi, produk, dan beban wajib berubah menjadi susunan kartu pada viewport $< 768px$. |

---

## 4. Daftar Risiko Backend yang Belum Selesai (Carry-Forward Risks)

Sesuai ketetapan audit sebelumnya, 4 risiko terbuka berikut **tetap aktif dan wajib diperhitungkan dalam desain UI**:

1. **Migration 012 (`20261014000012_reject_archived_products_in_sales.sql`) belum dieksekusi pada database live:**
   - *Status:* **OPEN**.
   - *Mitigasi UI:* Halaman katalog kasir POS `/sales/new` secara default memanggil `getProductsAction({ isArchived: false })` dan secara visual memblokir pemilihan item terarsip.
2. **PostgreSQL runtime dan RLS dengan JWT live belum diverifikasi:**
   - *Status:* **OPEN**.
   - *Mitigasi UI:* Seluruh pemanggilan Server Actions pada UI wajib menangani respons error `UNAUTHORIZED_BUSINESS` dan `AUTH_SESSION_EXPIRED` secara elegan dengan mengarahkan pengguna ke halaman login atau pemilihan bisnis.
3. **Idempotensi retry transaksi end-to-end menunggu UI POS:**
   - *Status:* **OPEN**.
   - *Mitigasi UI:* Implementasi form `/sales/new` bertanggung jawab penuh atas pembuatan UUID klien, penonaktifan tombol bayar saat *in-flight*, dan penyimpanan state keranjang sementara.
4. **Pembuatan produk baru dengan stok awal positif tetap fail-closed:**
   - *Status:* **OPEN**.
   - *Mitigasi UI:* Form `/products/new` membatasi registrasi produk pada katalog dasar (nama, SKU, kategori, harga jual, harga pokok dasar, batas minimum) dan mengarahkan input saldo stok fisik ke modul `/purchases/new`.

---

## 5. Pemetaan Modul & Kontrak Server Actions untuk UI

Berikut adalah matriks integrasi antara rute antarmuka pengguna (UI) dan Server Actions yang sudah siap digunakan:

| Modul UI | Rute Halaman | Server Actions yang Dikonsumsi | Format Kontrak & Respons |
|---|---|---|---|
| **1. Autentikasi** | `/login`, `/register` | `signUpAction`, `signInAction`, `signOutAction`, `getSessionAction` | `ApiResponse<AuthResponseData>` |
| **2. Bisnis & Switcher** | `/onboarding/create-business`, `BusinessSwitcher` | `createBusinessAction`, `getUserBusinessesAction`, `switchBusinessAction`, `getActiveBusinessAction` | `ApiResponse<TenantContextResponse>` |
| **3. Dashboard** | `/dashboard` | `getDashboardSummaryAction`, `getActiveBusinessAction` | `ApiResponse<DashboardSummaryResponseData>` (6 Kartu Metrik, Arus Kas, Tren Jakarta, Transaksi Terbaru, Stok Menipis) |
| **4. Produk & Stok** | `/products`, `/products/new`, `/products/:id` | `getProductsAction`, `getProductByIdAction`, `createProductAction`, `updateProductAction`, `archiveProductAction` | `ApiResponse<ProductResponseData[]>` & detail ledger mutasi stok |
| **5. Penjualan & Kasir** | `/sales`, `/sales/new`, `/sales/:id` | `createSaleAction`, `getSaleReceiptAction`, `voidSaleAction`, `getProductsAction` | `ApiResponse<SaleReceiptResponseData>`, `ApiResponse<VoidSaleResponseData>` |
| **6. Pembelian Restock** | `/purchases`, `/purchases/new` | `createPurchaseAction`, `getProductsAction` | `ApiResponse<PurchaseReceiptResponseData>` (Kalkulasi Moving Average Cost) |
| **7. Pengeluaran** | `/expenses` | `getExpensesAction`, `recordExpenseAction`, `updateExpenseAction`, `deleteExpenseAction` | `ApiResponse<ExpenseListResponseData>` (Penolakan hard-delete fail-closed) |
| **8. Laporan & Ekspor** | `/reports` | `getSalesReportAction`, `getExpenseReportAction`, `getStockReportAction`, `exportReportCsvAction` | `ApiResponse<SalesReportResponseData>`, file download RFC 4180 CSV |
| **9. Pengaturan** | `/settings` | `getActiveBusinessAction`, `getUserBusinessesAction` | Profil toko, IDR & Asia/Jakarta read-only display |
| **10. Mode Demo** | `/demo/*` | *None (Client-side `DemoBusinessService` Adapter)* | State in-memory/localStorage lokal |

---

## 6. Persyaratan Status Antarmuka Wajib (Mandatory UI States)

Setiap halaman dan komponen antarmuka yang dibangun pada Fase 5 wajib mengimplementasikan 6 keadaan interaksi:

1. **Loading State:**
   - Shimmer Skeleton (`Skeleton.tsx`) dengan dimensi yang mencerminkan komponen target (bukan spinner bulat di tengah layar kosong).
   - Indikator pemuatan pada tombol (`isSubmitting`) yang menonaktifkan klik ganda saat proses jaringan berlangsung.
2. **Empty State:**
   - Pesan yang jelas dan bersahabat dalam Bahasa Indonesia ketika data berjumlah nol.
   - Tombol Call-to-Action (CTA) kontekstual (contoh: *"Belum ada produk. Tambah produk pertama Anda"* pada `/products`).
   - Panduan Onboarding 3 Langkah pada Dashboard bisnis baru.
3. **Error State:**
   - Pesan validasi inline di bawah field input dengan warna Crimson (`--color-danger-text`) dan ikon peringatan.
   - Banner error kontekstual untuk kegagalan sistemik atau penolakan server (`UNAUTHORIZED_BUSINESS`, `STOCK_INSUFFICIENT`).
4. **Validation State:**
   - Validasi sisi klien real-time sebelum pengiriman formulir yang mencocokkan skema Zod Server Actions.
   - Penolakan format email tidak valid, kata sandi $< 8$ karakter, kuantitas kasir $>$ stok gudang, dan nominal Rupiah negatif.
5. **Unauthorized State:**
   - Pengalihan instan ke `/login` jika sesi autentikasi kedaluwarsa.
   - Tampilan pemblokiran dengan tombol beralih bisnis jika pengguna mencoba mengakses data tenant yang tidak diotorisasi.
6. **Responsive State:**
   - Target sentuh minimal **44 × 44 piksel** pada layar mobile.
   - Transformasi tabel multi-kolom desktop menjadi daftar kartu data terstruktur di layar ponsel 360px – 767px.
   - Penempatan bilah navigasi bawah (*Bottom Nav*) dan *Sticky Cart Drawer* pada mobile POS.

---

## 7. Rekomendasi Urutan Implementasi UI (Phase 5 Substage Breakdown)

Untuk meminimalkan risiko regresi dan memastikan pembangunan yang modular, implementasi Fase 5 direkomendasikan dibagi menjadi **7 substage berurutan**:

```
[Substage 5.1: UI Primitives & App Shell] 
       │
       ▼
[Substage 5.2: Auth & Onboarding Flow] 
       │
       ▼
[Substage 5.3: Master Produk & Pembelian Restock] 
       │
       ▼
[Substage 5.4: Kasir Cepat POS & Pembatalan Void] 
       │
       ▼
[Substage 5.5: Buku Pengeluaran Operasional] 
       │
       ▼
[Substage 5.6: Dashboard Bisnis & Laporan Finansial] 
       │
       ▼
[Substage 5.7: Pengaturan & Mode Demo Terisolasi]
```

### Rincian Substage, Acceptance Criteria, & Quality Gates:

#### Substage 5.1: UI Design System Primitives & App Shell Layout
- **Deliverables:**
  - Komponen atomik: `Button`, `Input`, `CurrencyInput`, `Select`, `Badge`, `Card`, `Modal`, `Table`, `Skeleton`, `EmptyState`.
  - Layout pembungkus: `AppLayout`, `Sidebar` desktop, `MobileNav` mobile, `TopBar`, dan kerangka `BusinessSwitcher`.
- **Acceptance Criteria:**
  - Token warna Royal Violet (`globals.css`) dan font Plus Jakarta Sans diterapkan seragam.
  - Rasio kontras teks memenuhi WCAG 2.2 AA ($\ge 4.5:1$).
  - Target sentuh mobile $\ge 44$px.
- **Quality Gates:** `npm test`, `npm run type-check`, `npm run lint`, `npm run build`.

#### Substage 5.2: Autentikasi & Alur Onboarding Bisnis
- **Deliverables:**
  - Halaman `/login` dan `/register`.
  - Halaman `/onboarding/create-business`.
  - Komponen fungsional `BusinessSwitcher` yang terhubung ke `getUserBusinessesAction` dan `switchBusinessAction`.
  - Route guard redirect pengguna baru tanpa bisnis aktif.
- **Acceptance Criteria:**
  - Login dan register berhasil memperbarui cookie sesi Supabase.
  - Pengguna tanpa bisnis dicegat dari rute `/dashboard` dan diarahkan ke onboarding.
  - Pergantian bisnis pada switcher memperbarui konteks tenant secara instan.
- **Quality Gates:** Pengujian unit komponen form, `npm test`, `npm run type-check`, `npm run lint`.

#### Substage 5.3: Manajemen Produk & Pembelian Persediaan (Restock)
- **Deliverables:**
  - Halaman `/products`, `/products/new`, `/products/:id`.
  - Halaman `/purchases`, `/purchases/new`.
  - Komponen `ProductForm`, `StockMovementList`, `PurchaseForm`.
- **Acceptance Criteria:**
  - Form `/products/new` mengunci `initialStock` pada 0 dengan pesan panduan restock (fail-closed adherence).
  - Filter *"Hanya Stok Menipis"* menyaring produk dengan kuantitas $\le$ ambang batas.
  - Form `/purchases/new` menampilkan kalkulasi real-time estimasi HPP Moving Weighted Average baru.
  - Aksi arsip produk berhasil menonaktifkan produk tanpa hard-delete.
- **Quality Gates:** `npm test`, `npm run type-check`, `npm run lint`, `npm run build`.

#### Substage 5.4: Kasir Cepat POS & Pembatalan Transaksi (Void)
- **Deliverables:**
  - Halaman antarmuka kasir cepat `/sales/new`.
  - Halaman riwayat penjualan `/sales` dan rincian `/sales/:id`.
  - Komponen `PosProductGrid`, `PosCartDrawer` (desktop) / Bottom Sheet (mobile), `VoidSaleDialog`.
- **Acceptance Criteria:**
  - Klien POS membangkitkan `idempotencyKey` UUID dan mengunci tombol bayar saat pengiriman.
  - Validasi stok real-time menolak penambahan item ke keranjang jika qty melebihi stok fisik.
  - Kalkulasi diskon per transaksi dan pemilihan metode pembayaran (Tunai / Transfer Bank).
  - Modal pembatalan penjualan meminta alasan wajib minimal 5 karakter dan mengubah status menjadi `VOIDED`.
- **Quality Gates:** `npm test`, `npm run type-check`, `npm run lint`, `npm run build`.

#### Substage 5.5: Pencatatan Pengeluaran Operasional
- **Deliverables:**
  - Halaman `/expenses`.
  - Komponen `ExpenseForm` (modal/drawer) dan tabel riwayat pengeluaran.
- **Acceptance Criteria:**
  - Form memuat peringatan visual tegas: *"Pembelian barang dagangan dicatat di menu Pembelian Stok, bukan di sini, agar HPP tidak terhitung ganda."*
  - Pemilihan kategori biaya terstandarisasi dan input Rupiah integer positif.
  - Tidak ada opsi hard-delete (perlindungan jejak audit buku kas).
- **Quality Gates:** `npm test`, `npm run type-check`, `npm run lint`, `npm run build`.

#### Substage 5.6: Dashboard Bisnis & Laporan Finansial
- **Deliverables:**
  - Halaman `/dashboard` (6 Kartu Metrik, grafik Recharts, transaksi terbaru, peringatan stok, onboarding guide).
  - Halaman `/reports` (Ringkasan Laba Rugi Sederhana, Ringkasan Arus Kas, Tab Transaksi).
  - Modal ekspor data CSV RFC 4180.
- **Acceptance Criteria:**
  - Selector rentang tanggal (Hari Ini, 7 Hari Terakhir, Bulan Ini, Kustom) berbasis waktu `Asia/Jakarta`.
  - Rekonsiliasi angka: Net Sales, COGS, Laba Kotor, Beban Operasional, Laba Operasional, Arus Kas Bersih klop $100\%$ dengan Server Actions.
  - Ekspor CSV mengunduh berkas dengan sanitasi CWE-1236 dan header UTF-8 BOM.
- **Quality Gates:** `npm test`, `npm run type-check`, `npm run lint`, `npm run build`.

#### Substage 5.7: Pengaturan Bisnis & Mode Demo Terisolasi
- **Deliverables:**
  - Halaman `/settings` (profil toko, IDR & Jakarta timezone read-only).
  - Rute Mode Demo `/demo/*` (`/demo/dashboard`, `/demo/sales`, `/demo/products`, `/demo/expenses`, `/demo/reports`).
  - Adapter `DemoBusinessService` berbasis memory/localStorage lokal dengan data awal *"Toko Sembako Sejahtera"*.
  - Komponen `DemoBanner` persisten dan tombol reset instan $< 500$ ms.
- **Acceptance Criteria:**
  - Seluruh rute `/demo/*` terbukti nol panggilan HTTP ke Supabase/backend nyata.
  - Tombol reset mengembalikan state simulasi dalam waktu $< 500$ ms.
  - Pengaturan profil bisnis terisolasi per tenant.
- **Quality Gates:** `npm test`, `npm run type-check`, `npm run lint`, `npm run build`.

---

## 8. Prasyarat Integrasi Database & QA Sebelum Produksi

Sebelum VeyraOS diluncurkan ke lingkungan produksi (*production rollout*), seluruh pengujian mock saat ini wajib dilengkapi dengan verifikasi lingkungan nyata:

1. **Aplikasi Migration 012 ke Database Live:**
   - Menjalankan `20261014000012_reject_archived_products_in_sales.sql` pada instance PostgreSQL Supabase untuk menegakkan penolakan produk arsip di level basis data.
2. **Audit Penetrasi RLS Runtime (Multi-Tenant Penetration):**
   - Menjalankan uji penetrasi otomatis menggunakan dua akun pengguna nyata (Tenant A dan Tenant B) untuk memverifikasi bahwa token JWT Tenant A secara mutlak ditolak oleh RLS saat mencoba membaca atau memutasi data Tenant B.
3. **Pengujian Stres Konkurensi POS:**
   - Menguji transaksi penjualan simultan pada produk dengan stok sisa 1 oleh dua kasir berbeda untuk membuktikan bahwa kuncian baris deterministik `ORDER BY id ASC FOR UPDATE` mencegah stok minus dan deadlock.
4. **Verifikasi E2E Playwright:**
   - Menjalankan suite pengujian end-to-end pada peramban Chromium mobile (viewport 360px) dan desktop (viewport 1280px) untuk seluruh alur kritis dari registrasi hingga ekspor CSV.

---

## 9. Kesimpulan & Keputusan Audit (Audit Decision)

```
================================================================================
                    PRE-UI READINESS AUDIT VERDICT
================================================================================
  Verdict Resmi:    READY WITH CONDITIONS (SIAP DENGAN SYARAT)
  Alasan:           Lapisan layanan (service layer), kontrak DTO, dan Server Actions
                    telah selesai 100% dan teruji pada 483 skenario pengujian.
                    Fondasi CSS dan token styling telah siap.
  Syarat Wajib 1:   UI kasir POS wajib membangkitkan UUID idempotencyKey klien.
  Syarat Wajib 2:   UI tambah produk wajib mematuhi penolakan fail-closed stok awal
                    positif dan mengarahkan pengguna ke alur restock persediaan.
  Syarat Wajib 3:   Mode Demo (/demo/*) wajib menggunakan adapter penyimpanan lokal
                    yang sepenuhnya terisolasi tanpa panggilan jaringan ke backend.
  Syarat Wajib 4:   Implementasi UI wajib dijalankan secara berurutan mulai dari
                    Substage 5.1 (Primitives & Shell) hingga Substage 5.7 (Demo).
================================================================================
```

Auditor merekomendasikan untuk **membuka Substage 5.1 (UI Primitives & App Shell Layout)** setelah persetujuan eksplisit dari reviewer.
