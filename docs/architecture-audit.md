# VeyraOS --- Phase 3.1: Architecture Audit & Implementation Readiness

**Status Dokumen:** Audit Arsitektur Selesai  
**Tanggal:** 13 Oktober 2026  
**Peran Auditor:** Senior Software Architect, PostgreSQL Security Engineer & Financial Systems Reviewer  
**Klasifikasi Kesiapan:** **READY WITH CONDITIONS** (Siap Masuk Tahap Implementasi dengan Penyelesaian 5 Masalah P0)  

---

## 1. Ringkasan Eksekutif & Klasifikasi Kelayakan

Berdasarkan tinjauan menyeluruh terhadap:
- [`docs/PRD.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/PRD.md)
- [`docs/design-system.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/design-system.md)
- [`docs/information-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/information-architecture.md)
- [`docs/ui-ux-specification.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/ui-ux-specification.md)
- [`docs/design-acceptance-criteria.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/design-acceptance-criteria.md)
- [`docs/technical-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/technical-architecture.md)
- [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md)
- [`docs/security-and-rls.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/security-and-rls.md)
- [`docs/api-contracts.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/api-contracts.md)
- [`docs/testing-strategy.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/testing-strategy.md)
- [`docs/implementation-roadmap.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/implementation-roadmap.md)

Arsitektur VeyraOS dinilai memiliki fondasi konseptual yang sangat kuat: prinsip pemisahan finansial (omzet vs. HPP vs. beban operasional vs. arus kas) sudah terdefinisi jelas, representasi moneter menggunakan `BIGINT` integer IDR tanpa desimal, dan isolasi Mode Demo di sisi klien dirancang tanpa ketergantungan backend.

Namun, terdapat **5 kelemahan kritis (P0)** pada tingkat basis data, konkurensi atomik, dan konsistensi relasi multi-tenant yang **wajib disempurnakan dalam spesifikasi sebelum kode aplikasi ditulis**.

Oleh karena itu, status arsitektur ditetapkan sebagai:
$$\textbf{READY WITH CONDITIONS}$$

---

## 2. Matriks Temuan Audit (P0, P1, P2)

| ID | Prioritas | Area | Dokumen & Seksi Terkait | Ringkasan Masalah |
|---|---|---|---|---|
| **AUD-P0-01** | **P0** | **Database & RLS** | `database-schema.md` (Seksi 2.5) & `security-and-rls.md` (Seksi 2.6) | **Celah Referensi Produk Lintas Tenant:** `sale_items` dan `purchase_items` tidak memiliki batasan yang menjamin `product_id` berasal dari `business_id` yang sama dengan invoice induk. |
| **AUD-P0-02** | **P0** | **Database & RLS** | `security-and-rls.md` (Seksi 2.2 & 2.4) | **Kebijakan INSERT Hilang pada `business_members` & Kesalahan `search_path`:** Fungsi RLS `is_business_member` gagal memanggil `auth.uid()` jika `search_path` hanya `public`, dan user baru tidak bisa menulis ke `business_members`. |
| **AUD-P0-03** | **P0** | **Konkurensi & Atomisitas** | `technical-architecture.md` (Seksi 4) & `api-contracts.md` (Seksi 4.1) | **Ketiadaan Stored Procedure PL/pgSQL:** Supabase-js melalui HTTP tidak mendukung transaksi interaktif multi-tabel; kegagalan jaringan di tengah jalan dapat merusak konsistensi stok dan penjualan. |
| **AUD-P0-04** | **P0** | **Konkurensi** | `technical-architecture.md` (Seksi 4) & `testing-strategy.md` (Seksi 3.1) | **Potensi Deadlock pada Kunci Baris:** Penguncian baris `SELECT ... FOR UPDATE` pada transaksi penjualan multi-item belum mewajibkan pengurutan `ORDER BY id`, berisiko deadlock jika dua kasir menjual produk yang sama dalam urutan berbeda. |
| **AUD-P0-05** | **P0** | **Finansial & HPP** | `api-contracts.md` (Seksi 4.1) & `database-schema.md` (Seksi 2.5) | **Ambiguitas Alokasi Diskon Transaksi ke Item:** Diskon per transaksi belum memiliki aturan alokasi matematis yang baku ke baris item (`sale_items`), berisiko membuat total laba kotor item tidak klop dengan total nota. |
| **AUD-P1-01** | **P1** | **Finansial** | `api-contracts.md` (Seksi 4.2) | **Valuasi HPP saat Pembatalan Penjualan Pasca-Restock:** Aturan valuasi biaya persediaan saat penjualan dibatalkan setelah ada transaksi restock baru belum ditegaskan secara eksplisit. |
| **AUD-P1-02** | **P1** | **Framework Nuance** | `technical-architecture.md` (Seksi 2) | **Next.js 15 Asynchronous Request APIs:** Next.js 15 mewajibkan `await cookies()` dan `await headers()`; kode middleware dan server actions harus memperhitungkan perubahan API ini. |
| **AUD-P1-03** | **P1** | **Operasional** | `technical-architecture.md` (Seksi 2) | **Mitigasi Auto-Pause Supabase Free Tier:** Instance gratis Supabase berhenti otomatis setelah 7 hari tidak aktif; perlu strategi liveness ping terencana. |
| **AUD-P2-01** | **P2** | **Demo Mode** | `information-architecture.md` (Seksi 5) | **Penanganan Korupsi LocalStorage Mode Demo:** Perlu blok `try-catch` otomatis untuk mereset data demo jika data JSON lokal rusak atau kuota penyimpanan browser penuh. |
| **AUD-P2-02** | **P2** | **Validasi Input** | `ui-ux-specification.md` (Seksi 4.1) | **Peringatan Harga Jual < Harga Pokok:** Perlu batasan jelas bahwa peringatan jual rugi bersifat non-blocking agar tidak mengganggu kecepatan kasir. |

