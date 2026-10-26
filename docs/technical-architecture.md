# VeyraOS --- Technical Architecture & System Design

**Versi:** 1.0  
**Status:** Usulan Desain Teknis (Phase 3 Technical Architecture Baseline)  
**Produk:** VeyraOS  
**Arsitektur Inti:** Multi-Tenant Web App (Next.js App Router + Supabase PostgreSQL + RLS)  

---

## 1. Ringkasan Eksekutif & Prinsip Desain Teknis

VeyraOS dirancang sebagai aplikasi web manajemen bisnis berstandar produksi yang memprioritaskan:
1. **Keandalan Finansial (Financial Correctness):** Seluruh kalkulasi Rupiah dieksekusi dengan bilangan bulat (`BIGINT`), pembulatan terkontrol, dan snapshot harga historis yang abadi.
2. **Atomisitas Transaksi (ACID Compliance):** Mutasi stok, pembuatan nota penjualan, pencatatan beban modal (HPP), dan mutasi kas dieksekusi dalam satu transaksi database PostgreSQL yang utuh. Kegagalan di satu titik membatalkan seluruh operasi secara mutlak.
3. **Isolasi Multi-Tenant Berlapis (Defense-in-Depth):** Hak akses data bisnis diverifikasi di lapisan Server Action (Edge/Node.js) dan diproteksi secara fisik di lapisan PostgreSQL menggunakan Row Level Security (RLS). Pengubahan parameter `business_id` pada request klien tidak dapat menembus basis data.
4. **Isolasi Penuh Mode Demo (Client-Side Sandboxing):** Mode Demo beroperasi 100% pada memori/penyimpanan browser lokal tanpa koneksi ke endpoint mutasi database nyata, menjamin 0% risiko kontaminasi data bisnis riil.

---

## 2. Evaluasi & Rekomendasi Stack Teknologi

| Komponen | Pilihan Rekomendasi | Peran & Tanggung Jawab | Alternatif yang Dipertimbangkan | Batasan Layanan & Risiko Biaya | Status Persetujuan |
|---|---|---|---|---|---|
| **Frontend Framework** | **Next.js 15 (App Router, React 19, TypeScript)** | Rendering halaman cepat (SSR/RSC), pengelolaan rute terisolasi `(app)` vs `(demo)`, dan eksekusi Server Actions terpercaya. | Vite + React SPA, Remix/React Router v7 | Vercel Free Tier: Bandwidth 100 GB/bulan, Serverless Function execution limit 10–15s. Aman untuk skala UMKM awal. | Siap disetujui |
| **Styling & UI Primitives** | **Tailwind CSS + shadcn/ui (Radix UI)** | Implementasi token Royal Violet melalui variabel CSS, komponen aksesibel (WCAG AA), dan kontrol ukuran modal/sheet. | Chakra UI, Mantine, Vanilla CSS murni | Tidak ada biaya lisensi; ukuran bundle kecil berkat tree-shaking Tailwind compiler. | Siap disetujui |
| **Ikonografi** | **Lucide React** | Ikon semantik berbobot ringan, konsisten, dan ramah aksesibilitas pembaca layar. | Heroicons, FontAwesome | Nol biaya, zero runtime overhead. | Siap disetujui |
| **Database & Auth** | **PostgreSQL via Supabase** | Relational storage ACID, Supabase Auth (JWT cookie session via `@supabase/ssr`), dan RLS multi-tenant bawaan database. | Neon + Auth0, Self-hosted PostgreSQL di VPS | Supabase Free Tier: 500 MB database storage, 50.000 MAU. **Perhatian:** Proyek gratis berhenti (pause) otomatis setelah 7 hari tidak aktif jika tidak ada traffic; perlu pemantauan liveness. | Siap disetujui |
| **Validasi Skema** | **Zod** | Validasi skema tunggal yang dibagi antara browser formulir dan Server Actions backend. | Yup, Valibot | Nol biaya, menjamin type-safety dari form hingga query. | Siap disetujui |
| **Form Management** | **React Hook Form** | Pengelolaan state formulir tanpa re-render berlebih, integrasi Rupiah masking, dan `@hookform/resolvers/zod`. | Formik, Native Form | Sangat ringan, optimal untuk POS kasir cepat di perangkat ponsel entry-level. | Siap disetujui |
| **Visualisasi Grafik** | **Recharts** | Render grafik garis tren penjualan dan grafik batang finansial berbasis SVG yang responsif. | Chart.js, Tremor | Ringan, bebas canvas bloat, mendukung kustomisasi warna token Royal Violet. | Siap disetujui |
| **Hosting & Deployment** | **Vercel** | CI/CD otomatis dari repository GitHub, Edge CDN global, zero-config Next.js environment. | Cloudflare Pages, Netlify, Railway | Free hobby tier mencukupi untuk MVP; kepatuhan GDPR/data privacy server region. | Siap disetujui |
| **Pengujian (Testing)** | **Vitest + Playwright** | Unit testing untuk kalkulasi laba/HPP (Vitest) & E2E testing alur penjualan dan isolasi demo (Playwright). | Jest + Cypress | Berjalan di local & GitHub Actions CI secara gratis. | Siap disetujui |

