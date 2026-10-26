# VeyraOS — Stage 5.5 Closure dan Persiapan Stage 5.6 Preflight Review

**Tanggal Dokumen:** 15 Oktober 2026  
**Peran Reviewer:** Principal Software Architect, Senior Full-Stack Engineer, Financial Domain Reviewer, QA Engineer  
**Status Penutupan Stage 5.5:** PASS WITH CONDITIONS  
**Status Persiapan Stage 5.6:** PREFLIGHT COMPLETED & AWAITING AUTHORIZATION  
**Branch / Workspace:** `master` (`c:\Antigravity Project\VeyraOS`)  

---

## 1. Penutupan Resmi Stage 5.5 (Dashboard & Financial Reports UI)

Berdasarkan audit integrasi akhir yang tercatat dalam [`docs/stage-5.5-final-integration-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.5-final-integration-audit.md), seluruh ruang lingkup **Stage 5.5 (Langkah 1 hingga Langkah 4)** secara resmi dinyatakan **DITUTUP** dengan status:

```
====================================================================
STATUS PENUTUPAN STAGE 5.5: PASS WITH CONDITIONS
(FINAL INTEGRATION AUDITED & ALL QUALITY GATES PASSED)
====================================================================
```

### 1.1 Ringkasan Deliverables yang Diselesaikan
1. **Dashboard Bisnis UI ([`src/app/dashboard/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/dashboard/page.tsx))**:
   - Header tenant server-authoritative (`getActiveTenantContextAction`).
   - 6 Kartu KPI Finansial Utama: Penjualan Bersih, HPP Snapshot, Laba Kotor (+ Margin %), Beban Operasional, Laba Operasional, dan Arus Kas Bersih.
   - Grafik batang tren penjualan harian SVG native dengan aksesibilitas lengkap (WCAG 2.2 AA) dan tabel alternatif `.sr-only`.
   - Widget 5 transaksi terbaru dan peringatan produk dengan stok menipis/habis.
   - Penanganan state komprehensif: shimmer skeleton loading, banner error dengan tombol Retry, dan empty state ramah pengguna.
