# VeyraOS --- Service Layer & API Contracts Specification

**Versi:** 1.0  
**Status:** Usulan Desain Kontrak (Phase 3 API Baseline - UNEXECUTED PROPOSAL)  
**Produk:** VeyraOS  
**Protokol:** Next.js Server Actions (Type-safe RPC) & Route Handlers  
**Format Respon Terpadu:**
```typescript
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: Record<string, string[]> } };
```

---

## 1. Modul Autentikasi & Pengguna

### 1.1 `signUp(input)`
- **Request Payload:**
  ```typescript
  export interface SignUpRequest {
    fullName: string; // min 2 chars
    email: string;    // valid email
    password: string; // min 8 chars
  }
  ```
- **Response:**
  ```typescript
  export interface AuthResponseData {
    userId: string;
    email: string;
    fullName: string;
  }
  ```
- **Otorisasi:** Terbuka untuk umum (Public).
- **Error Codes:** `AUTH_EMAIL_EXISTS`, `VALIDATION_FAILED`, `AUTH_RATE_LIMITED`.

### 1.2 `signIn(input)` & `signOut()`
- **Request Payload:** `{ email: string, password: string }`
- **Response:** `{ session: { user: AuthResponseData, expiresAt: string } }`
- **Error Codes:** `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`.

---

## 2. Modul Manajemen Bisnis & Switcher

### 2.1 `createBusiness(input)`
- **Request Payload:**
  ```typescript
  export interface CreateBusinessRequest {
    name: string;      // 2 - 60 chars
    category?: string; // Sembako, Kuliner, Fashion, dll.
    phone?: string;    // Nomor telepon Indonesia opsional
    address?: string;
  }
  ```
- **Response:**
  ```typescript
  export interface BusinessResponseData {
    id: string;
    name: string;
    category: string | null;
    currencyCode: 'IDR';
    timezone: 'Asia/Jakarta';
    createdAt: string;
  }
  ```
- **Otorisasi:** Membutuhkan sesi login valid (`auth.uid()`).
- **Batasan Bisnis:** Maksimal 5 bisnis per akun pada MVP. Jika `COUNT(*) >= 5`, kembalikan `BUSINESS_LIMIT_REACHED`.

### 2.2 `getMyBusinesses()`
- **Response:** `Array<BusinessResponseData>`
- **Otorisasi:** Menampilkan seluruh bisnis di mana `user_id = auth.uid()` terdaftar di `business_members`.

---

## 3. Modul Produk & Persediaan

### 3.1 `createProduct(input)`
- **Request Payload:**
  ```typescript
  export interface CreateProductRequest {
    businessId: string;
    name: string;
    sku?: string;
    category?: string;
    sellingPrice: number;    // Integer IDR > 0
    costPrice: number;       // Integer IDR >= 0 (Moving average initial cost)
    initialStock: number;    // Integer >= 0
    minStockAlert?: number;  // Default 5
  }
  ```
- **Response:** `ProductItemResponse`
- **Otorisasi:** Anggota bisnis pemilik.
- **Transaksi Basis Data:** Menyimpan produk baru dan jika `initialStock > 0`, otomatis membuat baris pada `stock_movements` (`type: 'INITIAL'`).

### 3.2 `getProducts(params)`
- **Request Query:** `{ businessId: string; query?: string; lowStockOnly?: boolean; isArchived?: boolean }`
- **Response:** `Array<ProductItemResponse>`

---

## 4. Modul Transaksi Penjualan (Sales POS)

### 4.1 `recordSale(input)`
- **Request Payload:**
  ```typescript
  export interface RecordSaleRequest {
    businessId: string;
    idempotencyKey: string; // UUID klien untuk mencegah double-submit saat koneksi lambat
    transactionDate?: string; // ISO 8601, default waktu server sekarang
    items: Array<{
      productId: string;
      quantity: number; // Integer > 0
      itemDiscount?: number; // Integer IDR >= 0
    }>;
    transactionDiscount?: number; // Integer IDR >= 0
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    notes?: string;
  }
  ```
