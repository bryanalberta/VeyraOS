# VeyraOS --- Product Requirements Document (PRD)

**Versi:** 1.1  
**Status:** Disetujui sebagai Baseline Produk (Phase 1 Baseline Approved)  
**Produk:** VeyraOS  
**Kategori:** Aplikasi web manajemen bisnis untuk UMKM Indonesia  
**Bahasa utama:** Bahasa Indonesia  
**Mata uang:** Rupiah (IDR) — Disimpan sebagai bilangan bulat (Integer / BigInt) tanpa sen  
**Zona waktu default:** Asia/Jakarta (WIB)  

------------------------------------------------------------------------

## 1. Ringkasan Produk

VeyraOS adalah aplikasi web yang membantu pelaku usaha kecil mengelola
produk, persediaan, penjualan, pengeluaran, dan laporan keuangan
sederhana dalam satu tempat. Produk memprioritaskan kegunaan
operasional, integritas data, kemudahan penggunaan, dan keamanan---bukan
hanya tampilan visual.

VeyraOS juga menyediakan **Mode Demo** dengan data simulasi agar calon
pengusaha atau pengguna baru dapat memahami alur aplikasi sebelum
mengelola data bisnis sebenarnya.

### 1.1 Visi

Membantu pemilik usaha kecil memahami kondisi operasional dan keuangan
bisnisnya melalui pencatatan yang sederhana, konsisten, dan mudah
dipahami (*"Run your business. Know your numbers."*).

### 1.2 Tujuan MVP

1.  Memungkinkan pengguna membuat dan mengelola satu atau lebih profil
    bisnis (hingga 5 bisnis per akun).
2.  Memungkinkan pengguna mengelola produk dan memantau stok secara akurat.
3.  Memungkinkan pengguna mencatat penjualan dan memperbarui stok secara
    atomik dan konsisten.
4.  Memungkinkan pengguna mencatat pengeluaran dan pembelian persediaan.
5.  Menampilkan laporan dasar yang membedakan penjualan, harga pokok,
    laba, dan arus kas.
6.  Menyediakan Mode Demo yang aman, terisolasi secara arsitektural di sisi browser,
    dan tidak dapat mencemari data bisnis nyata.
7.  Menyediakan pengalaman yang responsif, mudah dipahami, dan aman pada
    desktop, tablet, maupun ponsel.

### 1.3 Bukan Tujuan MVP

Hal berikut tidak termasuk dalam rilis MVP kecuali diputuskan secara
eksplisit pada tahap berikutnya:

-   Integrasi marketplace atau platform pengiriman (Shopee, Tokopedia, TikTok Shop).
-   Integrasi rekening bank otomatis atau rekonsiliasi Open Finance.
-   Sistem akuntansi ganda (double-entry ledger), perpajakan formal (PPh/PPN), atau neraca keuangan formal.
-   Penggajian dan manajemen karyawan.
-   Kolaborasi multi-pengguna dengan peran kompleks (RBAC).
-   Aplikasi native Android/iOS.
-   Operasi offline penuh.
-   Fitur AI yang mengambil keputusan atau mengubah data secara otomatis.
-   Langganan berbayar dan sistem penagihan otomatis.
-   Pencatatan piutang (penjualan belum lunas) dan retur sebagian (partial returns).

------------------------------------------------------------------------

## 2. Target Pengguna dan Kebutuhan

### Persona A --- Pemilik Toko Kecil
**Kebutuhan:** Mencatat penjualan dengan cepat, mengetahui produk dengan stok menipis, dan
memahami apakah bisnis menghasilkan laba bersih operasional.  
**Kendala:** Pencatatan manual tersebar di buku tulis atau nota kertas yang rentan hilang atau rusak.  
**Kriteria keberhasilan:** Pengguna dapat menambahkan produk, mencatat penjualan, dan memeriksa
ringkasan bisnis tanpa membutuhkan keahlian akuntansi khusus.

