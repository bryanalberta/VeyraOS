# VeyraOS — Preflight Report & Implementation Plan: Stage 3.3
## Next.js Server Actions & Tenant Context Application Layer

**Proyek:** VeyraOS  
**Fase:** Phase 4 — Application & Service Integration Layer  
**Stage:** 3.3 — Next.js Server Actions & Tenant Context Application Layer  
**Status Preflight:** **SELESAI (PREFLIGHT AUDIT COMPLETE — READY FOR REVIEW)**  
**Tanggal:** 14 Oktober 2026  
**Auditor / Arsitek:** Lead Full-Stack Architect & Security Engineer  

---

## 1. Ringkasan Eksekutif & Status Lingkungan

Preflight audit ini dilakukan untuk memverifikasi kontrak, dependensi, aturan otorisasi multi-tenant, manipulasi cookie asinkron, dan penanganan error sebelum penulisan kode pada **Stage 3.3 (Next.js Server Actions & Tenant Context Application Layer)**.

### Batasan Eksekusi yang Ditaati:
- **Kode Aplikasi (`src/`):** Tidak diubah pada tahap preflight ini (**PRISTINE / UNTOUCHED**).
- **Basis Data Live Supabase:** Bersih / Tanpa Mutasi (**PRISTINE / UNMUTATED**).
- **Migrasi SQL:** Tidak ada berkas migrasi baru yang dibuat atau dieksekusi (**NO NEW MIGRATIONS**).
- **UI & Batch Coding:** Belum dimulai (**DEFERRED UNTIL PLAN APPROVAL**).
- **Git Commit:** Tidak ada commit git yang dibuat (**NO COMMITS**).

---

## 2. Signature dan Dependensi Aktual Service Layer

Audit independen terhadap kode aktual pada direktori `src/services/` memastikan signature, parameter, dan nilai kembalian fungsi berikut:

### 2.1 Domain Bisnis & Profil Pengguna (`src/services/business/business.service.ts`)
| Nama Fungsi Service | Parameter Aktual | Return Type Aktual | Keterangan & Aturan Keamanan |
|---|---|---|---|
| `getUserProfile` | `options?: BusinessServiceOptions` | `Promise<ApiResponse<UserProfileResponseData>>` | Membaca profil `profiles` berdasarkan `auth.uid()`. |
| `updateUserProfile` | `input: UpdateProfileInput, options?: BusinessServiceOptions` | `Promise<ApiResponse<UserProfileResponseData>>` | Whitelist ketat: Hanya mengizinkan pembaruan `full_name`. |
| `createBusiness` | `input: CreateBusinessInput, options?: BusinessServiceOptions` | `Promise<ApiResponse<BusinessResponseData>>` | Memvalidasi batas MVP $\le 5$ bisnis (`BUSINESS_LIMIT_REACHED`). Menyematkan `owner_id = auth.uid()` secara server-authoritative. |
| `getMyBusinesses` | `options?: BusinessServiceOptions` | `Promise<ApiResponse<BusinessResponseData[]>>` | Mengambil seluruh bisnis di mana pengguna terdaftar di `business_members` dengan urutan `created_at ASC, id ASC`. |
| `getBusinessById` | `businessId: string, options?: BusinessServiceOptions` | `Promise<ApiResponse<BusinessResponseData>>` | Memverifikasi keanggotaan tenant server-side via `verifyUserAndBusinessMembership`. |
| `updateBusiness` | `id: string, input: UpdateBusinessInput, options?: BusinessServiceOptions` | `Promise<ApiResponse<BusinessResponseData>>` | Hanya mengizinkan pemilik yuridis (`owner_id === auth.uid()`). Menolak mutasi jika bukan pemilik (`FORBIDDEN_NOT_OWNER`). |
| `resolveTenantContext` | `requestedBusinessId?: string, options?: BusinessServiceOptions` | `Promise<ApiResponse<TenantContextResponse>>` | Menangani resolusi tenant server-authoritative (0, 1, dan multi-bisnis). Menerapkan **Anti-Silent Fallback** jika ID tidak sah. |

