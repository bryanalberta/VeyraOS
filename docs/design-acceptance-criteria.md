# VeyraOS --- Design Acceptance Criteria & Implementation Handoff

**Versi:** 1.0  
**Status:** Disetujui untuk Panduan Implementasi & Visual QA (Phase 2 Baseline)  
**Produk:** VeyraOS  
**Standar Kepatuhan:** WCAG 2.2 Level AA & Mobile-First (360px+)  

---

## 1. Persyaratan Aksesibilitas & Responsivitas (A11y & Responsive Standards)

### 1.1 Navigasi Keyboard & Visibilitas Fokus
- Seluruh elemen interaktif (tombol, tautan, input, dropdown, baris tabel yang dapat diklik) wajib dapat dijangkau dan dioperasikan menggunakan tombol `Tab`, `Shift + Tab`, `Enter`, dan `Space`.
- Cincin fokus (*focus ring*) wajib terlihat jelas dengan token `--focus-ring` (Royal Violet `0 0 0 3px rgba(91, 60, 196, 0.28)` dengan offset 2px). Tidak diperbolehkan menghilangkan outline menggunakan `outline: none` tanpa pengganti yang memenuhi kontras.
- Modal dialog dan bottom sheet wajib mengunci fokus (*focus trap*) saat terbuka dan mengembalikan fokus ke elemen pemicu saat ditutup menggunakan tombol `Escape`.

### 1.2 Rasio Kontras Warna (WCAG 2.2 AA)
- Teks standar terhadap latar belakang wajib memiliki rasio kontras minimal **4.5:1**:
  - Charcoal (`#25232B`) pada Warm Ivory (`#FAF9F6`) = **13.8:1** (Lolos Sangat Baik).
  - Charcoal (`#25232B`) pada White (`#FFFFFF`) = **14.9:1** (Lolos Sangat Baik).
  - White (`#FFFFFF`) pada Primary Purple (`#5B3CC4`) = **5.8:1** (Lolos Baik).
  - Muted Text (`#716D7A`) pada White (`#FFFFFF`) = **4.9:1** (Lolos).
- Elemen batas kontrol input (`--color-border` `#E7E3EC`) dan ikon status semantik memiliki kontras minimal **3.0:1** terhadap latar sekitarnya.

### 1.3 Label Formulir & Pengumuman Pembaca Layar (Screen Readers)
- Setiap bidang input formulir wajib memiliki pasangan elemen `<label>` dengan atribut `for` yang cocok dengan `id` input.
- Pesan kesalahan validasi wajib ditautkan ke input menggunakan `aria-describedby="[id-error]"` dan menyertakan atribut `role="alert"` atau `aria-live="polite"`.
- Tombol yang hanya memuat ikon wajib memiliki atribut `aria-label` yang deskriptif dalam Bahasa Indonesia (misal: `aria-label="Tutup modal dialog"` atau `aria-label="Cari produk"`).

### 1.4 Ukuran Target Sentuh Minimal (Touch Target Sizing)
- Seluruh tombol, ikon aksi, dan elemen interaktif pada viewport mobile ($< 768px$) wajib memiliki area sentuh minimal **44 × 44 piksel**.
- Jarak antar elemen tombol yang berdekatan minimal 8 piksel untuk mencegah salah tekan saat pengoperasian satu tangan.

### 1.5 Transformasi Tabel ke Kartu Mobile (360px – 767px)
- Pada lebar layar $< 768px$, tabel multi-kolom wajib secara otomatis bertransformasi menjadi daftar kartu data vertikal (*Card List Layout*).
- Dilarang memaksa tabel desktop menyusut dengan teks mengecil atau menyebabkan *horizontal scrolling* seluruh halaman yang merusak navigasi ponsel.

---

## 2. Inventaris Komponen UI (Component Inventory)

Berikut adalah daftar komponen inti yang akan dibangun pada tahap implementasi UI:

```
src/components/
├── ui/
│   ├── Button.tsx              # Primary, Secondary, Ghost, Destructive, Icon
│   ├── Input.tsx               # Text, Password, Email, Helper text, Error state
│   ├── CurrencyInput.tsx       # Rupiah formatted auto-masking input (Integer value)
│   ├── Select.tsx              # Dropdown selector dengan label & helper
│   ├── StatCard.tsx            # Kartu ringkasan metrik finansial dengan tooltip
│   ├── Badge.tsx               # Pill status (Sukses, Peringatan, Bahaya, Info, Demo)
│   ├── Table.tsx               # Desktop tabular data with responsive mobile cards
│   ├── Modal.tsx               # Centered desktop dialog / Mobile bottom sheet
│   ├── Alert.tsx               # Banner informasi kontekstual / peringatan
│   ├── Skeleton.tsx            # Shimmer loading placeholder blocks
│   └── EmptyState.tsx          # Ilustrasi, pesan panduan, dan tombol aksi primer
├── layout/
│   ├── AppLayout.tsx           # Layout pembungkus aplikasi (Sidebar + TopBar + Canvas)
│   ├── Sidebar.tsx             # Navigasi utama desktop & collapsible tablet
│   ├── MobileNav.tsx           # Fixed bottom navigation bar & action button
│   ├── BusinessSwitcher.tsx    # Dropdown ganti bisnis aktif & tambah bisnis
│   └── DemoBanner.tsx          # Banner persisten penanda Mode Demo
└── modules/
    ├── sales/
    │   ├── PosProductGrid.tsx  # Grid katalog pencarian cepat produk
    │   ├── PosCartDrawer.tsx   # Keranjang transaksi, diskon, & kalkulasi total
    │   └── VoidSaleDialog.tsx  # Dialog konfirmasi pembatalan transaksi dengan alasan
    ├── products/
    │   ├── ProductForm.tsx     # Form tambah/edit produk dengan peringatan HPP
    │   └── StockMovementList.tsx # Riwayat ledger mutasi persediaan
    ├── expenses/
    │   └── ExpenseForm.tsx     # Form pengeluaran dengan pengingat anti-double HPP
    ├── purchases/
    │   └── PurchaseForm.tsx    # Form restock dengan indikator moving average cost
    └── reports/
        ├── FinancialSummary.tsx# Ringkasan Laba Kotor, Operasional, & Arus Kas
        └── CsvExportModal.tsx  # Modal unduh data CSV sesuai filter aktif
```

