# VeyraOS — Phase 4, Stage 2.4 Preflight: Atomic Transaction Readiness Audit Report

**Fase:** Phase 4, Stage 2.4 Preflight  
**Status Audit:** SELESAI (Audit Completed — Ready for Stage 2.4 Implementation upon Approval)  
**Peran:** Senior PostgreSQL Database Architect, Financial Systems Reviewer & Security Engineer  
**DBMS Target:** PostgreSQL 15+ (Supabase)  
**Standar Keuangan:** Integer `BIGINT` (Rupiah utuh, zero fractional cents, no floating-point)  
**Status Eksekusi:** **AUDIT DOKUMEN & STATIK SAJA (Nol Mutasi Basis Data, Nol Koneksi Live)**  

---

## 1. Ringkasan Eksekutif & Tujuan Audit Preflight

Audit preflight ini dilakukan untuk mengevaluasi kesiapan implementasi **tiga Stored Procedure PL/pgSQL transaksi atomik (RPC)** yang menjadi inti dari integritas data VeyraOS:
1. `record_sale_transaction()` — Pencatatan penjualan kasir, pemotongan stok, alokasi diskon nota, dan pencatatan buku besar mutasi stok secara atomik.
2. `record_purchase_transaction()` — Pencatatan restock barang dari supplier, penambahan stok fisik, dan rekalkulasi *Moving Weighted Average Cost* (MWAC).
3. `void_sale_transaction()` — Pembatalan penjualan total, pengembalian stok fisik, dan pencatatan mutasi void dengan retensi HPP historis abadi.

Audit ini membandingkan kesesuaian antara spesifikasi API ([`docs/api-contracts.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/api-contracts.md)), skema basis data migrasi ([`supabase/migrations/`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/)), implementasi domain TypeScript ([`src/lib/financial.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/financial.ts)), dan rancangan awal pada [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md).

---

## 2. Matriks Temuan Audit Preflight (P0, P1, P2)

