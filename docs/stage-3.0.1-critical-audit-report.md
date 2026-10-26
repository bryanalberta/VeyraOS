# VeyraOS — Phase 4 Stage 3.0.1: Targeted Critical Audit Report

**Fase:** Phase 4, Stage 3.0.1: Targeted Critical Audit  
**Status Audit:** SELESAI (Completed — Ready with Conditions)  
**Peran:** Lead Database Architect, Financial Systems Reviewer & Security Engineer  
**DBMS Target:** PostgreSQL 15+ (Supabase)  
**Framework:** Next.js 16.4.0 (App Router), React 19.3.0, TypeScript Strict Mode  
**Status Runtime Basis Data:** **UNVERIFIED / NOT RUN (Inspeksi Statis Baris-demi-Baris SQL & Kode Sumber — Nol Koneksi Database Live)**  

---

## 1. Executive Summary

Audit kritis lanjutan (Stage 3.0.1) ini melakukan penelusuran mendalam terhadap 5 area krusial sebelum implementasi integrasi aplikasi (Stage 3.1):
1. **Audit A:** Idempotency & concurrency guarantees pada migrasi 007 dan 009.
2. **Audit B:** Konsistensi perhitungan matematis penjualan, diskon, Largest Remainder, dan batasan BIGINT.
3. **Audit C:** Keamanan PL/pgSQL RPC (`SECURITY DEFINER`, `search_path`, otorisasi peran, manipulasi parameter).
4. **Audit D:** Karakteristik dan constraint nomor faktur (`invoice_number`).
5. **Audit E:** Kesiapan package, environment, dan arsitektur Next.js 16.

### Ringkasan Keputusan:
**KEPUTUSAN: READY WITH CONDITIONS**  
Fondasi 9 file migrasi SQL telah memenuhi integritas relasional multi-tenant dan atomisitas ACID. Namun, audit menemukan 2 temuan kritikal (P0) terkait penanganan konseptual konkurensi idempotensi dan algoritma alokasi diskon transaksi yang wajib dipahami dan ditangani di Server Action / Service Layer pada Stage 3.1.

---

## 2. Matriks Temuan Audit Kritis (Findings Matrix)