---

## 3. Topologi & Diagram Arsitektur Sistem

```mermaid
graph TB
    subgraph Klien_Browser [Klien Browser: Ponsel / Desktop (Port 360px+)]
        UI_Real[Rute Privat Bisnis Nyata: /dashboard, /sales]
        UI_Demo[Rute Simulasi: /demo/*]
        DemoStore[Local Demo Store: In-Memory / LocalStorage]
        UI_Demo <-->|Baca / Tulis Lokal| DemoStore
    end

    subgraph Lapisan_Aplikasi [Next.js App Server (Vercel Serverless)]
        Middleware[Next.js Auth & Session Middleware]
        ServerActions[Server Actions: createSale, recordPurchase, voidSale]
        ZodValidator[Zod Schema Validator & Sanitizer]
        AuthGuard[Tenant Authorization Guard: active_business_id check]
        
        UI_Real -->|HTTPS POST Server Actions| Middleware
        Middleware --> AuthGuard
        AuthGuard --> ZodValidator
        ZodValidator --> ServerActions
    end

    subgraph Lapisan_Basis_Data [Supabase Managed PostgreSQL]
        SupabaseAuth[Supabase Auth: users, sessions]
        RLS_Engine[PostgreSQL Row Level Security Engine]
        DB_Procedures[Stored Functions: record_sale, record_purchase, void_sale]
        DB_Tables[(Tabel: businesses, products, sales, sale_items, stock_movements, expenses)]
        
        ServerActions -->|Koneksi Klien Bertoken Pengguna| RLS_Engine
        RLS_Engine --> DB_Procedures
        DB_Procedures -->|Atomik ACID Transaction| DB_Tables
    end

    classDef demo fill:#F6F3FF,stroke:#392477,stroke-width:2px;
    classDef real fill:#FFFFFF,stroke:#5B3CC4,stroke-width:2px;
    class UI_Demo,DemoStore demo;
    class UI_Real,ServerActions real;
```

---

## 4. Alur Transaksi Penjualan Normal (Data Flow Sequence)

Berikut adalah diagram sekuens transaksi pencatatan penjualan tunai/transfer pada toko:

```mermaid
sequenceDiagram
    autonumber
    actor Kasir as Pemilik Toko / Kasir
    participant POS as UI Kasir Cepat (/sales/new)
    participant Action as Next.js Server Action (createSale)
    participant Auth as Supabase Auth & Session
    participant DB as PostgreSQL Transaction (record_sale)
    
    Kasir->>POS: Pilih Produk, Masukkan Qty, Diskon, Metode Bayar
    POS->>POS: Validasi awal form (Zod Client): Qty > 0, Stok Lokal Cukup
    Kasir->>POS: Klik [Simpan Transaksi]
    POS->>Action: POST payload {business_id, items, discount, payment_method}
    
    Action->>Auth: Verifikasi token JWT & ambil auth.uid() (via await cookies())
    Auth-->>Action: Sesi Valid (user_id)
    
    rect rgb(246, 243, 255)
        note over Action,DB: Eksekusi Stored Procedure Atomik via supabase.rpc('record_sale_transaction', payload)
        Action->>DB: CALL record_sale_transaction(business_id, invoice, payment_method, discount, notes, items)
        DB->>DB: Verifikasi hak akses: is_business_member(p_business_id)
        DB->>DB: Kunci baris produk terurut: SELECT ... FROM products WHERE ... ORDER BY id ASC FOR UPDATE
        DB->>DB: Verifikasi stok cukup; jika kurang -> ROLLBACK & lempar exception STOCK_INSUFFICIENT
        DB->>DB: Hitung subtotal & alokasi diskon transaksi per item via Largest Remainder Method
        DB->>DB: Simpan header sales (COMPLETED)
        DB->>DB: Simpan sale_items dengan composite FK & snapshot harga serta HPP
        DB->>DB: Kurangi stock_quantity produk & buat catatan stock_movements (SALE)
        DB-->>Action: COMMIT & kembalikan JSONB receipt
    end
    
    Action-->>POS: HTTP 200 OK Response
    POS->>Kasir: Tampilkan Modal Sukses / Cetak Ringkasan & Kosongkan Keranjang
```

