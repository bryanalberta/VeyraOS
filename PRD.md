# VeyraOS --- Product Requirements Document (PRD)

**Versi:** 1.0\
**Status:** Draft untuk ditinjau sebelum implementasi\
**Produk:** VeyraOS\
**Kategori:** Aplikasi web manajemen bisnis untuk UMKM Indonesia\
**Bahasa utama:** Bahasa Indonesia\
**Mata uang:** Rupiah (IDR)\
**Zona waktu default:** Asia/Jakarta

------------------------------------------------------------------------

## 1. Ringkasan Produk

VeyraOS adalah aplikasi web yang membantu pelaku usaha kecil mengelola
produk, persediaan, penjualan, pengeluaran, dan laporan keuangan
sederhana dalam satu tempat. Produk harus memprioritaskan kegunaan
operasional, integritas data, kemudahan penggunaan, dan keamanan---bukan
hanya tampilan visual.

VeyraOS juga menyediakan **Mode Demo** dengan data simulasi agar calon
pengusaha atau pengguna baru dapat memahami alur aplikasi sebelum
mengelola data bisnis sebenarnya.

### 1.1 Visi

Membantu pemilik usaha kecil memahami kondisi operasional dan keuangan
bisnisnya melalui pencatatan yang sederhana, konsisten, dan mudah
dipahami.

### 1.2 Tujuan MVP

1.  Memungkinkan pengguna membuat dan mengelola satu atau lebih profil
    bisnis.
2.  Memungkinkan pengguna mengelola produk dan memantau stok.
3.  Memungkinkan pengguna mencatat penjualan dan memperbarui stok secara
    konsisten.
4.  Memungkinkan pengguna mencatat pengeluaran dan pembelian persediaan.
5.  Menampilkan laporan dasar yang membedakan penjualan, harga pokok,
    laba, dan arus kas.
6.  Menyediakan Mode Demo yang aman dan terpisah dari data bisnis nyata.
7.  Menyediakan pengalaman yang responsif, mudah dipahami, dan aman pada
    desktop maupun ponsel.

### 1.3 Bukan Tujuan MVP

Hal berikut tidak termasuk dalam rilis MVP kecuali diputuskan secara
eksplisit pada tahap berikutnya:

-   Integrasi marketplace atau platform pengiriman.
-   Integrasi rekening bank dan rekonsiliasi otomatis.
-   Sistem akuntansi lengkap, perpajakan, atau pelaporan resmi.
-   Penggajian dan manajemen karyawan.
-   Kolaborasi multi-pengguna dengan peran kompleks.
-   Aplikasi native Android/iOS.
-   Operasi offline penuh.
-   Fitur AI yang mengambil keputusan atau mengubah data secara
    otomatis.
-   Langganan berbayar dan sistem penagihan otomatis.

------------------------------------------------------------------------

## 2. Target Pengguna dan Kebutuhan

### Persona A --- Pemilik Toko Kecil

**Kebutuhan:** mencatat penjualan, mengetahui stok yang menipis, dan
memahami apakah bisnis menghasilkan laba.

**Kendala:** pencatatan manual tersebar di buku, spreadsheet, atau
aplikasi pesan.

**Kriteria keberhasilan:** pengguna dapat menambahkan produk, mencatat
penjualan, dan memeriksa ringkasan bisnis tanpa membutuhkan pengetahuan
akuntansi khusus.

### Persona B --- Penjual Online Skala Kecil

**Kebutuhan:** memantau produk, biaya, penjualan, dan performa usaha
meskipun transaksi berasal dari berbagai kanal.

**Batasan MVP:** pencatatan dilakukan manual; integrasi marketplace
belum tersedia.

### Persona C --- Calon Pengusaha

**Kebutuhan:** mempelajari alur pengelolaan bisnis sebelum menggunakan
data sungguhan.

**Solusi:** Mode Demo yang langsung menampilkan data simulasi dan
memungkinkan pengguna mencoba alur inti tanpa mengubah data bisnis
nyata.

