# VeyraOS --- Database Implementation Plan & PRD Schema Mapping

**Fase:** Phase 4, Stage 2.1  
**Status:** Usulan Rencana Implementasi Basis Data (Planning & Documentation Only - UNEXECUTED)  
**Peran:** Senior PostgreSQL Database Architect, Supabase Security Engineer & Financial Systems Reviewer  
**DBMS Target:** PostgreSQL 15+ (Supabase)  
**Standar Keuangan:** Integer `BIGINT` (Rupiah utuh, zero fractional cents, no floating-point)  

---

## 1. Ringkasan Eksekutif & Batasan Tahap 2.1

Dokumen ini merupakan spesifikasi teknis tingkat implementasi yang menjembatani **Product Requirements Document ([`docs/PRD.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/PRD.md))**, **Arsitektur Teknis ([`docs/technical-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/technical-architecture.md))**, dan **Audit Arsitektur ([`docs/architecture-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/architecture-audit.md))** ke dalam rancangan basis data yang siap dieksekusi pada Stage 2.2.

### Batasan Tahap 2.1 (Strictly Out of Scope)
- **TIDAK ADA** file migrasi SQL yang dibuat atau dijalankan pada tahap ini.
- **TIDAK ADA** koneksi atau mutasi pada basis data Supabase nyata.
- **TIDAK ADA** paket baru yang diinstal.
- Tahap ini murni perencanaan arsitektural dan dokumentasi penelusuran (*traceability*).

---

## 2. Inventaris Tabel & Matriks Ketertelusuran PRD (PRD Schema Traceability Matrix)

| No | Nama Tabel Kanonikal | Modul PRD Terkait | Peran & Tanggung Jawab Operasional | Strategi Akses Klien Langsung (PostgREST) |
|---|---|---|---|---|
| 1 | `profiles` | Modul 4.1: Autentikasi & Profil | Menyimpan metadata pengguna terotentikasi, terhubung 1-to-1 dengan `auth.users(id)`. | `SELECT`, `UPDATE` (hanya baris milik sendiri) |
| 2 | `businesses` | Modul 4.2: Manajemen Bisnis | Entitas akar multi-tenant (*tenant root*). Memuat nama toko, kategori, mata uang (IDR), dan zona waktu (WIB). | `SELECT`, `INSERT`, `UPDATE` (dibatasi pemilik) |
| 3 | `business_members` | Modul 4.2: Manajemen Bisnis | Memetakan hak kepemilikan dan peran pengguna terhadap bisnis (`role = 'OWNER'`). | `SELECT` saja; `INSERT` via database trigger otomatis |
| 4 | `products` | Modul 4.4: Produk & Persediaan | Katalog barang dagangan, harga jual, harga pokok rata-rata (MWAC), stok saat ini, dan ambang batas minimum. | `SELECT`, `INSERT`, `UPDATE` (metadata saja); stok diubah via RPC |
| 5 | `sales` | Modul 4.5: Transaksi Penjualan | Header transaksi penjualan kasir (invoice, subtotal, diskon transaksi, total, metode bayar, status `COMPLETED`/`VOIDED`). | `SELECT` saja; `INSERT` via RPC `record_sale_transaction`, `UPDATE` via RPC `void_sale_transaction` |
| 6 | `sale_items` | Modul 4.5: Transaksi Penjualan | Rincian baris item terjual dengan snapshot harga jual dan snapshot HPP moving average saat transaksi terjadi. | `SELECT` saja; `INSERT` eksklusif via RPC `record_sale_transaction` |
| 7 | `inventory_purchases` | Modul 4.7: Pembelian Persediaan | Header restock persediaan dari pemasok (tanggal, supplier, total biaya modal). | `SELECT` saja; `INSERT` eksklusif via RPC `record_purchase_transaction` |
| 8 | `purchase_items` | Modul 4.7: Pembelian Persediaan | Rincian baris item yang dibeli (kuantitas beli, harga beli satuan). | `SELECT` saja; `INSERT` eksklusif via RPC `record_purchase_transaction` |
| 9 | `stock_movements` | Modul 4.4: Buku Besar Mutasi Stok | Ledger audit persediaan yang abadi (*immutable audit ledger*) mencatat setiap delta penambahan/pengurangan stok. | `SELECT` saja; `INSERT` eksklusif via stored procedure internal database |
| 10 | `expenses` | Modul 4.6: Pengeluaran Operasional | Buku catatan beban operasional non-stok (sewa, listrik, gaji, logistik, pemasaran). | `SELECT`, `INSERT`, `UPDATE`, `DELETE` (terisolasi per `business_id`) |
| 11 | `idempotency_keys` | Modul 4.5 & Seksi 5: Integritas Transaksi | Menyimpan kunci unik transaksi per bisnis untuk mencegah order ganda saat jaringan seluler tidak stabil. | Dikelola secara internal di dalam stored procedure atomik |

---

## 3. Spesifikasi Rinci Entitas Basis Data

### 3.1 Tabel `profiles`
- **Tujuan:** Profil pemilik usaha yang terhubung dengan akun login Supabase Auth.
- **Primary Key:** `id UUID` (Foreign Key ke `auth.users(id)` dengan `ON DELETE CASCADE`).
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2)`
  - `email TEXT NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Indeks:** `idx_profiles_email ON profiles(email)`
- **RLS:** Pengguna hanya dapat membaca dan mengubah profil miliknya sendiri (`auth.uid() = id`).

### 3.2 Tabel `businesses`
- **Tujuan:** Profil entitas bisnis/toko UMKM. Satu pengguna dapat memiliki hingga 5 bisnis.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2)`
  - `category TEXT`
  - `phone TEXT`
  - `address TEXT`
  - `currency_code VARCHAR(3) NOT NULL DEFAULT 'IDR'`
  - `timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta'`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Batasan (Constraints):**
  - `CHECK (currency_code = 'IDR')` (MVP mengunci Rupiah).
  - `CHECK (timezone = 'Asia/Jakarta')` (MVP mengunci WIB).
- **Indeks:** `idx_businesses_owner ON businesses(owner_id)`
- **RLS:** Terbaca oleh anggota bisnis (`is_business_member(id)`), dapat dibuat oleh pengguna terotentikasi, diubah hanya oleh pemilik (`owner_id = auth.uid()`).

### 3.3 Tabel `business_members`
- **Tujuan:** Tabel keanggotaan bisnis yang menegakkan otorisasi tenant multi-tenant.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `role VARCHAR(20) NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER'))`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Batasan Unik:** `CONSTRAINT uq_business_member UNIQUE (business_id, user_id)`
- **Indeks:** `idx_business_members_lookup ON business_members(user_id, business_id)`
- **Otomatisasi:** Saat bisnis baru dibuat di `businesses`, trigger `trg_after_business_insert` secara otomatis mendaftarkan pembuat sebagai `OWNER` di tabel ini.

### 3.4 Tabel `products`
- **Tujuan:** Master data produk dan persediaan per bisnis.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1)`
  - `sku TEXT`
  - `category TEXT`
  - `selling_price BIGINT NOT NULL CHECK (selling_price > 0)`
  - `cost_price BIGINT NOT NULL DEFAULT 0 CHECK (cost_price >= 0)`
  - `stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)`
  - `min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0)`
  - `is_archived BOOLEAN NOT NULL DEFAULT FALSE`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Batasan Unik:**
  - `CONSTRAINT uq_products_business_id UNIQUE (business_id, id)` (Pondasi Composite Foreign Key anti-cross-tenant).
  - `CREATE UNIQUE INDEX uq_products_sku_per_business ON products(business_id, sku) WHERE sku IS NOT NULL AND sku <> '' AND is_archived = FALSE;`
- **Indeks:**
  - `idx_products_active ON products(business_id) WHERE is_archived = FALSE`
  - `idx_products_low_stock ON products(business_id, stock_quantity)`

### 3.5 Tabel `sales`
- **Tujuan:** Header transaksi penjualan kasir.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `invoice_number VARCHAR(50) NOT NULL`
  - `transaction_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
  - `subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0)`
  - `discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)`
  - `total_amount BIGINT NOT NULL CHECK (total_amount >= 0)`
  - `payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER'))`
  - `status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED'))`
  - `void_reason TEXT`
  - `voided_at TIMESTAMPTZ`
  - `notes TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Batasan:**
  - `CONSTRAINT uq_sales_invoice UNIQUE (business_id, invoice_number)`
  - `CHECK (total_amount = subtotal_amount - discount_amount)` (Konsistensi header aritmatika).
- **Indeks:**
  - `idx_sales_business_date ON sales(business_id, transaction_date DESC)`
  - `idx_sales_business_status ON sales(business_id, status)`

### 3.6 Tabel `sale_items`
- **Tujuan:** Baris item transaksi penjualan dengan snapshot harga abadi.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `product_id UUID NOT NULL`
  - `product_name_snapshot TEXT NOT NULL`
  - `unit_selling_price BIGINT NOT NULL CHECK (unit_selling_price >= 0)`
  - `unit_cost_price BIGINT NOT NULL CHECK (unit_cost_price >= 0)`
  - `quantity INTEGER NOT NULL CHECK (quantity > 0)`
  - `discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)`
  - `subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Composite Foreign Key (Anti-Cross-Tenant Guard):**
  - `CONSTRAINT fk_sale_items_product_same_tenant FOREIGN KEY (business_id, product_id) REFERENCES products(business_id, id) ON DELETE RESTRICT`
