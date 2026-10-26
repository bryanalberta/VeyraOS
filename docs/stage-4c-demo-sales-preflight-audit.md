# VeyraOS — Dokumen Audit Pra-Implementasi (Pre-Flight Audit) Stage 4C
## Mode Demo: Modul Penjualan (POS), Riwayat Transaksi, dan Pembatalan Penjualan (Void)

**Tanggal Audit:** 15 Oktober 2026, 22:15 WIB  
**Tahap Proyek:** Stage 4C — Pre-Implementation Audit  
**Status Otorisasi:** **BELUM DIIZINKAN MENGIMPLEMENTASIKAN KODE FITUR PENJUALAN (AUDIT & PERENCANAAN SAJA)**  
**Penyusun:** Antigravity AI (Pair Programming Assistant)  
**Tujuan Dokumen:** Menyusun spesifikasi teknis, arsitektur data, batas atomisitas penyimpanan lokal, formula finansial integer IDR, spesifikasi antarmuka pengguna (UI/UX), dan matriks pengujian lengkap sebelum implementasi fitur penjualan Mode Demo dimulai.

---

## 1. Ringkasan Eksekutif

Modul Penjualan pada Mode Demo VeyraOS bertujuan memberikan pengalaman kasir (Point of Sale / POS), pelacakan riwayat transaksi, serta pembatalan penjualan (*void*) secara interaktif dan realistis bagi calon pengguna UMKM tanpa memerlukan koneksi ke database Supabase atau server backend produksi.

Audit pra-implementasi ini mengevaluasi kesiapan arsitektur store sandboxed (`veyra_demo_store_v1`), memeriksa kontrak finansial baku pada `docs/PRD.md` Versi 1.1, mengidentifikasi celah implementasi (*gap analysis*), dan menyusun rancangan komponen yang aman dari *infinite loop*, tabrakan nomor faktur, kebocoran data produksi, atau inkonsistensi stok persediaan.

### Kesimpulan Audit: **`READY WITH CONDITIONS`**
Arsitektur fondasi Mode Demo (diterapkan pada Stage 5.7 Langkah 4B dan diperbaiki pada runtime fix report) telah stabil dan siap menampung modul penjualan. Namun, implementasi kode fitur **wajib menunggu otorisasi eksplisit pengguna** dan memenuhi ketentuan batas atomisitas lokal, presisi integer IDR, serta isolasi penuh dari server actions dan klien Supabase.

---

## 2. Dokumen yang Benar-Benar Diperiksa

Dalam penyusunan audit ini, seluruh dokumen berikut telah dibaca dan diperiksa secara langsung pada sistem berkas lokal repository `C:\Antigravity Project\VeyraOS`:

| No | Dokumen Sumber | Status Pemeriksaan | Catatan & Relevansi terhadap Stage 4C |
|:---:|---|:---:|---|
| 1 | `AGENTS.md` | **Diperiksa** | Memuat aturan Next.js 16.4.0 breaking changes; tidak boleh mengubah uncommitted diff auto-generated. |
| 2 | `docs/PRD.md` (v1.1) | **Diperiksa** | Sumber kebenaran produk: Bagian 4.5 (Penjualan), 4.6 (Beban), 4.7 (Pembelian/MWAC), 4.8 (Laporan Finansial), 4.9 (Mode Demo), 5 (Integritas Moneter Integer BigInt/IDR), dan 6 (Keamanan). |
| 3 | `docs/design-system.md` | **Diperiksa** | Token Royal Violet (`#5B3CC4`), Deep Purple (`#392477`), Charcoal (`#25232B`), Golden Pip (`#FFD54F`), tipografi Outfit & Inter, radius, bayangan, dan aturan anti-AI-slop. |
| 4 | `docs/information-architecture.md` | **Diperiksa** | Struktur hierarki navigasi terisolasi: rute `/demo/sales` dan `/demo/sales/new` sebagai cabang mandiri `/demo/*`. |
| 5 | `docs/ui-ux-specification.md` | **Diperiksa** | Pola antarmuka kasir POS 2 kolom (Katalog Produk & Keranjang), empty states, dialog struk, dan modal pembatalan. |
| 6 | `docs/design-acceptance-criteria.md` | **Diperiksa** | Kriteria aksesibilitas WCAG 2.2 AA, touch target minimal 44x44px, keyboard navigation, kontras teks, dan reduced motion. |
| 7 | `docs/database-schema.md` | **Diperiksa** | Referensi semantik relasi `sales`, `sale_items`, `products`, dan `stock_movements`. |
| 8 | `docs/security-and-rls.md` | **Diperiksa** | Prinsip isolasi tenant, zero trust client data, dan idempotency key. |
| 9 | `docs/api-contracts.md` | **Diperiksa** | Kontrak request/response produksi (`RecordSaleInput`, `SaleReceiptResponse`, `VoidSaleInput`, `VoidSaleResponse`) sebagai acuan semantik. |
| 10 | `docs/testing-strategy.md` | **Diperiksa** | Pendekatan unit test store, component mock test, dan pemisahan pengujian browser. |
| 11 | `docs/stage-5.7-step-4b-implementation-report.md` | **Diperiksa** | Laporan fondasi store sandboxed `veyra_demo_store_v1`, seed data *Toko Sembako Sejahtera*, dan dashboard. |
| 12 | `docs/stage-5.7-demo-runtime-fix-report.md` | **Diperiksa** | Analisis akar masalah caching snapshot `this.snapshot` untuk mencegah infinite loop dan tearing pada `useSyncExternalStore`. |
| 13 | `docs/stage-5.7-visual-fix-audit.md` | **Diperiksa** | Adopsi varian tombol `outline-dark`, komponen logo `BrandSymbol` & `BrandLogo`. |
| 14 | Implementasi Kode Aktual Demo Store | **Diperiksa** | `src/services/demo/demo-types.ts`, `src/services/demo/demo-store.service.ts`, `src/services/demo/demo-seed-data.ts`, `src/components/demo/demo-sidebar.tsx`, dan `src/app/demo/dashboard/page.tsx`. |
| 15 | Implementasi Referensi Produksi | **Diperiksa** | `src/app/sales/page.tsx`, `src/app/sales/new/page.tsx`, `src/services/transactions/transaction.service.ts`, `src/lib/invoice.ts`, dan `src/lib/validations/sale.ts`. |