### 2.2 Domain Transaksi Kasir & Restock (`src/services/transactions/transaction.service.ts`)
| Nama Fungsi Service | Parameter Aktual | Return Type Aktual | Keterangan & Aturan Keamanan |
|---|---|---|---|
| `recordSale` | `input: RecordSaleInput, options?: TransactionServiceOptions` | `Promise<ApiResponse<SaleReceiptResponse>>` | Memvalidasi input Zod, membangkitkan faktur server CSPRNG (`INV-YYYYMMDD-XXXX`), memanggil RPC atomik `record_sale_transaction`. |
| `recordPurchase` | `input: RecordPurchaseInput, options?: TransactionServiceOptions` | `Promise<ApiResponse<PurchaseReceiptResponse>>` | Memvalidasi input Zod, membangkitkan faktur `PO-YYYYMMDD-XXXX`, memanggil RPC atomik `record_purchase_transaction` (rekalkulasi MWAC). |
| `voidSale` | `input: VoidSaleInput, options?: TransactionServiceOptions` | `Promise<ApiResponse<VoidSaleResponse>>` | Memvalidasi alasan pembatalan ($\ge 5$ karakter), memanggil RPC atomik `void_sale_transaction` (pembalikan stok persediaan). |
| `getProductsForTransaction` | `businessId: string, options?: GetProductsForTransactionOptions` | `Promise<ApiResponse<ProductItemResponse[]>>` | Mengambil produk aktif non-arsip untuk katalog kasir POS. |

### 2.3 Domain Master Produk & Persediaan (`src/services/products/product.service.ts`)
| Nama Fungsi Service | Parameter Aktual | Return Type Aktual | Keterangan & Aturan Keamanan |
|---|---|---|---|
| `createProduct` | `input: CreateProductInput, options?: ProductServiceOptions` | `Promise<ApiResponse<ProductItemResponse>>` | Menolak stok awal $> 0$ tanpa RPC mutasi stok (`ATOMIC_INITIAL_STOCK_UNAVAILABLE`). Mengizinkan stok awal $0$. |
| `getProducts` | `query?: GetProductsQuery, options?: ProductServiceOptions` | `Promise<ApiResponse<ProductItemResponse[]>>` | Pencarian nama/SKU, filter kategori, filter low stock, filter status arsip. |
| `getProductById` | `id: string, businessId: string, options?: ProductServiceOptions` | `Promise<ApiResponse<ProductItemResponse>>` | Membaca detail produk dengan isolasi tenant wajib (`business_id`). |
| `updateProduct` | `id: string, input: UpdateProductInput, options?: ProductServiceOptions` | `Promise<ApiResponse<ProductItemResponse>>` | Hanya memperbarui metadata. Mutasi langsung pada `stock_quantity` atau `cost_price` ditolak (`FORBIDDEN_FIELD_MUTATION`). |
| `archiveProduct` | `id: string, businessId: string, options?: ProductServiceOptions` | `Promise<ApiResponse<ProductItemResponse>>` | Soft-delete (`is_archived = true`). Menolak hard-delete destruktif. |

### 2.4 Domain Pengeluaran Operasional (`src/services/expenses/expense.service.ts`)
| Nama Fungsi Service | Parameter Aktual | Return Type Aktual | Keterangan & Aturan Keamanan |
|---|---|---|---|
| `recordExpense` | `input: RecordExpenseInput, options?: ExpenseServiceOptions` | `Promise<ApiResponse<ExpenseResponseData>>` | Mencatat beban operasional integer Rupiah non-negatif dengan kategori baku. |
| `getExpenses` | `query?: GetExpensesQuery, options?: ExpenseServiceOptions` | `Promise<ApiResponse<ExpenseResponseData[]>>` | Query riwayat pengeluaran dengan filter tanggal dan kategori. |
| `getExpenseById` | `id: string, businessId: string, options?: ExpenseServiceOptions` | `Promise<ApiResponse<ExpenseResponseData>>` | Membaca detail satu pengeluaran per tenant. |
| `updateExpense` | `id: string, input: UpdateExpenseInput, options?: ExpenseServiceOptions` | `Promise<ApiResponse<ExpenseResponseData>>` | Memperbarui nominal, kategori, tanggal, atau deskripsi beban. |
| `deleteExpense` | `id: string, businessId: string, options?: ExpenseServiceOptions` | `Promise<ApiResponse<ExpenseResponseData>>` | Menolak penghapusan fisik demi integritas laporan laba rugi (`DESTRUCTIVE_DELETION_FORBIDDEN`). |

