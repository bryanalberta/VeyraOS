import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SettingsPage from "./settings/settings-content";
import { updateBusinessSchema } from "@/lib/validations/business";
import type { BusinessResponseData } from "@/types/api";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/settings",
}));

// ---------------------------------------------------------------------------
// Mock Server Actions
// ---------------------------------------------------------------------------
const mockGetActiveTenantContextAction = vi.fn();
const mockUpdateBusinessAction = vi.fn();

vi.mock("@/app/actions/business", () => ({
  getActiveTenantContextAction: (...args: unknown[]) =>
    mockGetActiveTenantContextAction(...args),
  updateBusinessAction: (...args: unknown[]) =>
    mockUpdateBusinessAction(...args),
}));

// ---------------------------------------------------------------------------
// Fixture Data
// ---------------------------------------------------------------------------
const sampleBusiness: BusinessResponseData = {
  id: "33333333-3333-4333-a333-333333333333",
  ownerId: "11111111-1111-4111-a111-111111111111",
  name: "Warung Berkah Nusantara",
  category: "Kelontong / Sembako",
  phone: "08123456789",
  address: "Jl. Pasar Baru No. 12, Jakarta Pusat",
  currencyCode: "IDR",
  timezone: "Asia/Jakarta",
  createdAt: "2026-10-14T08:00:00.000Z",
  updatedAt: "2026-10-14T08:00:00.000Z",
};