------------------------------------------------------------------------

## 3. Prinsip Produk

1.  **Fungsional sebelum dekoratif.** Setiap metrik, tombol, tabel, dan
    grafik harus mempunyai tujuan yang jelas.
2.  **Data keuangan dapat ditelusuri.** Angka ringkasan harus berasal
    dari catatan transaksi yang relevan.
3.  **Aman secara default.** Pengguna hanya boleh mengakses bisnis dan
    data yang menjadi haknya.
4.  **Mudah dipahami.** Gunakan Bahasa Indonesia yang jelas dan hindari
    istilah akuntansi tanpa penjelasan.
5.  **Tidak mengarang angka.** Data simulasi harus diberi label Demo;
    jangan tampilkan data demo sebagai data nyata.
6.  **Dapat dikembangkan.** Modul dan model data perlu mendukung
    penambahan fitur tanpa harus membangun ulang fondasi.
7.  **Responsif dan aksesibel.** Fungsi utama harus tetap dapat
    digunakan pada layar kecil dan dengan navigasi yang jelas.

------------------------------------------------------------------------

## 4. Ruang Lingkup Fitur MVP

### 4.1 Autentikasi dan Profil

Pengguna dapat: - Mendaftar dan masuk menggunakan metode autentikasi
yang dipilih pada technical planning. - Keluar dari akun. - Melihat dan
mengubah informasi profil dasar jika didukung. - Mengakses halaman
aplikasi yang dilindungi setelah autentikasi.

Kriteria penerimaan: - Halaman privat tidak dapat diakses tanpa
autentikasi, kecuali halaman publik dan Mode Demo yang memang dirancang
publik. - Status autentikasi ditangani secara konsisten. - Kredensial
dan secret tidak disimpan di source code atau log yang tidak aman. -
Alur pemulihan akun disediakan jika didukung oleh penyedia autentikasi
yang dipilih.

### 4.2 Manajemen Bisnis

Pengguna dapat: - Membuat bisnis dengan nama dan informasi dasar. -
Melihat bisnis yang dapat diakses. - Berpindah antarbisnis melalui
business switcher. - Mengubah pengaturan bisnis dasar.

Aturan: - Setiap entitas milik bisnis harus terikat ke `business_id`. -
Data bisnis tidak boleh tercampur saat pengguna berpindah bisnis. - MVP
menggunakan model pemilik tunggal per bisnis; dukungan tim dan peran
lanjutan ditunda. - Perubahan bisnis aktif harus memperbarui seluruh
data yang ditampilkan, bukan hanya label bisnis di antarmuka.

Kriteria penerimaan: - Pengguna dapat membuat minimal satu bisnis dan
berpindah ke bisnis lain. - Produk, transaksi, pengeluaran, dan laporan
hanya menampilkan data bisnis aktif. - Akses langsung ke ID bisnis milik
pengguna lain ditolak oleh lapisan keamanan server/database.

### 4.3 Dashboard

Dashboard menampilkan ringkasan untuk rentang tanggal yang dipilih: -
Penjualan bersih. - Harga pokok penjualan (HPP/COGS). - Laba kotor. -
Pengeluaran operasional yang tercatat. - Laba operasional sederhana. -
Ringkasan arus kas berdasarkan catatan arus kas yang tersedia. - Grafik
penjualan dari waktu ke waktu. - Transaksi terbaru. - Produk dengan stok
rendah.

Aturan: - Setiap metrik memiliki definisi dan rentang tanggal yang
konsisten. - Keadaan kosong menampilkan panduan tindakan, bukan angka
palsu. - Loading, error, dan empty states harus dirancang. - Grafik
harus dapat dipahami, memiliki label yang jelas, dan tetap terbaca pada
ponsel.