---

## 3. Analisis Mendalam Temuan P0 & Solusi Teknis Konkret

---

### Temuan AUD-P0-01: Celah Referensi Produk Lintas Tenant pada `sale_items` & `purchase_items`

#### 1. Akar Masalah & Dampak Keamanan
Pada proposal DDL `docs/database-schema.md`, tabel `sale_items` didefinisikan sebagai:
```sql
CREATE TABLE sale_items (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    ...
);
```
Dan pada `docs/security-and-rls.md`, kebijakan RLS berbunyi:
```sql
CREATE POLICY "Akses tulis item penjualan dibatasi untuk anggota bisnis"
ON sale_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales 
    WHERE sales.id = sale_items.sale_id 
      AND is_business_member(sales.business_id)
  )
);
```
**Celah Kritis:** RLS di atas hanya memeriksa apakah `sale_id` milik bisnis pengguna, **tetapi tidak memeriksa apakah `product_id` milik bisnis yang sama!**
Jika penyerang mengirimkan `product_id` milik Bisnis B (korban) ke dalam transaksi penjualan Bisnis A, basis data PostgreSQL akan menerima baris tersebut. Akibatnya:
1. Kasir Toko A dapat secara ilegal mengurangi stok barang milik Toko B.
2. Laporan penjualan Toko A menyerap data nama dan modal Toko B.

#### 2. Usulan Koreksi Konkret
Tambahkan kolom `business_id` pada `sale_items` dan `purchase_items`, lalu terapkan **Composite Foreign Key**:
```sql
-- Tambahkan business_id ke sale_items
ALTER TABLE sale_items 
ADD COLUMN business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE;

-- Tambahkan UNIQUE constraint pada products untuk mendukung composite foreign key
ALTER TABLE products 
ADD CONSTRAINT uq_products_business_id UNIQUE (business_id, id);

-- Terapkan composite foreign key pada sale_items
ALTER TABLE sale_items
ADD CONSTRAINT fk_sale_items_product_same_tenant
FOREIGN KEY (business_id, product_id) 
REFERENCES products(business_id, id) ON DELETE RESTRICT;

-- Perbarui RLS Policy sale_items
CREATE POLICY "sale_items_tenant_isolation"
ON sale_items FOR ALL
USING (is_business_member(business_id))
WITH CHECK (is_business_member(business_id));
```
*Catatan:* Lakukan hal identik pada tabel `purchase_items`.