### Persona B --- Penjual Online Skala Kecil
**Kebutuhan:** Memantau produk, biaya operasional, penjualan, dan performa usaha
meskipun pesanan datang melalui berbagai kanal manual (WhatsApp, Instagram, offline).  
**Batasan MVP:** Pencatatan dilakukan manual satu pintu; integrasi otomatis marketplace belum tersedia.  
**Kriteria keberhasilan:** Mengetahui laba bersih setelah dikurangi pengeluaran operasional dan biaya pengemasan.

### Persona C --- Calon Pengusaha
**Kebutuhan:** Mempelajari alur pengelolaan bisnis sebelum memasukkan data bisnis sungguhan.  
**Solusi:** Mode Demo terisolasi dengan data toko retail Indonesia yang realistis (*"Toko Sembako Sejahtera"*),
dapat dicoba langsung tanpa login dan dapat direset kapan saja.

------------------------------------------------------------------------

## 3. Prinsip Produk

1.  **Fungsional sebelum dekoratif.** Setiap metrik, tombol, tabel, dan grafik harus mempunyai tujuan operasional yang jelas.
2.  **Data keuangan dapat ditelusuri.** Angka ringkasan harus dapat direkonsiliasi hingga ke transaksi sumber.
3.  **Aman secara default.** Pengguna hanya dapat mengakses data bisnis miliknya; isolasi tenant ditegakkan di server/database.
4.  **Mudah dipahami.** Gunakan Bahasa Indonesia yang lugas dan hindari jargon akuntansi tanpa konteks.
5.  **Tidak mengarang angka.** Data simulasi selalu berlabel Demo dan tidak pernah dicampur ke data riil.
6.  **Presisi nilai mata uang.** Seluruh perhitungan Rupiah menggunakan bilangan bulat (Integer/BigInt) untuk mencegah kesalahan pembulatan floating-point biner.
7.  **Dapat dikembangkan.** Model data terstruktur rapi untuk mendukung ekspansi fitur masa depan tanpa rombak total.
8.  **Responsif dan aksesibel.** Dioptimalkan untuk layar ponsel mulai dari lebar 360 px hingga monitor desktop lebar.

------------------------------------------------------------------------

## 4. Ruang Lingkup Fitur MVP

### 4.1 Autentikasi dan Profil
Pengguna dapat:
- Mendaftar dan masuk menggunakan email & kata sandi.
- Keluar dari sesi dengan aman.
- Melihat informasi akun dan profil dasar.
- Mengakses rute terproteksi setelah autentikasi.

Kriteria penerimaan:
- Rute privat tidak dapat diakses tanpa sesi aktif.
- Validasi input di sisi klien dan server (panjang sandi minimal, format email).
- Kredensial dan token rahasia tidak pernah diekspos ke klien.

### 4.2 Manajemen Bisnis & Switcher
Pengguna dapat:
- Membuat profil bisnis dengan nama, kategori usaha, nomor kontak, dan alamat.
- Memiliki hingga 5 bisnis per akun.
- Berpindah antarbisnis aktif secara instan melalui business switcher di navigasi atas.
- Mengubah informasi bisnis aktif di menu pengaturan.

Aturan:
- Setiap entitas operasional terikat ke `business_id`.
- Pergantian bisnis aktif langsung memicu pembaruan seluruh tampilan dan cache data.
- Akses ke `business_id` lain ditolak dengan error 403 / 404 pada lapisan server/RLS.

### 4.3 Dashboard Bisnis
Dashboard menampilkan metrik utama berdasarkan filter rentang tanggal (Hari Ini, 7 Hari Terakhir, Bulan Ini, Rentang Kustom):
- Penjualan Bersih (Net Sales).
- Harga Pokok Penjualan (HPP / COGS).
- Laba Kotor (Gross Profit).
- Pengeluaran Operasional Tercatat.
- Laba Operasional Sederhana.
- Ringkasan Arus Kas Tercatat (Kas Masuk vs. Kas Keluar).
- Grafik tren penjualan harian.
- Daftar transaksi penjualan terbaru.
- Widget peringatan stok menipis (`stock <= min_stock_alert`).

