# VeyraOS — Stage 5.7, Langkah 1: Preflight Audit & Spesifikasi Detail

**Tanggal Audit:** 15 Oktober 2026  
**Peran Auditor:** Principal Software Architect, Senior Full-Stack Engineer, Financial Domain Reviewer, Product Systems Reviewer  
**Status Tahap:** LANGKAH 1 SELESAI (DESAIN SPESIFIKASI & PREFLIGHT AUDITED — SIAP MENUJU LANGKAH 2)  
**Ruang Lingkup:** Landing Gateway (`/`), Pengaturan Bisnis (`/settings`), Trigger Ekspor CSV (`/reports`), & Mode Demo Terisolasi (`/demo/*`)  
**Branch / Workspace:** `master` (`c:\Antigravity Project\VeyraOS`)  

---

## 1. Temuan Aktual & Berkas yang Diperiksa

Pemeriksaan kode aktual di workspace memverifikasi berkas-berkas berikut:

| Kategori | Berkas Sumber Aktual | Hasil Pemeriksaan & Status Aktual |
|---|---|---|
| **Root Route (Landing)** | [`src/app/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/page.tsx) | Masih memuat teks scaffold *"Phase 4 Stage 1 Scaffold Ready"*. Tombol *"Fondasi Arsitektur Siap"* berupa `<div>` non-interaktif tanpa tautan `<a>`/`<Link>`. Tidak ada akses navigasi ke `/login`, `/register`, maupun `/demo`. |
| **Pengaturan Bisnis (Actions)** | [`src/app/actions/business.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/business.ts) | Memuat `createBusinessAction`, `switchActiveBusinessAction`, `getActiveTenantContextAction`. **Belum mengekspos `updateBusinessAction`** meskipun service layernya sudah lengkap. |
| **Pengaturan Bisnis (Service)** | [`src/services/business/business.service.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/services/business/business.service.ts) | Fungsi `updateBusiness` (baris 430–573) dan `getBusinessById` (baris 366–422) **telah terimplementasi penuh** dengan otorisasi `FORBIDDEN_NOT_OWNER`, validasi Zod `updateBusinessSchema`, dan whitelist field (`name`, `category`, `phone`, `address`). |
| **Navigasi Sidebar** | [`src/components/layout/sidebar.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/components/layout/sidebar.tsx) | Memuat tautan navigasi `{ label: "Pengaturan", href: "/settings", icon: Settings }` (baris 29). Saat ini menghasilkan **404 Not Found** karena direktori `src/app/settings` belum ada. |
| **Halaman Autentikasi** | [`src/app/login/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/login/page.tsx) & [`src/app/register/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/register/page.tsx) | Memuat tautan `<Link href="/demo">Coba Dulu di Mode Demo (Tanpa Akun)</Link>`. Saat ini menghasilkan **404 Not Found** karena direktori `src/app/demo` belum ada. |
| **Ekspor CSV (Actions & Service)** | [`src/app/actions/reports.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/reports.ts#L364-L402) & [`src/services/reports/report.service.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/services/reports/report.service.ts#L1098-L1340) | Fungsi `exportReportCsvAction` dan `exportReportCsv` telah selesai, mendukung tipe `SALES`, `EXPENSES`, dan `STOCK`, dengan sanitasi CWE-1236 dan UTF-8 BOM `\uFEFF`. Telah diuji 8 skenario pada `report.service.test.ts`. |
| **Halaman Laporan UI** | [`src/app/reports/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/reports/page.tsx) | Pemicu tombol/modal unduh berkas CSV belum dipasang di antarmuka tab laporan. |
| **Middleware Sesi** | [`src/middleware.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/middleware.ts#L88-L101) | Jalur `/demo` dan file statis dikecualikan dari middleware; `/settings` masuk ke dalam rute yang dilindungi (`isProtectedRoute`). |
| **Migrasi Database** | `supabase/migrations/` (12 berkas) | Skema tabel `businesses` memuat kolom `id, owner_id, name, category, phone, address, currency_code (DEFAULT 'IDR'), timezone (DEFAULT 'Asia/Jakarta'), created_at, updated_at`. Stored procedures mutasi atomik tersedia (`record_sale_transaction`, `record_purchase_transaction`, `void_sale_transaction`). Analisis analitik laporan dihitung murni di TypeScript service layer. |

---

## 2. Spesifikasi Fungsional Tiap Bagian

### 2.1 Bagian A: Transformasi Landing Page Gateway (`/`)
Mengubah [`src/app/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/page.tsx) dari scaffold token menjadi pintu gerbang publik yang ramah pengguna, berestetika *Royal Violet*, dan selaras dengan [docs/information-architecture.md](file:///c:/Antigravity%20Project/VeyraOS/docs/information-architecture.md#L40-L46) Bagian 2.1:

1. **Header Navigasi Publik:**
   - Logo VeyraOS dengan ikon brand (*Store / Sparkles*).
   - Tautan navigasi responsif ke seksi fitur (*Kasir*, *Stok & HPP*, *Pengeluaran*, *Laporan*).
   - Tombol aksi navigasi:
     - Secondary Button: `"Masuk"` (`href="/login"`).
     - Secondary Outline: `"Coba Demo"` (`href="/demo"`).
     - Primary Button: `"Daftar Bisnis Baru"` (`href="/register"`).
2. **Hero Section:**
   - Tagline Utama (PRD 1.1): *"Run your business. Know your numbers."*
   - Subjudul: *"Aplikasi web manajemen kasir, persediaan stok, dan pencatatan laba operasional untuk pemilik usaha kecil di Indonesia. Bebas pembulatan desimal bias, terstruktur, dan mudah dipahami."*
   - Panggilan Aksi (Dual CTA):
     - Primary CTA: `[Coba Mode Demo (Tanpa Akun)]` $\to$ mengarahkan langsung ke `/demo` untuk eksplorasi instan tanpa registrasi.
     - Secondary CTA: `[Masuk ke Akun]` $\to$ mengarahkan ke `/login`.
3. **Pilar Kemampuan Aplikasi (Berdasarkan Fitur Aktual):**
   - **Kasir Cepat POS (`/sales/new`):** Pencatatan transaksi kilat, pemilihan metode pembayaran tunai/QRIS/transfer, diskon item & transaksi, struk nota, dan pembatalan transaksi berstatus *VOIDED*.
   - **Persediaan & HPP Rata-Rata Bergerak (`/products`, `/purchases`):** Penilaian harga pokok persediaan akurat menggunakan *Moving Weighted Average Cost (MWAC)* yang otomatis direkalkulasi setiap kali restock toko dicatat.
   - **Buku Beban Operasional (`/expenses`):** Pencatatan 8 kategori beban operasional dengan peringatan visual anti-double-count terhadap stok barang dagangan.
   - **Dashboard & Laporan Finansial (`/dashboard`, `/reports`):** 6 kartu KPI, visualisasi tren omzet harian berbasis waktu Indonesia Barat (`Asia/Jakarta`), dan ekspor data CSV berstandar RFC 4180.
4. **Prinsip Arsitektur Transparan (Tanpa Klaim Palsu):**
   - Menampilkan integritas moneter integer Rupiah (`BIGINT`), pembuktian isolasi tenant server-authoritative, dan desain kontras WCAG 2.2 AA. Tidak mengklaim sertifikasi produksi bankir/audit eksternal yang belum dilakukan.
5. **Pembersihan Artefak Scaffold:**
   - Menghapus badge `"Phase 4 Stage 1 Scaffold Ready"`.
   - Mengganti tombol non-interaktif *"Fondasi Arsitektur Siap"* dengan alur navigasi fungsional nyata.

---

### 2.2 Bagian B: Halaman Pengaturan Bisnis (`/settings`)
Mengimplementasikan halaman `/settings` untuk menutup tautan 404 pada sidebar utama:

1. **Informasi Bisnis yang Dapat Dibaca:**
   - Nama Bisnis (`name`)
   - Bidang / Kategori Usaha (`category`)
   - Nomor Telepon / WhatsApp (`phone`)
   - Alamat Fisik Usaha (`address`)
   - Identitas Pemilik (`ownerId`)
   - Mata Uang Toko: `IDR (Rupiah)` — **Read-Only (Sistem Baku)**
   - Zona Waktu Toko: `Asia/Jakarta (WIB)` — **Read-Only (Sistem Baku)**
2. **Field yang Diizinkan untuk Diedit (Whitelist):**
   - `name`: String wajib, 2 s.d. 60 karakter setelah di-trim.
   - `category`: String opsional, maksimal 50 karakter.
   - `phone`: String opsional, maksimal 20 karakter.
   - `address`: String opsional, maksimal 255 karakter.
   - *Catatan:* Perubahan `currency_code` dan `timezone` dikunci demi mencegah kerusakan matematis historis pada data transaksi.
3. **Penegakan Hak Akses & Otorisasi:**
   - Pemeriksaan server: Hanya pemilik sah (`owner_id === auth.uid()`) yang diizinkan menyimpan perubahan.
   - Jika pengguna merupakan staf/anggota non-pemilik, tombol simpan dinonaktifkan dengan pesan informatif: *"Hanya pemilik bisnis yang memiliki izin untuk mengubah informasi bisnis ini."*
4. **State Management:**
   - *Loading State:* Menampilkan form skeleton saat membaca konteks bisnis aktif dari `getActiveTenantContextAction`.
   - *Empty State / No Active Business:* Jika akun belum memiliki bisnis aktif, menampilkan pesan ajakan membuat bisnis pertama dengan tombol ke `/onboarding/create-business`.
   - *Error & Success Banner:* Notifikasi keberhasilan simpan dan penanganan pesan error server (misal: validasi gagal, sesi kedaluwarsa).

---

### 2.3 Bagian C: Integrasi Pemicu Ekspor CSV pada `/reports`
Menghubungkan kemampuan backend `exportReportCsvAction` ke antarmuka pengguna di [src/app/reports/page.tsx](file:///c:/Antigravity%20Project/VeyraOS/src/app/reports/page.tsx):

1. **Titik Pemicu Ekspor (UI Trigger):**
   - Menambahkan tombol aksi `[Ekspor CSV]` pada header modul laporan dan pada masing-masing tab laporan:
     - Tab Penjualan $\to$ Ekspor Laporan Penjualan (`type: "SALES"`)
     - Tab Beban Operasional $\to$ Ekspor Laporan Beban (`type: "EXPENSES"`)
     - Tab Transaksi Sumber / Valuasi $\to$ Ekspor Laporan Stok (`type: "STOCK"`)
2. **Sinkronisasi Parameter Filter Aktif:**
   - Ekspor data CSV secara otomatis mewarisi filter rentang tanggal yang sedang aktif (`startDate` dan `endDate` format `YYYY-MM-DD`).
   - Parameter diselaraskan dengan batas tanggal `Asia/Jakarta`.
3. **Format Berkas & Sanitasi:**
   - *Nama Berkas Standar:*
     - Penjualan: `laporan-penjualan-{startDate}_{endDate}.csv`
     - Beban Operasional: `laporan-pengeluaran-{startDate}_{endDate}.csv`
     - Stok Persediaan: `laporan-persediaan-{endDate}.csv`
   - *Mitigasi CWE-1236 (Formula Injection):* Sel teks yang diawali karakter formula (`=`, `+`, `-`, `@`, tab, carriage return) diberi prefix tanda petik tunggal (`'`). Nilai numerik moneter sah tidak disanitasi agar tetap dibaca sebagai angka oleh Microsoft Excel.
   - *Encoding:* Wajib menyertakan UTF-8 BOM (`\uFEFF`) agar Excel membuka berkas dengan karakter dan tanda pemisah koma yang benar pada Windows / regional Indonesia.
4. **Perilaku Pengunduhan Browser (Browser Download Trigger):**
   ```typescript
   // Pembuatan blob dan pemicuan unduhan lokal
   const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
   const url = URL.createObjectURL(blob);
   const link = document.createElement("a");
   link.href = url;
   link.setAttribute("download", filename);
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   URL.revokeObjectURL(url);
   ```
5. **Indikator Loading & Penanganan Error:**
   - Tombol menampilkan state `"Mengekspor..."` dengan ikon spinner selama Server Action berjalan.
   - Jika ekspor gagal (misal volume data melebihi batas 5.000 baris atau masalah jaringan), menampilkan banner alert merah tanpa mengunduh file rusak.
6. **Pencegahan Kebocoran Tenant:**
   - Server Action `exportReportCsvAction` memverifikasi `businessId` secara server-authoritative dari cookie aktif. Data bisnis lain tidak akan pernah bocor ke output CSV.

---

### 2.4 Bagian D: Arsitektur Mode Demo Terisolasi (`/demo/*`)
Menyediakan pengalaman simulasi lengkap bagi calon pengguna tanpa membutuhkan login dan **tanpa menyentuh basis data produksi**:

1. **Dataset Awal Deterministik (*"Toko Sembako Sejahtera"*):**
   - Profil Bisnis: Toko Sembako Sejahtera (Kelontong / Sembako, Jl. Surya Kencana No. 45, Bogor).
   - Katalog Produk: 15 produk sembako riil (Beras Ramos 5kg, Minyak Goreng 2L, Gula Pasir 1kg, Telur Ayam 1kg, Mie Instan Goreng, Tepung Terigu, Kopi Bubuk, Teh Celup, Susu Kental Manis, Garam Beryodium, Sabun Cuci Piring, dsb.).
   - Riwayat Pembelian Restock: 5 transaksi pembelian persediaan dengan kalkulasi MWAC.
   - Riwayat Penjualan: 25 penjualan lunas dan 2 transaksi berstatus `VOIDED` (lengkap dengan snapshot harga pokok).
   - Riwayat Pengeluaran: 8 catatan beban kas operasional (Listrik toko, Sewa kios, Kantong kresek, Gaji kasir, dsb.).
2. **Jangkauan Halaman Mode Demo:**
   - `/demo`: Gateway inisialisasi simulasi (langsung mengarahkan ke `/demo/dashboard`).
   - `/demo/dashboard`: Menampilkan 6 metrik KPI simulasi, grafik tren penjualan mingguan, transaksi terbaru, dan stok menipis.
   - `/demo/sales`: Riwayat transaksi penjualan simulasi dan modal Void interaktif.
   - `/demo/sales/new`: Antarmuka kasir cepat POS simulasi (tambah keranjang, diskon, pembayaran tunai/QRIS, mutasi stok lokal).
   - `/demo/products`: Katalog produk simulasi, pencarian, dan formulir tambah/edit stok lokal.
   - `/demo/purchases`: Pencatatan pembelian stok simulasi dengan pembaruan MWAC lokal.
   - `/demo/expenses`: Pencatatan pengeluaran operasional simulasi.
   - `/demo/reports`: Laporan finansial simulasi dan uji coba ekspor CSV simulasi.
3. **Banner Persisten Mode Demo (`DemoBanner`):**
   - Diletakkan secara persisten di bagian paling atas seluruh layar rute `/demo/*` (tinggi 40px, latar amber/kuning profesional).
   - Teks penjelas: *"Mode Demo — Menjelajahi Toko Sembako Sejahtera (Data Simulasi Lokal)"*.
   - Tombol Aksi:
     - `[Reset Data Demo]` $\to$ Mengembalikan seluruh state simulasi ke kondisi awal dalam waktu $< 500$ ms.
     - `[Daftar Akun Nyata]` $\to$ Mengarahkan pengguna ke `/register` untuk mulai mencatat usaha mereka sendiri.
4. **Analisis Komparasi Penyimpanan: In-Memory vs. LocalStorage:**

| Kriteria Evaluasi | Pendekatan A: In-Memory Murni (React State) | Pendekatan B: LocalStorage Terisolasi (Pilihan Terpilih) |
|---|---|---|
| **Isolasi Database** | **100% Terisolasi** (0 request ke server) | **100% Terisolasi** (0 request ke server) |
| **Ketahanan Saat Refresh (F5)** | State **langsung hilang/kembali ke awal** saat pengguna merefresh halaman di `/demo/sales`. Pengguna kehilangan alur pengujian. | State **bertahan stabil** saat refresh halaman atau perpindahan antar rute demo. |
| **Kecepatan Reset** | $< 5$ ms (menimpa variabel memori). | $< 20$ ms (menulis ulang key `veyra_demo_store_v1`). |
| **Risiko Pencemaran Data** | Nol risiko. | Nol risiko (key khusus terpisah: `veyra_demo_store_v1`). |
| **Penanganan Private Browsing** | Selalu berfungsi. | Memerlukan try/catch fallback ke in-memory jika localStorage diblokir. |

*Keputusan Arsitektur:* Menggunakan **Pendekatan B (LocalStorage dengan In-Memory Fallback)** ber-namespace `veyra_demo_store_v1`. Pendekatan ini memberikan pengalaman simulasi realistis tanpa risiko kehilangan state saat berpindah halaman atau me-refresh peramban.

---

## 3. Spesifikasi Kontrak UI, Server Action, Service, dan Data

### 3.1 Kontrak Pembaruan Bisnis (`updateBusinessAction`)
Sebelum membangun antarmuka `/settings`, berkas [`src/app/actions/business.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/business.ts) harus dilengkapi dengan Server Action `updateBusinessAction`:

```typescript
export interface UpdateBusinessActionInput {
  businessId?: string; // Opsional: diselesaikan server-authoritative jika kosong
  name?: string;       // 2–60 karakter
  category?: string;   // Maksimal 50 karakter
  phone?: string;      // Maksimal 20 karakter
  address?: string;    // Maksimal 255 karakter
}

export async function updateBusinessAction(
  input: UpdateBusinessActionInput
): Promise<ApiResponse<BusinessResponseData>>;
```

**Alur Validasi & Keamanan:**
1. Menyelesaikan `businessId` via `resolveEffectiveBusinessId(input.businessId)`.
2. Memvalidasi payload via `updateBusinessSchema.safeParse(...)`.
3. Memanggil service layer `businessService.updateBusiness(businessId, validatedData)`.
4. Service layer memverifikasi kepemilikan (`currentBiz.owner_id === userId`); jika bukan pemilik, mengembalikan galat `FORBIDDEN_NOT_OWNER`.
5. Mengembalikan data bisnis terbarui (`BusinessResponseData`).

---

### 3.2 Kontrak Ekspor CSV (`exportReportCsvAction`)
Kontrak yang telah terpasang di [`src/app/actions/reports.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/reports.ts#L364):

```typescript
export interface ExportReportInput {
  businessId?: string;
  type: "SALES" | "EXPENSES" | "STOCK";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface ReportCsvResult {
  filename: string;
  content: string; // Teks CSV RFC 4180 dengan UTF-8 BOM
  rowCount: number;
  mimeType: "text/csv; charset=utf-8";
}

export async function exportReportCsvAction(
  input: ExportReportInput,
  businessId?: string
): Promise<ApiResponse<ReportCsvResult>>;
```

---

### 3.3 Kontrak Adapter Mode Demo (`DemoStoreService`)
Adapter client-side mandiri yang beroperasi murni di browser:

```typescript
export interface DemoStoreState {
  business: BusinessResponseData;
  products: ProductResponseData[];
  stockMovements: StockMovementResponseData[];
  purchases: PurchaseResponseData[];
  sales: SaleResponseData[];
  expenses: ExpenseResponseData[];
  lastResetAt: string;
}

export interface IDemoStoreAdapter {
  getState(): DemoStoreState;
  resetState(): DemoStoreState;
  // Dashboard & Reports
  getDashboardSummary(): DashboardSummaryResponseData;
  getSalesReport(query?: GetSalesReportQuery): SalesReportResponseData;
  getExpenseReport(query?: GetExpenseReportQuery): ExpenseReportResponseData;
  getStockReport(): StockReportResponseData;
  exportCsv(type: "SALES" | "EXPENSES" | "STOCK"): ReportCsvResult;
  // CRUD Mutasi Simulasi
  createSale(payload: RecordSaleInput): SaleResponseData;
  voidSale(saleId: string, reason: string): SaleResponseData;
  createPurchase(payload: RecordPurchaseInput): PurchaseResponseData;
  createProduct(payload: CreateProductInput): ProductResponseData;
  updateProduct(id: string, payload: UpdateProductInput): ProductResponseData;
  createExpense(payload: RecordExpenseInput): ExpenseResponseData;
}
```

---

## 4. Kriteria Penerimaan yang Dapat Diuji (Acceptance Criteria)

### Kriteria A: Landing Page Gateway (`/`)
- [ ] Halaman `/` memuat header navigasi dengan tautan aktif ke `/login`, `/register`, dan `/demo`.
- [ ] Hero section menampilkan tagline resmi *"Run your business. Know your numbers."* dan tombol aksi utama *"Coba Mode Demo (Tanpa Akun)"*.
- [ ] Seluruh kartu fitur utama mencerminkan modul kasir POS, HPP MWAC, pengeluaran kas, dan laporan finansial riil.
- [ ] Badge teks scaffold *"Phase 4 Stage 1 Scaffold Ready"* dan tombol non-interaktif terbukti telah dihapus dari DOM.
- [ ] Tampilan responsif stabil pada layar mobile 360px dan desktop tanpa horizontal overflow.

### Kriteria B: Pengaturan Bisnis (`/settings`)
- [ ] Mengklik menu *"Pengaturan"* pada sidebar membuka halaman `/settings` tanpa galat 404.
- [ ] Menampilkan nama bisnis, kategori usaha, nomor telepon, dan alamat usaha saat ini.
- [ ] Menampilkan badge read-only untuk mata uang `IDR (Rupiah)` dan zona waktu `Asia/Jakarta (WIB)`.
- [ ] Pengguna pemilik (`owner_id`) dapat memperbarui nama, telepon, kategori, dan alamat usaha dengan validasi 2–60 karakter.
- [ ] Menampilkan pesan sukses setelah perubahan berhasil disimpan, serta validasi inline jika data tidak memenuhi syarat.
- [ ] Jika pengguna bukan pemilik bisnis, seluruh input dikunci (*disabled*) dengan peringatan izin kepemilikan.

### Kriteria C: Ekspor CSV pada `/reports`
- [ ] Terdapat tombol *"Ekspor CSV"* pada halaman laporan `/reports`.
- [ ] Menekan tombol ekspor memicu Server Action `exportReportCsvAction` dengan parameter rentang tanggal aktif.
- [ ] Mengunduh berkas `.csv` dengan nama berkas sesuai konvensi (`laporan-penjualan-...csv`, dsb.).
- [ ] Berkas CSV terbukti memuat UTF-8 BOM (`\uFEFF`) dan sanitasi formula injection pada karakter pemicu.
- [ ] Menampilkan status loading saat memproses dan penanganan pesan error jika ekspor gagal.

### Kriteria D: Mode Demo Terisolasi (`/demo/*`)
- [ ] Mengklik tautan *"Coba Dulu di Mode Demo"* pada halaman `/login` dan `/register` membuka `/demo` tanpa galat 404.
- [ ] Rute `/demo/*` menampilkan banner persisten berwarna kuning/amber di bagian atas layar: *"Mode Demo — Data Simulasi"*.
- [ ] Dataset awal memuat profil *"Toko Sembako Sejahtera"* dengan 15 produk, transaksi penjualan, pembelian, dan pengeluaran simulasi.
- [ ] Calon pengguna dapat mencoba mencatat penjualan di kasir demo (`/demo/sales/new`) dan memotong stok demo secara lokal.
- [ ] Tombol *"Reset Data Demo"* mengembalikan seluruh data simulasi ke kondisi awal dalam waktu $< 500$ ms.
- [ ] Terbukti **nol request jaringan** ke Supabase database atau Server Actions produksi saat berada di Mode Demo.
- [ ] Terdapat tombol *"Daftar Akun Nyata"* yang mengarahkan pengguna ke `/register`.

---

## 5. Ketergantungan, Risiko, dan Pekerjaan Tertunda

| Area / Komponen | Kategori Status | Deskripsi Fakta & Risiko | Rencana Mitigasi Arsitektur |
|---|:---:|---|---|
| **Server Action `updateBusinessAction`** | **Dependensi Kritis** | Service `updateBusiness` telah ada, namun Server Action di `src/app/actions/business.ts` belum diekspos. Halaman `/settings` tidak dapat menyimpan data tanpa aksi ini. | Dibuat pada Langkah awal implementasi Stage 5.7 sebelum merakit antarmuka `/settings`. |
| **Isolasi Total Mode Demo** | **Risiko Keamanan** | Risiko jika komponen demo secara tidak sengaja memanggil Server Actions produksi yang mengakses basis data live. | Komponen `/demo/*` dilarang mengimpor dari `@/app/actions/*`. Seluruh interaksi demo hanya memanggil adapter lokal `demoStoreService`. |
| **Dukungan Private Browsing** | **Risiko Fungsional** | Beberapa peramban dalam mode Incognito/Private memblokir akses ke `localStorage`. | `DemoStoreService` dilengkapi deteksi otomatis `isLocalStorageAvailable()`. Jika gagal, otomatis fallback ke in-memory store tanpa melempar runtime exception. |
| **Keterbatasan Dialog Modal A11y** | **Pekerjaan Tertunda** | Modal ekspor CSV dan modal demo reset menggunakan pola dialog yang sudah ada (initial focus & Escape listener). Cycling focus trap siklis dialokasikan ke Stage 10. | Diakui secara terbuka sebagai keterbatasan terencana untuk diaudit menyeluruh pada Tahap 10. |
| **Pengujian Browser E2E & RLS Live** | **Pekerjaan Tertunda** | Pengujian browser Playwright E2E dan pengujian penetrasi RLS live dialokasikan ke Tahap 10. | Pengujian Stage 5.7 akan memverifikasi unit test komponen dan quality gates secara ketat di lingkungan Vitest. |
| **Migrasi Database 012** | **Pekerjaan Tertunda** | Berkas `20261014000012_reject_archived_products_in_sales.sql` ada di repository; eksekusi di Supabase production ditunda. | Tidak ada migrasi basis data baru yang dibutuhkan untuk Stage 5.7. |

---

## 6. Rencana Urutan Implementasi Terkendali (Stage 5.7)

Untuk menjaga ketertiban proses dan memudahkan verifikasi audit bertahap, implementasi Stage 5.7 dibagi menjadi urutan langkah kecil:

```
[Langkah 1: Preflight Audit & Spesifikasi Detail (SELESAI)]
                           │
                           ▼
[Langkah 2: Server Action updateBusinessAction & Halaman Pengaturan /settings]
                           │
                           ▼
[Langkah 3: Integrasi Modal & Trigger Ekspor CSV pada /reports]
                           │
                           ▼
[Langkah 4: Landing Page Gateway (/) — Hero, Navigasi Publik & Dual CTA]
                           │
                           ▼
[Langkah 5: Arsitektur Store & Halaman Mode Demo Terisolasi (/demo/*)]
                           │
                           ▼
[Langkah 6: Pengujian Unit UI Komprehensif & Verifikasi 4 Quality Gates]
                           │
                           ▼
[Langkah 7: Final Integration Audit & Penutupan Stage 5.7]
```

---

## 7. Status Git Working Tree

Hasil eksekusi `git status --short`:
```
A  docs/stage-5.6-step-2-implementation-report.md
?? docs/next-stage-preflight-audit.md
?? docs/stage-5.6-final-integration-audit.md
?? docs/stage-5.6-preflight-review.md
?? docs/stage-5.6-step-1-preflight-audit.md
?? docs/stage-5.6-step-3-test-report.md
?? docs/stage-5.7-step-1-preflight-audit.md
?? src/app/expenses.test.tsx
?? src/app/expenses/page.tsx
```

*Verifikasi Batasan:* Selama pengerjaan Langkah 1 ini, **TIDAK ADA** perubahan yang dilakukan pada kode aplikasi, routing, antarmuka, Server Actions, service layer, skema basis data, berkas migrasi, dependensi npm, maupun konfigurasi lingkungan. Berkas yang dibuat murni merupakan dokumen analitis perancangan: [`docs/stage-5.7-step-1-preflight-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-5.7-step-1-preflight-audit.md).

---
*Laporan ini disusun secara komprehensif, objektif, dan terverifikasi terhadap seluruh basis kode aktual. Berhenti di sini dan menunggu peninjauan serta persetujuan resmi pengguna sebelum melangkah ke implementasi Langkah 2.*