### 2.5 Domain Laporan & Analitik Finansial (`src/services/reports/report.service.ts`)
| Nama Fungsi Service | Parameter Aktual | Return Type Aktual | Keterangan & Aturan Keamanan |
|---|---|---|---|
| `getDashboardSummary` | `businessId: string, params?: DashboardQueryParams, options?: ReportServiceOptions` | `Promise<ApiResponse<DashboardSummaryResponseData>>` | Agregasi KPI 6 kartu, tren harian Jakarta WIB, 5 transaksi terbaru, low stock alerts. |
| `getSalesReport` | `businessId: string, query?: GetSalesReportQuery, options?: ReportServiceOptions` | `Promise<ApiResponse<SalesReportResponseData>>` | Laporan omzet penjualan dengan paginasi eksplisit dan ringkasan summary. |
| `getExpenseReport` | `businessId: string, query?: GetExpenseReportQuery, options?: ReportServiceOptions` | `Promise<ApiResponse<ExpenseReportResponseData>>` | Laporan beban operasional teragregasi per kategori dan persentase. |
| `getStockReport` | `businessId: string, query?: GetStockReportQuery, options?: ReportServiceOptions` | `Promise<ApiResponse<StockReportResponseData>>` | Laporan persediaan, valuasi modal (MWAC), dan potensi omzet. |
| `exportReportCsv` | `businessId: string, input: ExportReportInput, options?: ReportServiceOptions` | `Promise<ApiResponse<ReportCsvResult>>` | Ekspor CSV RFC 4180 dengan UTF-8 BOM dan sanitasi CWE-1236 Formula Injection. |

---

## 3. Desain Kontrak Input/Output Server Actions (`src/app/actions/`)

Seluruh Server Actions ditempatkan pada direktori `src/app/actions/`, menggunakan direktif `"use server"` di baris paling atas, menerima payload bertipe, dan selalu mengembalikan amplop terpadu `ApiResponse<T>`.

### 3.1 Berkas `src/app/actions/auth.ts` (Batch 1 Scope)
```typescript
"use server";

import type { ApiResponse, AuthResponseData, UserProfileResponseData, UpdateProfileInput } from "@/types/api";
import type { SignUpFormValues, SignInFormValues } from "@/lib/validations/auth";

export async function signUpAction(input: SignUpFormValues): Promise<ApiResponse<AuthResponseData>>;
export async function signInAction(input: SignInFormValues): Promise<ApiResponse<AuthResponseData>>;
export async function signOutAction(): Promise<ApiResponse<{ message: string }>>;
export async function updateUserProfileAction(input: UpdateProfileInput): Promise<ApiResponse<UserProfileResponseData>>;
```

### 3.2 Berkas `src/app/actions/business.ts` (Batch 1 Scope)
```typescript
"use server";

import type { ApiResponse, BusinessResponseData, TenantContextResponse, CreateBusinessInput } from "@/types/api";

export async function createBusinessAction(input: CreateBusinessInput): Promise<ApiResponse<BusinessResponseData>>;
export async function switchActiveBusinessAction(businessId: string): Promise<ApiResponse<{ activeBusinessId: string }>>;
export async function getActiveTenantContextAction(): Promise<ApiResponse<TenantContextResponse>>;
```
*(Catatan: Aksi query tambahan seperti `getMyBusinessesAction`, `getBusinessByIdAction`, dan `updateBusinessAction` ditangguhkan ke integrasi UI/tahap lanjutan sesuai otorisasi reviewer).*

### 3.3 Berkas `src/app/actions/transactions.ts`
```typescript
"use server";

import type { ApiResponse, RecordSaleInput, SaleReceiptResponse, RecordPurchaseInput, PurchaseReceiptResponse, VoidSaleInput, VoidSaleResponse, ProductItemResponse } from "@/types/api";

export async function createSaleAction(input: Omit<RecordSaleInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<SaleReceiptResponse>>;
export async function recordPurchaseAction(input: Omit<RecordPurchaseInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<PurchaseReceiptResponse>>;
export async function voidSaleAction(input: Omit<VoidSaleInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<VoidSaleResponse>>;
export async function getProductsForTransactionAction(businessId?: string): Promise<ApiResponse<ProductItemResponse[]>>;
```