*Catatan Gap Dokumentasi:* Tidak ditemukan file dokumentasi yang hilang atau tidak dapat diakses; seluruh dokumen yang diwajibkan tersedia lengkap di direktori `docs/`.

---

## 3. Kondisi Arsitektur Demo Store Saat Ini

Berdasarkan audit terhadap `src/services/demo/demo-store.service.ts` dan berkas pendukungnya, arsitektur Demo Store saat ini memiliki karakteristik berikut:

### 3.1 Struktur State dan Penyimpanan
- **Namespace Kunci:** `DEMO_STORAGE_KEY = "veyra_demo_store_v1"` pada `window.localStorage`.
- **Versi Skema:** `DEMO_STORE_VERSION = 1`.
- **Struktur Objek State (`DemoStoreState`):**
  ```ts
  interface DemoStoreState {
    version: number;
    lastResetAt: string;
    business: DemoBusinessProfile;
    products: DemoProduct[];
    sales: DemoSale[];
    purchases: DemoPurchase[];
    expenses: DemoExpense[];
  }
  ```
- **Karakteristik Seed Data Awal (*"Toko Sembako Sejahtera"*):**
  - 15 produk sembako aktif dengan stok awal dan ambang peringatan (*min stock alert*).
  - 27 transaksi penjualan demo historis: 25 berstatus `COMPLETED` dan 2 berstatus `VOIDED`.
  - 5 pembelian stok restock persediaan.
  - 8 pengeluaran beban operasional kas toko.

### 3.2 Manajemen Snapshot dan Subscription
- Menyediakan metode terikat (*bound methods*):
  - `getState = (): DemoStoreState`: Mengembalikan referensi stabil `this.snapshot` (di-cache di memori), memenuhi kontrak referensial `useSyncExternalStore` React untuk mencegah infinite loop.
  - `getServerSnapshot = (): DemoStoreState`: Mengembalikan snapshot memori aktif secara aman untuk SSR tanpa menyentuh `window` atau `localStorage`.
  - `subscribe = (listener: () => void): () => void`: Mendaftarkan pemantau perubahan data.
- Mutasi state dikontrol melalui:
  - `saveState(updater)`: Menerima updater function/objek baru, melakukan *deep clone* hasil sanitasi, memperbarui `this.snapshot`, menyinkronkan ke storage lokal, dan memanggil `this.notifyListeners()`.
  - `resetState()`: Mengembalikan state ke salinan segar `getFreshDemoSeed()` dan memberi tahu subscriber.

### 3.3 Ketahanan (*Resilience*) dan Fallback
- **Mode Samaran / Storage Terblokir:** Fungsi `isStorageAvailable()` melakukan uji tulis-hapus pada kunci `__veyra_storage_test__`. Jika melempar `SecurityError`, sistem beralih ke variabel memori secara transparan.
- **Kuota Penuh (`QuotaExceededError`):** Ditangkap pada `saveRawToStorage` via `try/catch`. State memori tetap aktif sehingga aplikasi tidak crash.
- **Data Rusak / Versi Usang:** `ensureInitialized()` memvalidasi struktur state melalui `isValidState()`. Jika JSON rusak atau versi tidak sesuai, store otomatis memulihkan diri ke seed awal tanpa memicu error fatal.

### 3.4 Isolasi dari Produksi
- Bebas dari pemanggilan Supabase server client, Supabase browser client, RPC PostgreSQL, maupun Server Actions produksi.
- Seluruh mutasi berjalan murni di thread JavaScript peramban lokal.

---

## 4. Gap Implementasi yang Ditemukan (Analisis Celah)

Audit menemukan beberapa gap penting antara infrastruktur Demo Store saat ini dengan kebutuhan fungsional modul penjualan Stage 4C:

| No | Komponen / Area | Kondisi Aktual Saat Ini | Kebutuhan Modul Penjualan Stage 4C | Gap yang Teridentifikasi |
|:---:|---|---|---|---|
| 1 | `DemoStoreService` (Metode Mutasi) | Hanya memiliki `saveState()` umum dan `resetState()`. | Diperlukan metode khusus: `recordSale()`, `voidSale()`, dan `getSaleById()`. | **GAP TINGGI:** Belum ada logika transaksi atomik terenkapsulasi untuk validasi stok, pengurangan stok, pembuatan faktur, dan pembatalan dengan alasan. |
| 2 | Generator Nomor Faktur | `src/lib/invoice.ts` mengimpor `node:crypto` yang ditujukan untuk runtime server Node.js. | Diperlukan penomoran faktur client-side unik berformat `INV-YYYYMMDD-XXXX` tanpa dependensi `node:crypto`. | **GAP SEDANG:** Penggunaan `node:crypto` di browser client Next.js dapat menyebabkan kompilasi gagal atau bundle error. Perlu generator lokal browser-safe. |
| 3 | Model Diskon Transaksi vs Item | `DemoSale` memiliki `discount: number`, namun `DemoSaleItem` tidak memiliki field `itemDiscount` (hanya `unitPrice`, `costPrice`, `subtotal`). | PRD v1.1 dan UI POS produksi mendukung diskon per item dan diskon transaksi. | **GAP DESAIN:** Perlu menyelaraskan apakah `DemoSaleItem` akan ditambahkan `itemDiscount?: number` opsional (dengan fallback 0 agar backward-compatible dengan seed). |
| 4 | Navigasi `DemoSidebar` | Navigasi "Penjualan" bertanda `isAvailable: false`, `stageNote: "Langkah 4C"`, dan tanpa `href`. | Navigasi harus mengarah aktif ke `/demo/sales`. | **GAP NAVIGASI:** Rute belum terbuka di sidebar. |
| 5 | Halaman POS & Riwayat | Belum ada berkas pada `src/app/demo/sales/` atau sub-rutenya. | Diperlukan halaman `/demo/sales` (Riwayat & Void) dan `/demo/sales/new` (Kasir POS). | **GAP HALAMAN:** Seluruh antarmuka penjualan demo belum dibuat. |
| 6 | Generator ID Entitas | ID seed menggunakan format sekuensial statis (`sale-001`, `si-001`). | Transaksi baru membutuhkan ID unik yang tidak bentrok dengan 27 transaksi seed. | **GAP IDENTIFIER:** Perlu fungsi utilitas pembuatan ID unik lokal (`sale-${Date.now()}-${random}`). |

