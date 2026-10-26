import { beforeEach, describe, expect, it } from "vitest";
import {
  processPurchaseTransaction,
  processSaleTransaction,
  processVoidSaleTransaction,
  type IdempotencyStoreEntry,
  type ProductInventoryState,
} from "./transactions";

describe("Atomic Transaction Rules & RPC Validation Suite (src/lib/transactions.ts)", () => {
  const businessA = "biz-uuid-aaaa-1111";
  const businessB = "biz-uuid-bbbb-2222";
  const userA = "user-uuid-1111-aaaa";
  const userB = "user-uuid-2222-bbbb";

  const memberships = [
    { businessId: businessA, userId: userA },
    { businessId: businessB, userId: userB },
  ];

  let inventory: Map<string, ProductInventoryState>;
  let idempotencyStore: Map<string, IdempotencyStoreEntry>;
  let salesStore: Map<
    string,
    {
      id: string;
      businessId: string;
      status: "COMPLETED" | "VOIDED";
      items: Array<{ productId: string; quantity: number }>;
    }
  >;

  beforeEach(() => {
    inventory = new Map([
      [
        "prod-1",
        {
          id: "prod-1",
          businessId: businessA,
          name: "Beras Rojolele 5kg",
          sellingPrice: 75000,
          costPrice: 60000,
          stockQuantity: 20,
        },
      ],
      [
        "prod-2",
        {
          id: "prod-2",
          businessId: businessA,
          name: "Minyak Goreng 2L",
          sellingPrice: 35000,
          costPrice: 28000,
          stockQuantity: 15,
        },
      ],
      [
        "prod-b1",
        {
          id: "prod-b1",
          businessId: businessB,
          name: "Kopi Gayo 250g",
          sellingPrice: 50000,
          costPrice: 40000,
          stockQuantity: 10,
        },
      ],
    ]);

    idempotencyStore = new Map();
    salesStore = new Map();
  });

  describe("1. Atomic Sale Transactions (record_sale_transaction)", () => {
    it("TX-SALE-01: Penjualan sukses memotong stok dan mengalokasikan diskon nota dengan presisi Rp 0", () => {
      const result = processSaleTransaction(
        {
          businessId: businessA,
          userId: userA,
          userMemberships: memberships,
          invoiceNumber: "INV-20261013-0001",
          paymentMethod: "CASH",
          discountAmount: 10000,
          items: [
            { productId: "prod-1", quantity: 2, itemDiscount: 0 }, // 2 * 75.000 = 150.000
            { productId: "prod-2", quantity: 1, itemDiscount: 5000 }, // 1 * 35.000 - 5.000 = 30.000
          ],
        },
        inventory,
        idempotencyStore
      );

      // Total bruto = 150.000 + 30.000 = 180.000. Diskon nota = 10.000. Total = 170.000
      expect(result.subtotalAmount).toBe(180000);
      expect(result.discountAmount).toBe(10000);
      expect(result.totalAmount).toBe(170000);

      // Verifikasi stok fisik berkurang
      expect(inventory.get("prod-1")?.stockQuantity).toBe(18);
      expect(inventory.get("prod-2")?.stockQuantity).toBe(14);

      // Verifikasi matematis: total subtotal item bersih tepat sama dengan total_amount
      const sumLineSubtotals = result.items.reduce((sum, i) => sum + i.subtotalAmount, 0);
      expect(sumLineSubtotals).toBe(result.totalAmount);
    });

    it("TX-SALE-02: Transaksi gagal total dan melempar STOCK_INSUFFICIENT jika stok tidak cukup", () => {
      expect(() =>
        processSaleTransaction(
          {
            businessId: businessA,
            userId: userA,
            userMemberships: memberships,
            invoiceNumber: "INV-20261013-0002",
            paymentMethod: "CASH",
            discountAmount: 0,
            items: [
              { productId: "prod-1", quantity: 2 },
              { productId: "prod-2", quantity: 50 }, // Stok hanya 15!
            ],
          },
          inventory,
          idempotencyStore
        )
      ).toThrowError(/STOCK_INSUFFICIENT/);

      // Rollback verifikasi: stok prod-1 tidak boleh berkurang
      expect(inventory.get("prod-1")?.stockQuantity).toBe(20);
      expect(inventory.get("prod-2")?.stockQuantity).toBe(15);
    });

    it("TX-SALE-03: Menolak penjualan jika produk milik bisnis lain (Cross-Tenant)", () => {
      expect(() =>
        processSaleTransaction(
          {
            businessId: businessA,
            userId: userA,
            userMemberships: memberships,
            invoiceNumber: "INV-20261013-0003",
            paymentMethod: "CASH",
            discountAmount: 0,
            items: [{ productId: "prod-b1", quantity: 1 }], // Milik Toko B!
          },
          inventory,
          idempotencyStore
        )
      ).toThrowError(/PRODUCT_NOT_FOUND/);
    });

    it("TX-SALE-04: Menolak penjualan jika dipanggil oleh pengguna tanpa keanggotaan bisnis", () => {
      expect(() =>
        processSaleTransaction(
          {
            businessId: businessA,
            userId: userB, // User B bukan anggota Toko A!
            userMemberships: memberships,
            invoiceNumber: "INV-20261013-0004",
            paymentMethod: "CASH",
            discountAmount: 0,
            items: [{ productId: "prod-1", quantity: 1 }],
          },
          inventory,
          idempotencyStore
        )
      ).toThrowError("UNAUTHORIZED_BUSINESS");
    });

    it("TX-SALE-05: Penjualan dengan item produk duplikat diagregasi secara aman dan memotong stok dengan benar", () => {
      // prod-1 (stok 20, harga 75.000): baris 1 pesan 2, baris 2 pesan 1. Total qty = 3.
      // prod-2 (stok 15, harga 35.000): baris 3 pesan 1.
      // Subtotal bruto: (2 * 75.000) + (1 * 75.000) + (1 * 35.000) = 150.000 + 75.000 + 35.000 = 260.000
      // Diskon nota = 10.000. Total = 250.000.
      const result = processSaleTransaction(
        {
          businessId: businessA,
          userId: userA,
          userMemberships: memberships,
          invoiceNumber: "INV-20261013-0005",
          paymentMethod: "CASH",
          discountAmount: 10000,
          items: [
            { productId: "prod-1", quantity: 2 },
            { productId: "prod-1", quantity: 1 },
            { productId: "prod-2", quantity: 1 },
          ],
        },
        inventory,
        idempotencyStore
      );

      expect(result.subtotalAmount).toBe(260000);
      expect(result.discountAmount).toBe(10000);
      expect(result.totalAmount).toBe(250000);

      // Verifikasi stok fisik berkurang secara agregat (20 - 3 = 17)
      expect(inventory.get("prod-1")?.stockQuantity).toBe(17);
      expect(inventory.get("prod-2")?.stockQuantity).toBe(14);

      // Verifikasi matematis: total subtotal item bersih persis sama dengan totalAmount
      const sumLineSubtotals = result.items.reduce((sum, i) => sum + i.subtotalAmount, 0);
      expect(sumLineSubtotals).toBe(result.totalAmount);
    });

    it("TX-SALE-06: Menolak transaksi jika total kuantitas agregat produk duplikat melebihi stok yang tersedia", () => {
      // prod-2 stok hanya 15. Baris 1 pesan 10 (valid per baris), Baris 2 pesan 10 (valid per baris).
      // Total kuantitas diminta = 20 > 15!
      expect(() =>
        processSaleTransaction(
          {
            businessId: businessA,
            userId: userA,
            userMemberships: memberships,
            invoiceNumber: "INV-20261013-0006",
            paymentMethod: "CASH",
            discountAmount: 0,
            items: [
              { productId: "prod-2", quantity: 10 },
              { productId: "prod-2", quantity: 10 },
            ],
          },
          inventory,
          idempotencyStore
        )
      ).toThrowError(/STOCK_INSUFFICIENT/);

      // Stok tidak boleh berubah
      expect(inventory.get("prod-2")?.stockQuantity).toBe(15);
    });
  });

  describe("2. Atomic Purchase Transactions (record_purchase_transaction & MWAC)", () => {
    it("TX-PUR-01: Pembelian restock menambah stok dan menghitung ulang Moving Weighted Average Cost", () => {
      // prod-1: Stok 20 @ 60.000 (Nilai modal = 1.200.000)
      // Restock: Beli 10 @ 66.000 (Nilai beli = 660.000)
      // Total nilai: 1.860.000 / 30 = 62.000
      const result = processPurchaseTransaction(
        {
          businessId: businessA,
          userId: userA,
          userMemberships: memberships,
          invoiceNumber: "PO-20261013-0001",
          supplierName: "Grosir Beras Utama",
          items: [{ productId: "prod-1", quantity: 10, unitPurchaseCost: 66000 }],
        },
        inventory,
        idempotencyStore
      );

      expect(result.totalCost).toBe(660000);
      expect(inventory.get("prod-1")?.stockQuantity).toBe(30);
      expect(inventory.get("prod-1")?.costPrice).toBe(62000);
    });

    it("TX-PUR-02: Menangani pembelian stok baru saat stok awal nol", () => {
      const newProd: ProductInventoryState = {
        id: "prod-zero",
        businessId: businessA,
        name: "Gula Pasir 1kg",
        sellingPrice: 18000,
        costPrice: 0,
        stockQuantity: 0,
      };
      inventory.set("prod-zero", newProd);

      processPurchaseTransaction(
        {
          businessId: businessA,
          userId: userA,
          userMemberships: memberships,
          invoiceNumber: "PO-20261013-0002",
          items: [{ productId: "prod-zero", quantity: 50, unitPurchaseCost: 14500 }],
        },
        inventory,
        idempotencyStore
      );

      expect(newProd.stockQuantity).toBe(50);
      expect(newProd.costPrice).toBe(14500);
    });
  });

  describe("3. Atomic Void Transactions (void_sale_transaction)", () => {
    it("TX-VOID-01: Pembatalan penjualan mengembalikan stok fisik tanpa mengubah cost_price produk", () => {
      // Siapkan penjualan yang sudah tercatat
      salesStore.set("sale-active-1", {
        id: "sale-active-1",
        businessId: businessA,
        status: "COMPLETED",
        items: [
          { productId: "prod-1", quantity: 5 },
          { productId: "prod-2", quantity: 3 },
        ],
      });

      const initialProd1Stock = inventory.get("prod-1")!.stockQuantity; // 20
      const initialProd1Cost = inventory.get("prod-1")!.costPrice; // 60.000

      const result = processVoidSaleTransaction(
        {
          businessId: businessA,
          userId: userA,
          userMemberships: memberships,
          saleId: "sale-active-1",
          voidReason: "Salah input nota dan item pelanggan",
        },
        salesStore,
        inventory,
        idempotencyStore
      );

      expect(result.status).toBe("VOIDED");
      expect(salesStore.get("sale-active-1")?.status).toBe("VOIDED");

      // Stok fisik kembali
      expect(inventory.get("prod-1")?.stockQuantity).toBe(initialProd1Stock + 5);
      expect(inventory.get("prod-2")?.stockQuantity).toBe(15 + 3);

      // Invarian: Harga pokok produk TIDAK berubah secara retroaktif
      expect(inventory.get("prod-1")?.costPrice).toBe(initialProd1Cost);
    });

    it("TX-VOID-02: Menolak pembatalan kedua pada penjualan yang sudah VOIDED", () => {
      salesStore.set("sale-voided-1", {
        id: "sale-voided-1",
        businessId: businessA,
        status: "VOIDED",
        items: [{ productId: "prod-1", quantity: 2 }],
      });

      expect(() =>
        processVoidSaleTransaction(
          {
            businessId: businessA,
            userId: userA,
            userMemberships: memberships,
            saleId: "sale-voided-1",
            voidReason: "Coba void lagi",
          },
          salesStore,
          inventory,
          idempotencyStore
        )
      ).toThrowError(/SALE_ALREADY_VOIDED/);
    });

    it("TX-VOID-03: Menolak alasan void yang terlalu pendek (< 5 karakter)", () => {
      salesStore.set("sale-active-2", {
        id: "sale-active-2",
        businessId: businessA,
        status: "COMPLETED",
        items: [{ productId: "prod-1", quantity: 1 }],
      });

      expect(() =>
        processVoidSaleTransaction(
          {
            businessId: businessA,
            userId: userA,
            userMemberships: memberships,
            saleId: "sale-active-2",
            voidReason: "bad", // Hanya 3 karakter!
          },
          salesStore,
          inventory,
          idempotencyStore
        )
      ).toThrowError(/INVALID_VOID_REASON/);
    });
  });

  describe("4. Idempotency Key Handling Under Repeated Requests", () => {
    it("TX-IDEM-01: Mengembalikan hasil tersimpan tanpa mutasi ganda saat kunci dan payload sama", () => {
      const saleParams = {
        businessId: businessA,
        userId: userA,
        userMemberships: memberships,
        invoiceNumber: "INV-20261013-IDEM-1",
        paymentMethod: "CASH" as const,
        discountAmount: 0,
        items: [{ productId: "prod-1", quantity: 2 }],
        idempotencyKey: "idempotency-key-sale-000001",
      };

      // Request 1
      const res1 = processSaleTransaction(saleParams, inventory, idempotencyStore);
      expect(inventory.get("prod-1")?.stockQuantity).toBe(18);

      // Request 2 (Replay dengan key dan payload sama)
      const res2 = processSaleTransaction(saleParams, inventory, idempotencyStore);
      expect(res2).toEqual(res1);

      // Stok tidak boleh terpotong lagi (tetap 18, bukan 16!)
      expect(inventory.get("prod-1")?.stockQuantity).toBe(18);
    });

    it("TX-IDEM-02: Menolak request jika kunci sama digunakan kembali dengan payload berbeda", () => {
      const saleParams1 = {
        businessId: businessA,
        userId: userA,
        userMemberships: memberships,
        invoiceNumber: "INV-20261013-IDEM-2",
        paymentMethod: "CASH" as const,
        discountAmount: 0,
        items: [{ productId: "prod-1", quantity: 2 }],
        idempotencyKey: "idempotency-key-sale-000002",
      };

      processSaleTransaction(saleParams1, inventory, idempotencyStore);

      const saleParamsTampered = {
        ...saleParams1,
        items: [{ productId: "prod-1", quantity: 5 }], // Payload kuantitas berbeda!
      };

      expect(() =>
        processSaleTransaction(saleParamsTampered, inventory, idempotencyStore)
      ).toThrowError(/IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD/);
    });

    it("TX-IDEM-03: Menangani payload idempotensi yang memuat BigInt secara aman tanpa error serialisasi JSON", () => {
      const saleParams = {
        businessId: businessA,
        userId: userA,
        userMemberships: memberships,
        invoiceNumber: "INV-20261013-IDEM-3",
        paymentMethod: "CASH" as const,
        discountAmount: 0,
        items: [{ productId: "prod-1", quantity: 1 }],
        idempotencyKey: "idempotency-key-sale-000003",
      };

      // Simulasikan request payload tersimpan di store yang memuat BigInt (misal dari deserialisasi DB)
      const storeKey = `${businessA}:${saleParams.idempotencyKey}`;
      idempotencyStore.set(storeKey, {
        businessId: businessA,
        key: saleParams.idempotencyKey,
        actionType: "RECORD_SALE",
        userId: userA,
        requestPayload: {
          invoiceNumber: saleParams.invoiceNumber,
          paymentMethod: saleParams.paymentMethod,
          discountAmount: BigInt(0), // BigInt!
          items: saleParams.items,
        },
        responsePayload: {
          saleId: "mock-sale-uuid",
          invoiceNumber: saleParams.invoiceNumber,
          subtotalAmount: 75000,
          discountAmount: 0,
          totalAmount: 75000,
          paymentMethod: "CASH",
          itemsCount: 1,
          items: [],
        },
      });

      // Pemanggilan ulang harus berhasil mencocokkan payload tanpa melempar TypeError: Do not know how to serialize a BigInt
      const replayResult = processSaleTransaction(saleParams, inventory, idempotencyStore);
      expect(replayResult.invoiceNumber).toBe(saleParams.invoiceNumber);
    });
  });
});
