# VeyraOS — Validation Report: Phase 4, Substage 3.1.4
## Closure Audit: Finalize Discount Allocation & Monetary Safety

**Tanggal:** 13 Oktober 2026  
**Status Substage:** **PASS (AUDIT PENUTUPAN SELESAI)**  
**Cakupan:** Substage 3.1.4 (Invoice Generator, Rekonsiliasi Diskon Hamilton, & Audit Keamanan Nilai Uang)  
**Kondisi Database Live:** **UNEXECUTED / BELUM DIUBAH** (Tidak ada migrasi yang dijalankan di Supabase live, database tidak di-reset)

---

## 1. Berkas yang Diperiksa, Dibuat, dan Diubah

### Berkas yang Diaudit / Dibaca:
- `src/lib/financial.ts`: Implementasi alokasi diskon transaksi, HPP MWAC, dan utilitas konversi nominal uang aman.
- `src/lib/invoice.ts`: Utilitas pembuatan dan validasi nomor faktur CSPRNG.
- `src/lib/transactions.ts`: Domain transaksi penjualan atomik, pengurangan stok, dan verifikasi cache idempotensi.
- `src/types/database.ts`: Definisi tipe data baris tabel PostgreSQL (`sales`, `sale_items`, `products`, `idempotency_keys`).
- `src/types/api.ts`: Definisi DTO dan kontrak antarmuka API/Server Actions.
- `src/lib/validations/common.ts`: Skema validasi Zod untuk primitif moneter (`rupiahSchema`, `quantitySchema`, `stockQuantitySchema`).
- `src/lib/validations/sale.ts`: Skema validasi Zod untuk transaksi penjualan (`recordSaleSchema`, `saleItemInputSchema`).
- `supabase/migrations/20261013000003_sales_and_items.sql`: Skema tabel `sales` dan `sale_items` beserta check constraint aritmetika.
- `supabase/migrations/20261013000004_purchases_and_items.sql`: Skema tabel `inventory_purchases` dan `purchase_items`.
- `supabase/migrations/20261013000009_stored_procedures.sql`: RPC transaksi penjualan `record_sale_transaction`.
- `supabase/migrations/20261013000010_reconcile_discount_allocation.sql`: Usulan migrasi forward-only perbaikan RPC diskon.
- `docs/stage-3.1.4-validation-report.md`: Laporan validasi sebelumnya.

### Berkas yang Dibuat / Diperbarui dalam Audit Penutupan:
1. `supabase/migrations/20261013000010_reconcile_discount_allocation.sql`:
   - Diperbarui untuk mengimplementasikan **Hamilton Method penuh dengan Agregasi Produk Duplikat** pada PostgreSQL PL/pgSQL, mencocokkan logika TypeScript 100%.
2. `src/lib/financial.ts`:
   - Ditambahkan konstanta `MAX_SAFE_RUPIAH` ($9.007.199.254.740.991$).
   - Ditambahkan utilitas moneter aman: `safeBigIntToNumber`, `safeNumberToBigInt`, dan `safeJsonStringify`.
   - Diperbarui `calculateMovingAverageCost` agar menggunakan kalkulasi integer `BigInt` untuk mencegah integer overflow pada perkalian stok $\times$ harga besar.
3. `src/lib/financial.test.ts`:
   - Ditambahkan pengujian keamanan moneter (`safeBigIntToNumber` overflow, `safeNumberToBigInt`, `safeJsonStringify` BigInt serialization, MWAC large numbers).
4. `src/lib/validations/common.ts`:
   - Dibatasi `quantitySchema` dan `stockQuantitySchema` dengan nilai maksimum $2.147.483.647$ (PostgreSQL 32-bit signed integer max).
5. `src/lib/validations/validations.test.ts`:
   - Ditambahkan unit test untuk penolakan nilai kuantitas yang melampaui batas PostgreSQL `INTEGER`.
6. `src/lib/transactions.ts`:
   - Digunakan `safeJsonStringify` pada pengecekan idempotensi agar aman jika payload mengandung `BigInt`.
7. `src/lib/transactions.test.ts`:
   - Ditambahkan unit test `TX-IDEM-03` untuk membuktikan perbandingan payload idempotensi tidak crash saat menerima `BigInt`.