#### 3. Kriteria Penerimaan (Acceptance Criteria)
- [ ] Upaya `INSERT INTO sale_items` dengan `product_id` milik bisnis lain ditolak oleh PostgreSQL dengan error `foreign key constraint violation`.
- [ ] Kebijakan RLS `sale_items` secara mandiri mengevaluasi `business_id` tanpa bergantung pada join bertingkat yang lambat.

---

### Temuan AUD-P0-02: Kebijakan INSERT Hilang pada `business_members` & Kesalahan `search_path`

#### 1. Akar Masalah & Dampak
1. **Search Path:** Pada fungsi RLS:
   ```sql
   CREATE OR REPLACE FUNCTION is_business_member(b_id UUID)
   ...
   SET search_path = public
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM business_members
       WHERE business_id = b_id AND user_id = auth.uid()
     );
   $$;
   ```
   Di Supabase, fungsi `auth.uid()` berada pada skema `auth`. Menetapkan `SET search_path = public` menyebabkan fungsi gagal menemukan `auth.uid()`, memicu runtime error `function auth.uid() does not exist` saat query RLS dievaluasi.
2. **Missing INSERT Policy:** Di `docs/security-and-rls.md`, tabel `business_members` diaktifkan RLS-nya tetapi **hanya memiliki policy SELECT**. Tidak ada policy `INSERT`. Saat pengguna mendaftarkan bisnis baru, operasi penyimpanan ke `business_members` akan digagalkan oleh RLS!

#### 2. Usulan Koreksi Konkret
1. Perbaiki `search_path`:
   ```sql
   CREATE OR REPLACE FUNCTION is_business_member(b_id UUID)
   RETURNS BOOLEAN
   LANGUAGE sql
   SECURITY DEFINER
   SET search_path = public, auth
   STABLE
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.business_members
       WHERE business_id = b_id
         AND user_id = auth.uid()
     );
   $$;
   ```
2. Buat PostgreSQL Trigger otomatis untuk menambahkan pembuat bisnis ke `business_members`:
   ```sql
   -- Trigger function saat bisnis baru dibuat
   CREATE OR REPLACE FUNCTION handle_new_business_owner()
   RETURNS TRIGGER
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, auth
   AS $$
   BEGIN
     INSERT INTO public.business_members (business_id, user_id, role)
     VALUES (NEW.id, NEW.owner_id, 'OWNER');
     RETURN NEW;
   END;
   $$;

   CREATE TRIGGER trg_after_business_insert
   AFTER INSERT ON businesses
   FOR EACH ROW
   EXECUTE FUNCTION handle_new_business_owner();
   ```

#### 3. Kriteria Penerimaan (Acceptance Criteria)
- [ ] Pengguna baru berhasil membuat bisnis melalui form pendaftaran bisnis dan otomatis tercatat sebagai `OWNER` di `business_members` tanpa error pelanggaran RLS.
- [ ] Fungsi `is_business_member` dapat dievaluasi tanpa error `auth.uid() does not exist`.

---

### Temuan AUD-P0-03: Ketiadaan Stored Procedure PL/pgSQL untuk Transaksi Atomik (Supabase-js Limitation)

#### 1. Akar Masalah & Dampak Integritas
Library klien `supabase-js` berkomunikasi melalui REST (PostgREST). PostgREST **tidak mendukung transaksi interaktif multi-query** (`BEGIN ... COMMIT`) dari kode JavaScript klien atau Server Actions.
Jika pembuatan transaksi penjualan dilakukan melalui beberapa pemanggilan beruntun di Server Action:
```typescript
// BERBAHAYA JIKA JARINGAN GAGAL DI TENGAH JALAN:
await supabase.from('sales').insert(...);        // Langkah 1: Berhasil
await supabase.from('sale_items').insert(...);   // Langkah 2: Berhasil
// Jaringan terputus / Server crash / Constraint gagal
await supabase.from('products').update(...);     // Langkah 3: GAGAL!
```
Stok tidak terpotong, padahal nota penjualan sudah tercatat! Ini melanggar prinsip integritas P0 yang diwajibkan PRD.

