# VeyraOS --- Page-by-Page UI/UX Specifications & Wireframes

**Versi:** 1.0  
**Status:** Disetujui untuk Panduan Implementasi (Phase 2 UI/UX Baseline)  
**Produk:** VeyraOS  
**Cakupan:** Seluruh 11 Modul MVP VeyraOS  

---

## 1. Modul 1: Autentikasi dan Profil Pengguna

### 1.1 Halaman Masuk (`/login`) & Pendaftaran (`/register`)
- **Tujuan Halaman:** Memungkinkan pemilik usaha masuk atau membuat akun secara aman dengan usaha minimal.
- **Aksi Utama Pengguna:** Menekan tombol *"Masuk"* atau *"Buat Akun Bisnis"*.
- **Hirarki Konten:**
  1. Header Brand: Logo VeyraOS (Royal Violet) + Tagline *"Run your business. Know your numbers."*
  2. Kartu Form: Input Email, Input Kata Sandi, (Konfirmasi Sandi pada registrasi).
  3. Tombol Aksi Utama: Tombol lebar penuh (*full-width*) berwarna Primary `#5B3CC4`.
  4. Footer Alternatif: Tautan peralihan antara Masuk / Daftar, serta tautan *"Coba Dulu di Mode Demo"* tanpa login.
- **Validasi & Error:**
  - Format email harus valid (`nama@domain.com`).
  - Kata sandi minimal 8 karakter.
  - Pesan error inline di bawah field: *"Email atau kata sandi tidak sesuai"*.
- **Perilaku Responsif:** Di desktop terpusat dengan lebar kartu 420px; di mobile kartu melebar 100% dengan padding horizontal 16px.

---

## 2. Modul 2: Pembuatan Bisnis & Business Switcher

### 2.1 Alur Onboarding Bisnis Pertama (`/onboarding/create-business`)
- **Tujuan Halaman:** Mengarahkan akun baru membuat profil usaha pertamanya sebelum masuk ke dashboard.
- **Aksi Utama Pengguna:** Mengisi nama bisnis dan menekan *"Mulai Kelola Bisnis"*.
- **Formulir & Validasi:**
  - Nama Bisnis (Wajib, 3–60 karakter).
  - Bidang Usaha / Kategori (Pilihan dropdown: Sembako/Kelontong, Kuliner/Makanan, Fashion/Pakaian, Elektronik/Gadget, Jasa, Lainnya).
  - Nomor Telepon/WhatsApp (Opsional, format nomor telepon Indonesia).
  - Alamat Singkat Toko (Opsional).
- **Empty State Guard:** Jika pengguna belum memiliki bisnis, sistem memblokir akses ke rute `/dashboard` dan secara otomatis mengarahkan ke halaman ini.

---

## 3. Modul 3: Dashboard Bisnis (`/dashboard`)

### 3.1 Spesifikasi UX
- **Tujuan Halaman:** Memberikan gambaran seketika kondisi kesehatan operasional dan finansial toko pada periode yang dipilih.
- **Aksi Utama Pengguna:** Memantau metrik laba, memeriksa stok menipis, dan melompat ke *"Catat Penjualan Baru"*.
- **Hirarki Konten:**
  1. **Top Bar Header:** Salam sapaan + Nama Bisnis Aktif + Filter Rentang Tanggal (Pilihan: *Hari Ini, 7 Hari Terakhir, Bulan Ini, Kustom*) + Tombol Quick Action `[+ Catat Penjualan]`.
  2. **Grid Stat Card (6 Kartu Metrik Finansial):**
     - **Penjualan Bersih (Net Sales):** Total omzet setelah diskon.
     - **Harga Pokok Penjualan (HPP):** Total biaya modal atas barang yang laku terjual.
     - **Laba Kotor (Gross Profit):** Penjualan Bersih dikurangi HPP (Aksen warna Royal Violet).
     - **Pengeluaran Operasional:** Total beban operasional harian.
     - **Laba Operasional:** Laba Kotor dikurangi Pengeluaran Operasional.
     - **Arus Kas Bersih (Net Cash Flow):** Total uang riil masuk dikurangi total uang riil keluar.
  3. **Grafik Tren Penjualan Harian:** Visualisasi grafik garis 7–30 hari terakhir.
  4. **Panel Bawah (2 Kolom):**
     - Sisi Kiri: 5 Transaksi Penjualan Terbaru (Nomor nota, waktu, metode bayar, total Rupiah).
     - Sisi Kanan: Widget *"Peringatan Stok Menipis"* (Daftar produk dengan `stok <= batas_minimum`, kuantitas sisa diberi badge warna Amber).