---

## 5. Kontrak Data yang Diusulkan

Untuk menjaga integritas dan kompatibilitas 100% dengan seed data yang sudah ada, berikut adalah kontrak data yang diusulkan untuk `src/services/demo/demo-types.ts`:

### 5.1 Item Penjualan (`DemoSaleItem`)
```ts
export interface DemoSaleItem {
  id: string;              // Format: "si-" + timestamp + random
  productId: string;       // Referensi ke DemoProduct.id
  productName: string;     // Snapshot nama produk
  quantity: number;        // Bilangan bulat positif >= 1
  unitPrice: number;       // Snapshot harga jual integer IDR saat transaksi
  costPrice: number;       // Snapshot HPP integer IDR saat transaksi
  subtotal: number;        // (quantity * unitPrice) - (itemDiscount || 0)
  itemDiscount?: number;   // Opsional: diskon per item (integer IDR >= 0, default 0)
}
```

### 5.2 Transaksi Penjualan (`DemoSale`)
```ts
export type DemoPaymentMethod = "CASH" | "BANK_TRANSFER";
export type DemoSaleStatus = "COMPLETED" | "VOIDED";

export interface DemoSale {
  id: string;                     // Format: "sale-" + timestamp + random
  invoiceNumber: string;          // Format: "INV-YYYYMMDD-XXXX" (unik)
  transactionDate: string;        // ISO 8601 string (Asia/Jakarta)
  items: DemoSaleItem[];          // Minimal 1 item
  subtotal: number;               // Total harga kotor sebelum diskon transaksi
  discount: number;               // Diskon level transaksi (integer IDR >= 0)
  totalAmount: number;            // Penjualan bersih (subtotal - discount)
  totalCogs: number;              // Total HPP = sum(item.quantity * item.costPrice)
  grossProfit: number;            // Laba kotor = totalAmount - totalCogs
  paymentMethod: DemoPaymentMethod;
  status: DemoSaleStatus;         // "COMPLETED" | "VOIDED"
  notes?: string;                 // Catatan transaksi opsional
  voidReason?: string;            // Alasan pembatalan (wajib jika VOIDED)
  voidedAt?: string;              // ISO 8601 timestamp saat dibatalkan
}
```

### 5.3 Payload Input Pembuatan Penjualan (`CreateDemoSaleInput`)
```ts
export interface CreateDemoSaleItemInput {
  productId: string;
  quantity: number;               // Bilangan bulat positif >= 1
  itemDiscount?: number;          // Diskon per item (default 0)
}

export interface CreateDemoSaleInput {
  items: CreateDemoSaleItemInput[];
  paymentMethod: DemoPaymentMethod;
  transactionDiscount?: number;   // Diskon transaksi (default 0)
  notes?: string;
  cashReceived?: number;          // Nominal uang tunai yang diserahkan kasir
}
```

### 5.4 Payload Input Pembatalan Penjualan (`VoidDemoSaleInput`)
```ts
export interface VoidDemoSaleInput {
  saleId: string;
  voidReason: string;             // Minimal 5 karakter non-whitespace
}
```

### 5.5 State Keranjang Belanja Kasir POS (`DemoCartItem`)
```ts
export interface DemoCartItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  sellingPrice: number;
  stockQuantity: number;          // Stok fisik riil tersedia saat itu
  quantity: number;               // Kuantitas yang dimasukkan keranjang (1 <= qty <= stockQuantity)
  itemDiscount: number;           // Diskon baris barang (default 0)
}
```

---

## 6. Alur Transaksi dan Pembatalan (Batas Konsistensi & Atomisitas)

### 6.1 Alur Penyelesaian Transaksi Penjualan (POS Checkout)
Transaksi penjualan kasir dieksekusi secara atomik di dalam `DemoStoreService.recordSale()`:

```
[Pengguna di POS Kasir]
       │
       ▼
1. Validasi Pra-Pengiriman Frontend
   - Keranjang minimal berisi 1 item.
   - Kuantitas setiap item adalah integer >= 1.
   - Kuantitas item <= stok produk yang terlihat di keranjang.
   - Diskon tidak melebihi batas subtotal kotor.
   - Jika pembayaran TUNAI: uang diterima >= total belanja.
       │
       ▼
2. Eksekusi Atomik di DemoStoreService.saveState()
   ┌────────────────────────────────────────────────────────────────────────┐
   │ a. Baca state aktif terbaru (getState()).                             │
   │ b. Validasi Ulang Stok Server-Side Sandbox:                           │
   │    - Untuk setiap item keranjang, temukan produk di state.products.    │
   │    - Periksa: apakah produk aktif?                                    │
   │    - Periksa: apakah product.stockQuantity >= item.quantity?           │
   │    - JIKA GAGAL: Lempar error deskriptif, batalkan seluruh mutasi.    │
   │ c. Ambil Snapshot Harga & HPP Terkini:                                 │
   │    - unitPrice = product.price                                         │
   │    - costPrice = product.cogs (HPP berjalan saat ini)                  │
   │ d. Hitung Finansial Transaksi:                                        │
   │    - itemSubtotal = (quantity * unitPrice) - itemDiscount              │
   │    - subtotal = sum(itemSubtotal)                                      │
   │    - totalAmount = subtotal - transactionDiscount                      │
   │    - totalCogs = sum(quantity * costPrice)                             │
   │    - grossProfit = totalAmount - totalCogs                             │
   │ e. Bangkitkan Nomor Faktur Unik:                                       │
   │    - Format: "INV-YYYYMMDD-XXXX" (memeriksa agar tidak duplikat di     │
   │      state.sales).                                                     │
   │ f. Kurangi Stok Produk:                                               │
   │    - product.stockQuantity = product.stockQuantity - item.quantity     │
   │ g. Tambahkan Entri Penjualan Baru ke state.sales.                     │
   │ h. Simpan Objek State Baru secara Utuh ke localStorage / In-Memory.    │
   │ i. Publikasikan Snapshot Baru & Panggil notifyListeners().             │
   └────────────────────────────────────────────────────────────────────────┘
       │
       ▼
3. Respon ke UI
   - State keranjang dikosongkan.
   - Dialog Struk Transaksi Sukses dimunculkan (menampilkan rincian, uang bayar, kembalian).
   - Indikator stok pada katalog produk dan dashboard otomatis terbarui reaktif.
```