Kriteria penerimaan: - Angka dashboard dapat direkonsiliasi dengan data
sumber untuk rentang tanggal yang sama. - Perubahan data transaksi
tercermin setelah data berhasil disimpan dan dimuat ulang. - Data Demo
selalu diberi indikator Demo.

### 4.4 Produk dan Persediaan

Pengguna dapat: - Menambah, melihat, mengubah, dan mengarsipkan
produk. - Menyimpan nama produk, SKU opsional, harga jual, harga pokok
per unit, jumlah stok, dan ambang stok minimum. - Melihat daftar produk
dan mencari atau memfilter produk. - Melihat stok rendah. - Melihat
riwayat pergerakan stok.

Aturan: - Harga dan jumlah stok harus divalidasi. - SKU boleh kosong;
jika digunakan, aturan keunikannya harus ditetapkan pada tingkat
bisnis. - Perubahan stok harus tercatat sebagai stock movement dengan
alasan dan waktu. - Produk yang sudah dipakai dalam transaksi historis
tidak boleh dihapus secara destruktif sehingga merusak laporan; gunakan
pengarsipan atau soft delete. - Stok negatif tidak diperbolehkan secara
default.

Kriteria penerimaan: - Pengguna dapat membuat dan memperbarui produk
dengan input valid. - Input tidak valid menghasilkan pesan yang jelas. -
Setiap perubahan stok memiliki jejak yang dapat ditelusuri. - Produk
dari bisnis lain tidak dapat diakses melalui perubahan ID atau request
langsung.

### 4.5 Transaksi Penjualan

Pengguna dapat: - Membuat transaksi dengan satu atau lebih item
produk. - Menentukan kuantitas, diskon yang diizinkan, metode
pembayaran, dan catatan opsional. - Melihat total transaksi sebelum
menyimpan. - Melihat daftar dan detail transaksi sebelumnya. - Melakukan
pembatalan atau koreksi sesuai aturan yang ditetapkan.

Aturan: - Harga jual dan harga pokok unit disimpan sebagai snapshot pada
item transaksi. - Total transaksi dihitung di sisi server atau lapisan
tepercaya, bukan hanya mempercayai nilai total dari browser. -
Penyimpanan penjualan, item penjualan, dan pergerakan stok harus atomik:
seluruh operasi berhasil atau seluruhnya dibatalkan. - Stok harus cukup
sebelum transaksi diselesaikan. - Pembatalan harus menghasilkan
pembalikan stok dan penyesuaian laporan yang dapat ditelusuri, bukan
menghapus histori secara diam-diam. - Kebijakan retur, biaya platform,
dan diskon harus ditetapkan secara eksplisit sebelum implementasi penuh.
Untuk MVP, biaya platform tidak perlu diwajibkan jika belum menjadi
kebutuhan. - Metode pembayaran minimal dapat berupa tunai dan transfer;
daftar final dapat ditetapkan saat desain teknis.

Kriteria penerimaan: - Transaksi valid mengurangi stok sesuai
kuantitas. - Transaksi yang gagal tidak meninggalkan stok atau catatan
transaksi dalam keadaan parsial. - Penjualan dengan stok tidak cukup
ditolak dan menjelaskan alasannya. - Nilai historis tidak berubah hanya
karena harga produk saat ini diubah. - Transaksi yang dibatalkan tidak
lagi dihitung sebagai penjualan aktif dan jejak pembatalannya tetap
tersedia.

### 4.6 Pengeluaran

Pengguna dapat: - Mencatat pengeluaran dengan tanggal, kategori, jumlah,
dan deskripsi opsional. - Melihat, mencari, dan memfilter daftar
pengeluaran. - Mengubah atau membatalkan catatan sesuai kebijakan audit
yang ditetapkan.

Aturan: - Jumlah harus lebih besar dari nol. - Pengeluaran operasional
harus dibedakan dari pembelian persediaan agar perhitungan laba tidak
menghitung biaya yang sama dua kali. - Perubahan dan pembatalan catatan
perlu tercermin dalam laporan terkait.

