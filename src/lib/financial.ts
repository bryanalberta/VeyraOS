/**
 * Batas maksimum nilai nominal Rupiah yang aman ditangani oleh tipe data number JavaScript
 * tanpa kehilangan presisi floating-point (Number.MAX_SAFE_INTEGER = 9.007.199.254.740.991 Rupiah ≈ 9,007 triliun).
 */
export const MAX_SAFE_RUPIAH = Number.MAX_SAFE_INTEGER;

/**
 * Konversi eksplisit dan aman dari BigInt ke JavaScript number dengan pemeriksaan rentang.
 * Melempar RangeError jika nilai melampaui batas representasi aman JavaScript (±9.007.199.254.740.991).
 */
export function safeBigIntToNumber(value: bigint, context: string = "monetary value"): number {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

  if (value > maxSafe || value < minSafe) {
    throw new RangeError(
      `INTEGER_OVERFLOW: ${context} (${value.toString()}) melebihi batas angka integer aman JavaScript (±${Number.MAX_SAFE_INTEGER})`
    );
  }

  return Number(value);
}

/**
 * Konversi eksplisit dan aman dari JavaScript number ke BigInt dengan validasi keutuhan integer.
 * Melempar TypeError jika nilai bukan safe integer.
 */
export function safeNumberToBigInt(value: number, context: string = "monetary value"): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `UNSAFE_INTEGER: ${context} (${value}) bukan merupakan bilangan bulat integer yang aman`
    );
  }

  return BigInt(value);
}

/**
 * Serialisasi JSON aman yang menangani nilai BigInt secara eksplisit tanpa melempar TypeError.
 * Mengonversi BigInt yang berada dalam batas aman menjadi number, atau string jika di luar batas aman.
 */
export function safeJsonStringify(value: unknown): string {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

  return JSON.stringify(value, (_, v) => {
    if (typeof v === "bigint") {
      if (v >= minSafe && v <= maxSafe) {
        return Number(v);
      }
      return v.toString();
    }
    return v;
  });
}

/**
 * Perhitungan Moving Weighted Average Cost (Rata-rata Bergerak) untuk HPP.
 * Menggunakan aritmetika integer BigInt untuk mencegah overflow perkalian pada stok/harga besar,
 * dengan pembulatan integer presisi ke Rupiah terdekat tanpa floating point division.
 */
export function calculateMovingAverageCost(
  currentStock: number,
  currentCost: number,
  purchaseQty: number,
  purchaseUnitCost: number
): number {
  if (purchaseQty <= 0) {
    return currentCost;
  }

  const totalQty = currentStock + purchaseQty;
  if (totalQty <= 0) {
    return purchaseUnitCost;
  }

  // Jika stok saat ini 0, maka harga pokok baru adalah harga beli restock tersebut
  if (currentStock <= 0) {
    return purchaseUnitCost;
  }

  const bigCurrentStock = BigInt(currentStock);
  const bigCurrentCost = BigInt(currentCost);
  const bigPurchaseQty = BigInt(purchaseQty);
  const bigPurchaseUnitCost = BigInt(purchaseUnitCost);
  const bigTotalQty = BigInt(totalQty);
  const twoBig = BigInt(2);

  const totalValue = bigCurrentStock * bigCurrentCost + bigPurchaseQty * bigPurchaseUnitCost;

  // Pembulatan integer matematis ekuivalen Math.round(totalValue / totalQty):
  // (2 * totalValue + totalQty) / (2 * totalQty)
  const roundedAvg = (totalValue * twoBig + bigTotalQty) / (bigTotalQty * twoBig);

  return safeBigIntToNumber(roundedAvg, "Moving Average Cost");
}

export interface DiscountableItem {
  id: string;
  subtotal: number;
}

export interface AllocatedDiscountResult {
  itemId: string;
  allocatedDiscount: number;
  netSubtotal: number;
}