### 6.2 Alur Pembatalan Transaksi Penjualan (Void Sale)
Pembatalan transaksi dilakukan secara atomik di dalam `DemoStoreService.voidSale()`:

```
[Pengguna di Riwayat Penjualan]
       │ Klik "Batalkan Transaksi (Void)"
       ▼
1. Modal Alasan Pembatalan
   - Pengguna wajib mengisi alasan pembatalan (minimal 5 karakter, tidak boleh hanya spasi).
   - Konfirmasi eksplisit: stok akan dipulihkan dan omzet dibatalkan.
       │ Klik "Konfirmasi Pembatalan"
       ▼
2. Eksekusi Atomik di DemoStoreService.saveState()
   ┌────────────────────────────────────────────────────────────────────────┐
   │ a. Cari transaksi target berdasarkan saleId di state.sales.            │
   │    - JIKA TIDAK DITEMUKAN: Lempar error "Transaksi tidak ditemukan".   │
   │ b. Periksa Status Transaksi:                                           │
   │    - JIKA status === "VOIDED": Lempar error "Transaksi sudah dibatalkan│
   │      sebelumnya" (Idempotensi terjamin).                               │
   │ c. Pulihkan Stok Produk:                                               │
   │    - Untuk setiap item di sale.items:                                  │
   │      Cari produk terkait di state.products.                            │
   │      Jika produk ditemukan:                                            │
   │        product.stockQuantity += item.quantity                          │
   │ d. Perbarui Metadata Transaksi:                                        │
   │    - sale.status = "VOIDED"                                            │
   │    - sale.voidReason = input.voidReason.trim()                         │
   │    - sale.voidedAt = new Date().toISOString()                          │
   │ e. Simpan Objek State Baru secara Utuh ke localStorage / In-Memory.    │
   │ f. Publikasikan Snapshot Baru & Panggil notifyListeners().             │
   └────────────────────────────────────────────────────────────────────────┘
       │
       ▼
3. Respon ke UI
   - Status transaksi pada tabel riwayat berubah menjadi badge merah "Dibatalkan".
   - Nilai omzet dan laba kotor pada dashboard otomatis berkurang karena getDashboardSummary()
     hanya menghitung transaksi COMPLETED.
   - Stok produk kembali bertambah sesuai kuantitas yang dibatalkan.
```

### 6.3 Batas Konsistensi Penyimpanan Browser
> [!IMPORTANT]
> **Batasan Teknis Penyimpanan Browser:**  
> Demo Mode berjalan sepenuhnya di sisi klien menggunakan `window.localStorage` dan variabel memori.  
> 1. Mutasi state dijamin atomik di dalam tab aktif karena dieksekusi secara sinkron dalam satu event handler JavaScript (Single-Threaded Event Loop).  
> 2. Tidak ada jaminan *Distributed ACID Transactions* lintas-tab secara real-time (jika dua tab kasir dibuka bersamaan dan menekan checkout pada milidetik yang sama, tab terakhir yang menyimpan akan menimpa snapshot tab pertama).  
> 3. Data demo tidak disinkronkan ke server atau perangkat lain. Hal ini merupakan karakteristik yang disengaja (*by design*) untuk sandbox simulasi lokal.

---

## 7. Formula Finansial Beserta Contoh Numerik

Sesuai ketentuan `docs/PRD.md` Bagian 4.5, 4.7, 4.8, dan 5:

### 7.1 Formula Baku Perhitungan
$$\text{Subtotal Baris Item} = (\text{Quantity} \times \text{Snapshot Unit Price}) - \text{Diskon Item}$$
$$\text{Subtotal Kotor Transaksi} = \sum \text{Subtotal Baris Item}$$
$$\text{Penjualan Bersih (Net Sales / Total Amount)} = \text{Subtotal Kotor Transaksi} - \text{Diskon Transaksi}$$
$$\text{Total HPP Transaksi (COGS)} = \sum (\text{Quantity} \times \text{Snapshot Cost Price})$$
$$\text{Laba Kotor Transaksi (Gross Profit)} = \text{Penjualan Bersih} - \text{Total HPP Transaksi}$$
$$\text{Uang Kembalian (Cash Change)} = \max(0, \text{Uang Diterima} - \text{Penjualan Bersih})$$

### 7.2 Ketentuan Integritas Finansial PRD v1.1
1. **Presisi Integer IDR:** Seluruh nilai rupiah wajib bilangan bulat (`Math.round` jika terdapat kalkulasi persentase). Tidak diperbolehkan nilai pecahan atau desimal sen.
2. **Anti-Double-Count:** Pembelian stok restock persediaan (`purchases`) **tidak boleh** dicatat sebagai beban operasional toko (`expenses`).
3. **Isolasi Transaksi Void:** Transaksi yang berstatus `VOIDED` **dikeluarkan 100%** dari perhitungan Penjualan Kotor, Penjualan Bersih, HPP, Laba Kotor, dan Arus Kas Masuk di Dashboard dan Laporan.
4. **Kebijakan MWAC Saat Void:** Pembatalan penjualan mengembalikan kuantitas fisik produk, namun **tidak mengubah biaya modal rata-rata berjalan (MWAC)** produk yang ada. Biaya modal historis tetap mengacu pada pembelian terakhir yang sah.

---

### 7.3 Contoh Kasus Numerik Menyeluruh

#### Skenario 1: Transaksi Penjualan Baru di Kasir POS
Dua produk dibeli oleh pelanggan di kasir:
1. **Beras Ramos Super 5kg (`prod-001`):**
   - Stok Awal: 12 karung
   - Harga Jual: Rp 76.000 / karung
   - Snapshot HPP (cogs): Rp 68.000 / karung
   - Kuantitas Beli: 2 karung
   - Subtotal Item 1 = $2 \times 76.000 = \text{Rp } 152.000$
   - HPP Item 1 = $2 \times 68.000 = \text{Rp } 136.000$