Kriteria penerimaan: - Pengeluaran tersimpan pada bisnis yang aktif. -
Pengeluaran tercermin pada laporan sesuai tanggal dan kategori. -
Formulir memvalidasi input dan memberikan pesan kesalahan yang jelas.

### 4.7 Pembelian Persediaan

Pengguna dapat mencatat pembelian stok yang menambah jumlah persediaan
dan mencatat nilai kas keluar apabila pembayaran dicatat.

Aturan: - Pembelian persediaan menambah stok. - Pembelian persediaan
tidak otomatis seluruhnya menjadi HPP pada saat dibeli; HPP diakui untuk
unit yang terjual berdasarkan metode perhitungan yang ditetapkan. - MVP
perlu memilih metode penilaian persediaan yang konsisten, misalnya harga
pokok unit yang tersimpan pada produk untuk pendekatan sederhana. Jika
metode ini digunakan, keterbatasannya harus dijelaskan. - Jika harga
pokok produk berubah, transaksi historis tetap memakai snapshot yang
disimpan. - Pembatalan pembelian harus membalikkan perubahan stok dengan
aman dan tidak boleh membuat stok negatif.

Kriteria penerimaan: - Pembelian valid meningkatkan stok. - Perubahan
stok dan pencatatan pembelian konsisten. - Nilai pembelian tidak
dihitung ganda sebagai pengeluaran operasional dan HPP.

### 4.8 Laporan

Laporan MVP: - Ringkasan penjualan berdasarkan rentang tanggal. -
Ringkasan HPP dan laba kotor. - Ringkasan pengeluaran operasional dan
laba operasional sederhana. - Ringkasan arus kas dari transaksi
masuk/keluar yang benar-benar dicatat. - Rincian transaksi untuk
penelusuran angka. - Ekspor CSV untuk data laporan yang dipilih.

Aturan perhitungan: - **Penjualan bersih** = nilai penjualan yang valid
setelah diskon dan penyesuaian retur/pembatalan yang didukung. - **HPP**
= total harga pokok snapshot item yang terjual dan masih termasuk
penjualan aktif. - **Laba kotor** = penjualan bersih dikurangi HPP. -
**Laba operasional sederhana** = laba kotor dikurangi pengeluaran
operasional yang dikategorikan sebagai beban periode. - **Arus kas
tercatat** = arus masuk yang dicatat dikurangi arus keluar yang dicatat.
Arus kas bukan sinonim laba. - Pembelian persediaan dapat menjadi arus
kas keluar, tetapi tidak otomatis menjadi HPP saat pembelian.

Catatan: - Model arus kas MVP harus transparan mengenai jenis transaksi
yang disertakan. Jangan mengklaim sebagai laporan arus kas akuntansi
lengkap. - Perlakuan terhadap retur, piutang, pembayaran parsial, pajak,
dan biaya platform harus ditetapkan sebelum fitur terkait ditambahkan. -
Laporan tidak boleh menyajikan presisi palsu atau mengklaim sesuai
standar akuntansi formal.

Kriteria penerimaan: - Total laporan cocok dengan transaksi sumber pada
filter yang sama. - CSV berisi kolom yang jelas, nilai yang benar, dan
data dari bisnis/rentang tanggal yang dipilih. - Jika tidak ada data,
tampilkan empty state dan bukan angka simulasi.

### 4.9 Mode Demo

Mode Demo ditujukan bagi pengguna yang ingin mencoba VeyraOS tanpa
memasukkan data bisnis nyata.

Persyaratan: - Menyediakan bisnis, produk, transaksi, stok, dan laporan
simulasi yang koheren. - Menampilkan penanda Demo secara jelas. - Tidak
mencampur atau menyalin data simulasi ke bisnis nyata secara otomatis. -
Reset demo harus mengembalikan data simulasi ke keadaan awal yang
konsisten. - Pengguna dapat diarahkan untuk membuat akun atau bisnis
nyata setelah mencoba demo. - Cara penyimpanan demo (misalnya data
statis, sesi terisolasi, atau penyimpanan khusus) diputuskan pada
technical planning dengan mempertimbangkan keamanan dan biaya.

