# Task Plan: Remediasi Production Build VeyraOS (Next.js 16 App Router Route Export & PageProps)

**Status:** Completed  
**Objective:** Mengeliminasi seluruh 20 error TS2344 pada 13 file `page.tsx` agar `next build` (Production Build) lulus 100% (PASS) tanpa merusak unit test yang ada, tanpa mengganggu dev server, dan tanpa merusak Git staging pengguna.

---

## Phases

- [ ] **Phase 1: Inisialisasi & Setup Lingkungan Perencanaan**
  - [x] Konfirmasi prioritas user untuk menyelesaikan build failure sebelum UI Polish Batch 2
  - [ ] Buat file `task_plan.md`, `findings.md`, `progress.md` (plugin `planning-with-files`)
  - [ ] Pastikan dev server dan staged file `docs/stage-5.6-step-2-implementation-report.md` aman

- [x] **Phase 2: Remediasi Modul Demo & Helper Functions (4 File)**
  - [x] `src/app/demo/sales/new/page.tsx`: Ekstraksi `posReducer` ke `pos-state.ts`, update `demo-pos.test.tsx` (PASS 16/16)
  - [x] `src/app/demo/sales/page.tsx`: Ekstraksi `formatSaleDate` ke `demo-sales-utils.ts`, update `demo-sales.test.tsx` (PASS 18/18)
  - [x] `src/app/page.tsx`: Ekstraksi `getSafeRedirectUrl`, gateway evaluator, dan `LandingPageView`, normalisasi `Home(props: HomeProps)`, update `page.test.tsx` (PASS 31/31)
  - [x] `src/app/expenses/page.tsx`: Ekstraksi `EXPENSE_CATEGORIES` ke `@/constants/expenses` dan `ExpensesContent`, normalisasi `ExpensesPage()`, update `expenses.test.tsx` (PASS 25/25)
  - [x] Verifikasi tes Vitest untuk 4 modul ini (PASS 90/90)

- [x] **Phase 3: Remediasi Modul Katalog & Transaksi (Products, Purchases, Sales) (6 File)**
  - [x] `src/app/products/[id]/page.tsx`: Ekstraksi `ProductDetailContent` & `ProductDetailView`, normalisasi `params: Promise<{ id: string }>` (PASS)
  - [x] `src/app/products/page.tsx`: Ekstraksi `ProductListContent` & `ProductListView`, normalisasi `ProductsPage()` (PASS)
  - [x] `src/app/purchases/new/page.tsx`: Ekstraksi `PurchaseFormContent` & `NewPurchaseView`, normalisasi `NewPurchasePage()` (PASS)
  - [x] `src/app/purchases/page.tsx`: Ekstraksi `PurchasesContent`, normalisasi `PurchasesPage()` (PASS)
  - [x] `src/app/sales/new/page.tsx`: Ekstraksi `SalesCheckoutContent` & `NewSaleView`, normalisasi `NewSalePage()`, update `sales-pos.test.tsx` (PASS 18/18)
  - [x] `src/app/sales/page.tsx`: Ekstraksi `SalesHistoryContent`, normalisasi `SalesHistoryPage()`, update `sales-history.test.tsx` (PASS 54/54)
  - [x] Verifikasi tes Vitest untuk 6 modul ini (PASS 89/89)

- [x] **Phase 4: Remediasi Modul Dashboard & Reports & Settings (3 File)**
  - [x] `src/app/dashboard/page.tsx`: Ekstraksi `DashboardContent`, update `dashboard.test.tsx` (PASS 28/28)
  - [x] `src/app/reports/page.tsx`: Ekstraksi `ReportsContent`, update `reports.test.tsx` (PASS 20/20)
  - [x] `src/app/settings/page.tsx`: Ekstraksi `SettingsContent`, normalisasi `SettingsPage()`, update `settings.test.tsx` (PASS 18/18)
  - [x] Verifikasi tes Vitest untuk 3 modul ini (PASS 66/66)

- [x] **Phase 5: Verifikasi Menyeluruh & Production Build Check**
  - [x] Jalankan seluruh unit test suite Vitest (`npm test`) -> 932/932 PASS (45 test files)
  - [x] Jalankan `npm run type-check` (`tsc --noEmit`) -> 0 error (Exit Code 0)
  - [x] Jalankan verifikasi build terisolasi (`npx next build --webpack`) -> PASS (21/21 static pages generated, Exit Code 0)
  - [x] Konfirmasi keamanan dev server dan integritas Git staging (staged file pengguna utuh)
  - [x] Buat laporan penutupan remediasi build (`docs/ui-polish-batch-1-build-remediation-report.md`)

---

## UI Polish Phase 2 Batch 2 — Blueprint & Roadmap (Status: Completed)