2. **Minyak Goreng Sawit 2L (`prod-002`):**
   - Stok Awal: 15 pouch
   - Harga Jual: Rp 36.500 / pouch
   - Snapshot HPP (cogs): Rp 32.000 / pouch
   - Kuantitas Beli: 1 pouch
   - Subtotal Item 2 = $1 \times 36.500 = \text{Rp } 36.500$
   - HPP Item 2 = $1 \times 32.000 = \text{Rp } 32.000$

**Kalkulasi Transaksi:**
- Subtotal Kotor = $152.000 + 36.500 = \text{Rp } 188.500$
- Diskon Transaksi = Rp 8.500
- **Penjualan Bersih (`totalAmount`):** $188.500 - 8.500 = \text{Rp } 180.000$
- **Total HPP (`totalCogs`):** $136.000 + 32.000 = \text{Rp } 168.000$
- **Laba Kotor (`grossProfit`):** $180.000 - 168.000 = \text{Rp } 12.000$ (Margin Laba Kotor: $\approx 6,67\%$)
- Metode Pembayaran: Tunai (`CASH`)
- Uang Diterima Kasir: Rp 200.000
- **Uang Kembalian:** $200.000 - 180.000 = \text{Rp } 20.000$

**Dampak terhadap Stok Fisik:**
- Stok Beras Ramos: $12 - 2 = 10\text{ karung}$
- Stok Minyak Goreng: $15 - 1 = 14\text{ pouch}$

**Dampak terhadap Dashboard Toko:**
- Omzet Bersih Demo: bertambah +Rp 180.000
- HPP Terjual Demo: bertambah +Rp 168.000
- Laba Kotor Demo: bertambah +Rp 12.000
- Arus Kas Masuk Demo: bertambah +Rp 180.000

---

#### Skenario 2: Pembatalan Transaksi Penjualan (Void)
Transaksi di atas kemudian dibatalkan oleh kasir dengan alasan:  
*"Pelanggan salah memilih varian beras dan tidak membawa uang tambahan, dibatalkan atas permintaan pembeli."*

**Dampak Pembatalan:**
- Status transaksi berubah dari `COMPLETED` $\to$ `VOIDED`.
- Metadata tercatat: `voidReason` terisi, `voidedAt` tercatat.
- **Pemulihan Stok Persediaan:**
  - Beras Ramos: $10 + 2 = 12\text{ karung}$ (kembali ke kuantitas awal)
  - Minyak Goreng: $14 + 1 = 15\text{ pouch}$ (kembali ke kuantitas awal)
- **Rekalkulasi Dashboard Finansial:**
  - Omzet Bersih Demo: berkurang -Rp 180.000 (kembali ke posisi sebelum penjualan)
  - HPP Terjual Demo: berkurang -Rp 168.000
  - Laba Kotor Demo: berkurang -Rp 12.000
  - Arus Kas Masuk Demo: berkurang -Rp 180.000
- Transaksi tetap tampil di tabel riwayat transaksi dengan badge "Dibatalkan" dan tidak dihapus secara permanen dari riwayat audit toko.

---

## 8. Rekomendasi Rute dan Struktur Komponen

### 8.1 Arsitektur Rute Baru
Sesuai konvensi routing Next.js App Router dan spesifikasi `docs/information-architecture.md`:

```
src/app/demo/
├── page.tsx                     # Gateway Demo (redirect ke dashboard)
├── layout.tsx                   # Layout segmen Demo
├── dashboard/
│   └── page.tsx                 # Dashboard Utama Mode Demo
└── sales/
    ├── page.tsx                 # [BARU] Riwayat Transaksi & Dialog Void (/demo/sales)
    └── new/
        └── page.tsx             # [BARU] Halaman Kasir POS (/demo/sales/new)
```

### 8.2 Struktur Komponen Halaman Kasir POS (`/demo/sales/new`)
Halaman kasir POS mengusung tata letak *two-column responsive layout*:
1. **Kolom Kiri — Katalog & Pencarian Produk:**
   - Bar pencarian cepat produk (berdasarkan nama dan SKU).
   - Filter pill kategori sembako (Semua, Beras & Biji-bijian, Minyak & Lemak, Gula & Pemanis, dsb.).
   - Grid kartu produk responsif:
     - Menampilkan nama, SKU, unit kemasan, harga jual (Rp), dan sisa stok.
     - Badge penanda status: *Stok Rendah* (oranye jika $\le$ minStockAlert), *Habis* (merah dan nonaktif jika stok = 0).
     - Tombol / area klik cepat untuk memasukkan 1 unit produk ke keranjang.
   - Empty state jika pencarian tidak menemukan hasil.
2. **Kolom Kanan — Panel Keranjang Kasir & Pembayaran:**
   - Header keranjang dengan tombol *Reset / Kosongkan Keranjang*.
   - Daftar item belanja:
     - Nama produk dan harga satuan.
     - Stepper kuantitas interaktif (`-`, input teks angka langsung, `+`).
     - Proteksi batas atas kuantitas: tidak dapat menaikkan melebihi sisa stok fisik yang ada.
     - Tombol ikon hapus item (*trash icon*).
     - Subtotal per baris barang.
   - Ringkasan kalkulasi:
     - Subtotal kotor.
     - Input diskon transaksi (diskon nominal rupiah dengan proteksi tidak boleh negatif atau melebihi subtotal).
     - Total tagihan bersih (*highlighted* dengan warna Royal Violet & font besar tebal).
   - Opsi metode pembayaran:
     - Tombol toggle Tunai (`CASH`) atau Transfer Bank (`BANK_TRANSFER`).
     - Jika Tunai: Input nominal uang tunai yang diserahkan pembeli + tombol cepat pecahan uang pas (Rp 50rb, Rp 100rb, Uang Pas).
     - Menampilkan kalkulasi kembalian otomatis secara instan.
   - Area catatan pesanan kasir (*notes* opsional).
   - Tombol utama penyelesaian transaksi:
     - Latar belakang Royal Violet solid (`#5B3CC4`).
     - Proteksi *double-click* dan status loading.
     - Disabled jika keranjang kosong atau uang tunai kurang dari total belanja.