| ID Temuan | Severity | Area Audit | File & Lokasi Terkait | Ringkasan Masalah | Rekomendasi Solusi Stage 3.1 |
|---|:---:|---|---|---|---|
| **AUDIT-B-01** | **P0** | Alokasi Diskon | `supabase/migrations/20261013000009_stored_procedures.sql` (L174-179, 197-202, 231-237) & `src/lib/financial.ts` (L66-103) | **Penyimpangan Algoritma Largest Remainder:** Sisa pembulatan diskon dibebankan secara *lump-sum* ke item dengan subtotal kotor terbesar (*Largest Subtotal Absorber*), bukan dibagikan ke item dengan pecahan desimal sisa terbesar (*Largest Fractional Remainder*). Selain itu, jika array item memuat `product_id` duplikat, sisa pembulatan terduplikasi. | 1. Server Action wajib mengonsolidasikan/mengagregasi item kasir per `productId` sebelum panggil RPC.<br>2. Terima varian *Largest Subtotal Absorber* sebagai aturan bisnis pragmatis VeyraOS atau sesuaikan rumus. |
| **AUDIT-A-01** | **P0** | Idempotensi & Concurrency | `supabase/migrations/20261013000009_stored_procedures.sql` (L282-288) & `supabase/migrations/20261013000007_idempotency_keys.sql` (L16) | **Unhandled Unique Constraint Collision pada Request Simultan:** Dua request serentak dengan kunci sama lolos race condition ke database. Request kedua abort pada `uq_idempotency_key` (Postgres error 23505) tanpa handler internal di RPC, menyebabkan error 500 ke kasir. | Server Action wajib menangkap error Postgres `23505 (uq_idempotency_key)`, melakukan kueri pembacaan balik ke `idempotency_keys`, dan mengembalikan response payload tersimpan tanpa melempar error ke UI. |
| **AUDIT-B-02** | **P1** | Semantik Diskon | `supabase/migrations/20261013000003_sales_and_items.sql` (L13-26, 47-53) & Migrasi 009 (L170-171, 214-215, 242-243) | **Ambiguitas Semantik Subtotal & Diskon:** `sales.discount_amount` hanya mencatat diskon transaksi global, sedangkan `sale_items.discount_amount` mencatat akumulasi diskon item + diskon transaksi teralokasi. Jumlah `sale_items.subtotal_amount` sama dengan `sales.total_amount`, bukan `sales.subtotal_amount`. | Dokumentasikan definisi ini secara tegas di DTO Service Layer agar modul pelaporan keuangan tidak salah menjumlahkan diskon nota. |
| **AUDIT-C-01** | **P1** | Otorisasi Hak Void | `supabase/migrations/20261013000009_stored_procedures.sql` (L541-543) & `supabase/migrations/20261013000001_extensions_and_core.sql` (L64) | **Ketiadaan Validasi Peran OWNER/MANAGER di Database RPC Void:** RPC `void_sale_transaction` hanya memeriksa `is_business_member()`. Saat ini aman karena skema MVP membatasi role hanya `OWNER`. Namun jika peran staf/kasir ditambah di masa depan, database tidak membatasi void tanpa Layer 2 TypeScript. | Pastikan Server Action Next.js di Stage 3.1 selalu menjalankan validasi peran Layer 2 sebelum mengeksekusi RPC pembatalan. |
| **AUDIT-D-01** | **P1** | Penomoran Faktur | `supabase/migrations/20261013000003_sales_and_items.sql` (L22) & `docs/api-contracts.md` (L108) | **Risiko Tabrakan Nomor Faktur & Ketiadaan Retry:** `uq_sales_invoice` bersifat unik per bisnis `(business_id, invoice_number)`. Klien kasir tidak mengirim nomor nota. Generator acak pendek berisiko tabrakan (*birthday paradox*) yang menyebabkan transaksi kasir gagal. | Gunakan generator nomor faktur berbasis kombinasi waktu berpresisi tinggi + entropi acak di `src/lib/invoice.ts`, disertai *retry loop* (maks. 3 kali) di Server Action jika terkena `uq_sales_invoice`. |
| **AUDIT-A-02** | **P2** | Binding Idempotency | `supabase/migrations/20261013000009_stored_procedures.sql` (L108-120) | **`user_id` Tidak Divalidasi saat Pengambilan Kunci:** Kolom `user_id` disimpan di tabel `idempotency_keys` saat INSERT, namun saat SELECT pembacaan ulang kunci, variabel `v_idem_user` tidak dibandingkan dengan `auth.uid()`. | Idempotency key berlaku tenant-wide per bisnis (`business_id, key`). Ini aman untuk MVP toko tunggal, namun perlu dicatat sebagai batasan arsitektural. |
| **AUDIT-E-01** | **P2** | Dependensi SDK | `package.json` (L13-20) | **SDK Supabase Belum Terinstal:** Package `@supabase/supabase-js` dan `@supabase/ssr` belum ada di repositori. | Jalankan `npm install @supabase/supabase-js @supabase/ssr` di awal Stage 3.1 setelah persetujuan pengguna. |
| **AUDIT-ENV** | **UNVERIFIED** | Validasi Database | Environment Lokal | **Nol Bukti Eksekusi Runtime PostgreSQL:** Tidak tersedia binary `psql`, `supabase`, maupun daemon Docker lokal. | Ditandai **UNVERIFIED / NOT RUN**. Validasi runtime aktual ditunda sampai staging instance Supabase terhubung. |

---

## 3. Bedah Rinci Sesuai Area Audit

### 3.1 Audit A — Idempotency dan Concurrency

#### 1. Cakupan Unique Constraint yang Sebenarnya
- **Kode:** [`supabase/migrations/20261013000007_idempotency_keys.sql`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/20261013000007_idempotency_keys.sql) baris 16:
  ```sql
  CONSTRAINT uq_idempotency_key UNIQUE (business_id, key)
  ```
- **Analisis:** Cakupan keunikan adalah komposit `(business_id, key)`. Unik per tenant bisnis. Kolom `user_id` yang ditambahkan pada migrasi 009 tidak dimasukkan ke dalam constraint unik ini.

