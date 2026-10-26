# VeyraOS --- Design System Specification

**Versi:** 1.0  
**Status:** Disetujui untuk Panduan Implementasi (Phase 2 Design System Baseline)  
**Produk:** VeyraOS  
**Arah Desain:** Royal Violet (Light Mode Default, Restrained, Clean & Highly Functional)  
**Standar Aksesibilitas:** WCAG 2.2 Level AA  

---

## 1. Prinsip Desain VeyraOS

1. **Fungsional & Restrained (Bukan Dekorasi Semata):**
   Setiap piksel, warna, dan komponen melayani alur kerja nyata pemilik usaha UMKM di Indonesia. Tidak ada gradien berlebihan, efek glow neon, glassmorphism semu, sudut membulat berlebihan (>20px), atau grafik hiasan yang tidak dapat ditindaklanjuti.
2. **Keterbacaan Finansial Tanpa Ambiguitas:**
   Data keuangan adalah nyawa bisnis. Angka moneter wajib menggunakan tipografi angka tabular (`tabular-nums`), pemisah ribuan standar Indonesia (`1.500.000`), dan label yang tegas membedakan Omzet (Penjualan Bersih), HPP, Laba Kotor, Biaya Operasional, Laba Operasional, dan Arus Kas.
3. **Penyajian Status Multi-Sensori (Bukan Warna Saja):**
   Status stok, peringatan, transaksi berhasil, atau pembatalan tidak boleh hanya mengandalkan perubahan warna. Setiap status wajib menyertakan ikon semantik SVG yang jelas dan teks deskriptif untuk memenuhi standar aksesibilitas WCAG 2.2 AA.
4. **Sentuhan Ramah Ponsel (Mobile-First Ergonomics):**
   Pemilik toko dan pedagang online sering mengoperasikan aplikasi melalui ponsel (lebar 360px ke atas) dengan satu tangan. Target sentuh minimal adalah 44×44 px, kontrol kritis diletakkan dalam zona jangkauan jempol (bottom-sheet / bottom-bar), dan tabel bertransformasi menjadi kartu data terstruktur di layar kecil.
5. **Isolasi Visual & Psiko-Kognitif Mode Demo:**
   Mode Demo memiliki penanda visual kontras tinggi yang persisten di seluruh halaman, memastikan pengguna tidak pernah salah mengira data simulasi sebagai transaksi nyata toko mereka.

---

## 2. Fondasi Token Desain (Design Tokens)

### 2.1 Palet Warna Royal Violet & Permukaan

```css
:root {
  /* --- Brand Core Tokens --- */
  --color-primary: #5B3CC4;         /* Tombol CTA utama, status aktif, tautan */
  --color-primary-hover: #4930A5;   /* State hover & fokus tombol utama */
  --color-primary-active: #3C258C;  /* State tekan (active) tombol utama */
  --color-deep-purple: #392477;     /* Header aksen, teks penekanan khusus, brand badge */
  --color-lavender: #EAE4FF;        /* Sorotan baris tabel, latar badge aktif, selected chip */
  --color-lavender-tint: #F6F3FF;   /* Kontainer sekunder, latar stat card, banner lembut */
  
  /* --- Neutral & Surface Tokens --- */
  --color-warm-ivory: #FAF9F6;      /* Latar belakang halaman aplikasi (canvas background) */
  --color-surface-white: #FFFFFF;   /* Latar kartu (card), modal, popover, dan panel input */
  --color-charcoal: #25232B;        /* Teks utama (heading, angka, teks isi prioritas) */
  --color-muted-text: #716D7A;      /* Teks sekunder, label formulir, petunjuk (hints) */
  --color-border: #E7E3EC;          /* Garis batas kartu, pemisah tabel, border default input */
  --color-border-subtle: #F0EDF5;   /* Garis pemisah internal (divider) */
  
  /* --- Semantic Status Tokens (Accessible High Contrast) --- */
  /* Success: Stok aman, transaksi berhasil, laba positif */
  --color-success: #1E824C;
  --color-success-bg: #E8F8F0;
  --color-success-border: #A3E4D7;
  --color-success-text: #0E6251;

  /* Warning: Stok menipis, peringatan harga jual < harga pokok */
  --color-warning: #B9770E;
  --color-warning-bg: #FEF9E7;
  --color-warning-border: #FAD7A0;
  --color-warning-text: #7D6608;

  /* Danger / Destructive: Stok habis, error validasi, pembatalan (void) */
  --color-danger: #C0392B;
  --color-danger-bg: #FDEDEC;
  --color-danger-border: #F5B7B1;
  --color-danger-text: #922B21;

  /* Info: Panduan onboarding, indikator Mode Demo */
  --color-info: #2980B9;
  --color-info-bg: #EBF5FB;
  --color-info-border: #AED6F1;
  --color-info-text: #1B4F72;

  /* Demo Mode Marker (High Distinction) */
  --color-demo-banner-bg: #392477;
  --color-demo-banner-text: #FFFFFF;
  --color-demo-badge-bg: #FFD54F;
  --color-demo-badge-text: #25232B;
}
```

