# VeyraOS — Preflight & Implementation Plan: Phase 4, Substage 3.2.2C (Klarifikasi Desain Final)
## Business Profile & Tenant Context Service Layer

**Tanggal:** 14 Oktober 2026  
**Status Tahap:** **PREFLIGHT FINAL — PENDING APPROVAL (KLARIFIKASI FINAL SELESAI — MENUNGGU PERSETUJUAN)**  
**Cakupan Dokumen:** Klarifikasi arsitektur final Substage 3.2.2C: mekanisme atomik kuota 5 bisnis (`FOR UPDATE` locking), mitigasi TOCTOU race condition, batas keamanan cookie preferensi vs otorisasi server, deterministic fallback tie-breaker (`created_at ASC, id ASC`), penegakan anti-silent fallback, rekonsiliasi RLS aktual, pembedaan 3 jenis bukti pengujian, serta prasyarat kesiapan produksi (*production readiness gates*).  
**Kondisi Supabase Live:** **UNTOUCHED / UNMUTATED (0 DDL/DML, 0 MUTASI DATA/SKEMA)**  
**Kondisi Kode Aplikasi:** **TIDAK MENGALAMI PERUBAHAN PADA TAHAP PREFLIGHT INI (0 CODE CHANGE)**

---

## 1. Ringkasan Eksekutif Preflight Final

Substage 3.2.2C merupakan pilar penutup dari **Phase 4 Substage 3.2.2 (Master Data & Operational Service Layer Foundation)**. Modul ini bertanggung jawab atas:
1. **Manajemen Profil Pengguna (`getUserProfile`, `updateUserProfile`):** Membaca identitas personal dan memperbarui `full_name` dengan proteksi mutlak terhadap field immutable (`email`, `id`).
2. **Manajemen Entitas Bisnis (`createBusiness`, `getMyBusinesses`, `getBusinessById`, `updateBusiness`):** Mengelola siklus hidup data bisnis, pendaftaran otomatis pemilik via trigger, penegakan whitelist pembaruan metadata, dan pembatasan kuota bisnis MVP.
3. **Penyedia Konteks Tenant Server-Authoritative (`resolveTenantContext`):** Menyelesaikan dan memvalidasi bisnis aktif pengguna secara aman tanpa mempercayai identifier klien (cookie/query/header) tanpa verifikasi keanggotaan `business_members` di server.

---

## 2. Inventarisasi Skema Fisik, Trigger, dan Kebijakan RLS Eksisting

### A. Tabel Basis Data Fisik Terkait (Migrasi `20261013000001_extensions_and_core.sql`)
- **`public.profiles`:**
  - Kolom: `id` (UUID PK references `auth.users(id)` ON DELETE CASCADE), `full_name` (TEXT NOT NULL $\ge 2$ chars), `email` (TEXT NOT NULL), `created_at`, `updated_at`.
  - Indeks: `idx_profiles_email (email)`.
  - Trigger: `trg_profiles_updated_at` (auto update `updated_at`).
  - **Fakta Kritis:** Tabel ini **TIDAK memiliki kolom `active_business_id`**.
- **`public.businesses`:**
  - Kolom: `id` (UUID PK default `gen_random_uuid()`), `owner_id` (UUID FK `profiles(id)` ON DELETE CASCADE), `name` (TEXT NOT NULL $\ge 2$ chars), `category` (TEXT), `phone` (TEXT), `address` (TEXT), `currency_code` (`VARCHAR(3) DEFAULT 'IDR' CHECK (currency_code = 'IDR')`), `timezone` (`TEXT DEFAULT 'Asia/Jakarta' CHECK (timezone = 'Asia/Jakarta')`), `created_at`, `updated_at`.
  - Indeks: `idx_businesses_owner (owner_id)`.
  - Trigger: `trg_businesses_updated_at` dan `trg_after_business_insert`.
  - **Fakta Kritis:** Skema tabel saat ini **TIDAK memiliki CHECK constraint kuota 5 bisnis** di tingkat DDL.
- **`public.business_members`:**
  - Kolom: `id` (UUID PK default `gen_random_uuid()`), `business_id` (UUID FK `businesses(id)` ON DELETE CASCADE), `user_id` (UUID FK `profiles(id)` ON DELETE CASCADE), `role` (`VARCHAR(20) DEFAULT 'OWNER' CHECK (role IN ('OWNER'))`), `created_at`.
  - Constraint: `CONSTRAINT uq_business_member UNIQUE (business_id, user_id)`.
  - Indeks: `idx_business_members_lookup (user_id, business_id)`.