- **Indeks:**
  - `idx_sale_items_sale ON sale_items(sale_id)`
  - `idx_sale_items_business_product ON sale_items(business_id, product_id)`

### 3.7 Tabel `inventory_purchases` & `purchase_items`
- **Tujuan:** Header dan detail pembelian restock stok persediaan dari supplier.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom `inventory_purchases`:**
  - `id UUID PK NOT NULL`, `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`, `invoice_number VARCHAR(50) NOT NULL`, `purchase_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`, `supplier_name TEXT`, `total_cost BIGINT NOT NULL CHECK (total_cost >= 0)`, `notes TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Kolom `purchase_items`:**
  - `id UUID PK NOT NULL`, `purchase_id UUID NOT NULL REFERENCES inventory_purchases(id) ON DELETE CASCADE`, `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`, `product_id UUID NOT NULL`, `product_name_snapshot TEXT NOT NULL`, `quantity INTEGER NOT NULL CHECK (quantity > 0)`, `unit_purchase_cost BIGINT NOT NULL CHECK (unit_purchase_cost >= 0)`, `subtotal_cost BIGINT NOT NULL CHECK (subtotal_cost >= 0)`, `created_at TIMESTAMPTZ NOT NULL`
- **Composite Foreign Key:**
  - `CONSTRAINT fk_purchase_items_product_same_tenant FOREIGN KEY (business_id, product_id) REFERENCES products(business_id, id) ON DELETE RESTRICT`

### 3.8 Tabel `stock_movements` (Immutable Audit Ledger)
- **Tujuan:** Buku besar mutasi fisik barang. Setiap penambahan atau pengurangan wajib tercatat di sini.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `product_id UUID NOT NULL`
  - `movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('INITIAL', 'SALE', 'PURCHASE', 'VOID_SALE', 'ADJUSTMENT'))`
  - `quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0)`
  - `previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0)`
  - `new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0)`
  - `reference_id UUID` (Menunjuk ke ID penjualan, pembelian, atau null untuk initial)
  - `notes TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Composite Foreign Key:**
  - `CONSTRAINT fk_stock_movements_product_same_tenant FOREIGN KEY (business_id, product_id) REFERENCES products(business_id, id) ON DELETE RESTRICT`
