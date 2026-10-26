"use client";

import * as React from "react";
import Link from "next/link";
import {
  Receipt,
  Coins,
  Boxes,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Info,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  getSalesReportAction,
  getExpenseReportAction,
  getStockReportAction,
  exportReportCsvAction,
} from "@/app/actions/reports";
import { getActiveTenantContextAction } from "@/app/actions/business";
import type {
  SalesReportResponseData,
  ExpenseReportResponseData,
  StockReportResponseData,
  BusinessResponseData,
  ReportExportType,
} from "@/types/api";
import type { ExpenseCategory, PaymentMethod, SaleStatus } from "@/types/database";
import { formatRupiah, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Kamus Label Bahasa Indonesia untuk Kategori Beban & Pembayaran
// ---------------------------------------------------------------------------
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  OPERATIONAL: "Operasional Umum",
  SALARY: "Gaji & Upah",
  UTILITIES: "Listrik, Air & Internet",
  RENT: "Sewa Tempat",
  MARKETING: "Pemasaran & Iklan",
  MAINTENANCE: "Perbaikan & Pemeliharaan",
  SUPPLIES: "Perlengkapan Toko",
  OTHER: "Lain-lain",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  BANK_TRANSFER: "Transfer Bank",
};

// ---------------------------------------------------------------------------
// Helper: Format tanggal lokal Indonesia (WIB)
// ---------------------------------------------------------------------------
function formatDate(isoOrDateString: string): string {
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return isoOrDateString;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return isoOrDateString;
  }
}

function formatDateTime(isoOrDateString: string): string {
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return isoOrDateString;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return isoOrDateString;
  }
}

// ---------------------------------------------------------------------------
// Helper: Rentang Tanggal Default Asia/Jakarta (30 hari terakhir)
// ---------------------------------------------------------------------------
function getDefaultDateRange(days = 30): { start: string; end: string } {
  const now = new Date();
  const jakartaOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const jktTime = new Date(now.getTime() + (jakartaOffset + localOffset) * 60 * 1000);

  const endStr = jktTime.toISOString().split("T")[0];
  const startDateObj = new Date(jktTime);
  startDateObj.setDate(startDateObj.getDate() - (days - 1));
  const startStr = startDateObj.toISOString().split("T")[0];

  return { start: startStr, end: endStr };
}

// ---------------------------------------------------------------------------
// Helper: Trigger Download CSV di Browser secara Aman
// ---------------------------------------------------------------------------
function triggerCsvDownload(content: string, filename: string, mimeType = "text/csv; charset=utf-8") {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    // safe fallback
  }
}