### B. Trigger Pendaftaran Otomatis Keanggotaan
Trigger `trg_after_business_insert` pada `public.businesses` mengeksekusi fungsi `SECURITY DEFINER` `handle_new_business_owner()`:
```sql
INSERT INTO public.business_members (business_id, user_id, role)
VALUES (NEW.id, NEW.owner_id, 'OWNER')
ON CONFLICT (business_id, user_id) DO NOTHING;
```
*Invariansi:* Setiap baris bisnis yang berhasil di-insert secara otomatis mendaftarkan pembuatnya (`owner_id`) ke tabel `business_members` sebagai `'OWNER'`.

### C. Kebijakan RLS Aktual (Migrasi `20261013000008_rls_and_security.sql`)
1. **Tabel `profiles`:**
   - `profiles_select_own`: `FOR SELECT TO authenticated USING (auth.uid() = id)`
   - `profiles_update_own`: `FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`
   - *Direct DELETE:* Dilarang (tidak ada policy DELETE).
2. **Tabel `businesses`:**
   - `businesses_select_member`: `FOR SELECT TO authenticated USING (public.is_business_member(id))`
   - `businesses_insert_owner`: `FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id)`
   - `businesses_update_owner`: `FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)`
   - *Direct DELETE:* Dilarang (tidak ada policy DELETE).
3. **Tabel `business_members`:**
   - `business_members_select`: `FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_business_member(business_id))`
   - *Direct INSERT / UPDATE / DELETE:* Dilarang untuk klien (eksklusif diisi oleh trigger internal).

---

## 3. Klarifikasi Desain Final 1: Kuota Maksimal Lima Bisnis & Mekanisme Atomik Database

### A. Validasi Awal di Service Layer (Defense-in-Depth Lapis 2)
Service layer mempertahankan validasi awal sebelum eksekusi insert:
```typescript
const { count, error } = await supabase
  .from("businesses")
  .select("id", { count: "exact", head: true })
  .eq("owner_id", userId);

if ((count ?? 0) >= 5) {
  return {
    success: false,
    error: {
      code: "BUSINESS_LIMIT_REACHED",
      message: "Batas maksimal bisnis untuk akun MVP telah tercapai (maksimal 5 bisnis)",
    },
  };
}
```
**Tujuan:** Memberikan umpan balik instan dan pesan kesalahan yang terstruktur (`BUSINESS_LIMIT_REACHED`) untuk 99% alur kerja normal pengguna tanpa membebani database dengan payload insert gagal.

### B. Dokumentasi Keterbatasan Validasi Service Layer (TOCTOU Race Condition)
> **PERINGATAN ARSITEKTUR:** Validasi service layer di atas **TIDAK DAPAT MENJAMIN** batas 5 bisnis saat menerima permintaan konkuren simultan (*Time-of-Check to Time-of-Use / TOCTOU*). Pada tingkat isolasi default PostgreSQL (*Read Committed*), dua request konkuren yang membaca `count = 4` secara paralel keduanya akan lolos dari pemeriksaan `if (count >= 5)` dan keduanya mengeksekusi `INSERT`, sehingga total bisnis menjadi 6.

### C. Desain Mekanisme Atomik Database (Penguncian Baris `FOR UPDATE`)
Untuk menutup celah konkurensi secara mutlak di tingkat kernel database, mekanisme atomik yang dirancang adalah **Stored Procedure PostgreSQL** yang mengunci baris profil pengguna pemilik:
```sql
CREATE OR REPLACE FUNCTION public.create_business_transaction(
    p_owner_id UUID,
    p_name TEXT,
    p_category TEXT,
    p_phone TEXT,
    p_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INT;
    v_new_biz public.businesses%ROWTYPE;
BEGIN
    -- 1. Verifikasi identitas pemanggil
    IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Sesi tidak sah';
    END IF;

    -- 2. Kunci baris profil pemilik untuk menserialisasi seluruh pembuatan bisnis konkuren
    PERFORM 1 FROM public.profiles WHERE id = p_owner_id FOR UPDATE;

    -- 3. Hitung jumlah bisnis aktual di dalam lock eksklusif
    SELECT count(*) INTO v_count FROM public.businesses WHERE owner_id = p_owner_id;
    IF v_count >= 5 THEN
        RAISE EXCEPTION 'BUSINESS_LIMIT_REACHED: Batas maksimal 5 bisnis telah tercapai';
    END IF;

    -- 4. Insert bisnis baru secara atomik
    INSERT INTO public.businesses (owner_id, name, category, phone, address)
    VALUES (p_owner_id, p_name, p_category, p_phone, p_address)
    RETURNING * INTO v_new_biz;

    RETURN to_jsonb(v_new_biz);
END;
$$;
```