/**
 * Alokasi Diskon Transaksi ke Baris Item menggunakan True Largest Remainder Method (Hamilton Method / Hare-Niemeyer).
 *
 * Sesuai spesifikasi Phase 4, Substage 3.1.4:
 * 1. Menggunakan aritmetika integer murni (BigInt untuk perkalian dan modulo) guna mencegah floating-point rounding errors.
 *    Batas nilai yang didukung: hingga batas BigInt / SQL BIGINT (9,22 triliun Rupiah), aman di atas Number.MAX_SAFE_INTEGER.
 * 2. Menghitung kuota kuantitatif dasar (floor quota) per item/produk:
 *    baseQuota_i = floor((effectiveDiscount * subtotal_i) / totalSubtotal)
 * 3. Menghitung sisa pecahan eksak integer (fractional remainder):
 *    remainder_i = (effectiveDiscount * subtotal_i) % totalSubtotal
 * 4. Mendistribusikan sisa selisih (unassigned remainders) satu per satu (Rp 1) ke item/produk
 *    dengan remainder pecahan terbesar.
 * 5. Tie-breaking deterministik:
 *    - Prioritas 1: Sisa pecahan integer terbesar (remainder DESC)
 *    - Prioritas 2: Alfanumerik id terkecil secara leksikografis (id ASC)
 *    - Prioritas 3: Indeks urutan input awal (original index ASC)
 * 6. Penanganan produk duplikat:
 *    Jika array input memuat multiple item dengan id produk yang sama, agregasi dilakukan
 *    berdasarkan identitas produk terlebih dahulu agar produk tersebut tidak menerima
 *    alokasi sisa berkali-kali secara tidak adil. Diskon per produk kemudian dialokasikan
 *    ke sub-baris produk tersebut menggunakan metode Hamilton deterministik.
 * 7. Invarian:
 *    - Jumlah total diskon teralokasi TEPAT SAMA dengan effectiveDiscount (min(transactionDiscount, totalSubtotal)).
 *    - Diskon teralokasi per item tidak pernah melebihi subtotal item tersebut.
 */
interface HamiltonInternalElement {
  key: string;
  subtotal: number;
  tieBreakOrder: number;
}

function runHamiltonAllocation(
  elements: HamiltonInternalElement[],
  totalDiscount: number,
  totalSubtotal: number
): Map<string, number> {
  const result = new Map<string, number>();

  if (elements.length === 0 || totalDiscount <= 0 || totalSubtotal <= 0) {
    for (const el of elements) {
      result.set(el.key, 0);
    }
    return result;
  }

  const effectiveDiscount = Math.min(totalDiscount, totalSubtotal);
  const bigTotalSubtotal = BigInt(totalSubtotal);
  const bigEffectiveDiscount = BigInt(effectiveDiscount);

  let allocatedSum = 0;
  const itemsWithRemainder: Array<{
    key: string;
    baseQuota: number;
    remainder: number;
    tieBreakOrder: number;
  }> = [];

  for (const el of elements) {
    if (el.subtotal <= 0) {
      itemsWithRemainder.push({
        key: el.key,
        baseQuota: 0,
        remainder: 0,
        tieBreakOrder: el.tieBreakOrder,
      });
      continue;
    }

    const numerator = bigEffectiveDiscount * BigInt(el.subtotal);
    const baseQuota = safeBigIntToNumber(numerator / bigTotalSubtotal, "baseQuota");
    const remainder = safeBigIntToNumber(numerator % bigTotalSubtotal, "remainder");

    allocatedSum += baseQuota;
    itemsWithRemainder.push({
      key: el.key,
      baseQuota,
      remainder,
      tieBreakOrder: el.tieBreakOrder,
    });
  }

  const unassignedRemainders = effectiveDiscount - allocatedSum;

  // Urutkan kandidat penerima sisa 1 Rupiah:
  // 1. Sisa pecahan terbesar (remainder DESC)
  // 2. Alfanumerik key terkecil (key ASC)
  // 3. Indeks input awal (tieBreakOrder ASC)
  const sortedCandidates = [...itemsWithRemainder]
    .filter((item) => item.remainder > 0)
    .sort((a, b) => {
      if (b.remainder !== a.remainder) {
        return b.remainder - a.remainder;
      }
      if (a.key !== b.key) {
        return a.key.localeCompare(b.key);
      }
      return a.tieBreakOrder - b.tieBreakOrder;
    });

  const bonusKeys = new Set<string>();
  for (let i = 0; i < unassignedRemainders && i < sortedCandidates.length; i++) {
    bonusKeys.add(sortedCandidates[i].key);
  }

  for (const item of itemsWithRemainder) {
    const finalAllocated = item.baseQuota + (bonusKeys.has(item.key) ? 1 : 0);
    result.set(item.key, finalAllocated);
  }

  return result;
}

