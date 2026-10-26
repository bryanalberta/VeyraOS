# VeyraOS --- Comprehensive Testing & Reliability Strategy

**Versi:** 1.0  
**Status:** Usulan Strategi Pengujian (Phase 3 Testing Baseline - UNEXECUTED PROPOSAL)  
**Produk:** VeyraOS  
**Alat Pengujian:** Vitest (Unit & Integrasi Domain) + Playwright (End-to-End & Isolasi Browser)  

---

## 1. Piramida & Matriks Pengujian

```
           / \
          /   \
         / E2E \         Playwright: Alur Kasir Lengkap, Ganti Bisnis, Mode Demo
        /-------\
       / Integrasi\      Vitest + Supabase Local Test Container: RLS & Stored Procedures
      /------------\
     /  Unit Domain \    Vitest: Kalkulasi Moving Avg HPP, Diskon, Arus Kas, Integer IDR
    /----------------\
```

---

## 2. Rincian Pengujian Unit Logika Finansial (Unit Testing)

### 2.1 Kalkulasi Moving Weighted Average Cost
- **Kasus Uji UTC-01: Stok Awal Nol:**
  - Skenario: Produk baru dengan stok 0. Pembelian restock pertama: 10 unit @ Rp 10.000.
  - Hasil Diharapkan: `new_cost_price = Rp 10.000`, `new_stock = 10`.
- **Kasus Uji UTC-02: Pembelian dengan Harga Berbeda:**
  - Skenario: Stok saat ini 10 unit @ Rp 10.000. Pembelian baru: 10 unit @ Rp 12.000.
  - Formula: $\frac{(10 \times 10.000) + (10 \times 12.000)}{20} = \frac{100.000 + 120.000}{20} = \frac{220.000}{20} = 11.000$.
  - Hasil Diharapkan: `new_cost_price = Rp 11.000`, `new_stock = 20`.
- **Kasus Uji UTC-03: Pembulatan Bilangan Bulat Rupiah:**
  - Skenario: 3 unit @ Rp 10.000 ($30.000$) + beli 2 unit @ Rp 11.000 ($22.000$). Total nilai: $52.000 / 5 = 10.400$.
  - Skenario Pecahan: 3 unit @ Rp 10.000 ($30.000$) + beli 4 unit @ Rp 11.250 ($45.000$). Total: $75.000 / 7 = 10.714,28...$
  - Hasil Diharapkan: Pembulatan standar `Math.round()` menjadi integer **Rp 10.714**. Tidak ada sisa pecahan sen.

### 2.2 Konsistensi Hubungan Laba & Arus Kas
- **Kasus Uji UTC-04: Segregasi Pembelian Stok vs. Beban Operasional:**
  - Input: Penjualan Rp 10.000.000 (HPP barang terjual Rp 6.000.000). Pengeluaran sewa Rp 1.000.000. Pembelian restock stok baru Rp 3.000.000.
  - Validasi Laba Kotor: $\text{Rp 10.000.000} - \text{Rp 6.000.000} = \textbf{Rp 4.000.000}$.
  - Validasi Laba Operasional: $\text{Rp 4.000.000} - \text{Rp 1.000.000} = \textbf{Rp 3.000.000}$ (Pembelian stok Rp 3.000.000 **dilarang memotong** laba operasional).
  - Validasi Arus Kas Bersih: $\text{Kas Masuk (Rp 10.000.000)} - \text{Kas Keluar (Rp 1.000.000 + Rp 3.000.000)} = \textbf{Rp 6.000.000}$.

- **Kasus Uji UTC-05: Rekonsiliasi Alokasi Diskon Transaksi (Largest Remainder Method):**
  - Skenario: Penjualan 3 item: Item A (Rp 50.000), Item B (Rp 30.000), Item C (Rp 20.000). Total subtotal = Rp 100.000. Diskon transaksi = Rp 15.000.
  - Alokasi:
    - Item A: $15.000 \times (50.000 / 100.000) = \text{Rp } 7.500$.
    - Item B: $15.000 \times (30.000 / 100.000) = \text{Rp } 4.500$.
    - Item C: $15.000 \times (20.000 / 100.000) = \text{Rp } 3.000$.
  - Validasi: $\text{Rp } 7.500 + 4.500 + 3.000 = \textbf{Rp 15.000}$ (Tepat 0 selisih).
  - Subtotal Item Setelah Diskon: Item A (Rp 42.500) + Item B (Rp 25.500) + Item C (Rp 17.000) = **Rp 85.000** (Persis sama dengan `sales.total_amount`).