- **Response:**
  ```typescript
  export interface SaleReceiptResponse {
    saleId: string;
    invoiceNumber: string; // e.g. "INV-20261013-0001"
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    transactionDate: string;
    itemsCount: number;
  }
  ```
- **Mekanisme Eksekusi & Idempotensi (PostgreSQL RPC):**
  - Next.js Server Action memanggil stored procedure tunggal `supabase.rpc('record_sale_transaction', payload)`.
  - Stored procedure melakukan verifikasi otorisasi tenant `is_business_member(business_id)`.
  - Melakukan penguncian baris produk deterministik secara strictly ascending: `ORDER BY id ASC FOR UPDATE` guna mencegah deadlock konkurensi.
  - Mengalokasikan diskon transaksi ke baris item (`sale_items`) secara proporsional menggunakan *Largest Remainder Method* (selisih pembulatan ditanggung oleh item bersubtotal terbesar).
  - Snapshot harga jual dan moving average HPP disimpan permanen pada `sale_items` dengan composite foreign key `(business_id, product_id)`.
  - Klien mengirim `idempotencyKey` yang divalidasi pada cache sesi untuk mencegah *double submit* akibat klik ganda pada jaringan seluler 3G/4G lambat.
- **Error Codes:** `STOCK_INSUFFICIENT`, `PRODUCT_NOT_FOUND`, `INVALID_DISCOUNT`, `UNAUTHORIZED_BUSINESS`, `EMPTY_SALE_ITEMS`.

### 4.2 `voidSale(input)` (Pembatalan Total Transaksi)
- **Request Payload:**
  ```typescript
  export interface VoidSaleRequest {
    businessId: string;
    saleId: string;
    voidReason: string; // Wajib minimal 5 karakter
  }
  ```
- **Response:** `{ saleId: string; status: 'VOIDED'; voidedAt: string }`
- **Mekanisme Eksekusi (PostgreSQL RPC):**
  - Server Action memanggil stored procedure `supabase.rpc('void_sale_transaction', payload)`.
  - Mengunci header penjualan (`FOR UPDATE`) dan memverifikasi status saat ini adalah `COMPLETED`. Jika sudah `VOIDED`, mengembalikan `SALE_ALREADY_VOIDED`.
  - Mengunci baris produk yang terlibat secara terurut ascending (`ORDER BY id ASC FOR UPDATE`).
  - Mengubah status penjualan menjadi `VOIDED`, mencatat `void_reason` dan `voided_at`.
  - Mengembalikan stok fisik produk sejumlah kuantitas semula (`products.stock_quantity += item.quantity`) tepat satu kali.
  - Menambahkan baris mutasi persediaan pembalik pada `stock_movements` (`movement_type = 'VOID_SALE'`).
  - Unit moving average cost pada katalog produk tidak diubah secara retroaktif guna mencegah efek domino pada penjualan lain.
  - Pada laporan keuangan, penjualan yang berstatus `VOIDED` dikeluarkan dari total omzet dan kas masuk pada periode terkait.
- **Error Codes:** `SALE_NOT_FOUND`, `SALE_ALREADY_VOIDED`, `INVALID_VOID_REASON`, `UNAUTHORIZED_BUSINESS`.

---

## 5. Modul Pembelian Persediaan (Restock)

### 5.1 `recordPurchase(input)`
- **Request Payload:**
  ```typescript
  export interface RecordPurchaseRequest {
    businessId: string;
    purchaseDate?: string;
    supplierName?: string;
    items: Array<{
      productId: string;
      quantity: number; // Integer > 0
      unitPurchaseCost: number; // Integer IDR >= 0
    }>;
    notes?: string;
  }
  ```
- **Response:**
  ```typescript
  export interface PurchaseReceiptResponse {
    purchaseId: string;
    invoiceNumber: string;
    totalCost: number;
    purchaseDate: string;
  }
  ```