### 3.4 Berkas `src/app/actions/products.ts`
```typescript
"use server";

import type { ApiResponse, CreateProductInput, UpdateProductInput, GetProductsQuery, ProductItemResponse } from "@/types/api";

export async function createProductAction(input: Omit<CreateProductInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<ProductItemResponse>>;
export async function getProductsAction(query?: Omit<GetProductsQuery, "businessId"> & { businessId?: string }): Promise<ApiResponse<ProductItemResponse[]>>;
export async function getProductByIdAction(id: string, businessId?: string): Promise<ApiResponse<ProductItemResponse>>;
export async function updateProductAction(id: string, input: Omit<UpdateProductInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<ProductItemResponse>>;
export async function archiveProductAction(id: string, businessId?: string): Promise<ApiResponse<ProductItemResponse>>;
```

### 3.5 Berkas `src/app/actions/expenses.ts`
```typescript
"use server";

import type { ApiResponse, RecordExpenseInput, UpdateExpenseInput, GetExpensesQuery, ExpenseResponseData } from "@/types/api";

export async function recordExpenseAction(input: Omit<RecordExpenseInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<ExpenseResponseData>>;
export async function getExpensesAction(query?: Omit<GetExpensesQuery, "businessId"> & { businessId?: string }): Promise<ApiResponse<ExpenseResponseData[]>>;
export async function getExpenseByIdAction(id: string, businessId?: string): Promise<ApiResponse<ExpenseResponseData>>;
export async function updateExpenseAction(id: string, input: Omit<UpdateExpenseInput, "businessId"> & { businessId?: string }): Promise<ApiResponse<ExpenseResponseData>>;
export async function deleteExpenseAction(id: string, businessId?: string): Promise<ApiResponse<ExpenseResponseData>>;
```

### 3.6 Berkas `src/app/actions/reports.ts`
```typescript
"use server";

import type { ApiResponse, DashboardQueryParams, DashboardSummaryResponseData, GetSalesReportQuery, SalesReportResponseData, GetExpenseReportQuery, ExpenseReportResponseData, GetStockReportQuery, StockReportResponseData, ExportReportInput, ReportCsvResult } from "@/types/api";

export async function getDashboardSummaryAction(params?: DashboardQueryParams, businessId?: string): Promise<ApiResponse<DashboardSummaryResponseData>>;
export async function getSalesReportAction(query?: GetSalesReportQuery, businessId?: string): Promise<ApiResponse<SalesReportResponseData>>;
export async function getExpenseReportAction(query?: GetExpenseReportQuery, businessId?: string): Promise<ApiResponse<ExpenseReportResponseData>>;
export async function getStockReportAction(query?: GetStockReportQuery, businessId?: string): Promise<ApiResponse<StockReportResponseData>>;
export async function exportReportCsvAction(input: ExportReportInput, businessId?: string): Promise<ApiResponse<ReportCsvResult>>;
```

---

## 4. Keputusan Arsitektur Konteks Tenant & Kebijakan Cookie

### 4.1 Spesifikasi Cookie Konteks Tenant
- **Nama Cookie:** `veyra_active_business_id`.
- **Karakter:** Menyimpan string UUID dari bisnis yang dipilih aktif oleh pengguna.
- **Konfigurasi Flags:**
  ```typescript
  const TENANT_COOKIE_NAME = "veyra_active_business_id";
  const TENANT_COOKIE_OPTIONS = {
    httpOnly: true,                                      // Kebal dari pembacaan script XSS di browser
    secure: process.env.NODE_ENV === "production",       // HTTPS pada produksi, mengizinkan HTTP di localhost dev
    sameSite: "lax" as const,                            // Perlindungan CSRF navigasi lintas situs
    path: "/",                                           // Berlaku di seluruh rute aplikasi
    maxAge: 60 * 60 * 24 * 30,                           // 30 hari masa berlaku preferensi
  };
  ```

### 4.2 Prinsip Ketat Anti-Silent Fallback & Pengelolaan Cookie (Reviewer Decided)
1. **Cookie Bukan Bukti Otorisasi:**  
   Cookie hanya mencatat preferensi klien. Server Actions wajib membaca cookie di server dan memvalidasi keanggotaan pengguna di server menggunakan `resolveTenantContext(cookieValue)` atau `verifyUserAndBusinessMembership`. Cookie tidak menggantikan pemeriksaan otorisasi service layer.
