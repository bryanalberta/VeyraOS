# VeyraOS — Preflight Report: Phase 4, Substage 3.2.2
## Supabase Agent Skills Setup & Master Data Service Layer Preflight

**Tanggal:** 13 Oktober 2026  
**Status Preflight:** **SELESAI (PREFLIGHT AUDIT COMPLETE — READY FOR REVIEW)**  
**Cakupan:** Status Supabase MCP, Verifikasi Instalasi Supabase Agent Skills, dan Ruang Lingkup Resmi Substage 3.2.2  
**Kondisi Database Live:** **UNTOUCHED / UNMUTATED** (Tidak ada migrasi atau mutasi data yang dijalankan pada Supabase Live)

---

## 1. Status Koneksi Supabase MCP (Bagian A)

- **Status Koneksi:** **NOT CONNECTED / UNINITIALIZED**
- **Hasil Pemeriksaan Faktual:**
  1. **Ketersediaan Tool Aktif:** Di dalam sesi Antigravity aktif saat ini, tidak ditemukan tool eksternal Supabase MCP (misalnya `supabase_list_tables`, `supabase_execute_sql`, dsb.). Hanya tool bawaan IDE (`run_command`, `view_file`, `write_to_file`, `grep_search`, dll.) yang tersedia.
  2. **File Konfigurasi Proyek:** Tidak ditemukan file `mcp_config.json` pada root proyek `c:\Antigravity Project\VeyraOS` maupun pada direktori kustomisasi `.agents/`.
  3. **Akses Konfigurasi Global:** Direktori global `~/.gemini/config/` dibatasi oleh *system protection boundary rule*.
  4. **Pemeriksaan Sesuai Panduan Resmi (`mcp_servers.md`):** Berdasarkan panduan integrasi Antigravity MCP di `builtin/skills/agy-customizations/docs/mcp_servers.md`, server MCP dapat didaftarkan melalui file `mcp_config.json` menggunakan transport `stdio` (lokal) atau `SSE` (remote).
- **Kepatuhan Batasan Operasional:**
  - Konfigurasi `read_only=true` dipertahankan sebagai prasyarat wajib.
  - Tidak ada mutasi, penulisan, penghapusan, atau migrasi yang dijalankan pada database live.
- **Langkah yang Diperlukan (Bila Pengguna Menghendaki Supabase MCP Aktif):**
  Pengguna dapat mengonfigurasi Supabase MCP server secara aman melalui salah satu cara berikut:
  - **Melalui Antigravity UI:** Menu *Additional Options (...) > MCP Servers* $\to$ Add Supabase MCP Server dengan flag `read_only=true` dan token terisolasi (*scoped personal access token*).
  - **Melalui Workspace Config:** Menambahkan `mcp_config.json` di root workspace atau plugin khusus dengan parameter `read_only=true`.

---

## 2. Status Instalasi Supabase Agent Skills (Bagian B)

- **Status Instalasi:** **SUCCESSFULLY INSTALLED & VERIFIED**
- **Perintah yang Dijalankan:**
  ```bash
  npx skills add supabase/agent-skills
  ```
