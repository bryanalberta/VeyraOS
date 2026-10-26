# Laporan Pengujian Browser Interaktif: Mode Demo VeyraOS

**Status Dokumen:** Terverifikasi Penuh (Browser QA Passed)  
**Tanggal Pengujian:** 26 Oktober 2026  
**Target Lingkungan:** `http://localhost:3000/demo/*`  
**Browser Engine:** Chromium (Playwright Browser DevTools)  
**Resolusi Pengujian:** Desktop (1280x800) & Mobile Smartphone (375x812)

---

## 1. Ikhtisar Hasil Verifikasi Visual & Fungsional

Pengujian interaktif langsung melalui peramban web (*live browser testing*) telah dilaksanakan secara menyeluruh pada dev server lokal (port 3000) untuk memvalidasi siklus penuh operasional Mode Demo Sandboxed VeyraOS.

Seluruh modul berhasil diuji dari ujung ke ujung (*end-to-end user journey*) tanpa error runtime, tanpa kebocoran jaringan ke database produksi, dan dengan tampilan antarmuka yang sangat responsif, presisi, serta konsisten terhadap Design System VeyraOS (Royal Violet & Warm Off-White).

---

## 2. Rincian Skenario Uji yang Dilaksanakan

### Skenario 1: Navigasi & Dashboard Simulasi (`/demo/dashboard`)
- **Tindakan:** Membuka URL `/demo/dashboard`, mengecek status sidebar, dan memvalidasi ringkasan KPI.
- **Hasil Visual:**
  - Sidebar demo menampilkan profil Toko Sembako Sejahtera dengan badge *Simulasi*.
  - Indikator rute aktif vertikal 3px Royal Violet (`#5B3CC4`) aktif pada menu *Ringkasan*.
  - 6 Kartu KPI Finansial tampil presisi dengan integer IDR (Net Sales Rp 2.196.500, HPP Rp 1.929.000, Laba Kotor Rp 267.500, Beban Operasional Rp 1.169.000).
- **Status:** **PASS**

### Skenario 2: Katalog Produk & Penambahan Item Baru (`/demo/products`)
- **Tindakan:** Navigasi ke `/demo/products`, klik tombol *Tambah Produk*, mengisi formulir produk baru (*Kecap Manis Botol 600ml*, SKU auto/kustom, Harga Rp 15.000, HPP Rp 12.000, Stok 10 pcs), lalu menyimpan.
- **Hasil Visual & Fungsional:**
  - Modal input terformat rapi dengan validasi otomatis `CurrencyInput`.
  - Notifikasi sukses hijau muncul seketika tanpa refresh halaman.
  - KPI *Total Jenis Produk* bertambah dari 15 menjadi 16 produk, dan total fisik bertambah dari 244 menjadi 254 unit.
- **Status:** **PASS**

### Skenario 3: Pembelian Restock & Moving Average HPP (`/demo/purchases`)
- **Tindakan:** Navigasi ke `/demo/purchases`, klik *Catat Pembelian / Restock*, memilih produk yang baru dibuat (*Kecap Manis Botol 600ml*), memasukkan kuantitas restock 10 unit dengan harga beli Rp 12.000, lalu menyimpan.
- **Hasil Visual & Fungsional:**
  - Kotak simulasi *Moving Weighted Average Cost* menghitung proyeksi stok dan HPP baru secara instan sebelum disimpan.
  - Setelah disimpan, riwayat faktur PO bertambah menjadi 6 faktur, dan unit diterima bertambah menjadi 195 unit.
- **Status:** **PASS**

### Skenario 4: Buku Pengeluaran Operasional (`/demo/expenses`)
- **Tindakan:** Navigasi ke `/demo/expenses`, memeriksa visualisasi persentase beban operasional per kategori.
- **Hasil Visual:**
  - Komposisi beban per kategori tampil proporsional dengan progress bar (Gaji Karyawan 34%, Listrik & Air 30%, Operasional Toko 21%, Perlengkapan Kasir 9%).
  - Total beban terakumulasi Rp 1.169.000 dari 8 transaksi.
  - Banner prinsip akuntansi pemisahan beban vs restock terpasang jelas.