2. **Pembedaan Tegas Jenis Kegagalan:**  
   Sistem membedakan secara tegas:
   - Kegagalan autentikasi sesi (`UNAUTHENTICATED`),
   - Tenant tidak diizinkan / bukan anggota (`UNAUTHORIZED_BUSINESS`),
   - Validasi input payload / format UUID (`VALIDATION_ERROR`),
   - Kegagalan infrastruktur / database (`DATABASE_ERROR` atau `INTERNAL_ERROR`).  
   *Dilarang keras mengubah error database atau error tak terduga menjadi `UNAUTHORIZED_BUSINESS`.*
3. **Penolakan Cookie Tidak Sah & Pembersihan Aman:**  
   Jika cookie berisi UUID yang tidak valid, format salah, atau menunjuk bisnis di mana pengguna bukan anggota:
   - Server Actions **DILARANG MENGALIHKAN SECARA DIAM-DIAM (SILENT FALLBACK)** ke bisnis lain untuk operasi yang sedang diminta.
   - Permintaan langsung ditolak dengan kode error `UNAUTHORIZED_BUSINESS`.
   - Cookie yang terbukti rusak/tidak sah tersebut dibersihkan dari browser (`cookieStore.delete(TENANT_COOKIE_NAME)`).
4. **Pemasangan Cookie Pasca-Pembuatan Bisnis:**  
   - Setelah `createBusinessAction` berhasil membuat bisnis baru, bisnis yang baru dibuat tersebut otomatis ditetapkan sebagai tenant aktif (`cookieStore.set(TENANT_COOKIE_NAME, newBusiness.id, TENANT_COOKIE_OPTIONS)`).
   - Jika pembuatan bisnis gagal (misal validasi error, kuota 5 bisnis tercapai, atau error database), **cookie sama sekali tidak dipasang atau diubah**.
5. **Validasi Akses pada Switch Business:**  
   - Pada `switchActiveBusinessAction(businessId)`, sistem wajib memvalidasi hak akses keanggotaan pengguna pada `businessId` tersebut di server sebelum memasang cookie. Jika tidak sah, tolak dengan `UNAUTHORIZED_BUSINESS` tanpa mengubah cookie.
6. **Penanganan Kegagalan Akses Cookies:**  
   - Kegagalan asinkron `cookies()` atau kegagalan penulisan cookie ditangani secara aman dan tidak menghasilkan respons sukses palsu (*false success*).

---

## 5. Matriks Error & Tanggung Jawab Lapis Otorisasi

```
+------------------------------------------------------------------------------------------+
| Lapisan 1: Server Action Gateway (Next.js App Server)                                    |
| 1. Periksa sesi Supabase Auth via await cookies() -> UNAUTHENTICATED                     |
| 2. Validasi input via Zod safeParse -> VALIDATION_ERROR (beserta details per-field)      |
| 3. Resolusi cookie konteks veyra_active_business_id -> UNAUTHORIZED_BUSINESS             |
+------------------------------------------------------------------------------------------+
                                             │
                                             ▼
+------------------------------------------------------------------------------------------+
| Lapisan 2: Service Layer (Pure Business Logic)                                           |
| 1. Defense-in-depth: verifyUserAndBusinessMembership -> UNAUTHORIZED_BUSINESS           |
| 2. Validasi aturan bisnis domain: Kuota bisnis -> BUSINESS_LIMIT_REACHED                 |
|    Integritas mutasi field -> FORBIDDEN_FIELD_MUTATION / DESTRUCTIVE_DELETION_FORBIDDEN  |
|    Validasi batas volume -> DATA_VOLUME_EXCEEDED                                         |
+------------------------------------------------------------------------------------------+
                                             │
                                             ▼
+------------------------------------------------------------------------------------------+
| Lapisan 3: PostgreSQL Kernel & Stored Procedure (Database Server)                        |
| 1. Row Level Security Engine: is_business_member() -> 0 baris / Permission Denied        |
| 2. Stored Function Exceptions: STOCK_INSUFFICIENT, PRODUCT_NOT_FOUND, SALE_ALREADY_VOIDED |
| 3. Unique Constraints: 23505 uq_idempotency_key                                          |
+------------------------------------------------------------------------------------------+
```