export function allocateTransactionDiscounts(
  items: DiscountableItem[],
  transactionDiscount: number
): AllocatedDiscountResult[] {
  if (items.length === 0) {
    return [];
  }

  const totalSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Jika total subtotal <= 0 atau diskon transaksi <= 0, diskon seluruh item adalah 0
  if (totalSubtotal <= 0 || transactionDiscount <= 0) {
    return items.map((item) => ({
      itemId: item.id,
      allocatedDiscount: 0,
      netSubtotal: item.subtotal,
    }));
  }

  const effectiveDiscount = Math.min(transactionDiscount, totalSubtotal);

  // Deteksi apakah ada produk duplikat pada input
  const idCounts = new Map<string, number>();
  for (const item of items) {
    idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1);
  }
  const hasDuplicates = Array.from(idCounts.values()).some((count) => count > 1);

  if (!hasDuplicates) {
    // Jalur langsung jika semua item memiliki id unik
    const elements: HamiltonInternalElement[] = items.map((item, index) => ({
      key: item.id,
      subtotal: item.subtotal,
      tieBreakOrder: index,
    }));

    const allocatedMap = runHamiltonAllocation(elements, effectiveDiscount, totalSubtotal);

    return items.map((item) => {
      const allocated = allocatedMap.get(item.id) ?? 0;
      return {
        itemId: item.id,
        allocatedDiscount: allocated,
        netSubtotal: item.subtotal - allocated,
      };
    });
  }

  // Jalur agregasi produk: kelompokkan baris berdasarkan identitas item.id
  const productGroups = new Map<
    string,
    {
      totalSubtotal: number;
      lines: Array<{ originalIndex: number; subtotal: number }>;
    }
  >();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const existing = productGroups.get(item.id);
    if (existing) {
      existing.totalSubtotal += item.subtotal;
      existing.lines.push({ originalIndex: i, subtotal: item.subtotal });
    } else {
      productGroups.set(item.id, {
        totalSubtotal: item.subtotal,
        lines: [{ originalIndex: i, subtotal: item.subtotal }],
      });
    }
  }

  // 1. Alokasi diskon di tingkat produk unik menggunakan metode Hamilton
  const productElements: HamiltonInternalElement[] = Array.from(productGroups.entries()).map(
    ([id, group], groupIndex) => ({
      key: id,
      subtotal: group.totalSubtotal,
      tieBreakOrder: groupIndex,
    })
  );

  const productAllocatedMap = runHamiltonAllocation(
    productElements,
    effectiveDiscount,
    totalSubtotal
  );

  // 2. Distribusikan diskon produk ke masing-masing baris item aslinya
  const lineAllocatedDiscounts = new Array<number>(items.length).fill(0);

  for (const [id, group] of productGroups.entries()) {
    const prodDiscount = productAllocatedMap.get(id) ?? 0;

    if (group.lines.length === 1) {
      lineAllocatedDiscounts[group.lines[0].originalIndex] = prodDiscount;
    } else {
      // Sub-alokasi Hamilton untuk baris-baris produk yang sama
      const subElements: HamiltonInternalElement[] = group.lines.map((l) => ({
        key: `line-${l.originalIndex}`,
        subtotal: l.subtotal,
        tieBreakOrder: l.originalIndex,
      }));

      const subAllocatedMap = runHamiltonAllocation(
        subElements,
        prodDiscount,
        group.totalSubtotal
      );

      for (const line of group.lines) {
        lineAllocatedDiscounts[line.originalIndex] =
          subAllocatedMap.get(`line-${line.originalIndex}`) ?? 0;
      }
    }
  }

  return items.map((item, index) => {
    const allocated = lineAllocatedDiscounts[index];
    return {
      itemId: item.id,
      allocatedDiscount: allocated,
      netSubtotal: item.subtotal - allocated,
    };
  });
}

/**
 * Laba Kotor = Penjualan Bersih - HPP (COGS)
 */
export function calculateGrossProfit(netSales: number, cogs: number): number {
  return netSales - cogs;
}

/**
 * Margin Laba Kotor (%) = (Laba Kotor / Penjualan Bersih) * 100
 * Dibulatkan hingga 2 angka di belakang koma (contoh: 25.55).
 * Jika netSales <= 0, mengembalikan 0 (menghindari division by zero / NaN).
 */
export function calculateGrossProfitMargin(grossProfit: number, netSales: number): number {
  if (netSales <= 0) {
    return 0;
  }
  const margin = (grossProfit / netSales) * 100;
  return Math.round(margin * 100) / 100;
}