// ---------------------------------------------------------------------------
// ReportsSkeleton — Tampilan Placeholder Saat Memuat Data
// ---------------------------------------------------------------------------
function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="reports-loading-skeleton">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <Skeleton className="h-12 w-full max-w-md rounded-xl" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4 bg-white border-[#E7E3EC]">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-6 w-28" />
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-white border-[#E7E3EC] space-y-4">
        <Skeleton className="h-6 w-48 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-[#F0EDF5]">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tipe Props ReportsContent (Dapat Diberi InitialData untuk Pengujian Unit)
// ---------------------------------------------------------------------------
export interface ReportsContentProps {
  initialTab?: "sales" | "expenses" | "stock";
  initialSalesData?: SalesReportResponseData;
  initialExpenseData?: ExpenseReportResponseData;
  initialStockData?: StockReportResponseData;
  initialBusiness?: BusinessResponseData;
}

// ---------------------------------------------------------------------------
// Komponen Utama: ReportsContent
// ---------------------------------------------------------------------------
export function ReportsContent({
  initialTab = "sales",
  initialSalesData,
  initialExpenseData,
  initialStockData,
  initialBusiness,
}: ReportsContentProps) {
  const defaultDates = React.useMemo(() => getDefaultDateRange(30), []);

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = React.useState<"sales" | "expenses" | "stock">(initialTab);

  // --- Tenant & Business State ---
  const [activeBusiness, setActiveBusiness] = React.useState<BusinessResponseData | null>(
    initialBusiness ?? null
  );

  // --- Tab 1: Sales Filter & Data State ---
  const [salesDraftStart, setSalesDraftStart] = React.useState<string>(defaultDates.start);
  const [salesDraftEnd, setSalesDraftEnd] = React.useState<string>(defaultDates.end);
  const [salesDraftStatus, setSalesDraftStatus] = React.useState<SaleStatus | "">("");
  const [salesAppliedQuery, setSalesAppliedQuery] = React.useState({
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    status: "" as SaleStatus | "",
    page: 1,
  });
  const [salesData, setSalesData] = React.useState<SalesReportResponseData | null>(
    initialSalesData ?? null
  );

  // --- Tab 2: Expenses Filter & Data State ---
  const [expenseDraftStart, setExpenseDraftStart] = React.useState<string>(defaultDates.start);
  const [expenseDraftEnd, setExpenseDraftEnd] = React.useState<string>(defaultDates.end);
  const [expenseDraftCategory, setExpenseDraftCategory] = React.useState<ExpenseCategory | "">("");
  const [expenseAppliedQuery, setExpenseAppliedQuery] = React.useState({
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    category: "" as ExpenseCategory | "",
  });
  const [expenseData, setExpenseData] = React.useState<ExpenseReportResponseData | null>(
    initialExpenseData ?? null
  );

  // --- Tab 3: Stock Filter & Data State ---
  const [stockDraftCategory, setStockDraftCategory] = React.useState<string>("");
  const [stockDraftLowStock, setStockDraftLowStock] = React.useState<boolean>(false);
  const [stockDraftArchived, setStockDraftArchived] = React.useState<boolean>(false);
  const [stockAppliedQuery, setStockAppliedQuery] = React.useState({
    category: "",
    lowStockOnly: false,
    isArchived: false,
  });
  const [stockData, setStockData] = React.useState<StockReportResponseData | null>(
    initialStockData ?? null
  );

  // --- Common UI States ---
  const [isLoading, setIsLoading] = React.useState<boolean>(
    !initialSalesData && !initialExpenseData && !initialStockData
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // --- CSV Export State ---
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [exportNotice, setExportNotice] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // --- Filter Date Range Validation ---
  const isSalesDateRangeInvalid =
    salesDraftStart && salesDraftEnd ? new Date(salesDraftStart) > new Date(salesDraftEnd) : false;
  const isExpenseDateRangeInvalid =
    expenseDraftStart && expenseDraftEnd
      ? new Date(expenseDraftStart) > new Date(expenseDraftEnd)
      : false;

  // ---------------------------------------------------------------------------
  // Load Active Tenant Context
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    if (initialBusiness) return;
    let isMounted = true;
    getActiveTenantContextAction().then((tenantRes) => {
      if (!isMounted) return;
      if (tenantRes.success && tenantRes.data?.activeBusiness) {
        setActiveBusiness(tenantRes.data.activeBusiness);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [initialBusiness]);

  // ---------------------------------------------------------------------------
  // Fetch Report Data based on Active Tab
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    // Jika data awal disediakan untuk tab saat ini, lewati fetch otomatis pertama
    if (activeTab === "sales" && initialSalesData && refreshTrigger === 0) return;
    if (activeTab === "expenses" && initialExpenseData && refreshTrigger === 0) return;
    if (activeTab === "stock" && initialStockData && refreshTrigger === 0) return;

    let isMounted = true;

    if (activeTab === "sales") {
      getSalesReportAction({
        startDate: salesAppliedQuery.startDate.trim() ? salesAppliedQuery.startDate.trim() : undefined,
        endDate: salesAppliedQuery.endDate.trim() ? salesAppliedQuery.endDate.trim() : undefined,
        status: salesAppliedQuery.status || undefined,
        page: salesAppliedQuery.page,
        pageSize: 20,
      })
        .then((res) => {
          if (!isMounted) return;
          setIsLoading(false);
          if (!res.success) {
            setLoadError(res.error?.message || "Gagal memuat laporan penjualan dari server.");
            setSalesData(null);
            return;
          }
          setSalesData(res.data);
        })
        .catch(() => {
          if (!isMounted) return;
          setIsLoading(false);
          setLoadError("Terjadi kegagalan koneksi ke server saat memuat laporan penjualan.");
          setSalesData(null);
        });
    } else if (activeTab === "expenses") {
      getExpenseReportAction({
        startDate: expenseAppliedQuery.startDate.trim()
          ? expenseAppliedQuery.startDate.trim()
          : undefined,
        endDate: expenseAppliedQuery.endDate.trim() ? expenseAppliedQuery.endDate.trim() : undefined,
        category: expenseAppliedQuery.category || undefined,
      })
        .then((res) => {
          if (!isMounted) return;
          setIsLoading(false);
          if (!res.success) {
            setLoadError(res.error?.message || "Gagal memuat laporan pengeluaran dari server.");
            setExpenseData(null);
            return;
          }
          setExpenseData(res.data);
        })
        .catch(() => {
          if (!isMounted) return;
          setIsLoading(false);
          setLoadError("Terjadi kegagalan koneksi ke server saat memuat laporan pengeluaran.");
          setExpenseData(null);
        });
    } else if (activeTab === "stock") {
      getStockReportAction({
        category: stockAppliedQuery.category.trim() ? stockAppliedQuery.category.trim() : undefined,
        lowStockOnly: stockAppliedQuery.lowStockOnly || undefined,
        isArchived: stockAppliedQuery.isArchived || undefined,
      })
        .then((res) => {
          if (!isMounted) return;
          setIsLoading(false);
          if (!res.success) {
            setLoadError(res.error?.message || "Gagal memuat laporan stok dari server.");
            setStockData(null);
            return;
          }
          setStockData(res.data);
        })
        .catch(() => {
          if (!isMounted) return;
          setIsLoading(false);
          setLoadError("Terjadi kegagalan koneksi ke server saat memuat laporan stok.");
          setStockData(null);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [
    activeTab,
    salesAppliedQuery,
    expenseAppliedQuery,
    stockAppliedQuery,
    refreshTrigger,
    initialSalesData,
    initialExpenseData,
    initialStockData,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers: Filter Actions
  // ---------------------------------------------------------------------------
  const handleApplySalesFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSalesDateRangeInvalid) return;
    setIsLoading(true);
    setSalesAppliedQuery({
      startDate: salesDraftStart,
      endDate: salesDraftEnd,
      status: salesDraftStatus,
      page: 1,
    });
  };

  const handleResetSalesFilter = () => {
    const range = getDefaultDateRange(30);
    setSalesDraftStart(range.start);
    setSalesDraftEnd(range.end);
    setSalesDraftStatus("");
    setIsLoading(true);
    setSalesAppliedQuery({
      startDate: range.start,
      endDate: range.end,
      status: "",
      page: 1,
    });
  };

  const handleSalesPageChange = (newPage: number) => {
    setIsLoading(true);
    setSalesAppliedQuery((prev) => ({ ...prev, page: newPage }));
  };

  const handleApplyExpenseFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isExpenseDateRangeInvalid) return;
    setIsLoading(true);
    setExpenseAppliedQuery({
      startDate: expenseDraftStart,
      endDate: expenseDraftEnd,
      category: expenseDraftCategory,
    });
  };

  const handleResetExpenseFilter = () => {
    const range = getDefaultDateRange(30);
    setExpenseDraftStart(range.start);
    setExpenseDraftEnd(range.end);
    setExpenseDraftCategory("");
    setIsLoading(true);
    setExpenseAppliedQuery({
      startDate: range.start,
      endDate: range.end,
      category: "",
    });
  };

  const handleApplyStockFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setStockAppliedQuery({
      category: stockDraftCategory,
      lowStockOnly: stockDraftLowStock,
      isArchived: stockDraftArchived,
    });
  };

  const handleResetStockFilter = () => {
    setStockDraftCategory("");
    setStockDraftLowStock(false);
    setStockDraftArchived(false);
    setIsLoading(true);
    setStockAppliedQuery({
      category: "",
      lowStockOnly: false,
      isArchived: false,
    });
  };

  const handleRetry = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  // ---------------------------------------------------------------------------
  // Handler: Export CSV Action
  // ---------------------------------------------------------------------------
  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportNotice(null);

    let exportType: ReportExportType = "SALES";
    let start: string | undefined;
    let end: string | undefined;

    if (activeTab === "sales") {
      exportType = "SALES";
      start = salesAppliedQuery.startDate;
      end = salesAppliedQuery.endDate;
    } else if (activeTab === "expenses") {
      exportType = "EXPENSES";
      start = expenseAppliedQuery.startDate;
      end = expenseAppliedQuery.endDate;
    } else if (activeTab === "stock") {
      exportType = "STOCK";
      start = defaultDates.start;
      end = defaultDates.end;
    }

    try {
      const res = await exportReportCsvAction({
        type: exportType,
        startDate: start?.trim() ? start.trim() : undefined,
        endDate: end?.trim() ? end.trim() : undefined,
      });

      if (!res.success) {
        setExportNotice({
          type: "error",
          message: res.error?.message || "Gagal membuat berkas ekspor CSV.",
        });
        return;
      }

      triggerCsvDownload(res.data.content, res.data.filename, res.data.mimeType);
      setExportNotice({
        type: "success",
        message: `Berkas ${res.data.filename} (${res.data.rowCount} baris data) berhasil diunduh.`,
      });
    } catch {
      setExportNotice({
        type: "error",
        message: "Terjadi kesalahan saat memproses ekspor CSV. Silakan coba lagi.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout
      title="Laporan Keuangan"
      currentPath="/reports"
      activeBusinessName={activeBusiness?.name || "Bisnis Saya"}
      businessCategory={activeBusiness?.category || undefined}
    >
      <div className="space-y-6 pb-12">
        {/* ------------------------------------------------------------------ */}
        {/* Header Laporan */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Laporan Keuangan & Operasional
              </h1>
              {activeBusiness && (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                >
                  {activeBusiness.name}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#716D7A]">
              Rekonsiliasi finansial terverifikasi: Omzet penjualan, beban operasional, dan nilai modal persediaan.
            </p>
          </div>

          {/* Tombol Ekspor CSV Global */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isLoading || isExporting}
              className="text-xs h-9 font-semibold text-[#5B3CC4] border-[#E7E3EC] hover:bg-[#F6F3FF] hover:border-[#5B3CC4]"
              id="export-csv-btn"
              title="Unduh laporan aktif ke format CSV (Excel)"
            >
              <Download className={cn("w-3.5 h-3.5 mr-1.5", isExporting && "animate-bounce")} />
              {isExporting ? "Mengekspor..." : "Ekspor CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isLoading}
              className="text-xs h-9 px-2.5 text-[#716D7A]"
              id="refresh-reports-btn"
              title="Perbarui data laporan"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Notifikasi Status Ekspor CSV */}
        {/* ------------------------------------------------------------------ */}
        {exportNotice && (
          <Alert
            variant={exportNotice.type === "success" ? "success" : "danger"}
            className="flex items-center justify-between text-xs py-2.5"
          >
            <div className="flex items-center gap-2">
              {exportNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0E6251]" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#922B21]" />
              )}
              <span>{exportNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              className="text-xs underline hover:no-underline font-medium"
            >
              Tutup
            </button>
          </Alert>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Segmented Tabs Navigation */}
        {/* ------------------------------------------------------------------ */}
        <div
          role="tablist"
          aria-label="Pilihan Jenis Laporan"
          className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F0EDF5] border border-[#E7E3EC] w-full sm:w-fit overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            id="tab-sales"
            aria-selected={activeTab === "sales"}
            aria-controls="panel-sales"
            tabIndex={activeTab === "sales" ? 0 : -1}
            onClick={() => {
              if (activeTab !== "sales") {
                setIsLoading(true);
                setLoadError(null);
                setActiveTab("sales");
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap min-h-[38px]",
              activeTab === "sales"
                ? "bg-white text-[#5B3CC4] shadow-sm border border-[#EAE4FF]"
                : "text-[#716D7A] hover:text-[#25232B] hover:bg-white/50"
            )}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Laporan Penjualan</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-expenses"
            aria-selected={activeTab === "expenses"}
            aria-controls="panel-expenses"
            tabIndex={activeTab === "expenses" ? 0 : -1}
            onClick={() => {
              if (activeTab !== "expenses") {
                setIsLoading(true);
                setLoadError(null);
                setActiveTab("expenses");
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap min-h-[38px]",
              activeTab === "expenses"
                ? "bg-white text-[#5B3CC4] shadow-sm border border-[#EAE4FF]"
                : "text-[#716D7A] hover:text-[#25232B] hover:bg-white/50"
            )}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>Beban Operasional</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-stock"
            aria-selected={activeTab === "stock"}
            aria-controls="panel-stock"
            tabIndex={activeTab === "stock" ? 0 : -1}
            onClick={() => {
              if (activeTab !== "stock") {
                setIsLoading(true);
                setLoadError(null);
                setActiveTab("stock");
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap min-h-[38px]",
              activeTab === "stock"
                ? "bg-white text-[#5B3CC4] shadow-sm border border-[#EAE4FF]"
                : "text-[#716D7A] hover:text-[#25232B] hover:bg-white/50"
            )}
          >
            <Boxes className="w-4 h-4 shrink-0" />
            <span>Stok & Valuasi Persediaan</span>
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Error Alert State */}
        {/* ------------------------------------------------------------------ */}
        {loadError && !isLoading && (
          <Alert variant="danger" className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#922B21]" />
              <span>{loadError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              id="retry-report-btn"
              className="shrink-0 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Coba Lagi
            </Button>
          </Alert>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Loading State Skeleton */}
        {/* ------------------------------------------------------------------ */}
        {isLoading && <ReportsSkeleton />}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: LAPORAN PENJUALAN */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "sales" && !isLoading && (
          <div id="panel-sales" role="tabpanel" aria-labelledby="tab-sales" className="space-y-6">
            {/* Filter Form Card */}
            <Card className="p-4 sm:p-5 bg-white border-[#E7E3EC] shadow-xs">
              <form
                onSubmit={handleApplySalesFilter}
                className="flex flex-col md:flex-row md:items-end gap-3.5"
              >
                <div className="w-full md:w-44">
                  <label
                    htmlFor="sales-start-date"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    id="sales-start-date"
                    value={salesDraftStart}
                    onChange={(e) => setSalesDraftStart(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="w-full md:w-44">
                  <label
                    htmlFor="sales-end-date"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    id="sales-end-date"
                    value={salesDraftEnd}
                    onChange={(e) => setSalesDraftEnd(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="w-full md:w-48">
                  <Select
                    id="sales-status-filter"
                    label="Status Transaksi"
                    value={salesDraftStatus}
                    onChange={(e) => setSalesDraftStatus(e.target.value as SaleStatus | "")}
                    options={[
                      { value: "", label: "Semua Status" },
                      { value: "COMPLETED", label: "Selesai (COMPLETED)" },
                      { value: "VOIDED", label: "Dibatalkan (VOIDED)" },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    id="apply-sales-filter-btn"
                    disabled={isSalesDateRangeInvalid}
                    className="h-9 text-xs font-semibold"
                  >
                    <Filter className="w-3.5 h-3.5 mr-1" />
                    Terapkan Filter
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    id="reset-sales-filter-btn"
                    onClick={handleResetSalesFilter}
                    className="h-9 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </form>

              {isSalesDateRangeInvalid && (
                <p className="mt-2 text-xs text-[#C0392B] font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Tanggal mulai tidak boleh lebih besar dari tanggal akhir.
                </p>
              )}
            </Card>

            {/* Ringkasan Finansial Penjualan (6 KPI Cards) */}
            {salesData && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Penjualan Bersih
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#5B3CC4] mt-1 font-financial tabular-nums">
                    {formatRupiah(salesData.summary.netSales)}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Omzet riil selesai</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Penjualan Kotor
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                    {formatRupiah(salesData.summary.grossSales)}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Sebelum potongan</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Total Diskon
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#B9770E] mt-1 font-financial tabular-nums">
                    {formatRupiah(salesData.summary.totalDiscounts)}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Item & nota nota</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Total Transaksi
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                    {salesData.summary.totalTransactions}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Dalam rentang filter</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Selesai
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#1E824C] mt-1 font-financial tabular-nums">
                    {salesData.summary.completedTransactions}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Omzet dihitung</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Dibatalkan
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#C0392B] mt-1 font-financial tabular-nums">
                    {salesData.summary.voidedTransactions}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Status VOIDED</span>
                </Card>
              </div>
            )}

            {/* Tabel Transaksi Penjualan */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E7E3EC] flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                    Daftar Transaksi Penjualan
                  </h2>
                  <p className="text-xs text-[#716D7A] mt-0.5">
                    Periode: {formatDate(salesAppliedQuery.startDate)} –{" "}
                    {formatDate(salesAppliedQuery.endDate)}
                  </p>
                </div>
                {salesData?.pagination && (
                  <span className="text-xs text-[#716D7A] font-medium">
                    Total {salesData.pagination.totalRows} transaksi
                  </span>
                )}
              </div>

              {salesData && salesData.transactions.length > 0 ? (
                <>
                  {/* Tampilan Kartu Mobile (< 768px) */}
                  <div className="md:hidden space-y-3 p-4">
                    {salesData.transactions.map((tx) => {
                      const isVoided = tx.status === "VOIDED";
                      return (
                        <div
                          key={`mobile-${tx.id}`}
                          className={cn(
                            "p-3.5 rounded-xl border border-[#E7E3EC] bg-white shadow-xs space-y-2.5",
                            isVoided && "bg-[#FAF9F6] opacity-80"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono font-bold text-xs bg-[#F6F3FF] text-[#5B3CC4] border border-[#EAE4FF] px-2 py-0.5 rounded block w-fit">
                                {tx.invoiceNumber}
                              </span>
                              <p className="text-[11px] text-[#716D7A] mt-1">
                                {formatDateTime(tx.transactionDate)}
                              </p>
                            </div>
                            {isVoided ? (
                              <Badge
                                variant="danger"
                                className="text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Dibatalkan
                              </Badge>
                            ) : (
                              <Badge
                                variant="success"
                                className="text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Selesai
                              </Badge>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[#F0EDF5] flex justify-between items-baseline text-xs">
                            <span className="text-[#716D7A]">
                              Metode:{" "}
                              <span className="font-medium text-[#25232B]">
                                {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}
                              </span>
                            </span>
                            <div className="text-right">
                              {tx.discountAmount > 0 && (
                                <span className="text-[11px] text-[#B9770E] font-mono block">
                                  Diskon -{formatRupiah(tx.discountAmount)}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "text-base font-bold font-mono text-[#25232B] tabular-nums",
                                  isVoided && "line-through text-[#922B21]"
                                )}
                              >
                                {formatRupiah(tx.totalAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tampilan Tabel Desktop (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#FAF9F6]">
                          <TableHead className="text-xs font-semibold text-[#25232B]">
                            No. Faktur
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#25232B]">
                            Tanggal & Waktu
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#25232B]">
                            Status
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#25232B]">
                            Pembayaran
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                            Subtotal
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                            Diskon
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                            Total Bersih
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesData.transactions.map((tx) => {
                          const isVoided = tx.status === "VOIDED";
                          return (
                            <TableRow
                              key={tx.id}
                              className={cn(
                                "hover:bg-[#F6F3FF]/50 transition-colors",
                                isVoided && "bg-[#FDEDEC]/30"
                              )}
                            >
                              <TableCell className="font-mono text-xs font-bold text-[#25232B]">
                                {tx.invoiceNumber}
                              </TableCell>
                              <TableCell className="text-xs text-[#716D7A] whitespace-nowrap">
                                {formatDateTime(tx.transactionDate)}
                              </TableCell>
                              <TableCell>
                                {isVoided ? (
                                  <Badge
                                    variant="danger"
                                    className="text-[10px] font-semibold uppercase tracking-wider"
                                  >
                                    Dibatalkan
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="success"
                                    className="text-[10px] font-semibold uppercase tracking-wider"
                                  >
                                    Selesai
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-[#25232B]">
                                {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-xs text-right tabular-nums",
                                  isVoided && "line-through text-[#716D7A]"
                                )}
                              >
                                {formatRupiah(tx.subtotalAmount)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-xs text-right tabular-nums text-[#B9770E]",
                                  isVoided && "line-through text-[#716D7A]"
                                )}
                              >
                                {tx.discountAmount > 0
                                  ? `-${formatRupiah(tx.discountAmount)}`
                                  : "Rp 0"}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-xs font-bold text-right tabular-nums text-[#25232B]",
                                  isVoided && "line-through text-[#922B21]"
                                )}
                              >
                                {formatRupiah(tx.totalAmount)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginasi Footer */}
                  {salesData.pagination && (
                    <div className="p-4 border-t border-[#E7E3EC] flex flex-col sm:flex-row items-center justify-between gap-3">
                      <span className="text-xs text-[#716D7A]">
                        Halaman <strong>{salesData.pagination.page}</strong> dari{" "}
                        <strong>{salesData.pagination.totalPages}</strong> (Total{" "}
                        {salesData.pagination.totalRows} transaksi)
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          id="sales-prev-page-btn"
                          disabled={salesData.pagination.page <= 1 || isLoading}
                          onClick={() => handleSalesPageChange(salesData.pagination.page - 1)}
                          className="h-8 text-xs"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                          Sebelumnya
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          id="sales-next-page-btn"
                          disabled={
                            salesData.pagination.page >= salesData.pagination.totalPages ||
                            isLoading
                          }
                          onClick={() => handleSalesPageChange(salesData.pagination.page + 1)}
                          className="h-8 text-xs"
                        >
                          Berikutnya
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center" data-testid="sales-empty-state">
                  <div className="w-12 h-12 rounded-full bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center mx-auto mb-3">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#25232B]">
                    Tidak Ada Transaksi Penjualan
                  </h3>
                  <p className="text-xs text-[#716D7A] mt-1 max-w-sm mx-auto">
                    Tidak ditemukan data transaksi penjualan pada rentang filter yang dipilih.
                  </p>
                  <Link href="/sales/new" className="inline-block mt-4">
                    <Button variant="primary" size="sm" className="text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Mulai Transaksi Baru
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: LAPORAN BEBAN OPERASIONAL */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "expenses" && !isLoading && (
          <div
            id="panel-expenses"
            role="tabpanel"
            aria-labelledby="tab-expenses"
            className="space-y-6"
          >
            {/* Filter Form Card */}
            <Card className="p-4 sm:p-5 bg-white border-[#E7E3EC] shadow-xs">
              <form
                onSubmit={handleApplyExpenseFilter}
                className="flex flex-col md:flex-row md:items-end gap-3.5"
              >
                <div className="w-full md:w-44">
                  <label
                    htmlFor="expense-start-date"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    id="expense-start-date"
                    value={expenseDraftStart}
                    onChange={(e) => setExpenseDraftStart(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="w-full md:w-44">
                  <label
                    htmlFor="expense-end-date"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    id="expense-end-date"
                    value={expenseDraftEnd}
                    onChange={(e) => setExpenseDraftEnd(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="w-full md:w-56">
                  <Select
                    id="expense-category-filter"
                    label="Kategori Pengeluaran"
                    value={expenseDraftCategory}
                    onChange={(e) =>
                      setExpenseDraftCategory(e.target.value as ExpenseCategory | "")
                    }
                    options={[
                      { value: "", label: "Semua Kategori" },
                      ...Object.entries(EXPENSE_CATEGORY_LABELS).map(([catKey, label]) => ({
                        value: catKey,
                        label,
                      })),
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    id="apply-expense-filter-btn"
                    disabled={isExpenseDateRangeInvalid}
                    className="h-9 text-xs font-semibold"
                  >
                    <Filter className="w-3.5 h-3.5 mr-1" />
                    Terapkan Filter
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    id="reset-expense-filter-btn"
                    onClick={handleResetExpenseFilter}
                    className="h-9 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </form>

              {isExpenseDateRangeInvalid && (
                <p className="mt-2 text-xs text-[#C0392B] font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Tanggal mulai tidak boleh lebih besar dari tanggal akhir.
                </p>
              )}
            </Card>

            {/* Catatan Edukatif Finansial Pemisahan Biaya Operasional vs Stok */}
            <div className="rounded-xl p-3.5 bg-[#F6F3FF] border border-[#EAE4FF] flex items-start gap-2.5 text-xs text-[#392477]">
              <Info className="w-4 h-4 shrink-0 text-[#5B3CC4] mt-0.5" />
              <div>
                <strong>Prinsip Akuntansi UMKM:</strong> Pembelian restock persediaan barang dagangan{" "}
                <strong>tidak dimasukkan</strong> ke dalam beban operasional, melainkan dicatat
                sebagai nilai aset persediaan hingga barang terjual menjadi HPP.
              </div>
            </div>

            {/* Ringkasan KPI Beban & Rincian Kategori */}
            {expenseData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Kartu Total Pengeluaran */}
                <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#716D7A] uppercase tracking-wider block">
                      Total Beban Operasional
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-[#C0392B] mt-2 font-financial tabular-nums">
                      {formatRupiah(expenseData.totalExpenses)}
                    </div>
                    <p className="text-xs text-[#716D7A] mt-1">
                      Periode: {formatDate(expenseData.period.startDate)} –{" "}
                      {formatDate(expenseData.period.endDate)}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#F0EDF5] flex items-center justify-between text-xs text-[#716D7A]">
                    <span>Total Catatan Pengeluaran</span>
                    <strong className="text-[#25232B] font-bold">
                      {expenseData.expenses.length} Transaksi
                    </strong>
                  </div>
                </Card>

                {/* Kartu Rincian Kategori Beban */}
                <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs lg:col-span-2">
                  <h3 className="text-xs font-bold text-[#25232B] uppercase tracking-wider mb-3">
                    Komposisi Beban per Kategori
                  </h3>

                  {expenseData.byCategory.length > 0 ? (
                    <div className="space-y-3">
                      {expenseData.byCategory.map((cat) => (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#25232B]">
                              {EXPENSE_CATEGORY_LABELS[cat.category] || cat.category}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[#716D7A] font-financial tabular-nums font-mono">
                                ({cat.count}x)
                              </span>
                              <strong className="text-[#25232B] font-financial tabular-nums">
                                {formatRupiah(cat.totalAmount)}
                              </strong>
                              <Badge
                                variant="outline"
                                className="text-[10px] text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF] font-financial tabular-nums"
                              >
                                {cat.percentage}%
                              </Badge>
                            </div>
                          </div>
                          {/* Progress bar proporsi */}
                          <div className="w-full h-1.5 rounded-full bg-[#F0EDF5] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#5B3CC4] transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#716D7A]">Belum ada data pengeluaran.</p>
                  )}
                </Card>
              </div>
            )}

            {/* Tabel Daftar Pengeluaran */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E7E3EC] flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                    Rincian Beban Operasional
                  </h2>
                  <p className="text-xs text-[#716D7A] mt-0.5">
                    Daftar pengeluaran toko untuk kebutuhan sewa, gaji, listrik, dan operasional lainnya.
                  </p>
                </div>
              </div>

              {expenseData && expenseData.expenses.length > 0 ? (
                <>
                  {/* Tampilan Kartu Mobile (< 768px) */}
                  <div className="md:hidden space-y-3 p-4">
                    {expenseData.expenses.map((item) => (
                      <div
                        key={`mobile-exp-${item.id}`}
                        className="p-3.5 rounded-xl border border-[#E7E3EC] bg-white shadow-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                            >
                              {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                            </Badge>
                            <p className="text-[11px] text-[#716D7A] mt-1">
                              {formatDate(item.expenseDate)}
                            </p>
                          </div>
                          <span className="text-base font-bold font-mono text-right tabular-nums text-[#C0392B]">
                            {formatRupiah(item.amount)}
                          </span>
                        </div>
                        {item.description && (
                          <div className="pt-2 border-t border-[#F0EDF5] text-xs text-[#716D7A]">
                            {item.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tampilan Tabel Desktop (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAF9F6]">
                        <TableHead className="text-xs font-semibold text-[#25232B]">Tanggal</TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B]">Kategori</TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B]">
                          Deskripsi / Catatan
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                          Nominal
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseData.expenses.map((item) => (
                        <TableRow key={item.id} className="hover:bg-[#F6F3FF]/50 transition-colors">
                          <TableCell className="text-xs text-[#25232B] whitespace-nowrap">
                            {formatDate(item.expenseDate)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                            >
                              {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-[#716D7A]">
                            {item.description || "-"}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-right tabular-nums text-[#C0392B]">
                            {formatRupiah(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
                <div className="p-12 text-center" data-testid="expenses-empty-state">
                  <div className="w-12 h-12 rounded-full bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center mx-auto mb-3">
                    <Coins className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#25232B]">
                    Tidak Ada Catatan Pengeluaran
                  </h3>
                  <p className="text-xs text-[#716D7A] mt-1 max-w-sm mx-auto">
                    Tidak ditemukan beban operasional pada rentang filter tanggal atau kategori yang dipilih.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: LAPORAN STOK & VALUASI PERSEDIAAN */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "stock" && !isLoading && (
          <div id="panel-stock" role="tabpanel" aria-labelledby="tab-stock" className="space-y-6">
            {/* Filter Form Card */}
            <Card className="p-4 sm:p-5 bg-white border-[#E7E3EC] shadow-xs">
              <form
                onSubmit={handleApplyStockFilter}
                className="flex flex-col md:flex-row md:items-end gap-3.5"
              >
                <div className="w-full md:w-60">
                  <label
                    htmlFor="stock-category-filter"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Filter Kategori Produk
                  </label>
                  <input
                    type="text"
                    id="stock-category-filter"
                    placeholder="Contoh: Sembako, Minuman..."
                    value={stockDraftCategory}
                    onChange={(e) => setStockDraftCategory(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="flex items-center gap-4 py-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#25232B] cursor-pointer">
                    <input
                      type="checkbox"
                      id="stock-low-stock-toggle"
                      checked={stockDraftLowStock}
                      onChange={(e) => setStockDraftLowStock(e.target.checked)}
                      className="rounded border-[#E7E3EC] text-[#5B3CC4] focus:ring-[#5B3CC4] w-4 h-4"
                    />
                    <span>Hanya Stok Menipis</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-[#25232B] cursor-pointer">
                    <input
                      type="checkbox"
                      id="stock-archived-toggle"
                      checked={stockDraftArchived}
                      onChange={(e) => setStockDraftArchived(e.target.checked)}
                      className="rounded border-[#E7E3EC] text-[#5B3CC4] focus:ring-[#5B3CC4] w-4 h-4"
                    />
                    <span>Termasuk Diarsipkan</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    id="apply-stock-filter-btn"
                    className="h-9 text-xs font-semibold"
                  >
                    <Filter className="w-3.5 h-3.5 mr-1" />
                    Terapkan Filter
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    id="reset-stock-filter-btn"
                    onClick={handleResetStockFilter}
                    className="h-9 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </Card>

            {/* Catatan Edukatif Valuasi Modal MWAC */}
            <div className="rounded-xl p-3.5 bg-[#F6F3FF] border border-[#EAE4FF] flex items-start gap-2.5 text-xs text-[#392477]">
              <Info className="w-4 h-4 shrink-0 text-[#5B3CC4] mt-0.5" />
              <div>
                <strong>Metode Valuasi MWAC (Moving Weighted Average Cost):</strong> Nilai modal aset
                dihitung berdasarkan harga perolehan historis (HPP produk), bukan dari harga jual
                toko. Potensi omzet mencerminkan nilai kas jika seluruh stok saat ini terjual habis.
              </div>
            </div>

            {/* Ringkasan Finansial Stok & Valuasi (6 KPI Cards) */}
            {stockData && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Modal Aset Stok
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#5B3CC4] mt-1 font-financial tabular-nums">
                    {formatRupiah(stockData.summary.totalAssetValueCost)}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Berdasarkan HPP</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Potensi Omzet
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                    {formatRupiah(stockData.summary.totalAssetValueSelling)}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Harga jual penuh</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Potensi Laba Kotor
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#1E824C] mt-1 font-financial tabular-nums">
                    {formatRupiah(
                      stockData.summary.totalAssetValueSelling -
                        stockData.summary.totalAssetValueCost
                    )}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Selisih jual - HPP</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Total Unit Stok
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                    {stockData.summary.totalStockUnits}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Kuantitas fisik</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Jenis Produk
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                    {stockData.summary.totalProducts}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Item dalam filter</span>
                </Card>

                <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                  <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                    Stok Menipis
                  </span>
                  <div
                    className={cn(
                      "text-base sm:text-lg font-bold mt-1 font-financial tabular-nums",
                      stockData.summary.lowStockCount > 0 ? "text-[#C0392B]" : "text-[#1E824C]"
                    )}
                  >
                    {stockData.summary.lowStockCount}
                  </div>
                  <span className="text-[10px] text-[#716D7A] mt-0.5 block">Perlu restock</span>
                </Card>
              </div>
            )}

            {/* Tabel Daftar Valuasi Stok */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E7E3EC] flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                    Valuasi Inventaris & Persediaan
                  </h2>
                  <p className="text-xs text-[#716D7A] mt-0.5">
                    Rincian kuantitas fisik, batas ambang minimum, modal persediaan, dan potensi omzet.
                  </p>
                </div>
              </div>

              {stockData && stockData.items.length > 0 ? (
                <>
                  {/* Tampilan Kartu Mobile (< 768px) */}
                  <div className="md:hidden space-y-3 p-4">
                    {stockData.items.map((prod) => {
                      const isZeroStock = prod.stockQuantity === 0;
                      const isLowStock = prod.isLowStock;
                      return (
                        <div
                          key={`mobile-stock-${prod.id}`}
                          className={cn(
                            "p-3.5 rounded-xl border border-[#E7E3EC] bg-white shadow-xs space-y-2.5",
                            isZeroStock && "bg-[#FDEDEC]/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-xs sm:text-sm text-[#25232B] block truncate">
                                {prod.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {prod.sku && (
                                  <span className="text-[11px] font-mono text-[#716D7A]">
                                    {prod.sku}
                                  </span>
                                )}
                                {prod.category && (
                                  <span className="text-[11px] text-[#5B3CC4] bg-[#F6F3FF] px-1.5 py-0.5 rounded">
                                    {prod.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isZeroStock ? (
                              <Badge
                                variant="danger"
                                className="text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Habis (0)
                              </Badge>
                            ) : isLowStock ? (
                              <Badge
                                variant="warning"
                                className="text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Menipis (Min: {prod.minStockAlert})
                              </Badge>
                            ) : (
                              <Badge
                                variant="success"
                                className="text-[10px] font-semibold uppercase tracking-wider"
                              >
                                Aman
                              </Badge>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[#F0EDF5] grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[11px] text-[#716D7A] block">Stok Fisik</span>
                              <span className="font-bold text-[#25232B] font-mono">
                                {prod.stockQuantity} unit
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-[#716D7A] block">HPP Beli (MWAC)</span>
                              <span className="text-[#716D7A] font-mono">
                                {formatRupiah(prod.costPrice)}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#F0EDF5] flex justify-between items-baseline text-xs">
                            <div>
                              <span className="text-[11px] text-[#716D7A] block">Nilai Modal Aset</span>
                              <span className="font-bold text-[#5B3CC4] font-mono">
                                {formatRupiah(prod.assetValueCost)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-[#716D7A] block">Potensi Omzet</span>
                              <span className="font-bold text-[#1E824C] font-mono">
                                {formatRupiah(prod.assetValueSelling)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tampilan Tabel Desktop (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow className="bg-[#FAF9F6]">
                        <TableHead className="text-xs font-semibold text-[#25232B]">
                          Produk & SKU
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B]">
                          Kategori
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-center">
                          Stok Fisik
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-center">
                          Status Stok
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                          HPP Beli (MWAC)
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                          Harga Jual
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                          Nilai Modal Aset
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#25232B] text-right">
                          Potensi Omzet
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData.items.map((prod) => {
                        const isZeroStock = prod.stockQuantity === 0;
                        const isLowStock = prod.isLowStock;
                        return (
                          <TableRow
                            key={prod.id}
                            className={cn(
                              "hover:bg-[#F6F3FF]/50 transition-colors",
                              isZeroStock && "bg-[#FDEDEC]/30"
                            )}
                          >
                            <TableCell>
                              <div className="font-semibold text-xs text-[#25232B]">{prod.name}</div>
                              {prod.sku && (
                                <span className="font-mono text-[10px] text-[#716D7A]">
                                  {prod.sku}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-[#716D7A]">
                              {prod.category || "-"}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-center tabular-nums text-[#25232B]">
                              {prod.stockQuantity} unit
                            </TableCell>
                            <TableCell className="text-center">
                              {isZeroStock ? (
                                <Badge
                                  variant="danger"
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                >
                                  Habis (0)
                                </Badge>
                              ) : isLowStock ? (
                                <Badge
                                  variant="warning"
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                >
                                  Menipis (Min: {prod.minStockAlert})
                                </Badge>
                              ) : (
                                <Badge
                                  variant="success"
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                >
                                  Aman
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-[#716D7A]">
                              {formatRupiah(prod.costPrice)}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-[#25232B]">
                              {formatRupiah(prod.sellingPrice)}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-right tabular-nums text-[#5B3CC4]">
                              {formatRupiah(prod.assetValueCost)}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-right tabular-nums text-[#1E824C]">
                              {formatRupiah(prod.assetValueSelling)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
                <div className="p-12 text-center" data-testid="stock-empty-state">
                  <div className="w-12 h-12 rounded-full bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center mx-auto mb-3">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#25232B]">Tidak Ada Data Persediaan</h3>
                  <p className="text-xs text-[#716D7A] mt-1 max-w-sm mx-auto">
                    Tidak ditemukan produk aktif pada kriteria filter kategori atau stok yang dipilih.
                  </p>
                  <Link href="/products/new" className="inline-block mt-4">
                    <Button variant="primary" size="sm" className="text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Tambah Produk Baru
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Wrapper View dengan Suspense Boundary
// ---------------------------------------------------------------------------
export function ReportsView() {
  return (
    <React.Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </React.Suspense>
  );
}

export default ReportsContent;