### D. Penegakan Jalur Tunggal Pembuatan Bisnis (No Side-Doors)
Ketika mekanisme RPC di atas diterapkan:
- **Jalur Tunggal:** Seluruh alur pembuatan bisnis (baik Server Actions, API, maupun migrasi) **WAJIB** melalui RPC yang sama.
- **Pencegahan Bypass:** Kebijakan RLS `businesses_insert_owner` pada tabel `businesses` dapat dicabut atau dibatasi agar klien tidak dapat melakukan direct insert via REST API yang mem-bypass mekanisme penguncian baris `profiles FOR UPDATE`.

### E. Tahap Implementasi & Prasyarat Kesiapan Produksi (Production Readiness Gate)
1. **Pada Substage 3.2.2C (Saat Ini):**  
   Mengimplementasikan validasi service layer (`count >= 5`) dan pengujian unit berbasis mock.  
   *Pernyataan Tegas:* **Tidak ada klaim bahwa kuota bisnis aman secara konkuren pada tahap service layer saat ini.**
2. **Pada Tahap Database Hardening / Remote Staging:**  
   Menerapkan Stored Procedure `create_business_transaction` dengan penguncian `FOR UPDATE` melalui migrasi forward-only resmi.
3. **Prasyarat Pengujian Konkurensi & Integrasi (Production Readiness Gate):**  
   Fitur pembuatan bisnis baru dinyatakan siap produksi (*Production Ready*) **HANYA SETELAH** lolos pengujian konkurensi fisik (mengirimkan 10 permintaan `createBusiness` paralel simultan saat kuota berada di angka 4 pada connection pool database riil, dan membuktikan tepat 1 request berhasil serta 9 request ditolak dengan `BUSINESS_LIMIT_REACHED`).

---

## 4. Klarifikasi Desain Final 2: Tenant Context, Cookie Preferensi, dan Deterministic Fallback

### A. Peran Cookie: Preferensi UI, Bukan Bukti Otorisasi
- Cookie browser (misal `veyra_active_business`) **HANYA BERFUNGSI** sebagai media penyimpanan preferensi antarmuka pengguna di sisi klien mengenai toko mana yang sedang aktif dilihat.
- **ATURAN KEAMANAN MUTLAK:** Cookie **BUKAN BUKTI OTORISASI**. Klien atau penyerang dapat memodifikasi nilai cookie sewaktu-waktu.
- **Verifikasi Server Wajib:** Setiap request yang memproses data bisnis (baik Server Action, Route Handler, maupun query service) **WAJIB** memvalidasi identitas pengguna (`supabase.auth.getUser()`) dan memverifikasi keanggotaan pengguna pada bisnis tersebut (`public.is_business_member(business_id)`) di sisi server sebelum data diakses atau dimutasi.

### B. Penolakan Keras Tanpa Silent Fallback (Fail-Closed Principle)
Jika klien mengirimkan `requestedBusinessId` (baik dari cookie, header, query string, maupun payload body):
1. Server mencocokkan `requestedBusinessId` terhadap daftar bisnis sah pengguna (`availableBusinesses`).
2. **Jika Valid:** Bisnis tersebut ditetapkan sebagai `activeBusiness`.
3. **Jika Tidak Valid (Bukan Milik Pengguna atau UUID Palsu):**
   - **Tolak Seketika:** Respon mengembalikan kegagalan dengan kode:
     `code: "UNAUTHORIZED_BUSINESS"`, `message: "Pengguna tidak terdaftar sebagai anggota pada bisnis yang diminta"`.
   - **LARANGAN KERAS SILENT FALLBACK:** Sistem **DILARANG** secara diam-diam mengalihkan request ke bisnis pertama milik pengguna. Melakukan silent fallback saat user meminta Toko B namun sistem mencatat transaksi di Toko A akan menyebabkan pencemaran data akuntansi dan stok kasir (*cross-tenant data contamination*).