---

## 3. Checklist Visual & UX Quality Assurance (QA Checklist)

Gunakan daftar periksa ini saat memverifikasi hasil implementasi:

### A. Umum & Brand Identity
- [ ] Latar belakang halaman aplikasi menggunakan Warm Ivory (`#FAF9F6`), bukan putih polos menyilaukan atau abu-abu kusam.
- [ ] Warna Royal Violet (`#5B3CC4`) digunakan secara terukur untuk tombol utama, tab aktif, dan fokus; tidak ada dekorasi ungu neon atau gradien berlebih.
- [ ] Font keluarga adalah Plus Jakarta Sans dan angka finansial menggunakan tabular numeric.
- [ ] Seluruh nilai mata uang diawali dengan `Rp` dan menggunakan pemisah ribuan titik (contoh: `Rp 1.500.000`), tanpa desimal sen.

### B. Mode Demo
- [ ] Banner Mode Demo menempel permanen di bagian atas seluruh layar aplikasi saat rute berawalan `/demo/`.
- [ ] Lencana `MODE DEMO` berwarna kuning emas terlihat jelas.
- [ ] Tombol *"Reset Data Demo"* berfungsi mengembalikan state simulasi dalam $< 500$ ms.
- [ ] Transaksi atau produk baru di Mode Demo tersimpan di penyimpanan lokal dan sama sekali tidak mengirim request ke database nyata.

### C. Business Switcher
- [ ] Dropdown menampilkan nama bisnis aktif dan daftar bisnis lain milik pengguna.
- [ ] Mengganti bisnis langsung memperbarui seluruh tampilan produk, transaksi, dan dashboard ke ID bisnis yang baru.
- [ ] Menambah bisnis baru membatasi hingga maksimal 5 bisnis per akun pada MVP.

### D. Produk & Persediaan
- [ ] Menambah produk baru memvalidasi harga jual $> 0$ dan harga pokok $\ge 0$.
- [ ] Peringatan muncul jika harga jual diatur lebih rendah dari harga pokok.
- [ ] Filter *"Stok Menipis"* menyaring produk yang `stok <= stok_minimum` dengan benar.
- [ ] Produk yang sudah memiliki riwayat penjualan tidak dapat dihapus permanen (hanya dapat diarsipkan).
- [ ] Stok negatif ditolak oleh sistem.

### E. Penjualan & Kasir Cepat
- [ ] Pencarian produk bekerja instan saat mengetik nama atau SKU.
- [ ] Mengklik produk menambahkannya ke keranjang penjualan.
- [ ] Jika kuantitas melebihi stok tersedia, tombol bayar dinonaktifkan dengan pesan error yang jelas.
- [ ] Total akhir dihitung tepat: $\text{Subtotal} - \text{Diskon}$.
- [ ] Pilihan metode bayar Tunai dan Transfer Bank tersedia.
- [ ] Transaksi berhasil menampilkan ringkasan nota dan mencatat snapshot harga serta HPP.
- [ ] Pembatalan penjualan (Void) meminta alasan wajib minimal 5 karakter dan membalikkan stok ke gudang.

### F. Pengeluaran & Pembelian
- [ ] Form pengeluaran menyertakan teks peringatan bahwa pembelian stok dicatat di menu Pembelian.
- [ ] Pembelian stok barang berhasil menambah stok dan menghitung harga pokok rata-rata baru (*moving average*).
- [ ] Pembelian stok tidak dihitung sebagai beban operasional di laporan laba rugi.

### G. Laporan & Ekspor CSV
- [ ] Filter rentang tanggal (Hari Ini, 7 Hari, Bulan Ini, Kustom) memperbarui seluruh ringkasan angka secara konsisten.
- [ ] Laba Kotor = Penjualan Bersih dikurangi HPP.
- [ ] Laba Operasional = Laba Kotor dikurangi Pengeluaran Operasional.
- [ ] Arus Kas Bersih = Kas Masuk dikurangi Kas Keluar.
- [ ] Ekspor CSV mengunduh berkas dengan nama terformat dan kolom data yang rapi sesuai filter aktif.

### H. Responsivitas Layar (360px ke Desktop)
- [ ] Di layar ponsel lebar 360px, seluruh teks terbaca tanpa terpotong dan tidak ada pergeseran horizontal yang tidak diinginkan.
- [ ] Tabel berubah menjadi kartu data terstruktur di layar ponsel.
- [ ] Bilah navigasi bawah (*Bottom Nav*) tetap menempel di dasar layar ponsel dengan target sentuh $\ge 44$px.