### 2.2 Tipografi

- **Font Keluarga Utama:** `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`  
  *Alasan Pemilihan:* Huruf geometris modern berlegibilitas tinggi pada layar kecil, dirancang khusus untuk kenyamanan membaca Bahasa Indonesia dan istilah operasional.
- **Font Angka Tabular (Financial/Monetary):** `'JetBrains Mono', 'SFMono-Regular', Consolas, monospace` dipadukan dengan deklarasi CSS `font-variant-numeric: tabular-nums lining-nums;`.  
  *Alasan Pemilihan:* Menjamin angka dalam tabel dan kartu statistik sejajar tegak lurus secara sempurna saat dibandingkan.

#### Skala Tipografi:

| Tingkat (Token) | Ukuran (Mobile) | Ukuran (Desktop) | Line Height | Font Weight | Kegunaan |
|---|---|---|---|---|---|
| `--text-display` | 24px (1.5rem) | 30px (1.875rem) | 1.25 | 700 (Bold) | Judul halaman utama, angka total besar |
| `--text-h1` | 20px (1.25rem) | 24px (1.5rem) | 1.3 | 700 (Bold) | Judul modul (Dashboard, Penjualan) |
| `--text-h2` | 17px (1.06rem) | 19px (1.187rem) | 1.35 | 600 (SemiBold) | Header seksi kartu, judul modal dialog |
| `--text-h3` | 15px (0.938rem) | 16px (1.0rem) | 1.4 | 600 (SemiBold) | Sub-header tabel, label kelompok data |
| `--text-body` | 14px (0.875rem) | 14px (0.875rem) | 1.5 | 400 / 500 | Teks isi standar, nilai tabel, input text |
| `--text-caption` | 12px (0.75rem) | 12px (0.75rem) | 1.4 | 500 (Medium) | Label form, teks pembantu, stempel waktu |
| `--text-micro` | 11px (0.688rem) | 11px (0.688rem) | 1.3 | 600 (SemiBold) | Badge status, tag chip, metadata kecil |

### 2.3 Skala Spasi (8pt Grid System)

```css
:root {
  --space-1: 4px;    /* Micro spacing, badge padding horizontal */
  --space-2: 8px;    /* Compact gap, icon to text, element margin */
  --space-3: 12px;   /* Form field internal padding, stack item gap */
  --space-4: 16px;   /* Standard card padding mobile, container margin */
  --space-5: 20px;   /* Section gap on mobile */
  --space-6: 24px;   /* Desktop card padding, standard grid gap */
  --space-8: 32px;   /* Layout gutter desktop, module separator */
  --space-10: 40px;  /* Page top header margin */
  --space-12: 48px;  /* Hero or empty state top padding */
}
```

### 2.4 Border Radius & Elevasi (Shadows)

```css
:root {
  /* Border Radii: Restrained, tidak terlalu membulat */
  --radius-xs: 4px;   /* Badge, tooltip, tag kecil */
  --radius-sm: 6px;   /* Input field, tombol kecil, select */
  --radius-md: 8px;   /* Tombol standar, dropdown menu, notification toast */
  --radius-lg: 12px;  /* Kartu utama (card), container modal, drawer dialog */
  --radius-full: 9999px; /* Status pill chip, avatar inisial */

  /* Shadows: Lembut, berbasis Charcoal tint tanpa blur berlebih */
  --shadow-sm: 0 1px 2px 0 rgba(37, 35, 43, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(37, 35, 43, 0.07), 0 2px 4px -2px rgba(37, 35, 43, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(37, 35, 43, 0.08), 0 4px 6px -4px rgba(37, 35, 43, 0.03);
  --shadow-modal: 0 20px 25px -5px rgba(37, 35, 43, 0.12), 0 8px 10px -6px rgba(37, 35, 43, 0.04);

  /* Focus Ring Konsisten (Aksesibilitas Keyboard) */
  --focus-ring: 0 0 0 3px rgba(91, 60, 196, 0.28);
}
```

### 2.5 Breakpoints & Layout Container

- **Mobile Small:** `360px` – Desain baseline terendah (sebagian besar ponsel entry-level Android UMKM).
- **Mobile Large:** `480px` – Ponsel layar lebar.
- **Tablet:** `768px` – iPad/Tablet kasir (orientasi portrait & landscape awal).
- **Desktop Standard:** `1024px` – Laptop dan PC kasir toko.
- **Desktop Wide:** `1280px+` – Monitor dashboard kantor (maksimal lebar konten aplikasi: `1400px` terpusat).

