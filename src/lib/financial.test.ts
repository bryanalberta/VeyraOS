import { describe, expect, it } from "vitest";
import {
  allocateTransactionDiscounts,
  calculateGrossProfit,
  calculateGrossProfitMargin,
  calculateMovingAverageCost,
  calculateNetCashFlow,
  calculateOperatingProfit,
  formatJakartaDate,
  parseJakartaDateBoundary,
  safeBigIntToNumber,
  safeNumberToBigInt,
  safeJsonStringify,
} from "./financial";
import { formatRupiah } from "./utils";

describe("Financial Domain Calculations (VeyraOS Baseline)", () => {
  describe("Moving Weighted Average Cost (HPP Restock)", () => {
    it("UTC-01: Stok awal nol menghasilkan harga beli restock baru", () => {
      const newCost = calculateMovingAverageCost(0, 0, 10, 10000);
      expect(newCost).toBe(10000);
    });

    it("UTC-02: Pembelian dengan harga berbeda menghitung rata-rata tertimbang secara akurat", () => {
      // 10 unit @ Rp 10.000 + 10 unit baru @ Rp 12.000 = (100.000 + 120.000) / 20 = 11.000
      const newCost = calculateMovingAverageCost(10, 10000, 10, 12000);
      expect(newCost).toBe(11000);
    });

    it("UTC-03: Pembulatan pecahan sen dibulatkan ke integer Rupiah terdekat", () => {
      // 3 unit @ Rp 10.000 ($30.000) + 4 unit @ Rp 11.250 ($45.000) = $75.000 / 7 = 10.714,28...
      const newCost = calculateMovingAverageCost(3, 10000, 4, 11250);
      expect(newCost).toBe(10714);
    });

    it("menghindari pembagian nol jika purchaseQty adalah 0", () => {
      const currentCost = 15000;
      const newCost = calculateMovingAverageCost(5, currentCost, 0, 20000);
      expect(newCost).toBe(currentCost);
    });
  });

  describe("True Largest Remainder Method (Hamilton Method / Hare-Niemeyer)", () => {
    it("UTC-05: Mengalokasikan diskon transaksi proporsional dengan rekonsiliasi tepat Rp 0 selisih", () => {
      const items = [
        { id: "item-1", subtotal: 50000 },
        { id: "item-2", subtotal: 30000 },
        { id: "item-3", subtotal: 20000 },
      ];
      const discount = 15000;

      const result = allocateTransactionDiscounts(items, discount);

      // Total diskon yang dialokasikan harus persis sama dengan diskon transaksi
      const totalAllocated = result.reduce((sum, r) => sum + r.allocatedDiscount, 0);
      expect(totalAllocated).toBe(15000);

      // Verifikasi alokasi per item
      expect(result.find((r) => r.itemId === "item-1")?.allocatedDiscount).toBe(7500);
      expect(result.find((r) => r.itemId === "item-2")?.allocatedDiscount).toBe(4500);
      expect(result.find((r) => r.itemId === "item-3")?.allocatedDiscount).toBe(3000);

      // Total subtotal setelah diskon harus persis sama dengan subtotal - diskon
      const totalNetSubtotal = result.reduce((sum, r) => sum + r.netSubtotal, 0);
      expect(totalNetSubtotal).toBe(100000 - 15000);
    });

    it("REGRESSION TEST: A=6000, B=2000, C=2000, discount=7 menghasilkan A=4, B=2, C=1 (Hamilton Method)", () => {
      // Pembuktian Matematis:
      // Total Subtotal = 10.000, Diskon = 7
      // Kuota eksak:
      // A: (7 * 6000) / 10000 = 4.2 -> floor 4, remainder 2000
      // B: (7 * 2000) / 10000 = 1.4 -> floor 1, remainder 4000
      // C: (7 * 2000) / 10000 = 1.4 -> floor 1, remainder 4000
      // Sisa kuota belum teralokasi: 7 - (4 + 1 + 1) = 1 Rupiah
      // Urutan prioritas sisa: B dan C memiliki sisa 4000 (lebih besar dari A = 2000).
      // Tie-break deterministik: id 'B' < 'C', sehingga B mendapatkan bonus +1 Rupiah.
      // Hasil akhir yang diwajibkan: A = 4, B = 2, C = 1.
      const items = [
        { id: "A", subtotal: 6000 },
        { id: "B", subtotal: 2000 },
        { id: "C", subtotal: 2000 },
      ];
      const discount = 7;

      const result = allocateTransactionDiscounts(items, discount);

      expect(result.find((r) => r.itemId === "A")?.allocatedDiscount).toBe(4);
      expect(result.find((r) => r.itemId === "B")?.allocatedDiscount).toBe(2);
      expect(result.find((r) => r.itemId === "C")?.allocatedDiscount).toBe(1);

      // Verifikasi total tepat 7 dan net subtotal tepat
      const totalAllocated = result.reduce((sum, r) => sum + r.allocatedDiscount, 0);
      expect(totalAllocated).toBe(7);
      expect(result.find((r) => r.itemId === "A")?.netSubtotal).toBe(5996);
      expect(result.find((r) => r.itemId === "B")?.netSubtotal).toBe(1998);
      expect(result.find((r) => r.itemId === "C")?.netSubtotal).toBe(1999);
    });

    it("menghasilkan nilai deterministik terlepas dari permutasi urutan array input", () => {
      // Urutan terbalik: [C, B, A]
      const itemsReversed = [
        { id: "C", subtotal: 2000 },
        { id: "B", subtotal: 2000 },
        { id: "A", subtotal: 6000 },
      ];
      const discount = 7;

      const result = allocateTransactionDiscounts(itemsReversed, discount);

      expect(result.find((r) => r.itemId === "A")?.allocatedDiscount).toBe(4);
      expect(result.find((r) => r.itemId === "B")?.allocatedDiscount).toBe(2);
      expect(result.find((r) => r.itemId === "C")?.allocatedDiscount).toBe(1);
    });

    it("kasus sisa beberapa Rupiah (unassigned > 1): didistribusikan secara adil dan deterministik", () => {
      // 3 item @ 1000, diskon 5 -> kuota dasar 1, sisa 2 Rupiah
      // Sisa pecahan semua sama (2000). Tie-break id: item-1 dan item-2 mendapat +1
      const items = [
        { id: "item-1", subtotal: 1000 },
        { id: "item-2", subtotal: 1000 },
        { id: "item-3", subtotal: 1000 },
      ];
      const discount = 5;

      const result = allocateTransactionDiscounts(items, discount);

      expect(result.find((r) => r.itemId === "item-1")?.allocatedDiscount).toBe(2);
      expect(result.find((r) => r.itemId === "item-2")?.allocatedDiscount).toBe(2);
      expect(result.find((r) => r.itemId === "item-3")?.allocatedDiscount).toBe(1);
      const total = result.reduce((sum, r) => sum + r.allocatedDiscount, 0);
      expect(total).toBe(5);
    });

    it("mengembalikan diskon 0 jika transaksi tidak memiliki diskon atau diskon negatif", () => {
      const items = [{ id: "item-1", subtotal: 50000 }];
      const resultZero = allocateTransactionDiscounts(items, 0);
      expect(resultZero[0].allocatedDiscount).toBe(0);
      expect(resultZero[0].netSubtotal).toBe(50000);

      const resultNeg = allocateTransactionDiscounts(items, -5000);
      expect(resultNeg[0].allocatedDiscount).toBe(0);
      expect(resultNeg[0].netSubtotal).toBe(50000);
    });

    it("menangani subtotal nol dengan aman tanpa division by zero", () => {
      const items = [
        { id: "item-free", subtotal: 0 },
        { id: "item-paid", subtotal: 10000 },
      ];
      const discount = 2000;

      const result = allocateTransactionDiscounts(items, discount);

      expect(result.find((r) => r.itemId === "item-free")?.allocatedDiscount).toBe(0);
      expect(result.find((r) => r.itemId === "item-paid")?.allocatedDiscount).toBe(2000);
    });

    it("menangani seluruh item dengan subtotal 0", () => {
      const items = [
        { id: "item-1", subtotal: 0 },
        { id: "item-2", subtotal: 0 },
      ];
      const result = allocateTransactionDiscounts(items, 5000);
      expect(result[0].allocatedDiscount).toBe(0);
      expect(result[1].allocatedDiscount).toBe(0);
    });

    it("menangani diskon maksimal (diskon >= total subtotal)", () => {
      const items = [
        { id: "item-1", subtotal: 3000 },
        { id: "item-2", subtotal: 7000 },
      ];
      // Diskon 15.000 melebihi total subtotal 10.000 -> dipotong tepat sebesar 10.000
      const result = allocateTransactionDiscounts(items, 15000);

      expect(result.find((r) => r.itemId === "item-1")?.allocatedDiscount).toBe(3000);
      expect(result.find((r) => r.itemId === "item-1")?.netSubtotal).toBe(0);
      expect(result.find((r) => r.itemId === "item-2")?.allocatedDiscount).toBe(7000);
      expect(result.find((r) => r.itemId === "item-2")?.netSubtotal).toBe(0);
      const total = result.reduce((sum, r) => sum + r.allocatedDiscount, 0);
      expect(total).toBe(10000);
    });

    it("mengagregasi produk duplikat: tidak membiarkan sisa diskon dialokasikan berulang ke produk yang sama", () => {
      // Produk A muncul di 2 baris (3000 + 3000 = 6000). Produk B di 1 baris (4000).
      // Diskon = 7. Total Subtotal = 10.000.
      // Sesuai aturan: Produk A (6000) berhak atas diskon 4. Produk B (4000) berhak atas diskon 3.
      // Diskon 4 milik produk A dibagi rata ke kedua barisnya: baris 1 = 2, baris 2 = 2.
      const itemsWithDupes = [
        { id: "prod-A", subtotal: 3000 },
        { id: "prod-A", subtotal: 3000 },
        { id: "prod-B", subtotal: 4000 },
      ];
      const discount = 7;

      const result = allocateTransactionDiscounts(itemsWithDupes, discount);

      expect(result.length).toBe(3);
      expect(result[0].itemId).toBe("prod-A");
      expect(result[0].allocatedDiscount).toBe(2);
      expect(result[1].itemId).toBe("prod-A");
      expect(result[1].allocatedDiscount).toBe(2);
      expect(result[2].itemId).toBe("prod-B");
      expect(result[2].allocatedDiscount).toBe(3);

      const totalAllocated = result.reduce((sum, r) => sum + r.allocatedDiscount, 0);
      expect(totalAllocated).toBe(7);
    });

    it("mendukung transaksi bernilai besar (puluhan miliar Rupiah) dengan aritmetika integer aman", () => {
      const items = [
        { id: "heavy-1", subtotal: 25_000_000_000 }, // Rp 25 Miliar
        { id: "heavy-2", subtotal: 75_000_000_000 }, // Rp 75 Miliar
      ];
      const discount = 1_000_000_003; // Rp 1 Miliar + Rp 3

      const result = allocateTransactionDiscounts(items, discount);

      // heavy-1: 25% dari 1.000.000.003 = 250.000.000,75 -> floor 250.000.000, rem 75/100
      // heavy-2: 75% dari 1.000.000.003 = 750.000.002,25 -> floor 750.000.002, rem 25/100
      // Remainder terbesar adalah heavy-1 (0.75 > 0.25) -> heavy-1 mendapatkan +1
      expect(result.find((r) => r.itemId === "heavy-1")?.allocatedDiscount).toBe(250_000_001);
      expect(result.find((r) => r.itemId === "heavy-2")?.allocatedDiscount).toBe(750_000_002);

      const total = result.reduce((sum, r) => sum + r.allocatedDiscount, 0);
      expect(total).toBe(1_000_000_003);
    });
  });

  describe("Laba Kotor, Laba Operasional, dan Arus Kas", () => {
    it("UTC-04: Menjaga pemisahan tegas antara Laba dan Arus Kas", () => {
      const netSales = 10000000; // Penjualan Bersih
      const cogs = 6000000; // HPP
      const operatingExpenses = 1000000; // Beban Sewa, Listrik
      const inventoryPurchaseCost = 3000000; // Pembelian Stok Baru

      // 1. Laba Kotor = Penjualan - HPP
      const grossProfit = calculateGrossProfit(netSales, cogs);
      expect(grossProfit).toBe(4000000);

      // 2. Laba Operasional = Laba Kotor - Beban Operasional (Pembelian stok TIDAK memotong laba)
      const operatingProfit = calculateOperatingProfit(grossProfit, operatingExpenses);
      expect(operatingProfit).toBe(3000000);

      // 3. Arus Kas Bersih = Kas Masuk - (Beban + Pembelian Stok)
      const cashInflows = netSales;
      const cashOutflows = operatingExpenses + inventoryPurchaseCost;
      const netCashFlow = calculateNetCashFlow(cashInflows, cashOutflows);
      expect(netCashFlow).toBe(6000000);
    });
  });

  describe("Format Rupiah Indonesia", () => {
    it("memformat bilangan bulat IDR dengan pemisah titik tanpa sen", () => {
      const formatted = formatRupiah(1500000);
      expect(formatted).toContain("1.500.000");
    });

    it("memformat BigInt aman dan BigInt sangat besar tanpa kehilangan presisi", () => {
      const formattedSafe = formatRupiah(BigInt(2500000));
      expect(formattedSafe).toContain("2.500.000");

      // BigInt melebihi Number.MAX_SAFE_INTEGER (misal: 10 kuadriliun Rupiah)
      const hugeBigInt = BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10);
      const formattedHuge = formatRupiah(hugeBigInt);
      expect(formattedHuge).toContain("90.071.992.547.409.910");
    });
  });

  describe("Monetary Safety & Integer Precision (src/lib/financial.ts)", () => {
    it("safeBigIntToNumber: berhasil mengonversi BigInt dalam rentang aman JavaScript", () => {
      const val = BigInt(5000000);
      expect(safeBigIntToNumber(val)).toBe(5000000);

      const maxSafeBig = BigInt(Number.MAX_SAFE_INTEGER);
      expect(safeBigIntToNumber(maxSafeBig)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("safeBigIntToNumber: melempar RangeError jika BigInt melampaui batas aman Number.MAX_SAFE_INTEGER", () => {
      const overflowBig = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
      expect(() => safeBigIntToNumber(overflowBig, "Penjualan")).toThrowError(
        /INTEGER_OVERFLOW.*Penjualan/
      );

      const underflowBig = BigInt(Number.MIN_SAFE_INTEGER) - BigInt(1);
      expect(() => safeBigIntToNumber(underflowBig, "Beban")).toThrowError(
        /INTEGER_OVERFLOW.*Beban/
      );
    });

    it("safeNumberToBigInt: berhasil mengonversi integer dan menolak bilangan pecahan", () => {
      expect(safeNumberToBigInt(100000)).toBe(BigInt(100000));
      expect(() => safeNumberToBigInt(100.5, "Harga")).toThrowError(/UNSAFE_INTEGER.*Harga/);
      expect(() => safeNumberToBigInt(NaN)).toThrowError(/UNSAFE_INTEGER/);
    });

    it("safeJsonStringify: mencegah crash native JSON.stringify pada BigInt", () => {
      const payloadWithBigInt = {
        invoiceNumber: "INV-20261013-0001",
        totalAmount: BigInt(150000),
        hugeAmount: BigInt(Number.MAX_SAFE_INTEGER) * BigInt(2),
      };

      // Native JSON.stringify melempar TypeError pada BigInt
      expect(() => JSON.stringify(payloadWithBigInt)).toThrowError(TypeError);

      // safeJsonStringify berhasil menserialisasi tanpa error
      const serialized = safeJsonStringify(payloadWithBigInt);
      expect(serialized).toContain('"totalAmount":150000');
      expect(serialized).toContain('"invoiceNumber":"INV-20261013-0001"');
      expect(typeof serialized).toBe("string");
    });

    it("calculateMovingAverageCost: mencegah perkalian overflow pada stok besar dan harga besar", () => {
      // 100 juta unit @ Rp 500 juta + 100 juta unit @ Rp 600 juta
      // Total value = 5 * 10^16 + 6 * 10^16 = 1,1 * 10^17 (melampaui Number.MAX_SAFE_INTEGER 9 * 10^15)
      // Rata-rata yang benar adalah Rp 550 juta
      const currentStock = 100_000_000;
      const currentCost = 500_000_000;
      const purchaseQty = 100_000_000;
      const purchaseUnitCost = 600_000_000;

      const newCost = calculateMovingAverageCost(
        currentStock,
        currentCost,
        purchaseQty,
        purchaseUnitCost
      );

      expect(newCost).toBe(550_000_000);
    });
  });

  describe("Gross Profit Margin (calculateGrossProfitMargin)", () => {
    it("menghitung margin laba kotor persentase dengan pembulatan 2 desimal", () => {
      // Laba Kotor 250.000 / Penjualan 1.000.000 = 25%
      expect(calculateGrossProfitMargin(250000, 1000000)).toBe(25);

      // Pembulatan 2 desimal: 100.000 / 300.000 = 33.3333... -> 33.33%
      expect(calculateGrossProfitMargin(100000, 300000)).toBe(33.33);

      // Margin negatif jika HPP > Penjualan
      expect(calculateGrossProfitMargin(-50000, 200000)).toBe(-25);
    });

    it("mengembalikan 0% saat netSales <= 0 untuk mencegah NaN atau division by zero", () => {
      expect(calculateGrossProfitMargin(0, 0)).toBe(0);
      expect(calculateGrossProfitMargin(50000, 0)).toBe(0);
      expect(calculateGrossProfitMargin(50000, -100000)).toBe(0);
    });
  });

  describe("Timezone Asia/Jakarta & Half-Open Date Boundary", () => {
    describe("formatJakartaDate", () => {
      it("mengonversi UTC timestamp ke tanggal kalender Asia/Jakarta (UTC+7)", () => {
        // Tepat pergantian hari 00:00:00 WIB (17:00:00 UTC hari sebelumnya)
        expect(formatJakartaDate("2026-09-30T17:00:00.000Z")).toBe("2026-10-01");

        // 1 milidetik sebelum pergantian hari WIB (16:59:59.999 UTC)
        expect(formatJakartaDate("2026-09-30T16:59:59.999Z")).toBe("2026-09-30");

        // Siang hari WIB (05:00:00 UTC = 12:00:00 WIB)
        expect(formatJakartaDate("2026-10-01T05:00:00.000Z")).toBe("2026-10-01");
      });

      it("melempar TypeError untuk tanggal yang tidak valid", () => {
        expect(() => formatJakartaDate("invalid-date")).toThrow(TypeError);
      });
    });

    describe("parseJakartaDateBoundary", () => {
      it("menghasilkan interval setengah terbuka [startUtc, nextDayUtc) persis sesuai Section 6 Preflight", () => {
        // Input eksplisit: 2026-10-01 s/d 2026-10-07
        const range = parseJakartaDateBoundary("2026-10-01", "2026-10-07");

        expect(range.startDate).toBe("2026-10-01");
        expect(range.endDate).toBe("2026-10-07");
        // Batas bawah (inclusive): 2026-10-01T00:00:00+07:00 == 2026-09-30T17:00:00.000Z
        expect(range.startUtc).toBe("2026-09-30T17:00:00.000Z");
        // Batas atas (exclusive): 2026-10-08T00:00:00+07:00 == 2026-10-07T17:00:00.000Z
        expect(range.nextDayUtc).toBe("2026-10-07T17:00:00.000Z");
      });

      it("menangani satu hari penuh (startDate == endDate) dengan rentang tepat 24 jam", () => {
        const range = parseJakartaDateBoundary("2026-10-01", "2026-10-01");

        expect(range.startDate).toBe("2026-10-01");
        expect(range.endDate).toBe("2026-10-01");
        expect(range.startUtc).toBe("2026-09-30T17:00:00.000Z");
        expect(range.nextDayUtc).toBe("2026-10-01T17:00:00.000Z");

        // Selisih tepat 24 jam dalam milidetik
        const diffMs = new Date(range.nextDayUtc).getTime() - new Date(range.startUtc).getTime();
        expect(diffMs).toBe(24 * 60 * 60 * 1000);
      });

      it("menerapkan default 30 hari jika parameter tanggal ditiadakan", () => {
        // Simulasi reference date: 2026-10-14T01:00:00.000Z (08:00 WIB 14 Okt 2026)
        const refDate = new Date("2026-10-14T01:00:00.000Z");
        const range = parseJakartaDateBoundary(undefined, undefined, 30, refDate);

        expect(range.endDate).toBe("2026-10-14");
        // 30 hari ke belakang termasuk hari ini: 15 Sep 2026 s/d 14 Okt 2026
        expect(range.startDate).toBe("2026-09-15");
        expect(range.startUtc).toBe("2026-09-14T17:00:00.000Z");
        expect(range.nextDayUtc).toBe("2026-10-14T17:00:00.000Z");

        // Selisih tepat 30 hari (30 * 24 jam)
        const diffDays =
          (new Date(range.nextDayUtc).getTime() - new Date(range.startUtc).getTime()) /
          (24 * 60 * 60 * 1000);
        expect(diffDays).toBe(30);
      });

      it("melempar RangeError jika startDate > endDate", () => {
        expect(() => parseJakartaDateBoundary("2026-10-15", "2026-10-01")).toThrow(RangeError);
      });
    });
  });
});