- **Indeks:** `idx_stock_movements_query ON stock_movements(business_id, product_id, created_at DESC)`

### 3.9 Tabel `expenses`
- **Tujuan:** Catatan pengeluaran beban operasional (bukan persediaan).
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `expense_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
  - `category VARCHAR(50) NOT NULL`
  - `amount BIGINT NOT NULL CHECK (amount > 0)`
  - `notes TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Indeks:** `idx_expenses_business_date ON expenses(business_id, expense_date DESC)`

### 3.10 Tabel `idempotency_keys` (Fintech-Grade Duplicate Prevention)
- **Tujuan:** Mencegah transaksi ganda pada lingkungan serverless/mobile yang tidak memiliki persistent in-memory state.
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Kolom:**
  - `id UUID PK NOT NULL`
  - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
  - `key TEXT NOT NULL`
  - `action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('RECORD_SALE', 'RECORD_PURCHASE', 'VOID_SALE'))`
  - `response_payload JSONB NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Batasan Unik:** `CONSTRAINT uq_idempotency_key UNIQUE (business_id, key)`
- **Indeks:** `idx_idempotency_lookup ON idempotency_keys(business_id, key)`

---

## 4. Multi-Tenant Data Isolation & Kernel Enforcement

### 4.1 Mekanisme Composite Foreign Key
Pada arsitektur multi-tenant tradisional yang hanya menggunakan foreign key tunggal `product_id REFERENCES products(id)`:
- Penyerang yang memiliki akun di Toko A dapat mengirim request penjualan dengan `product_id` milik Toko B.
- Basis data akan menerima baris tersebut karena `id` produk memang ada di tabel `products`.

**Solusi VeyraOS:**
Tabel `products` memiliki batasan unik komposit: `UNIQUE (business_id, id)`.
Setiap tabel anak (`sale_items`, `purchase_items`, `stock_movements`) menyertakan kolom `business_id` dan batasan komposit:
```sql
FOREIGN KEY (business_id, product_id) REFERENCES products(business_id, id) ON DELETE RESTRICT
```
Jika ada upaya menyisipkan item di mana `business_id` nota adalah Toko A tetapi `product_id` milik Toko B, **PostgreSQL menolak transaksi secara langsung dengan error foreign key constraint violation**, sebelum data sempat tersimpan.

### 4.2 Restriksi Hak Akses Klien Langsung (Read-Only vs. Procedure-Only Tables)
Untuk menjamin integritas buku besar dan kalkulasi stok:
1. **Tabel `stock_movements`:** Dilarang ditulis langsung oleh klien. Hak `INSERT, UPDATE, DELETE` dicabut dari peran `authenticated` dan `anon`. Penulisan hanya dapat dilakukan oleh Stored Procedure yang berjalan dengan hak `SECURITY DEFINER`.
2. **Tabel `sale_items` & `purchase_items`:** Penulisan langsung dari PostgREST ditolak (`WITH CHECK (false)`). Seluruh penulisan wajib melalui `record_sale_transaction()` dan `record_purchase_transaction()`.
3. **Kolom `products.stock_quantity` & `products.cost_price`:** Klien hanya boleh memperbarui metadata seperti nama, harga jual, dan kategori. Perubahan stok dan HPP hanya boleh dimutasi oleh Stored Procedure terpercaya.

---

## 5. Invarian Finansial dan Persediaan

### 5.1 Nilai Moneter `BIGINT` & Pencegahan Overflow
- Seluruh kolom uang menggunakan tipe `BIGINT` (Rupiah utuh).
- Jangkauan nilai `BIGINT` ($+9,22 \times 10^{18}$) sangat jauh melampaui batas transaksi usaha UMKM, sehingga mustahil terjadi *integer overflow* dalam operasi penjumlahan omzet tahunan.
- Perhitungan intermediate pada stored procedure di-cast ke tipe `NUMERIC` sebelum pembagian, lalu dibulatkan ke integer dengan fungsi `ROUND()::BIGINT` untuk menjamin presisi matematis.

### 5.2 Formula Moving Weighted Average Cost (MWAC)
$$\text{Harga Pokok Baru} = \text{ROUND}\left(\frac{(\text{Stok Tersisa} \times \text{HPP Lama}) + (\text{Qty Beli} \times \text{Harga Beli Satuan})}{\text{Stok Tersisa} + \text{Qty Beli}}\right)$$

**Kasus Batas (Edge Cases):**
1. **Stok awal nol (`Current Stock = 0`):** Formula otomatis menyederhanakan menjadi $\frac{\text{Qty Beli} \times \text{Harga Beli}}{\text{Qty Beli}} = \text{Harga Beli Satuan}$.
2. **Pembelian pertama saat buka usaha:** Sama dengan harga beli pada transaksi restock pertama.
3. **Stok habis terjual (`Stock = 0` setelah penjualan):** Nilai `cost_price` produk tetap dipertahankan pada nilai terakhirnya, sebagai acuan jika ada penjualan berikutnya sebelum restock tercatat.
4. **Pembatalan Penjualan Pasca-Restock:** Pembatalan nota penjualan mengembalikan unit fisik ke `stock_quantity`, namun **tidak menghitung ulang nilai `cost_price` produk saat ini secara retroaktif**, guna mencegah distorsi berantai pada transaksi-transaksi lain yang terjadi di antaranya.

### 5.3 Alokasi Diskon Transaksi (Largest Remainder Method)
Diskon pada tingkat nota dialokasikan ke baris item secara proporsional:
$$\text{Diskon Item}_i = \text{ROUND}\left( \text{Diskon Nota} \times \frac{\text{Subtotal Item}_i}{\sum \text{Subtotal Seluruh Item}} \right)$$
Selisih pembulatan (1 atau 2 Rupiah) dibebankan ke item yang memiliki nilai subtotal terbesar (dengan pemutus seri / tie-breaker produk ID terkecil). Hal ini menjamin bahwa:
$$\sum \text{sale\_items.subtotal\_amount} = \text{sales.total\_amount} \quad (\text{Selisih Tepat Rp 0})$$

---

## 6. Batas Transaksi Atomik & Desain Idempotensi

### 6.1 Batas Transaksi Stored Procedure
Setiap stored procedure membungkus seluruh operasinya dalam blok transaksi PostgreSQL tunggal:

```
[Mulai Transaksi Stored Procedure (BEGIN)]
   │
   ├─► 1. Periksa Idempotency Key (Jika sudah pernah sukses -> Kembalikan respon lama)
   │
   ├─► 2. Validasi Otorisasi Tenant via is_business_member(business_id)
   │
   ├─► 3. Kunci Baris Produk Terurut ASCENDING:
   │      PERFORM id FROM products WHERE id IN (...) ORDER BY id ASC FOR UPDATE;
   │
   ├─► 4. Validasi Ketersediaan Stok (Tolak jika stock < qty_diminta)
   │
   ├─► 5. Insert Header (sales / purchases)
   │
   ├─► 6. Insert Line Items dengan Immutable Snapshot
   │
   ├─► 7. Mutasi Stok Fisik (UPDATE products)
   │
   ├─► 8. Insert Ledger Mutasi Stok (stock_movements)
   │
   ├─► 9. Simpan Idempotency Key & Payload Respon
   │