Kriteria penerimaan: - Perubahan data demo tidak mengubah data bisnis
nyata. - Pengguna memahami bahwa angka demo bukan data aktual. - Demo
tetap memiliki alur yang dapat dicoba tanpa membuat akun, jika keputusan
implementasi mendukung demo publik.

### 4.10 Pengaturan

Pengaturan dasar: - Nama bisnis dan informasi dasar. - Mata uang IDR
sebagai default. - Zona waktu Asia/Jakarta sebagai default. - Profil
pengguna dan preferensi dasar yang benar-benar didukung.

Jangan menampilkan pengaturan yang belum berfungsi.

------------------------------------------------------------------------

## 5. Aturan Keuangan dan Integritas Data

1.  Gunakan tipe data numerik yang sesuai untuk uang; hindari
    floating-point biner untuk perhitungan finansial.
2.  Tetapkan aturan pembulatan Rupiah secara konsisten.
3.  Hitung total transaksi dari detail item dan aturan diskon yang
    jelas.
4.  Simpan snapshot harga jual dan harga pokok pada item penjualan.
5.  Gunakan transaksi database untuk operasi yang harus berhasil atau
    gagal bersama.
6.  Jangan menghapus catatan historis secara destruktif jika pengarsipan
    atau pembatalan lebih tepat.
7.  Catat perubahan stok melalui ledger/pergerakan stok yang dapat
    ditelusuri.
8.  Pastikan pembatalan dan koreksi tidak menggandakan atau
    menghilangkan stok maupun nilai laporan.
9.  Definisikan kebijakan tanggal, zona waktu, dan batas awal/akhir
    rentang laporan secara konsisten.
10. Jelaskan keterbatasan laporan MVP dan jangan memosisikannya sebagai
    sistem akuntansi lengkap.

### Keputusan yang harus diselesaikan saat technical planning

-   Metode penilaian persediaan untuk HPP.
-   Perlakuan retur dan pembatalan.
-   Apakah diskon berlaku per item, per transaksi, atau keduanya.
-   Apakah biaya platform dimasukkan dalam MVP.
-   Definisi arus kas yang didukung.
-   Kebijakan perubahan transaksi setelah periode laporan ditutup, jika
    kelak diperlukan.

------------------------------------------------------------------------

## 6. Persyaratan Keamanan dan Privasi

-   Gunakan autentikasi yang teruji dan pengelolaan sesi yang aman.
-   Terapkan otorisasi di server/database, bukan hanya menyembunyikan
    elemen UI.
-   Gunakan Row Level Security jika menggunakan Supabase.
-   Pastikan setiap query dan operasi tulis memeriksa hak akses terhadap
    bisnis terkait.
-   Terapkan validasi input di sisi server dan browser.
-   Simpan secret di environment variables yang sesuai dan jangan commit
    file secret.
-   Hindari menyimpan data sensitif yang tidak diperlukan.
-   Jangan memasukkan informasi rahasia ke pesan error atau log yang
    dapat diakses publik.
-   Sediakan penanganan error yang aman dan dapat ditindaklanjuti.
-   Periksa kebijakan akses untuk Mode Demo secara terpisah.
-   Gunakan HTTPS pada deployment produksi.

------------------------------------------------------------------------

## 7. Identitas Merek dan UI/UX

### 7.1 Nama dan posisi merek

**VeyraOS** --- platform manajemen bisnis untuk membantu pengguna
menjalankan usaha dan memahami angka bisnisnya.

Tagline kerja: **"Run your business. Know your numbers."**

Tagline ini masih dapat dievaluasi kembali sebelum peluncuran publik.