- **Keadaan Khusus (Empty Onboarding State):**
  Jika bisnis baru memiliki 0 produk dan 0 penjualan:
  - Kartu metrik menampilkan Rp 0 dengan catatan *"Belum ada aktivitas"*.
  - Menampilkan kartu panduan onboarding 3 langkah:
    1. `[+] Tambah Produk Pertama`
    2. `[+] Catat Pembelian Stok Awal`
    3. `[+] Buat Penjualan Pertama`

### 3.2 Wireframe Deskriptif: Dashboard
```
+-----------------------------------------------------------------------------------------+
| Ringkasan Bisnis: Toko Berkah                       [Filter: Bulan Ini v] [+ Penjualan] |
+-----------------------------------------------------------------------------------------+
| [Penjualan Bersih]    [HPP (Modal Terjual)]   [Laba Kotor]                             |
|  Rp 14.500.000         Rp 9.200.000            Rp 5.300.000 (Aksen Ungu)               |
|  32 transaksi          Dari unit terjual       Margin: 36.5%                           |
|-----------------------------------------------------------------------------------------|
| [Biaya Operasional]   [Laba Operasional]      [Arus Kas Bersih]                         |
|  Rp 1.250.000          Rp 4.050.000            Rp 3.800.000                            |
|  Listrik, sewa, dll    Laba Kotor - Biaya      Kas Masuk - Kas Keluar                  |
+-----------------------------------------------------------------------------------------+
| GRAFIK PENJUALAN HARIAN (Bulan Ini)                                                     |
| [===========================/----\_____________________] Rp 14.500.000 total           |
+-----------------------------------------------------------------------------------------+
| TRANSAKSI TERBARU                         | PERINGATAN STOK MENIPIS (3 Produk)          |
| - INV-2026-0042 | Rp 150.000 | Tunai      | [!] Minyak Goreng 2L : Sisa 2 (Batas: 5)    |
| - INV-2026-0041 | Rp 45.000  | Transfer   | [!] Beras Ramos 5kg  : Sisa 1 (Batas: 4)    |
| - INV-2026-0040 | Rp 320.000 | Tunai      | [!] Gula Pasir 1kg   : Sisa 0 (Habis!)      |
| [Lihat Semua Penjualan ->]                | [Beli Stok Baru ->]                         |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Modul 4: Manajemen Produk & Persediaan (`/products`)

### 4.1 Spesifikasi UX
- **Tujuan Halaman:** Mengelola daftar barang dagangan, memantau level stok secara akurat, dan melihat riwayat mutasi persediaan.
- **Aksi Utama Pengguna:** Mencari produk, memeriksa sisa stok, dan menekan `[+ Tambah Produk]`.
- **Hirarki Konten:**
  1. Header Halaman: Judul *"Produk & Stok"* + Tombol `[+ Tambah Produk]`.
  2. Bar Kontrol: Kolom pencarian teks (instan filter nama/SKU), Dropdown Filter Kategori, Toggle Filter *"Hanya Stok Menipis"*.
  3. Tabel Data Produk (Desktop) / Kartu Produk (Mobile):
     - Kolom: Nama Produk, SKU (opsional), Harga Jual (IDR), Harga Pokok Rata-rata (IDR), Stok Saat Ini, Status Stok (Badge: Aman / Menipis / Habis), Aksi (Edit / Riwayat Stok / Arsipkan).
- **Formulir Tambah / Edit Produk (`/products/new`, `/products/:id`):**
  - Nama Produk (Wajib, teks).
  - SKU / Kode Barang (Opsional, divalidasi unik per bisnis).
  - Kategori Produk (Opsional).
  - Harga Jual Satuan (Wajib, format Rupiah integer $> 0$).
  - Harga Pokok Beli Satuan (Wajib, format Rupiah integer $\ge 0$).
  - Stok Awal (Hanya pada produk baru, integer $\ge 0$).
  - Ambang Peringatan Stok Minimum (Wajib, default: 5 unit).
- **Aturan Pencegahan Hapus Destruktif:**
  - Produk yang sudah pernah memiliki transaksi penjualan/pembelian tidak dapat dihapus permanen (*hard delete* dinonaktifkan).
  - Opsi yang tersedia adalah *"Arsipkan Produk"* (Soft delete). Produk yang diarsipkan tidak muncul lagi di kasir penjualan, namun data historis di laporan dan nota masa lalu tetap utuh.

---

## 5. Modul 5: Transaksi Penjualan & Kasir Cepat (`/sales`, `/sales/new`)

### 5.1 Spesifikasi UX Halaman Kasir Cepat (`/sales/new`)
- **Tujuan Halaman:** Memfasilitasi input penjualan yang sangat cepat saat melayani pelanggan di toko atau pesanan WhatsApp.
- **Aksi Utama Pengguna:** Memilih produk $\rightarrow$ mengatur jumlah $\rightarrow$ memilih metode pembayaran $\rightarrow$ menekan *"Simpan Transaksi"*.
- **Hirarki Konten & Tata Letak Dua Kolom (Desktop):**
  - **Kolom Kiri (Katalog Produk Cepat):**
    - Kolom pencarian produk dengan auto-fokus (`autofocus`).
    - Grid kartu produk yang menampilkan: Nama barang, harga jual, dan sisa stok.
    - Mengklik kartu langsung menambahkan produk ke keranjang belanja di sisi kanan (atau menambah qty jika sudah ada di keranjang).
    - Tombol produk dinonaktifkan jika stok $= 0$ (berlabel *"Stok Habis"*).
  - **Kolom Kanan (Keranjang Penjualan):**
    - Daftar item terpilih: Nama barang, input kuantitas stepper `[-] [qty] [+]`, harga satuan, subtotal item.
    - Validasi Real-time: Jika qty yang dimasukkan melebihi stok, input memerah dengan peringatan: *"Maksimal {stok} unit"*.
    - Input Diskon: Opsi diskon per transaksi (Nominal Rupiah atau Persentase).
    - Ringkasan Biaya: Subtotal, Total Diskon, dan Total Akhir Rupiah tebal.
    - Pilihan Metode Pembayaran: Tombol radio / segmented button: `[Tunai]` atau `[Transfer Bank]`.
    - Input Uang Diterima & Kembalian (Opsional, khusus pembayaran Tunai).
    - Tombol Simpan Transaksi (Warna Primary, teks putih, ukuran besar).
- **Perilaku di Layar Mobile ($< 768px$):**
  - Katalog produk tampil satu kolom.
  - Keranjang belanja diletakkan dalam **Sticky Bottom Bar** yang menampilkan: `Total: Rp 120.000 (3 item)` dan tombol `[Lihat Keranjang & Bayar]`. Menekan tombol tersebut membuka **Bottom Sheet Pembayaran** secara penuh.

### 5.2 Alur Pembatalan Transaksi Penjualan (Void Sale)
- Terletak pada halaman Rincian Transaksi (`/sales/:id`).
- Jika transaksi masih aktif, tersedia tombol teks merah `[Batalkan Transaksi (Void)]`.
- Saat diklik: Muncul modal konfirmasi verifikasi tinggi:
  1. Peringatan: *"Pembatalan ini akan membatalkan transaksi INV-2026-0042, mengembalikan seluruh stok produk ke gudang, dan mengurangi total penjualan pada laporan."*
  2. Input Wajib: Field textarea *"Alasan Pembatalan"* (misal: "Pelanggan salah pesan / barang rusak", minimal 5 karakter).
  3. Tombol Eksekusi: `[Ya, Batalkan Transaksi]` (Warna Merah).
  4. Hasil: Status berubah menjadi `VOIDED` dengan badge merah, mutasi stok pembalik (`SALE_VOID`) tercatat di ledger.

---

## 6. Modul 6: Pencatatan Pengeluaran Operasional (`/expenses`)

### 6.1 Spesifikasi UX
- **Tujuan Halaman:** Mencatat beban biaya non-persediaan agar perhitungan laba operasional bersih akurat.
- **Aksi Utama Pengguna:** Menekan `[+ Catat Pengeluaran]`.
- **Formulir Pengeluaran:**
  - Tanggal Pengeluaran (Default: Tanggal hari ini).
  - Kategori Biaya (Pilihan: *Sewa Tempat, Listrik & Air, Gaji Karyawan, Transportasi & Pengiriman, Pemasaran & Iklan, Operasional Umum*).
  - Peringatan Khusus di bawah form: *"Catatan: Pembelian barang dagangan/stok dicatat melalui menu Pembelian Stok, bukan di sini, agar HPP tidak terhitung ganda."*
  - Nominal Pengeluaran (Format Rupiah integer $> 0$).
  - Keterangan / Catatan Tambahan (Opsional).

---

## 7. Modul 7: Pembelian Persediaan (Restock) (`/purchases`, `/purchases/new`)

### 7.1 Spesifikasi UX
- **Tujuan Halaman:** Mencatat restock barang dari supplier, menambah kuantitas persediaan, dan memperbarui harga pokok rata-rata secara otomatis.
- **Aksi Utama Pengguna:** Memilih produk yang dibeli, mengisi kuantitas beli dan harga beli per unit.
- **Formulir Pembelian Stok:**
  - Tanggal Pembelian.
  - Nama Pemasok / Supplier (Opsional).
  - Baris Item Pembelian:
    - Pilih Produk (Dropdown atau pencarian produk).
    - Kuantitas Beli (Integer $> 0$).
    - Harga Beli Satuan (IDR integer $\ge 0$).
    - Tampilan Info Real-time: Sistem menampilkan perbandingan *"Harga Pokok Saat Ini: Rp 10.000 $\rightarrow$ Estimasi Harga Pokok Baru (Moving Average): Rp 10.500"*.
  - Total Biaya Pembelian.
- **Dampak Finansial:**
  - Stok produk bertambah secara atomik.
  - Ledger mutasi mencatat tipe `PURCHASE`.
  - Dicatat sebagai arus kas keluar pada laporan arus kas.

---

## 8. Modul 8 & 9: Laporan Finansial & Ekspor CSV (`/reports`)

### 8.1 Spesifikasi UX Laporan
- **Tujuan Halaman:** Memberikan rincian laporan yang dapat direkonsiliasi hingga ke transaksi sumber.
- **Aksi Utama Pengguna:** Memilih rentang tanggal, membaca rincian laba rugi, dan menekan `[Ekspor CSV]`.
- **Hirarki Konten:**
  1. Kontrol Filter: Selector Tanggal (Hari Ini, 7 Hari Terakhir, Bulan Ini, Bulan Lalu, Kustom) + Tombol `[Ekspor CSV]`.
  2. **Tabel Ringkasan Laba Rugi Sederhana (Income Statement Style):**
     - (+) Penjualan Bersih
     - (-) Harga Pokok Penjualan (HPP)
     - (=) **Laba Kotor** (Gross Profit)
     - (-) Beban Operasional Tercatat
     - (=) **Laba Operasional Bersih Sederhana**
  3. **Tabel Ringkasan Arus Kas Masuk & Keluar:**
     - Arus Kas Masuk: Penerimaan Penjualan (Tunai & Transfer)
     - Arus Kas Keluar: Pengeluaran Operasional + Pembelian Stok Persediaan
     - (=) **Arus Kas Bersih Tercatat**
  4. Tab Rincian Transaksi: Tabel detail penjualan dan pengeluaran pada periode tersebut.
- **Alur Ekspor CSV:**
  - Mengklik `[Ekspor CSV]` mengunduh file instan dengan penamaan: `veyraos_laporan_[nama-bisnis]_[tgl-mulai]_[tgl-akhir].csv`.
  - Nilai diformat bersih dengan pemisah koma standar tanpa merusak format angka Indonesia.

---

## 9. Modul 10: Mode Demo Terisolasi (`/demo/*`)

### 9.1 Spesifikasi UX Mode Demo
- **Tujuan Halaman:** Mengizinkan eksplorasi penuh tanpa registrasi dan tanpa mencemari database multi-tenant.
- **Elemen Wajib:**
  1. **Banner Persisten di Atas:** *"MODE DEMO (DATA SIMULASI: Toko Sembako Sejahtera)"*.
  2. **Tombol Reset Instan:** Terletak di banner atas. Jika diklik, memunculkan modal konfirmasi *"Kembalikan data demo ke kondisi awal?"*. Mengklik ya memuat ulang state lokal dalam $< 500$ ms.
  3. **Tombol Konversi:** *"Buka Usaha Nyata Sekarang"* yang membuka form registrasi.

---

## 10. Modul 11: Pengaturan Bisnis (`/settings`)

### 10.1 Spesifikasi UX
- Pengaturan Profil Bisnis: Nama toko, kategori usaha, nomor telepon, alamat.
- Pengaturan Regional: Menampilkan IDR (Rupiah) dan Zona Waktu Asia/Jakarta (WIB) dengan status permanen aktif.
- Profil Pengguna: Ganti nama dan ubah kata sandi.