- **Bukti Eksekusi Terminal Aktual:**
  - CLI mendeteksi lingkungan Antigravity: `antigravity Agent detected — installing non-interactively`.
  - Sumber repositori resmi: `https://github.com/supabase/agent-skills.git`.
  - Penilaian Risiko Keamanan (Security Risk Assessments):
    - `supabase`: Safe, 0 alerts (Snyk: Med Risk).
    - `supabase-postgres-best-practices`: Safe, 0 alerts (Snyk: Low Risk).
  - Hasil instalasi: 2 skills berhasil di-copy ke direktori kustomisasi workspace `.agents\skills\`:
    1. `.\.agents\skills\supabase\` (versi 0.1.2)
    2. `.\.agents\skills\supabase-postgres-best-practices\` (versi 1.1.1)
- **Verifikasi Ketersediaan & Lokasi File:**
  - Direktori `.agents` berada di root proyek dan merupakan *Workspace Customization Root* resmi Antigravity.
  - Struktur file terverifikasi:
    - `.agents/skills/supabase/SKILL.md`: Berisi panduan autentikasi SSR, RLS, pencegahan jebakan keamanan `user_metadata` vs `app_metadata`, dan checklist keamanan database.
    - `.agents/skills/supabase-postgres-best-practices/SKILL.md` beserta direktori `references/` (32 berkas pedoman): Meliputi pengindeksan, optimasi query, koneksi pooling, pencegahan deadlock, aturan RLS, dan advisory locks.
  - Kedua file `SKILL.md` memiliki YAML frontmatter yang valid (`name: supabase`, `name: supabase-postgres-best-practices`), sehingga secara otomatis terdeteksi oleh mesin kustomisasi Antigravity.
  - Tidak ada konfigurasi atau skill lain yang ditimpa atau dihapus.

---

## 3. Ruang Lingkup Resmi Substage 3.2.2 Berdasarkan Roadmap (Bagian C)

### A. Konteks Roadmap VeyraOS:
- **Phase 4, Stage 3.0:** Integration Preflight & Targeted Critical Audit (*SELESAI*).
- **Phase 4, Stage 3.1:** Foundations (Dependensi, SSR Client, Data Contracts, CSPRNG Invoice, Rekonsiliasi Diskon Hamilton) (*SELESAI*).
- **Phase 4, Substage 3.2.1:** Transaction Service Layer Foundation (`recordSale`, `recordPurchase`, `voidSale`, `getProductsForTransaction` via RPC atomik) (*SELESAI & DIAUDIT*).
- **Phase 4, Substage 3.2.2:** **Master Data & Operational Service Layer Foundation**.

### B. Batasan Pekerjaan Resmi Substage 3.2.2:
Substage 3.2.2 melengkapi lapisan service bisnis (*Service Layer*) untuk domain di luar transaksi kasir langsung, sebelum masuk ke lapisan Server Actions (`src/app/actions/`) atau UI.

Ruang lingkup Substage 3.2.2 meliputi:
1. **Product Catalog & Master Inventory Service (`src/services/products/`):**
   - `createProduct(input)`: Validasi Zod `createProductSchema`, simpan ke tabel `products`. Jika `initialStock > 0`, otomatis membuat entri mutasi persediaan awal di tabel `stock_movements` (`movement_type = 'INITIAL'`).
   - `getProducts(params)`: Pencarian katalog produk dengan filter teks (`query`), kategori (`category`), filter stok menipis (`lowStockOnly`), dan filter arsip (`isArchived`).
   - `getProductById(id, businessId)`: Pembacaan detail produk per tenant terotorisasi.
   - `updateProduct(id, input)`: Validasi Zod `updateProductSchema`, pembaruan metadata (nama, SKU, kategori, harga jual, batas minimum stok). *Catatan Penting:* Tidak mengizinkan mutasi langsung pada `stock_quantity` atau `cost_price` melalui fungsi ini (mutasi stok fisik wajib melalui alur restock/penjualan/void atau penyesuaian teraudit).
   - `archiveProduct(id, businessId)`: Soft-delete (`is_archived = true`). Menolak hard-delete karena produk yang sudah memiliki riwayat transaksi dilindungi oleh *foreign key integrity* `RESTRICT`.
2. **Operational Expense Service (`src/services/expenses/`):**
   - `recordExpense(input)`: Validasi Zod `recordExpenseSchema`, simpan ke tabel `expenses` dengan nominal integer Rupiah positif dan kategori baku (`Sewa`, `Listrik`, `Gaji`, `Transportasi`, `Pemasaran`, `Operasional`).
   - `getExpenses(params)`: Query riwayat pengeluaran dengan filter rentang tanggal (`startDate`, `endDate`) dan filter kategori.
   - `updateExpense(id, input)`: Validasi Zod `updateExpenseSchema` dan update catatan beban operasional.
   - `deleteExpense(id, businessId)`: Penghapusan baris pengeluaran (diizinkan per `CLIENT_PERMITTED_ACTIONS` untuk beban operasional).
3. **Business Profile & Tenant Context Service (`src/services/business/`):**
   - `createBusiness(input)`: Validasi Zod `createBusinessSchema`, simpan profil bisnis baru, otomatis mendaftarkan pembuat sebagai role `OWNER` pada tabel `business_members`, serta menegakkan batasan MVP maksimal 5 bisnis per user (`BUSINESS_LIMIT_REACHED`).
   - `getMyBusinesses(userId)`: Mengambil daftar seluruh bisnis di mana pengguna aktif terdaftar sebagai anggota.
   - `getBusinessById(businessId)`: Mengambil profil bisnis spesifik per tenant.
4. **Sentralisasi Infrastruktur Otorisasi Bersama (`src/services/common/`):**
   - Mengekstrak fungsi `verifyUserAndBusinessMembership` dari `transaction.service.ts` ke helper terpadu `src/services/common/auth-guard.ts` agar dapat digunakan ulang secara konsisten di seluruh service tanpa duplikasi logika.

### C. Batasan Tegas (Apa yang DILARANG pada Substage 3.2.2):
- **DILARANG** membuat antarmuka pengguna (UI/komponen React).
- **DILARANG** membuat Next.js Server Actions (`src/app/actions/`).
- **DILARANG** membuat adapter offline Demo Mode pada tahap ini.
- **DILARANG** menjalankan migrasi `000010` atau `000011` pada Supabase Live.
- **DILARANG** memutasi database Supabase Live.

---

## 4. File Serta Kontrak yang Relevan

### A. Kontrak yang Sudah Tersedia dan Dapat Digunakan Ulang:
- **Tipe Data & Response Envelopes:**
  - `ApiResponse<T>` di [`src/types/api.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/types/api.ts).
  - `ProductItemResponse`, `CreateProductInput`, `UpdateProductInput`.
  - `ExpenseItemResponse`, `RecordExpenseInput`, `UpdateExpenseInput`.
  - `BusinessResponseData`, `CreateBusinessInput`.