- **Kasus Uji UTC-06: Valuasi HPP Pembatalan Penjualan Pasca-Restock:**
  - Skenario: Penjualan 5 unit @ HPP snapshot Rp 10.000 dibatalkan setelah toko melakukan restock 10 unit baru @ Rp 16.000 (Moving average cost saat ini Rp 14.000).
  - Validasi:
    - Stok fisik bertambah $+5$ unit.
    - Nilai `products.cost_price` saat ini **tetap Rp 14.000** (tidak dihitung ulang secara retroaktif).
    - HPP pada laporan periode awal dibatalkan sebesar $5 \times \text{Rp } 10.000 = \text{Rp } 50.000$.

---

## 3. Pengujian Integritas Database & Konkurensi (Concurrency & ACID)

### 3.1 Penolakan Stok Negatif & Race Conditions
- **Kasus Uji ITC-01: Dua Transaksi Bersamaan pada Stok Terakhir:**
  - Skenario: Produk A memiliki sisa stok $= 1$. Kasir 1 dan Kasir 2 mengirim request penjualan kuantitas $= 1$ pada milidetik yang sama.
  - Mekanisme Pengujian: Menggunakan `Promise.all([recordSale(Kasir1), recordSale(Kasir2)])`.
  - Hasil Diharapkan:
    - Transaksi pertama berhasil (stok menjadi 0).
    - Transaksi kedua dibatalkan secara bersih dengan error `409 Conflict / STOCK_INSUFFICIENT`.
    - Stok akhir produk tepat **0** (tidak boleh pernah bernilai $-1$).

### 3.2 Pembatalan Penjualan (Sale Void Idempotency)
- **Kasus Uji ITC-02: Pembalikan Stok Tepat Satu Kali:**
  - Skenario: Penjualan 5 unit produk dibatalkan (Void).
  - Validasi: Stok bertambah $+5$ tepat satu kali.
  - Upaya Void Kedua: Memanggil `voidSale()` untuk kedua kalinya pada ID yang sama ditolak dengan error `SALE_ALREADY_VOIDED`; stok tidak bertambah lagi.

### 3.3 Rollback Atomik Transaksi Multi-Item
- **Kasus Uji ITC-03: Rollback Total saat Item ke-N Gagal:**
  - Skenario: Penjualan dengan 3 produk valid (stok cukup) dan 1 produk tidak valid (stok tidak cukup).
  - Hasil Diharapkan: Seluruh transaksi di-rollback secara utuh oleh PostgreSQL. Tidak ada header invoice yang tersimpan, tidak ada baris `sale_items`, dan tidak ada pengurangan stok pada 3 produk yang valid.

### 3.4 Idempotensi Pengiriman Ganda (Double-Submit Prevention)
- **Kasus Uji ITC-04: Request Identik dengan Idempotency Key Sama:**
  - Skenario: Kasir menekan tombol checkout dua kali secara cepat dengan `idempotencyKey` yang sama.
  - Hasil Diharapkan: Transaksi pertama diproses. Request kedua mendeteksi key yang sama dan mengembalikan receipt yang telah dibuat tanpa menduplikasi potongan stok atau nota penjualan.

---

## 4. Pengujian Keamanan & Isolasi RLS (Security Test Suite)

- **Kasus Uji SEC-01: Uji Penetrasi Antar-Tenant (Cross-Tenant Read):**
  - Akun A membuat produk ID `PROD-A`.
  - Akun B mencoba membaca `PROD-A` menggunakan `supabaseClient.from('products').select().eq('id', 'PROD-A')`.
  - Hasil Diharapkan: Hasil query kosong (`data: []`), bukan error bocor atau data produk milik Akun A.