### Pemetaan Kode Error Terpadu:
| Kode Error | Kategori | HTTP/Status Semantik | Pesan Ramah Pengguna |
|---|---|---|---|
| `UNAUTHENTICATED` | Auth | 401 Unauthorized | Sesi login Anda telah berakhir atau belum terautentikasi. Silakan masuk kembali. |
| `UNAUTHORIZED_BUSINESS` | Authz | 403 Forbidden | Anda tidak memiliki hak akses atau keanggotaan pada bisnis ini. |
| `FORBIDDEN_NOT_OWNER` | Authz | 403 Forbidden | Operasi ini hanya dapat dilakukan oleh pemilik bisnis. |
| `VALIDATION_ERROR` | Input | 400 Bad Request | Data yang dikirimkan tidak valid atau tidak memenuhi kriteria. |
| `NOT_FOUND` | Data | 404 Not Found | Data yang diminta tidak ditemukan dalam bisnis ini. |
| `BUSINESS_LIMIT_REACHED` | Kuota | 400 Bad Request | Batas maksimal bisnis untuk akun MVP telah tercapai (maksimal 5 bisnis). |
| `STOCK_INSUFFICIENT` | Bisnis | 400 Bad Request | Stok produk tidak mencukupi untuk transaksi ini. |
| `SALE_ALREADY_VOIDED` | Bisnis | 400 Bad Request | Transaksi penjualan ini sudah pernah dibatalkan sebelumnya. |
| `FORBIDDEN_FIELD_MUTATION` | Integritas | 400 Bad Request | Perubahan langsung pada stok atau HPP produk tidak diizinkan. |
| `DESTRUCTIVE_DELETION_FORBIDDEN` | Integritas | 400 Bad Request | Penghapusan fisik catatan pengeluaran historis dilarang demi jejak audit. |
| `DATA_VOLUME_EXCEEDED` | Volume | 400 Bad Request | Data transaksi melebihi kapasitas in-memory. Silakan persempit rentang tanggal. |
| `INTERNAL_ERROR` | Sistem | 500 Server Error | Terjadi kesalahan sistem yang tidak terduga. Silakan coba beberapa saat lagi. |

---

## 6. Rencana Pengujian Unit Mock (Stage 3.3)

Pengujian Server Actions menggunakan Vitest dengan mocking terisolasi pada `next/headers` (`cookies()`) dan `createClient` dari `@/lib/supabase/server`.

### 6.1 Matriks Skenario Uji (Target: 30 Skenario Uji)
1. **Kelompok 1: Autentikasi & Profil Pengguna (6 Skenario)**
   - 1.1 `signUpAction` menolak input Zod tidak valid (email salah format, password $< 8$ karakter).
   - 1.2 `signUpAction` berhasil mendaftarkan akun baru dan mengembalikan `AuthResponseData`.
   - 1.3 `signInAction` menolak kredensial yang salah dari Supabase Auth (`AUTH_INVALID_CREDENTIALS`).
   - 1.4 `signInAction` berhasil mengautentikasi dan mengembalikan sesi.
   - 1.5 `signOutAction` berhasil memanggil penghancuran sesi.
   - 1.6 `updateUserProfileAction` memperbarui nama lengkap dan menolak perubahan jika unauthenticated.
2. **Kelompok 2: Bisnis & Tenant Context Cookie (8 Skenario)**
   - 2.1 `createBusinessAction` berhasil membuat bisnis baru dan **otomatis memasang cookie** `veyra_active_business_id`.
   - 2.2 `createBusinessAction` menolak jika kuota 5 bisnis tercapai (`BUSINESS_LIMIT_REACHED`) dan **tidak memasang cookie**.
   - 2.3 `switchActiveBusinessAction` memvalidasi hak keanggotaan dan memperbarui cookie tenant.
   - 2.4 `switchActiveBusinessAction` **menolak ID bisnis yang tidak sah** (`UNAUTHORIZED_BUSINESS`) tanpa mengubah cookie.
   - 2.5 `getActiveTenantContextAction` membaca konteks dari cookie valid secara server-authoritative.
   - 2.6 `getActiveTenantContextAction` **menolak cookie yang dimanipulasi/rusak** (`UNAUTHORIZED_BUSINESS`) dan membersihkan cookie.
   - 2.7 `getActiveTenantContextAction` menangani empty state (pengguna dengan 0 bisnis).
   - 2.8 `createBusinessAction` & `switchActiveBusinessAction` menangani kegagalan penulisan cookie secara aman tanpa false success.