- [x] **Sub-Batch 2.1: Adopsi Shared Primitives (P0)** (PASS 152/152)
- [x] **Sub-Batch 2.2: Mobile Ergonomics & Card Lists (P1)** (PASS 91/91)
- [x] **Sub-Batch 2.3: Standardisasi KPI & StatCard (P1)** (PASS 66/66)
- [x] **Sub-Batch 2.4: App Shell Polish & Micro-interactions (P2)** (PASS 29/29)
- [x] **Final Batch 2 Verification & Closure** (932/932 PASS, 0 type errors)

---

## Stage Demo Complete Expansion — Roadmap & Task Breakdown (Status: Completed)

- [x] **Phase 1: Ekstensi Service Layer `DemoStoreService`**
  - [x] Tambahkan metode mutasi produk: `createProduct`, `updateProduct`, `archiveProduct`
  - [x] Tambahkan metode pembelian restock: `recordPurchase` dengan rekalkulasi moving average HPP
  - [x] Tambahkan metode pengeluaran: `recordExpense`, `deleteExpense`
  - [x] Tambahkan pengujian unit di `src/services/demo/demo-store.test.ts` (PASS 55/55)

- [x] **Phase 2: Modul Produk & Stok Demo (`/demo/products`)**
  - [x] Buat halaman `src/app/demo/products/page.tsx` (Card view mobile, table desktop, search, filter, modal)
  - [x] Buat pengujian unit `src/app/demo/products/demo-products.test.tsx` (PASS 5/5)

- [x] **Phase 3: Modul Pembelian & Restock Demo (`/demo/purchases`)**
  - [x] Buat halaman `src/app/demo/purchases/page.tsx` (Riwayat pembelian, modal restock, touch target 44px)
  - [x] Buat pengujian unit `src/app/demo/purchases/demo-purchases.test.tsx` (PASS 4/4)

- [x] **Phase 4: Modul Pengeluaran Operasional Demo (`/demo/expenses`)**
  - [x] Buat halaman `src/app/demo/expenses/page.tsx` (Daftar pengeluaran, breakdown kategori, modal beban)
  - [x] Buat pengujian unit `src/app/demo/expenses/demo-expenses.test.tsx` (PASS 4/4)

- [x] **Phase 5: Modul Laporan Finansial Demo (`/demo/reports`)**
  - [x] Buat halaman `src/app/demo/reports/page.tsx` (Tab Penjualan, Beban, Stok, dan Ekspor CSV Blob klien)
  - [x] Buat pengujian unit `src/app/demo/reports/demo-reports.test.tsx` (PASS 3/3)

- [x] **Phase 6: Integrasi Navigasi `DemoSidebar` & Final Quality Verification**
  - [x] Aktifkan seluruh tautan menu di `src/components/demo/demo-sidebar.tsx` (`isAvailable: true`)
  - [x] Update pengujian `src/app/demo/demo.test.tsx` & `src/app/demo/sales/demo-sales.test.tsx`
  - [x] Full suite test Vitest (`npx vitest run`) -> 49 test files passed, 952 tests passed
  - [x] Full typecheck (`npm run type-check`) -> 0 errors (Exit Code 0)
  - [x] Buat laporan implementasi resmi di `docs/stage-demo-complete-report.md`

- [x] **Phase 7: Modul Pengaturan Mode Demo (`/demo/settings`) — Complete Ecosystem**
  - [x] Tipe data: `UpdateDemoBusinessProfileInput`, `receiptFooter`, `receiptPaperSize` di `demo-types.ts`
  - [x] Service: `updateBusinessProfile()` dan `clearTransactionsOnly()` di `demo-store.service.ts`
  - [x] Test Store: Skenario 30 & 31 di `demo-store.test.ts` (PASS 57/57)
  - [x] Halaman `src/app/demo/settings/page.tsx` (Profil toko, live preview struk, preferensi 58mm/80mm, kontrol reset/ekspor JSON)
  - [x] Unit test `src/app/demo/settings/demo-settings.test.tsx` (PASS 4/4)
  - [x] Navigasi: Aktifkan menu Pengaturan di `DemoSidebar` (100% menu demo aktif tanpa status terkunci)
  - [x] Full Vitest suite: 50 test files passed, 958 tests passed (100% PASS)
  - [x] Full TypeScript type-check: `tsc --noEmit` 0 error (Exit Code 0)
  - [x] Live Browser QA (Playwright): Verifikasi live preview struk dan sinkronisasi nama toko ke Kasir POS
  - [x] Knowledge graph disinkronkan: `graphify update .` (5768 nodes, 365 communities)
  - [x] Laporan resmi: `docs/stage-demo-settings-report.md`

- [x] **Tahap 10: Pengujian QA Komprehensif, Audit Keamanan & Deployment (Status: Completed)**
  - [x] Audit Keamanan RLS 11 tabel database & least-privilege SQL grants
  - [x] Validasi Composite Foreign Keys `(business_id, id)` pada relasi items
  - [x] Validasi RPC Guards PL/pgSQL stored procedures terhadap cross-tenant tampering
  - [x] Pengujian E2E Browser Playwright pada alur Login, Register, dan Proteksi Middleware Onboarding
  - [x] Pengujian responsivitas smartphone mobile (360x740) & desktop (1280x800)
  - [x] Audit Aksesibilitas WCAG 2.1 AA (kontras warna Royal Violet, keyboard focus ring Tab)
  - [x] Integritas bundle Next.js 16 & status environment variable rahasia
  - [x] Laporan resmi: `docs/stage-10-comprehensive-qa-and-security-report.md`