3. **Modal Struk Transaksi Sukses:**
   - Muncul otomatis setelah transaksi berhasil disimpan ke store.
   - Menampilkan nomor faktur (`INV-YYYYMMDD-XXXX`), tanggal, waktu, daftar belanja, total, nominal bayar, dan kembalian.
   - Tombol aksi: *"Transaksi Baru"* (mengosongkan keranjang untuk pelanggan berikutnya), *"Lihat Riwayat Transaksi"*, dan *"Cetak / Simpan Struk"*.

### 8.3 Struktur Komponen Halaman Riwayat Penjualan (`/demo/sales`)
1. **Header & Aksi:**
   - Judul halaman *"Riwayat Transaksi Penjualan"* dengan subtitle toko.
   - Tombol CTA primer: *"Buka Kasir POS"* (menautkan ke `/demo/sales/new` dengan ikon keranjang belanja).
2. **Filter & Pencarian:**
   - Input pencarian (nomor faktur, nama item).
   - Filter dropdown status transaksi: *Semua Status*, *Selesai (COMPLETED)*, *Dibatalkan (VOIDED)*.
   - Filter metode pembayaran: *Semua*, *Tunai*, *Transfer Bank*.
3. **Tabel Riwayat Transaksi:**
   - Kolom: Nomor Faktur, Tanggal & Waktu, Total Belanja, Metode Pembayaran, Status Transaksi, dan Aksi.
   - Badge status yang jelas: Hijau (*Selesai*) dan Merah (*Dibatalkan*).
   - Tombol aksi per baris:
     - Ikon mata / dokumen: Membuka Modal Detail Transaksi.
     - Tombol / ikon batal (*Void*): Hanya aktif jika status transaksi masih `COMPLETED`.
4. **Modal Detail Transaksi:**
   - Menampilkan seluruh rincian transaksi: nomor faktur, waktu, kasir, rincian barang, harga beli (HPP), laba kotor, dan catatan.
   - Jika transaksi telah dibatalkan: menampilkan informasi waktu pembatalan dan alasan pembatalan.
5. **Modal Pembatalan Transaksi (Void Dialog):**
   - Peringatan tegas: *"Pembatalan transaksi akan mengembalikan stok produk ke persediaan dan membatalkan omzet dari laporan finansial."*
   - Textarea input alasan pembatalan (wajib diisi minimal 5 karakter, dengan validasi pesan error).
   - Tombol *"Batal"* (menutup modal tanpa mutasi) dan tombol bahaya *"Konfirmasi Pembatalan Transaksi"* (warna merah / danger).

### 8.4 Pembukaan Navigasi `DemoSidebar`
Memperbarui konfigurasi menu pada `src/components/demo/demo-sidebar.tsx`:
```ts
{
  label: "Penjualan",
  href: "/demo/sales",
  icon: ShoppingCart,
  isAvailable: true, // Dibuka setelah implementasi
}
```

---

## 9. Rencana Pengujian dan Kriteria Penerimaan (Acceptance Criteria)

Pengujian modul penjualan Mode Demo wajib mencakup **22 skenario uji spesifik** yang mencakup level unit logika store, komponen interaktif, dan integrasi state:

| No | Skenario Pengujian | Level Pengujian | Kriteria Penerimaan (Acceptance Criteria) |
|:---:|---|:---:|---|
| 1 | Menambahkan produk aktif ke keranjang POS | Component & Store | Produk yang diklik masuk ke keranjang dengan kuantitas awal 1 dan harga snapshot yang tepat. |
| 2 | Menolak penambahan produk stok habis | Component & Store | Produk dengan `stockQuantity === 0` tidak dapat ditambahkan ke keranjang; tombol disabled dan berstatus "Habis". |
| 3 | Menambah, mengurangi, dan menghapus item keranjang | Component | Tombol `+` menaikkan qty, `-` menurunkan qty (hingga 1), dan ikon tong sampah menghapus item dari keranjang. |
| 4 | Menolak kuantitas nol, negatif, pecahan, atau melebihi stok | Store & Component | Input kuantitas tidak menerima angka $< 1$ atau nilai desimal; kuantitas dibatasi maksimal sebesar sisa stok fisik yang tersedia. |
| 5 | Memvalidasi ulang stok sebelum transaksi diselesaikan | Store Unit | Jika stok fisik produk berkurang di store sebelum checkout selesai, checkout menolak transaksi dan menampilkan pesan error stok tidak cukup. |
| 6 | Menghitung subtotal, diskon, dan penjualan bersih | Store Unit | Perhitungan $Net = Subtotal - Discount$ akurat hingga nominal rupiah terakhir; tidak menghasilkan angka negatif atau desimal. |
| 7 | Menyelesaikan transaksi dengan metode Tunai | Store & Component | Berhasil disimpan jika uang tunai $\ge$ total belanja; menghitung uang kembalian secara tepat. |
| 8 | Menyelesaikan transaksi dengan metode Transfer Bank | Store & Component | Berhasil disimpan sebagai transaksi lunas langsung tanpa memerlukan verifikasi kembalian tunai. |
| 9 | Menyimpan snapshot harga jual dan HPP pada item | Store Unit | Objek `DemoSaleItem` menyimpan `unitPrice` dan `costPrice` (HPP) historis saat transaksi terjadi. |
| 10 | Memastikan stok berkurang tepat satu kali | Store Unit | Stok produk berkurang tepat sejumlah kuantitas yang dibeli; tidak terjadi pengurangan ganda. |
| 11 | Menolak klik ganda saat penyelesaian transaksi | Component | Tombol checkout menampilkan status loading dan dinonaktifkan saat proses simpan berlangsung (*submission lock*). |
| 12 | Memastikan transaksi gagal tidak meninggalkan perubahan parsial | Store Unit | Jika salah satu validasi item gagal, 0 produk yang berkurang stoknya dan 0 penjualan baru yang tercatat (atomisitas 100%). |
| 13 | Menampilkan transaksi baru pada riwayat dan dashboard | Integration | Transaksi yang baru diselesaikan langsung muncul pada daftar transaksi terbaru di `/demo/sales` dan `/demo/dashboard`. |
| 14 | Menolak pembatalan tanpa alasan | Store & Component | Form pembatalan menolak string kosong, spasi saja, atau teks $< 5$ karakter dengan pesan validasi yang jelas. |
| 15 | Menolak pembatalan pada transaksi yang sudah batal | Store Unit | Memanggil `voidSale` pada transaksi berstatus `VOIDED` melempar error dan tidak mengubah state (idempoten). |
| 16 | Memulihkan stok tepat satu kali saat pembatalan | Store Unit | Kuantitas produk pada `state.products` bertambah kembali tepat sebesar kuantitas item yang dibatalkan. |
| 17 | Memastikan transaksi batal tidak dihitung di penjualan aktif | Store Unit | `getDashboardSummary()` mengecualikan transaksi `VOIDED` dari `netSales`, `cogs`, dan `grossProfit`. |
| 18 | Memastikan dashboard dan metrik finansial tetap konsisten | Integration | Indikator Omzet, HPP, Laba Kotor, dan Arus Kas di dashboard otomatis terbarui reaktif melalui `useSyncExternalStore`. |
| 19 | Memastikan reset mengembalikan seed data awal | Store Unit | Memanggil `resetState()` menghapus seluruh transaksi baru dan mengembalikan stok serta riwayat ke 27 transaksi seed awal. |
| 20 | Memastikan tidak menyentuh Supabase atau server actions | Code Audit & Lint | Modul demo tidak memiliki satu pun baris kode yang mengimpor dari `@/lib/supabase/*` atau `@/app/actions/*`. |
| 21 | Memastikan ketahanan saat storage peramban gagal | Store Unit | Jika `localStorage` melempar error kuota atau diblokir (incognito), simulasi beralih ke in-memory tanpa melempar exception fatal. |
| 22 | Memastikan tidak terjadi infinite loop pada `useSyncExternalStore` | Component & React | Pengujian render komponen kasir dan riwayat lolos tanpa memicu peringatan getSnapshot loop atau maximum update depth. |