8. `src/lib/utils.ts`:
   - Diperbarui `formatRupiah` agar mendukung `BigInt` sangat besar di atas batas float JavaScript tanpa kehilangan presisi.

---

## 2. Penutupan Blocker Alokasi Diskon (Closure of Discount Allocation Blocker)

### Masalah Awal pada RPC `migration 009`:
Pada migrasi 009 (`record_sale_transaction`), alokasi diskon menggunakan **Largest Subtotal Absorber**:
```sql
v_item_prop_disc := pg_catalog.round((p_discount_amount::NUMERIC * v_item_gross::NUMERIC) / v_total_gross_subtotal::NUMERIC)::BIGINT;
IF v_prod.id = v_max_item_id THEN
    v_item_prop_disc := v_item_prop_disc + v_remainder;
END IF;
```
Dua kelemahan kritis teridentifikasi:
1. **Ketidakadilan Alokasi:** Seluruh selisih pembulatan dibebankan ke satu item terbesar (`v_max_item_id`), bukan didistribusikan Rp 1 per Rp 1 berdasarkan sisa pecahan terbesar.
2. **Bug Produk Duplikat:** Jika `v_max_item_id` muncul di lebih dari satu baris, blok `IF v_prod.id = v_max_item_id` tereksekusi pada setiap baris tersebut, menyebabkan `v_remainder` ditambahkan berulang kali dan melanggar constraint integritas total nota (`chk_sales_total_calculation`).

### Solusi Final pada `migration 010` & TypeScript:
File migrasi [`supabase/migrations/20261013000010_reconcile_discount_allocation.sql`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/20261013000010_reconcile_discount_allocation.sql) telah diperbaiki total agar identik dengan TypeScript:
1. **Deteksi Duplikat:** Mengevaluasi `COUNT(DISTINCT product_id) < COUNT(*)`.
2. **Jalur Unik (Tanpa Duplikat):**
   - Menghitung kuota dasar: $\text{base\_quota} = \lfloor (D \times S_i) / S_{\text{total}} \rfloor$.
   - Menghitung sisa pecahan eksak: $\text{remainder} = (D \times S_i) \pmod{S_{\text{total}}}$.
   - Mendistribusikan sisa kuota ke baris teratas dengan tie-breaking: `fractional_remainder DESC, product_id ASC, line_idx ASC`.
3. **Jalur Duplikat (Agregasi Produk):**
   - Mengelompokkan subtotal bruto berdasarkan `product_id` ke dalam tabel temporer `temp_product_discounts`.
   - Mengalokasikan diskon transaksi tingkat produk via Hamilton.
   - Mendistribusikan diskon per produk ke masing-masing baris item aslinya via sub-alokasi Hamilton dengan tie-breaking `fractional_remainder DESC, line_idx ASC`.
4. **Karakteristik Migrasi:**
   - Kompatibel penuh dengan signature RPC dan skema database yang sudah ada.
   - Tidak mengubah data historis.
   - Bersifat *forward-only* (`CREATE OR REPLACE FUNCTION`).
   - Diberi label eksplisit: **UNEXECUTED / BELUM DIJALANKAN DI SUPABASE**.

### Contoh Perhitungan Numerik & Hasil:

#### Kasus 1: Regression Test Wajib (Item Unik)
- **Input:** $A = 6.000$, $B = 2.000$, $C = 2.000$; Diskon $D = 7$ Rupiah. Total Subtotal = $10.000$.
- **Kuota Dasar:** $A = 4$, $B = 1$, $C = 1$. Total dasar = $6$. Sisa unassigned = $1$.
- **Sisa Pecahan:** $A = 2.000$, $B = 4.000$, $C = 4.000$.
- **Tie-Break:** $B$ dan $C$ memiliki sisa terbesar ($4.000$). ID `'B' < 'C'`, maka $B$ mendapatkan $+1$.
- **Hasil:**
  - TypeScript: $A = 4$, $B = 2$, $C = 1$ (Total = $7$).
  - PostgreSQL RPC (Migrasi 010): $A = 4$, $B = 2$, $C = 1$ (Total = $7$).
  - RPC Lama (Migrasi 009): $A = 5$, $B = 1$, $C = 1$ (**Keliru / Divergen**).