- **Kasus Uji SEC-02: Uji Bypass Manipulasi ID Bisnis:**
  - Akun B mengirim `createSale` dengan `business_id = ID_MILIK_AKUN_A`.
  - Hasil Diharapkan: Ditolak dengan `42501 RLS Policy Violation` atau `403 Forbidden`.

- **Kasus Uji SEC-03: Uji Pelanggaran Composite Foreign Key Lintas-Tenant:**
  - Akun A mencoba menyisipkan `sale_items` dengan `product_id` milik Bisnis B.
  - Hasil Diharapkan: Ditolak oleh PostgreSQL dengan `foreign key constraint violation: fk_sale_items_product_same_tenant` karena `(business_id, product_id)` tidak cocok pada tabel `products`.

- **Kasus Uji SEC-04: Pemanggilan Ilegal Stored Procedure (RPC Guard):**
  - Akun B mencoba memanggil `record_sale_transaction(business_id = ID_MILIK_AKUN_A, ...)`.
  - Hasil Diharapkan: Ditolak di baris pertama stored procedure dengan exception `UNAUTHORIZED_BUSINESS`.

---

## 5. Pengujian Isolasi Mode Demo (Playwright E2E)

- **Kasus Uji DEMO-01: Verifikasi Nol Trafik Database:**
  - Pengguna membuka `/demo/sales/new`, mencatat penjualan simulasi 5 item, dan menambahkan produk baru.
  - Pemantauan Jaringan (Network Interception Playwright): Memverifikasi bahwa tidak ada satu pun request HTTPS `POST` yang dikirim ke domain Supabase produksi.
- **Kasus Uji DEMO-02: Reset Cepat:**
  - Mengklik *"Reset Data Demo"* mengembalikan produk dan transaksi ke kondisi default sembako dalam waktu $< 500$ ms.

---

## 6. Status Eksekusi Pengujian & Matriks Risiko (P0, P1, P2)

> **Pemberitahuan Status:** Seluruh kasus uji yang tercantum di atas adalah **Spesifikasi Kebutuhan Pengujian Arsitektur (Specified Architectural Requirements - UNEXECUTED PROPOSAL)**. Tidak ada pengujian runtime yang diklaim telah dijalankan sebelum kode aplikasi diimplementasikan di Phase 4.

| Tingkat | Risiko Teknis | Dampak | Probabilitas | Kriteria Penerimaan Terukur (P0 Acceptance Criteria) |
|---|---|---|---|---|
| **P0** | **Kebocoran Data Antar-Tenant** | Kritis | Rendah | 100% tes RLS integrasi dan composite FK (SEC-01, SEC-02, SEC-03, SEC-04) lulus otomatis pada CI pipeline sebelum deployment. |
| **P0** | **Stok Negatif Akibat Concurrency** | Tinggi | Sedang | Database CHECK constraint `stock_quantity >= 0` aktif, dan uji stress testing konkurensi (ITC-01 & ITC-03) membuktikan atomisitas ACID penuh. |
| **P0** | **Kesalahan Presisi Uang (Floating-Point)** | Tinggi | Tinggi | Seluruh tabel keuangan menggunakan `BIGINT` dan unit test rekonsiliasi diskon (UTC-05) menghasilkan selisih tepat Rp 0. |
| **P1** | **Database Free-Tier Auto-Pause** | Sedang | Sedang | Ada dokumentasi pemantauan uptime dan prosedur pemulihan jika instance Supabase gratis masuk ke status idle. |
| **P1** | **Gagal Simpan Saat Jaringan Seluler Lemah** | Sedang | Tinggi | Sistem menerapkan `idempotency_key` pada tombol checkout kasir sehingga klik ganda tidak menggandakan transaksi. |
| **P2** | **Waktu Ekspor CSV Melampaui Batas Timeout** | Rendah | Rendah | Ekspor laporan dioptimalkan menggunakan database indexing pada kolom `(business_id, transaction_date)`. |