### 2.6 Aturan Visualisasi Data Keuangan (Financial Charts)

1. **Grafik Garis Penjualan (Sales Trend):**
   - Garis tunggal berwarna Brand Primary `#5B3CC4` dengan ketebalan 2.5px.
   - Area isi di bawah garis menggunakan warna gradasi halus dari `rgba(91, 60, 196, 0.12)` menuju transparan `rgba(91, 60, 196, 0.0)`.
   - Titik data (*data points*) muncul saat hover/fokus dengan lingkaran putih berbingkai Primary 3px.
2. **Grafik Batang Komparatif (Perbandingan Bulanan/Mingguan):**
   - Batang Penjualan Bersih: `#5B3CC4` (Primary).
   - Batang HPP: `#716D7A` (Muted Slate).
   - Tidak menggunakan warna pelangi.
3. **Tooltip Interaktif:**
   - Latar `#25232B` (Charcoal) dengan teks putih `#FFFFFF`, radius 6px, bayangan tebal.
   - Angka selalu ditampilkan dalam format IDR penuh: `Rp 2.450.000` (bukan disingkat 2.4M atau 2.4jt pada tooltip).
4. **Keadaan Tanpa Data (Empty Chart):**
   - Jangan tampilkan grafik garis datar di angka 0.
   - Tampilkan kontainer berbingkai putus-putus (*dashed border*) berlatar `--color-lavender-tint` berisi ilustrasi garis sederhana dan teks: *"Belum ada transaksi pada periode yang dipilih"*.

---

## 3. Spesifikasi Komponen Reusable

### 3.1 Button & Action Controls

| Varian | Latar | Teks/Ikon | Border | State Interaktif |
|---|---|---|---|---|
| **Primary** | `#5B3CC4` | `#FFFFFF` | None | Hover: `#4930A5`, Active: `#3C258C`, Focus: `--focus-ring`, Disabled: `#E7E3EC` & text `#716D7A` |
| **Secondary** | `#FFFFFF` | `#5B3CC4` | `1px solid #5B3CC4` | Hover: `#F6F3FF`, Active: `#EAE4FF`, Focus: `--focus-ring` |
| **Tertiary / Ghost** | Transparent | `#25232B` | None | Hover: `#F0EDF5`, Active: `#E7E3EC`, Focus: `--focus-ring` |
| **Destructive** | `#C0392B` | `#FFFFFF` | None | Hover: `#922B21`, Active: `#78281F`, Focus: Ring Merah `rgba(192, 57, 43, 0.28)` |
| **Icon Button** | Transparent / White | `#716D7A` | `1px solid #E7E3EC` / None | Min 44×44px touch target, hover warna Primary |

**Standar Tombol:**
- Tinggi tombol standar: `40px` (desktop), `44px` (mobile).
- Tombol kompak (tabel): `32px` (desktop).
- State Loading: Teks disembunyikan sementara, menampilkan *spinner* SVG berputar 16px di tengah, tombol menjadi `disabled` untuk mencegah *double submit*.

### 3.2 Form Input & Rupiah Currency Input

- **Label Form:** Wajib memiliki elemen `<label>` yang terhubung dengan `id` input. Teks label: `--text-caption`, warna `--color-charcoal`, font-weight 600. Tanda bintang merah `*` untuk wajib diisi.
- **Teks Pembantu (Helper/Error):** Di bawah input dengan jarak 4px. Teks error berwarna `--color-danger-text` dengan ikon peringatan 14px.
- **Rupiah Currency Input (Khusus VeyraOS):**
  - Prefix statis `Rp` di sisi kiri berlatar `--color-lavender-tint` dengan border kanan `--color-border`.
  - Format angka otomatis saat mengetik: `1000000` otomatis terformat menjadi `1.000.000`.
  - Input hanya menerima karakter digit `[0-9]`.
  - Internal model selalu menyimpan nilai **Integer murni** (`1000000`).

### 3.3 Stat Card (Kartu Ringkasan Metrik)

- **Struktur:**
  - Header: Label Metrik (misal: "Penjualan Bersih") + Ikon Tooltip Bantuan (*Info Icon*) untuk penjelasan rumus.
  - Body: Nilai Rupiah besar (`--text-display`, `font-variant-numeric: tabular-nums`).
  - Footer: Indikator tren atau keterangan konteks (misal: "34 transaksi valid").
- **Gaya:** Latar `#FFFFFF`, border `1px solid #E7E3EC`, radius `12px`, padding `20px` (desktop) / `16px` (mobile).
- **Varian Aksen:** Kartu Laba Kotor dapat memiliki aksen garis vertikal kiri selebar 4px berwarna Brand Primary `#5B3CC4`.

### 3.4 Responsive Table & Mobile Data List