- **Status:** **PASS**

### Skenario 5: Laporan Finansial & Valuasi Persediaan (`/demo/reports`)
- **Tindakan:** Navigasi ke `/demo/reports`, beralih ke tab *Stok & Valuasi Persediaan*, memverifikasi posisi stok produk baru.
- **Hasil Visual:**
  - Tab segmented beralih dengan mulus (*Laporan Penjualan* -> *Stok & Valuasi Persediaan*).
  - Produk baru langsung muncul di baris teratas: Stok Fisik 20 pcs, HPP Rp 12.000, Modal Aset Rp 240.000, Potensi Omzet Rp 360.000.
  - Tombol *Ekspor CSV Klien* siap mengunduh file `.csv` via Blob memori peramban.
- **Status:** **PASS**

### Skenario 6: Kasir Cepat POS & Transaksi Lengkap (`/demo/sales/new`)
- **Tindakan:** Membuka Kasir POS, menambahkan 1 pcs *Kecap Manis Botol 600ml* (Rp 15.000) ke keranjang, memilih pembayaran Tunai (CASH), menekan quick-cash *Rp 20.000*, klik *Bayar Rp 15.000*, lalu mengonfirmasi transaksi.
- **Hasil Visual & Fungsional:**
  - Keranjang belanja menghitung subtotal dan kembalian (Rp 5.000) secara akurat.
  - Modal faktur/struk belanja instan tampil dengan nomor faktur unik (misal: `INV-20261026-194R`), stempel waktu WIB, dan rincian lengkap barang belanjaan.
- **Status:** **PASS**

### Skenario 7: Riwayat Penjualan & Adaptasi Mobile 375px (`/demo/sales`)
- **Tindakan:** Navigasi ke `/demo/sales`, memverifikasi transaksi kasir terbaru masuk ke daftar, kemudian mengubah ukuran viewport browser ke resolusi smartphone 375x812.
- **Hasil Visual & Ergonomi Mobile:**
  - Transaksi `INV-20261026-194R` langsung tampil pada baris teratas riwayat penjualan.
  - Pada viewport mobile 375px, tabel desktop otomatis tersembunyi dan beralih ke daftar kartu transaksi mobile (`md:hidden`) yang elegan.
  - Seluruh tombol aksi (*Detail*, *Batalkan*) memenuhi standar ergonomi sentuhan jari (*touch-target* >= 44px).
- **Status:** **PASS**

---

## 3. Matriks Hasil Pengujian

| Komponen / Alur | Kriteria Verifikasi | Hasil Nyata Browser | Status |
| :--- | :--- | :--- | :---: |
| **Navigasi Sidebar** | 6 menu demo aktif + 1 terkunci | Berpindah rute tanpa reload & indikator 3px aktif | **PASS** |
| **Katalog Produk** | Tambah & simpan produk baru | Tersimpan di store & muncul di tabel/KPI | **PASS** |
| **Restock Pembelian** | Kalkulasi Moving Average HPP | Proyeksi otomatis muncul & stok bertambah | **PASS** |
| **Pengeluaran Toko** | Visualisasi kategori beban | Progress bar persentase presisi | **PASS** |
| **Laporan & Valuasi** | Sinkronisasi data real-time | Valuasi stok merefleksikan produk baru | **PASS** |
| **Kasir POS & Struk** | Keranjang, quick cash, invoice | Kembalian tepat & struk belanja terbit | **PASS** |
| **Riwayat Penjualan** | Urutan kronologis terbaru | Faktur POS baru langsung berada di posisi teratas | **PASS** |
| **Ergonomi Mobile (375px)** | Tampilan kartu responsif | Tampilan kartu rapi, touch target >= 44px | **PASS** |
| **Isolasi Database** | 0 request keluar ke Supabase | 100% lokal sandboxed | **PASS** |

---

## 4. Kesimpulan Akhir

Pengujian browser interaktif membuktikan bahwa Mode Demo VeyraOS beroperasi secara **sempurna, stabil, bebas hambatan teknis, dan siap dipresentasikan kepada pengguna UMKM**.