| ID | Prioritas | Area Audit | File & Lokasi Terkait | Deskripsi Masalah & Dampak | Rekomendasi Solusi untuk Stage 2.4 |
|---|:---:|---|---|---|---|
| **PRE-P0-01** | **P0** | **Algoritma Finansial** | `docs/database-schema.md` (baris 460–470) | **Cacat Alokasi Diskon Single-Pass pada Draf Stored Procedure:** Pada draf `record_sale_transaction`, penetapan diskon sisa dilakukan secara sepihak (`v_item_prop_discount := v_remaining_tx_discount`) di tengah perulangan item. Jika item bersubtotal terbesar kebetulan berada di urutan pertama array JSON, seluruh diskon nota diserap oleh item pertama dan item lainnya mendapat diskon Rp 0. Ini bertentangan dengan implementasi dua-tahap yang benar pada `src/lib/financial.ts`. | **Wajib Diperbaiki di RPC Stage 2.4:** Terapkan algoritma *Largest Remainder* dua-tahap identik dengan `src/lib/financial.ts`: Tahap 1 menghitung alokasi proporsional sementara untuk seluruh item, lalu Tahap 2 menambahkan sisa selisih pembulatan (`discount - sum_allocated`) ke item bersubtotal terbesar. |
| **PRE-P0-02** | **P0** | **Kontrak API & JSON Payload** | `docs/api-contracts.md` (Seksi 4.1) vs `docs/database-schema.md` (Seksi 9.1) | **Discrepancy Naming Payload JSON (camelCase vs snake_case):** Kontrak TypeScript klien mengirim `{ productId, quantity, itemDiscount }` (camelCase), sedangkan draf SQL PL/pgSQL mengekstrak `(item->>'product_id')` (snake_case). Jika payload langsung diteruskan tanpa penyesuaian, parameter bernilai NULL dan memicu kegagalan transaksi `PRODUCT_NOT_FOUND`. | **Solusi Resilient di RPC Stage 2.4:** Ekstrak properti JSON dengan fallback `COALESCE`: `COALESCE(item->>'product_id', item->>'productId')::UUID` dan `COALESCE(item->>'item_discount', item->>'itemDiscount', '0')::BIGINT`. |
| **PRE-P0-03** | **P0** | **Idempotensi Transaksi** | `docs/database-schema.md` (baris 370–377) vs `docs/api-contracts.md` (baris 110) | **Parameter Idempotency Key Hilang dari Tanda Tangan Draf RPC:** Draf awal `record_sale_transaction()` di `database-schema.md` tidak menyertakan parameter `p_idempotency_key`, padahal tabel `idempotency_keys` sudah dibuat pada migrasi 007 dan kontrak API mewajibkan `idempotencyKey` untuk deduping mobile/serverless. | **Solusi di RPC Stage 2.4:** Tambahkan parameter `p_idempotency_key TEXT DEFAULT NULL` pada ketiga RPC. Evaluasi keberadaan kunci di awal transaksi; jika sudah ada, kembalikan respon tersimpan secara instan tanpa mutasi ulang. |
| **PRE-P1-01** | **P1** | **Hardening Keamanan** | Migrasi 008 & Draf Stored Procedure | **Kebutuhan Search Path Kosong pada SECURITY DEFINER:** Seluruh RPC transaksi atomik wajib berjalan dengan `SECURITY DEFINER` (karena hak tulis langsung klien telah dicabut di Stage 2.3), namun draf lama menggunakan `SET search_path = public, auth`. | **Solusi di RPC Stage 2.4:** Gunakan standar pengerasan mutlak `SET search_path = ''` dengan kualifikasi skema penuh (`public.products`, `public.sales`, `auth.uid()`, dll.) guna mencegah serangan pembajakan skema. |
| **PRE-P1-02** | **P1** | **Pembelian Pertama / Stok Nol** | `docs/database-schema.md` (baris 572–577) | **Pembagian Nol pada Rekalkulasi MWAC Jika Stok Menjadi Nol:** Jika `(stock_quantity + v_qty) = 0` (kasus batas ekstrem), ekspresi pembagian dapat memicu runtime error `division by zero`. | **Solusi di RPC Stage 2.4:** Berikan percabangan defensif eksplisit: Jika `(v_prod.stock_quantity + v_qty) > 0`, gunakan formula MWAC; jika tidak, gunakan harga beli saat ini secara langsung. |
| **PRE-P1-03** | **P1** | **Validasi Alasan Void (Sale Void)** | `docs/api-contracts.md` (baris 150) & Migrasi 003 | **Konsistensi Panjang Minimal `void_reason`:** Tabel `sales` memiliki constraint `chk_sales_void_metadata` yang mewajibkan `char_length(trim(void_reason)) >= 5`. Jika parameter `p_void_reason` di RPC tidak divalidasi sebelum update, error constraint mentah PostgreSQL akan dilempar. | **Solusi di RPC Stage 2.4:** Validasi eksplisit di awal fungsi `IF length(trim(COALESCE(p_void_reason, ''))) < 5 THEN RAISE EXCEPTION 'INVALID_VOID_REASON'; END IF;`. |
| **PRE-P2-01** | **P2** | **Format Invoice Number** | `docs/api-contracts.md` (baris 126) & Migrasi 003 | **Pencegahan Invoice Number Kosong / Duplikat:** Tabel `sales` dan `inventory_purchases` memiliki constraint unik `(business_id, invoice_number)`. Format penomoran harus divalidasi minimal 3 karakter non-spasi. | **Solusi di RPC Stage 2.4:** Validasi `p_invoice_number` di awal RPC, atau bangkitkan nomor invoice deterministik jika tidak disediakan. |

---

## 3. Kesiapan Skema Basis Data untuk Setiap RPC (Schema Readiness Audit)