- **Skema Validasi Zod:**
  - `createProductSchema`, `updateProductSchema` di [`src/lib/validations/product.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/product.ts).
  - `recordExpenseSchema`, `updateExpenseSchema` di [`src/lib/validations/expense.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/expense.ts).
  - `createBusinessSchema` di [`src/lib/validations/business.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/business.ts).
  - `uuidSchema`, `rupiahSchema`, `quantitySchema` di [`src/lib/validations/common.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/common.ts).
- **Otorisasi & Keamanan:**
  - `CLIENT_PERMITTED_ACTIONS`, `isUserBusinessMember` di [`src/lib/security.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/security.ts).
- **Error Mapping:**
  - `mapDatabaseErrorToApiResponse`, `formatZodErrorDetails` di [`src/services/transactions/error-mapper.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/services/transactions/error-mapper.ts).

### B. File yang Diperkirakan Akan Dibuat atau Diubah:
1. `src/services/common/auth-guard.ts` (Dibuat — shared authorization helper)
2. `src/services/common/error-mapper.ts` (Refactor/move dari `transactions/error-mapper.ts`)
3. `src/services/products/product.service.ts` (Dibuat)
4. `src/services/products/product.service.test.ts` (Dibuat)
5. `src/services/products/index.ts` (Dibuat)
6. `src/services/expenses/expense.service.ts` (Dibuat)
7. `src/services/expenses/expense.service.test.ts` (Dibuat)
8. `src/services/expenses/index.ts` (Dibuat)
9. `src/services/business/business.service.ts` (Dibuat)
10. `src/services/business/business.service.test.ts` (Dibuat)
11. `src/services/business/index.ts` (Dibuat)
12. `src/services/transactions/transaction.service.ts` (Diperbarui — mengimpor shared auth-guard & error-mapper)
13. `src/services/index.ts` (Diperbarui — barrel export terintegrasi)

---

## 5. Risiko Teknis & Dependensi