#### 2. Request Identik dengan Key yang Sama
- **Kode:** [`supabase/migrations/20261013000009_stored_procedures.sql`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/20261013000009_stored_procedures.sql) baris 113–121:
  ```sql
  IF FOUND THEN
      IF v_idem_action <> 'RECORD_SALE' THEN
          RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION';
      END IF;
      IF v_idem_req IS DISTINCT FROM v_req_payload THEN
          RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
      END IF;
      RETURN v_idem_resp;
  END IF;
  ```
- **Analisis:** Jika record ditemukan dengan `action_type` dan `request_payload` identik, fungsi langsung mengembalikan `v_idem_resp` tanpa melakukan penguncian baris produk, tanpa memotong stok, dan tanpa membuat baris penjualan baru. Tidak ada transaksi ganda yang tercipta.

#### 3. Key Sama dengan Payload Berbeda Ditolak Eksplisit
- **Kode:** Migrasi 009 baris 117–119, 379–381, dan 574–576.
- **Analisis:** Pengujian `IF v_idem_req IS DISTINCT FROM v_req_payload` secara tegas melempar exception `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.

#### 4. Dua Request Simultan (Concurrency Race Condition)
- **Alur Eksekusi Database Aktual:**
  1. Dua request kasir (Req-1 dan Req-2) tiba di milidetik yang sama dengan `p_idempotency_key = "K1"`.
  2. Pada langkah 3 (Idempotency Check), kedua request membaca `idempotency_keys` dengan isolasi *Read Committed*. Karena belum ada yang commit, keduanya membaca `NOT FOUND`.
  3. Pada langkah 4 (Penguncian Produk):
     ```sql
     PERFORM id FROM public.products ... ORDER BY id ASC FOR UPDATE;
     ```
     Req-1 memperoleh row lock. Req-2 tertahan (blocked) menunggu lock produk dilepas.
  4. Req-1 menyelesaikan insert `sales`, `sale_items`, `stock_movements`, update stok produk, dan melakukan:
     ```sql
     INSERT INTO public.idempotency_keys (business_id, key, ...) VALUES (p_business_id, 'K1', ...);
     ```
  5. Req-1 commit dan selesai sukses.
  6. Req-2 unblock dan melanjutkan prosesnya. Req-2 melakukan kalkulasi, lalu saat mengeksekusi `INSERT INTO public.idempotency_keys`, Req-2 membentur constraint `uq_idempotency_key UNIQUE (business_id, key)`.
  7. **Hasil:** Transaksi Req-2 di-*abort* dan di-*rollback* total oleh PostgreSQL. Tidak ada mutasi stok atau nota ganda.

#### 5. Keamanan Pembacaan Hasil saat Unique Constraint Conflict
- **Temuan Kritis (AUDIT-A-01):**
  Karena `INSERT INTO public.idempotency_keys` pada baris 283–288 tidak dibungkus dalam blok penanganan `EXCEPTION WHEN unique_violation THEN ...`, kegagalan constraint unik pada Req-2 menyebabkan PostgreSQL melempar kode error SQLSTATE `23505`.
  PostgREST / Supabase client akan meneruskan error `23505` ini ke pemanggil sebagai error eksepsional, bukan mengembalikan receipt milik Req-1.
- **Dampak:** Kasir akan melihat notifikasi error 500 / kegagalan transaksi, meskipun transaksi sebenarnya sudah sukses dicatat oleh Req-1.
- **Solusi Wajib di Server Action:** Server Action harus membungkus pemanggilan RPC dalam try-catch: jika tertangkap error code `23505` pada `uq_idempotency_key`, lakukan kueri `SELECT response_payload FROM idempotency_keys WHERE business_id = ... AND key = ...` dan kembalikan hasil tersebut ke UI.

#### 6. Binding Hasil Idempotency
- Hasil terikat pada:
  - `business_id`: Diverifikasi di klausa `WHERE`.
  - `action_type`: Diverifikasi di `v_idem_action <> 'RECORD_SALE'`.
  - `key`: Diverifikasi di klausa `WHERE`.
  - `request_payload`: Diverifikasi via `IS DISTINCT FROM`.
  - `user_id`: Disimpan saat insert (`auth.uid()`), namun **tidak diverifikasi** saat retrieval (kunci bersifat tenant-scoped).

#### 7. Kegagalan Transaksi Tidak Meninggalkan Orphan Idempotency Record
- **Analisis:** `INSERT INTO idempotency_keys` dieksekusi pada langkah terakhir (langkah 10 pada `record_sale_transaction`). Jika terjadi validasi gagal, stok kurang, atau error sistem di langkah 1–9, seluruh transaksi PostgreSQL otomatis dibatalkan (*rollback* atomik). Tidak ada record idempotensi palsu yang tersisa di database.

---

### 3.2 Audit B — Perhitungan Penjualan dan Diskon

#### 1. Konsistensi Definisi Subtotal, Diskon, dan Total
- **Pada `sale_items`:**
  - `unit_selling_price`: Harga jual produk per unit.
  - Gross Line = `quantity * unit_selling_price`.
  - `discount_amount`: Akumulasi diskon per-item ditambah diskon transaksi proporsional.
  - `subtotal_amount` (pada item): Nilai bersih setelah diskon line = `Gross Line - discount_amount`.
  - Terkunci oleh constraint: `chk_sale_items_subtotal CHECK (subtotal_amount = (quantity::BIGINT * unit_selling_price) - discount_amount)`.
- **Pada `sales` (Header):**
  - `subtotal_amount` (pada header): Total nilai kotor semua item setelah dikurangi diskon per-item, namun **sebelum** diskon transaksi global.
  - `discount_amount` (pada header): Hanya nilai diskon transaksi global (`p_discount_amount`).
  - `total_amount`: `subtotal_amount - discount_amount`.
  - Terkunci oleh constraint: `chk_sales_total_calculation CHECK (total_amount = subtotal_amount - discount_amount)`.
- **Konsistensi Hubungan Agregasi:**
  $$\sum \text{sale\_items.subtotal\_amount} = \text{sales.total\_amount}$$
  Jumlah nilai subtotal seluruh baris item persis sama dengan **total nota akhir**.

#### 2. Diskon Per Item dan Diskon Transaksi
- Tidak ada penghitungan ganda (*double count*). Diskon per-item dikurangkan di Pass 1 untuk menghasilkan basis alokasi diskon transaksi, kemudian diskon transaksi proporsional dialokasikan di Pass 2 & 3.

#### 3. Evaluasi Algoritma Alokasi Diskon (Temuan AUDIT-B-01)
- **Metode Standar Hamilton (Largest Remainder):**
  1. Kuota ideal $= (D \times \text{subtotal}_i) / \text{total\_subtotal}$.
  2. Bagian integer $= \lfloor \text{kuota}_i \rfloor$.
  3. Bagian pecahan sisa $= \text{kuota}_i - \lfloor \text{kuota}_i \rfloor$.
  4. Hitung sisa unallocated $R = D - \sum \lfloor \text{kuota}_i \rfloor$.
  5. Bagikan $+1$ unit ke item-item yang memiliki **bagian pecahan sisa terbesar** sampai $R$ habis.
- **Implementasi Aktual pada SQL & TypeScript:**
  1. Kode menghitung alokasi dengan pembulatan: `v_item_prop_disc := round((D * gross_i) / total_gross)`.
  2. Menghitung selisih pembulatan: `v_remainder := D - sum(v_item_prop_disc)`.
  3. Seluruh selisih `v_remainder` dibebankan secara *lump-sum* ke item dengan **subtotal kotor terbesar** (`v_max_item_id`).
- **Contoh Angka Konkret:**
  - Item A: Gross Rp 6.000 (Subtotal terbesar)
  - Item B: Gross Rp 2.000
  - Item C: Gross Rp 2.000
  - Total Gross: Rp 10.000. Diskon Transaksi: Rp 7.
  - **Kuota Matematis:**
    - A: $7 \times 6000 / 10000 = 4.2$ (Pecahan: 0.2)
    - B: $7 \times 2000 / 10000 = 1.4$ (Pecahan: 0.4)
    - C: $7 \times 2000 / 10000 = 1.4$ (Pecahan: 0.4)
  - **Baku Hamilton (True Largest Remainder):** Pecahan terbesar adalah B (0.4) dan C (0.4). Sisa 1 rupiah diberikan ke B.
    - Hasil: A = 4, B = 2, C = 1 (Total = 7).
  - **Aktual SQL & `financial.ts` (Largest Subtotal Absorber):**
    - A: `round(4.2)` = 4
    - B: `round(1.4)` = 1
    - C: `round(1.4)` = 1
    - Sum = 6. Selisih `v_remainder` = $7 - 6 = 1$.
    - Item terbesar adalah A (Rp 6.000). Sisa 1 rupiah diberikan ke A.
    - Hasil: A = 5, B = 1, C = 1 (Total = 7).
- **Kesimpulan Teknis:**
  Kalkulasi saat ini menjamin **total diskon teralokasi persis sama tanpa selisih Rp 1 pun** (konservatif finansial terpenuhi), namun secara terminologi akademis algoritma ini adalah *Largest Subtotal Absorber*, bukan *True Largest Fractional Remainder*.
- **Risiko Tambahan:** Pada SQL baris 235: `IF v_prod.id = v_max_item_id THEN v_item_prop_disc := v_item_prop_disc + v_remainder; END IF;`. Jika input `p_items` mengandung ID produk yang sama dua kali (misal kasir scan produk A dua kali secara terpisah), `v_remainder` akan ditambahkan ke kedua baris tersebut. Oleh karena itu, Server Action **wajib mengagregasikan item dengan product_id yang sama** sebelum memanggil RPC.

#### 4. Penanganan Nilai Negatif, Kuantitas Nol, dan Batasan BIGINT
- `p_discount_amount < 0`: Ditolak eksplisit (`INVALID_DISCOUNT`).
- `p_discount_amount > v_total_gross_subtotal`: Ditolak eksplisit (`INVALID_DISCOUNT`).
- `v_qty <= 0`: Ditolak eksplisit (`INVALID_QUANTITY`).
- `v_item_discount > item_gross`: Ditolak eksplisit (`INVALID_DISCOUNT`).
- Total penjualan Rp 0: Sah secara skema (`CHECK (total_amount >= 0)`).
- Penanganan Overflow: Perhitungan proporsi menggunakan casting eksplisit `::NUMERIC` (`(p_discount_amount::NUMERIC * v_item_gross::NUMERIC) / v_total_gross_subtotal::NUMERIC`), mencegah integer overflow 64-bit pada perkalian nominal besar.

---

### 3.3 Audit C — RPC, Keamanan, dan Hak Akses

#### 1. Kesesuaian Tanda Tangan SQL Aktual
- `record_sale_transaction(p_business_id UUID, p_invoice_number TEXT, p_payment_method TEXT, p_discount_amount BIGINT, p_notes TEXT, p_items JSONB, p_idempotency_key TEXT)`
- `record_purchase_transaction(p_business_id UUID, p_invoice_number TEXT, p_supplier_name TEXT, p_notes TEXT, p_items JSONB, p_idempotency_key TEXT)`
- `void_sale_transaction(p_business_id UUID, p_sale_id UUID, p_void_reason TEXT, p_idempotency_key TEXT)`
- Seluruh tipe data parameter dan kembalian `JSONB` cocok dengan rancangan Service Layer.

#### 2. Schema Qualification & Keamanan Search Path
- Ketiga fungsi menggunakan klausul wajib:
  ```sql
  SECURITY DEFINER
  SET search_path = ''
  ```
- Seluruh tabel dikualifikasi dengan skema: `public.products`, `public.sales`, `public.sale_items`, `public.inventory_purchases`, `public.purchase_items`, `public.stock_movements`, `public.idempotency_keys`, `public.business_members`.
- Seluruh fungsi pendukung dikualifikasi: `public.is_business_member()`.
- Fungsi built-in sistem menggunakan skema `pg_catalog.` (seperti `pg_catalog.round`, `pg_catalog.trim`, `pg_catalog.char_length`). Fungsi manipulasi jsonb (`jsonb_array_elements`, `jsonb_typeof`, `jsonb_build_object`) aman karena skema sistem selalu diprioritaskan oleh PostgreSQL engine saat pencarian fungsi dasar.

#### 3. Hak Eksekusi (Least-Privilege Grants)
- Hak eksekusi pada ketiga RPC dicabut eksplisit dari publik dan anonim, dan hanya diberikan kepada pengguna terautentikasi:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.record_sale_transaction(...) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.record_sale_transaction(...) TO authenticated, service_role;
  ```