### 7.2 Palet warna Royal Violet

  Token           Nilai HEX   Penggunaan
  --------------- ----------- -------------------------------------
  Primary         `#5B3CC4`   CTA, tautan, ikon aktif
  Primary Hover   `#4930A5`   Hover tombol utama
  Deep Purple     `#392477`   Penekanan dan elemen gelap tertentu
  Lavender        `#EAE4FF`   Latar pilihan dan sorotan lembut
  Lavender Tint   `#F6F3FF`   Latar pendukung
  Warm Ivory      `#FAF9F6`   Latar halaman
  Charcoal        `#25232B`   Teks utama
  Muted Text      `#716D7A`   Teks sekunder
  Border          `#E7E3EC`   Garis pemisah dan batas komponen

Gunakan Light Mode sebagai tampilan awal. Pastikan kontras teks dan
kontrol memenuhi standar aksesibilitas yang relevan. Status sukses,
peringatan, dan kesalahan harus tetap dapat dibedakan tanpa mengandalkan
warna saja.

### 7.3 Prinsip desain

-   Hirarki visual jelas dan konsisten.
-   Navigasi sederhana dan mudah ditemukan.
-   Tabel, formulir, filter, dan grafik mengutamakan keterbacaan.
-   Hindari gradien berlebihan, glow dekoratif, glassmorphism tanpa
    alasan, dan animasi yang mengganggu.
-   Gunakan animasi singkat hanya bila membantu memberi umpan balik.
-   Gunakan komponen desain yang konsisten; jangan menampilkan tombol
    atau menu yang tidak berfungsi.
-   Desain untuk layar kecil mulai dari lebar sekitar 360 px, lalu skala
    ke tablet dan desktop.
-   Sediakan loading, error, empty, success, dan disabled states.

------------------------------------------------------------------------

## 8. Persyaratan Nonfungsional

### Performa

-   Target awal Core Web Vitals pada kondisi yang representatif: LCP ≤
    2,5 detik, INP ≤ 200 ms, CLS ≤ 0,1.
-   Hindari memuat pustaka atau data yang tidak diperlukan.
-   Gunakan pagination atau strategi pemuatan data yang sesuai untuk
    daftar besar.

### Aksesibilitas

-   Target WCAG 2.2 AA sejauh dapat diterapkan.
-   Navigasi keyboard, fokus yang terlihat, label input, pesan validasi,
    dan kontras yang memadai.
-   Jangan mengandalkan warna saja untuk menyampaikan status.

### Responsivitas

-   Fungsi inti harus dapat digunakan pada ponsel, tablet, dan desktop.
-   Tabel kompleks harus memiliki strategi tampilan mobile yang layak,
    bukan sekadar diperkecil hingga sulit dibaca.

### Pemeliharaan

-   Gunakan TypeScript dan struktur modul yang jelas.
-   Pisahkan komponen UI, logika domain, akses data, dan validasi.
-   Sertakan migrasi database dan dokumentasi konfigurasi.
-   Gunakan version control dan perubahan bertahap yang dapat ditinjau.

------------------------------------------------------------------------

## 9. Model Data Konseptual

Model ini merupakan rancangan awal; struktur final harus ditinjau pada
tahap technical planning.

-   `users/profiles`: informasi profil yang terkait dengan autentikasi.
-   `businesses`: bisnis yang dimiliki pengguna.
-   `products`: produk per bisnis.
-   `sales`: header transaksi penjualan.
-   `sale_items`: detail item dan snapshot harga jual/HPP.
-   `expenses`: catatan beban operasional.
-   `inventory_purchases`: header pembelian persediaan.
-   `purchase_items`: detail item pembelian.
-   `stock_movements`: histori perubahan stok dan sumber perubahan.
-   Entitas tambahan untuk pembayaran atau arus kas hanya jika
    diperlukan dan didefinisikan secara eksplisit.