describe("VeyraOS Stage 5.7 - UI Pengaturan Bisnis Suite (/settings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveTenantContextAction.mockResolvedValue({
      success: true,
      data: {
        hasBusiness: true,
        activeBusiness: sampleBusiness,
        role: "OWNER",
        availableBusinesses: [sampleBusiness],
      },
    });
    mockUpdateBusinessAction.mockResolvedValue({
      success: true,
      data: sampleBusiness,
    });
  });

  // =========================================================================
  // GRUP A: RENDERING DAN DATA AWAL
  // =========================================================================
  describe("A. Rendering dan Data Awal", () => {
    it("A.1 Menampilkan judul modul, nama bisnis aktif, dan deskripsi", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).toContain("Pengaturan Bisnis");
      expect(html).toContain("Warung Berkah Nusantara");
      expect(html).toContain("Konfigurasi Toko");
      expect(html).toContain("Kelola identitas usaha");
    });

    it("A.2 Merender form field dengan nilai awal yang sesuai dari initialBusiness", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).toContain('value="Warung Berkah Nusantara"');
      expect(html).toContain('value="Kelontong / Sembako"');
      expect(html).toContain('value="08123456789"');
      expect(html).toContain("Jl. Pasar Baru No. 12, Jakarta Pusat");
    });

    it("A.3 Menampilkan konfigurasi regional baku (IDR dan Asia/Jakarta) bertanda Baku Sistem", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).toContain("Konfigurasi Regional &amp; Mata Uang");
      expect(html).toContain("Rupiah Indonesia (IDR)");
      expect(html).toContain("Asia/Jakarta (WIB — UTC+7)");
      expect(html).toContain("Baku Sistem");
      expect(html).toContain("Seluruh pencatatan moneter menggunakan bilangan bulat");
    });

    it("A.4 Menampilkan metadata teknis tenant (UUID, hak akses, waktu dibuat)", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).toContain("Informasi Teknis Tenant");
      expect(html).toContain("33333333-3333-4333-a333-333333333333");
      expect(html).toContain("Pemilik Usaha (OWNER)");
      expect(html).toContain("Dibuat Pada");
      expect(html).toContain("Terakhir Diperbarui");
    });

    it("A.5 Merender skeleton loading saat initialBusiness ditiadakan", () => {
      const html = renderToStaticMarkup(<SettingsPage />);

      expect(html).toContain('data-testid="settings-skeleton"');
    });

    it("A.6 Merender empty state saat akun belum memiliki bisnis aktif", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={null} initialRole={null} />
      );

      expect(html).toContain("Belum Ada Bisnis Aktif");
      expect(html).toContain("Buat Profil Bisnis Pertama");
      expect(html).toContain('href="/onboarding/create-business"');
    });
  });

  // =========================================================================
  // GRUP B: HAK AKSES DAN OTORISASI PERAN
  // =========================================================================
  describe("B. Hak Akses dan Otorisasi Peran", () => {
    it("B.1 Pemilik (role=OWNER) tidak menampilkan alert akses terbatas dan input dapat diedit", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).not.toContain("Status Akses: Anggota Non-Pemilik");
      expect(html).not.toContain("data-testid=\"settings-non-owner-alert\"");
    });

    it("B.2 Anggota non-pemilik (role=null/non-owner) menampilkan banner peringatan akses terbatas", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole={null} />
      );

      expect(html).toContain("Status Akses: Anggota Non-Pemilik");
      expect(html).toContain('data-testid="settings-non-owner-alert"');
      expect(html).toContain("pemilik sah bisnis");
    });

    it("B.3 Anggota non-pemilik memiliki seluruh form input dalam kondisi terkunci (disabled)", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole={null} />
      );

      // Seluruh input dan textarea harus memiliki atribut disabled
      const nameInput = html.match(/<input[^>]*id="settings-input-name"[^>]*>/);
      expect(nameInput).not.toBeNull();
      expect(nameInput![0]).toContain("disabled");

      const categoryInput = html.match(/<input[^>]*id="settings-input-category"[^>]*>/);
      expect(categoryInput).not.toBeNull();
      expect(categoryInput![0]).toContain("disabled");

      const phoneInput = html.match(/<input[^>]*id="settings-input-phone"[^>]*>/);
      expect(phoneInput).not.toBeNull();
      expect(phoneInput![0]).toContain("disabled");

      const addressInput = html.match(/<textarea[^>]*id="settings-input-address"[^>]*>/);
      expect(addressInput).not.toBeNull();
      expect(addressInput![0]).toContain("disabled");
    });

    it("B.4 Anggota non-pemilik memiliki tombol simpan dalam kondisi terkunci (disabled)", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole={null} />
      );

      const submitBtn = html.match(/<button[^>]*id="submit-settings-button"[^>]*>/);
      expect(submitBtn).not.toBeNull();
      expect(submitBtn![0]).toContain("disabled");
    });
  });

  // =========================================================================
  // GRUP C: VALIDASI SKEMA DAN KONTRAK INPUT
  // =========================================================================
  describe("C. Validasi Skema dan Kontrak Input", () => {
    it("C.1 Menolak nama usaha kurang dari 2 karakter", () => {
      const res = updateBusinessSchema.safeParse({
        businessId: sampleBusiness.id,
        name: "A",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("minimal 2 karakter");
      }
    });

    it("C.2 Menolak nama usaha lebih dari 60 karakter", () => {
      const res = updateBusinessSchema.safeParse({
        businessId: sampleBusiness.id,
        name: "x".repeat(61),
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("maksimal 60 karakter");
      }
    });

    it("C.3 Menolak jika tidak ada satu pun field metadata yang dikirimkan (refine)", () => {
      const res = updateBusinessSchema.safeParse({
        businessId: sampleBusiness.id,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain(
          "Setidaknya satu field metadata usaha harus disertakan"
        );
      }
    });

    it("C.4 Menerima pembaruan sebagian (partial update) field nama atau telepon saja", () => {
      const resName = updateBusinessSchema.safeParse({
        businessId: sampleBusiness.id,
        name: "Toko Baru",
      });
      expect(resName.success).toBe(true);

      const resPhone = updateBusinessSchema.safeParse({
        businessId: sampleBusiness.id,
        phone: "081299998888",
      });
      expect(resPhone.success).toBe(true);
    });

    it("C.5 Menolak nomor telepon lebih dari 20 karakter", () => {
      const res = updateBusinessSchema.safeParse({
        businessId: sampleBusiness.id,
        phone: "081234567890123456789", // 21 chars
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("maksimal 20 karakter");
      }
    });
  });

  // =========================================================================
  // GRUP D: AKSESIBILITAS DAN ELEMEN INTERAKTIF
  // =========================================================================
  describe("D. Aksesibilitas dan Elemen Interaktif", () => {
    it("D.1 Seluruh form field memiliki elemen label yang terhubung via htmlFor", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).toContain('for="settings-input-name"');
      expect(html).toContain('id="settings-input-name"');
      expect(html).toContain('for="settings-input-category"');
      expect(html).toContain('id="settings-input-category"');
      expect(html).toContain('for="settings-input-phone"');
      expect(html).toContain('id="settings-input-phone"');
      expect(html).toContain('for="settings-input-address"');
      expect(html).toContain('id="settings-input-address"');
    });

    it("D.2 Tombol simpan dinonaktifkan jika belum ada perubahan data (!isDirty)", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      // Karena initialBusiness sama persis dengan form state awal, tombol simpan berstatus disabled
      const submitBtn = html.match(/<button[^>]*id="submit-settings-button"[^>]*>/);
      expect(submitBtn).not.toBeNull();
      expect(submitBtn![0]).toContain("disabled");
      expect(html).toContain("Data profil tersinkronisasi.");
    });

    it("D.3 Tombol Batal tersedia untuk mereset perubahan formulir", () => {
      const html = renderToStaticMarkup(
        <SettingsPage initialBusiness={sampleBusiness} initialRole="OWNER" />
      );

      expect(html).toContain("Batal");
      expect(html).toContain("Simpan Pengaturan");
    });
  });
});