#### 4. Otorisasi Keanggotaan Bisnis Internal
- Ketiga fungsi mengecek di baris pertama:
  ```sql
  IF auth.uid() IS NULL OR NOT public.is_business_member(p_business_id) THEN
      RAISE EXCEPTION 'UNAUTHORIZED_BUSINESS';
  END IF;
  ```
  Pemanggil tidak dapat membocorkan atau memanipulasi data bisnis lain meskipun parameter `p_business_id` dipalsukan.

#### 5. Hak OWNER/MANAGER pada Void Sale (Temuan AUDIT-C-01)
- `void_sale_transaction` saat ini hanya memanggil `public.is_business_member(p_business_id)`.
- Pada migrasi 001 baris 64, tabel `business_members` memiliki `CHECK (role IN ('OWNER'))`. Karena satu-satunya role yang ada adalah `OWNER`, setiap anggota saat ini berstatus owner.
- Namun, RPC basis data tidak mengecek kolom `role`. Proteksi peran void saat ini sepenuhnya bergantung pada otorisasi Layer 2 di Server Action (`src/lib/security.ts`).

#### 6. Integritas Harga dan HPP (Anti-Manipulasi Klien)
- Pada `record_sale_transaction`, harga jual (`selling_price`) dan harga pokok (`cost_price`) diambil langsung dari tabel `public.products` melalui query internal database.
- Input `p_items` dari klien **hanya** dibaca `productId`, `quantity`, dan `itemDiscount`. Nilai harga apa pun yang dikirim klien diabaikan.
- Pada `void_sale_transaction`, HPP tidak pernah diubah secara retroaktif, menjamin integritas laporan laba historis.