Persyaratan: - Entitas bisnis harus memiliki foreign key yang sesuai. -
Tambahkan indeks untuk query umum seperti business, tanggal transaksi,
dan relasi item. - Gunakan constraint database untuk menjaga
konsistensi. - Tentukan strategi ID yang aman dan konsisten. - Tentukan
apakah Mode Demo menggunakan skema terpisah, data terisolasi, atau
mekanisme lain yang aman.

------------------------------------------------------------------------

## 10. Kriteria Penerimaan MVP

MVP dapat dipertimbangkan siap untuk evaluasi awal jika:

1.  Pengguna dapat masuk dan membuat bisnis.
2.  Pengguna dapat membuat beberapa bisnis dan berpindah di antaranya
    tanpa kebocoran data.
3.  Pengguna dapat membuat dan mengubah produk.
4.  Pengguna dapat mencatat pembelian persediaan dan melihat stok
    bertambah.
5.  Pengguna dapat mencatat penjualan dan melihat stok berkurang dengan
    benar.
6.  Transaksi gagal tidak meninggalkan pembaruan parsial.
7.  Pengeluaran tercermin pada laporan yang relevan.
8.  Dashboard dan laporan cocok dengan data transaksi sumber.
9.  Ekspor CSV mengikuti filter yang dipilih.
10. Mode Demo terpisah dari bisnis nyata dan memiliki penanda yang
    jelas.
11. Input tidak valid ditolak dengan pesan yang dapat dipahami.
12. Tampilan inti berfungsi pada ponsel dan desktop.
13. Aturan keamanan mencegah akses tidak sah terhadap bisnis lain.
14. Dokumentasi konfigurasi dan deployment tersedia.
15. Pengujian otomatis dan manual yang relevan lulus sebelum deployment
    produksi.

------------------------------------------------------------------------

## 11. Rencana Pengujian

### Pengujian fungsional

-   Membuat bisnis, produk, pembelian, penjualan, dan pengeluaran.
-   Mengubah serta membatalkan catatan sesuai kebijakan.
-   Memfilter laporan berdasarkan rentang tanggal.
-   Mengekspor CSV.

### Pengujian integritas data

-   Penjualan mengurangi stok tepat satu kali.
-   Kegagalan transaksi tidak mengubah stok atau menyimpan header/item
    secara parsial.
-   Pembatalan membalikkan efek sesuai aturan.
-   Perubahan harga produk tidak mengubah snapshot transaksi historis.
-   Pembelian persediaan tidak dihitung ganda sebagai HPP dan beban
    operasional.

### Pengujian keamanan

-   Pengguna A tidak dapat membaca atau mengubah data bisnis pengguna B.
-   Pergantian `business_id` pada request tidak melewati otorisasi.
-   Akses tanpa sesi ke halaman privat ditolak.
-   Secret tidak muncul di bundle browser atau repository.

### Pengujian UI

-   Tampilan pada viewport ponsel, tablet, dan desktop.
-   Keyboard focus, label, kontras, dan pesan error.
-   Loading, empty, success, dan error states.
-   Tabel dan grafik tetap dapat dipahami pada layar kecil.

### Pengujian Mode Demo

-   Perubahan demo tidak memengaruhi bisnis nyata.
-   Reset demo menghasilkan kondisi awal yang konsisten.
-   Semua data simulasi diberi label yang jelas.

------------------------------------------------------------------------

## 12. Risiko dan Mitigasi

  -----------------------------------------------------------------------
  Risiko                              Mitigasi
  ----------------------------------- -----------------------------------
  Angka laba atau arus kas            Tetapkan definisi, tampilkan
  menyesatkan                         penjelasan, dan uji terhadap data
                                      sumber

  Data bisnis bocor antarpengguna     Otorisasi server/database, RLS, dan
                                      pengujian akses negatif

  Stok berubah tidak konsisten        Transaksi database atomik dan stock
                                      movement ledger

  MVP terlalu luas                    Fokus pada fitur yang ditetapkan;
                                      tunda integrasi dan AI

  Antarmuka menarik tetapi tidak      Kriteria penerimaan dan QA untuk
  berfungsi                           setiap alur

  Biaya layanan meningkat             Verifikasi batas paket gratis dan
                                      pantau penggunaan

  Pengguna salah memahami Mode Demo   Penanda Demo yang konsisten dan
                                      pemisahan data
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 13. Validasi Produk