---

## 10. Risiko, Batasan, dan Keputusan yang Memerlukan Persetujuan

### 10.1 Risiko Teknis & Mitigasi
1. **Risiko Benturan Nomor Faktur (*Invoice Collision*):**
   - *Risiko:* Pembuatan nomor faktur acak murni dapat berbenturan dengan nomor faktur yang sudah ada di seed.
   - *Mitigasi:* Menggunakan pola sekuens harian berbasis tanggal `INV-YYYYMMDD-XXXX` di mana `XXXX` dihitung dari jumlah transaksi pada tanggal tersebut ditambah counter acak pengaman, diverifikasi dengan loop pemeriksaan `sales.some(s => s.invoiceNumber === candidate)`.
2. **Risiko Ketidaksesuaian Referensi Snapshot React:**
   - *Risiko:* Mengembalikan objek baru pada selector hook dapat memicu infinite re-render.
   - *Mitigasi:* Mempertahankan arsitektur bound instance methods yang telah terbukti stabil pada runtime fix report:
     ```tsx
     const storeState = React.useSyncExternalStore(
       demoStoreService.subscribe,
       demoStoreService.getState,
       demoStoreService.getServerSnapshot
     );
     ```

### 10.2 Batasan Sistem Sandboxed
- **Penyimpanan Lokal Saja:** Data tidak persisten antar-peramban atau antar-perangkat.
- **Bukan Sistem Multi-Kasir Terdistribusi:** Tidak mendukung sinkronisasi real-time antar-tab secara instan (karakteristik wajar untuk mode demo UMKM).

### 10.3 Keputusan Desain yang Memerlukan Persetujuan Pengguna
Sebelum implementasi dimulai, ada satu keputusan desain yang disarankan untuk disepakati:
- **Tingkat Diskon di POS:**  
  *Opsi A (Disarankan):* Mendukung **Diskon Transaksi** (diskon total nominal rupiah di kasir) secara penuh, dan menyediakan properti `itemDiscount?: number` opsional pada item dengan nilai default 0. Pendekatan ini paling sederhana, cepat, dan selaras dengan pola transaksi kasir UMKM sembako yang mayoritas memberikan potongan harga pada total belanja.  
  *Opsi B:* Mengharuskan input diskon per-item dan diskon transaksi secara bersamaan pada antarmuka kasir.  
  *Rekomendasi:* Opsi A lebih intuitif dan bersih untuk alur POS demo.

---

## 11. Urutan Implementasi yang Direkomendasikan

Jika otorisasi implementasi diberikan oleh pengguna pada giliran berikutnya, berikut adalah langkah pengerjaan berurutan yang terstruktur:

1. **Langkah 1 — Penyempurnaan Tipe & Logika Store (`src/services/demo/`):**
   - Perbarui `demo-types.ts`: tambahkan tipe input `CreateDemoSaleInput`, `VoidDemoSaleInput`, dan kelengkapan `DemoCartItem`.
   - Perbarui `demo-store.service.ts`: implementasikan fungsi utilitas pembuatan nomor faktur unik browser-safe, metode atomik `recordSale()`, `voidSale()`, dan getter `getSaleById()`.
   - Buat unit test mendalam pada `demo-store.test.ts` untuk menguji skenario 1–12, 14–17, 19, dan 21.
2. **Langkah 2 — Implementasi Halaman Kasir POS (`src/app/demo/sales/new/page.tsx`):**
   - Bangun UI katalog produk dengan filter kategori dan pencarian cepat.
   - Bangun panel keranjang belanja, pengaturan kuantitas, validasi batas stok, input diskon, dan kalkulasi pembayaran tunai / transfer.
   - Bangun modal konfirmasi struk transaksi sukses.
3. **Langkah 3 — Implementasi Halaman Riwayat Penjualan (`src/app/demo/sales/page.tsx`):**
   - Bangun tabel transaksi dengan filter tanggal, status, dan metode pembayaran.
   - Bangun modal detail transaksi (melihat rincian barang, HPP, laba kotor).
   - Bangun modal pembatalan transaksi (*Void Dialog*) dengan input alasan wajib.