Aturan:
- Keadaan kosong (bisnis baru) menampilkan checklist onboarding tindakan, bukan angka 0 hampa atau grafik rusak.
- Loading, error, dan empty states dirancang eksplisit.

### 4.4 Produk dan Persediaan
Pengguna dapat:
- Menambah, melihat, mengubah, dan mengarsipkan produk.
- Menyimpan: Nama produk, SKU (opsional, unik per bisnis), harga jual, harga pokok/beli per unit, stok saat ini, dan ambang batas peringatan stok menipis.
- Mencari dan memfilter produk berdasarkan nama atau kategori.
- Melihat kartu indikator stok rendah.
- Melihat riwayat mutasi stok (`stock_movements`).

Aturan:
- Nilai harga jual harus lebih besar dari 0.
- Stok negatif dilarang keras secara default.
- Perubahan stok dicatat dalam buku besar mutasi (`stock_movements`) dengan jenis mutasi (`INITIAL_STOCK`, `PURCHASE`, `SALE`, `ADJUSTMENT_ADD`, `ADJUSTMENT_DAMAGE`, `ADJUSTMENT_LOSS`, `SALE_VOID`).
- Produk yang sudah memiliki riwayat transaksi tidak boleh dihapus secara permanen; gunakan pengarsipan (soft delete).

### 4.5 Transaksi Penjualan
Pengguna dapat:
- Mencatat penjualan dengan satu atau lebih item produk.
- Mengatur kuantitas per item, diskon per item (nominal IDR), dan diskon per transaksi (nominal IDR atau persentase).
- Memilih metode pembayaran: `Tunai` (Cash) atau `Transfer Bank`.
- Memasukkan catatan transaksi opsional.
- Melihat daftar riwayat penjualan dan rincian transaksi.
- Melakukan pembatalan total transaksi (Void Sale) dengan alasan pembatalan.

Aturan Transaksi & Pembatalan:
- Harga jual dan harga pokok per unit disimpan sebagai **snapshot permanen** pada item transaksi (`sale_items`). Perubahan harga produk di kemudian hari tidak mengubah nilai transaksi historis.
- Seluruh perhitungan diskon dan total akhir dihitung ulang dan divalidasi di sisi server/logika domain tepercaya.
- Penyimpanan penjualan, detail item, dan pemotongan stok dilakukan secara **atomik** (berhasil seluruhnya atau batal seluruhnya).
- Penjualan ditolak jika stok produk tidak mencukupi kuantitas yang diminta.
- **Kebijakan Pembatalan MVP:** MVP mendukung **Pembatalan Total (Void)**. Pembatalan mengubah status transaksi menjadi `VOIDED`, mengembalikan stok secara otomatis dengan mutasi `SALE_VOID`, dan mencatat alasan pembatalan untuk audit. Retur parsial (sebagian item) ditunda ke versi lanjutan.
- Seluruh penjualan pada MVP dianggap lunas seketika (tidak ada piutang).

### 4.6 Pengeluaran Operasional
Pengguna dapat:
- Mencatat beban operasional harian dengan tanggal, kategori, nominal (IDR), dan keterangan.
- Memilih kategori bawaan: *Sewa Tempat, Listrik & Air, Gaji Karyawan, Transportasi & Logistik, Pemasaran, Operasional Umum*, atau menambah kategori khusus.
- Melihat dan memfilter riwayat pengeluaran.
- Menghapus atau mengubah pengeluaran dengan penyesuaian otomatis pada laporan.

Aturan:
- Nominal pengeluaran harus lebih besar dari 0.
- Pembelian stok barang dagangan **dilarang dicatat di menu Pengeluaran** agar tidak terjadi penghitungan ganda (double-counting) terhadap HPP.

