# VeyraOS — Stage 5.7 Langkah 4A: Preflight Audit & Arsitektur Mode Demo Terisolasi

**Tanggal Audit:** 15 Oktober 2026, 20:30 WIB  
**Peran Auditor:** Principal Software Architect, Security Auditor, Financial Domain Specialist, QA Lead  
**Status Evaluasi:** **`READY FOR IMPLEMENTATION PLANNING` — PRAKONDISI DAN SPESIFIKASI MODE DEMO TERVERIFIKASI**  
**Ruang Lingkup:** Perancangan Arsitektur Sandboxing Mode Demo (`/demo/*`), Model Data Toko Sembako Sejahtera, Rekalkulasi Finansial Lokal, Integrasi UI Banner Persisten, dan Strategi Isolasi Bebas Server  
**Branch / Workspace:** `master` (`c:\Antigravity Project\VeyraOS`)  
**Single Source of Truth:** `docs/PRD.md` Versi 1.1, `docs/information-architecture.md`, `docs/design-system.md`, dan `docs/api-contracts.md`  

---

## 1. Ringkasan Kontrak Mode Demo yang Ditemukan

Pemeriksaan komprehensif terhadap dokumen spesifikasi resmi proyek menghasilkan kontrak-kontrak baku berikut:

### 1.1 Baseline Dokumen Resmi
1. **PRD Versi 1.1 (`docs/PRD.md`):**  
   Menetapkan proposisi nilai inti VeyraOS untuk UMKM ritel Indonesia:
   - Tagline: *"Run your business. Know your numbers."*
   - Ketepatan matematis moneter bilangan bulat integer IDR (`BIGINT`) tanpa desimal pecahan floating-point bias.
   - Pemisahan keuangan yang disiplin: Penjualan (omzet) $\ne$ HPP persediaan $\ne$ Beban operasional $\ne$ Arus kas toko.
2. **Information Architecture (`docs/information-architecture.md` Seksi 2.3 & Seksi 5):**
   - Mode Demo didefinisikan sebagai sub-sistem rute berawalan `/demo/*` yang beroperasi murni di sisi peramban (*client-side sandboxed*).
   - Gateway `/demo` menginisialisasi state simulasi awal bertajuk *"Toko Sembako Sejahtera"*.
   - Rute demo yang dipetakan:
     - `/demo`: Gateway inisialisasi / redirect ke dashboard.
     - `/demo/dashboard`: Ringkasan 6 kartu KPI simulasi & tren omzet.
     - `/demo/sales` & `/demo/sales/new`: Kasir kilat POS dan riwayat transaksi dengan fitur Void simulasi.
     - `/demo/products`: Katalog 15 produk sembako dan mutasi stok lokal.
     - `/demo/purchases`: Pencatatan pembelian stok dengan rekalkulasi MWAC lokal.
     - `/demo/expenses`: Pencatatan 8 kategori beban operasional lokal.
     - `/demo/reports`: Laporan laba rugi sederhana, arus kas, dan ekspor CSV simulasi.
   - Pembedaan visual mutlak: Menampilkan penanda persisten bertuliskan lencana *"MODE DEMO — SIMULASI"* berwarna kuning emas (`#FFD54F`), tombol *"Reset Data Demo"* instan, dan penegasan bahwa *"Data pada Mode Demo adalah simulasi dan tidak akan disalin ke akun bisnis nyata Anda."*
3. **Design System (`docs/design-system.md` Seksi 2.1 & 3.7):**
   - Token Brand Demo:
     - `--color-demo-banner-bg: #392477` (Deep Purple).
     - `--color-demo-banner-text: #FFFFFF` (Putih).
     - `--color-demo-badge-bg: #FFD54F` (Kuning Emas).
     - `--color-demo-badge-text: #25232B` (Charcoal).
   - Banner persisten setinggi 40px menempel permanen di bagian atas seluruh layar `/demo/*`.
4. **API Contracts (`docs/api-contracts.md` Seksi 8):**
   - Adapter `DemoBusinessService` mengimplementasikan antarmuka identik dengan kontrak produksi namun berjalan di memori/storage lokal peramban dan **sama sekali tidak memanggil jaringan luar** (*zero network requests*).
5. **Architecture Audit (`docs/architecture-audit.md` Temuan `AUD-P2-01`):**
   - Mewajibkan blok proteksi `try/catch` pada pembacaan LocalStorage agar sistem otomatis *fallback* ke in-memory seed data jika LocalStorage diblokir (misal: private browsing/incognito) atau mengalami kuota penuh/korupsi JSON.

---

## 2. Inventarisasi Route & Komponen yang Relevan