3. **Kelompok 3: Transaksi Kasir POS & Restock (6 Skenario)**
   - 3.1 `createSaleAction` menolak input keranjang kosong atau diskon invalid.
   - 3.2 `createSaleAction` mengeksekusi penjualan sukses dengan faktur server CSPRNG.
   - 3.3 `createSaleAction` memetakan error `STOCK_INSUFFICIENT` dari RPC secara aman.
   - 3.4 `recordPurchaseAction` berhasil mencatat restock persediaan dan faktur PO.
   - 3.5 `voidSaleAction` menolak alasan void $< 5$ karakter.
   - 3.6 `voidSaleAction` mengeksekusi pembatalan transaksi sukses.
4. **Kelompok 4: Produk & Pengeluaran (6 Skenario)**
   - 4.1 `createProductAction` menolak stok awal $> 0$ (`ATOMIC_INITIAL_STOCK_UNAVAILABLE`).
   - 4.2 `updateProductAction` menolak mutasi langsung pada `stockQuantity` (`FORBIDDEN_FIELD_MUTATION`).
   - 4.3 `archiveProductAction` berhasil melakukan soft-delete produk.
   - 4.4 `recordExpenseAction` mencatat beban operasional integer Rupiah.
   - 4.5 `deleteExpenseAction` menolak hard-delete (`DESTRUCTIVE_DELETION_FORBIDDEN`).
   - 4.6 `getExpensesAction` menyaring beban berdasarkan rentang tanggal kalender.
5. **Kelompok 5: Laporan & Ekspor CSV (4 Skenario)**
   - 5.1 `getDashboardSummaryAction` mengembalikan ringkasan 6 kartu metrik presisi.
   - 5.2 `getSalesReportAction` mengembalikan transaksi berpaginasi.
   - 5.3 `getStockReportAction` mengembalikan valuasi modal aset (MWAC).
   - 5.4 `exportReportCsvAction` menghasilkan berkas CSV ber-BOM dengan mitigasi CWE-1236.

---

## 7. Pemisahan Lingkungan Pengujian yang Sah

| Tingkat Pengujian | Lingkungan | Target Verifikasi yang Sah | Batasan (Dilarang Diklaim) |
|---|---|---|---|
| **Level 1: Unit Test (Vitest)** | In-Memory Mock (`src/app/actions/*.test.ts`) | • Validasi skema Zod pada boundary action.<br>• Logika pembacaan & penulisan cookie Next.js.<br>• Pemetaan error ke amplop `ApiResponse<T>`.<br>• Pendelegasian ke service layer. | **Bukan bukti** bahwa stored procedure dieksekusi benar pada engine PostgreSQL fisik. **Bukan bukti** RLS kernel aktif. |
| **Level 2: DB Integration Test** | Supabase Local / Live Sandbox | • Eksekusi PL/pgSQL RPC atomik (`record_sale_transaction`, dll.).<br>• Row-locking concurrency (`ORDER BY id ASC FOR UPDATE`).<br>• Trigger otomatis keanggotaan pemilik. | Memerlukan penyelesaian migrasi 010 & 011 di database target. |
| **Level 3: RLS Penetration Test** | Supabase Live Instance | • Akses lintas tenant (User B membaca data Toko A).<br>• Penolakan query langsung bypass service layer. | Dilakukan pada Tahap 10 Roadmap (QA & Security Audit). |

---

## 8. Daftar Risiko dan Blocker

1. **Nuansa Framework Next.js 15/16 (`await cookies()`):**
   - Di Next.js 16, fungsi `cookies()` bersifat asynchronous (`const cookieStore = await cookies()`).
   - *Mitigasi:* Seluruh helper pembacaan dan penulisan cookie pada Server Actions diwajibkan menggunakan pola `await cookies()`.
