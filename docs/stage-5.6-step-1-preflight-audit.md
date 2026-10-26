# VeyraOS — Stage 5.6, Langkah 1: Preflight Audit & Desain Kontrak UI Pengeluaran

**Tanggal Audit:** 15 Oktober 2026  
**Peran Auditor:** Principal Software Architect, Senior Full-Stack Engineer, Financial Domain Reviewer, QA Engineer  
**Status Tahap:** LANGKAH 1 SELESAI (DESAIN KONTRAK & PREFLIGHT AUDITED — SIAP MENUJU LANGKAH 2)  
**Modul Target:** UI Pencatatan Pengeluaran Operasional (`/expenses`)  
**Branch / Workspace:** `master` (`c:\Antigravity Project\VeyraOS`)  

---

## 1. Executive Summary & Tujuan

Berdasarkan otorisasi resmi pengguna, **Stage 5.6** ditetapkan untuk mengimplementasikan **Antarmuka Pencatatan Pengeluaran Operasional (`/expenses`)**, yang merekonsiliasi modul **Tahap 7 Roadmap Master** yang sebelumnya terlewati saat pengerjaan modul Dashboard dan Laporan Finansial (Stage 5.5).

Tujuan dari **Langkah 1 (Preflight Audit & Desain Kontrak)** ini adalah:
1. Memeriksa secara mendalam seluruh berkas backend aktual, skema validasi Zod, Server Actions, service layer, skema database PostgreSQL, dan kebijakan RLS terkait pengeluaran operasional.
2. Memverifikasi kontrak API aktual untuk operasi baca, tulis, filter, dan hapus/arsip catatan beban.
3. Mengidentifikasi seluruh temuan kritis, jebakan format data (*gotchas*), dan batasan arsitektur sebelum sebaris pun kode UI diimplementasikan.
4. Merancang arsitektur antarmuka pengguna `/expenses`, kontrak state komponen, alur interaksi, pola filter draft vs applied, penanganan state (loading, error, empty), kepatuhan aksesibilitas (WCAG 2.2 AA), dan format fixtures mock pengujian.
5. Menyusun daftar kriteria penerimaan (*Acceptance Criteria*) serta matriks skenario pengujian komprehensif untuk Langkah 2 dan Langkah 3.

---

## 2. Berkas Aktual yang Diperiksa

Audit ini memeriksa berkas-berkas kode aktual berikut secara langsung di workspace:

| Kategori | Berkas Sumber Aktual | Peran & Lingkup Pemeriksaan |
|---|---|---|
| **Server Actions** | [`src/app/actions/expenses.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/expenses.ts) | Memeriksa 5 fungsi aksi server: `recordExpenseAction`, `getExpensesAction`, `getExpenseByIdAction`, `updateExpenseAction`, `deleteExpenseAction`, resolusi tenant cookie, fail-closed mechanism, dan error codes. |
| **Service Layer** | [`src/services/expenses/expense.service.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/services/expenses/expense.service.ts) | Logika manipulasi basis data Supabase, autentikasi sesi, verifikasi keanggotaan bisnis, query SQL, dan penolakan `DESTRUCTIVE_DELETION_FORBIDDEN`. |
| **Skema Validasi** | [`src/lib/validations/expense.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/expense.ts) | Skema Zod `recordExpenseSchema`, `updateExpenseSchema`, `getExpensesQuerySchema`, `expenseCategorySchema`, dan `isoDateStringSchema`. |
| **Validasi Umum** | [`src/lib/validations/common.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/common.ts) | Validasi moneter `rupiahPositiveSchema` (integer IDR $\ge 1$) dan `uuidSchema`. |
| **Kontrak Tipe Data** | [`src/types/api.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/types/api.ts) & [`src/types/database.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/types/database.ts) | Definisi tipe `RecordExpenseInput`, `ExpenseResponseData`, `GetExpensesQuery`, `UpdateExpenseInput`, serta enum `ExpenseCategory`. |
| **Skema Database** | [`supabase/migrations/20261013000006_expenses.sql`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/20261013000006_expenses.sql) | Definisi tabel `public.expenses`, constraint `CHECK (amount > 0)`, kolom `notes`, dan indeks komposit. |
| **Kebijakan Keamanan** | [`supabase/migrations/20261013000008_rls_and_security.sql`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/20261013000008_rls_and_security.sql) | Kebijakan Row Level Security (RLS) `expenses_select_member`, `expenses_insert_member`, `expenses_update_member`, `expenses_delete_member`. |
| **Pengujian Backend** | [`src/app/actions/expenses.test.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/expenses.test.ts) | 23 pengujian unit Server Actions yang memverifikasi isolasi tenant, fail-closed handling, validasi Zod, dan penolakan hard-delete. |
| **Utilitas Finansial** | [`src/lib/financial.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/financial.ts) | Fungsi zona waktu `formatJakartaDate`, `parseJakartaDateBoundary`, dan konstanta batas aman moneter. |
| **Referensi UI Sejenis** | [`src/app/reports/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/reports/page.tsx) & [`src/app/sales/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/sales/page.tsx) | Referensi pola kamus label kategori bahasa Indonesia, dialog modal accessible, format IDR, dan layout navigasi. |
| **Navigasi Sidebar** | [`src/components/layout/sidebar.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/components/layout/sidebar.tsx) | Tautan sidebar aktif `{ label: "Pengeluaran", href: "/expenses", icon: ArrowDownCircle }`. |

---

## 3. Verifikasi Kontrak Backend Aktual

Pemeriksaan kode memverifikasi kontrak fungsional berikut:

### 3.1 Kontrak Pencatatan Pengeluaran (`recordExpenseAction`)
- **Fungsi:** `recordExpenseAction(input: RecordExpenseActionInput): Promise<ApiResponse<ExpenseResponseData>>`
- **Tipe Input:**
  ```typescript
  export interface RecordExpenseActionInput {
    businessId?: string;       // Opsional: diselesaikan otomatis via cookie preferensi aktif
    category: ExpenseCategory; // Wajib: salah satu dari 8 kategori baku
    amount: number;            // Wajib: integer IDR > 0 (rupiahPositiveSchema)
    description: string;       // Wajib: string 2 - 500 karakter (setelah di-trim)
    expenseDate?: string;      // Opsional: string ISO 8601 lengkap (datetime)
  }
  ```
- **Kategori Baku (`ExpenseCategory`):**
  1. `OPERATIONAL` $\rightarrow$ "Operasional Umum"
  2. `SALARY` $\rightarrow$ "Gaji & Upah"
  3. `UTILITIES` $\rightarrow$ "Listrik, Air & Internet"
  4. `RENT` $\rightarrow$ "Sewa Tempat"
  5. `MARKETING` $\rightarrow$ "Pemasaran & Iklan"
  6. `MAINTENANCE` $\rightarrow$ "Perbaikan & Pemeliharaan"
  7. `SUPPLIES` $\rightarrow$ "Perlengkapan Toko"
  8. `OTHER` $\rightarrow$ "Lain-lain"
- **Validasi Server-Side (Zod):**
  - `amount`: Wajib integer positif $\ge 1$ dan $\le$ `Number.MAX_SAFE_INTEGER`. Jika desimal atau $\le 0$, ditolak dengan `VALIDATION_ERROR`.
  - `description`: Wajib minimal 2 karakter dan maksimal 500 karakter setelah `.trim()`.
  - `expenseDate`: Jika dikirimkan, wajib memenuhi format ISO 8601 Datetime lengkap (Zod `.datetime()`). Jika tidak dikirimkan, server otomatis menggunakan `new Date().toISOString()`.
- **Keluaran Sukses (`ExpenseResponseData`):**
  ```typescript
  {
    id: string;          // UUID
    businessId: string;  // UUID bisnis aktif
    category: ExpenseCategory;
    amount: number;      // Integer Rupiah
    description: string; // Mapped dari kolom SQL notes
    expenseDate: string; // ISO 8601 datetime
    createdAt: string;
    updatedAt: string;
  }
  ```

### 3.2 Kontrak Pembacaan & Penyaringan Riwayat (`getExpensesAction`)
- **Fungsi:** `getExpensesAction(params?: GetExpensesActionParams): Promise<ApiResponse<ExpenseResponseData[]>>`
- **Parameter Kueri:**
  ```typescript
  export interface GetExpensesActionParams {
    businessId?: string;       // Opsional (server-authoritative)
    startDate?: string;        // Opsional: ISO date string (YYYY-MM-DD atau full ISO)
    endDate?: string;          // Opsional: ISO date string (YYYY-MM-DD atau full ISO)
    category?: ExpenseCategory;// Opsional: salah satu dari 8 kategori
  }
  ```
- **Perilaku Kueri & Pengurutan:**
  - Query mengurutkan data berdasarkan `expense_date DESC` secara otomatis (`idx_expenses_business_date`).
  - Aturan validasi: `startDate <= endDate`. Jika terbalik, Zod menolak dengan error `"Tanggal mulai (startDate) tidak boleh lebih besar dari tanggal akhir (endDate)"`.
  - Mengembalikan array `ExpenseResponseData[]` kosong (`[]`) jika tidak ada catatan yang sesuai filter.

### 3.3 Kontrak Pembaruan Catatan (`updateExpenseAction`)
- **Fungsi:** `updateExpenseAction(idOrInput, inputOrBusinessId): Promise<ApiResponse<ExpenseResponseData>>`
- **Cakupan Pembaruan:** Memperbarui `category`, `amount`, `description`, atau `expenseDate`.
- **Peran di UI MVP:** Tersedia di backend untuk perbaikan administratif bila diperlukan di masa mendatang.

### 3.4 Kontrak Penolakan Penghapusan Destruktif (`deleteExpenseAction`)
- **Fungsi:** `deleteExpenseAction(id: string, businessId?: string): Promise<ApiResponse<ExpenseResponseData>>`
- **Perilaku Aktual Kode:**
  Baik di service layer ([`expense.service.ts:465-473`](file:///c:/Antigravity%20Project/VeyraOS/src/services/expenses/expense.service.ts#L465-L473)) maupun Server Action ([`expenses.ts:444-477`](file:///c:/Antigravity%20Project/VeyraOS/src/app/actions/expenses.ts#L444-L477)), pemanggilan fungsi ini **selalu mengembalikan error penolakan**:
  ```json
  {
    "success": false,
    "error": {
      "code": "DESTRUCTIVE_DELETION_FORBIDDEN",
      "message": "Penghapusan destruktif terhadap catatan pengeluaran historis tidak diizinkan demi menjaga integritas laporan finansial. Gunakan pembaruan catatan melalui updateExpense jika diperlukan koreksi administratif."
    }
  }
  ```
- **Prinsip Arsitektur:** Catatan beban operasional bersifat *append-only* untuk menjamin jejak audit pembukuan kas UMKM.

---

## 4. Temuan Kritis, Gotchas, dan Risiko Teknis

Audit menemukan lima temuan teknis yang wajib dimitigasi saat implementasi antarmuka pengguna:

### Temuan 1: Format Tanggal Input Form HTML vs Skema Validasi Zod
- **Masalah:** Elemen formulir `<input type="date">` pada browser menghasilkan string tanggal kalender murni: `"YYYY-MM-DD"` (misal: `"2026-10-15"`). Namun, skema Zod `recordExpenseSchema` menggunakan:
  ```typescript
  expenseDate: z.string().datetime({ message: "Format tanggal pengeluaran harus ISO 8601" }).optional()
  ```
  Zod `.datetime()` secara default **menolak format tanggal tanpa waktu** (`"YYYY-MM-DD"`) dan melempar `VALIDATION_ERROR`.
- **Mitigasi di UI:**
  Saat pengguna memilih tanggal pada input form (misalnya `"2026-10-15"`), UI **wajib mengonversinya menjadi string ISO 8601 lengkap** sebelum memanggil `recordExpenseAction`, misalnya:
  ```typescript
  const isoExpenseDate = selectedDate
    ? new Date(`${selectedDate}T12:00:00+07:00`).toISOString()
    : new Date().toISOString();
  ```
  Dengan demikian, payload selalu berupa format datetime yang valid dan berada dalam tanggal kalender yang benar di zona waktu `Asia/Jakarta`.

### Temuan 2: Batas Validasi Deskripsi (Wajib Min. 2 Karakter)
- **Masalah:** Pada PRD Bab 4.6 tercantum kalimat deskriptif *"deskripsi opsional"*. Namun pada kontrak teknis backend (`recordExpenseSchema`), field `description` secara tegas diatur:
  ```typescript
  description: z.string().trim().min(2, "Deskripsi pengeluaran minimal 2 karakter").max(500, "Deskripsi pengeluaran maksimal 500 karakter")
  ```
- **Mitigasi di UI:**
  Formulir UI wajib menandai input Keterangan/Deskripsi sebagai **wajib diisi (min. 2 karakter)** dengan teks bantuan yang jelas. Validasi sisi klien harus mencegah submit form jika input kurang dari 2 karakter agar pengguna tidak menerima error validasi yang membingungkan dari backend.

### Temuan 3: Larangan Menampilkan Tombol Hapus Semu
- **Masalah:** Karena backend secara konsisten menolak penghapusan destruktif (`DESTRUCTIVE_DELETION_FORBIDDEN`), menyediakan tombol "Hapus" pada tabel riwayat yang memicu aksi penghapusan akan merusak pengalaman pengguna (UX) karena aksi tersebut pasti gagal.
- **Mitigasi di UI:**
  Tabel riwayat pengeluaran **tidak menyediakan tombol hapus fisik destruktif**. Sebagai gantinya, pada kolom aksi/status disediakan indikator badge informatif:
  $$\text{Badge: } \text{"Pencatatan Permanen" (Jejak Audit Buku Kas)}$$
  Langkah ini memperjelas kepada pemilik UMKM bahwa sistem VeyraOS melindungi integritas buku kas toko dari manipulasi atau penghapusan catatan historis yang tidak sengaja.

### Temuan 4: Pemetaan Kolom SQL `notes` $\leftrightarrow$ API DTO `description`
- **Masalah:** Di basis data PostgreSQL, kolom bernama `notes`. Di DTO API Server Actions, field bernama `description`.
- **Mitigasi di UI:**
  Service layer dan Server Actions telah menangani pemetaan dua arah ini dengan sempurna. Antarmuka pengguna wajib konsisten menggunakan field `description` sesuai kontrak tipe `RecordExpenseActionInput` dan `ExpenseResponseData`.

### Temuan 5: Peringatan Edukatif Anti-Pencatatan Ganda HPP (Anti-Double Count)
- **Masalah:** Kesalahan paling umum bagi pelaku UMKM adalah mencatat pembelian stok barang dagangan (kulakan) ke dalam menu pengeluaran operasional. Jika ini terjadi, biaya stok akan terhitung ganda: sekali saat dicatat sebagai beban operasional, dan sekali lagi saat barang terjual sebagai HPP.
- **Mitigasi di UI:**
  Di dalam modal formulir pencatatan pengeluaran, ditempatkan kotak peringatan visual berwarna amber/kuning dengan teks tegas:
  > **Peringatan Penting:** Pembelian barang dagangan/stok toko dicatat melalui menu **Pembelian Stok**, bukan di sini, agar Harga Pokok Penjualan (HPP) tidak terhitung ganda.

---

## 5. Rancangan Arsitektur UI & Alur Interaksi `/expenses`

### 5.1 Tata Letak Halaman (`src/app/expenses/page.tsx`)
Halaman menggunakan pembungkus standar `AppLayout` (menampilkan TopBar, Sidebar, dan konteks tenant aktif):

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppLayout: TopBar (Konteks Bisnis Aktif) & Sidebar Navigasi            │
├────────────────────────────────────────────────────────────────────────┤
│ Header:                                                                │
│  [Ikon] Buku Pengeluaran Operasional        [+ Catat Pengeluaran]      │
│  Kelola dan pantau seluruh beban kas non-persediaan usaha Anda.        │
├────────────────────────────────────────────────────────────────────────┤
│ 3 Kartu Ringkasan Beban (Sesuai Filter Aktif):                         │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │
│  │ Total Pengeluaran  │ │ Jumlah Transaksi   │ │ Beban Terbesar     │  │
│  │ Rp 1.450.000       │ │ 8 Catatan          │ │ Sewa Tempat (45%)  │  │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ Kartu Filter (Pola Draft vs Applied):                                  │
│  [Dari Tanggal: date] [Sampai Tanggal: date] [Kategori: select]        │
│  [Terapkan Filter (Primary)]  [Reset Filter (Outline)]                 │
├────────────────────────────────────────────────────────────────────────┤
│ Tabel Riwayat Pengeluaran:                                             │
│  ┌────────────┬─────────────────────────┬───────────────┬────────────┐ │
│  │ Tgl / Waktu│ Kategori (Badge Semantik│ Keterangan    │ Nominal IDR│ │
│  ├────────────┼─────────────────────────┼───────────────┼────────────┤ │
│  │ 15 Okt 2026│ [Listrik, Air] (Kuning) │ Token PLN toko│ Rp 250.000 │ │
│  │ 14 Okt 2026│ [Gaji & Upah] (Biru)    │ Gaji staf kasir│Rp 1.000.000│ │
│  └────────────┴─────────────────────────┴───────────────┴────────────┘ │
│  Status: Dilengkapi indikator transparansi audit: Pencatatan Permanen  │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Alur Interaksi Modal "Catat Pengeluaran"
1. Pengguna mengklik tombol `[+ Catat Pengeluaran]`.
2. Dialog modal muncul dengan fokus otomatis ke input pertama, latar belakang buram (*backdrop blur*), dan dukungan penutupan dengan tombol `Escape` atau tombol `Batal`.
3. Komponen formulir:
   - **Tanggal Pengeluaran:** Default ke tanggal hari ini dalam format lokal `YYYY-MM-DD` (`Asia/Jakarta`).
   - **Kategori Biaya:** Dropdown dengan 8 pilihan bahasa Indonesia (default: `OPERATIONAL` - "Operasional Umum").
   - **Nominal Pengeluaran:** Input nominal Rupiah dengan prefix `Rp` dan helper format (misal: "Rp 150.000"). Memvalidasi bahwa angka adalah integer positif $> 0$.
   - **Keterangan / Deskripsi:** Input teks (wajib, 2 - 500 karakter) dengan indikator counter karakter real-time.
   - **Banner Peringatan:** Kotak informasi anti-pencatatan-stok.
4. Saat tombol `[Simpan Pengeluaran]` diklik:
   - Form memvalidasi input di sisi klien. Jika ada error, pesan error merah tampil tepat di bawah input terkait.
   - Tombol berubah menjadi state loading (`Menyimpan...`) dan dinonaktifkan untuk mencegah klik ganda (*double-submit*).
   - Memanggil `recordExpenseAction` dengan tanggal yang telah dikonversi ke ISO 8601 string.
   - Jika berhasil: modal tertutup otomatis, notifikasi banner sukses hijau tampil singkat, dan daftar riwayat pengeluaran dimuat ulang (*refreshed*).
   - Jika gagal: pesan error spesifik dari backend tampil di dalam modal tanpa menutup form.

### 5.3 Filter Draft versus Applied
Untuk menghindari query berulang yang membebani server saat pengguna sedang memilih tanggal:
- State input filter disimpan dalam variabel *draft* (`draftStartDate`, `draftEndDate`, `draftCategory`).
- Permintaan data baru ke `getExpensesAction` hanya dikirimkan saat pengguna menekan tombol **"Terapkan Filter"** atau **"Reset"**.
- Validasi inline: Jika `draftStartDate > draftEndDate`, tombol "Terapkan Filter" otomatis dinonaktifkan dan muncul pesan peringatan merah: *"Tanggal mulai tidak boleh lebih besar dari tanggal akhir."*

### 5.4 Penanganan State (Loading, Empty, Error)
- **Loading State:** Menampilkan shimmer skeleton pada 3 kartu ringkasan KPI dan tabel riwayat (menggunakan komponen atomik `Skeleton`).
- **Empty State:** Jika tidak ada data pengeluaran (baik secara keseluruhan maupun akibat filter), menampilkan komponen `EmptyState` dengan ikon dompet/biaya, pesan ramah: *"Belum ada catatan pengeluaran pada rentang tanggal ini"*, dan tombol pemicu `[+ Catat Pengeluaran]`.
- **Error State:** Jika panggilan server gagal, menampilkan banner `Alert` varian destruktif dengan pesan kesalahan yang jelas dan tombol **[Coba Lagi]** (*Retry*).

### 5.5 Aksesibilitas (WCAG 2.2 AA)
- Seluruh input form dan select memiliki elemen `<label>` yang terhubung melalui atribut `htmlFor` dan `id`.
- Modal formulir menggunakan semantik ARIA lengkap: `role="dialog"`, `aria-modal="true"`, dan `aria-labelledby`.
- Target sentuh tombol dan kontrol input memenuhi standar minimal 44px pada layar ponsel.
- Rasio kontras warna teks terhadap latar belakang memenuhi ambang batas minimal $4.5:1$.

---

## 6. Rencana Pengujian dan Acceptance Criteria

### 6.1 Matriks Skenario Pengujian Unit (`src/app/expenses.test.tsx`)
Suite pengujian unit akan disusun mencakup minimal **20 skenario uji komprehensif**:

| No | Grup Pengujian | Skenario Uji yang Dicakup |
|---|---|---|
| **1** | **Inisialisasi & Rendering** | 1.1 Render header modul dan konteks bisnis aktif server-authoritative.<br>1.2 Render 3 kartu ringkasan KPI beban dengan perhitungan nominal dan persentase yang tepat.<br>1.3 Render tabel riwayat pengeluaran dengan format Rupiah IDR dan badge kategori semantik.<br>1.4 Menampilkan empty state informatif jika belum ada data pengeluaran. |
| **2** | **Alur Modal Catat Pengeluaran** | 2.1 Membuka modal dialog saat tombol `[+ Catat Pengeluaran]` diklik.<br>2.2 Menutup modal saat tombol Batal diklik atau tombol `Escape` ditekan.<br>2.3 Menampilkan kotak peringatan edukatif anti-pencatatan-stok di dalam modal. |
| **3** | **Validasi Formulir di Klien** | 3.1 Menolak submit jika nominal kosong atau $\le 0$ dengan pesan validasi.<br>3.2 Menolak submit jika deskripsi kurang dari 2 karakter.<br>3.3 Mencegah klik ganda (*double-submit*) dengan menonaktifkan tombol saat proses pengiriman. |
| **4** | **Integrasi Server Action** | 4.1 Memanggil `recordExpenseAction` dengan parameter payload yang valid dan tanggal terkonversi ISO 8601.<br>4.2 Memuat ulang daftar data dan memperbarui ringkasan total setelah catatan berhasil disimpan.<br>4.3 Menampilkan pesan error di dalam modal jika `recordExpenseAction` mengembalikan kegagalan. |
| **5** | **Penyaringan Riwayat (Filter)** | 5.1 Menahan query filter dalam draft state sampai tombol "Terapkan Filter" diklik.<br>5.2 Menyaring data berdasarkan kategori terpilih.<br>5.3 Menonaktifkan tombol submit filter dan menampilkan pesan error jika tanggal mulai > tanggal akhir.<br>5.4 Mengembalikan filter ke kondisi default saat tombol "Reset" diklik. |
| **6** | **Integritas Jejak Audit & Error** | 6.1 Memastikan tabel tidak menyediakan tombol hapus fisik destruktif dan memuat penanda catatan permanen.<br>6.2 Menampilkan error banner dengan tombol *Retry* saat pemanggilan data awal gagal. |

### 6.2 Kriteria Penerimaan (Acceptance Criteria) Langkah 2 & 3
1. **Fungsionalitas Lengkap:** Pengguna dapat mencatat beban baru, melihat riwayat transaksi, dan menyaring berdasarkan kategori dan tanggal.
2. **Integritas Moneter:** Nominal diformat tanpa desimal dalam Rupiah IDR (`formatRupiah`), dan kalkulasi total ringkasan akurat $100\%$.
3. **Pencegahan Error Datetime:** Nilai tanggal selalu dikonversi ke ISO 8601 sebelum dikirimkan ke server, mencegah kegagalan Zod `.datetime()`.
4. **Perlindungan Audit:** Tidak ada tombol hapus destruktif; status catatan permanen ditegaskan secara visual.
5. **Quality Gates Terpenuhi:**
   - Seluruh tes di `src/app/expenses.test.tsx` lulus 100%.
   - Seluruh 31 file tes regresi sebelumnya tetap lulus 100% (total $\ge 683$ tests).
   - `npm run type-check` lulus tanpa error (code 0).
   - `npm run lint` lulus tanpa warning/error (code 0).
   - `npm run build` sukses menghasilkan rute statis/PPR `/expenses` (code 0).

---

## 7. Mock Fixtures untuk Pengujian Unit

Berikut adalah dataset tiruan (*mock fixtures*) terstandarisasi yang akan digunakan pada `src/app/expenses.test.tsx`:

```typescript
export const mockBusinessContext = {
  id: "biz-1111-uuid",
  name: "Warung Berkah Jaya",
  category: "Kelontong / Sembako",
};

export const mockExpensesList: ExpenseResponseData[] = [
  {
    id: "exp-001",
    businessId: "biz-1111-uuid",
    category: "RENT",
    amount: 1500000,
    description: "Sewa kios ruko bulan Oktober",
    expenseDate: "2026-10-01T08:00:00.000Z",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  },
  {
    id: "exp-002",
    businessId: "biz-1111-uuid",
    category: "UTILITIES",
    amount: 250000,
    description: "Token listrik PLN & tagihan air PAM",
    expenseDate: "2026-10-05T10:30:00.000Z",
    createdAt: "2026-10-05T10:30:00.000Z",
    updatedAt: "2026-10-05T10:30:00.000Z",
  },
  {
    id: "exp-003",
    businessId: "biz-1111-uuid",
    category: "SUPPLIES",
    amount: 85000,
    description: "Kantong kresek ramah lingkungan & lakban",
    expenseDate: "2026-10-10T14:15:00.000Z",
    createdAt: "2026-10-10T14:15:00.000Z",
    updatedAt: "2026-10-10T14:15:00.000Z",
  },
];
```

---

## 8. Keputusan yang Memerlukan Persetujuan

Sebelum melangkah ke **Langkah 2 (Implementasi UI)**, mohon konfirmasi atas keputusan desain berikut:

1. **Penegasan Input Deskripsi Wajib (Min. 2 Karakter):**
   - *Rekomendasi:* Karena skema backend Zod `recordExpenseSchema` mewajibkan deskripsi minimal 2 karakter, form modal UI akan menandai input Keterangan dengan label **"Keterangan / Keperluan (Wajib, min. 2 karakter)"** dan memvalidasinya sebelum pengiriman.
2. **Ketiadaan Tombol Hapus Fisik di UI:**
   - *Rekomendasi:* Menghilangkan tombol aksi hapus fisik pada baris riwayat dan menggantikannya dengan penanda badge *"Pencatatan Permanen (Jejak Audit Buku Kas)"*, selaras dengan kontrak `DESTRUCTIVE_DELETION_FORBIDDEN` di `deleteExpenseAction`.
3. **Format Modal Pop-up Terpusat:**
   - *Rekomendasi:* Menggunakan pola modal pop-up dialog terpusat (seperti `VoidModal` pada `/sales`) dengan transisi backdrop halus, fokus trap, dan keyboard escape, yang terbukti konsisten dan lulus seluruh pengujian aksesibilitas.

---

## 9. Status Git dan Kepatuhan Batasan

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
- **Kode Aplikasi Tidak Disentuh:** Direktori `src/app/expenses/` belum dibuat. Tidak ada file kode yang diubah.
- **Basis Data Tidak Disentuh:** Tidak ada migration SQL atau modifikasi Supabase.
- **Dependensi Utuh:** Tidak ada paket npm baru yang dipasang.
- **Kredensial Aman:** Berkas `.env` tidak disentuh.
- **Git Bersih:** Tidak ada git commit baru yang dibuat.
- **Implementasi Langkah 2 Belum Dimulai:** Pekerjaan terhenti tepat pada Langkah 1 sesuai instruksi.

---

## 10. Rekomendasi Langkah Selanjutnya

1. Menunggu tinjauan dan persetujuan pengguna atas laporan preflight ini dan tiga poin keputusan desain pada Bagian 8.
2. Setelah disetujui, melanjutkan ke **Stage 5.6 Langkah 2: Implementasi Antarmuka Pengguna `src/app/expenses/page.tsx`**.
