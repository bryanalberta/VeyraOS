"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  RefreshCw,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  CalendarDays,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSalesReportAction } from "@/app/actions/reports";
import { voidSaleAction } from "@/app/actions/transactions";
import type {
  SalesReportTransactionItem,
  SalesReportResponseData,
} from "@/types/api";
import type { SaleStatus, PaymentMethod } from "@/types/database";
import { formatRupiah, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper: format tanggal ke format lokal Indonesia
// ---------------------------------------------------------------------------
function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// Helper: default tanggal hari ini dan 30 hari lalu (format YYYY-MM-DD)
// ---------------------------------------------------------------------------
function getDefaultDateRange() {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Helper: label dan badge variant untuk status penjualan
// ---------------------------------------------------------------------------
function getStatusBadge(status: SaleStatus) {
  switch (status) {
    case "COMPLETED":
      return { label: "Selesai", variant: "success" as const };
    case "VOIDED":
      return { label: "Dibatalkan", variant: "danger" as const };
    default:
      return { label: status, variant: "outline" as const };
  }
}

// ---------------------------------------------------------------------------
// Helper: label metode pembayaran
// ---------------------------------------------------------------------------
function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "CASH":
      return "Tunai";
    case "BANK_TRANSFER":
      return "Transfer Bank";
    default:
      return method;
  }
}

// ---------------------------------------------------------------------------
// Helper: bangkitkan idempotency key acak (fallback aman non-browser)
// ---------------------------------------------------------------------------
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// VoidModal — dialog konfirmasi pembatalan transaksi
// ---------------------------------------------------------------------------
interface VoidModalProps {
  transaction: SalesReportTransactionItem;
  onClose: () => void;
  onSuccess: (voidedId: string) => void;
}

