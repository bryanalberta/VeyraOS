import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  rupiahSchema,
  rupiahPositiveSchema,
  quantitySchema,
  idempotencyKeySchema,
  signUpSchema,
  signInSchema,
  updateProfileSchema,
  createBusinessSchema,
  updateBusinessSchema,
  createProductSchema,
  updateProductSchema,
  saleItemInputSchema,
  recordSaleSchema,
  voidSaleSchema,
  purchaseItemInputSchema,
  recordPurchaseSchema,
  recordExpenseSchema,
  getExpensesQuerySchema,
  isoDateStringSchema,
  pageSchema,
  pageSizeSchema,
  saleStatusSchema,
  dashboardQuerySchema,
  salesReportQuerySchema,
  expenseReportQuerySchema,
  stockReportQuerySchema,
  exportReportQuerySchema,
} from "./index";

describe("Validation Schemas Suite (src/lib/validations)", () => {
  const validUuid = "11111111-1111-4111-a111-111111111111";
  const validIdempotencyKey = "idem_key_unique_12345";

  describe("Common Validation Primitives", () => {
    it("validates valid UUID and rejects invalid string format", () => {
      expect(uuidSchema.safeParse(validUuid).success).toBe(true);
      expect(uuidSchema.safeParse("invalid-uuid").success).toBe(false);
      expect(uuidSchema.safeParse("").success).toBe(false);
    });

    it("enforces non-negative integer Rupiah and rejects decimal cents or negative values", () => {
      expect(rupiahSchema.safeParse(0).success).toBe(true);
      expect(rupiahSchema.safeParse(150000).success).toBe(true);

      // Desimal / sen ditolak
      const decimalResult = rupiahSchema.safeParse(15000.75);
      expect(decimalResult.success).toBe(false);
      if (!decimalResult.success) {
        expect(decimalResult.error.issues[0].message).toMatch(/bilangan bulat/);
      }

      // Nilai negatif ditolak
      const negativeResult = rupiahSchema.safeParse(-5000);
      expect(negativeResult.success).toBe(false);
      if (!negativeResult.success) {
        expect(negativeResult.error.issues[0].message).toMatch(/tidak boleh bernilai negatif/);
      }
    });

    it("enforces strictly positive Rupiah (> 0) for rupiahPositiveSchema", () => {
      expect(rupiahPositiveSchema.safeParse(1).success).toBe(true);
      expect(rupiahPositiveSchema.safeParse(100000).success).toBe(true);
      expect(rupiahPositiveSchema.safeParse(0).success).toBe(false);
      expect(rupiahPositiveSchema.safeParse(-10).success).toBe(false);
    });

    it("enforces positive integer and PostgreSQL 32-bit integer bound for quantitySchema", () => {
      expect(quantitySchema.safeParse(1).success).toBe(true);
      expect(quantitySchema.safeParse(10).success).toBe(true);
      expect(quantitySchema.safeParse(2_147_483_647).success).toBe(true);
      expect(quantitySchema.safeParse(2_147_483_648).success).toBe(false); // Overflow PostgreSQL INTEGER
      expect(quantitySchema.safeParse(0).success).toBe(false);
      expect(quantitySchema.safeParse(-2).success).toBe(false);
      expect(quantitySchema.safeParse(1.5).success).toBe(false);
    });

    it("enforces length between 8 and 128 characters for idempotencyKeySchema", () => {
      expect(idempotencyKeySchema.safeParse(validIdempotencyKey).success).toBe(true);
      expect(idempotencyKeySchema.safeParse("short").success).toBe(false); // < 8
      expect(idempotencyKeySchema.safeParse("a".repeat(129)).success).toBe(false); // > 128
    });
  });

  describe("Authentication Schemas", () => {
    it("validates valid sign up input and rejects short password / invalid email", () => {
      const valid = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "budi@example.com",
        password: "securePassword123",
      });
      expect(valid.success).toBe(true);

      const shortName = signUpSchema.safeParse({
        fullName: "B",
        email: "budi@example.com",
        password: "securePassword123",
      });
      expect(shortName.success).toBe(false);

      const invalidEmail = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "not-an-email",
        password: "securePassword123",
      });
      expect(invalidEmail.success).toBe(false);

      const shortPassword = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "budi@example.com",
        password: "short",
      });
      expect(shortPassword.success).toBe(false);
    });

    it("validates sign in input", () => {
      expect(
        signInSchema.safeParse({
          email: "user@toko.com",
          password: "password123",
        }).success
      ).toBe(true);

      expect(
        signInSchema.safeParse({
          email: "invalid",
          password: "",
        }).success
      ).toBe(false);
    });
    it("validates update profile input and enforces min 2 and max 100 characters", () => {
      const valid = updateProfileSchema.safeParse({
        fullName: "Budi Santoso",
      });
      expect(valid.success).toBe(true);

      const tooShort = updateProfileSchema.safeParse({
        fullName: "B",
      });
      expect(tooShort.success).toBe(false);

      const tooLong = updateProfileSchema.safeParse({
        fullName: "A".repeat(101),
      });
      expect(tooLong.success).toBe(false);

      const empty = updateProfileSchema.safeParse({
        fullName: "",
      });
      expect(empty.success).toBe(false);
    });
  });

  describe("Business Schemas", () => {
    it("validates business creation within 2 to 60 characters", () => {
      const valid = createBusinessSchema.safeParse({
        name: "Toko Berkah Mandiri",
        category: "Sembako",
        phone: "081234567890",
        address: "Jl. Merdeka No. 10",
      });
      expect(valid.success).toBe(true);

      const tooShort = createBusinessSchema.safeParse({ name: "T" });
      expect(tooShort.success).toBe(false);

      const tooLong = createBusinessSchema.safeParse({
        name: "Toko ".repeat(20),
      });
      expect(tooLong.success).toBe(false);
    });

    it("validates business update and requires at least one metadata field", () => {
      // Valid dengan satu field
      const validName = updateBusinessSchema.safeParse({
        name: "Toko Berkah Jaya",
      });
      expect(validName.success).toBe(true);

      // Valid dengan semua field
      const validAll = updateBusinessSchema.safeParse({
        businessId: validUuid,
        name: "Toko Berkah Baru",
        category: "Retail",
        phone: "081299998888",
        address: "Jl. Baru No. 5",
      });
      expect(validAll.success).toBe(true);

      // Ditolak jika kosong tanpa field metadata sama sekali
      const emptyFields = updateBusinessSchema.safeParse({});
      expect(emptyFields.success).toBe(false);
      if (!emptyFields.success) {
        expect(emptyFields.error.issues[0].message).toMatch(
          /Setidaknya satu field metadata usaha harus disertakan/
        );
      }

      // Ditolak jika hanya businessId tanpa metadata yang diubah
      const onlyId = updateBusinessSchema.safeParse({
        businessId: validUuid,
      });
      expect(onlyId.success).toBe(false);

      // Ditolak jika nama terlalu pendek
      const shortName = updateBusinessSchema.safeParse({
        name: "A",
      });
      expect(shortName.success).toBe(false);

      // Ditolak jika businessId bukan UUID valid
      const invalidId = updateBusinessSchema.safeParse({
        businessId: "not-a-uuid",
        name: "Toko Baru",
      });
      expect(invalidId.success).toBe(false);
    });
  });

  describe("Product & Inventory Schemas", () => {
    it("validates product creation with non-negative prices and integer stock", () => {
      const valid = createProductSchema.safeParse({
        businessId: validUuid,
        name: "Beras Premium 5kg",
        sku: "BRS-001",
        category: "Bahan Pokok",
        sellingPrice: 75000,
        costPrice: 62000,
        stockQuantity: 20,
      });
      expect(valid.success).toBe(true);

      const invalidPrices = createProductSchema.safeParse({
        businessId: validUuid,
        name: "Minyak Goreng",
        sellingPrice: -1000,
        costPrice: 12000.5,
        stockQuantity: -5,
      });
      expect(invalidPrices.success).toBe(false);
    });

    it("validates product partial update", () => {
      const valid = updateProductSchema.safeParse({
        businessId: validUuid,
        productId: validUuid,
        sellingPrice: 80000,
        isArchived: true,
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Sales & POS Schemas", () => {
    it("validates line item input and enforces minimum 1 unit quantity", () => {
      const valid = saleItemInputSchema.safeParse({
        productId: validUuid,
        quantity: 2,
        itemDiscount: 5000,
      });
      expect(valid.success).toBe(true);

      const zeroQty = saleItemInputSchema.safeParse({
        productId: validUuid,
        quantity: 0,
      });
      expect(zeroQty.success).toBe(false);
    });

    it("validates complete record sale input and requires at least 1 item", () => {
      const valid = recordSaleSchema.safeParse({
        businessId: validUuid,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CASH",
        items: [
          { productId: validUuid, quantity: 1, itemDiscount: 0 },
        ],
        transactionDiscount: 2000,
        notes: "Pelanggan reguler",
      });
      expect(valid.success).toBe(true);

      const emptyItems = recordSaleSchema.safeParse({
        businessId: validUuid,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "BANK_TRANSFER",
        items: [],
      });
      expect(emptyItems.success).toBe(false);

      const invalidMethod = recordSaleSchema.safeParse({
        businessId: validUuid,
        idempotencyKey: validIdempotencyKey,
        paymentMethod: "CREDIT_CARD", // Tidak didukung di MVP
        items: [{ productId: validUuid, quantity: 1 }],
      });
      expect(invalidMethod.success).toBe(false);
    });

    it("enforces minimum 5 characters for void reason", () => {
      const valid = voidSaleSchema.safeParse({
        businessId: validUuid,
        saleId: validUuid,
        voidReason: "Salah input nominal oleh kasir",
      });
      expect(valid.success).toBe(true);

      const tooShort = voidSaleSchema.safeParse({
        businessId: validUuid,
        saleId: validUuid,
        voidReason: "salah", // 5 karakter
      });
      expect(tooShort.success).toBe(true);

      const underFive = voidSaleSchema.safeParse({
        businessId: validUuid,
        saleId: validUuid,
        voidReason: "test", // 4 karakter -> ditolak
      });
      expect(underFive.success).toBe(false);
      if (!underFive.success) {
        expect(underFive.error.issues[0].message).toMatch(/minimal 5 karakter/);
      }
    });

    it("validates saleStatusSchema and accepts COMPLETED or VOIDED", () => {
      expect(saleStatusSchema.safeParse("COMPLETED").success).toBe(true);
      expect(saleStatusSchema.safeParse("VOIDED").success).toBe(true);
      expect(saleStatusSchema.safeParse("PENDING").success).toBe(false);
    });
  });


  describe("Inventory Purchase (Restock) Schemas", () => {
    it("validates purchase restock items and header", () => {
      const validItem = purchaseItemInputSchema.safeParse({
        productId: validUuid,
        quantity: 10,
        unitPurchaseCost: 15000,
      });
      expect(validItem.success).toBe(true);

      const validPurchase = recordPurchaseSchema.safeParse({
        businessId: validUuid,
        supplierName: "PT Sumber Pangan",
        items: [
          { productId: validUuid, quantity: 10, unitPurchaseCost: 15000 },
        ],
        notes: "Pengiriman sore",
      });
      expect(validPurchase.success).toBe(true);

      const emptyPurchase = recordPurchaseSchema.safeParse({
        businessId: validUuid,
        items: [],
      });
      expect(emptyPurchase.success).toBe(false);
    });
  });

  describe("Operational Expenses Schemas", () => {
    it("validates operational expense input and enforces canonical category enum", () => {
      const valid = recordExpenseSchema.safeParse({
        businessId: validUuid,
        category: "UTILITIES",
        amount: 250000,
        description: "Tagihan listrik toko bulan Oktober",
      });
      expect(valid.success).toBe(true);

      const invalidCategory = recordExpenseSchema.safeParse({
        businessId: validUuid,
        category: "NON_EXISTENT_CATEGORY",
        amount: 50000,
        description: "Pembelian ATK",
      });
      expect(invalidCategory.success).toBe(false);

      const zeroAmount = recordExpenseSchema.safeParse({
        businessId: validUuid,
        category: "OPERATIONAL",
        amount: 0,
        description: "Operasional",
      });
      expect(zeroAmount.success).toBe(false);

      const shortDesc = recordExpenseSchema.safeParse({
        businessId: validUuid,
        category: "OPERATIONAL",
        amount: 10000,
        description: "A", // < 2 chars
      });
      expect(shortDesc.success).toBe(false);
    });

    it("validates ISO 8601 date formats and rejects invalid date strings with isoDateStringSchema", () => {
      expect(isoDateStringSchema.safeParse("2026-10-01").success).toBe(true);
      expect(isoDateStringSchema.safeParse("2026-10-01T12:00:00Z").success).toBe(true);
      expect(isoDateStringSchema.safeParse("2026-10-01T12:00:00+07:00").success).toBe(true);
      expect(isoDateStringSchema.safeParse("not-a-date").success).toBe(false);
      expect(isoDateStringSchema.safeParse("2026/10/01").success).toBe(false);
      expect(isoDateStringSchema.safeParse("2026-13-45").success).toBe(false);
    });

    it("validates getExpensesQuerySchema and rejects inverted date range (startDate > endDate)", () => {
      // Rentang valid
      expect(
        getExpensesQuerySchema.safeParse({
          businessId: validUuid,
          startDate: "2026-10-01T00:00:00Z",
          endDate: "2026-10-31T23:59:59Z",
        }).success
      ).toBe(true);

      // Tanggal sama (startDate == endDate) valid
      expect(
        getExpensesQuerySchema.safeParse({
          businessId: validUuid,
          startDate: "2026-10-01",
          endDate: "2026-10-01",
        }).success
      ).toBe(true);

      // Hanya startDate
      expect(
        getExpensesQuerySchema.safeParse({
          businessId: validUuid,
          startDate: "2026-10-01",
        }).success
      ).toBe(true);

      // Hanya endDate
      expect(
        getExpensesQuerySchema.safeParse({
          businessId: validUuid,
          endDate: "2026-10-31",
        }).success
      ).toBe(true);

      // Rentang terbalik ditolak
      const inverted = getExpensesQuerySchema.safeParse({
        businessId: validUuid,
        startDate: "2026-10-31T00:00:00Z",
        endDate: "2026-10-01T00:00:00Z",
      });
      expect(inverted.success).toBe(false);
      if (!inverted.success) {
        expect(inverted.error.issues[0].message).toContain(
          "tidak boleh lebih besar dari tanggal akhir"
        );
      }
    });
  });

  describe("Pagination Primitives (pageSchema & pageSizeSchema)", () => {
    it("memvalidasi pageSchema dengan nilai default 1 dan koersi angka", () => {
      expect(pageSchema.parse(undefined)).toBe(1);
      expect(pageSchema.parse("3")).toBe(3);
      expect(pageSchema.safeParse(0).success).toBe(false);
      expect(pageSchema.safeParse(-1).success).toBe(false);
    });

    it("memvalidasi pageSizeSchema dengan batas 1 s/d 100 dan nilai default 50", () => {
      expect(pageSizeSchema.parse(undefined)).toBe(50);
      expect(pageSizeSchema.parse("25")).toBe(25);
      expect(pageSizeSchema.safeParse(100).success).toBe(true);
      expect(pageSizeSchema.safeParse(101).success).toBe(false);
      expect(pageSizeSchema.safeParse(0).success).toBe(false);
    });
  });

  describe("Report & Export Schemas", () => {
    describe("dashboardQuerySchema", () => {
      it("memvalidasi parameter dashboard yang valid dengan atau tanpa tanggal", () => {
        expect(
          dashboardQuerySchema.safeParse({
            businessId: validUuid,
          }).success
        ).toBe(true);

        expect(
          dashboardQuerySchema.safeParse({
            businessId: validUuid,
            startDate: "2026-10-01",
            endDate: "2026-10-07",
          }).success
        ).toBe(true);
      });

      it("menolak UUID tidak valid dan format tanggal non-ISO", () => {
        expect(
          dashboardQuerySchema.safeParse({
            businessId: "invalid-id",
          }).success
        ).toBe(false);

        expect(
          dashboardQuerySchema.safeParse({
            businessId: validUuid,
            startDate: "01/10/2026",
          }).success
        ).toBe(false);
      });

      it("menolak rentang tanggal terbalik (startDate > endDate)", () => {
        const result = dashboardQuerySchema.safeParse({
          businessId: validUuid,
          startDate: "2026-10-15",
          endDate: "2026-10-01",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            "tidak boleh lebih besar dari tanggal akhir"
          );
        }
      });
    });

    describe("salesReportQuerySchema", () => {
      it("menerapkan nilai default page=1 dan pageSize=50 serta memvalidasi status penjualan", () => {
        const parsed = salesReportQuerySchema.parse({
          businessId: validUuid,
        });
        expect(parsed.page).toBe(1);
        expect(parsed.pageSize).toBe(50);
        expect(parsed.status).toBeUndefined();

        const withStatus = salesReportQuerySchema.safeParse({
          businessId: validUuid,
          status: "COMPLETED",
          page: "2",
          pageSize: "25",
        });
        expect(withStatus.success).toBe(true);
        if (withStatus.success) {
          expect(withStatus.data.page).toBe(2);
          expect(withStatus.data.pageSize).toBe(25);
          expect(withStatus.data.status).toBe("COMPLETED");
        }
      });

      it("menolak status penjualan tidak valid dan pageSize melebihi 100", () => {
        expect(
          salesReportQuerySchema.safeParse({
            businessId: validUuid,
            status: "REFUNDED", // Bukan COMPLETED | VOIDED
          }).success
        ).toBe(false);

        expect(
          salesReportQuerySchema.safeParse({
            businessId: validUuid,
            pageSize: 150,
          }).success
        ).toBe(false);
      });

      it("menolak rentang tanggal penjualan terbalik", () => {
        const result = salesReportQuerySchema.safeParse({
          businessId: validUuid,
          startDate: "2026-10-31",
          endDate: "2026-10-01",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("expenseReportQuerySchema", () => {
      it("memvalidasi kueri laporan beban dengan filter kategori kanonikal", () => {
        expect(
          expenseReportQuerySchema.safeParse({
            businessId: validUuid,
            category: "OPERATIONAL",
          }).success
        ).toBe(true);

        expect(
          expenseReportQuerySchema.safeParse({
            businessId: validUuid,
            category: "INVALID_CAT",
          }).success
        ).toBe(false);
      });

      it("menolak rentang tanggal terbalik pada laporan beban", () => {
        expect(
          expenseReportQuerySchema.safeParse({
            businessId: validUuid,
            startDate: "2026-10-31",
            endDate: "2026-10-01",
          }).success
        ).toBe(false);
      });
    });

    describe("stockReportQuerySchema", () => {
      it("memvalidasi filter laporan persediaan dan opsi lowStockOnly", () => {
        expect(
          stockReportQuerySchema.safeParse({
            businessId: validUuid,
            category: "Sembako",
            lowStockOnly: true,
            isArchived: false,
          }).success
        ).toBe(true);

        expect(
          stockReportQuerySchema.safeParse({
            businessId: validUuid,
            category: "A".repeat(51), // > 50 chars
          }).success
        ).toBe(false);
      });
    });

    describe("exportReportQuerySchema", () => {
      it("memvalidasi tipe ekspor laporan kanonikal (SALES, EXPENSES, STOCK)", () => {
        expect(
          exportReportQuerySchema.safeParse({
            businessId: validUuid,
            type: "SALES",
            startDate: "2026-10-01",
            endDate: "2026-10-07",
          }).success
        ).toBe(true);

        expect(
          exportReportQuerySchema.safeParse({
            businessId: validUuid,
            type: "EXPENSES",
          }).success
        ).toBe(true);

        expect(
          exportReportQuerySchema.safeParse({
            businessId: validUuid,
            type: "STOCK",
          }).success
        ).toBe(true);

        expect(
          exportReportQuerySchema.safeParse({
            businessId: validUuid,
            type: "INVALID_REPORT",
          }).success
        ).toBe(false);
      });

      it("menolak rentang tanggal terbalik pada permintaan ekspor", () => {
        expect(
          exportReportQuerySchema.safeParse({
            businessId: validUuid,
            type: "SALES",
            startDate: "2026-10-20",
            endDate: "2026-10-10",
          }).success
        ).toBe(false);
      });
    });
  });
});