### 3.1 Kesiapan Skema untuk `record_sale_transaction()`
- **Tabel `sales`:** Mendukung penuh. Memiliki kolom `subtotal_amount`, `discount_amount`, `total_amount`, `status`, dan constraint `chk_sales_total_calculation` serta `chk_sales_discount_limit`.
- **Tabel `sale_items`:** Mendukung penuh. Memiliki snapshot abadi `unit_selling_price`, `unit_cost_price`, `product_name_snapshot`, constraint aritmatika `chk_sale_items_subtotal`, dan composite FK `fk_sale_items_product_same_tenant` anti cross-tenant.
- **Tabel `products`:** Mendukung penuh. Memiliki `stock_quantity`, constraint non-negatif `stock_quantity >= 0`, dan composite unique key `uq_products_business_id`.
- **Tabel `stock_movements`:** Mendukung penuh. Memiliki constraint invarian arah tanda delta (`movement_type = 'SALE' AND quantity_delta < 0`), balance check `chk_stock_movements_balance`, dan kewajiban `reference_id IS NOT NULL`.
- **Tabel `idempotency_keys`:** Mendukung penuh. Memiliki `action_type = 'RECORD_SALE'` dan constraint unik `(business_id, key)`.

### 3.2 Kesiapan Skema untuk `record_purchase_transaction()`
- **Tabel `inventory_purchases`:** Mendukung penuh. Memiliki `invoice_number`, `purchase_date`, `supplier_name`, `total_cost`, dan `notes`.
- **Tabel `purchase_items`:** Mendukung penuh. Memiliki `quantity`, `unit_purchase_cost`, `subtotal_cost`, constraint `chk_purchase_items_subtotal`, dan composite FK `fk_purchase_items_product_same_tenant`.
- **Tabel `products`:** Mendukung rekalkulasi MWAC (`cost_price BIGINT`) dan penambahan stok (`stock_quantity INTEGER`).
- **Tabel `stock_movements`:** Mendukung penuh. Invarian arah tanda delta (`movement_type = 'PURCHASE' AND quantity_delta > 0`) dan `reference_id` menunjuk ke ID faktur pembelian.
- **Tabel `idempotency_keys`:** Mendukung penuh dengan `action_type = 'RECORD_PURCHASE'`.

### 3.3 Kesiapan Skema untuk `void_sale_transaction()`
- **Tabel `sales`:** Mendukung penuh. Memiliki kolom `status` (`'VOIDED'`), `void_reason`, `voided_at`, dan constraint metadata void `chk_sales_void_metadata`.
- **Tabel `products`:** Mendukung pemulihan stok fisik (`stock_quantity = stock_quantity + item.quantity`). Nilai `cost_price` tidak diubah secara retroaktif.
- **Tabel `stock_movements`:** Mendukung mutasi pembalik bertipe `'VOID_SALE'` dengan `quantity_delta > 0` dan `reference_id` menunjuk ke ID nota penjualan yang dibatalkan.
- **Tabel `idempotency_keys`:** Mendukung penuh dengan `action_type = 'VOID_SALE'`.

---

## 4. Evaluasi Risiko Concurrency, Deadlock & Idempotensi

```
Skenario Kasir Paralel (Kasir A & Kasir B menjual Produk 1 & Produk 2 bersamaan):

[Kasir A: Checkout Item 1, Item 2]          [Kasir B: Checkout Item 2, Item 1]
               │                                           │
               ▼                                           ▼
      Kunci Produk 1 ASC                          Kunci Produk 1 ASC (Menunggu Kasir A)
               │                                           │
               ▼                                           │
      Kunci Produk 2 ASC                                   │
               │                                           │
      Update Stok & Insert Header                          │
               │                                           │
            COMMIT                                         ▼
               └─────────────────────────────────► Kasir B Mendapat Kunci Produk 1
                                                           │
                                                           ▼
                                                  Kunci Produk 2 ASC
                                                           │
                                                  Validasi Sisa Stok (Jika 0 -> ROLLBACK)
```