---

## Phase 11: Comprehensive Premium UI/UX Redesign (UI/UX Pro Max)

- [x] **Step 0: Hydration Issue Fix & Baseline Capture**
  - [x] Perbaiki Next.js hydration error pada `RootLayout` (`suppressHydrationWarning` pada `<html lang="id">`)
  - [x] Buat backup branch `backup/pre-premium-redesign` untuk mekanisme rollback aman
  - [x] Jalankan query design intelligence `search.py` dari `ui-ux-pro-max` (Swiss Style + Minimalist FinTech)
  - [x] Ambil baseline BEFORE screenshots via Playwright (Desktop 1440px & Mobile 390px pada Dashboard dan POS)

- [ ] **Step 1: Design System & Shared Primitives Transformation**
  - [ ] Standardisasi typography tokens scale (`display`, `h1`, `h2`, `subhead`, `body`, `caption-overline`, `financial-mono`)
  - [ ] Standardisasi icon tokens & Lucide stroke consistency (`strokeWidth={1.75}`)
  - [ ] Upgrade `Button`: tactile press feedback, micro-depth, refined variant system (primary, secondary, subtle, outline, destructive)
  - [ ] Upgrade `Card`: layered architectural cards, crisp hairline borders (`#E5E1EC`), deliberate padding, elevation levels
  - [ ] Upgrade `Badge`: semantic statuses (success, warning, critical, neutral, live) dengan dot indicator dan contrast AA
  - [ ] Upgrade `Input` & `Select`: crisp focus states, unified input heights, integrated icon prefixes

- [ ] **Step 2: Shared Layout, Sidebar & Navbar Redesign**
  - [ ] **Sidebar**:
    - Struktur proporsi baru dengan grouping navigasi (`UTAMA`, `OPERASIONAL`, `FINANSIAL`, `SISTEM`)
    - Redesign business context switcher dengan status badge dan avatar toko bertekstur
    - Nav items dengan active pill elegan (bukan sekadar glow bar), hover tint halus, dan badge notifikasi/status
    - Footer sidebar terstruktur dengan status koneksi, versi, dan indikator multi-tenant
  - [ ] **TopBar / Navbar**:
    - Breadcrumbs kontekstual terintegrasi (`Ringkasan / Dashboard Performa`)
    - Quick Action command trigger / search bar
    - Profile pill dengan tenant switcher dan notification hub
    - Responsive mobile layout dengan transisi drawer mulus
  - [ ] **Mobile Bottom Navigation**:
    - Floating docked bottom bar dengan label micro-typography dan tactile tab switching

- [ ] **Step 3: Redesign Dashboard Finansial (`/dashboard` & `/demo/dashboard`)**
  - [ ] Hero metric banner vs secondary metrics (asymmetric visual hierarchy)
  - [ ] Quick Action Bar (Buka Kasir POS, Restock Barang, Catat Beban, Unduh Laporan)
  - [ ] Redesign SVG Sales Trend Chart dengan baseline horizontal, target bar, dan tooltip finansial
  - [ ] Recent transactions stream dengan status badge rapi, icon pembayaran visual, dan row action
  - [ ] Inventory health alert widget (stok habis & menipis) dengan restock trigger instan

- [ ] **Step 4: Redesign POS Kasir (`/sales/new` & `/demo/sales/new`)**
  - [ ] Split screen 7:5 / 8:4 desktop layout dengan visual balance yang kokoh
  - [ ] Category filter pills dengan icon dan item counter
  - [ ] Product tiles dengan visual status stok (tersedia, menipis, habis), harga terformat tebal, dan quick add button
  - [ ] Cart drawer dengan item list berjenjang, quantity stepper modern (`- 1 +`), diskon per item, quick cash presets (`Uang Pas`, `Rp 50.000`, `Rp 100.000`), dan tombol bayar utama yang commanding

- [ ] **Step 5: Propagasi ke Seluruh Modul (Products, Purchases, Expenses, Reports, Settings)**
  - [ ] Selaraskan filter bar, tabel, modal dialog, dan kartu di modul Produk, Pembelian, Pengeluaran, Laporan, dan Pengaturan

- [ ] **Step 6: Validasi Menyeluruh, Bukti Screenshot AFTER, dan Dokumentasi**
  - [ ] Ambil screenshot AFTER via Playwright pada Desktop 1440px dan Mobile 390px
  - [ ] Bandingkan visual before vs after secara objektif
  - [ ] Jalankan Vitest (`npm test` / `npx vitest run`, 100% PASS)
  - [ ] Jalankan TypeScript check (`tsc --noEmit`, 0 errors)
  - [ ] Jalankan ESLint (`npm run lint`, 0 errors)