#### 2. Usulan Koreksi Konkret
Operasi pencatatan penjualan (`record_sale`), pembelian (`record_purchase`), dan pembatalan (`void_sale`) **wajib dikemas ke dalam Stored Procedure PostgreSQL (RPC PL/pgSQL)** yang dieksekusi dalam satu transaksi atomik di server basis data:

```sql
CREATE OR REPLACE FUNCTION record_sale_transaction(
    p_business_id UUID,
    p_invoice_number TEXT,
    p_payment_method TEXT,
    p_discount_amount BIGINT,
    p_notes TEXT,
    p_items JSONB -- Array of {product_id, quantity, unit_selling_price, item_discount}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_sale_id UUID;
    v_subtotal BIGINT := 0;
    v_total BIGINT := 0;
    v_item JSONB;
    v_prod RECORD;
    v_item_subtotal BIGINT;
    v_item_cogs BIGINT;
BEGIN
    -- 1. Validasi Otorisasi
    IF NOT is_business_member(p_business_id) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_BUSINESS';
    END IF;

    -- 2. Kunci seluruh baris produk secara deterministik (ORDER BY id) untuk cegah deadlock
    PERFORM id FROM products 
    WHERE business_id = p_business_id 
      AND id IN (SELECT (item->>'product_id')::UUID FROM jsonb_array_elements(p_items) AS item)
    ORDER BY id
    FOR UPDATE;

    -- 3. Buat Header Penjualan
    INSERT INTO sales (
        business_id, invoice_number, subtotal_amount, discount_amount, 
        total_amount, payment_method, status, notes
    ) VALUES (
        p_business_id, p_invoice_number, 0, p_discount_amount, 
        0, p_payment_method, 'COMPLETED', p_notes
    ) RETURNING id INTO v_sale_id;

    -- 4. Loop & Validasi Setiap Item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        -- Ambil data produk terkini
        SELECT id, name, selling_price, cost_price, stock_quantity 
        INTO v_prod
        FROM products 
        WHERE id = (v_item->>'product_id')::UUID AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', (v_item->>'product_id');
        END IF;

        IF v_prod.stock_quantity < (v_item->>'quantity')::INTEGER THEN
            RAISE EXCEPTION 'STOCK_INSUFFICIENT: Produk % sisa %, diminta %', 
                v_prod.name, v_prod.stock_quantity, (v_item->>'quantity')::INTEGER;
        END IF;

        v_item_subtotal := ((v_item->>'quantity')::INTEGER * v_prod.selling_price) - COALESCE((v_item->>'item_discount')::BIGINT, 0);
        v_subtotal := v_subtotal + v_item_subtotal;

        -- Simpan Sale Item dengan snapshot abadi
        INSERT INTO sale_items (
            sale_id, business_id, product_id, product_name_snapshot,
            unit_selling_price, unit_cost_price, quantity, discount_amount, subtotal_amount
        ) VALUES (
            v_sale_id, p_business_id, v_prod.id, v_prod.name,
            v_prod.selling_price, v_prod.cost_price, (v_item->>'quantity')::INTEGER,
            COALESCE((v_item->>'item_discount')::BIGINT, 0), v_item_subtotal
        );

        -- Kurangi stok produk
        UPDATE products 
        SET stock_quantity = stock_quantity - (v_item->>'quantity')::INTEGER,
            updated_at = now()
        WHERE id = v_prod.id;

        -- Catat Buku Besar Mutasi Stok
        INSERT INTO stock_movements (
            business_id, product_id, movement_type, quantity_delta,
            previous_quantity, new_quantity, reference_id
        ) VALUES (
            p_business_id, v_prod.id, 'SALE', -(v_item->>'quantity')::INTEGER,
            v_prod.stock_quantity, v_prod.stock_quantity - (v_item->>'quantity')::INTEGER, v_sale_id
        );
    END LOOP;

    -- 5. Hitung Total Akhir & Perbarui Header
    v_total := GREATEST(0, v_subtotal - p_discount_amount);
    UPDATE sales 
    SET subtotal_amount = v_subtotal, total_amount = v_total 
    WHERE id = v_sale_id;

    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'invoice_number', p_invoice_number,
        'subtotal_amount', v_subtotal,
        'discount_amount', p_discount_amount,
        'total_amount', v_total
    );
END;
$$;
```