/**
 * Laba Operasional Sederhana = Laba Kotor - Beban Operasional
 */
export function calculateOperatingProfit(grossProfit: number, operatingExpenses: number): number {
  return grossProfit - operatingExpenses;
}

/**
 * Arus Kas Bersih = Kas Masuk - Kas Keluar
 */
export function calculateNetCashFlow(cashInflows: number, cashOutflows: number): number {
  return cashInflows - cashOutflows;
}

export interface JakartaDateRange {
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  startUtc: string;       // ISO 8601 UTC inclusive lower bound
  nextDayUtc: string;     // ISO 8601 UTC exclusive upper bound
}

const JAKARTA_OFFSET_HOURS = 7;
const JAKARTA_OFFSET_MS = JAKARTA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Mengonversi timestamp Date atau UTC ISO string menjadi tanggal kalender Asia/Jakarta (YYYY-MM-DD).
 */
export function formatJakartaDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new TypeError(`INVALID_DATE: Gagal memformat tanggal tidak valid (${String(date)})`);
  }
  const jakartaTime = new Date(d.getTime() + JAKARTA_OFFSET_MS);
  const y = jakartaTime.getUTCFullYear();
  const m = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Menyelesaikan rentang tanggal pelaporan bisnis ke dalam interval setengah terbuka [startUtc, nextDayUtc)
 * berdasarkan zona waktu Asia/Jakarta (UTC+7).
 *
 * Sesuai Section 6 Preflight:
 * - Batas Bawah (Inclusive): YYYY-MM-DD 00:00:00.000+07:00
 * - Batas Atas (Exclusive): Hari berikutnya (nextDay) 00:00:00.000+07:00
 *
 * Contoh:
 * startDate = "2026-10-01", endDate = "2026-10-07"
 * -> startUtc:    "2026-09-30T17:00:00.000Z"
 * -> nextDayUtc:  "2026-10-07T17:00:00.000Z"
 *
 * Jika parameter tanggal ditiadakan:
 * - endDate otomatis adalah hari ini (Asia/Jakarta)
 * - startDate otomatis adalah defaultDays (default 30) hari yang lalu.
 */
export function parseJakartaDateBoundary(
  startDate?: string,
  endDate?: string,
  defaultDays: number = 30,
  referenceDate: Date = new Date()
): JakartaDateRange {
  let resolvedEndStr: string;
  let resolvedStartStr: string;

  const todayJakarta = formatJakartaDate(referenceDate);

  if (!endDate) {
    resolvedEndStr = todayJakarta;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    resolvedEndStr = endDate;
  } else {
    resolvedEndStr = formatJakartaDate(endDate);
  }

  if (!startDate) {
    // Hitung defaultDays yang lalu dari resolvedEndStr
    const [ey, em, ed] = resolvedEndStr.split("-").map(Number);
    // Hari pertama adalah (ed - defaultDays + 1)
    const startDateObj = new Date(Date.UTC(ey, em - 1, ed - defaultDays + 1, -JAKARTA_OFFSET_HOURS, 0, 0, 0));
    resolvedStartStr = formatJakartaDate(startDateObj);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    resolvedStartStr = startDate;
  } else {
    resolvedStartStr = formatJakartaDate(startDate);
  }

  if (resolvedStartStr > resolvedEndStr) {
    throw new RangeError(
      `INVALID_DATE_RANGE: Tanggal mulai (${resolvedStartStr}) tidak boleh lebih besar dari tanggal akhir (${resolvedEndStr})`
    );
  }

  // Hitung startUtc: resolvedStartStr jam 00:00:00 WIB
  const [sy, sm, sd] = resolvedStartStr.split("-").map(Number);
  const startUtcDate = new Date(Date.UTC(sy, sm - 1, sd, -JAKARTA_OFFSET_HOURS, 0, 0, 0));

  // Hitung nextDayUtc: resolvedEndStr + 1 hari jam 00:00:00 WIB
  const [ey, em, ed] = resolvedEndStr.split("-").map(Number);
  const nextDayUtcDate = new Date(Date.UTC(ey, em - 1, ed + 1, -JAKARTA_OFFSET_HOURS, 0, 0, 0));

  return {
    startDate: resolvedStartStr,
    endDate: resolvedEndStr,
    startUtc: startUtcDate.toISOString(),
    nextDayUtc: nextDayUtcDate.toISOString(),
  };
}