[Commit Transaksi (COMMIT) & Return JSONB]
```
Jika terjadi kegagalan di langkah 6 atau 7 (misalnya pelanggaran constraint atau diskon tidak valid), **seluruh langkah dari 1 hingga 9 dibatalkan (ROLLBACK)**, meninggalkan basis data dalam kondisi murni tanpa data parsial.

---

## 7. Urutan Ketergantungan Migrasi (Migration Dependency Graph)

Urutan file migrasi pada Stage 2.2, 2.3, dan 2.4 mengikuti ketergantungan topologis berikut:

```
20261013000001_extensions_and_core.sql   (uuid-ossp, pgcrypto, update_updated_at, profiles, businesses, business_members, enrollment trigger)
        │
        ▼
20261013000002_products_and_inventory.sql (products, uq_products_business_id, stock checks, triggers)
        │
        ▼
20261013000003_sales_and_items.sql       (sales, sale_items with composite FK to products, arithmetic & void checks)
        │
        ▼
20261013000004_purchases_and_items.sql   (inventory_purchases, purchase_items with composite FK to products)
        │
        ▼
20261013000005_stock_movements.sql       (stock_movements with composite FK to products, balance invariant check)
        │
        ▼
20261013000006_expenses.sql              (expenses table with checks and updated_at trigger)
        │
        ▼
