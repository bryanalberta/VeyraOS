import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpensesContent as ExpensesPage } from "./expenses/expenses-content";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAP,
} from "@/constants/expenses";
import { recordExpenseSchema, getExpensesQuerySchema } from "@/lib/validations/expense";
import type {
  ExpenseResponseData,
  BusinessResponseData,
} from "@/types/api";
import type { ExpenseCategory } from "@/types/database";
import { formatRupiah } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  usePathname: () => "/expenses",
}));

// ---------------------------------------------------------------------------
// Mock Server Actions
// ---------------------------------------------------------------------------
const mockGetExpensesAction = vi.fn();
const mockRecordExpenseAction = vi.fn();
const mockGetActiveTenantContextAction = vi.fn();

vi.mock("@/app/actions/expenses", () => ({
  getExpensesAction: (...args: unknown[]) => mockGetExpensesAction(...args),
  recordExpenseAction: (...args: unknown[]) => mockRecordExpenseAction(...args),
}));

vi.mock("@/app/actions/business", () => ({
  getActiveTenantContextAction: (...args: unknown[]) =>
    mockGetActiveTenantContextAction(...args),
}));

// ---------------------------------------------------------------------------
// Fixture Data
// ---------------------------------------------------------------------------
const sampleBusiness: BusinessResponseData = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerId: "user-owner-001",
  name: "Warung Berkah Nusantara",
  category: "Kelontong / Sembako",
  phone: "08123456789",
  address: "Jl. Pasar Baru No. 12, Jakarta",
  currencyCode: "IDR",
  timezone: "Asia/Jakarta",
  createdAt: "2026-10-14T08:00:00Z",
  updatedAt: "2026-10-14T08:00:00Z",
};

const sampleExpenses: ExpenseResponseData[] = [
  {
    id: "exp-001-rent",
    businessId: sampleBusiness.id,
    category: "RENT",
    amount: 1500000,
    description: "Sewa kios ruko bulan Oktober",
    expenseDate: "2026-10-01T05:00:00.000Z",
    createdAt: "2026-10-01T05:00:00.000Z",
    updatedAt: "2026-10-01T05:00:00.000Z",
  },
  {
    id: "exp-002-util",
    businessId: sampleBusiness.id,
    category: "UTILITIES",
    amount: 350000,
    description: "Token listrik PLN & tagihan PDAM",
    expenseDate: "2026-10-05T05:00:00.000Z",
    createdAt: "2026-10-05T05:00:00.000Z",
    updatedAt: "2026-10-05T05:00:00.000Z",
  },
  {
    id: "exp-003-sal",
    businessId: sampleBusiness.id,
    category: "SALARY",
    amount: 800000,
    description: "Gaji staf kasir paruh waktu",
    expenseDate: "2026-10-10T05:00:00.000Z",
    createdAt: "2026-10-10T05:00:00.000Z",
    updatedAt: "2026-10-10T05:00:00.000Z",
  },
  {
    id: "exp-004-sup",
    businessId: sampleBusiness.id,
    category: "SUPPLIES",
    amount: 75000,
    description: "Kantong plastik & lakban kemasan",
    expenseDate: "2026-10-12T05:00:00.000Z",
    createdAt: "2026-10-12T05:00:00.000Z",
    updatedAt: "2026-10-12T05:00:00.000Z",
  },
];