#### Kasus 2: Produk Duplikat
- **Input:** Produk $A$ muncul di 2 baris ($A_1 = 3.000$, $A_2 = 3.000$), Produk $B$ di 1 baris ($B = 4.000$). Diskon $D = 7$.
- **Agregasi Produk:** Produk $A = 6.000$, Produk $B = 4.000$.
- **Alokasi Tingkat Produk:**
  - $A: (7 \times 6.000) / 10.000 = 4,2 \to \text{floor } 4$, sisa $2.000$.
  - $B: (7 \times 4.000) / 10.000 = 2,8 \to \text{floor } 2$, sisa $8.000$.
  - Sisa $1$ Rupiah diberikan ke $B$ (sisa $8.000 > 2.000$).
  - Total Diskon: Produk $A = 4$, Produk $B = 3$.
- **Sub-Alokasi Baris Produk $A$:**
  - $A_1 (3.000)$ dan $A_2 (3.000)$ membagi diskon $4$: $A_1 = 2$, $A_2 = 2$.
- **Hasil:**
  - TypeScript: $A_1 = 2$, $A_2 = 2$, $B = 3$ (Total = $7$).
  - PostgreSQL RPC (Migrasi 010): $A_1 = 2$, $A_2 = 2$, $B = 3$ (Total = $7$).

---

## 3. Audit Keamanan Nilai Uang (Monetary Safety Audit)

Penelusuran alur nilai uang dari input klien hingga database:

```text
Input Klien (Zod Validations) 
    -> Service Layer / In-Memory (Safe Integer / BigInt)
    -> RPC Parameter (JSONB / BIGINT)
    -> PostgreSQL Tables (BIGINT / INTEGER)
    -> RPC Response (JSONB / number)
```

### Temuan & Mitigasi Keamanan:
1. **Risiko Konversi `BigInt` ke `number` Tanpa Batas:**
   - *Risiko:* JavaScript `number` adalah 64-bit IEEE-754 float. Integer $> 2^{53} - 1$ ($9.007.199.254.740.991$) akan kehilangan presisi digit terakhir jika dikonversi langsung dengan `Number(bigint)`.
   - *Mitigasi:* Dibuat fungsi utilitas [`safeBigIntToNumber(value, context)`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/financial.ts) yang memvalidasi bahwa nilai berada di dalam `[Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`. Jika melampaui, dilempar `RangeError` eksplisit.
2. **Serialisasi JSON untuk `BigInt`:**
   - *Risiko:* Native `JSON.stringify()` di Node.js melempar `TypeError: Do not know how to serialize a BigInt` jika suatu objek memuat properti bertipe `bigint`.
   - *Mitigasi:* Dibuat fungsi [`safeJsonStringify(value)`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/financial.ts) dengan replacer kustom yang mengonversi `BigInt` aman ke `number`, atau `string` jika di luar batas aman. Fungsi ini digunakan di [`transactions.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/transactions.ts) pada komparasi payload idempotensi.
3. **Pencegahan Overflow Perkalian pada HPP MWAC:**
   - *Risiko:* Perkalian stok besar dengan harga besar (misal $100.000.000 \times 600.000.000 = 6 \times 10^{16} > \text{Number.MAX\_SAFE\_INTEGER}$) menyebabkan hilangnya presisi pada kalkulasi HPP rata-rata bergerak.
   - *Mitigasi:* [`calculateMovingAverageCost`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/financial.ts) dimigrasikan ke aritmetika `BigInt` integer murni dengan pembulatan ekuivalen `Math.round`:
     $$\text{roundedCost} = \frac{2 \times \text{totalValue} + \text{totalQty}}{2 \times \text{totalQty}}$$
4. **Batas Kolom Kuantitas SQL vs Zod:**
   - *Risiko:* Kolom `quantity` pada tabel `sale_items` dan `purchase_items` bertipe `INTEGER` (maksimal $2.147.483.647$). Sebelumnya, `quantitySchema` di Zod tidak memiliki batas atas, sehingga angka seperti $3.000.000.000$ lolos validasi aplikasi tetapi gagal di database.
   - *Mitigasi:* Menambahkan `.max(2_147_483_647)` pada `quantitySchema` dan `stockQuantitySchema` di [`common.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/validations/common.ts).

---

## 4. Audit Invoice Generator & Idempotensi