20261013000007_idempotency_keys.sql      (idempotency_keys with uq_idempotency_key)
        │
        ▼ [STAGE 2.3 - PENDING APPROVAL]
20261013000008_rls_and_security.sql      (ENABLE RLS on all tables, isolation policies, revoke direct writes)
        │
        ▼ [STAGE 2.4 - PENDING APPROVAL]
20261013000009_stored_procedures.sql     (record_sale, record_purchase, void_sale RPC functions)
```

---

## 8. Rencana Pengujian Basis Data (Database Integration Test Plan)

Pengujian yang akan diimplementasikan dan dieksekusi pada tahap pengujian basis data meliputi:

| ID Uji | Target Verifikasi | Prosedur Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| **DB-SEC-01** | Cross-Tenant Read Isolation | User A mencoba `SELECT` pada tabel `products` milik Toko B. | Hasil kosong (`0 rows`). |
| **DB-SEC-02** | Cross-Tenant Composite FK Rejection | User A mencoba insert `sale_items` dengan `product_id` milik Toko B. | Ditolak error constraint `fk_sale_items_product_same_tenant`. |
| **DB-SEC-03** | Unauthorized RPC Rejection | User B memanggil `record_sale_transaction` untuk `business_id` milik Toko A. | Ditolak error `UNAUTHORIZED_BUSINESS`. |
| **DB-ACID-01** | Atomic Rollback on Failure | Penjualan dengan 1 dari 5 item melebihi stok. | Seluruh transaksi rollback: 0 sales, 0 sale_items, stok produk tidak berubah. |
| **DB-CONC-01** | Deadlock Prevention under Concurrency | 10 request checkout paralel dengan urutan produk acak. | Semua selesai tertib tanpa error `40P01 deadlock detected`. |
| **DB-CONC-02** | Non-Negative Stock Invariant | 2 kasir paralel membeli 1 item terakhir secara bersamaan. | 1 transaksi berhasil, 1 transaksi ditolak `STOCK_INSUFFICIENT`, sisa stok tepat 0 (tidak pernah -1). |
| **DB-IDEM-01** | Idempotency Key Deduping | Mengirim request penjualan identik dua kali dengan key yang sama. | Transaksi kedua mengembalikan respon tersimpan tanpa menduplikasi nota atau pemotongan stok. |
| **DB-MATH-01** | MWAC Recalculation Accuracy | Restock stok 10 unit @ Rp 10rb dengan 10 unit baru @ Rp 12rb. | `cost_price` produk terupdate menjadi Rp 11.000 bulat. |
| **DB-MATH-02** | Largest Remainder Discount Reconciliation | Penjualan Rp 100.000 dengan diskon nota Rp 15.000 terbagi pada 3 item. | $\sum \text{sale\_items.subtotal\_amount} = \text{Rp } 85.000$ (Selisih tepat Rp 0). |
| **DB-VOID-01** | Full Sale Void with Stock Restoration | Membatalkan nota penjualan aktif. | Status menjadi `VOIDED`, stok kembali tepat sejumlah kuantitas semula, mutasi `VOID_SALE` tercatat. |

> **Penegasan Status:** Seluruh uji di atas adalah **Spesifikasi Rencana Pengujian (Proposed Integration Test Plan)**. Belum ada satu pun migrasi atau pengujian runtime yang dieksekusi pada Tahap 2.1 ini.
