# VeyraOS --- Multi-Tenant Security & PostgreSQL Row Level Security (RLS)

**Versi:** 1.0  
**Status:** Usulan Desain Keamanan (Phase 3 Security Baseline - UNEXECUTED PROPOSAL)  
**Tingkat Prioritas:** P0 (Kritis — Isolasi Data Antar-Tenant Wajib Terbukti Secara Matematis & Kebijakan)  
**Lingkup:** Autentikasi, Otorisasi Sesi, Kebijakan RLS, dan Manajemen Secrets  

---

## 1. Prinsip Keamanan & Model Pertahanan Berlapis (Defense-in-Depth)

Keamanan data bisnis VeyraOS tidak boleh hanya mengandalkan penyembunyian tombol di antarmuka (UI) atau sekadar filter `WHERE business_id = x` di kode JavaScript. Kami menerapkan model keamanan 3 lapis:

```
+-----------------------------------------------------------------------------------+
| Lapis 1: Gateway Sesi & Middleware Next.js                                        |
| - Verifikasi JWT Supabase Auth via HTTP-only Cookie                                |
| - Cek apakah pengguna memiliki sesi aktif                                         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Lapis 2: Next.js Server Action / Route Handler Authorization Guard                |
| - Validasi payload via Zod                                                        |
| - Query eksplisit ke tabel business_members: user_id = auth.uid() & business_id   |
| - Tolak request 403 Forbidden sebelum query domain dijalankan                     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Lapis 3: PostgreSQL Row Level Security (RLS Engine)                              |
| - Enforce kebijakan RLS pada tingkat kernel basis data                            |
| - Menggunakan auth.uid() dari token Supabase yang terverifikasi secara kriptografis|
| - Meskipun kode backend mengalami bug, PostgreSQL menolak membaca/menulis baris  |
|   milik tenant lain (Zero Data Leakage)                                           |
+-----------------------------------------------------------------------------------+
```

---

## 2. Kebijakan PostgreSQL Row Level Security (RLS Proposals)

> **Pemberitahuan:** Seluruh skrip SQL RLS di bawah ini adalah usulan spesifikasi teknis dan **belum dieksekusi**.

```sql
-- ============================================================================
-- 1. AKTIFKAN RLS PADA SELURUH TABEL
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. HELPER FUNCTION: APAKAH USER ANGGOTA BISNIS?
-- ============================================================================
-- Fungsi SECURITY DEFINER untuk evaluasi hak akses tenant berkinerja tinggi
CREATE OR REPLACE FUNCTION is_business_member(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = b_id
      AND user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 3. KEBIJAKAN TABEL PROFILES
-- ============================================================================
CREATE POLICY "Pengguna hanya dapat melihat profilnya sendiri"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Pengguna hanya dapat memperbarui profilnya sendiri"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- 4. KEBIJAKAN TABEL BUSINESSES & BUSINESS_MEMBERS
-- ============================================================================
CREATE POLICY "Pengguna hanya dapat melihat bisnis tempat dia menjadi anggota"
ON businesses FOR SELECT
USING (is_business_member(id));

CREATE POLICY "Pengguna dapat membuat bisnis baru"
ON businesses FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Hanya pemilik bisnis yang dapat mengubah profil bisnis"
ON businesses FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Pengguna dapat melihat status keanggotaan bisnis miliknya"
ON business_members FOR SELECT
USING (user_id = auth.uid() OR is_business_member(business_id));

-- Trigger otomatis memastikan pemilik baru langsung terdaftar di business_members
-- (Dijalankan dengan SECURITY DEFINER sehingga tidak butuh policy INSERT manual)

-- ============================================================================
-- 5. KEBIJAKAN TABEL PRODUCTS
-- ============================================================================
CREATE POLICY "Akses baca produk dibatasi untuk anggota bisnis"
ON products FOR SELECT
USING (is_business_member(business_id));

CREATE POLICY "Akses tulis produk dibatasi untuk anggota bisnis"
ON products FOR INSERT
WITH CHECK (is_business_member(business_id));

CREATE POLICY "Akses ubah produk dibatasi untuk anggota bisnis"
ON products FOR UPDATE
USING (is_business_member(business_id));

-- ============================================================================
-- 6. KEBIJAKAN TABEL SALES & SALE_ITEMS (Tenant Scoped with Composite FK)
-- ============================================================================
CREATE POLICY "Akses baca penjualan dibatasi untuk anggota bisnis"
ON sales FOR SELECT
USING (is_business_member(business_id));

CREATE POLICY "Akses tulis penjualan dibatasi untuk anggota bisnis"
ON sales FOR INSERT
WITH CHECK (is_business_member(business_id));

CREATE POLICY "Akses ubah penjualan (void) dibatasi untuk anggota bisnis"
ON sales FOR UPDATE
USING (is_business_member(business_id));

-- sale_items diproteksi langsung oleh business_id dan composite foreign key ke products(business_id, id)
CREATE POLICY "Akses baca item penjualan dibatasi untuk anggota bisnis"
ON sale_items FOR SELECT
USING (is_business_member(business_id));

CREATE POLICY "Akses tulis item penjualan dibatasi untuk anggota bisnis"
ON sale_items FOR INSERT
WITH CHECK (is_business_member(business_id));

-- ============================================================================
-- 7. KEBIJAKAN TABEL STOCK_MOVEMENTS, PURCHASES, & EXPENSES
-- ============================================================================
CREATE POLICY "Akses mutasi stok dibatasi untuk anggota bisnis"
ON stock_movements FOR ALL
USING (is_business_member(business_id));

CREATE POLICY "Akses pembelian stok dibatasi untuk anggota bisnis"
ON inventory_purchases FOR ALL
USING (is_business_member(business_id));

CREATE POLICY "Akses item pembelian stok dibatasi untuk anggota bisnis"
ON purchase_items FOR ALL
USING (is_business_member(business_id));

CREATE POLICY "Akses pengeluaran dibatasi untuk anggota bisnis"
ON expenses FOR ALL
USING (is_business_member(business_id));
```