#### 7. Atomisitas & Pencegahan Double Void
- `void_sale_transaction` mengunci baris penjualan via `FOR UPDATE` dan memverifikasi status:
  ```sql
  IF v_sale.status = 'VOIDED' THEN
      RAISE EXCEPTION 'SALE_ALREADY_VOIDED: sale % is already voided', p_sale_id;
  END IF;
  ```
- Percobaan void kedua pada transaksi yang sama langsung dibatalkan.
- Stok produk dikembalikan sebesar kuantitas asli tepat satu kali, dan mutasi pembalik `VOID_SALE` dicatat di buku besar audit persediaan.

---

### 3.4 Audit D — Karakteristik dan Constraint Nomor Faktur (Invoice Number)

1. **Lingkup Unik Database:**
   - Tabel `sales`: `CONSTRAINT uq_sales_invoice UNIQUE (business_id, invoice_number)`.
   - Tabel `inventory_purchases`: `CONSTRAINT uq_purchases_invoice UNIQUE (business_id, invoice_number)`.
   - **Kesimpulan:** Nomor faktur unik per tenant bisnis, bukan unik secara global. Bisnis A dan Bisnis B dapat memiliki nomor faktur yang sama tanpa konflik.
2. **Ketiadaan Input dari Klien:**
   - Sesuai `docs/api-contracts.md` baris 108, antarmuka kasir tidak menginput nomor faktur.
   - RPC mewajibkan `p_invoice_number` minimal 3 karakter.
