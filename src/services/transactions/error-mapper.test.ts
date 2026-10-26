import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  mapDatabaseErrorToApiResponse,
  formatZodErrorDetails,
} from "./error-mapper";

describe("Database Error Mapper Suite (src/services/transactions/error-mapper)", () => {
  describe("1. mapDatabaseErrorToApiResponse — PRODUCT_ARCHIVED Mapping", () => {
    it("1.1 memetakan error RPC PRODUCT_ARCHIVED dengan pesan custom dari database", () => {
      const dbError = {
        message:
          'PRODUCT_ARCHIVED: Produk "Beras Ramos 5kg" telah diarsipkan dan tidak dapat dijual',
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PRODUCT_ARCHIVED");
        expect(result.error.message).toBe(
          'Produk "Beras Ramos 5kg" telah diarsipkan dan tidak dapat dijual'
        );
      }
    });

    it("1.2 memetakan error RPC PRODUCT_ARCHIVED tanpa teks tambahan ke pesan fallback default", () => {
      const dbError = {
        message: "PRODUCT_ARCHIVED",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PRODUCT_ARCHIVED");
        expect(result.error.message).toBe(
          "Produk telah diarsipkan dan tidak dapat digunakan dalam transaksi"
        );
      }
    });

    it("1.3 memetakan error RPC PRODUCT_ARCHIVED dengan prefix titik dua saja ke fallback default", () => {
      const dbError = {
        message: "PRODUCT_ARCHIVED:    ",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PRODUCT_ARCHIVED");
        expect(result.error.message).toBe(
          "Produk telah diarsipkan dan tidak dapat digunakan dalam transaksi"
        );
      }
    });
  });

  describe("2. mapDatabaseErrorToApiResponse — Domain Stored Procedure Errors", () => {
    it("2.1 memetakan error STOCK_INSUFFICIENT dengan pesan dinamis stok", () => {
      const dbError = {
        message: 'STOCK_INSUFFICIENT: Produk "Minyak Goreng 2L" sisa 2, diminta total 5',
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STOCK_INSUFFICIENT");
        expect(result.error.message).toBe(
          'Produk "Minyak Goreng 2L" sisa 2, diminta total 5'
        );
      }
    });

    it("2.2 memetakan error STOCK_INSUFFICIENT tanpa rincian ke pesan fallback default", () => {
      const dbError = {
        message: "STOCK_INSUFFICIENT: ",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STOCK_INSUFFICIENT");
        expect(result.error.message).toBe(
          "Stok produk tidak mencukupi untuk transaksi ini"
        );
      }
    });

    it("2.3 memetakan error PRODUCT_NOT_FOUND", () => {
      const dbError = {
        message: "PRODUCT_NOT_FOUND: e6c65306-0000-0000-0000-000000000000",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PRODUCT_NOT_FOUND");
        expect(result.error.message).toBe(
          "Satu atau lebih produk tidak ditemukan dalam katalog bisnis ini"
        );
      }
    });

    it("2.4 memetakan error UNAUTHORIZED_BUSINESS", () => {
      const dbError = {
        message: "UNAUTHORIZED_BUSINESS: User lacks membership",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED_BUSINESS");
        expect(result.error.message).toBe(
          "Pengguna tidak memiliki hak akses atau keanggotaan pada bisnis ini"
        );
      }
    });

    it("2.5 memetakan error INVALID_DISCOUNT", () => {
      const dbError = {
        message: "INVALID_DISCOUNT: transaction discount cannot exceed subtotal",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_DISCOUNT");
        expect(result.error.message).toBe(
          "Nominal diskon tidak valid atau melebihi total subtotal"
        );
      }
    });

    it("2.6 memetakan error SALE_ALREADY_VOIDED", () => {
      const dbError = {
        message: "SALE_ALREADY_VOIDED: sale is already voided",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SALE_ALREADY_VOIDED");
        expect(result.error.message).toBe(
          "Transaksi penjualan ini sudah pernah dibatalkan sebelumnya"
        );
      }
    });
  });

  describe("3. mapDatabaseErrorToApiResponse — PostgreSQL SQLSTATE Violations", () => {
    it("3.1 memetakan benturan invoice penjualan (23505 uq_sales_invoice) ke INVOICE_COLLISION", () => {
      const dbError = {
        code: "23505",
        message: 'duplicate key value violates unique constraint "uq_sales_invoice"',
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVOICE_COLLISION");
        expect(result.error.message).toContain("benturan nomor faktur");
      }
    });

    it("3.2 memetakan benturan SKU per bisnis (23505 uq_products_sku_per_business) ke SKU_ALREADY_EXISTS", () => {
      const dbError = {
        code: "23505",
        message: 'duplicate key value violates unique constraint "uq_products_sku_per_business"',
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SKU_ALREADY_EXISTS");
        expect(result.error.message).toContain("SKU produk sudah digunakan");
      }
    });

    it("3.3 memetakan Foreign Key Violation (23503) ke FOREIGN_KEY_VIOLATION", () => {
      const dbError = {
        code: "23503",
        message: 'insert or update on table "products" violates foreign key constraint',
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FOREIGN_KEY_VIOLATION");
      }
    });

    it("3.4 memetakan Check Constraint Violation (23514) ke CHECK_CONSTRAINT_VIOLATION", () => {
      const dbError = {
        code: "23514",
        message: 'new row for relation "products" violates check constraint "products_selling_price_check"',
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CHECK_CONSTRAINT_VIOLATION");
      }
    });
  });

  describe("4. mapDatabaseErrorToApiResponse — Network Errors & Safe Fallbacks", () => {
    it("4.1 memetakan kegagalan jaringan (fetch failed) ke NETWORK_ERROR", () => {
      const dbError = {
        message: "TypeError: fetch failed",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NETWORK_ERROR");
        expect(result.error.message).toContain("koneksi internet");
      }
    });

    it("4.2 memetakan timeout jaringan ke NETWORK_ERROR", () => {
      const dbError = {
        message: "PostgREST connection timeout after 5000ms",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NETWORK_ERROR");
      }
    });

    it("4.3 menangani input error falsy / null dengan INTERNAL_ERROR aman", () => {
      const result = mapDatabaseErrorToApiResponse(null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
        expect(result.error.message).toContain("tidak terduga");
      }
    });

    it("4.4 menangani error database yang tidak dikenal dengan DATABASE_ERROR sanitized", () => {
      const dbError = {
        message: "SELECT * FROM secret_internal_table WHERE id = 123",
        code: "99999",
      };

      const result = mapDatabaseErrorToApiResponse(dbError);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("DATABASE_ERROR");
        expect(result.error.message).toBe(
          "Terjadi kendala pada basis data saat memproses transaksi"
        );
        // Memastikan tidak membocorkan query SQL internal
        expect(result.error.message).not.toContain("secret_internal_table");
      }
    });
  });

  describe("5. formatZodErrorDetails", () => {
    const dummySchema = z.object({
      name: z.string().min(2, "Nama minimal 2 karakter"),
      price: z.number().positive("Harga harus lebih dari 0"),
    });

    it("5.1 memformat ZodError menjadi Record<string, string[]> yang ramah form UI", () => {
      const parseResult = dummySchema.safeParse({ name: "A", price: -500 });
      expect(parseResult.success).toBe(false);

      if (!parseResult.success) {
        const details = formatZodErrorDetails(parseResult.error);
        expect(details.name).toContain("Nama minimal 2 karakter");
        expect(details.price).toContain("Harga harus lebih dari 0");
      }
    });

    it("5.2 menangani issue Zod tanpa path dengan fallback key root", () => {
      const rootIssue: z.ZodIssue = {
        code: "custom",
        path: [],
        message: "Custom root error message",
      };
      const zodError = new z.ZodError([rootIssue]);

      const details = formatZodErrorDetails(zodError);
      expect(details.root).toBeDefined();
      expect(details.root).toContain("Custom root error message");
    });
  });
});