Sebelum menganggap produk cocok untuk pasar, lakukan wawancara
eksploratif dengan sekitar 5--8 pemilik usaha atau calon pengguna yang
sesuai, lalu uji prototipe.

Pertanyaan validasi: - Bagaimana mereka mencatat penjualan dan stok saat
ini? - Bagian mana yang paling sering memakan waktu atau menimbulkan
kesalahan? - Laporan apa yang paling sering mereka butuhkan? - Apakah
mereka memahami perbedaan omzet, laba, dan arus kas? - Apakah alur
VeyraOS mudah digunakan tanpa bantuan?

Jumlah tersebut hanya untuk eksplorasi awal, bukan bukti statistik bahwa
pasar telah tervalidasi.

------------------------------------------------------------------------

## 14. Asumsi dan Keputusan Terbuka

Asumsi awal: - VeyraOS dimulai sebagai web app responsif. - MVP
menggunakan satu pemilik per bisnis. - Pencatatan transaksi dilakukan
manual. - Bahasa dan mata uang default adalah Bahasa Indonesia dan
IDR. - Mode Demo disediakan untuk calon pengguna. - AI dan integrasi
pihak ketiga belum menjadi bagian MVP.

Keputusan yang perlu ditinjau sebelum implementasi: 1. Penyedia
autentikasi dan metode login yang dipakai. 2. Metode penilaian
persediaan untuk HPP. 3. Kebijakan retur, pembatalan, dan koreksi
transaksi. 4. Definisi arus kas yang tepat untuk kebutuhan MVP. 5.
Detail skenario Mode Demo dan mekanisme reset. 6. Pilihan
hosting/database berdasarkan batas paket gratis, keamanan, dan kebutuhan
deployment. 7. Apakah MVP membutuhkan bukti transaksi atau unggahan
lampiran. 8. Kebutuhan pencadangan dan pemulihan data.

------------------------------------------------------------------------

## 15. Urutan Tahapan Pengembangan

1.  Tinjau dan setujui PRD.
2.  Susun design system dan arsitektur UI/UX.
3.  Susun technical plan dan tinjau keputusan terbuka.
4.  Siapkan repository dan fondasi proyek.
5.  Siapkan database, migrasi, autentikasi, dan keamanan.
6.  Implementasikan modul produk dan persediaan.
7.  Implementasikan penjualan dan konsistensi stok.
8.  Implementasikan pengeluaran, pembelian persediaan, dan laporan.
9.  Implementasikan Mode Demo.
10. Jalankan QA, perbaiki temuan, dan siapkan deployment.
11. Lakukan evaluasi dengan calon pengguna.

Setiap tahap harus memiliki hasil yang dapat diperiksa dan persetujuan
sebelum tahap berikutnya dimulai.

------------------------------------------------------------------------

## 16. Definisi Selesai untuk Tahap PRD

Tahap PRD selesai jika: - Dokumen ini ditinjau dan disetujui. - Asumsi
dan keputusan terbuka diketahui. - Cakupan MVP tidak ambigu. - Kriteria
penerimaan dapat diuji. - Tidak ada klaim bahwa fitur sudah dibangun
atau divalidasi sebelum benar-benar dilakukan.

**Instruksi untuk AI coding agent:** PRD ini adalah sumber acuan produk.
Jika ada konflik antara permintaan implementasi baru dan dokumen ini,
jelaskan konflik serta dampaknya dan minta konfirmasi sebelum mengubah
cakupan. Jangan mulai implementasi hanya berdasarkan PRD ini tanpa
persetujuan eksplisit pengguna.
