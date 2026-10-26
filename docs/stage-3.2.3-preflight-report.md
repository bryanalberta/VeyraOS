# VeyraOS — Preflight & Implementation Plan: Phase 4, Substage 3.2.3 (Revisi Final Terverifikasi)
## Reports & Financial Analytics Service Layer

**Tanggal Revisi Final:** 14 Oktober 2026  
**Status Preflight:** **PREFLIGHT REVISED (FINAL AUDIT) — PENDING APPROVAL**  
**Substage Target:** Phase 4, Substage 3.2.3 — Reports & Financial Analytics Service Layer  
**Prasyarat Hulu (Semua Terverifikasi):**  
- [`docs/stage-3.1.4-validation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.1.4-validation-report.md) (Stage 3.1 Foundations & Monetary Safety — PASS)
- [`docs/stage-3.2.1-validation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.1-validation-report.md) (Substage 3.2.1 Transaction Service Layer — PASS)
- [`docs/stage-3.2.2A-final-closure.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.2A-final-closure.md) (Substage 3.2.2A Product & Inventory Service — PASS WITH CONDITIONS)
- [`docs/stage-3.2.2B-final-closure.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.2B-final-closure.md) (Substage 3.2.2B Operational Expense Service — PASS WITH CONDITIONS)
- [`docs/stage-3.2.2C-validation-report.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/stage-3.2.2C-validation-report.md) (Substage 3.2.2C Business Profile & Tenant Context — PASS WITH CONDITIONS)

**Kondisi Lingkungan Saat Ini:**
- **Kode `src/`:** Tidak diubah pada tahap preflight ini (**UNTOUCHED**).
- **Basis Data Live Supabase:** Bersih / Tanpa Mutasi (**PRISTINE / UNMUTATED**).
- **Server Actions & UI Layer:** Belum dimulai (**DEFERRED TO SUBSEQUENT STAGES**).

---

## 1. Konteks Roadmap & Posisi Arsitektural

Substage 3.2.3 merupakan **pilar penutup dari Service Layer (Phase 4)** sebelum sistem melangkah ke lapisan Next.js Server Actions dan UI/UX. Modul ini bertanggung jawab mengagregasi data dari seluruh domain bisnis yang telah dibangun sebelumnya:
1. Domain Transaksi Penjualan (`sales`, `sale_items`) dari Substage 3.2.1.
2. Domain Pembelian Restock (`inventory_purchases`, `purchase_items`) dari Substage 3.2.1.
3. Domain Katalog & Saldo Persediaan (`products`, `stock_movements`) dari Substage 3.2.2A.
4. Domain Beban Operasional (`expenses`) dari Substage 3.2.2B.
5. Domain Otorisasi Tenant & Profil Usaha (`businesses`, `business_members`) dari Substage 3.2.2C.

---

## 2. Audit Risiko Agregasi Data & Paginasi PostgREST (Reviewer Item A)

### A. Mekanisme PostgREST & Ancaman Truncation terhadap Integritas KPI
1. **Perilaku Default PostgREST (`max-rows`):**
   - Secara default, engine PostgREST di Supabase membatasi hasil kueri `SELECT` pada nilai `max-rows` (standar: 1.000 baris per respons HTTP).
   - Jika sebuah bisnis memiliki 1.250 transaksi pada periode laporan, pemanggilan kueri `.from("sales").select(...)` tanpa penanganan paginasi hanya akan mengembalikan **1.000 baris pertama**.
   - Jika service layer menghitung agregasi finansial (seperti `netSales` atau `cogs`) menggunakan fungsi JavaScript (`reduce` / `map`) atas array hasil kueri tersebut, maka 250 transaksi sisanya akan hilang secara senyap.
   - **Dampak Kritis:** Laporan keuangan akan menampilkan angka yang terdistorsi dan salah saji (*understated revenue / profit*), merusak keandalan finansial (*financial correctness*).

2. **Koreksi Terhadap Asumsi Pembacaan Selektif:**
   - **DITEGASKAN:** Menggunakan pembacaan kolom selektif (`select("id, total_amount")`) atau menambahkan klausa `.limit(5000)` **SAMA SEKALI TIDAK MELINDUNGI DARI PEMOTONGAN DATA (TRUNCATION)**.
   - Begitu volume baris melampaui angka limit apa pun yang dipasang, data tetap terpotong. Oleh karena itu, klaim bahwa pembacaan selektif otomatis aman adalah keliru dan secara resmi ditarik.

3. **Pembedaan Tegas Dua Jenis Kueri:**
   - **Daftar yang Sengaja Dibatasi (*Intentionally Capped Lists*):**
     - `recentTransactions`: Sengaja dibatasi murni 5 transaksi terbaru menggunakan `.order("transaction_date", { ascending: false }).limit(5)`.
     - `lowStockAlerts`: Dibatasi 20 produk teratas dengan rasio stok terendah.
     - `getSalesReport`: Rincian transaksi pada tabel UI yang memang dirancang untuk konsumsi manusia menggunakan paginasi eksplisit `page` dan `pageSize` (default 50 baris per halaman) via `.range(from, to)`.
   - **Sumber Data Agregasi Finansial (*Must-Be-Complete Data Sources*):**
     - Penjualan Bersih (`netSales`), HPP (`cogs`), Beban Operasional (`operatingExpenses`), dan Arus Kas (`cashFlow`).
     - Seluruh metrik KPI ini **wajib merepresentasikan 100% data transaksi** dalam jendela tanggal yang dipilih tanpa ada satu baris pun yang terpotong.

### B. Evaluasi Strategi Solusi & Pemilihan Arsitektur

#### Pilihan 1: Agregasi Kernel PostgreSQL via RPC (Pilihan Utama / Arsitektur Target)
- **Konsep:** Agregasi dijalankan langsung di kernel PostgreSQL menggunakan stored procedure tunggal `get_dashboard_analytics_rpc(p_business_id, p_start_date, p_end_date)`.
- **Keunggulan:**
  - Performa $O(1)$ untuk transfer jaringan: database hanya mengembalikan satu objek JSONB agregat (misal 1 KB), bukan ribuan baris transaksi.
  - Kebal terhadap batas baris PostgREST (`max-rows`).
  - Menghindari beban alokasi memori (heap memory) di Node.js serverless.
  - Memanfaatkan aritmetika integer `BIGINT` native database.
- **Kebutuhan Migrasi (Dependency):** Memerlukan pembuatan migrasi forward-only baru (`supabase/migrations/20261013000012_dashboard_analytics_rpc.sql`).
- **Batasan Tahap Ini:** Karena batasan mutlak melarang pembuatan migrasi SQL pada substage ini, strategi ini **dikunci sebagai Arsitektur Target & Production Readiness Gate**, yang akan diimplementasikan saat gate integrasi database live dibuka.

#### Pilihan 2: Fail-Closed Comprehensive Pagination Loop (Strategi Terpilih Substage 3.2.3)
Untuk memenuhi batasan tanpa migrasi SQL baru pada Substage 3.2.3, service layer akan mengimplementasikan **Paginasi Eksplisit Lengkap dengan Prinsip Fail-Closed**:
1. **Langkah Kerja Algoritma:**
   - Lakukan kueri awal dengan opsi `{ count: 'exact' }` dan `.range(0, 999)`.
   - Ambil `totalCount` dari respons database. Jika `totalCount === 0`, kembalikan agregasi nol seketika.
   - Jika `totalCount > 1000`, jalankan loop paginasi deterministik untuk mengambil halaman-halaman berikutnya (`.range(1000, 1999)`, `.range(2000, 2999)`, dst.) hingga seluruh baris terakumulasi.
2. **Jaminan Anti-Parsial (*Fail-Closed Assertion*):**
   - Setelah loop selesai, lakukan validasi ketat:
     $$\text{assert}(\text{accumulatedRows.length} === \text{totalCount})$$
   - Jika terjadi error pada salah satu halaman (network error, timeout), atau jika `accumulatedRows.length !== totalCount`:
     **HENTIKAN PERHITUNGAN SEKETIKA.** Service layer wajib melempar error `DATA_PAGINATION_INCOMPLETE` dan mengembalikan `ApiResponse` gagal (`success: false`).
   - **Jaminan Mutlak:** **TIDAK ADA SATU PUN KPI YANG DIHITUNG DARI DATA PARSIAL.**
3. **Trade-Off & Batas Skala:**
   - **Kelebihan:** 100% konsisten matematis, tidak membutuhkan migrasi SQL baru, berjalan di lingkungan Supabase saat ini.
   - **Kelemahan & Batas Skala:**
     - Menghasilkan beberapa *network roundtrips* jika transaksi melampaui 1.000 baris.
     - Batas skala rasional untuk Node.js loop ini adalah **maksimal 5.000 transaksi per periode** (cukup untuk toko UMKM MVP dalam rentang 30 hari).
     - Untuk volume di atas 5.000 transaksi/bulan, transisi ke **Pilihan 1 (Database RPC)** menjadi keharusan mutlak sebelum rilis skala besar.

---

## 3. Penetapan Kontrak Arus Kas (*Cash Flow Contracts* — Reviewer Item B)

Berdasarkan skema migrasi aktual dan PRD Bagian 4.8:

### A. Definisi Sumber Data Arus Kas

| Komponen Arus Kas | Tabel Sumber | Kolom SQL Aktual | Kondisi / Filter Wajib | Keterangan & Batasan Skema |
|---|---|---|---|---|
| **Kas Masuk (*Cash Inflows*)** | `sales` | `total_amount`, `payment_method`, `status` | `status = 'COMPLETED'` dan `transaction_date` $\in [T_{\text{start}}, T_{\text{next\_start}})$ | Seluruh penjualan `COMPLETED` pada MVP berstatus lunas seketika (`CASH` atau `BANK_TRANSFER`). Transaksi `VOIDED` dikeluarkan. |
| — Kas Tunai | `sales` | `total_amount` | `status = 'COMPLETED'` AND `payment_method = 'CASH'` | Rincian kas fisik di laci kasir. |
| — Kas Bank / Transfer | `sales` | `total_amount` | `status = 'COMPLETED'` AND `payment_method = 'BANK_TRANSFER'` | Rincian penerimaan rekening bank toko. |
| **Kas Keluar (*Cash Outflows*)** | `expenses` & `inventory_purchases` | `expenses.amount`, `inventory_purchases.total_cost` | `expense_date` $\in [T_{\text{start}}, T_{\text{next\_start}})$ & `purchase_date` $\in [T_{\text{start}}, T_{\text{next\_start}})$ | Penjumlahan dari Beban Operasional ditambah Pembelian Persediaan. |
| — Beban Operasional | `expenses` | `amount` | `expense_date` $\in [T_{\text{start}}, T_{\text{next\_start}})$ | Pengeluaran biaya operasional berjalan. |
| — Pembelian Persediaan | `inventory_purchases` | `total_cost` | `purchase_date` $\in [T_{\text{start}}, T_{\text{next\_start}})$ | Modal kas keluar untuk restock barang. |
| **Arus Kas Bersih (*Net Cash Flow*)** | Kalkulasi | $\text{Cash Inflows} - \text{Cash Outflows}$ | Sesuai rentang periode | Selisih kas riil masuk dan keluar. |

### B. Aturan Anti-Kontaminasi Finansial
1. **Pembelian Persediaan $\neq$ HPP $\neq$ Beban Operasional:**
   - Pembelian persediaan (`inventory_purchases`) dicatat sebagai **Arus Kas Keluar** pada saat dibeli (`purchase_date`).
   - Pembelian persediaan **TIDAK BOLEH** dicatat sebagai HPP pada saat dibeli. HPP hanya diakui atas barang yang terjual melalui `sale_items.unit_cost_price`.
   - Pembelian persediaan **TIDAK BOLEH** dicatat sebagai Beban Operasional (`expenses`).
2. **Transaksi `VOIDED` Tidak Dihitung sebagai Penerimaan Kas:**
   - Nota yang dibatalkan (`status = 'VOIDED'`) membatalkan transaksi asli. Karena seluruh penjualan MVP berstatus lunas saat dibuat, pembatalan nota berarti penerimaan kas tersebut batal/dikembalikan. Oleh karena itu, transaksi `VOIDED` **dikeluarkan dari `cashInflows`**.
3. **Verifikasi Kolom Tanggal Dasar Periode:**
   - Penjualan: `sales.transaction_date` (`TIMESTAMPTZ`).
   - Beban Operasional: `expenses.expense_date` (`TIMESTAMPTZ`).
   - Pembelian Stok: `inventory_purchases.purchase_date` (`TIMESTAMPTZ`).
   - Mutasi Stok: `stock_movements.created_at` (`TIMESTAMPTZ`).
   - Posisi Persediaan Berjalan: `products.stock_quantity` & `products.cost_price` (real-time snapshot saat kueri dijalankan; tidak ada historis tanggal pada tabel master produk).

### C. Keterbatasan Skema Aktual yang Didokumentasikan
1. **Ketiadaan Status Pembayaran pada Pembelian:** Tabel `inventory_purchases` tidak memiliki kolom `payment_status` atau `payment_method`. Pada MVP VeyraOS, seluruh pembelian restock yang dicatat diasumsikan sebagai pengeluaran kas lunas pada tanggal pembelian (tidak ada modul utang dagang / *accounts payable*).
2. **Ketiadaan Modul Piutang Penjualan:** Seluruh penjualan berstatus `COMPLETED` diasumsikan lunas seketika melalui tunai atau transfer. Tidak ada modul piutang (*accounts receivable*).
3. **Ketiadaan Saldo Kas Awal:** MVP VeyraOS mencatat mutasi arus kas bersih periode berjalan ($\Delta \text{Cash}$), bukan saldo kas kumulatif di neraca. Hal ini dicatat secara transparan agar tidak disalahartikan sebagai laporan arus kas PSAK lengkap.

---

## 4. Sumber Kebenaran Diskon & Konsistensi Hamilton (Reviewer Item C)

### A. Rekonsiliasi Struktur Diskon pada Database Aktual

Berdasarkan pembuktian statis kode PL/pgSQL pada migrasi `supabase/migrations/20261013000009_stored_procedures.sql`:
- **Baris 170:**
  `v_item_gross := (v_qty::BIGINT * v_prod.selling_price) - v_item_discount;`
- **Baris 171:**
  `v_total_gross_subtotal := v_total_gross_subtotal + v_item_gross;`
- **Baris 208:**
  `v_total_amount := v_total_gross_subtotal - p_discount_amount;`
- **Baris 214–215:**
  `INSERT INTO public.sales (..., subtotal_amount, discount_amount, total_amount, ...)`
  `VALUES (..., v_total_gross_subtotal, p_discount_amount, v_total_amount, ...)`
- **Baris 242:**
  `v_line_total_discount := v_item_discount + v_item_prop_disc;`
- **Baris 243:**
  `v_line_subtotal := (v_qty::BIGINT * v_prod.selling_price) - v_line_total_discount;`
- **Baris 248–249:**
  `INSERT INTO public.sale_items (..., discount_amount, subtotal_amount)`
  `VALUES (..., v_line_total_discount, v_line_subtotal)`

### B. Pembuktian Statis: Apa yang Disimpan di `sale_items.discount_amount`?
Dari Baris 242 di atas terbukti 100% secara statis:
$$\text{sale\_items.discount\_amount} \equiv \text{v\_item\_discount (diskon per-item)} + \text{v\_item\_prop\_disc (alokasi diskon nota)}$$
Kolom `sale_items.discount_amount` **SUDAH MENCATAT AKUMULASI PENUH** dari diskon per item ditambah alokasi diskon transaksi proporsional.

### C. Satu Formula Terpadu Anti-Double-Counting untuk Laporan
Untuk memastikan laporan keuangan VeyraOS tidak pernah menghitung diskon yang sama dua kali:

$$\text{Gross Sales} = \sum_{\text{completed}} (\text{sale\_items.quantity} \times \text{sale\_items.unit\_selling\_price})$$
$$\text{Total Discounts} = \sum_{\text{completed}} \text{sale\_items.discount\_amount}$$
$$\text{Net Sales} = \text{Gross Sales} - \text{Total Discounts}$$

**Bukti Identitas Matematis:**
$$\text{Net Sales} = \sum_{\text{completed}} \text{sale\_items.subtotal\_amount} \equiv \sum_{\text{completed}} \text{sales.total\_amount}$$

Jika laporan ingin memecah rincian diskon:
- **Diskon Transaksi (Nota):** $\sum_{\text{completed}} \text{sales.discount\_amount}$
- **Diskon Item Produk:** $\left(\sum_{\text{completed}} \text{sale\_items.discount\_amount}\right) - \left(\sum_{\text{completed}} \text{sales.discount\_amount}\right)$
- **Total Diskon:** $\sum_{\text{completed}} \text{sale\_items.discount\_amount}$

> [!CAUTION]
> **Larangan Mutlak:** Dilarang menjumlahkan `sales.discount_amount + sale_items.discount_amount`. Tindakan tersebut menggandakan nilai diskon nota.

### D. Status Migrasi Alokasi Diskon
- Migrasi `20261013000010_reconcile_discount_allocation.sql` (algoritma True Largest Remainder Hamilton penuh dengan penanganan produk duplikat) berstatus **UNEXECUTED / BELUM DIJALANKAN PADA SUPABASE LIVE**.
- Skema yang aktif di basis data lokal saat ini adalah migrasi 009 (varian *Largest Subtotal Absorber*).
- Keduanya mematuhi invarian relasional bahwa total alokasi diskon persis sama dengan `sales.discount_amount` tanpa selisih Rp 1 pun, sehingga formula di atas berlaku valid pada kedua implementasi. Migrasi 010 tetap dicatat sebagai dependensi yang belum dieksekusi.

---

## 5. Penguatan Kontrak CSV & Perlindungan Formula Injection (Reviewer Item D)

### A. Pembedaan Tipe Data Numerik vs Teks
Pipeline generator CSV memisahkan tipe data secara deterministik sebelum format baris dibuat:
1. **Nilai Numerik Moneter & Kuantitas (`number`):**
   - Kolom: `quantity`, `unitSellingPrice`, `unitCostPrice`, `subtotalAmount`, `discountAmount`, `totalAmount`, `operatingProfit`, `netCashFlow`, `stockQuantity`.
   - **Aturan:** Diekspor murni sebagai representasi string angka `${value}`.
   - **Perlakuan Angka Negatif Sah:** Angka negatif seperti `-150000` atau `-25` **DILARANG DISANITASI** dengan kutip tunggal. Nilai tersebut tetap diekspor sebagai `-150000` agar formula matematis dan grafik di aplikasi spreadsheet pengguna dapat membaca nilai tersebut sebagai tipe data numerik (*Number*), bukan teks (*String*).
2. **Nilai Teks Bebas (`string`):**
   - Kolom: `invoiceNumber`, `name`, `category`, `notes`, `supplierName`, `paymentMethod`, `status`, `voidReason`.
   - Melalui pipeline sanitasi teks dan escaping RFC 4180.

### B. Mitigasi CSV Formula Injection (CWE-1236)
1. **Karakter Pemicu Formula Dinamis:**
   Himpunan karakter pemicu: `{ '=', '+', '-', '@', '\t', '\r' }`.
2. **Pendeteksian Bersih:**
   - Teks string diperiksa karakternya. Untuk menangani penyerang yang menyamarkan formula menggunakan spasi awal, teks di-trim sementara untuk mendeteksi karakter pemicu.
   - Jika teks asli (atau teks setelah di-trim) diawali oleh salah satu karakter pemicu di atas:
     String teks tersebut diberi **prefix tanda kutip tunggal (`'`)**.
   - Contoh Konkret Transformasi:
     - `=SUM(A1:A5)` $\rightarrow$ `'=SUM(A1:A5)`
     - `   =1+1` $\rightarrow$ `'   =1+1`
     - `\t@evil` $\rightarrow$ `'\t@evil`
     - `\r-calc` $\rightarrow$ `'\r-calc`
     - `+cmd|' /C calc'!A0` $\rightarrow$ `'+cmd|' /C calc'!A0`
     - `@SUM(1,2)` $\rightarrow$ `'@SUM(1,2)`
3. **Escaping RFC 4180:**
   - Setelah sanitasi teks, jika field teks mengandung koma (`,`), tanda kutip ganda (`"`), atau baris baru (`\n` / `\r`):
     - Seluruh isi field dibungkus dengan kutip ganda (`"..."`).
     - Tanda kutip ganda di dalam field di-escape menjadi dua kutip ganda berturutan (`""`).
     - Contoh: `Beras "Super", Pandan` $\rightarrow$ `"Beras ""Super"", Pandan"`.
4. **Header UTF-8 Byte Order Mark (BOM):**
   - Setiap berkas CSV yang dihasilkan disematkan byte `\uFEFF` di awal string buffer.
   - Menjamin Microsoft Excel pada Windows (khususnya locale Indonesia) mendeteksi encoding UTF-8 tanpa merusak karakter khusus.
5. **Pernyataan Batasan Sanitasi (*Disclaimer*):**
   - Format CSV pada dasarnya adalah teks polos (*flat delimited text*) yang tidak memiliki spesifikasi tipe data eksekusi bawaan.
   - Pemberian prefix tanda kutip tunggal (`'`) adalah mitigasi standar industri untuk Microsoft Excel dan Google Sheets, namun **bukan jaminan universal mutlak** terhadap seluruh aplikasi pihak ketiga atau parser kustom pembaca CSV di dunia.

---

## 6. Audit Zona Waktu & Batas Waktu Kalender (`Asia/Jakarta`)

1. **Zona Waktu Bisnis:** Seluruh operasi pelaporan menggunakan zona waktu `Asia/Jakarta` (UTC+7).
2. **Interval Setengah Terbuka $[T_{\text{start}}, T_{\text{next\_start}})$:**
   - Input tanggal `startDate = "2026-10-01"` dan `endDate = "2026-10-07"`:
     - Batas Bawah (*Inclusive*): `2026-10-01T00:00:00.000+07:00` $\equiv$ `2026-09-30T17:00:00.000Z`
     - Batas Atas (*Exclusive*): `2026-10-08T00:00:00.000+07:00` $\equiv$ `2026-10-07T17:00:00.000Z`
   - Kueri Supabase: `.gte("transaction_date", startUtc).lt("transaction_date", nextDayUtc)`.
   - Mencegah kehilangan transaksi mikrodetik (`.999500`) dan menjamin interval bersambung mulus.
3. **Validasi:** Penolakan `startDate > endDate` dengan `VALIDATION_ERROR` sebelum kueri dieksekusi.

---

## 7. Rencana Pengujian Unit Mock Komprehensif (36 Skenario Uji)

Pengujian akan disusun di `src/services/reports/report.service.test.ts` menggunakan Mock Supabase Client terisolasi:

```
src/services/reports/report.service.test.ts
├── 1. Otorisasi & Validasi Input (6 Skenario)
│   ├── 1.1 Menolak pengguna tidak terautentikasi (UNAUTHENTICATED)
│   ├── 1.2 Menolak akses pengguna non-anggota tenant (UNAUTHORIZED_BUSINESS)
│   ├── 1.3 Menolak format UUID bisnis tidak valid (VALIDATION_ERROR)
│   ├── 1.4 Menolak rentang tanggal terbalik (startDate > endDate)
│   ├── 1.5 Menolak format tanggal non-ISO 8601
│   └── 1.6 Menerapkan interval setengah terbuka default 30 hari jika tanggal omitted
├── 2. Rekonsiliasi Finansial Dashboard (8 Skenario)
│   ├── 2.1 Menghitung netSales dari sales.total_amount secara presisi
│   ├── 2.2 Menghitung COGS dari sale_items.quantity * unit_cost_price
│   ├── 2.3 Menghitung grossProfit dan grossProfitMargin dengan benar
│   ├── 2.4 Mengembalikan grossProfitMargin = 0% saat netSales = 0 (tanpa NaN)
│   ├── 2.5 Mengeluarkan transaksi status VOIDED dari netSales dan COGS
│   ├── 2.6 Menghitung operatingExpenses dari expenses.amount
│   ├── 2.7 Membuktikan inventory_purchases TIDAK masuk ke operatingExpenses
│   └── 2.8 Menghitung arus kas (cashInflows, cashOutflows, netCashFlow) akurat
├── 3. Zona Waktu & Batas Waktu Kalender Jakarta (4 Skenario)
│   ├── 3.1 Memvalidasi konversi tanggal kalender Jakarta ke interval setengah terbuka UTC
│   ├── 3.2 Menghitung transaksi tepat pada batas pergantian hari 00:00:00 WIB
│   ├── 3.3 Mengagregasi dailySalesTrend terkelompok per tanggal kalender Jakarta
│   └── 3.4 Menangani hari tanpa omzet (omzet Rp 0) dalam tren harian
├── 4. Deteksi Stok & Laporan Persediaan (4 Skenario)
│   ├── 4.1 Mendeteksi produk dengan stock_quantity <= min_stock_alert sebagai low stock
│   ├── 4.2 Mengeluarkan produk terarsip (is_archived = true) dari low stock alerts
│   ├── 4.3 Menghitung valuasi persediaan modal menggunakan products.cost_price aktual
│   └── 4.4 Menangani empty state toko baru dengan angka Rp 0 tanpa crash
├── 5. Paginasi Fail-Closed & Penanganan Truncation (6 Skenario)
│   ├── 5.1 Mengambil seluruh data multi-halaman jika totalCount > 1000
│   ├── 5.2 Membatalkan perhitungan (Fail-Closed) jika terjadi error pada salah satu halaman
│   ├── 5.3 Membatalkan perhitungan jika jumlah baris terakumulasi !== totalCount
│   ├── 5.4 Memastikan recentTransactions sengaja dibatasi maksimal 5 baris
│   ├── 5.5 Memverifikasi paginasi eksplisit pada getSalesReport
│   └── 5.6 Memetakan error database PostgREST ke ApiResponse secara aman
└── 6. Generator Ekspor CSV RFC 4180 & Sanitasi Formula (8 Skenario)
    ├── 6.1 Menghasilkan CSV penjualan dengan format dan header RFC 4180 yang valid
    ├── 6.2 Menghasilkan CSV beban operasional dan CSV stok barang
    ├── 6.3 Menerapkan escaping kutip ganda dan pemisah koma standar RFC 4180
    ├── 6.4 Menambahkan UTF-8 BOM (\uFEFF) pada output CSV
    ├── 6.5 Menyanitasi teks yang diawali karakter pemicu formula (=, +, -, @) dengan prefix kutip tunggal
    ├── 6.6 Menyanitasi formula yang disamarkan menggunakan whitespace, tab, atau carriage return
    ├── 6.7 Mempertahankan angka negatif yang sah (misal -150000) tetap murni numerik tanpa prefix kutip
    └── 6.8 Menguji teks yang memuat koma, kutip ganda, dan karakter CRLF multi-baris
```

---

## 8. Penegasan Batasan Pengujian: Mock vs Live Database

> [!CAUTION]
> ### Batasan Mutu yang Wajib Diakui Secara Jujur:
> 1. **Unit Test Mock $\neq$ Evaluasi RLS Runtime PostgreSQL:** Seluruh 36 unit test berjalan pada in-memory mock Supabase Client. Pengujian ini membuktikan kebenaran logika TypeScript, formula matematika, pagination loop fail-closed, dan sanitasi CSV, namun **BUKAN BUKTI** bahwa RLS PostgreSQL live mengeksekusi kueri secara benar di kernel basis data.
> 2. **Paginasi Fisik Database:** Mock menyimulasikan pembagian halaman, namun latensi jaringan fisik dan batas memori PostgREST riil tetap memerlukan pengujian staging database live.
> 3. **Indeks & Rencana Eksekusi:** Efisiensi kueri terhadap indeks komposit `(business_id, transaction_date DESC)` hanya dapat diverifikasi melalui `EXPLAIN ANALYZE` pada PostgreSQL fisik.

---

## 9. Ketergantungan Terbuka & Rekomendasi Keputusan Akhir

### Ketergantungan Terbuka (Open Dependencies):
1. **P2 — Stored Procedure Agregasi Database (`get_dashboard_analytics_rpc`):**
   - Kontrak dan spesifikasi telah siap. Menjadi *readiness gate dependency* sebelum rilis produksi berskala besar.
   - Pada Substage 3.2.3, service layer menggunakan strategi sementara *Fail-Closed Comprehensive Pagination Loop*.
2. **P2 — Migrasi 010 & 011 Unexecuted:**
   - Perbaikan RPC diskon Hamilton penuh dan hardening idempotensi masih berstatus *unexecuted* di Supabase live.

### Rekomendasi Keputusan Akhir:
> ### **REKOMENDASI: APPROVE**
> Seluruh 5 poin audit reviewer telah diselesaikan secara tuntas:
> 1. Risiko truncation diselesaikan dengan strategi **Fail-Closed Comprehensive Pagination Loop** (jaminan 100% data terambil atau abort seketika, zero partial KPI) dan dokumentasi target Database RPC.
> 2. Kontrak arus kas didefinisikan secara transparan dan terbukti sesuai kolom/tabel aktual tanpa menyamakan net sales dengan cash inflows.
> 3. Sumber kebenaran diskon dibuktikan secara statis dari kode PL/pgSQL, dan satu formula terpadu anti-double-counting telah ditetapkan.
> 4. Kontrak CSV membedakan numerik negatif dari teks, menyanitasi formula bertab/CR/whitespace, dan dilengkapi 8 skenario uji.
> 5. Seluruh batasan mutlak ditaati 100%.

*Pengerjaan dihentikan pada titik ini untuk menunggu peninjauan dan persetujuan eksplisit Anda.*