3. **Strategi Penanganan Konflik:**
   - Generator faktur acak pendek rentan tabrakan (*birthday paradox*).
   - **Rekomendasi Wajib Stage 3.1:**
     Implementasikan helper `src/lib/invoice.ts` yang menggabungkan tanggal UTC, microsecond/timestamp, dan 4-6 karakter acak kriptografis (contoh: `INV-20261013-183000-A9F2`).
     Di Server Action, tangkap error `23505` dengan detail constraint `uq_sales_invoice` dan lakukan percobaan ulang (retry) otomatis dengan nomor baru hingga maksimal 3 kali sebelum mengembalikan kegagalan ke klien.

---

### 3.5 Audit E — Kesiapan Integrasi

1. **Karakteristik `src/lib/transactions.ts`:**
   Dikonfirmasi 100% merupakan simulasi *in-memory* TypeScript untuk unit testing dan domain validation, bukan database adapter atau client Supabase.
2. **Ketersediaan Package Supabase:**
   Dikonfirmasi `@supabase/supabase-js` dan `@supabase/ssr` **BELUM TERINSTAL** pada `package.json`.
3. **Keamanan Environment:**
   `.env.example` terbukti hanya berisi variabel publik dengan placeholder palsu. Tidak ada bocoran `service_role` key.