---

## 3. Pencegahan Manipulasi Parameter Bisnis (ID Tampering Defense)

Bila penyerang sengaja memodifikasi parameter `business_id` pada request (misalnya mengubah UUID milik tokonya menjadi UUID milik toko korban):
1. **Lapis Validasi Server Action:** Server Action mengambil `auth.uid()` dari sesi JWT aman. Server memeriksa relasi `business_members` untuk `(target_business_id, auth.uid())`. Jika tidak ditemukan, eksekusi langsung dihentikan dan melempar error `403 Forbidden: Anda tidak memiliki akses ke bisnis ini`.
2. **Lapis RLS Basis Data:** Bahkan jika kode server tidak menyaring `business_id`, RLS mengevaluasi fungsi `is_business_member(business_id)`. Karena `auth.uid()` penyerang tidak terdaftar sebagai pemilik bisnis korban, PostgreSQL mengembalikan `0 rows` (untuk operasi SELECT/UPDATE) atau melempar pelanggaran kebijakan RLS `42501 row-level security policy violation` (untuk INSERT).

---

## 4. Manajemen Rahasia & Kredensial Lingkungan (Secrets Handling)

| Variabel Lingkungan | Lokasi Eksekusi | Paparan Klien | Aturan Penggunaan |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser & Server | Publik | URL instance Supabase resmi. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser & Server | Publik | Kunci publik aman dengan otorisasi terbatas pada peran anonim/pengguna terotentikasi di bawah RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Saja** (Private) | **DILARANG KERAS** | Kunci hak administratif penuh (by-pass RLS). **Hanya boleh digunakan pada script setup/migrasi atau edge background task terpercaya**. Jangan pernah diekspos ke kode Next.js client component atau browser bundle. |
| `DATABASE_URL` (Direct Connection String) | Server Saja | Rahasia | Digunakan untuk migrasi CLI lokal. |

---

## 5. Matriks Pengujian Keamanan Akses Silang Tenant (Security Test Matrix)

| ID Uji | Skenario Pengujian | Aksi Penyerang | Hasil yang Diharapkan | Status Desain |
|---|---|---|---|---|
| **SEC-01** | Pengguna Anonim (Tanpa Login) | Mengakses query data `/api/products` atau membaca tabel `products` langsung. | Ditolak `401 Unauthorized`. RLS mengembalikan 0 baris. | Lolos secara desain |
| **SEC-02** | Akses Silang Antar-Tenant (Read) | Pengguna Toko A memanggil API membaca produk dengan `business_id` Toko B. | Ditolak `403 Forbidden`. RLS mengembalikan 0 baris. | Lolos secara desain |
| **SEC-03** | Penjualan Silang (Write Tampering) | Pengguna Toko A mengirim transaksi penjualan baru dengan `business_id` Toko B. | Ditolak oleh Server Action & ditolak pelanggaran RLS PostgreSQL. | Lolos secara desain |
| **SEC-04** | Manipulasi Harga Penjualan di Browser | Pengguna memodifikasi harga barang menjadi Rp 1 di payload frontend. | Server Action menolak; harga produk ditarik langsung dari database internal produk. | Lolos secara desain |
| **SEC-05** | Eksfiltrasi Data Mode Demo | Pengguna menjalankan transaksi di Mode Demo. | Request tidak pernah dikirim ke database Supabase nyata; berjalan murni di memori lokal. | Lolos secara desain |
| **SEC-06** | Pembatalan Penjualan Ilegal | Pengguna Toko A memanggil `voidSale(sale_id)` milik Toko B. | Ditolak `403 Forbidden`. Verifikasi kepemilikan gagal sebelum transaksi pembalikan stok. | Lolos secara desain |