### C. Fallback Default Deterministik Saat ID Tidak Diminta
Jika `requestedBusinessId` ditiadakan (*omitted* / `undefined`), sistem memilih bisnis default menggunakan urutan deterministik ganda:
```typescript
// Urutan deterministik mutlak dengan tie-breaker id ASC
query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
```
Penggunaan `id ASC` sebagai tie-breaker kedua menjamin bahwa urutan pemilihan bisnis default bersifat 100% konsisten matematis, bahkan jika dua bisnis dibuat pada timestamp mikrodetik yang persis sama.

### D. Matriks Perilaku Tenant Context:

| Skenario Jumlah Bisnis | Input `requestedBusinessId` | Respon `resolveTenantContext` | Arti Status & Tindakan Lanjutan |
|---|---|---|---|
| **0 Bisnis** | Disediakan (apapun) | `UNAUTHORIZED_BUSINESS` | ID tidak sah karena pengguna tidak memiliki bisnis. |
| **0 Bisnis** | Tidak Disediakan (`undefined`) | `{ hasBusiness: false, activeBusiness: null, role: null, availableBusinesses: [] }` | Status bersih. UI mengarahkan ke onboarding (`/onboarding` atau `/businesses/new`). |
| **1 Bisnis** | Sesuai dengan ID bisnisnya | `{ hasBusiness: true, activeBusiness: biz, role: 'OWNER', availableBusinesses: [biz] }` | Bisnis aktif tervalidasi. |
| **1 Bisnis** | Berbeda / Tidak sah | `UNAUTHORIZED_BUSINESS` | Penolakan keras (anti-silent fallback). |
| **1 Bisnis** | Tidak Disediakan (`undefined`) | `{ hasBusiness: true, activeBusiness: biz, role: 'OWNER', availableBusinesses: [biz] }` | Bisnis tunggal otomatis menjadi bisnis aktif default. |
| **Multi-Bisnis (> 1)** | Disediakan & Sah | `{ hasBusiness: true, activeBusiness: reqBiz, role: 'OWNER', availableBusinesses: [...] }` | Pilihan aktif persisten yang diminta klien tervalidasi. |
| **Multi-Bisnis (> 1)** | Disediakan tapi Tidak Sah | `UNAUTHORIZED_BUSINESS` | Penolakan keras (anti-silent fallback). |
| **Multi-Bisnis (> 1)** | Tidak Disediakan (`undefined`) | `{ hasBusiness: true, activeBusiness: firstBiz, role: 'OWNER', availableBusinesses: [...] }` | **Default Sementara (Stateless):** Memilih bisnis tertua (`created_at ASC, id ASC`). |

### E. Perbedaan Default Sementara (Stateless) vs. Pilihan Aktif Persisten:
1. **Default Sementara (Stateless Service Layer):**  
   Pemanggilan service layer yang tidak menyertakan parameter bisnis selalu mengevaluasi bisnis pertama sebagai fallback default aman. Tidak ada state database yang berubah.
2. **Pilihan Aktif Persisten (UI / Cookie Layer - Tahap 3.3):**  
   Ketika pengguna memilih toko di dropdown *business switcher*, browser menyimpan ID tersebut di cookie. Pada request berikutnya, cookie tersebut dikirimkan sebagai `requestedBusinessId` dan **divalidasi ulang** oleh server. Jika valid, pilihan persisten tersebut digunakan; jika cookie dirusak, server menolak dengan `UNAUTHORIZED_BUSINESS`.
3. **Larangan Skema:**  
   Ditegaskan bahwa kolom `profiles.active_business_id` **TIDAK DITAMBAHKAN** ke database untuk menghindari masalah race condition antar-tab browser dan foreign key siklikal.

---

## 5. Klarifikasi Desain Final 3: Konsistensi Keamanan & Tiga Jenis Bukti Pengujian

### A. Keselarasan Matriks Otorisasi Service dengan RLS dan Trigger

```
[Permintaan Masuk]
       │
       ▼
[Lapis 1: Gateway Sesi] ────────► supabase.auth.getUser() (Validasi Kriptografis Token)
       │
       ▼
[Lapis 2: Service Layer] ───────► verifyUserAndBusinessMembership (Cek Keanggotaan & Role)
                                 Whitelist Filter (Buang Field Immutable)
                                 Cek Kuota Bisnis (count < 5)
       │
       ▼
[Lapis 3: Kernel PostgreSQL] ───► profiles_update_own (auth.uid = id)
                                 businesses_update_owner (auth.uid = owner_id)
                                 businesses_select_member (is_business_member)
                                 trg_after_business_insert (Auto-Enroll 'OWNER')
```