2. **Kebijakan `revalidatePath` (Reviewer Decided):**
   - Ditegaskan untuk **tidak menambahkan abstraksi wrapper proteksi** untuk rute yang belum dirender.
   - Panggilan `revalidatePath` hanya dilakukan setelah mutasi terkait berhasil dan hanya untuk rute kanonikal yang relevan.
   - Pada Batch 1, karena halaman UI belum dibangun, invalidasi cache didokumentasikan akan ditambahkan saat UI terkait dibangun di Tahap 3+.
3. **Ketergantungan Terbuka Migrasi Live (010 & 011):**
   - Migrasi alokasi diskon Hamilton dan idempotensi masih berstatus unexecuted di Supabase live.
   - *Keputusan:* Stage 3.3 fokus pada kontrak aplikasi Server Actions menggunakan pengujian unit mock. Eksekusi database live tetap ditahan sesuai batasan preflight.

---

## 9. Rencana Batch Implementasi Terkecil & Acceptance Criteria

Untuk menjaga ketertiban arsitektur dan kepatuhan batasan, pengerjaan Stage 3.3 dipecah menjadi **4 batch kecil**:

### Batch 1: Server Actions Auth & Tenant Context Cookie (AUTHORIZED)
- **Berkas yang dibuat:**
  - `src/app/actions/auth.ts`
  - `src/app/actions/business.ts`
  - `src/app/actions/auth.test.ts`
  - `src/app/actions/business.test.ts`
- **Aksi yang diimplementasikan:**
  - `signUpAction`
  - `signInAction`
  - `signOutAction`
  - `updateUserProfileAction`
  - `createBusinessAction`
  - `switchActiveBusinessAction`
  - `getActiveTenantContextAction`
- **Acceptance Criteria:**
  - 14 skenario uji mock (Kelompok 1 & 2) lulus 100%.
  - Cookie `veyra_active_business_id` tervalidasi dengan proteksi Anti-Silent Fallback.
  - Quality gates: `test`, `type-check`, `lint`, `build` lulus.

### Batch 2: Server Actions Transaksi POS & Persediaan (PENDING REVIEW)
- **Berkas yang dibuat:**
  - `src/app/actions/transactions.ts`
  - `src/app/actions/products.ts`
  - `src/app/actions/transactions.test.ts`
  - `src/app/actions/products.test.ts`
- **Acceptance Criteria:**
  - 10 skenario uji mock (Kelompok 3 & 4a) lulus 100%.
  - Integrasi nomor faktur CSPRNG server-authoritative berjalan mulus.
  - Quality gates: `test`, `type-check`, `lint`, `build` lulus.

### Batch 3: Server Actions Beban Operasional & Analitik/Laporan (PENDING REVIEW)
- **Berkas yang dibuat:**
  - `src/app/actions/expenses.ts`
  - `src/app/actions/reports.ts`
  - `src/app/actions/expenses.test.ts`
  - `src/app/actions/reports.test.ts`
- **Acceptance Criteria:**
  - 6 skenario uji mock (Kelompok 4b & 5) lulus 100%.
  - Format ekspor CSV dan agregasi dashboard terhubung tanpa distorsi.
  - Quality gates: `test`, `type-check`, `lint`, `build` lulus.

### Batch 4: Validation Report & Closure Audit Stage 3.3 (PENDING REVIEW)
- **Dokumen yang dibuat:**
  - `docs/stage-3.3-validation-report.md`
  - `docs/stage-3.3-closure-audit.md`
  - Pembaruan log status `docs/implementation-roadmap.md`.
- **Acceptance Criteria:**
  - Seluruh 30+ unit test Server Actions baru lulus (total tes proyek $\ge 336$ tests).
  - Keputusan closure audit: **STAGE PASS WITH CONDITIONS**.

---

## 10. Status Preflight & Otorisasi Eksekusi

```
================================================================================
                    STATUS PREFLIGHT REPORT STAGE 3.3
================================================================================
  Scope:            Next.js Server Actions & Tenant Context Application Layer
  Status Dokumen:   TERVALIDASI & DISETUJUI REVIEWER
  Status Otorisasi: BATCH 1 RESMI DIOTORISASI
  Fokus Batch 1:    auth.ts, business.ts, dan unit test mock-nya
================================================================================
```