### 4.7 Pembelian Persediaan (Restock)
Pengguna dapat:
- Mencatat pembelian stok produk dari pemasok (tanggal, nama pemasok opsional, item produk, jumlah unit, harga beli per unit, total biaya).
- Pembelian berhasil langsung menambah stok produk dan mencatat mutasi stok `PURCHASE`.
- Pembelian mencatat arus kas keluar pada laporan arus kas.

Aturan Penilaian Persediaan & HPP:
- **Metode Penilaian HPP:** Menggunakan metode **Moving Weighted Average Cost (Rata-rata Bergerak)**:
  $$\text{Harga Pokok Baru} = \frac{(\text{Stok Tersisa} \times \text{Harga Pokok Lama}) + (\text{Qty Beli} \times \text{Harga Beli Unit})}{\text{Stok Tersisa} + \text{Qty Beli}}$$
- Pembelian persediaan menambah aset stok; nilai pembelian **tidak langsung diakui sebagai HPP saat dibeli**, melainkan diakui saat produk tersebut terjual.
- Pembatalan transaksi pembelian membalikkan penambahan stok dan dilarang membuat stok menjadi negatif.

### 4.8 Laporan Keuangan Sederhana
Laporan mencakup:
- **Penjualan Bersih:** Total nilai penjualan valid setelah potongan diskon dan dikurangi pembatalan.
- **Harga Pokok Penjualan (HPP):** Total akumulasi snapshot harga pokok dari unit yang terjual dalam periode tersebut.
- **Laba Kotor:** $\text{Penjualan Bersih} - \text{HPP}$.
- **Pengeluaran Operasional:** Total beban operasional periode berjalan.
- **Laba Operasional Sederhana:** $\text{Laba Kotor} - \text{Pengeluaran Operasional}$.
- **Arus Kas Tercatat:** Arus kas masuk (penerimaan penjualan lunas) dikurangi arus kas keluar (beban operasional + pembelian persediaan).
- Tabel rincian transaksi untuk audit angka.
- Ekspor laporan ke format **CSV**.

Aturan:
- Batas rentang tanggal mengikuti zona waktu `Asia/Jakarta` (00:00:00 s.d. 23:59:59 WIB).
- Transaksi berstatus `VOIDED` dikeluarkan dari perhitungan omzet dan laba.

### 4.9 Mode Demo
Mode Demo dirancang agar calon pengguna dapat mengeksplorasi seluruh kemampuan VeyraOS secara instan tanpa perlu mendaftar akun.

Spesifikasi Teknis Mode Demo:
- **Arsitektur:** Menggunakan **Client-side Isolated Store (In-Memory / Local Storage)**.
- **Isolasi Mutlak:** Tidak melakukan pembacaan maupun penulisan ke database multi-tenant produksi. Nol risiko kebocoran atau kontaminasi data.
- **Dataset Awal:** Dimuat secara otomatis dengan data simulasi realistis (*"Toko Sembako Sejahtera"* — memuat 15 produk, 30 penjualan, 5 pembelian, 8 pengeluaran).
- **Indikator Visual:** Menampilkan banner permanen di bagian atas: *"Mode Demo — Data Simulasi"* disertai tombol *"Reset Data Demo"* dan *"Daftar Akun Nyata"*.
- **Reset:** Tombol reset mengembalikan seluruh data demo ke kondisi awal dalam waktu kurang dari 500 ms.

### 4.10 Pengaturan Bisnis
- Pengaturan identitas bisnis: Nama usaha, alamat, nomor telepon/WhatsApp, catatan nota.
- Pengaturan regional baku: Mata uang IDR dan zona waktu Asia/Jakarta.
- Profil pengguna: Ubah nama tampilan dan ubah kata sandi.

------------------------------------------------------------------------

## 5. Aturan Keuangan dan Integritas Data