- **Mekanisme Eksekusi (PostgreSQL RPC):**
  - Server Action memanggil stored procedure `supabase.rpc('record_purchase_transaction', payload)`.
  - Mengunci baris produk secara terurut ascending `ORDER BY id ASC FOR UPDATE`.
  - Menghitung moving weighted average cost baru yang dibulatkan ke integer terdekat:
    $$\text{New Cost} = \text{ROUND}\left(\frac{(\text{Stok Saat Ini} \times \text{HPP Lama}) + (\text{Qty Beli} \times \text{Harga Beli Satuan})}{\text{Stok Saat Ini} + \text{Qty Beli}}\right)$$
  - Memperbarui stok dan harga pokok produk, menyimpan entri `purchase_items`, dan mencatat mutasi stok `PURCHASE`.
- **Error Codes:** `PRODUCT_NOT_FOUND`, `INVALID_PURCHASE_VALUES`, `UNAUTHORIZED_BUSINESS`.
- **Kalkulasi Moving Average Cost:**
  $$\text{New Cost} = \text{ROUND}\left(\frac{(\text{Current Stock} \times \text{Old Cost}) + (\text{Qty Beli} \times \text{Harga Beli Satuan})}{\text{Current Stock} + \text{Qty Beli}}\right)$$
  Semua perubahan stok dan HPP dieksekusi secara atomik.

---

## 6. Modul Pengeluaran Operasional

### 6.1 `recordExpense(input)`
- **Request Payload:**
  ```typescript
  export interface RecordExpenseRequest {
    businessId: string;
    expenseDate?: string;
    category: string; // Sewa, Listrik, Gaji, Transportasi, Pemasaran, Operasional
    amount: number;   // Integer IDR > 0
    notes?: string;
  }
  ```
- **Response:** `{ expenseId: string; amount: number; category: string; expenseDate: string }`

---

## 7. Modul Dashboard & Laporan Finansial

### 7.1 `getDashboardSummary(params)`
- **Request Query:** `{ businessId: string; startDate: string; endDate: string }`
- **Response:**
  ```typescript
  export interface DashboardSummaryResponse {
    netSales: number;         // Penjualan bersih (setelah diskon & void)
    cogs: number;             // Total HPP atas barang yang terjual
    grossProfit: number;      // netSales - cogs
    grossProfitMargin: number;// (grossProfit / netSales) * 100
    operatingExpenses: number;// Total pengeluaran operasional
    operatingProfit: number;  // grossProfit - operatingExpenses
    recordedCashFlow: {
      cashInflows: number;    // Penjualan lunas tercatat
      cashOutflows: number;   // Beban operasional + Pembelian stok
      netCashFlow: number;    // Inflows - Outflows
    };
    recentTransactions: Array<SaleSummaryItem>;
    lowStockAlerts: Array<LowStockItem>;
    dailySalesTrend: Array<{ date: string; amount: number }>;
  }
  ```

### 7.2 `exportReportCsv(params)`
- **Request:** Endpoint Route Handler GET `/api/reports/export?businessId=...&type=sales|expenses|stock&startDate=...&endDate=...`
- **Response:** HTTP 200 dengan header `Content-Type: text/csv; charset=utf-8` dan `Content-Disposition: attachment; filename="veyraos_..."`.

---

## 8. Kontrak Layanan Khusus Mode Demo (Client-Side Storage Adapter)

Mode Demo mengimplementasikan antarmuka *adapter* identik dengan Server Actions namun berjalan di memori/IndexedDB browser lokal:

```typescript
export interface IBusinessService {
  recordSale(input: RecordSaleRequest): Promise<ApiResponse<SaleReceiptResponse>>;
  voidSale(input: VoidSaleRequest): Promise<ApiResponse<{ saleId: string; status: 'VOIDED' }>>;
  recordPurchase(input: RecordPurchaseRequest): Promise<ApiResponse<PurchaseReceiptResponse>>;
  recordExpense(input: RecordExpenseRequest): Promise<ApiResponse<{ expenseId: string }>>;
  getDashboardSummary(params: DashboardParams): Promise<ApiResponse<DashboardSummaryResponse>>;
}
```
Implementasi `DemoBusinessService` menyimpan data di browser memory/localStorage dan **sama sekali tidak memanggil jaringan luar**.