1. **Deadlock Elimination (P0):**
   - Dengan mewajibkan klausa `PERFORM id FROM public.products WHERE id IN (...) ORDER BY id ASC FOR UPDATE`, PostgreSQL menjamin semua transaksi kasir mengunci baris produk dalam urutan yang identik secara global.
   - Pola siklus *wait-for* (Kasir A menunggu Kasir B sementara Kasir B menunggu Kasir A) menjadi **mustahil terjadi secara matematis**.
2. **Race Condition pada Stok Terakhir (P0):**
   - Karena baris produk dikunci dengan `FOR UPDATE`, transaksi kedua membaca stok aktual yang telah dikurangi oleh transaksi pertama. Jika stok tidak mencukupi, transaksi kedua melempar exception `STOCK_INSUFFICIENT` dan memicu *automatic rollback*.
3. **Deduplikasi Idempotensi Stateless (P0):**
   - Jika koneksi internet kasir terputus saat request sedang berjalan dan kasir menekan tombol kirim ulang, RPC memeriksa `idempotency_keys`. Kunci yang sudah tersimpan mengembalikan respon asli dalam hitungan milidetik tanpa memotong stok untuk kedua kalinya.

---

## 5. Rencana Pengujian yang Diperlukan pada Stage 2.4

Setelah implementasi stored procedure pada Stage 2.4, pengujian berikut harus disiapkan dan disimulasikan:

| Kode Pengujian | Sasaran Validasi | Prosedur Uji | Kriteria Kelulusan |
|---|---|---|---|
| **RPC-ACID-01** | Atomisitas Rollback Total | Penjualan dengan 4 item valid dan 1 item melebihi stok. | Seluruh transaksi di-rollback 100%: 0 sales, 0 sale_items, 0 stock_movements, stok produk tidak berubah. |
| **RPC-DEAD-01** | Pencegahan Deadlock Konkurensi | Menjalankan 10 checkout paralel dengan urutan produk acak. | Semua request selesai tertib tanpa ada error PostgreSQL `40P01 deadlock detected`. |
| **RPC-MATH-01** | Rekonsiliasi Diskon Largest Remainder | Penjualan Rp 100.000 dengan diskon nota Rp 15.000 pada 3 item. | $\sum \text{sale\_items.subtotal\_amount} = \text{sales.total\_amount}$ (Selisih tepat Rp 0). |
| **RPC-MWAC-01** | Presisi MWAC Pembelian Restock | Restock produk stok 10 unit @ Rp 10.000 dengan 10 unit baru @ Rp 12.000. | `products.cost_price` terupdate menjadi Rp 11.000 bulat. |
| **RPC-VOID-01** | Idempotensi Pembatalan Penjualan | Membatalkan nota aktif, kemudian mencoba membatalkan lagi. | Pembatalan pertama berhasil me-restock produk; pembatalan kedua ditolak `SALE_ALREADY_VOIDED`. |
| **RPC-IDEM-01** | Deduplikasi Idempotency Key | Mengirim request penjualan identik 2 kali dengan key yang sama. | Transaksi kedua mengembalikan respon tersimpan tanpa menduplikasi faktur atau potongan stok. |

---

## 6. Keputusan Kesiapan (Readiness Decision)

> ### **KEPUTUSAN KELAYAKAN: READY TO IMPLEMENT STAGE 2.4**
> Skema basis data pada migrasi 001–008 **100% siap dan kompatibel** untuk mendukung ketiga Stored Procedure transaksi atomik. Seluruh temuan preflight (perbaikan algoritma Largest Remainder dua-tahap, penanganan fleksibel naming JSON camelCase/snake_case, dan penambahan parameter idempotency key) telah dipetakan dengan jelas untuk diimplementasikan pada file migrasi `20261013000009_stored_procedures.sql`.
> 
> **Pemberhentian Eksekusi:** Pengerjaan berhenti di sini sesuai batasan audit Stage 2.4 Preflight. Menunggu persetujuan eksplisit sebelum melanjutkan ke pembuatan migrasi Stored Procedure.