### B. Penegakan Whitelist & Field Immutability Mutlak:
- **`updateUserProfile`:**  
  Hanya menerima `fullName` (2–100 karakter). Field `id`, `email`, `created_at`, `updated_at` diabaikan/dibuang sebelum query update PostgREST.
- **`updateBusiness`:**  
  Hanya menerima `name`, `category`, `phone`, `address`. Field `id`, `owner_id`, `currency_code`, `timezone`, `created_at`, `updated_at` diabaikan/dibuang. Mutasi `owner_id` (transfer kepemilikan) dilarang pada MVP.
- **Pemeriksaan Kepemilikan pada `updateBusiness`:**  
  Sebelum menjalankan update, service memverifikasi bahwa `auth.uid() === business.owner_id`. Jika pengguna adalah anggota tapi bukan pemilik (misal role staf kelak), service mengembalikan error `FORBIDDEN_NOT_OWNER`.

### C. Tiga Jenis Bukti Pengujian yang Berbeda (Evidence Classification)
Dokumentasi pengujian VeyraOS membedakan secara tegas tiga bentuk bukti pengujian:

| Jenis Bukti | Lingkungan Eksekusi | Yang Dibuktikan Secara Sah | Batasan yang TIDAK Boleh Diklaim | Status di Substage 3.2.2C |
|---|---|---|---|---|
| **1. Unit Test Mock** | Vitest, single-thread V8, Mock Supabase Client | - Kebenaran logika TypeScript/JS.<br>- Validasi Zod schema & formatting error.<br>- Percabangan kondisi auth & role.<br>- Pemetaan baris database ke DTO API.<br>- Sanitasi error mapping. | - TIDAK membuktikan isolasi data RLS kernel nyata.<br>- TIDAK membuktikan trigger database SQL berjalan.<br>- TIDAK membuktikan ketahanan terhadap race condition konkuren. | **DILAKSANAKAN PENUH (24 Skenario Uji)** |
| **2. Pengujian Integrasi Database** | Supabase Local / Staging PostgreSQL aktif | - Eksekusi fisik trigger `trg_after_business_insert`.<br>- Penegakan kebijakan RLS `businesses_select_member` & `businesses_update_owner`.<br>- Integritas CHECK constraint `currency_code = 'IDR'`. | - Belum membuktikan batas ketahanan beban tinggi multi-user simultan jika diuji secara serial. | **PRASYARAT TAHAP DATABASE REMOTE** |
| **3. Pengujian Konkurensi & Race Condition** | PostgreSQL aktif multi-koneksi dengan tool beban (k6 / Vitest concurrent pool) | - Efektivitas penguncian baris `profiles FOR UPDATE` saat 10 request paralel dikirim simultan.<br>- Bukti matematis bahwa kuota 5 bisnis tidak dapat ditembus secara konkuren. | - Hanya valid untuk skenario yang dievaluasi pada skrip pengujian beban. | **PRASYARAT KESIAPAN PRODUKSI (PRODUCTION READINESS GATE)** |

---

## 6. Rencana Pengujian Unit Mock (Substage 3.2.2C — 24 Skenario Uji)

Suite pengujian unit pada `src/services/business/business.service.test.ts` akan mencakup:

1. **Input Validation Guards (Zod):**
   - `updateUserProfile`: Menolak nama < 2 karakter dan > 100 karakter.
   - `createBusiness`: Menolak nama < 2 karakter dan > 60 karakter.
   - `updateBusiness`: Menolak format non-UUID pada `businessId` dan menolak payload pembaruan kosong.
2. **Authentication & Session Guards:**
   - Menolak seluruh 7 metode saat sesi pengguna tidak aktif (`UNAUTHENTICATED`).
3. **User Profile Operations (`getUserProfile` & `updateUserProfile`):**
   - Mengambil profil pengguna aktif dan memetakan field ke DTO secara presisi.
   - Memperbarui `fullName` pengguna dan memastikan `email` serta `id` tidak berubah.
