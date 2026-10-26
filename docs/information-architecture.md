# VeyraOS --- Information Architecture & Navigation Specification

**Versi:** 1.0  
**Status:** Disetujui untuk Panduan Implementasi (Phase 2 IA Baseline)  
**Produk:** VeyraOS  
**Cakupan:** 11 Modul MVP VeyraOS  

---

## 1. Struktur Navigasi Global

Aplikasi VeyraOS menggunakan arsitektur navigasi adaptif dua tingkat:
- **Desktop & Tablet Landscape ($\ge 1024px$):** Sidebar vertikal tetap (*fixed sidebar*) di sisi kiri (lebar 256px) dengan bilah atas (*top app bar*) setinggi 64px.
- **Tablet Portrait (768px – 1023px):** Sidebar yang dapat diciutkan (*collapsible icon sidebar*, lebar 72px) dengan tooltip saat kursor diarahkan ke ikon.
- **Mobile ($< 768px$):** Bilah navigasi bawah (*Mobile Bottom Bar*) dengan 4 menu utama paling sering diakses, ditambah tombol *"Menu Lainnya"* yang memicu kemunculan Bottom Drawer.

```
+-----------------------------------------------------------------------------------------+
| [BANNER PERSISTEN MODE DEMO - HANYA MUNCUL DI MODE DEMO (Tinggi 40px)]                 |
+-----------------------------------------------------------------------------------------+
| [LOGO VeyraOS] | [BUSINESS SWITCHER: "Toko Berkah" v]   | [NOTIFIKASI] [USER PROFILE v] |
+----------------+----------------------------------------+-------------------------------+
| SIDEBAR        | AREA KONTEN UTAMA (Canvas Background: #FAF9F6)                         |
| - Ringkasan    |                                                                         |
| - Penjualan    | (Header Halaman, Filter Tanggal, Action Button)                         |
| - Produk & Stok|                                                                         |
| - Pengeluaran  | (Kartu Ringkasan Metrik / Tabel Data / Formulir Transaksi)              |
| - Pembelian    |                                                                         |
| - Laporan      |                                                                         |
| -------------- |                                                                         |
| - Pengaturan   |                                                                         |
+----------------+-------------------------------------------------------------------------+
```

---

## 2. Peta Rute Aplikasi (Application Route Map)

### 2.1 Rute Publik & Onboarding
| Path Rute | Nama Tampilan | Hak Akses | Deskripsi & Komponen Kunci |
|---|---|---|---|
| `/` | Landing & Demo Gateway | Publik | Penjelasan produk, tombol *"Coba Mode Demo"* langsung tanpa login, tombol *"Masuk"*, dan *"Daftar"*. |
| `/login` | Masuk Akun | Publik | Form email & kata sandi, validasi inline, tautan ke pendaftaran. |
| `/register` | Pendaftaran Akun | Publik | Pendaftaran pemilik usaha baru, konfirmasi kata sandi. |
| `/onboarding/create-business` | Pembuatan Bisnis Pertama | Terautentikasi | Wajib diisi jika akun baru belum memiliki bisnis aktif. Mengisi nama usaha, bidang, kontak. |

### 2.2 Rute Privat Bisnis Nyata (Tenant Scoped: `active_business_id`)
Seluruh rute privat di bawah ini dilindungi sesi autentikasi dan terikat ke `business_id` aktif:

| Path Rute | Modul | Nama Menu | Deskripsi Fungsi |
|---|---|---|---|
| `/dashboard` | Modul 3: Dashboard | **Ringkasan** | Ringkasan KPI keuangan, grafik penjualan, transaksi terbaru, peringatan stok menipis. |
| `/sales` | Modul 5: Penjualan | **Penjualan** | Riwayat transaksi penjualan, status transaksi, tombol buka kasir / catat penjualan baru. |
| `/sales/new` | Modul 5: Penjualan | **Catat Penjualan** | Antarmuka kasir cepat (POS), pemilihan produk, keranjang penjualan, diskon, metode pembayaran. |
| `/sales/:id` | Modul 5: Penjualan | **Rincian Penjualan** | Detail item terjual, snapshot harga & HPP, tombol *Batalkan Penjualan (Void)* jika aktif. |
| `/products` | Modul 4: Produk & Stok | **Produk & Stok** | Katalog produk, harga jual, harga pokok rata-rata, kuantitas stok, status stok, filter stok menipis. |
| `/products/new` | Modul 4: Produk & Stok | **Tambah Produk** | Formulir penambahan produk baru beserta penetapan stok awal. |
| `/products/:id` | Modul 4: Produk & Stok | **Edit Produk** | Formulir perubahan nama, harga, stok minimum, riwayat mutasi stok (`stock_movements`), arsip produk. |
| `/expenses` | Modul 6: Pengeluaran | **Pengeluaran** | Buku catatan pengeluaran operasional, filter kategori, tombol catat pengeluaran. |
| `/purchases` | Modul 7: Pembelian | **Pembelian Stok** | Riwayat pembelian restock dari pemasok, tombol catat pembelian baru, pembaruan HPP otomatis. |
| `/purchases/new` | Modul 7: Pembelian | **Catat Pembelian** | Formulir pembelian persediaan multi-item, nama pemasok, kalkulasi harga pokok baru. |
| `/reports` | Modul 8: Laporan | **Laporan** | Laporan performa laba rugi sederhana, HPP, arus kas masuk/keluar, dan rincian transaksi sumber. |
| `/reports/export` | Modul 9: Ekspor CSV | **Ekspor CSV** | Modal dialog konfigurasi ekspor data penjualan, pengeluaran, atau stok berdasarkan filter tanggal. |
| `/settings` | Modul 11: Pengaturan | **Pengaturan** | Pengaturan informasi profil usaha aktif, mata uang, zona waktu, dan profil pemilik. |