#### 3. Kriteria Penerimaan (Acceptance Criteria)
- [ ] Transaksi penjualan dipanggil melalui `supabase.rpc('record_sale_transaction', payload)`.
- [ ] Jika salah satu item gagal (misal stok kurang pada item ke-5 dari 5 item), seluruh operasi rollback $100\%$; tidak ada header sale atau mutasi stok palsu yang tersisa.

---

### Temuan AUD-P0-04: Potensi Deadlock pada Penguncian Baris Multi-Item

#### 1. Akar Masalah & Skenario Deadlock
Ketika dua transaksi kasir berjalan hampir bersamaan:
- **Transaksi 1 (Kasir A):** Menjual Produk 1 dan Produk 2.
- **Transaksi 2 (Kasir B):** Menjual Produk 2 dan Produk 1.
Jika penguncian baris (`FOR UPDATE`) tidak diurutkan:
- Kasir A berhasil mengunci baris Produk 1 dan meminta kunci Produk 2.
- Kasir B berhasil mengunci baris Produk 2 dan meminta kunci Produk 1.
Kedua transaksi saling menunggu tanpa akhir, memicu error PostgreSQL `40P01 deadlock detected` dan salah satu kasir mendapati error sistem mendadak.

#### 2. Usulan Koreksi Konkret
Di dalam fungsi stored procedure `record_sale_transaction` dan `record_purchase_transaction`, seluruh ID produk yang terlibat **wajib diurutkan secara strictly ascending**:
```sql
-- Penguncian Baris Deterministik: Selalu mengunci produk dari ID terkecil ke terbesar
PERFORM id FROM products 
WHERE business_id = p_business_id 
  AND id IN (SELECT (item->>'product_id')::UUID FROM jsonb_array_elements(p_items) AS item)
ORDER BY id ASC
FOR UPDATE;
```
Karena urutan penguncian selalu `Produk 1 -> Produk 2`, Kasir B akan menunggu Kasir A menyelesaikan transaksinya secara tertib tanpa pernah terjadi circular wait (deadlock).

#### 3. Kriteria Penerimaan (Acceptance Criteria)
- [ ] Simulasi 10 transaksi paralel dengan urutan item acak berjalan sukses tanpa menghasilkan error `deadlock detected`.

---

### Temuan AUD-P0-05: Ambiguitas Alokasi Diskon Transaksi ke Baris Item

#### 1. Akar Masalah & Rekonsiliasi Finansial
Pada `docs/api-contracts.md` dan PRD, terdapat dua jenis diskon:
1. Diskon per-item (misal: Diskon Rp 2.000 untuk Sabun).
2. Diskon per-transaksi (misal: Potongan Kupon Rp 10.000 untuk total belanja).
Jika diskon transaksi Rp 10.000 hanya disimpan pada tabel header `sales` dan tidak dialokasikan ke `sale_items`:
- Saat pemilik toko melihat **Laporan Performa Produk** (dihitung dari `sale_items`), total omzet produk adalah Rp 100.000.
- Saat pemilik toko melihat **Laporan Ringkasan Penjualan** (dihitung dari `sales`), total omzet adalah Rp 90.000.
Timbul selisih Rp 10.000 yang membingungkan pengguna dan melanggar prinsip: *"Laporan harus dapat direkonsiliasi hingga ke data sumber"*.

#### 2. Usulan Koreksi Konkret: Largest Remainder Allocation
Terapkan aturan alokasi diskon transaksi ke baris item secara proporsional menggunakan algoritma alokasi bilangan bulat (*Hamilton / Largest Remainder Method*):
$$\text{Item Proportional Discount} = \text{ROUND}\left( \text{Transaction Discount} \times \frac{\text{Item Subtotal}}{\text{Sum of All Item Subtotals}} \right)$$
Selisih pembulatan (1 atau 2 Rupiah) dibebankan ke item dengan subtotal terbesar sehingga:
$$\sum_{i=1}^{n} \text{Allocated Item Discount}_i = \text{Transaction Discount}$$
Dengan cara ini:
- `sale_items.net_amount` mencerminkan harga riil setelah seluruh diskon.
- Laporan per produk dan laporan per nota cocok hingga Rp 0.