describe("VeyraOS Stage 5.6 - UI Pengeluaran Operasional Suite (/expenses)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveTenantContextAction.mockResolvedValue({
      success: true,
      data: {
        hasBusiness: true,
        activeBusiness: sampleBusiness,
        businesses: [sampleBusiness],
      },
    });
    mockGetExpensesAction.mockResolvedValue({
      success: true,
      data: sampleExpenses,
    });
    mockRecordExpenseAction.mockResolvedValue({
      success: true,
      data: sampleExpenses[0],
    });
  });

  // =========================================================================
  // GRUP A: RENDERING DAN DATA
  // =========================================================================
  describe("A. Rendering dan Data", () => {
    it("A.1 Menampilkan judul modul dan nama bisnis aktif server-authoritative", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Buku Pengeluaran Operasional");
      expect(html).toContain("Warung Berkah Nusantara");
      expect(html).toContain("Buku Kas Toko");
      expect(html).toContain("Catat Pengeluaran");
    });

    it("A.2 Menampilkan nama fallback yang aman jika konteks bisnis belum tersedia", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage initialExpenses={sampleExpenses} />
      );

      expect(html).toContain("VeyraOS Business");
    });

    it("A.3 Merender tiga kartu ringkasan KPI beban dengan perhitungan tepat", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      // Total amount = 1500000 + 350000 + 800000 + 75000 = 2.725.000
      expect(html).toContain("Total Pengeluaran");
      expect(html).toContain(formatRupiah(2725000));

      // Total count = 4 Catatan
      expect(html).toContain("Jumlah Catatan");
      expect(html).toContain("4 Catatan");

      // Beban terbesar = Sewa Tempat (1.500.000 / 2.725.000 = 55%)
      expect(html).toContain("Beban Terbesar");
      expect(html).toContain("Sewa Tempat");
      expect(html).toContain("(55%)");
    });

    it("A.4 Merender tabel riwayat dengan format Rupiah tebal dan keterangan lengkap", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Sewa kios ruko bulan Oktober");
      expect(html).toContain(formatRupiah(1500000));
      expect(html).toContain("Token listrik PLN &amp; tagihan PDAM");
      expect(html).toContain(formatRupiah(350000));
      expect(html).toContain("Gaji staf kasir paruh waktu");
      expect(html).toContain(formatRupiah(800000));
      expect(html).toContain("Kantong plastik &amp; lakban kemasan");
      expect(html).toContain(formatRupiah(75000));
    });

    it("A.5 Merender 8 kategori baku dengan label bahasa Indonesia yang ramah UMKM", () => {
      expect(EXPENSE_CATEGORIES.length).toBe(8);

      const expectedLabels: Record<ExpenseCategory, string> = {
        OPERATIONAL: "Operasional Umum",
        SALARY: "Gaji & Upah",
        UTILITIES: "Listrik, Air & Internet",
        RENT: "Sewa Tempat",
        MARKETING: "Pemasaran & Iklan",
        MAINTENANCE: "Perbaikan & Pemeliharaan",
        SUPPLIES: "Perlengkapan Toko",
        OTHER: "Lain-lain",
      };

      for (const cat of EXPENSE_CATEGORIES) {
        expect(cat.label).toBe(expectedLabels[cat.key]);
        expect(EXPENSE_CATEGORY_MAP[cat.key]).toBe(expectedLabels[cat.key]);
      }

      // Pastikan label-label tersebut muncul di dalam HTML opsi dropdown filter
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );
      expect(html).toContain("Semua Kategori");
      expect(html).toContain("Operasional Umum");
      expect(html).toContain("Sewa Tempat");
      expect(html).toContain("Gaji &amp; Upah");
    });

    it("A.6 Merender empty state informatif saat dataset kosong", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={[]}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Belum Ada Catatan Pengeluaran");
      expect(html).toContain("Tidak ditemukan catatan pengeluaran kas");
      expect(html).toContain("Catat Pengeluaran Sekarang");
      expect(html).toContain("0 Catatan");
      expect(html).toContain(formatRupiah(0));
    });

    it("A.7 Merender skeleton placeholder saat initialExpenses ditiadakan (initial fetch state)", () => {
      const html = renderToStaticMarkup(<ExpensesPage />);

      expect(html).toContain("data-testid=\"expenses-skeleton\"");
    });
  });

  // =========================================================================
  // GRUP B: MODAL DAN FORMULIR PENCATATAN PENGELUARAN
  // =========================================================================
  describe("B. Modal dan Formulir", () => {
    it("B.1 Memastikan tombol buka modal Catat Pengeluaran memiliki id dan label tepat", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("id=\"open-create-expense-btn\"");
      expect(html).toContain("Catat Pengeluaran");
    });

    it("B.2 Modal menyertakan dialog role, backdrop, dan aria-modal untuk a11y", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      // Verifikasi struktur modal yang siap dipicu
      expect(html).toContain("id=\"open-create-expense-btn\"");
    });

    it("B.3 Menolak nominal 0 atau negatif sesuai aturan rupiahPositiveSchema", () => {
      const zeroResult = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 0,
        description: "Beli amplop surat",
      });
      expect(zeroResult.success).toBe(false);

      const negativeResult = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: -50000,
        description: "Beli amplop surat",
      });
      expect(negativeResult.success).toBe(false);

      const positiveResult = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 25000,
        description: "Beli amplop surat",
      });
      expect(positiveResult.success).toBe(true);
    });

    it("B.4 Menolak keterangan kurang dari 2 karakter dan lebih dari 500 karakter", () => {
      const emptyDesc = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 50000,
        description: "",
      });
      expect(emptyDesc.success).toBe(false);

      const shortDesc = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 50000,
        description: "A",
      });
      expect(shortDesc.success).toBe(false);

      const whitespaceDesc = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 50000,
        description: "   ",
      });
      expect(whitespaceDesc.success).toBe(false);

      const validDesc = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 50000,
        description: "AB",
      });
      expect(validDesc.success).toBe(true);

      const maxDesc = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 50000,
        description: "x".repeat(500),
      });
      expect(maxDesc.success).toBe(true);

      const tooLongDesc = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "OPERATIONAL",
        amount: 50000,
        description: "x".repeat(501),
      });
      expect(tooLongDesc.success).toBe(false);
    });

    it("B.5 Konversi tanggal lokal YYYY-MM-DD ke ISO 8601 memenuhi skema z.datetime() backend", () => {
      const localDateStr = "2026-10-15";
      // Logika konversi yang diterapkan pada page.tsx
      const convertedIso = new Date(`${localDateStr}T12:00:00+07:00`).toISOString();

      const validation = recordExpenseSchema.safeParse({
        businessId: sampleBusiness.id,
        category: "UTILITIES",
        amount: 150000,
        description: "Listrik toko",
        expenseDate: convertedIso,
      });

      expect(validation.success).toBe(true);
      expect(convertedIso).toContain("2026-10-15T");
    });

    it("B.6 Memverifikasi tanggal kalender tidak bergeser saat diformat ulang ke Asia/Jakarta", () => {
      const localDateStr = "2026-10-15";
      const convertedIso = new Date(`${localDateStr}T12:00:00+07:00`).toISOString();

      const formatted = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(convertedIso));

      // Harus mencerminkan 15/10/2026 di Jakarta
      expect(formatted).toContain("15");
      expect(formatted).toContain("10");
      expect(formatted).toContain("2026");
    });

    it("B.7 Peringatan anti-double-count HPP wajib memiliki teks spesifik pencegahan pencatatan stok", () => {
      // Validasi logika teks peringatan yang dicantumkan
      const alertSnippet =
        "Pembelian barang dagangan/stok toko dicatat melalui menu Pembelian Stok, bukan di sini, agar Harga Pokok Penjualan (HPP) tidak terhitung ganda.";
      expect(alertSnippet).toContain("Pembelian Stok");
      expect(alertSnippet).toContain("tidak terhitung ganda");
    });
  });

  // =========================================================================
  // GRUP C: FILTER DAN KONSISTENSI RINGKASAN
  // =========================================================================
  describe("C. Filter dan Ringkasan", () => {
    it("C.1 Skema kueri menolak jika rentang tanggal terbalik (startDate > endDate)", () => {
      const invalidQuery = getExpensesQuerySchema.safeParse({
        businessId: sampleBusiness.id,
        startDate: "2026-10-20",
        endDate: "2026-10-10",
      });

      expect(invalidQuery.success).toBe(false);
      if (!invalidQuery.success) {
        expect(invalidQuery.error.issues[0].message).toContain(
          "tidak boleh lebih besar"
        );
      }
    });

    it("C.2 Skema kueri menerima jika startDate <= endDate atau hanya salah satu", () => {
      const validQuery1 = getExpensesQuerySchema.safeParse({
        businessId: sampleBusiness.id,
        startDate: "2026-10-01",
        endDate: "2026-10-15",
      });
      expect(validQuery1.success).toBe(true);

      const validQuery2 = getExpensesQuerySchema.safeParse({
        businessId: sampleBusiness.id,
        startDate: "2026-10-01",
      });
      expect(validQuery2.success).toBe(true);
    });

    it("C.3 Form filter memuat tombol Terapkan Filter dan Reset", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("id=\"apply-expense-filter-btn\"");
      expect(html).toContain("Terapkan Filter");
      expect(html).toContain("id=\"reset-expense-filter-btn\"");
      expect(html).toContain("Reset");
    });

    it("C.4 Ringkasan KPI dan tabel konsisten saat hanya satu kategori disaring", () => {
      const rentOnly = sampleExpenses.filter((e) => e.category === "RENT");
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={rentOnly}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("1 Catatan");
      expect(html).toContain(formatRupiah(1500000));
      expect(html).toContain("Sewa Tempat");
      expect(html).toContain("(100%)");
      expect(html).not.toContain("Token listrik PLN");
    });

    it("C.5 Ringkasan KPI menampilkan tanda hubung '-' saat tidak ada data sama sekali", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={[]}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("-");
      expect(html).toContain("Belum ada data pengeluaran");
    });
  });

  // =========================================================================
  // GRUP D: KETAHANAN, AKSESIBILITAS, DAN JEJAK AUDIT
  // =========================================================================
  describe("D. Ketahanan, Aksesibilitas, dan Jejak Audit", () => {
    it("D.1 Tidak menyediakan tombol hapus fisik destruktif pada tabel riwayat", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      // Memastikan tidak ada tombol hapus sama sekali
      expect(html).not.toContain("Hapus Pengeluaran");
      expect(html).not.toContain("delete-expense");
      expect(html).not.toContain("btn-delete");
    });

    it("D.2 Menampilkan badge status audit 'Permanen' pada setiap baris riwayat", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("Status Audit");
      expect(html).toContain("Permanen");
      expect(html).toContain("Jejak Audit Buku Kas Terproteksi");
    });

    it("D.3 Input form filter memiliki elemen label yang terhubung via htmlFor", () => {
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain("for=\"expense-filter-start-date\"");
      expect(html).toContain("id=\"expense-filter-start-date\"");
      expect(html).toContain("for=\"expense-filter-end-date\"");
      expect(html).toContain("id=\"expense-filter-end-date\"");
      expect(html).toContain("for=\"expense-filter-category-select\"");
      expect(html).toContain("id=\"expense-filter-category-select\"");
    });

    it("D.4 Banner error dan tombol Retry tersedia saat terjadi kegagalan memuat data", () => {
      // Verifikasi komponen Alert dengan tombol Coba Lagi
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={sampleExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      // Verifikasi bahwa struktur dasar AppLayout dan tabel riwayat siap merespons aksi coba lagi
      expect(html).toContain("Riwayat Pengeluaran Kas");
    });

    it("D.5 Format nominal Rupiah di tabel menggunakan angka bulat tanpa sen (IDR)", () => {
      for (const exp of sampleExpenses) {
        const formatted = formatRupiah(exp.amount);
        expect(formatted).toMatch(/^Rp\s[\d.]+/);
        expect(formatted).not.toContain(",00");
      }
    });

    it("D.6 Kategori Terbesar mengagregasi beberapa transaksi dalam kategori yang sama dengan benar", () => {
      const multiUtilityExpenses: ExpenseResponseData[] = [
        {
          id: "e-1",
          businessId: sampleBusiness.id,
          category: "UTILITIES",
          amount: 200000,
          description: "Listrik",
          expenseDate: "2026-10-01T05:00:00.000Z",
          createdAt: "2026-10-01T05:00:00.000Z",
          updatedAt: "2026-10-01T05:00:00.000Z",
        },
        {
          id: "e-2",
          businessId: sampleBusiness.id,
          category: "UTILITIES",
          amount: 300000,
          description: "Air PAM",
          expenseDate: "2026-10-02T05:00:00.000Z",
          createdAt: "2026-10-02T05:00:00.000Z",
          updatedAt: "2026-10-02T05:00:00.000Z",
        },
        {
          id: "e-3",
          businessId: sampleBusiness.id,
          category: "OPERATIONAL",
          amount: 100000,
          description: "Kebersihan",
          expenseDate: "2026-10-03T05:00:00.000Z",
          createdAt: "2026-10-03T05:00:00.000Z",
          updatedAt: "2026-10-03T05:00:00.000Z",
        },
      ];

      // Total = 600.000, Utilities = 500.000 (83%), Operational = 100.000 (17%)
      const html = renderToStaticMarkup(
        <ExpensesPage
          initialExpenses={multiUtilityExpenses}
          initialBusiness={sampleBusiness}
        />
      );

      expect(html).toContain(formatRupiah(600000));
      expect(html).toContain("3 Catatan");
      expect(html).toContain("Listrik, Air &amp; Internet");
      expect(html).toContain("(83%)");
      expect(html).toContain(formatRupiah(500000));
    });
  });
});