1.  **Format Mata Uang:** Seluruh nilai uang disimpan dalam format bilangan bulat Rupiah (`BIGINT` pada database, integer pada aplikasi). Tidak ada pecahan desimal/sen.
2.  **Snapshot Harga:** Setiap baris penjualan wajib menyimpan salinan statis `unit_selling_price` dan `unit_cost_price` saat transaksi disimpan.
3.  **Atomisitas Transaksi:** Operasi transaksi multi-tabel (penjualan/pembelian + mutasi stok + update saldo stok) dijalankan dalam database transaction yang atomik.
4.  **Buku Besar Mutasi Stok:** Perubahan kuantitas stok produk wajib mencantumkan catatan mutasi pada `stock_movements`.
5.  **Audit Trail:** Data historis tidak dihapus secara permanen; gunakan soft delete atau status `VOIDED` dengan alasan tercatat.

------------------------------------------------------------------------

## 6. Persyaratan Keamanan dan Privasi

-   Autentikasi teruji dengan pengelolaan token sesi yang aman (HTTP-only cookies jika SSR / secure local tokens).
-   Otorisasi multi-tenant ditegakkan di sisi server dan database melalui Row Level Security (RLS) atau middleware otorisasi berbasis `business_id`.
-   Pengguna hanya berhak melihat dan memanipulasi bisnis yang mereka miliki (`owner_id = user_id`).
-   Validasi input yang ketat pada browser dan server (skema validasi Zod/sejenisnya).
-   Kunci API rahasia (secrets) hanya disimpan pada variabel lingkungan server dan tidak pernah dimasukkan ke repository.
-   Mode Demo berjalan terpisah tanpa akses ke kredensial database riil.

------------------------------------------------------------------------

## 7. Identitas Merek dan Desain (Royal Violet)

### 7.1 Identitas Merek
- **Nama Produk:** VeyraOS
- **Tagline:** *"Run your business. Know your numbers."*

### 7.2 Token Warna Royal Violet
| Token Nama | Nilai HEX | Penggunaan Utama |
|---|---|---|
| **Primary** | `#5B3CC4` | Tombol aksi utama (CTA), tautan aktif, aksen navigasi |
| **Primary Hover** | `#4930A5` | State hover tombol aksi utama |
| **Deep Purple** | `#392477` | Header gelap, penekanan teks kontras tinggi, brand accent |
| **Lavender** | `#EAE4FF` | Latar badge aktif, sorotan item terpilih, hover baris tabel |
| **Lavender Tint** | `#F6F3FF` | Latar kartu pendukung, kontainer sekunder |
| **Warm Ivory** | `#FAF9F6` | Latar belakang halaman aplikasi utama |
| **Charcoal** | `#25232B` | Teks judul dan teks isi utama |
| **Muted Text** | `#716D7A` | Teks sekunder, label formulir, keterangan bantuan |
| **Border** | `#E7E3EC` | Garis batas kartu, pemisah tabel, border input |

### 7.3 Prinsip Desain UI/UX
- Menggunakan **Light Mode** sebagai tema bawaan yang bersih dan kontras.
- Menolak gradien berlebihan, dekorasi neon/glow, dan glassmorphism yang tidak fungsional.
- Tata letak responsif penuh mulai dari lebar 360 px (ponsel) hingga monitor desktop.
- Komponen tabel pada mobile menyajikan tampilan kartu adaptif agar data tidak terpotong.
- Setiap komponen interaktif memiliki state yang lengkap: *default, hover, active, focus, disabled, loading, empty, error*.

------------------------------------------------------------------------

## 8. Persyaratan Nonfungsional

- **Core Web Vitals:** LCP $\le$ 2.5s, INP $\le$ 200ms, CLS $\le$ 0.1 pada koneksi standar 4G.
- **Aksesibilitas:** Memenuhi pedoman WCAG 2.2 AA (kontras warna teks $\ge$ 4.5:1, navigasi keyboard yang jelas).
- **Teknologi:** TypeScript ketat, pemisahan yang bersih antara komponen UI, logika domain, dan akses data.

------------------------------------------------------------------------

## 9. Model Data Konseptual