---

## 5. Batas Komputasi: Klien vs. Server & Pola Next.js 15

| Operasi | Lingkungan Eksekusi | Alasan & Aturan Keamanan |
|---|---|---|
| Pemformatan Angka Rupiah (`Rp 1.500.000`) | Klien (Browser) | Kenyamanan visual dan ergonomi input kasir. |
| Masking & Pengecekan Awal Input Form | Klien (Browser) | Umpan balik langsung (UX instan) tanpa beban jaringan. |
| Eksekusi Transaksi Penjualan & Pembelian | **Server & Database RPC** | Menggunakan stored procedure atomik (`record_sale_transaction`), mencegah kecurangan harga, dan mencegah race condition. |
| Rekalkulasi Moving Weighted Average Cost | **Server & Database RPC** | Dihitung otomatis dalam fungsi `record_purchase_transaction` saat restock. |
| Ekspor Laporan CSV | **Server Saja** | Menjamin data diekspor langsung dari sumber transaksi terotorisasi tanpa memuat seluruh data ke memori browser. |
| Operasi Mode Demo | **Klien (Browser) Saja** | Menjaga pemisahan mutlak agar simulasi tidak pernah memanggil Server Actions mutasi bisnis nyata. |

### 5.1 Penanganan Asynchronous Request APIs (Next.js 15 Pattern)
Pada Next.js 15, seluruh akses ke cookie sesi dan header request bersifat asynchronous:
```typescript
// Pola Wajib Next.js 15 untuk Supabase Server Client
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // WAJIB AWAIT di Next.js 15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component
          }
        },
      },
    }
  );
}
```

---

## 6. Observabilitas, Penanganan Error & Keamanan Log

1. **Struktur Error Terpadu (Domain Error Response):**
   Setiap respons kegagalan dari Server Action mengembalikan format objek terstandarisasi:
   ```typescript
   export type ActionResponse<T> = 
     | { success: true; data: T }
     | { success: false; error: { code: string; message: string; details?: Record<string, string[]> } };
   ```
2. **Pembersihan Log (Sanitization):**
   - Dilarang keras mencatat kata sandi, token JWT, cookie, atau nomor kontak pelanggan ke konsol log publik.
   - Pesan error teknis database (misalnya kegagalan foreign key Postgres atau timeout pool koneksi) diringkas menjadi pesan bahasa manusia: *"Terjadi kendala saat memproses data. Silakan coba kembali beberapa saat lagi."*, sementara detail asli dicatat ke server logging internal.

---

## 7. Aturan Rekonsiliasi Finansial & Alokasi Diskon (Financial Invariants)

1. **Alokasi Diskon Transaksi (Largest Remainder Method):**
   Jika diskon diberikan pada tingkat nota/transaksi (misal: Diskon Rp 10.000), diskon tersebut dialokasikan secara proporsional ke setiap baris item (`sale_items`) berdasarkan bobot subtotal item terhadap total subtotal. Selisih pembulatan dibebankan ke item dengan subtotal terbesar (dengan tie-breaker produk ID terkecil). Hal ini menjamin:
   $$\sum_{i=1}^n \text{sale\_items.discount\_amount}_i = \text{sales.discount\_amount}$$
   $$\sum_{i=1}^n \text{sale\_items.subtotal\_amount}_i = \text{sales.total\_amount}$$
2. **Perlakuan Arus Kas saat Pembatalan Penjualan (Sale Void):**
   Karena seluruh penjualan MVP berstatus lunas seketika (`CASH` atau `BANK_TRANSFER`), pembatalan nota penjualan yang terjadi pada periode laporan membatalkan penerimaan kas masuk dari penjualan tersebut:
   - Jika laporan difilter pada periode transaksi awal: Penjualan yang berstatus `VOIDED` dikeluarkan dari total Penjualan Bersih dan Kas Masuk (dihitung sebagai Rp 0).
   - Laporan transaksi menyediakan kolom audit khusus yang menampilkan histori transaksi yang dibatalkan beserta alasannya tanpa merusak rekonsiliasi kas riil.
