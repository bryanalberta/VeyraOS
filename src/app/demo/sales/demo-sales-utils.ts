import type {
  DemoSale,
  DemoSaleStatus,
  DemoPaymentMethod,
} from "@/services/demo/demo-types";

// ---------------------------------------------------------------------------
// Helper: Format Tanggal Lokal Indonesia (Asia/Jakarta WIB)
// ---------------------------------------------------------------------------
export function formatSaleDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(d) + " WIB"
    );
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// Helper: Logika Murni (Sorting, Filtering, Statistik, Validasi Void)
// ---------------------------------------------------------------------------
export function sortSalesLatestFirst(sales: DemoSale[]): DemoSale[] {
  return [...sales].sort((a, b) => {
    const timeA = new Date(a.transactionDate).getTime();
    const timeB = new Date(b.transactionDate).getTime();
    return timeB - timeA;
  });
}

export function filterSales(
  sales: DemoSale[],
  searchQuery: string,
  statusFilter: "ALL" | DemoSaleStatus = "ALL",
  paymentFilter: "ALL" | DemoPaymentMethod = "ALL"
): DemoSale[] {
  const q = searchQuery.trim().toLowerCase();
  return sales.filter((sale) => {
    // Filter status
    if (statusFilter !== "ALL" && sale.status !== statusFilter) return false;

    // Filter metode pembayaran
    if (paymentFilter !== "ALL" && sale.paymentMethod !== paymentFilter) return false;

    // Filter teks pencarian (No. Faktur, Nama Item, atau Catatan)
    if (q) {
      const matchInvoice = sale.invoiceNumber.toLowerCase().includes(q);
      const matchItem = sale.items.some((item) =>
        item.productName.toLowerCase().includes(q)
      );
      const matchNotes = sale.notes?.toLowerCase().includes(q) ?? false;
      if (!matchInvoice && !matchItem && !matchNotes) return false;
    }

    return true;
  });
}

export function calculateSalesStats(sales: DemoSale[]): {
  totalCount: number;
  completedCount: number;
  voidedCount: number;
  completedNetSales: number;
} {
  const totalCount = sales.length;
  const completedList = sales.filter((s) => s.status === "COMPLETED");
  const voidedList = sales.filter((s) => s.status === "VOIDED");
  const completedNetSales = completedList.reduce((sum, s) => sum + s.totalAmount, 0);

  return {
    totalCount,
    completedCount: completedList.length,
    voidedCount: voidedList.length,
    completedNetSales,
  };
}

export function validateVoidReason(reason: string): { isValid: boolean; message?: string } {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    return {
      isValid: false,
      message: "Alasan pembatalan wajib diisi minimal 5 karakter non-spasi.",
    };
  }
  return { isValid: true };
}