4. **Langkah 4 — Pembukaan Navigasi & Integrasi Antarmuka:**
   - Perbarui `src/components/demo/demo-sidebar.tsx` untuk mengaktifkan tautan *"Penjualan"* ke `/demo/sales`.
   - Hubungkan tombol aksi cepat pada header/dashboard ke `/demo/sales/new`.
5. **Langkah 5 — Verifikasi Komprehensif & Quality Gates:**
   - Jalankan `npm run type-check` (TypeScript zero error).
   - Jalankan `npm run lint` (ESLint zero error).
   - Jalankan `npm run test` (mempertahankan 796 test yang lulus dan memverifikasi seluruh test demo baru).
   - Jalankan `npm run build` (Next.js 16.4.0 Turbopack production build).
   - Susun Laporan Implementasi Resmi Stage 4C.

---

## 12. Estimasi Berkas yang Akan Dibuat atau Diubah

| No | Path Berkas | Status Rencana | Deskripsi Rencana Perubahan |
|:---:|---|:---:|---|
| 1 | `src/services/demo/demo-types.ts` | **Dimodifikasi** | Menambahkan interface input `CreateDemoSaleInput`, `VoidDemoSaleInput`, dan field opsional `itemDiscount` pada `DemoSaleItem`. |
| 2 | `src/services/demo/demo-store.service.ts` | **Dimodifikasi** | Menambahkan metode `recordSale()`, `voidSale()`, `getSaleById()`, dan generator faktur browser-safe. |
| 3 | `src/services/demo/demo-store.test.ts` | **Dimodifikasi** | Menambahkan skenario uji unit untuk mutasi penjualan, pengurangan stok, pembatalan void, dan pemulihan stok. |
| 4 | `src/components/demo/demo-sidebar.tsx` | **Dimodifikasi** | Membuka tautan menu "Penjualan" (`href: "/demo/sales"`, `isAvailable: true`). |
| 5 | `src/app/demo/sales/page.tsx` | **Baru** | Halaman riwayat penjualan demo, filter transaksi, modal detail, dan dialog void. |
| 6 | `src/app/demo/sales/new/page.tsx` | **Baru** | Halaman kasir Point of Sale (POS) demo, katalog produk, keranjang belanja, kalkulasi, dan struk. |
| 7 | `src/app/demo/sales/demo-sales.test.tsx` | **Baru** | Suite pengujian unit antarmuka untuk komponen POS dan Riwayat Transaksi. |
| 8 | `docs/stage-4c-demo-sales-implementation-report.md` | **Baru** | Laporan penutupan implementasi resmi setelah seluruh quality gate lolos. |

*Perhatian Ketat:* Tidak ada satu pun berkas di atas yang diubah atau dibuat pada tahap audit pra-implementasi ini. Seluruh berkas di atas murni merupakan rencana estimasi untuk tahap implementasi berikutnya.

---

## 13. Quality Gates dan Pemeriksaan yang Diperlukan pada Tahap Implementasi

Setiap kode yang nantinya diimplementasikan pada Stage 4C wajib memenuhi kriteria gerbang kualitas berikut tanpa toleransi pengecualian:

1. **TypeScript Type Safety:**  
   Perintah `npm run type-check` (atau `tsc --noEmit`) harus keluar dengan kode 0 (zero error), tanpa penggunaan tipe `any` yang tidak terkontrol.
2. **ESLint Code Quality:**  
   Perintah `npm run lint` harus bersih dari pelanggaran aturan linter.
3. **Vitest Unit & Component Tests:**  
   Seluruh 796 test yang saat ini ada harus tetap lulus 100%, ditambah seluruh test baru untuk store dan komponen penjualan demo.
4. **Next.js Production Build:**  
   Perintah `npm run build` dengan Cache Components dan Partial Prerendering pada Next.js 16.4.0 Canary wajib menghasilkan build sukses tanpa error SSR pada rute `/demo/sales` dan `/demo/sales/new`.
5. **Zero Production Leakage:**  
   Verifikasi via `grep` wajib memastikan tidak ada impor dari `@/app/actions/*` atau `@/lib/supabase/*` di seluruh direktori `src/app/demo/*` dan `src/services/demo/*`.
6. **Integritas Git Staging:**  
   Perubahan ter-stage sebelumnya (`A docs/stage-5.6-step-2-implementation-report.md`) wajib tetap dipertahankan utuh dan tidak boleh ter-unstage atau ter-commit sebelum ada instruksi resmi.

---

## 14. Kesimpulan Kesiapan (Readiness Conclusion)

### **STATUS KESIAPAN: `READY WITH CONDITIONS`**

#### Kondisi yang Terpenuhi (*Strengths*):
1. Arsitektur Demo Store `veyra_demo_store_v1` telah kokoh, memiliki in-memory fallback, penanganan data rusak, dan telah terbukti bebas dari tearing / infinite loop pada React `useSyncExternalStore`.
2. Seed data *"Toko Sembako Sejahtera"* telah mencakup 15 produk, 27 riwayat transaksi (25 lunas, 2 void), dan parameter HPP yang realistis.
3. Kontrak finansial PRD v1.1 telah dipahami secara presisi: integer IDR, MWAC snapshot pada penjualan, pemisahan pembelian dari beban operasional, dan pengecualian transaksi void dari omzet aktif.
4. Spesifikasi UI/UX untuk POS dan Riwayat Penjualan telah terdefinisi secara jelas, mengikuti Royal Violet Design System, dan bebas dari AI-slop.

#### Kondisi yang Harus Dipatuhi (*Mandatory Conditions*):
1. **Pemberian Otorisasi Eksplisit:** Implementasi fitur dan perubahan kode HANYA boleh dimulai setelah pengguna memberikan izin tertulis.
2. **Tanpa Sentuhan Produksi:** Modul penjualan demo TIDAK BOLEH memanggil server actions produksi atau API Supabase.
3. **Presisi Finansial Integer IDR:** Tidak boleh ada desimal sen atau floating-point moneter yang tidak dibulatkan.

---
*Dokumen ini merupakan hasil audit pra-implementasi resmi Stage 4C VeyraOS. Tidak ada kode aplikasi atau dependensi yang dimodifikasi selama proses audit ini.*