2. **Laporan Keuangan & Operasional UI ([`src/app/reports/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/reports/page.tsx))**:
   - Navigasi 3 Segmented Tabs: **Penjualan & Diskon**, **Beban Operasional**, serta **Stok & Valuasi Persediaan MWAC**.
   - Pemisahan draft filter dan applied query untuk mencegah query berlebihan sebelum penekanan tombol "Terapkan Filter".
   - Paginasi server 20 baris per halaman pada tabel transaksi penjualan.
   - Visualisasi status `VOIDED` dengan badge merah dan nominal dicoret (*line-through*), serta eksklusi dari agregasi omzet dan arus kas.
   - Trigger ekspor CSV RFC 4180 terintegrasi langsung dengan `exportReportCsvAction`, dilengkapi sanitasi Formula Injection (CWE-1236) dan header UTF-8 BOM (`\uFEFF`).
3. **Pengujian Unit UI**:
   - [`src/app/dashboard.test.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/dashboard.test.tsx): 28 unit tests (lulus 100%).
   - [`src/app/reports.test.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/reports.test.tsx): 20 unit tests (lulus 100%).
4. **Empat Quality Gates**:
   - **Unit Tests:** 31 file lulus, total 663 pengujian lulus (0 gagal).
   - **TypeScript:** `npm run type-check` bebas error (code 0).
   - **Linter:** `npm run lint` 0 error dan 0 warning (code 0).
   - **Production Build:** Next.js 16.4.0 (Turbopack) sukses menghasilkan 15 rute statis & PPR (code 0).

### 1.2 Catatan Kondisi Penyelesaian (Carry-Forward Tasks ke Tahap 10)
Status `PASS WITH CONDITIONS` mempertahankan catatan tegas bahwa pekerjaan berikut **belum dijalankan dan dialokasikan ke Tahap 10**:
1. **Validasi Runtime PostgreSQL Live & RLS:** Seluruh pengujian saat ini divalidasi via unit test suite dan component mocking. Uji penetrasi multi-tenant terhadap instance Supabase live dijadwalkan pada Tahap 10.
2. **Otomasi Browser E2E (Playwright):** Pengujian interaksi browser riil pada resolusi mobile 360px dan desktop 1400px dijadwalkan pada Tahap 10.
3. **Pengujian Unduhan Fisik File CSV:** Pengujian unduhan berkas nyata ke sistem berkas lokal browser dialokasikan pada Tahap 10.

Status ini telah diperbarui dan tercatat pada tabel eksekusi [`docs/implementation-roadmap.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/implementation-roadmap.md).

---

## 2. Identifikasi & Rekonsiliasi Ruang Lingkup Stage 5.6

### 2.1 Analisis Perbedaan Roadmap (Roadmap Reconciliation)
Pemeriksaan silang terhadap dokumen perencanaan arsitektur menemukan adanya perbedaan penomoran yang perlu direkonsiliasi:

1. **Rencana Awal di [`docs/pre-ui-readiness-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/pre-ui-readiness-audit.md#L145-L157):**
   - Substage 5.1: UI Primitives & App Shell Layout *(Selesai)*
   - Substage 5.2: Autentikasi & Alur Onboarding Bisnis *(Selesai)*
   - Substage 5.3: Manajemen Produk & Pembelian Persediaan Restock *(Selesai)*
   - Substage 5.4: Kasir Cepat POS & Pembatalan Transaksi Void *(Selesai)*
   - Substage 5.5: **Pencatatan Pengeluaran Operasional (`/expenses`)** *(Belum dibuat UI-nya)*
   - Substage 5.6: **Dashboard Bisnis & Laporan Finansial (`/dashboard`, `/reports`)** *(Sudah selesai diimplementasikan pada Stage 5.5 aktual)*
   - Substage 5.7: **Pengaturan Bisnis & Mode Demo Terisolasi (`/settings`, `/demo/*`)**
2. **Master Roadmap di [`docs/implementation-roadmap.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/implementation-roadmap.md#L10-L41):**
   - Tahap 6: Penjualan POS & Void *(Selesai pada Stage 5.4)*
   - Tahap 7: **Pencatatan Pengeluaran Operasional (`/expenses`)** *(Belum dibuat UI-nya)*
   - Tahap 8: **Dashboard Bisnis & Laporan Finansial (`/dashboard`, `/reports`)** *(Selesai pada Stage 5.5)*
   - Tahap 9: **Ekspor CSV & Mode Demo Terisolasi (`/demo/*`, `/settings`)**
   - Tahap 10: QA, Audit Keamanan, & Deployment
3. **Kondisi Aktual di Kode Aplikasi:**
   - Navigasi sidebar ([`src/components/layout/sidebar.tsx:26`](file:///c:/Antigravity%20Project/VeyraOS/src/components/layout/sidebar.tsx#L26)) sudah memuat menu:
     `{ label: "Pengeluaran", href: "/expenses", icon: ArrowDownCircle }`
   - Direktori `src/app/expenses/` **belum ada**, sehingga jika tautan tersebut diklik, pengguna akan menemui halaman 404.
   - Backend Server Actions ([`src/app/actions/expenses.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/expenses.ts)) dan service layer ([`src/services/expenses/expense.service.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/services/expenses/expense.service.ts)) sudah selesai 100% dan teruji pada Stage 3.3 Batch 3.
   - Halaman Laporan Keuangan ([`src/app/reports/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/reports/page.tsx)) sudah memiliki tab "Beban Operasional", namun aplikasi saat ini belum memiliki halaman bagi pemilik usaha untuk mencatat pengeluaran operasional baru secara mandiri.

### 2.2 Dua Opsi Definisi Stage 5.6

| Aspek | Opsi A (Rekomendasi Utama) | Opsi B (Alternatif Melompat) |
|---|---|---|
| **Nama Tahap** | **Stage 5.6: Pencatatan Pengeluaran Operasional UI (`/expenses`)** | **Stage 5.6: Pengaturan Bisnis & Mode Demo Terisolasi (`/settings`, `/demo/*`)** |
| **Pemetaan Roadmap** | Menuntaskan **Tahap 7 UI Roadmap** (sebelumnya Substage 5.5 di pre-UI audit) yang terlewati saat pengerjaan Dashboard/Reports. | Melanjutkan ke **Tahap 9 Roadmap** (Substage 5.7 di pre-UI audit). |
| **Tujuan Fungsional** | Menyediakan buku catatan pengeluaran operasional kas toko (sewa, listrik, gaji, perawatan) agar arus kas dan laba bersih UMKM tercatat akurat. | Menyediakan halaman profil toko/timezone dan simulasi demo in-memory tanpa akun. |
| **Dampak Arsitektur** | Menutup tautan 404 pada sidebar menu `/expenses` dan melengkapi sumber data untuk tab Beban Operasional di `/reports`. | Meninggalkan tautan `/expenses` dalam kondisi 404 dan membiarkan UMKM tidak memiliki UI pencatatan biaya operasional. |
| **Rekomendasi Tim** | **SANGAT DIREKOMENDASIKAN (RECOMMENDED)** | Tidak direkomendasikan sebelum Tahap 7 UI selesai |

---

## 3. Spesifikasi Lengkap Stage 5.6 (Opsi A — Rekomendasi Utama)

### 3.1 Nama dan Tujuan Tahap
- **Nama Tahap:** Stage 5.6 — Pencatatan Pengeluaran Operasional UI (`/expenses`)
- **Tujuan:** Membangun antarmuka buku catatan pengeluaran operasional yang bersih, mudah digunakan, dan terintegrasi penuh dengan backend VeyraOS. Membantu pemilik UMKM mencatat beban biaya kas non-persediaan (Sewa Tempat, Listrik & Air, Gaji Karyawan, Transportasi, Pemasaran, Perawatan, Perlengkapan, dan Operasional Umum) secara akurat, melihat riwayat beban, menyaring berdasarkan kategori dan tanggal, serta memahami dampak biaya terhadap laba operasional tanpa risiko pencatatan ganda atas belanja persediaan barang dagangan.

### 3.2 Fitur dan File dalam Cakupan
1. **Fitur Antarmuka Pengguna (`/expenses`):**
   - **Header Konteks Bisnis:** Menampilkan nama toko aktif dan tombol aksi utama `[+ Catat Pengeluaran]`.
   - **Kartu Ringkasan Beban:**
     - Total Beban Operasional (sesuai filter aktif).
     - Jumlah Transaksi Beban.
     - Kategori Beban Terbesar (nominal & persentase).
   - **Formulir Modal / Drawer "Catat Pengeluaran":**
     - Tanggal Pengeluaran (default: tanggal hari ini WIB `Asia/Jakarta`).
     - Dropdown Kategori Biaya (8 kategori standar: `OPERATIONAL`, `SALARY`, `UTILITIES`, `RENT`, `MARKETING`, `MAINTENANCE`, `SUPPLIES`, `OTHER` dengan label bahasa Indonesia yang ramah UMKM).
     - Input Nominal Pengeluaran (format mata uang Rupiah integer positif $> 0$).
     - Input Keterangan / Catatan Tambahan (opsional, maks 500 karakter).
     - **Peringatan Visual Anti-Double Count (Kritis):**
       *"Catatan: Pembelian barang dagangan/stok dicatat melalui menu Pembelian Stok, bukan di sini, agar HPP tidak terhitung ganda."*
   - **Tabel Riwayat Pengeluaran Operasional:**
     - Kolom: Tanggal, Kategori (Badge berwarna semantik), Keterangan, Nominal (Rupiah IDR).
     - Kontrol Filter: Filter Kategori Biaya & Filter Rentang Tanggal (Hari Ini, 7 Hari Terakhir, Bulan Ini, Kustom) dengan pemisahan draft vs applied.
   - **Penegakan Perlindungan Jejak Audit Buku Kas (Anti-Destructive Delete):**
     - Sesuai kontrak backend `deleteExpenseAction` yang mengembalikan kode error `DESTRUCTIVE_DELETION_FORBIDDEN`, antarmuka pengguna **tidak menyediakan tombol hapus fisik destruktif**. Baris catatan dapat memuat indikator badge informatif *"Pencatatan Permanen"* untuk menjamin integritas pembukuan kas UMKM.
   - **Penanganan State Komprehensif:**
     - Loading skeleton saat fetching data.
     - Empty state ramah pengguna saat belum ada catatan pengeluaran (dengan tombol ajakan mencatat).
     - Error banner dengan tombol coba lagi (*Retry*).

2. **File yang Akan Dibuat / Diuji:**
   - [`src/app/expenses/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/expenses/page.tsx) — Halaman utama modul Pengeluaran Operasional.
   - [`src/app/expenses.test.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/expenses.test.tsx) — Suite pengujian unit komprehensif untuk halaman pengeluaran (target minimal 20 skenario uji).

3. **File Backend & Komponen yang Diintegrasikan (Siap Pakai, Tanpa Modifikasi):**
   - [`src/app/actions/expenses.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/expenses.ts) (`recordExpenseAction`, `getExpensesAction`, `getExpenseByIdAction`, `updateExpenseAction`, `deleteExpenseAction`).
   - [`src/services/expenses/expense.service.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/services/expenses/expense.service.ts).
   - [`src/lib/validations/expense.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/expense.ts).
   - [`src/types/database.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/types/database.ts) & [`src/types/api.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/types/api.ts) (`ExpenseCategory`).
   - [`src/components/ui/*`](file:///c:/Antigravity%20Project/VeyraOS/src/components/ui) (`Button`, `Input`, `CurrencyInput`, `Select`, `Card`, `Badge`, `Modal`, `Table`, `Skeleton`, `EmptyState`).
   - [`src/components/layout/sidebar.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/components/layout/sidebar.tsx) (tautan `/expenses` sudah terhubung).

### 3.3 Dependensi terhadap Tahap Sebelumnya
- **Stage 3.2.2B (Service Layer Beban Operasional):** Menyediakan kalkulasi, agregasi per kategori, dan query basis data `expenses`.
- **Stage 3.3 Batch 3 (Server Actions Beban Operasional):** Menyediakan `recordExpenseAction` dan `getExpensesAction` dengan validasi server-authoritative tenant context.
- **Stage 5.1 (UI Primitives & App Shell):** Menyediakan komponen atomik `Card`, `Modal`, `Table`, `Badge`, `CurrencyInput`, serta layout sidebar dan mobile drawer.
- **Stage 5.2 (Auth & Tenant Context):** Menyediakan konteks cookie bisnis aktif dan proteksi rute middleware.
- **Stage 5.5 (Modul Laporan Finansial):** Memastikan konsistensi format Rupiah, pemisahan draft filter tanggal, dan agregasi kategori biaya yang identik dengan tab Beban Operasional pada `/reports`.

### 3.4 Kriteria Penerimaan (Acceptance Criteria)
1. **Header & Tenant:** Halaman `/expenses` menampilkan nama bisnis aktif dari session cookie terenkripsi; jika konteks bisnis hilang, terjadi fail-closed redirect.
2. **Formulir Tambah Beban:**
   - Pengguna dapat membuka modal formulir dengan mengklik `[+ Catat Pengeluaran]`.
   - Form memvalidasi bahwa nominal $> 0$, kategori terpilih dari 8 kategori valid, dan tanggal terisi valid.
   - Peringatan visual anti-pencatatan-stok tampil secara menonjol dan jelas.
   - Tombol simpan dinonaktifkan (loading state) saat pengiriman data untuk mencegah double submit.
   - Setelah sukses menyimpan, modal tertutup, pesan sukses tampil, dan tabel riwayat memuat data baru secara otomatis.
3. **Penyaringan Riwayat:**
   - Pengguna dapat menyaring catatan berdasarkan Kategori dan Rentang Tanggal.
   - Filter tanggal menerapkan pola draft vs applied filter.
   - Jika `startDate > endDate`, form menolak dan menampilkan pesan validasi yang jelas.
4. **Integritas Jejak Audit (Anti-Destructive Delete):**
   - Tidak ada tombol aksi hapus fisik pada baris riwayat yang memungkinkan pengguna menghapus permanen data pengeluaran (selaras dengan mandat PRD dan kode `DESTRUCTIVE_DELETION_FORBIDDEN`).
5. **State Rendering:**
   - Shimmer skeleton tampil saat pemuatan awal.
   - Empty state informatif dengan ilustrasi/ikon dan tombol catat tampil saat belum ada catatan beban.
   - Alert banner merah informatif dengan tombol Retry tampil jika backend gagal dihubungi.
6. **Aksesibilitas & Tipografi (WCAG 2.2 AA):**
   - Seluruh input form memiliki `<label>` yang terhubung via `htmlFor`.
   - Rasio kontras teks $\ge 4.5:1$.
   - Modal memiliki fokus trap dan dapat ditutup via tombol Escape atau tombol Batal.

### 3.5 Quality Gates Wajib
Untuk menyelesaikan Stage 5.6 nantinya, implementasi wajib lulus 4 quality gates tanpa pengecualian:
1. **Unit & Regression Testing:** `npm test -- --run` wajib meluluskan seluruh pengujian baru di `src/app/expenses.test.tsx` (target $\ge 20$ pengujian) dan mempertahankan kelulusan 100% dari 31 file pengujian yang sudah ada (total $\ge 683$ tests lulus).
2. **TypeScript Type Check:** `npm run type-check` bebas error (`tsc --noEmit` exit code 0).
3. **Linting:** `npm run lint` bebas error dan warning (`eslint` exit code 0).
4. **Production Build:** `npm run build` sukses mengompilasi rute `/expenses` dengan Turbopack (exit code 0).

---

## 4. Risiko, Blocker, dan Hal yang Perlu Diputuskan

| Kategori | Deskripsi Risiko / Pertanyaan Desain | Mitigasi / Rekomendasi Arsitektural |
|---|---|---|
| **Keputusan Ruang Lingkup** | Rekonsiliasi nomor tahapan antara pre-UI audit (`Substage 5.5 = expenses`) dan roadmap eksekusi (`Tahap 7 = expenses`). | Tetapkan Stage 5.6 sebagai **Pencatatan Pengeluaran Operasional UI (`/expenses`)**. Hal ini menuntaskan Tahap 7 UI sebelum melangkah ke Pengaturan & Demo (Tahap 9). |
| **Kebijakan Hapus Catatan** | Di masa lalu timbul pertanyaan apakah pengeluaran boleh dihapus. PRD Bab 5 Butir 6 dan `deleteExpenseAction` melarang hard-delete (`DESTRUCTIVE_DELETION_FORBIDDEN`). | UI `/expenses` tidak menyediakan tombol hapus fisik. Catatan bersifat append-only dengan status *"Pencatatan Permanen untuk Jejak Audit Buku Kas"*. |
| **Nomenklatur Data** | Kolom tabel SQL bernama `notes`, sedangkan kontrak DTO API Server Actions bernama `description`. | Service layer dan Server Actions sudah memetakan `notes` $\leftrightarrow$ `description`. Komponen UI wajib menggunakan atribut `description` sesuai kontrak tipe `RecordExpenseActionInput`. |
| **Zona Waktu Tanggal** | Default tanggal input form berisiko bergeser 1 hari jika menggunakan UTC browser default. | Gunakan penentuan tanggal lokal berbasis zona waktu bisnis `Asia/Jakarta` (WIB) yang konsisten dengan modul penjualan dan laporan. |

---

## 5. Urutan Langkah Terkecil yang Dapat Diaudit Secara Terpisah

Implementasi Stage 5.6 akan dipecah menjadi 4 langkah terkecil untuk memastikan setiap tahapan terisolasi dan mudah diaudit:

```
[Langkah 1: Preflight Audit & Desain Kontrak /expenses]
                        │
                        ▼
[Langkah 2: Implementasi Antarmuka Pengguna /expenses/page.tsx]
                        │
                        ▼
[Langkah 3: Pengujian Unit UI Komprehensif src/app/expenses.test.tsx]
                        │
                        ▼
[Langkah 4: Final Integration Audit & Eksekusi 4 Quality Gates]
```

### Rincian Per Langkah:
- **Langkah 1 — Preflight Audit & Desain Kontrak `/expenses`**:
  - Memeriksa skema form, kontrak tipe DTO, pemetaan kategori, dan teks edukasi anti-stok.
  - Mempersiapkan mock fixtures pengujian untuk 8 kategori beban operasional.
  - Deliverable: Dokumen kesiapan audit pra-implementasi.
- **Langkah 2 — Implementasi Antarmuka Pengguna `src/app/expenses/page.tsx`**:
  - Membangun komponen halaman `/expenses`: Header tenant, kartu ringkasan KPI beban, formulir modal `[+ Catat Pengeluaran]`, tabel riwayat, filter kategori dan tanggal, serta state loading/empty/error.
  - Mengintegrasikan langsung dengan `recordExpenseAction` dan `getExpensesAction`.
  - Deliverable: Berkas kode `src/app/expenses/page.tsx`.
- **Langkah 3 — Pengujian Unit UI `src/app/expenses.test.tsx`**:
  - Menulis $\ge 20$ skenario pengujian unit: render awal, validasi nominal $\le 0$, pencegahan double submit, filter kategori, filter tanggal, format Rupiah IDR, dan penanganan error server.
  - Deliverable: Berkas kode `src/app/expenses.test.tsx` dan laporan kelulusan tes.
- **Langkah 4 — Final Integration Audit & Eksekusi 4 Quality Gates**:
  - Menjalankan seluruh test suite (`npm test -- --run`), type-check (`npm run type-check`), linter (`npm run lint`), dan production build (`npm run build`).
  - Memverifikasi kepatuhan terhadap seluruh batasan arsitektur dan kepatuhan WCAG 2.2 AA.
  - Deliverable: Dokumen audit penutupan Stage 5.6 final.

---

## 6. Pemeriksaan Status Git dan Kepatuhan Batasan

Pemeriksaan status direktori kerja lokal dijalankan dengan perintah `git status --short`:

```
?? .agents/
?? .env.example
?? .gitignore
?? AGENTS.md
?? PRD.md
?? README.md
?? docs/
?? eslint.config.mjs
?? next.config.ts
?? package-lock.json
?? package.json
?? skills-lock.json
?? src/
?? supabase/
?? tsconfig.json
?? vitest.config.mts
```

### Verifikasi Kepatuhan Batasan:
- **Kode Aplikasi Tidak Berubah:** Tidak ada berkas di dalam `src/` yang diubah atau ditambah pada sesi ini.
- **Basis Data Tidak Berubah:** Tidak ada skema SQL baru atau modifikasi yang dilakukan pada direktori `supabase/`.
- **Dependensi Tidak Berubah:** Tidak ada paket npm baru yang dipasang pada `package.json`.
- **Lingkungan / Kredensial Tidak Berubah:** Berkas `.env` tidak disentuh.
- **Git Commit Tidak Dibuat:** Tidak ada commit baru yang dieksekusi.
- **Implementasi Stage 5.6 Belum Dimulai:** Seluruh pekerjaan dibatasi murni pada penutupan Stage 5.5 dan analisis preflight Stage 5.6.

---

## 7. Rekomendasi Langkah Selanjutnya

1. Menunggu persetujuan pengguna atas:
   - Penutupan resmi Stage 5.5 dengan status `PASS WITH CONDITIONS`.
   - Pemilihan **Opsi A (Pencatatan Pengeluaran Operasional UI `/expenses`)** sebagai ruang lingkup resmi untuk **Stage 5.6**.
2. Setelah disetujui, memulai eksekusi **Stage 5.6 Langkah 1: Preflight Audit & Desain Kontrak `/expenses`**.