#### 3. Kriteria Penerimaan (Acceptance Criteria)
- [ ] Penjualan dengan diskon transaksi Rp 10.000 menghasilkan akumulasi `sale_items.discount_amount` tepat Rp 10.000.
- [ ] Total Laba Kotor dari rekapitulasi `sale_items` sama persis dengan total Laba Kotor pada dashboard ringkasan nota.

---

## 4. Analisis Temuan P1 & P2

### AUD-P1-01: Valuasi HPP saat Pembatalan Penjualan (Sale Void) Pasca-Restock
- **Kondisi:** Toko menjual 5 unit @ HPP snapshot Rp 10.000. Keesokan harinya, toko restock 10 unit @ Rp 16.000 (HPP rata-rata baru menjadi Rp 14.000). Kemudian, penjualan pertama dibatalkan (Void).
- **Aturan Baku VeyraOS:** 
  1. Unit yang dibatalkan dikembalikan ke kuantitas stok fisik (`products.stock_quantity += 5`).
  2. Nilai `products.cost_price` saat ini **tidak dihitung ulang secara retroaktif** agar tidak memicu cascading effect pada penjualan-penjualan lain yang terjadi di antaranya.
  3. Laba kotor pada laporan periode awal dikoreksi dengan membatalkan pengakuan HPP dari snapshot nota yang dibatalkan ($5 \times \text{Rp } 10.000 = \text{Rp } 50.000$).

### AUD-P1-02: Next.js 15 Asynchronous Request APIs
- Di Next.js 15, pemanggilan fungsi `cookies()`, `headers()`, dan parameter rute bersifat asynchronous:
  ```typescript
  // Next.js 14 (Lama)
  const cookieStore = cookies();
  // Next.js 15 (Wajib)
  const cookieStore = await cookies();
  ```
  Seluruh utilitas client/server Supabase (`@supabase/ssr`) wajib menggunakan pola async ini untuk mencegah runtime warning dan bug sesi.

### AUD-P1-03: Mitigasi Inaktivitas Supabase Free Tier (7-Day Pause)
- Instance Supabase pada paket gratis berhenti otomatis (*paused*) jika tidak menerima query selama 7 hari berturut-turut.
- **Rencana Tindakan:** Pada dokumen deployment, dokumentasikan prosedur unpause satu-klik melalui dashboard Supabase dan rekomendasi setup GitHub Actions scheduled ping mingguan selama masa pengujian aktif.

### AUD-P2-01: Penanganan Korupsi LocalStorage Mode Demo
- Fungsi inisialisasi state Mode Demo di browser wajib dibungkus blok pelindung:
  ```typescript
  export function loadDemoState(): DemoState {
    try {
      const raw = localStorage.getItem('veyraos_demo_data');
      if (!raw) return getDefaultSeedData();
      return JSON.parse(raw);
    } catch {
      // Jika JSON korup atau kuota storage penuh, reset ke default seed otomatis
      return getDefaultSeedData();
    }
  }
  ```

---

## 5. Checklist Kesiapan Implementasi (Implementation Readiness Checklist)

Sebelum baris kode aplikasi pertama ditulis pada Phase 4:

### A. Keamanan & Multi-Tenant
- [x] RLS dirancang aktif pada seluruh tabel bisnis.
- [x] Temuan P0-01 (Composite Foreign Key pada `sale_items` dan `purchase_items`) telah dipetakan ke DDL.
- [x] Temuan P0-02 (Perbaikan `search_path = public, auth` dan Trigger kepemilikan bisnis) telah siap dimasukkan ke file migrasi.
- [x] Variabel rahasia `SUPABASE_SERVICE_ROLE_KEY` dikarantina di sisi server.

### B. Integritas Finansial & Transaksi
- [x] Seluruh nilai uang menggunakan `BIGINT` integer IDR.
- [x] Temuan P0-03 (Stored Procedure PL/pgSQL untuk `record_sale_transaction`) telah dirancang untuk menjamin atomisitas ACID.
- [x] Temuan P0-04 (Penguncian baris deterministik `ORDER BY id ASC FOR UPDATE`) telah diintegrasikan untuk mencegah deadlock.
- [x] Temuan P0-05 (Formula alokasi diskon transaksi Largest Remainder) telah disepakati.
- [x] Segregasi tegas antara Beban Operasional dan Pembelian Stok telah terverifikasi.