### 2.1 Kondisi Rute Eksisting
- **Middleware Sesi ([`src/middleware.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/middleware.ts#L98)):**
  - Matcher regex middleware telah secara eksplisit mengecualikan segmen `demo`:
    ```typescript
    "/((?!_next/static|_next/image|favicon.ico|demo|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
    ```
  - **Dampak Positif:** Rute apa pun di bawah `/demo` dan `/demo/*` **secara otomatis dapat diakses oleh pengguna anonim tanpa login** dan tidak akan dicegat atau dialihkan ke `/login`.
- **Halaman Autentikasi yang Memiliki Tautan ke `/demo`:**
  - [`src/app/login/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/login/page.tsx#L159): `<Link href="/demo">Coba Dulu di Mode Demo (Tanpa Akun)</Link>`.
  - [`src/app/register/page.tsx`](file:///c:/Antigravity%20Project/VeyraOS/src/app/register/page.tsx#L237): `<Link href="/demo">Coba Dulu di Mode Demo (Tanpa Akun)</Link>`.
  - Saat ini tautan tersebut berstatus **DEAD LINK (404 Not Found)** karena direktori `src/app/demo` belum ada di disk. Begitu `/demo` dibuat, kedua tautan ini langsung aktif secara otomatis tanpa perlu mengubah halaman login/register.
- **Komponen UI Primitives yang Siap Digunakan Kembali:**
  - `src/components/ui/badge.tsx`: Varian `variant="demo"` sudah tersedia dengan warna `#FFD54F`.
  - `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `alert.tsx`, `skeleton.tsx`: Siap digunakan untuk menyusun antarmuka demo yang konsisten dengan aplikasi utama.

---

## 3. Rekomendasi Arsitektur & Strategi Isolasi Total

Untuk menjamin data produksi 100% aman dan calon pengguna mendapatkan pengalaman realistis:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER RUNTIME SANDBOX                         │
│                                                                        │
│  Rute /demo/* (Akses Anonim Tanpa Login)                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Persistent Demo Banner (Reset Demo | Daftar Akun Nyata)          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ Demo Sidebar Navigation │  │ Demo Page Views (POS, Stok, Lap.) │  │
│  └────────────┬────────────┘  └─────────────────┬─────────────────┘  │
│               │                                 │                    │
│               ▼                                 ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 DemoStoreService (Adapter Lokal)                 │  │
│  │   - CRUD Produk & Stok         - POS Cashier & Diskon            │  │
│  │   - Kalkulasi MWAC HPP         - Rekonsiliasi Finansial IDR      │  │
│  │   - Buku Beban Kas             - Ekspor CSV Simulasi             │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│             ┌───────────────────────┴───────────────────────┐          │
│             ▼                                               ▼          │
│  ┌─────────────────────────────┐             ┌──────────────────────┐  │
│  │ LocalStorage Storage Engine │ (Fallback)  │ In-Memory Fallback   │  │
│  │ Key: 'veyra_demo_store_v1'  │ ──────────> │ (Private/Incognito)  │  │
│  └─────────────────────────────┘             └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
          │                                            │
          X  TERISOLASI TOTAL: ZERO NETWORK REQUESTS   X
          ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                SERVER ACTIONS & SUPABASE PRODUCTION DB                 │
│                      (TIDAK PERNAH DISENTUH)                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Prinsip Desain Keamanan (*Defense-in-Depth*)
1. **Larangan Impor Server Actions Produksi:**  
   Seluruh modul dan halaman di bawah `src/app/demo/*` **dilarang keras mengimpor** fungsi dari `@/app/actions/*` atau `@/lib/supabase/*`. Komponen hanya boleh berinteraksi dengan adapter lokal `DemoStoreService`.
2. **Penyimpanan LocalStorage dengan Namespace Khusus:**  
   Menggunakan kunci penyimpanan tunggal: `veyra_demo_store_v1`. Tidak ada tumpang tindih dengan cookie sesi atau local state lain.
3. **Mekanisme Ketahanan & Fail-Safe (`AUD-P2-01`):**  
   Setiap operasi baca/tulis ke `localStorage` dibungkus dalam blok `try/catch`. Jika peramban memblokir penyimpanan (misal: mode Incognito di Safari/Brave) atau kuota penuh, store otomatis beralih ke variabel memori (*in-memory*) tanpa melempar runtime crash.
4. **Mekanisme Reset Data Instan:**  
   Metode `demoStoreService.resetState()` menimpa storage dengan salinan bersih (*deep clone*) dari dataset seed default *"Toko Sembako Sejahtera"* dan memancarkan event ke UI dalam waktu $< 50$ ms.

---

## 4. Cakupan Halaman, Data Simulasi & Alur Finansial

### 4.1 Profil Bisnis Simulasi & Dataset Seed
- **Nama Bisnis:** Toko Sembako Sejahtera
- **Bidang Usaha:** Kelontong / Sembako
- **Alamat:** Jl. Surya Kencana No. 45, Bogor Tengah, Kota Bogor
- **Mata Uang:** `IDR (Rupiah)` — Integer tanpa sen
- **Zona Waktu:** `Asia/Jakarta (WIB)`
- **15 Produk Riil Toko Sembako:**
  1. *Beras Ramos Super 5kg* (Stok: 25, Min: 5, Beli/HPP: Rp 68.000, Jual: Rp 76.000)
  2. *Minyak Goreng Sawit 2L* (Stok: 18, Min: 6, Beli/HPP: Rp 32.000, Jual: Rp 36.500)
  3. *Gula Pasir Kristal Putih 1kg* (Stok: 30, Min: 10, Beli/HPP: Rp 15.500, Jual: Rp 18.000)
  4. *Telur Ayam Negeri 1kg* (Stok: 12, Min: 5, Beli/HPP: Rp 26.000, Jual: Rp 29.500)
  5. *Tepung Terigu Segitiga Biru 1kg* (Stok: 20, Min: 5, Beli/HPP: Rp 11.000, Jual: Rp 13.000)
  6. *Mie Instan Goreng Original (Karton/40)* (Stok: 8, Min: 3, Beli/HPP: Rp 112.000, Jual: Rp 124.000)
  7. *Kopi Bubuk Hitam Mantap 150g* (Stok: 22, Min: 5, Beli/HPP: Rp 9.500, Jual: Rp 12.000)
  8. *Teh Celup Melati Kotak (Isi 25)* (Stok: 15, Min: 4, Beli/HPP: Rp 6.000, Jual: Rp 8.000)
  9. *Susu Kental Manis Putih Kaleng 370g* (Stok: 16, Min: 5, Beli/HPP: Rp 11.500, Jual: Rp 13.500)
  10. *Garam Dapur Beryodium 250g* (Stok: 40, Min: 10, Beli/HPP: Rp 2.500, Jual: Rp 4.000)
  11. *Sabun Cuci Piring Jeruk Nipis 750ml* (Stok: 14, Min: 4, Beli/HPP: Rp 13.500, Jual: Rp 16.500)
  12. *Deterjen Bubuk Konsentrat 800g* (Stok: 10, Min: 4, Beli/HPP: Rp 18.500, Jual: Rp 22.000)
  13. *Kecap Manis Botol 275ml* (Stok: 12, Min: 4, Beli/HPP: Rp 10.000, Jual: Rp 12.500)
  14. *Saus Sambal Botol 335ml* (Stok: 11, Min: 4, Beli/HPP: Rp 9.000, Jual: Rp 11.500)
  15. *Air Mineral Galon 19L (Isi Ulang Resmi)* (Stok: 6, Min: 3, Beli/HPP: Rp 18.000, Jual: Rp 22.000)
- **Data Historis Transaksi:**
  - 5 Riwayat Pembelian Restock (menetapkan HPP awal dengan formula MWAC).
  - 25 Transaksi Penjualan Lunas (`PAID`) dengan variasi item tunggal, multi-item, diskon, dan metode Tunai/Transfer.
  - 2 Transaksi Penjualan Dibatalkan (`VOIDED`) dengan catatan alasan void.
  - 8 Catatan Beban Kas Operasional (Listrik toko, Sewa kios harian, Kantong kresek, Gaji kasir, Air galon karyawan, Perbaikan lampu etalase, dsb.).

### 4.2 Alur Keuangan Matematis Presisi (Anti-Double-Count)
Semua modul simulasi mematuhi aturan pembukuan baku PRD 1.1:
$$\text{Penjualan Bersih (Omzet)} = \sum \text{Subtotal Penjualan Lunas} - \text{Diskon}$$
$$\text{Harga Pokok Penjualan (HPP)} = \sum (\text{Qty Terjual} \times \text{Snapshot HPP Produk Saat Transaksi})$$
$$\text{Laba Kotor} = \text{Penjualan Bersih} - \text{HPP}$$
$$\text{Beban Operasional} = \sum \text{Pengeluaran Kas Toko}$$
$$\text{Laba Bersih Operasional} = \text{Laba Kotor} - \text{Beban Operasional}$$
$$\text{Arus Kas Bersih} = \text{Total Kas Masuk} - (\text{Kas Keluar Pembelian} + \text{Kas Keluar Beban})$$

*Pemisahan Beban vs Stok:* Pembelian restock persediaan barang dagang hanya menambah nilai modal persediaan toko dan tidak pernah dihitung sebagai beban operasional agar HPP tidak terhitung ganda.

---

## 5. Rencana Pengujian yang Terukur

Untuk memverifikasi Mode Demo secara objektif, dirancang suite pengujian terisolasi:

### 5.1 Unit Testing (`src/services/demo/demo-store.test.ts`) — $\ge 20$ Skenario Uji:
1. **Inisialisasi & Reset:**
   - Memastikan dataset default terisi 15 produk, transaksi penjualan, restock, dan beban.
   - Menguji bahwa memanggil `resetState()` mengembalikan data yang telah dimutasi ke kondisi awal dalam $< 50$ ms.
2. **Kalkulasi Transaksi Kasir POS:**
   - Menguji pengurangan stok produk saat penjualan baru disimpan.
   - Menguji validasi penolakan jika stok tidak mencukupi.
   - Menguji perhitungan subtotal, diskon item/transaksi, dan total bayar integer.
3. **Alur Pembatalan Void:**
   - Menguji perubahan status penjualan dari `PAID` menjadi `VOIDED`.
   - Menguji pembalikan (*reversal*) stok fisik kembali ke persediaan toko.
4. **Restock Pembelian & Formula MWAC:**
   - Menguji penambahan kuantitas stok saat restock dicatat.
   - Menguji rekalkulasi harga pokok rata-rata bergerak (MWAC) secara akurat tanpa desimal mengambang.
5. **Buku Pengeluaran Operasional:**
   - Menguji penambahan beban kas pada kategori baku.
   - Memverifikasi beban kas tidak mengubah stok produk atau HPP.
6. **Integritas Metrik Dashboard & Laporan:**
   - Memverifikasi keselarasan 6 KPI dashboard dengan dataset aktif.
   - Memverifikasi ekspor CSV RFC 4180 dengan UTF-8 BOM dan sanitasi formula injection.
7. **Resilience & Fallback LocalStorage (`AUD-P2-01`):**
   - Menguji penanganan error ketika `localStorage.setItem` melempar `QuotaExceededError` atau `SecurityError`.
   - Memastikan fallback ke penyimpanan in-memory berjalan mulus tanpa runtime crash.

### 5.2 Component Testing (`src/app/demo/demo.test.tsx`) — $\ge 15$ Skenario Uji:
1. Memverifikasi seluruh rute demo merender `DemoBanner` persisten dengan tombol reset dan tombol daftar akun nyata.
2. Memverifikasi sidebar demo mengarahkan navigasi ke rute `/demo/*` (bukan rute privat).
3. Memverifikasi tidak ada pemanggilan fungsi Server Actions produksi (verifikasi spy/mock).
4. Memverifikasi interaksi klik *"Reset Data Demo"* memicu pembaruan antarmuka secara instan.

---

## 6. Risiko, Dependensi, dan Keputusan Produk

### 6.1 Risiko Teknis & Mitigasi
| Risiko | Tingkat | Dampak Potensial | Mitigasi Arsitektur |
|---|:---:|---|---|
| **Pencemaran Data Produksi** | Kritis | Komponen demo secara tidak sengaja memanggil Server Action produksi yang memutasi database nyata. | Melarang impor dari `src/app/actions/*` di seluruh segmen `src/app/demo/*`. Seluruh aksi dialihkan ke `DemoStoreService`. |
| **Penyimpanan Diblokir (Incognito)** | Tinggi | Pengguna di browser Safari/Brave private mode mengalami exception saat membuka demo. | `DemoStoreService` dilengkapi deteksi otomatis `try/catch` dan fallback transparan ke memory variable. |
| **Beban Lingkup Berlebih (*Scope Overload*)** | Sedang | Membangun seluruh 7 sub-halaman demo sekaligus dalam satu giliran berisiko terputus kuota model. | Membagi eksekusi implementasi menjadi sub-langkah modular yang terukur. |

### 6.2 Keputusan Produk yang Perlu Otorisasi Pengguna
Sebelum implementasi kode dimulai, disarankan pengguna memilih salah satu strategi eksekusi berikut:

- **Rekomendasi Strategi Bertahap Modular (Teraman & Terkendali):**
  - **Langkah 4B:** Fondasi Store Sandboxing (`demo-store.service.ts`), Seed Data ("Toko Sembako Sejahtera"), Unit Tests Store, `DemoBanner`, `DemoSidebar`, Layout `/demo/layout.tsx`, dan Gateway Halaman `/demo/dashboard`.
  - **Langkah 4C:** Modul Operasional Kasir & Produk Demo (`/demo/sales`, `/demo/sales/new`, `/demo/products`, `/demo/purchases`).
  - **Langkah 4D:** Modul Pengeluaran & Laporan Demo (`/demo/expenses`, `/demo/reports`), Uji Integrasi Menyeluruh, dan Penutupan Resmi Stage 5.7.

---

## 7. Daftar Berkas yang Perlu Dibuat pada Tahap Implementasi

Berikut inventarisasi berkas baru yang dirancang untuk tahap implementasi:

1. **Service Layer & Store Terisolasi:**
   - `src/services/demo/demo-types.ts` — Kontrak tipe data simulasi.
   - `src/services/demo/demo-seed-data.ts` — Dataset awal *"Toko Sembako Sejahtera"*.
   - `src/services/demo/demo-store.service.ts` — Engine adapter storage (LocalStorage + In-Memory Fallback).
   - `src/services/demo/demo-store.test.ts` — Suite pengujian unit logika store demo.
2. **Komponen UI Khusus Demo:**
   - `src/components/demo/demo-banner.tsx` — Banner persisten penanda mode simulasi.
   - `src/components/demo/demo-sidebar.tsx` — Navigasi sidebar terisolasi khusus prefix `/demo/*`.
   - `src/components/demo/demo-layout.tsx` — Shell antarmuka demo.
3. **Rute & Halaman Antarmuka Demo (`src/app/demo/`):**
   - `src/app/demo/layout.tsx` — Root layout segmen demo.
   - `src/app/demo/page.tsx` — Gateway pengarah langsung ke `/demo/dashboard`.
   - `src/app/demo/dashboard/page.tsx` — Dashboard metrik simulasi.
   - `src/app/demo/sales/page.tsx` — Riwayat penjualan & Void simulasi.
   - `src/app/demo/sales/new/page.tsx` — Kasir POS cepat simulasi.
   - `src/app/demo/products/page.tsx` — Katalog produk & mutasi stok simulasi.
   - `src/app/demo/purchases/page.tsx` — Restock pembelian & kalkulasi MWAC simulasi.
   - `src/app/demo/expenses/page.tsx` — Pencatatan beban operasional simulasi.
   - `src/app/demo/reports/page.tsx` — Laporan finansial & ekspor CSV simulasi.
4. **Pengujian Komponen UI Demo:**
   - `src/app/demo/demo.test.tsx` — Suite pengujian unit komponen antarmuka demo.

---

## 8. Status Git Aktual

Pemeriksaan status Git aktual sebelum dan sesudah audit:

```text
A  docs/stage-5.6-step-2-implementation-report.md
?? .agents/
?? .env.example
?? .gitignore
?? AGENTS.md
?? PRD.md
?? README.md
?? docs/
?? eslint.config.mjs
?? next.config.ts
?? package-lock.json
?? package.json
?? skills-lock.json
?? src/
?? supabase/
?? tsconfig.json
?? vitest.config.mts
```

- **Staging Index:** `A docs/stage-5.6-step-2-implementation-report.md` dipertahankan utuh tanpa perubahan.
- **Kepatuhan:** Tidak ada kode sumber yang dimodifikasi, tidak ada dependensi yang diubah, dan tidak ada commit yang dibuat selama audit pra-implementasi ini.

---

## 9. Rekomendasi Urutan Langkah Selanjutnya

$$\mathbf{REKOMENDASI\ TUNGGAL:}$$
$$\text{Otorisasi Pelaksanaan Stage 5.7 Langkah 4B: Fondasi Store Sandboxing, Seed Data, Banner Persisten \& Dashboard Demo}$$

Dengan menyelesaikan Langkah 4B terlebih dahulu:
1. Rute `/demo` dan `/demo/dashboard` langsung aktif, sehingga **tautan `/demo` pada `/login` dan `/register` tidak lagi 404**.
2. Calon pengguna dapat langsung melihat dan mencoba dashboard simulasi *Toko Sembako Sejahtera* lengkap dengan banner persisten dan tombol reset data instan.
3. Fondasi `DemoStoreService` teruji 100% oleh unit tests sebelum modul transaksi kasir dan produk disambungkan pada Langkah 4C.

---
*Laporan audit pra-implementasi Langkah 4A selesai disusun secara objektif dan terverifikasi terhadap basis kode aktual. Berhenti di sini untuk peninjauan dan persetujuan pengguna sebelum memulai pengerjaan kode Langkah 4B.*