| No | Risiko / Dependensi | Dampak | Strategi Mitigasi pada Substage 3.2.2 |
|---|---|---|---|
| 1 | **Atomisitas Stok Awal Produk** | Saat `createProduct` dengan `initialStock > 0`, jika insert `stock_movements` gagal, terjadi diskrepansi ledger stok. | Urutan operasi teratur: buat produk terlebih dahulu, jika gagal rollback/cleanup; catat mutasi stok `INITIAL` dengan referensi ID produk baru. |
| 2 | **Pencegahan Hard Delete Produk** | Penghapusan fisik produk yang pernah ditransaksikan akan gagal pada DB akibat foreign key `RESTRICT` di `sale_items`. | `product.service` tidak mengekspos hard delete. Hanya mengekspos `archiveProduct` yang menyetel `is_archived = true`. |
| 3 | **Batasan Bisnis per Akun (MVP Max 5)** | Pengguna yang melakukan submit ganda secara paralel berpotensi membuat lebih dari 5 bisnis. | Hitung `COUNT(*) FROM business_members WHERE user_id = auth.uid() AND role = 'OWNER'` di server sebelum insert, dan tolak dengan `BUSINESS_LIMIT_REACHED`. |
| 4 | **Pemisahan Pengeluaran vs Stok** | Pengguna keliru memasukkan restock persediaan sebagai biaya operasional pada tabel `expenses`. | Validasi kategori baku pada Zod schema dan isolasi tabel `expenses` dari alur mutasi barang dagangan. |
| 5 | **Isolasi Multi-Tenant Ganda** | Service menerima parameter `businessId` dari input klien. | Tetap menerapkan *Defense-in-Depth*: query selalu memfilter `WHERE business_id = $1` DAN memvalidasi keanggotaan pengguna via `business_members` di server, serta mengandalkan RLS di database. |

---

## 6. Rencana Implementasi Bertahap untuk Substage 3.2.2

Setelah preflight ini disetujui, Substage 3.2.2 akan diimplementasikan dalam urutan modul yang terisolasi:

```
[Langkah 1: Sentralisasi Helper]
  Extract shared auth-guard & error-mapper ke src/services/common/
       │
       ▼
[Langkah 2: Product & Inventory Service]
  Implementasi src/services/products/ & unit test komprehensif (Mock Supabase)
       │
       ▼
[Langkah 3: Operational Expense Service]
  Implementasi src/services/expenses/ & unit test komprehensif
       │
       ▼
[Langkah 4: Business Management Service]
  Implementasi src/services/business/ & unit test batas 5 bisnis
       │
       ▼
[Langkah 5: Integrasi & Quality Gate]
  Barrel export src/services/index.ts, jalankan test, type-check, lint, build
```

---

## 7. Quality Gate yang Wajib Lulus

Sebelum Substage 3.2.2 dinyatakan selesai, seluruh 4 quality gate berikut harus berstatus **PASS (Exit code 0)**:
1. `npm run test`: Seluruh 145 unit test lama harus tetap lulus, ditambah seluruh unit test baru untuk produk, pengeluaran, dan bisnis.
2. `npm run type-check`: `tsc --noEmit` lolos tanpa kesalahan tipe data (0 errors).
3. `npm run lint`: `eslint` lolos tanpa error dan tanpa warning (0 problems).
4. `npm run build`: Kompilasi Next.js Turbopack sukses tanpa kendala SSR prerendering.

---

## 8. Pengujian yang Belum Dapat Dilakukan

Untuk menjaga transparansi teknis, berikut batasan pengujian yang secara sadar **belum dapat dijalankan**:
1. **Pengujian Kernel Database Supabase Live:** Tidak dijalankan karena kebijakan integritas (database live tidak diubah/dimutasi sebelum seluruh service dan Server Actions siap teruji secara lokal).
2. **Pengujian Konkurensi PostgreSQL Multi-Koneksi:** Belum dapat dijalankan tanpa instance database PostgreSQL lokal terisolasi (misalnya via Docker container lokal).
3. **Pengujian End-to-End Antarmuka (Playwright):** Belum dapat dijalankan karena halaman UI dan Server Actions belum dibangun.

---

## 9. Rekomendasi & Langkah Selanjutnya

Preflight Substage 3.2.2 telah selesai tanpa melakukan mutasi pada database atau kode aplikasi.  
**Sesuai batasan instruksi, eksekusi dihentikan di sini untuk menunggu tinjauan dan persetujuan eksplisit Anda sebelum implementasi Substage 3.2.2 dimulai.**
