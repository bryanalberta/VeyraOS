# VeyraOS — Phase 4 Stage 3.0: Integration Preflight Audit Report

**Fase:** Phase 4, Stage 3.0: Integration Preflight Audit  
**Status Audit:** SELESAI (Audit Completed — Ready with Conditions for Stage 3.1)  
**Peran:** Full-Stack Technical Lead, Supabase Database Architect & Security Engineer  
**DBMS Target:** PostgreSQL 15+ (Supabase)  
**Framework:** Next.js 16.4.0 (App Router), React 19.3.0, TypeScript Strict Mode  
**Status Eksekusi Basis Data:** **NOT RUN / UNVERIFIED ON RUNTIME POSTGRESQL (Inspeksi Statis SQL & Uji Unit Vitest Saja — Nol Koneksi Database Live)**  

---

## 1. Ringkasan Kesiapan Integrasi

Audit preflight ini mengevaluasi kesiapan arsitektural sebelum pengerjaan **Stage 3.1 (Service Layer, Server Actions & API Integration)**. Audit memeriksa keselarasan antara migrasi SQL ([`supabase/migrations/`](file:///c:/Antigravity%20Project/VeyraOS/supabase/migrations/)), kontrak antarmuka ([`docs/api-contracts.md`](file:///c:/Antigravity%20Project/VeyraOS/docs/api-contracts.md)), logika finansial ([`src/lib/financial.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/financial.ts)), mesin otorisasi Layer 2 ([`src/lib/security.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/security.ts)), dan simulasi domain ([`src/lib/transactions.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/transactions.ts)).

### Kesimpulan Awal:
Skema database 9 migrasi telah menyediakan fondasi yang sangat kokoh untuk Stage 3. Namun, implementasi Service Layer membutuhkan penyelesaian kondisi teknis (instalasi SDK `@supabase/supabase-js`, pembuatan Supabase client adapter SSR, dan konversi format penamaan payload).

---

## 2. Matriks Kontrak RPC vs TypeScript (Contract Binding Matrix)

| Nama RPC / Operasi | Parameter RPC (Migration 009) | Request Payload TypeScript (`docs/api-contracts.md`) | Return Value RPC (SQL JSONB) | Response DTO TypeScript (`api-contracts.md`) | Catatan Pemetaan & Konversi di Server Action |
|---|---|---|---|---|---|
| **`record_sale_transaction`** | `p_business_id UUID`<br>`p_invoice_number TEXT`<br>`p_payment_method TEXT`<br>`p_discount_amount BIGINT`<br>`p_notes TEXT`<br>`p_items JSONB`<br>`p_idempotency_key TEXT` | `businessId: string`<br>`idempotencyKey: string`<br>`paymentMethod: 'CASH' \| 'BANK_TRANSFER'`<br>`transactionDiscount?: number`<br>`notes?: string`<br>`items: Array<{ productId, quantity, itemDiscount }>` | `sale_id`<br>`invoice_number`<br>`subtotal_amount`<br>`discount_amount`<br>`total_amount`<br>`payment_method`<br>`transaction_date`<br>`items_count` | `saleId: string`<br>`invoiceNumber: string`<br>`subtotalAmount: number`<br>`discountAmount: number`<br>`totalAmount: number`<br>`paymentMethod: string`<br>`transactionDate: string`<br>`itemsCount: number` | • Server Action **wajib membangkitkan `p_invoice_number`** (e.g. `INV-YYYYMMDD-XXXX`) sebelum memanggil RPC.<br>• `transactionDiscount` di-map ke `p_discount_amount`.<br>• Respon snake_case di-map ke camelCase `SaleReceiptResponse`. |
| **`record_purchase_transaction`** | `p_business_id UUID`<br>`p_invoice_number TEXT`<br>`p_supplier_name TEXT`<br>`p_notes TEXT`<br>`p_items JSONB`<br>`p_idempotency_key TEXT` | `businessId: string`<br>`supplierName?: string`<br>`notes?: string`<br>`items: Array<{ productId, quantity, unitPurchaseCost }>`<br>`(idempotencyKey?: string)` | `purchase_id`<br>`invoice_number`<br>`total_cost`<br>`purchase_date`<br>`items_count` | `purchaseId: string`<br>`invoiceNumber: string`<br>`totalCost: number`<br>`purchaseDate: string` | • Server Action membangkitkan `p_invoice_number` (e.g. `PO-YYYYMMDD-XXXX`).<br>• Respon `purchase_id`, `total_cost`, `purchase_date` di-map ke camelCase. |
| **`void_sale_transaction`** | `p_business_id UUID`<br>`p_sale_id UUID`<br>`p_void_reason TEXT`<br>`p_idempotency_key TEXT` | `businessId: string`<br>`saleId: string`<br>`voidReason: string` | `sale_id`<br>`status: 'VOIDED'`<br>`voided_at` | `saleId: string`<br>`status: 'VOIDED'`<br>`voidedAt: string` | • Validasi minimal 5 karakter `voidReason` dilakukan di Server Action sebelum panggil RPC.<br>• Map `sale_id` dan `voided_at` ke camelCase. |

---

## 3. Matriks Temuan Audit Preflight (P0, P1, P2)

| ID | Prioritas | Area Audit | File & Lokasi Terkait | Deskripsi Masalah & Dampak | Rekomendasi Solusi untuk Stage 3.1 |
|---|:---:|---|---|---|---|
| **INT-P0-01** | **P0** | **Dependencies** | [`package.json`](file:///c:/Antigravity%20Project/VeyraOS/package.json) (baris 13–19) | **SDK Supabase Belum Terinstal:** Package `@supabase/supabase-js` dan `@supabase/ssr` belum ada di `dependencies`. Tanpa kedua package ini, Server Actions Next.js tidak dapat menginisialisasi koneksi RPC atau menangani session cookies. | Minta persetujuan instalasi package: `npm install @supabase/supabase-js @supabase/ssr` di awal Stage 3.1. |
| **INT-P0-02** | **P0** | **Generasi Faktur** | `docs/api-contracts.md` (baris 108) vs Migrasi 009 (baris 30) | **Ketiadaan `invoiceNumber` pada Input Request Kasir:** Klien kasir tidak mengirim nomor nota karena nomor nota dibangkitkan sistem. Namun, RPC `record_sale_transaction` mewajibkan parameter `p_invoice_number` minimal 3 karakter. | Server Action bertanggung jawab membangkitkan string nomor faktur acak deterministik (format `INV-YYYYMMDD-XXXX` untuk penjualan, `PO-YYYYMMDD-XXXX` untuk pembelian) sebelum meneruskannya ke RPC. |
| **INT-P0-03** | **P0** | **Karakter Modul** | [`src/lib/transactions.ts`](file:///c:/Antigravity%20Project/VeyraOS/src/lib/transactions.ts) | **Klarifikasi Batasan `transactions.ts`:** Modul `transactions.ts` adalah mesin simulasi in-memory untuk validasi domain TypeScript dan pengujian unit, **bukan** integrasi database riil. Memanggil fungsi ini tidak memutasi database Supabase. | Pada Stage 3.1, buat modul terpisah di `src/services/` yang secara nyata memanggil `supabase.rpc()` menggunakan klien `@supabase/ssr`. Pertahankan `transactions.ts` untuk adapter Mode Demo offline. |
| **INT-P1-01** | **P1** | **Framework Nuance** | Next.js 16.4.0 & [`package.json`](file:///c:/Antigravity%20Project/VeyraOS/package.json) | **Next.js 15/16 Async Cookies API:** Pada Next.js 16, fungsi `cookies()` adalah asynchronous (`await cookies()`). Kode client helper Supabase Server Component / Server Action wajib meng-await pembacaan cookie. | Implementasikan Supabase SSR client menggunakan pola: `const cookieStore = await cookies(); createServerClient(..., { cookies: { getAll, setAll } })`. |
| **INT-P1-02** | **P1** | **Environment Handling** | [`.env.example`](file:///c:/Antigravity%20Project/VeyraOS/.env.example) | **Penanganan Variabel Lingkungan Kosong saat Build:** Belum ada file `.env.local` dan repositori hanya memiliki placeholder `.env.example`. Next.js build dapat gagal jika inisialisasi client Supabase dijalankan saat runtime build statis tanpa environment variables. | Buat helper client yang memvalidasi keberadaan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dengan fallback aman agar tidak merusak proses `next build` pada pipeline CI/CD. |
| **INT-P1-03** | **P1** | **Idempotensi Concurrency** | Migrasi 009 vs Server Action | **Penanganan Error Unik Idempotency Key:** Jika dua request kasir simultan dengan kunci yang sama lolos race condition ke database, transaksi kedua akan melempar error constraint unik `uq_idempotency_key`. | Server Action harus menangkap error `uq_idempotency_key`, melakukan query lookup ke `idempotency_keys`, dan mengembalikan respon tersimpan secara mulus ke kasir tanpa menampilkan error 500. |
| **INT-P2-01** | **P2** | **Mapping DTO** | `docs/api-contracts.md` | **Konsistensi Format Respon Terpadu:** Seluruh Server Action harus mengembalikan format `ApiResponse<T>`: `{ success: true, data }` atau `{ success: false, error: { code, message } }`. | Bungkus seluruh eksekusi RPC di dalam blok `try-catch` terstandarisasi yang menerjemahkan kode exception PL/pgSQL (`UNAUTHORIZED_BUSINESS`, `STOCK_INSUFFICIENT`, dll.) menjadi error code API yang ramah pengguna. |

---

## 4. Status Konfigurasi Environment & Supabase

### 4.1 Variabel Lingkungan
- [`.env.example`](file:///c:/Antigravity%20Project/VeyraOS/.env.example) terverifikasi memuat placeholder publik:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL`
- **Keamanan Kunci Rahasia:** `SUPABASE_SERVICE_ROLE_KEY` terbukti **TIDAK ADA** di `.env.example` dan tidak terekspos di kode klien apa pun.

### 4.2 Ketersediaan Tool & Runtime Basis Data
- Pengecekan CLI lokal: `psql`, `supabase`, `docker` $\rightarrow$ **NOT AVAILABLE**.
- Status pengujian database PostgreSQL: **NOT RUN / UNVERIFIED**.

---

## 5. Hasil Validasi Aktual & Batasannya

Pengujian dijalankan pada workspace saat ini:

```bash
npm run test        # Exit Code: 0 (55 passed: 35 security + 11 transactions + 9 financial)
npm run type-check   # Exit Code: 0 (0 compilation errors)
npm run lint         # Exit Code: 0 (0 warnings, 0 errors)
git status           # Exit Code: 0 (Clean, 0 tracked files modified)
```

### Batasan Pengujian:
1. **55 Uji Vitest:** Membuktikan kebenaran formula matematika Rupiah, logika alokasi diskon *Largest Remainder*, kalkulasi MWAC, dan aturan otorisasi Layer 2 TypeScript.
2. **Pengujian Kernel Database:** Belum ada pengujian runtime yang dieksekusi terhadap mesin PostgreSQL asli. Status kernel database tetap diberi label **NOT RUN**.

---

## 6. Daftar Tindakan yang Diperlukan Sebelum/Pada Stage 3.1

1. **Instalasi Paket SDK Resmi:**
   Menjalankan `npm install @supabase/supabase-js @supabase/ssr` setelah mendapatkan persetujuan eksplisit.
2. **Arsitektur Supabase Client (`src/lib/supabase/`):**
   - `client.ts`: Browser client via `createBrowserClient`.
   - `server.ts`: Server client via `createServerClient` dengan `await cookies()`.
   - `middleware.ts`: Sesi auth token refresher.
3. **Pembangkitan Nomor Faktur Deterministik:**
   Membuat utilitas helper generator faktur di `src/lib/invoice.ts` (`INV-YYYYMMDD-XXXX` dan `PO-YYYYMMDD-XXXX`).
4. **Pembuatan Service Layer (`src/services/`):**
   - `sales.service.ts` $\rightarrow$ memanggil RPC `record_sale_transaction`.
   - `purchases.service.ts` $\rightarrow$ memanggil RPC `record_purchase_transaction`.
   - `void.service.ts` $\rightarrow$ memanggil RPC `void_sale_transaction`.
   - `products.service.ts`, `expenses.service.ts`, `businesses.service.ts` $\rightarrow$ memanggil PostgREST query dengan RLS aktif.

---

## 7. Keputusan Kesiapan (Readiness Decision)

> ### **KEPUTUSAN KELAYAKAN: READY WITH CONDITIONS**
> Seluruh skema database 9 migrasi, aturan bisnis, dan invarian finansial telah 100% konsisten. Implementasi Stage 3.1 dapat dimulai segera setelah kondisi berikut disetujui:
> 1. Memberikan izin instalasi paket `@supabase/supabase-js` dan `@supabase/ssr`.
> 2. Menyetujui strategi penanganan invoice generator dan pemetaan DTO (snake_case $\rightarrow$ camelCase) pada Server Actions.
> 
> **Pemberhentian Eksekusi:** Pengerjaan berhenti di sini sesuai batasan audit Stage 3.0. Menunggu persetujuan eksplisit Anda sebelum melanjutkan ke **Phase 4, Stage 3.1: Service Layer, Server Actions & Supabase Integration**.