function VoidModal({ transaction, onClose, onSuccess }: VoidModalProps) {
  const [voidReason, setVoidReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const reasonRef = React.useRef<HTMLTextAreaElement>(null);
  // Idempotency key dipertahankan konsisten untuk seluruh percobaan retry pada modal ini
  const idempotencyKeyRef = React.useRef<string>(generateIdempotencyKey());

  // Fokus otomatis ke textarea saat modal terbuka
  React.useEffect(() => {
    reasonRef.current?.focus();
  }, []);

  // Tutup modal saat ESC ditekan
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isSubmitting, onClose]);

  const trimmedReason = voidReason.trim();
  const isReasonValid = trimmedReason.length >= 5 && trimmedReason.length <= 500;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReasonValid || isSubmitting) return;

    if (transaction.status !== "COMPLETED") {
      setError("Hanya transaksi dengan status Selesai yang dapat dibatalkan.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await voidSaleAction({
        saleId: transaction.id,
        voidReason: trimmedReason,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (!result.success) {
        setError(result.error?.message || "Pembatalan transaksi gagal.");
        return;
      }

      onSuccess(transaction.id);
    } catch {
      setError("Terjadi kegagalan jaringan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      preventClose={isSubmitting}
      initialFocusRef={reasonRef}
      title={
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FDEDEC] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#922B21]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="void-modal-title"
              className="text-base font-semibold text-[#25232B]"
            >
              Batalkan Transaksi
            </h2>
            <p className="mt-0.5 text-xs text-[#716D7A] font-normal">
              {transaction.invoiceNumber} ·{" "}
              {formatRupiah(transaction.totalAmount)}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            id="void-modal-cancel-btn"
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="void-transaction-form"
            variant="destructive"
            size="sm"
            disabled={!isReasonValid || isSubmitting}
            id="void-modal-confirm-btn"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Memproses…
              </span>
            ) : (
              "Batalkan Transaksi"
            )}
          </Button>
        </div>
      }
    >
      <form id="void-transaction-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* peringatan konsekuensi */}
        <div className="rounded-lg bg-[#FEF9E7] border border-[#FAD7A0] p-3 text-xs text-[#7D6608] leading-relaxed">
          <strong>Perhatian:</strong> Pembatalan transaksi bersifat permanen.
          Stok produk yang terjual akan dipulihkan secara otomatis. Tindakan
          ini tidak dapat dibatalkan.
        </div>

        {/* textarea alasan void */}
        <div className="space-y-1.5">
          <label
            htmlFor="void-reason"
            className="text-xs font-medium text-[#25232B]"
          >
            Alasan Pembatalan{" "}
            <span className="text-[#922B21]">*</span>
          </label>
          <textarea
            id="void-reason"
            ref={reasonRef}
            value={voidReason}
            onChange={(e) => {
              setVoidReason(e.target.value);
              setError(null);
            }}
            placeholder="Jelaskan alasan pembatalan transaksi ini (minimal 5 karakter)…"
            rows={3}
            maxLength={500}
            disabled={isSubmitting}
            className={cn(
              "w-full rounded-lg border px-3 py-2.5 text-sm text-[#25232B] placeholder:text-[#A09AA8]",
              "resize-none outline-none transition-colors focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              !isReasonValid && trimmedReason.length > 0
                ? "border-[#E74C3C]"
                : "border-[#E7E3EC]"
            )}
          />
          <div className="flex items-center justify-between">
            {!isReasonValid && trimmedReason.length > 0 ? (
              <p className="text-[11px] text-[#922B21]">
                Alasan minimal 5 karakter.
              </p>
            ) : (
              <span />
            )}
            <p className="text-[11px] text-[#A09AA8] ml-auto">
              {voidReason.length}/500
            </p>
          </div>
        </div>

        {/* error dari server */}
        {error && (
          <Alert variant="danger" className="py-2.5 text-xs">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// VoidSuccessOverlay — konfirmasi singkat setelah void berhasil
// ---------------------------------------------------------------------------
function VoidSuccessBanner({ onDismiss }: { onDismiss: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl bg-[#0E6251] text-white px-4 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4 duration-300"
    >
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      <span>Transaksi berhasil dibatalkan. Stok produk telah dipulihkan.</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonRows — baris placeholder saat memuat data tabel
// ---------------------------------------------------------------------------
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-4 w-20 ml-auto" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-4 w-16 ml-auto" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-4 w-20 ml-auto" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-7 w-16 mx-auto rounded" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// SalesHistoryContent — komponen utama halaman riwayat penjualan
// ---------------------------------------------------------------------------
export function SalesHistoryContent() {
  const defaultDates = React.useMemo(() => getDefaultDateRange(), []);

  // --- Filter input state ---
  const [startDate, setStartDate] = React.useState(defaultDates.start);
  const [endDate, setEndDate] = React.useState(defaultDates.end);
  const [statusFilter, setStatusFilter] = React.useState<SaleStatus | "">("");
  const [page, setPage] = React.useState(1);

  // --- Applied filter query state ---
  const [appliedQuery, setAppliedQuery] = React.useState({
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    status: "" as SaleStatus | "",
  });

  // --- Data state ---
  const [reportData, setReportData] = React.useState<SalesReportResponseData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // --- Void modal state ---
  const [voidTarget, setVoidTarget] = React.useState<SalesReportTransactionItem | null>(null);
  const [showVoidSuccess, setShowVoidSuccess] = React.useState(false);

  // ---------------------------------------------------------------------------
  // Fungsi pemuatan data laporan penjualan berdasarkan query yang diterapkan
  // ---------------------------------------------------------------------------
  const loadReport = React.useCallback(
    async (targetPage: number, queryToUse = appliedQuery) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await getSalesReportAction({
          startDate: queryToUse.startDate.trim() ? queryToUse.startDate.trim() : undefined,
          endDate: queryToUse.endDate.trim() ? queryToUse.endDate.trim() : undefined,
          status: queryToUse.status || undefined,
          page: targetPage,
          pageSize: 20,
        });
        if (!result.success) {
          setLoadError(result.error?.message || "Gagal memuat data penjualan.");
          setReportData(null);
          return;
        }
        setReportData(result.data);
      } catch {
        setLoadError("Terjadi kegagalan jaringan. Silakan coba lagi.");
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [appliedQuery]
  );

  // Muat ulang saat filter yang diterapkan atau halaman berubah
  React.useEffect(() => {
    let isMounted = true;
    getSalesReportAction({
      startDate: appliedQuery.startDate.trim() ? appliedQuery.startDate.trim() : undefined,
      endDate: appliedQuery.endDate.trim() ? appliedQuery.endDate.trim() : undefined,
      status: appliedQuery.status || undefined,
      page,
      pageSize: 20,
    })
      .then((result) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (!result.success) {
          setLoadError(result.error?.message || "Gagal memuat data penjualan.");
          setReportData(null);
          return;
        }
        setLoadError(null);
        setReportData(result.data);
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
          setLoadError("Terjadi kegagalan jaringan. Silakan coba lagi.");
          setReportData(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [appliedQuery, page]);

  // ---------------------------------------------------------------------------
  // Hapus void-target setelah berhasil void; tandai baris sebagai VOIDED
  // ---------------------------------------------------------------------------
  function handleVoidSuccess(voidedId: string) {
    setVoidTarget(null);
    setShowVoidSuccess(true);
    // Optimistic update: tandai baris sebagai VOIDED dan kurangi omzet/diskon terkait
    setReportData((prev) => {
      if (!prev) return prev;
      const targetTx = prev.transactions.find((t) => t.id === voidedId);
      const deductedTotal = targetTx ? targetTx.totalAmount : 0;
      const deductedDiscount = targetTx ? targetTx.discountAmount : 0;
      const deductedSubtotal = targetTx ? targetTx.subtotalAmount : 0;
      return {
        ...prev,
        summary: {
          ...prev.summary,
          completedTransactions: Math.max(0, prev.summary.completedTransactions - 1),
          voidedTransactions: prev.summary.voidedTransactions + 1,
          netSales: Math.max(0, prev.summary.netSales - deductedTotal),
          totalDiscounts: Math.max(0, prev.summary.totalDiscounts - deductedDiscount),
          grossSales: Math.max(0, prev.summary.grossSales - deductedSubtotal),
        },
        transactions: prev.transactions.map((t) =>
          t.id === voidedId ? { ...t, status: "VOIDED" as SaleStatus } : t
        ),
      };
    });

    // Latar belakang: sinkronisasi angka pasti dari server
    getSalesReportAction({
      startDate: appliedQuery.startDate.trim() ? appliedQuery.startDate.trim() : undefined,
      endDate: appliedQuery.endDate.trim() ? appliedQuery.endDate.trim() : undefined,
      status: appliedQuery.status || undefined,
      page,
      pageSize: 20,
    })
      .then((res) => {
        if (res.success) {
          setReportData(res.data);
        }
      })
      .catch(() => {
        // Safe ignore: optimistik update telah melindungi konsistensi tampilan
      });
  }

  function handleApplyFilter() {
    setIsLoading(true);
    setPage(1);
    setAppliedQuery({
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      status: statusFilter,
    });
  }

  const pagination = reportData?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const transactions = reportData?.transactions ?? [];
  const summary = reportData?.summary;

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
              Riwayat Penjualan
            </h1>
            <p className="mt-0.5 text-sm text-[#716D7A]">
              Pantau seluruh transaksi penjualan dan batalkan jika diperlukan.
            </p>
          </div>
          <Link href="/sales/new">
            <Button
              variant="primary"
              size="sm"
              id="new-sale-btn"
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Penjualan Baru
            </Button>
          </Link>
        </div>

        {/* Filter Panel */}
        <div className="rounded-xl border border-[#E7E3EC] bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#25232B]">
            <Filter className="w-4 h-4 text-[#7C3AED]" />
            Filter Transaksi
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tanggal mulai */}
            <div className="space-y-1">
              <label
                htmlFor="filter-start-date"
                className="text-[11px] font-medium text-[#716D7A]"
              >
                Dari Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A09AA8] pointer-events-none" />
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E7E3EC] text-sm text-[#25232B] bg-white outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors"
                />
              </div>
            </div>

            {/* Tanggal akhir */}
            <div className="space-y-1">
              <label
                htmlFor="filter-end-date"
                className="text-[11px] font-medium text-[#716D7A]"
              >
                Sampai Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A09AA8] pointer-events-none" />
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E7E3EC] text-sm text-[#25232B] bg-white outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors"
                />
              </div>
            </div>

            {/* Filter status */}
            <div className="space-y-1">
              <Select
                id="filter-status"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SaleStatus | "")}
                options={[
                  { value: "", label: "Semua Status" },
                  { value: "COMPLETED", label: "Selesai" },
                  { value: "VOIDED", label: "Dibatalkan" },
                ]}
              />
            </div>

            {/* Tombol terapkan filter */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-[#716D7A] invisible block">
                &nbsp;
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyFilter}
                disabled={isLoading}
                id="apply-filter-btn"
                className="w-full h-9"
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Terapkan Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && !isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "Total Transaksi",
                value: summary.totalTransactions.toString(),
                colorClass: "text-[#25232B]",
              },
              {
                label: "Selesai",
                value: summary.completedTransactions.toString(),
                colorClass: "text-[#0E6251]",
              },
              {
                label: "Dibatalkan",
                value: summary.voidedTransactions.toString(),
                colorClass: "text-[#922B21]",
              },
              {
                label: "Omzet Kotor",
                value: formatRupiah(summary.grossSales),
                colorClass: "text-[#25232B]",
              },
              {
                label: "Total Diskon",
                value: formatRupiah(summary.totalDiscounts),
                colorClass: "text-[#7D6608]",
              },
              {
                label: "Penjualan Bersih",
                value: formatRupiah(summary.netSales),
                colorClass: "text-[#5B3CC4]",
              },
            ].map(({ label, value, colorClass }) => (
              <div
                key={label}
                className="rounded-xl border border-[#E7E3EC] bg-white p-3.5 space-y-1"
              >
                <p className="text-[11px] text-[#716D7A] font-medium leading-tight">
                  {label}
                </p>
                <p className={cn("text-base font-bold leading-tight truncate", colorClass)}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {loadError && !isLoading && (
          <Alert variant="danger" className="flex items-center gap-3">
            <span className="flex-1">{loadError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadReport(page)}
              id="retry-load-btn"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Coba Lagi
            </Button>
          </Alert>
        )}

        {/* Tabel Transaksi */}
        <div className="space-y-3">
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {["No. Invoice", "Tanggal", "Metode", "Subtotal", "Diskon", "Total", "Status", "Aksi"].map(
                    (h) => (
                      <TableHead key={h}>{h}</TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          ) : !loadError && transactions.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="w-8 h-8 text-[#A09AA8]" />}
              title="Belum ada transaksi"
              description="Tidak ada transaksi penjualan yang cocok dengan filter yang dipilih."
              action={
                <Link href="/sales/new">
                  <Button variant="primary" size="sm" id="empty-new-sale-btn">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Mulai Penjualan
                  </Button>
                </Link>
              }
            />
          ) : !loadError ? (
            <>
              {/* Tampilan Kartu Mobile (< 768px) */}
              <div className="md:hidden space-y-3">
                {transactions.map((tx) => {
                  const { label, variant } = getStatusBadge(tx.status);
                  const canVoid = tx.status === "COMPLETED";
                  return (
                    <Card
                      key={`mobile-${tx.id}`}
                      className={cn(
                        "border-[#E7E3EC] shadow-xs text-left",
                        tx.status === "VOIDED" && "bg-[#FAF9F6] opacity-80"
                      )}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-xs bg-[#F6F3FF] text-[#5B3CC4] border border-[#EAE4FF] px-2 py-0.5 rounded block w-fit">
                              {tx.invoiceNumber}
                            </span>
                            <p className="text-[11px] text-[#716D7A] mt-1">
                              {formatDate(tx.transactionDate)}
                            </p>
                          </div>
                          <Badge variant={variant} className="text-[10px]">
                            {label}
                          </Badge>
                        </div>

                        <div className="pt-2 border-t border-[#F0EDF5] flex justify-between items-baseline">
                          <span className="text-xs text-[#716D7A]">
                            Metode: <span className="font-medium text-[#25232B]">{getPaymentMethodLabel(tx.paymentMethod)}</span>
                          </span>
                          <div className="text-right">
                            {tx.discountAmount > 0 && (
                              <span className="text-[11px] text-[#7D6608] font-mono block">
                                Diskon -{formatRupiah(tx.discountAmount)}
                              </span>
                            )}
                            <span className="text-base font-bold font-mono text-[#25232B] tabular-nums">
                              {formatRupiah(tx.totalAmount)}
                            </span>
                          </div>
                        </div>

                        {canVoid && (
                          <div className="pt-2 border-t border-[#F0EDF5] flex items-center justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setVoidTarget(tx)}
                              className="text-[#922B21] border-[#FDEDEC] hover:bg-[#FDEDEC] hover:text-[#922B21] min-h-[44px] sm:min-h-0 text-xs px-3"
                              title="Batalkan transaksi ini"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Batalkan Transaksi
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Tampilan Tabel Desktop (>= 768px) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Invoice</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Diskon</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const { label, variant } = getStatusBadge(tx.status);
                      const canVoid = tx.status === "COMPLETED";
                      return (
                        <TableRow key={tx.id} data-testid={`sale-row-${tx.id}`}>
                          <TableCell className="font-mono text-xs font-semibold text-[#5B3CC4]">
                            {tx.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-xs text-[#716D7A] whitespace-nowrap">
                            {formatDate(tx.transactionDate)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {getPaymentMethodLabel(tx.paymentMethod)}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {formatRupiah(tx.subtotalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-[#7D6608]">
                            {tx.discountAmount > 0
                              ? `-${formatRupiah(tx.discountAmount)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold tabular-nums text-[#25232B]">
                            {formatRupiah(tx.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={variant}>{label}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {canVoid ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setVoidTarget(tx)}
                                id={`void-btn-${tx.id}`}
                                className="text-[#922B21] hover:bg-[#FDEDEC] hover:text-[#922B21] h-7 px-2"
                                title="Batalkan transaksi ini"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Batalkan
                              </Button>
                            ) : (
                              <span className="text-xs text-[#A09AA8]">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {/* Pagination */}
          {!isLoading && !loadError && totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-[#716D7A]">
                Halaman {pagination?.page} dari {totalPages} · Total{" "}
                {pagination?.totalRows} transaksi
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => p - 1)}
                  id="prev-page-btn"
                  className="h-8 w-8 p-0"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium text-[#25232B] px-1">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                  id="next-page-btn"
                  className="h-8 w-8 p-0"
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Void Modal */}
      {voidTarget && (
        <VoidModal
          transaction={voidTarget}
          onClose={() => setVoidTarget(null)}
          onSuccess={handleVoidSuccess}
        />
      )}

      {/* Void success banner */}
      {showVoidSuccess && (
        <VoidSuccessBanner onDismiss={() => setShowVoidSuccess(false)} />
      )}
    </AppLayout>
  );
}