4. **Business Entity Operations (`createBusiness`, `getMyBusinesses`, `getBusinessById`, `updateBusiness`):**
   - Berhasil membuat bisnis baru dan memvalidasi default currency/timezone.
   - Menolak `createBusiness` ketika `count >= 5` dengan kode `BUSINESS_LIMIT_REACHED`.
   - Mengambil seluruh daftar bisnis pengguna (`getMyBusinesses`).
   - Mengambil detail satu bisnis dengan tenant isolation (`getBusinessById`).
   - Menolak `getBusinessById` untuk bisnis milik tenant lain (`NOT_FOUND` / `UNAUTHORIZED_BUSINESS`).
   - Berhasil memperbarui metadata bisnis oleh pemilik.
   - Menolak `updateBusiness` jika pengguna bukan pemilik (`owner_id !== auth.uid()`) dengan kode `FORBIDDEN_NOT_OWNER`.
   - Memastikan field immutable (`currency_code`, `timezone`, `owner_id`) tidak berubah saat update.
5. **Tenant Context Resolution (`resolveTenantContext`):**
   - **Kasus 0 Bisnis:** Mengembalikan `hasBusiness: false` dan `activeBusiness: null`.
   - **Kasus 1 Bisnis:** Mengembalikan bisnis tunggal sebagai `activeBusiness`.
   - **Kasus Multi-Bisnis (ID Sah):** Mengembalikan bisnis yang diminta klien.
   - **Kasus Multi-Bisnis (ID Tidak Sah):** Menolak keras dengan `UNAUTHORIZED_BUSINESS` (membuktikan tidak ada silent fallback).
   - **Kasus Multi-Bisnis (Omitted):** Memilih bisnis pertama secara deterministik (`ORDER BY created_at ASC, id ASC`).
6. **Error Mapping & Sanitization:**
   - Memetakan error jaringan ke `NETWORK_ERROR`.
   - Memetakan error database PostgREST ke `DATABASE_ERROR`.

---

## 7. Ringkasan Keputusan Desain Final & Matriks Risiko Terbuka

| Area | Keputusan Desain Final yang Disetujui | Risiko Terbuka / Prasyarat Produksi | Status |
|---|---|---|---|
| **Kuota 5 Bisnis** | Validasi awal di service layer (`count < 5`) untuk pesan error jelas `BUSINESS_LIMIT_REACHED`. | TOCTOU race condition di bawah request konkuren. Wajib ditutup via Stored Procedure `FOR UPDATE` dan diuji via pengujian konkurensi sebelum rilis produksi. | **DISETUJUI SEBAGAI READINESS GATE** |
| **Cookie Konteks** | Cookie hanya menyimpan preferensi UI klien. Setiap request wajib memvalidasi otorisasi dan membership di server. | Tidak ada celah keamanan otorisasi karena server tidak mempercayai cookie secara buta. | **DISETUJUI (PRINSIP KEAMANAN)** |
| **Penolakan ID Tidak Sah** | `requestedBusinessId` yang tidak sah ditolak seketika (`UNAUTHORIZED_BUSINESS`) tanpa silent fallback. | Mencegah kecelakaan pencatatan transaksi kasir di toko yang keliru. | **DISETUJUI (FAIL-CLOSED)** |
| **Fallback Deterministik** | Parameter omitted memilih bisnis tertua dengan tie-breaker ganda `ORDER BY created_at ASC, id ASC`. | Tidak ada nondeterminisme saat timestamp identik. | **DISETUJUI** |
| **Skema Database** | Tidak menambah kolom `profiles.active_business_id`. Status aktif dipertahankan stateless di service layer. | Zero DDL migration pada tahap service layer. Persistensi dialokasikan ke cookie UI di Tahap 3.3. | **DISETUJUI** |

---

## 8. Konfirmasi Batasan Mutlak

- **Mutasi Database Supabase Live:** **0 (TIDAK ADA MUTASI DDL/DML)**.
- **Migrasi SQL:** **TIDAK ADA MIGRASI BARU ATAU RETROSPEKTIF**.
- **Kode Sumber (`src/`):** **TIDAK ADA PERUBAHAN PADA PREFLIGHT INI**.
- **Environment Variables:** **TIDAK DIUBAH**.
- **Server Actions, UI, & Implementasi Service:** **BELUM DIMULAI**.

---

*Laporan klarifikasi desain final Substage 3.2.2C telah selesai dan dikunci. Pengerjaan dihentikan pada titik ini untuk menunggu persetujuan eksplisit Anda sebelum memulai implementasi kode.*