### C. Isolasi Mode Demo
- [x] Mode Demo berjalan murni di browser (*Client-Side Sandboxing*).
- [x] Mekanisme reset instan dan recovery LocalStorage telah dirancang.
- [x] Dipastikan tidak ada koneksi database nyata yang dipanggil dari `/demo/*`.

---

## 6. Klasifikasi Akhir & Rekomendasi Langkah Selanjutnya

### Klasifikasi: **READY WITH CONDITIONS (ALL CONDITIONS RESOLVED IN CANONICAL DOCS)**
Arsitektur teknis VeyraOS dinyatakan **Layak Masuk Tahap Implementasi**, karena seluruh **5 penyesuaian P0 dan temuan P1 telah direkonsiliasi secara penuh ke dalam dokumen kanonikal**.

### Rekomendasi Langkah Selanjutnya (Phase 4):
1. Memulai **Phase 4: Stage 1 (Fondasi Project & Repository)**:
   - Inisialisasi Next.js 15, TypeScript strict, Tailwind CSS dengan token Royal Violet, dan Vitest.
   - Mengikuti panduan kanonikal tanpa melompat ke implementasi database atau fitur bisnis.

---

## 7. Matriks Ketertelusuran Kanonikal (Traceability Matrix)

Matriks berikut memetakan setiap temuan audit arsitektur (P0, P1, P2) ke dokumen kanonikal yang berwenang, status integrasi dokumen, dan status verifikasi runtime pengujian:

| ID Temuan | Prioritas | Area | Dokumen Kanonikal & Seksi Berwenang | Ringkasan Resolusi yang Direkonsiliasi | Status Dokumen Kanonikal | Status Verifikasi Runtime |
|---|---|---|---|---|---|---|
| **AUD-P0-01** | **P0** | Multi-Tenant Data Isolation | [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md#L273-L327) & [`docs/security-and-rls.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/security-and-rls.md#L125-L167) | Menambahkan kolom `business_id` ke `sale_items` dan `purchase_items`, serta menerapkan composite foreign key `(business_id, product_id) REFERENCES products(business_id, id)` untuk mencegah manipulasi produk lintas tenant. | **Terekonsiliasi Penuh** | Menunggu Uji CI Tahap 4 Stage 2 (SEC-03) |
| **AUD-P0-02** | **P0** | Database RLS & Ownership | [`docs/security-and-rls.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/security-and-rls.md#L64-L108) & [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md#L345-L364) | Memperbaiki `SET search_path = public, auth` pada fungsi `is_business_member()`, dan menambahkan PostgreSQL trigger `trg_after_business_insert` dengan `SECURITY DEFINER` untuk mendaftarkan pemilik ke `business_members`. | **Terekonsiliasi Penuh** | Menunggu Uji CI Tahap 4 Stage 2 (SEC-01/02) |
| **AUD-P0-03** | **P0** | ACID Concurrency & Atomicity | [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md#L368-L470), [`docs/technical-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/technical-architecture.md#L93-L125), & [`docs/api-contracts.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/api-contracts.md#L130-L160) | Mengemas transaksi penjualan, pembelian, dan pembatalan (void) ke dalam Stored Procedure PL/pgSQL (`record_sale_transaction`, `record_purchase_transaction`, `void_sale_transaction`) yang dipanggil via `supabase.rpc()`. | **Terekonsiliasi Penuh** | Menunggu Uji CI Tahap 4 Stage 6 (ITC-03) |
| **AUD-P0-04** | **P0** | Deadlock Prevention | [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md#L400-L408) & [`docs/testing-strategy.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/testing-strategy.md#L50-L65) | Menerapkan penguncian baris produk deterministik secara ascending: `ORDER BY id ASC FOR UPDATE` pada seluruh stored procedure mutasi multi-item guna meniadakan risiko circular wait. | **Terekonsiliasi Penuh** | Menunggu Uji Stress Concurrency Tahap 4 Stage 6 (ITC-01) |
| **AUD-P0-05** | **P0** | Financial Reconciliation | [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md#L430-L450), [`docs/technical-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/technical-architecture.md#L140-L155), & [`docs/testing-strategy.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/testing-strategy.md#L45-L55) | Mengadopsi algoritma Largest Remainder Method (Hamilton Method) untuk mengalokasikan diskon transaksi per item dengan tie-breaker subtotal terbesar, menjamin rekonsiliasi matematis Rp 0 antara header nota dan baris item. | **Terekonsiliasi Penuh** | Menunggu Uji Unit Vitest Tahap 4 Stage 6 (UTC-05) |
| **AUD-P0-06** | **P0** | Serverless Idempotency | [`docs/database-implementation-plan.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-implementation-plan.md#L39-L43) & [`docs/api-contracts.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/api-contracts.md#L130-L140) | Menambahkan tabel `idempotency_keys` untuk menyimpan hasil transaksi per bisnis secara permanen di database, meniadakan kegagalan deteksi order ganda pada lingkungan serverless/mobile yang stateless. | **Terekonsiliasi Penuh** | Menunggu Uji Integrasi Tahap 4 Stage 6 (DB-IDEM-01) |
| **AUD-P0-07** | **P0** | Direct Mutation Security | [`docs/database-implementation-plan.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-implementation-plan.md#L45-L55) & [`docs/security-and-rls.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/security-and-rls.md#L125-L167) | Mencabut hak direct client write (`INSERT, UPDATE, DELETE`) dari tabel `stock_movements`, `sale_items`, dan `purchase_items`; seluruh mutasi wajib melalui stored procedure berhak `SECURITY DEFINER`. | **Terekonsiliasi Penuh** | Menunggu Uji Keamanan Tahap 4 Stage 2 (DB-SEC-02/03) |
| **AUD-P1-01** | **P1** | HPP Valuation & Void | [`docs/database-schema.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/database-schema.md#L500-L540), [`docs/api-contracts.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/api-contracts.md#L160-L175), & [`docs/testing-strategy.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/testing-strategy.md#L55-L65) | Menegaskan bahwa pembatalan penjualan mengembalikan kuantitas fisik persediaan dan membatalkan pengakuan HPP nota, namun tidak menghitung ulang moving average cost saat ini secara retroaktif. | **Terekonsiliasi Penuh** | Menunggu Uji Unit Vitest Tahap 4 Stage 6 (UTC-06) |
| **AUD-P1-02** | **P1** | Framework Compatibility | [`docs/technical-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/technical-architecture.md#L125-L145) | Menyesuaikan seluruh pola pemanggilan cookies dan headers ke bentuk asynchronous (`await cookies()`) sesuai standar Next.js 15. | **Terekonsiliasi Penuh** | Menunggu Build Tahap 4 Stage 1 |
| **AUD-P1-03** | **P1** | Infrastructure Liveness | [`docs/technical-architecture.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/technical-architecture.md#L25-L35) | Mendokumentasikan mitigasi auto-pause 7 hari pada Supabase Free Tier dan workflow ping mingguan. | **Terekonsiliasi Penuh** | Terverifikasi di dokumentasi |
| **AUD-P2-01** | **P2** | Demo Mode Resilience | [`docs/architecture-audit.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/architecture-audit.md#L385-L400) | Menambahkan penanganan `try/catch` auto-fallback ke seed data default jika LocalStorage mengalami korupsi atau kuota penuh. | **Terekonsiliasi Penuh** | Menunggu Uji Playwright Tahap 4 Stage 9 |
| **AUD-P2-02** | **P2** | POS Pricing UX | [`docs/ui-ux-specification.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/ui-ux-specification.md#L110-L125) | Menegaskan bahwa peringatan harga jual < harga pokok bersifat non-blocking agar kasir tidak terhambat. | **Terekonsiliasi Penuh** | Terverifikasi di dokumentasi |

> **Catatan Penegasan Integritas:** Tidak ada satu pun pengujian runtime yang dinyatakan "lulus" atau "terverifikasi" sebelum kode aplikasi dan script pengujian dieksekusi secara nyata pada Phase 4. Semua status saat ini diklasifikasikan sebagai **Terekonsiliasi pada Dokumentasi Kanonikal** dan **Menunggu Eksekusi Runtime**.