- **Tampilan Desktop ($\ge 768px$):**
  - Header tabel: Latar `--color-lavender-tint`, teks `--color-charcoal`, font-weight 600, padding 12px 16px.
  - Baris data: Border bawah `1px solid #F0EDF5`, hover latar `--color-lavender-tint` lembut.
  - Kolom numerik (Harga, Qty, Total) rata kanan (*right-aligned*).
- **Tampilan Mobile ($< 768px$):**
  - Tabel bertransformasi menjadi **Daftar Kartu Terstruktur** (*Card List*).
  - Setiap kartu memuat: Header (Nomor Nota/Nama Produk + Status Badge), Body (Rincian kuantitas, harga satuan, tanggal), Footer (Total Rupiah tebal + tombol aksi seperti Lihat Detail atau Batal).
  - Tidak ada *horizontal scroll* yang merusak tata letak ponsel.

### 3.5 Modal Dialog & Bottom Sheet

- **Desktop:** Modal berada di tengah layar (*centered*), lebar maksimal 480px–640px, latar `#FFFFFF`, radius 12px, backdrop gelap `rgba(37, 35, 43, 0.5)`.
- **Mobile:** Modal bertransformasi menjadi **Bottom Sheet (Drawer Bawah)** yang meluncur dari dasar layar dengan indikator tarikan jempol (*drag handle*), memudahkan pengisian formulir dengan satu tangan.
- **Dialog Konfirmasi Pembatalan (Destructive Confirmation):**
  - Judul tegas: "Batalkan Transaksi Penjualan Ini?"
  - Badge peringatan: Menjelaskan dampak pembalikan stok dan pengurangan nilai laporan.
  - Textarea wajib: "Alasan Pembatalan" (minimal 5 karakter).
  - Tombol aksi destruktif: "Ya, Batalkan Penjualan" (Warna Merah Danger).

### 3.6 Business Switcher & Profile Dropdown

- Ditempatkan di pojok kiri atas (sebelah logo VeyraOS) atau di bagian atas sidebar.
- Menampilkan: Nama bisnis aktif, lencana status (*badge* UMKM), dan ikon panah bawah.
- Saat diklik: Membuka daftar bisnis yang dapat diakses pengguna (maksimal 5 di MVP), tombol "+ Buat Bisnis Baru", dan tombol "Mode Demo".
- Pilihan bisnis aktif ditandai dengan ikon centang berwarna Primary `#5B3CC4`.

### 3.7 Banner Persisten Mode Demo

- Menempel di bagian paling atas seluruh layar aplikasi (*full-width top banner*).
- Tinggi: `40px` (desktop), `48px` (mobile).
- Warna: Latar `--color-demo-banner-bg` (`#392477`), teks putih tebal.
- Isi:
  - Sisi Kiri: Ikon Lab/Simulasi + Teks: *"MODE DEMO — Menggunakan Data Simulasi (Toko Sembako Sejahtera)"*.
  - Sisi Kanan: Tombol *"Reset Data Demo"* (outline putih) dan tombol *"Daftar Akun Nyata"* (kuning emas `#FFD54F` dengan teks charcoal).

---

## 4. Pola State Komponen (Component States)

Setiap komponen interaktif wajib mengimplementasikan 7 status utama:

```
[Default]  --->  [Hover]  --->  [Focus / Active]
    |               |
    v               v
[Disabled]      [Loading / Skeleton]
    |               |
    v               v
[Error State]   [Empty State]
```

1. **Default:** Sesuai token standar, kontras teks memenuhi syarat $\ge 4.5:1$.
2. **Hover:** Perubahan warna permukaan 8–10% lebih gelap untuk tombol, atau penambahan latar `--color-lavender-tint` untuk baris tabel.
3. **Focus:** Outline 2px dengan jarak offset 2px, atau cincin bayangan `--focus-ring` berwarna Royal Violet.
4. **Disabled:** Latar `--color-border-subtle`, teks `--color-muted-text`, kursor `not-allowed`, `pointer-events: none`.
5. **Loading (Skeleton Loader):**
   - Menghindari spinner fullscreen yang menghalangi konten.
   - Menggunakan balok skeleton berbentuk elemen asli dengan animasi kilau halus (*shimmer*) berbasis warna `#E7E3EC` ke `#F6F3FF`.
6. **Error State:**
   - Border input berubah menjadi `--color-danger` (`#C0392B`).
   - Ikon seru merah muncul di sisi kanan kolom input.
   - Teks pesan kesalahan muncul tepat di bawah input dengan `role="alert"`.
7. **Empty State:**
   - Ilustrasi garis sederhana (bukan gambar dekorasi berat).
   - Judul jelas: *"Belum ada produk"* / *"Belum ada transaksi"*.
   - Deskripsi tindakan: *"Tambahkan produk pertama Anda untuk mulai mencatat stok dan penjualan."*
   - Tombol aksi primer langsung: *"Tambah Produk Sekarang"*.