### 2.3 Rute Khusus Mode Demo (Client-Side Isolated: `/demo/*`)
Mode Demo mencerminkan struktur rute privat namun menggunakan prefix `/demo/` dan berjalan di atas state in-memory/local storage lokal yang sepenuhnya terisolasi:

| Path Rute Demo | Tampilan Setara | Status Penyimpanan |
|---|---|---|
| `/demo` | Gateway Mode Demo | Menginisialisasi state simulasi *"Toko Sembako Sejahtera"* |
| `/demo/dashboard` | Dashboard Simulasi | Menampilkan metrik simulasi |
| `/demo/sales` & `/demo/sales/new` | Penjualan Simulasi | Memungkinkan mencoba alur transaksi tanpa backend |
| `/demo/products` | Katalog Produk Simulasi | Menampilkan 15 produk sembako dan riwayat stok |
| `/demo/expenses` | Pengeluaran Simulasi | Menampilkan 8 pengeluaran operasional simulasi |
| `/demo/purchases` | Pembelian Stok Simulasi | Menampilkan riwayat restock simulasi |
| `/demo/reports` | Laporan Keuangan Simulasi | Menampilkan laporan dan uji ekspor CSV simulasi |

---

## 3. Perilaku Business Switcher & Tenant Isolation

1. **Posisi & Elemen:**
   - Diletakkan di bagian atas sidebar (desktop) atau di header aplikasi utama (mobile).
   - Menampilkan: Nama bisnis aktif, kategori bisnis, dan ikon panah bawah (`chevron-down`).
2. **Interaksi Dropdown:**
   - Menampilkan daftar hingga 5 bisnis milik akun pengguna.
   - Bisnis aktif diberi tanda centang hijau/ungu dan latar `--color-lavender-tint`.
   - Di bagian bawah dropdown terdapat tombol:
     - `[+ Tambah Bisnis Baru]` (Memicu modal pembuatan bisnis).
     - `[Kelola Bisnis di Pengaturan]` (Mengarahkan ke `/settings`).
3. **Mekanisme Pergantian (Switching Mechanics):**
   - Saat pengguna memilih bisnis lain:
     - ID bisnis aktif pada konteks global (`ActiveBusinessContext`) diperbarui.
     - Seluruh query data (produk, transaksi, laporan, dashboard) dibatalkan dan dimuat ulang secara atomik untuk `business_id` yang baru.
     - Form yang sedang aktif dan belum disimpan akan memunculkan dialog peringatan: *"Ada data yang belum disimpan. Yakin ingin berpindah bisnis?"*.
   - Tidak ada data dari bisnis sebelumnya yang tertinggal di memori tampilan.

---

## 4. Perilaku Navigasi Mobile ($< 768px$)

Navigasi mobile membagi alur kerja berdasarkan frekuensi penggunaan harian:

### 4.1 Bilah Navigasi Bawah (Bottom Navigation Bar)
Tinggi tetap 60px di dasar layar dengan 4 ikon utama + 1 tombol menu:
1. **Ringkasan (`/dashboard`):** Ikon Dashboard / Grafik.
2. **Penjualan (`/sales`):** Ikon Keranjang Kasir / Tagihan.
3. **Kasir Cepat (`/sales/new`):** Tombol Aksi Menonjol di Tengah (*Center Floating Action Button* dengan latar Brand Primary `#5B3CC4`, ikon tambah `+` putih) untuk mencatat transaksi kilat.
4. **Produk (`/products`):** Ikon Kotak Barang / Persediaan.
5. **Lainnya:** Ikon Garis Tiga (*Menu Drawer*).

### 4.2 Menu Bottom Sheet ("Lainnya")
Saat tombol "Lainnya" diklik, muncul panel drawer dari bawah memuat menu sekunder:
- Pengeluaran Operasional (`/expenses`)
- Pembelian Persediaan (`/purchases`)
- Laporan Keuangan (`/reports`)
- Pengaturan Bisnis (`/settings`)
- Profil Pemilik & Keluar Akun (`/logout`)
- Mode Demo Switcher (jika ingin mencoba fitur baru)

---

## 5. Pembedaan Visual Mutlak: Mode Demo vs. Bisnis Nyata

Untuk mencegah kesalahan pemahaman dan menjamin integritas data:

```
[BISNIS NYATA]                                [MODE DEMO]
Header Bersih (Warm Ivory / White)            Banner Ungu Gelap Permanen (#392477)
Badge: "Toko Berkah (UMKM Aktif)"             Badge: "MODE DEMO - SIMULASI" (Kuning Emas)
Aksi: Simpan ke Database Aman                 Aksi: Simpan ke Memori Browser
Tidak Ada Tombol Reset Data                   Tombol: "Reset Data Demo" Selalu Tersedia
Akses Rute: /dashboard, /sales                Akses Rute: /demo/dashboard, /demo/sales
```

- Jika pengguna sedang berada di Mode Demo dan mengklik tombol *"Simpan Bisnis Nyata"*, sistem membuka modal registrasi dengan penjelasan gamblang: *"Data pada Mode Demo adalah simulasi dan tidak akan disalin ke akun bisnis nyata Anda."*
- Jika pengguna keluar dari tab atau mengklik *"Reset Demo"*, state simulasi kembali ke kondisi awal toko sembako dalam satu detik.