4. **Strategi Fallback Environment:**
   Client helper Supabase harus memvalidasi variabel lingkungan secara ketat pada runtime produksi (`process.env.NODE_ENV === 'production'`) agar tidak menyembunyikan kesalahan konfigurasi, namun memberikan nilai *mock dummy* yang aman saat proses kompilasi statis `next build` pada lingkungan CI/CD.
5. **Next.js 16 Async Cookies:**
   Next.js 16.4.0 Canary mengharuskan pemanggilan `await cookies()`. Pola inisialisasi `@supabase/ssr` di Server Component dan Server Action harus mengantisipasi Promise cookie store.
6. **Status Eksekusi PostgreSQL:**
   **NOT RUN / UNVERIFIED ON RUNTIME POSTGRESQL.** Tidak ada klaim bahwa SQL sudah teruji pada server basis data fisik/cloud.

---

## 4. Rekomendasi Tindakan Minimum Sebelum / Pada Stage 3.1

Sebelum kode integrasi di `src/services/` dan Server Actions di `src/actions/` dibuat pada Stage 3.1:

1. **Persetujuan Instalasi Paket:**
   Memberikan izin eksekusi `npm install @supabase/supabase-js @supabase/ssr`.
2. **Handler Concurrency Idempotensi pada Server Action:**
   Menyiapkan blok penanganan error `23505 (uq_idempotency_key)` untuk melakukan *fallback read* ke `idempotency_keys` bila terjadi race condition kasir.
3. **Agregasi Item Keranjang Kasir:**
   Pada Server Action `createSale`, gabungkan kuantitas item dengan `productId` yang sama sebelum membungkusnya ke dalam array `p_items` untuk RPC.
4. **Generator Nomor Faktur & Retry Loop:**
   Membuat utilitas `src/lib/invoice.ts` dengan format entropi tinggi dan retry loop pada Server Action untuk constraint `uq_sales_invoice`.
5. **Pondasi Supabase SSR Client:**
   Membangun adapter browser dan server di `src/lib/supabase/` yang mendukung `await cookies()` Next.js 16.

---

## 5. Keputusan Kesiapan (Readiness Decision)

> ### **KEPUTUSAN: READY WITH CONDITIONS**
> 
> Seluruh skema database, aturan RLS, dan stored procedure PL/pgSQL telah terverifikasi secara statis dan konsisten dengan PRD.
> Tahap **Stage 3.1 (Service Layer, Server Actions & API Integration)** siap dimulai setelah kondisi-kondisi teknis berikut disepakati:
> 1. Memberikan izin instalasi paket `@supabase/supabase-js` dan `@supabase/ssr`.
> 2. Menerapkan penanganan exception konkurensi idempotensi (`23505`) dan retry generator nomor faktur di Server Action.
> 3. Menyetujui penerapan varian alokasi diskon *Largest Subtotal Absorber* yang telah selaras antara SQL dan TypeScript.
> 
> *Sesuai aturan wajib Stage 3.0.1, tidak ada file kode aplikasi atau migrasi yang diubah pada tahap ini. Pengerjaan dihentikan untuk menunggu persetujuan Anda sebelum melangkah ke Stage 3.1.*