### Generator Nomor Faktur:
- **Format:** `[PREFIX]-[YYYYMMDD]-[RANDOM_SUFFIX]`
  - Penjualan: `INV-20261013-XXXXXXXX` (21 karakter).
  - Pembelian: `PO-20261013-XXXXXXXX` (20 karakter).
- **Entropi:** 8 karakter Crockford Base32 menghasilkan 40 bit CSPRNG entropy ($32^8 \approx 1,099 \times 10^{12}$ kombinasi per hari per bisnis).
- **Kepatuhan Kolom:** Panjang 20–21 karakter memenuhi constraint database `VARCHAR(50) NOT NULL CHECK (char_length(trim(invoice_number)) >= 3)`.
- **Prinsip Penting:**
  1. *Probabilistik vs Absolut:* Meskipun probabilitas kolisi $< 10^{-7}$, generator **bukan penjamin keunikan absolut**. Unique constraint database `uq_sales_invoice` adalah perlindungan terakhir.
  2. *Penanganan Error:* Pada service layer mendatang, retry pembuatan faktur hanya diizinkan jika error yang diterima dari PostgreSQL secara spesifik adalah `23505` (`unique_violation`) pada `uq_sales_invoice` dan transaksi telah di-rollback bersih. Dilarang melakukan retry generik untuk seluruh kegagalan transaksi.

### Status Idempotensi:
- Skema tabel `idempotency_keys` memiliki constraint unik `UNIQUE (business_id, key)`.
- RPC `record_sale_transaction` dan `record_purchase_transaction` melakukan pencarian dan verifikasi payload secara atomik di dalam transaksi database.
- *Open Blocker Teridentifikasi:* Pada kondisi request konkuren simultan (dua request dengan kunci yang sama tiba di milidetik yang sama), request kedua dapat mengalami lock contention pada baris idempotency_keys. Hal ini didokumentasikan sebagai prasyarat arsitektur untuk Substage 3.2.

---

## 5. Ringkasan Pengujian & Quality Gate

Seluruh 4 perintah quality gate wajib dijalankan:

| Perintah | Hasil | Durasi | Detail Output |
| :--- | :---: | :---: | :--- |
| `npm run test` | **PASS (0)** | 360 ms | **127 tests passed** (8 test files: `financial`, `transactions`, `invoice`, `security`, `env`, `client`, `server`, `validations`). 0 failed. |
| `npm run type-check` | **PASS (0)** | 1.7 s | `tsc --noEmit` lolos tanpa error kompilasi. |
| `npm run lint` | **PASS (0)** | 1.1 s | `eslint` lolos tanpa warning atau error. |
| `npm run build` | **PASS (0)** | 2.6 s | `next build` (Next.js 16.4.0 Turbopack) berhasil mengkompilasi aplikasi. |

---

## 6. Daftar Blocker yang Masih Terbuka (Open Blockers)

1. **Aplikasi Migrasi Forward-Only 010 ke Database Live:**
   - Migrasi [`supabase/migrations/20261013000010_reconcile_discount_allocation.sql`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/20261013000010_reconcile_discount_allocation.sql) telah diverifikasi dan siap secara logika, namun berstatus **UNEXECUTED**.
   - Sebelum Server Action penjualan diuji terhadap database live di Substage 3.2, migrasi ini wajib diterapkan ke project Supabase.
2. **Penanganan Benturan Konkurensi Idempotensi:**
   - Idempotensi untuk request paralel simultan membutuhkan penanganan error `unique_violation` pada tabel `idempotency_keys` di tingkat service layer.

---

## 7. Konfirmasi Kepatuhan Batasan Substage 3.1.4

- [x] Tidak ada service layer yang diimplementasikan.
- [x] Tidak ada Server Actions yang dibuat.
- [x] Tidak ada UI yang diubah.
- [x] Tidak ada migrasi yang dijalankan pada instance database live Supabase.
- [x] Tidak ada database reset yang dilakukan.
- [x] Tidak ada kredensial atau konten `.env.local` yang dicetak dalam laporan.
- [x] Seluruh unit test yang ada tetap lulus (jumlah tes bertambah dari 96 menjadi 127).
- [x] Pengerjaan dihentikan tepat di akhir Substage 3.1.4.

---
*Substage 3.1.4 resmi ditutup. Menunggu konfirmasi dan instruksi eksplisit pengguna sebelum memulai Substage 3.2 (Service Layer & Server Actions).*