1. `users/profiles`: ID pengguna, nama lengkap, email, preferensi.
2. `businesses`: ID bisnis, pemilik (`owner_id`), nama usaha, kategori, telepon, alamat, tanggal dibuat.
3. `products`: ID produk, `business_id`, nama, SKU, harga jual, harga pokok (moving avg), stok saat ini, stok minimum, status arsip.
4. `sales`: ID penjualan, `business_id`, nomor invoice/referensi, tanggal, subtotal, diskon, total akhir, metode pembayaran, status (`COMPLETED`, `VOIDED`), alasan pembatalan.
5. `sale_items`: ID item, `sale_id`, `product_id`, kuantitas, snapshot harga jual unit, snapshot harga pokok unit, diskon item, subtotal item.
6. `inventory_purchases`: ID pembelian, `business_id`, tanggal, nama pemasok, total biaya, catatan.
7. `purchase_items`: ID item pembelian, `purchase_id`, `product_id`, kuantitas, harga beli unit, subtotal.
8. `stock_movements`: ID mutasi, `business_id`, `product_id`, tipe mutasi, delta kuantitas, kuantitas sebelum, kuantitas sesudah, referensi ID (penjualan/pembelian/penyesuaian), tanggal.
9. `expenses`: ID pengeluaran, `business_id`, tanggal, kategori, nominal, deskripsi.

------------------------------------------------------------------------

## 10. Kriteria Penerimaan MVP

1. Pengguna dapat mendaftar, masuk, dan membuat bisnis pertama.
2. Pengguna dapat membuat hingga 5 bisnis dan berpindah antarbisnis tanpa kebocoran data.
3. Pengguna dapat menambah, mengedit, dan mengarsipkan produk.
4. Pengguna dapat mencatat pembelian persediaan; stok bertambah dan harga pokok rata-rata diperbarui secara konsisten.
5. Pengguna dapat mencatat penjualan; stok berkurang secara atomik; histori harga pokok dan harga jual tersimpan permanen.
6. Penjualan ditolak jika stok tidak mencukupi (tidak ada stok negatif).
7. Pembatalan penjualan (Void) membalikkan mutasi stok dan memperbarui laporan keuangan.
8. Pengeluaran operasional tercatat dan terpisah dari pembelian persediaan.
9. Laporan dan dashboard menyajikan angka Laba Kotor, Laba Operasional, dan Arus Kas yang dapat diverifikasi terhadap rincian transaksi sumber.
10. Ekspor CSV menghasilkan data yang sesuai dengan filter aktif.
11. Mode Demo terisolasi penuh di sisi klien, memiliki penanda visual jelas, dan dapat direset dalam satu klik.
12. Tampilan berfungsi optimal pada layar ponsel (360px) dan desktop.
13. Proteksi otorisasi server/database mencegah akses silang tenant.

------------------------------------------------------------------------

## 11. Riwayat Perubahan (Changelog)

| Versi | Tanggal | Deskripsi Perubahan |
|---|---|---|
| **1.0** | Awal | Draf awal PRD untuk peninjauan. |
| **1.1** | 13 Okt 2026 | **Baseline Disetujui (Phase 1 Baseline):**<br>1. Menetapkan metode HPP: *Moving Weighted Average Cost* pada setiap pembelian persediaan.<br>2. Menetapkan kebijakan pembatalan penjualan: *Full Sale Void* (retur sebagian ditunda ke post-MVP).<br>3. Menetapkan arsitektur Mode Demo: *Client-side Isolated Store* untuk isolasi mutlak dari database produksi.<br>4. Menetapkan representasi moneter: *Integer IDR (BigInt)* tanpa pecahan sen.<br>5. Menetapkan diskon: Diskon transaksi & diskon per-item.<br>6. Menetapkan cakupan pembayaran: Transaksi lunas seketika (*Tunai* / *Transfer Bank*), piutang ditunda ke v1.1.<br>7. Memindahkan dokumen ke `docs/PRD.md` sesuai struktur standar proyek. |
