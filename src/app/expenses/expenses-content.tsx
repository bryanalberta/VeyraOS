"use client";

import * as React from "react";
import {
  ArrowDownCircle,
  Plus,
  Filter,
  RefreshCw,
  AlertTriangle,
  X,
  Tag,
  Lock,
  Receipt,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  recordExpenseAction,
  getExpensesAction,
} from "@/app/actions/expenses";
import { getActiveTenantContextAction } from "@/app/actions/business";
import type {
  ExpenseResponseData,
  BusinessResponseData,
} from "@/types/api";
import type { ExpenseCategory } from "@/types/database";
import { formatRupiah, cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAP,
} from "@/constants/expenses";

// ---------------------------------------------------------------------------
// Helper: Format Tanggal & Waktu Lokal Indonesia (WIB)
// ---------------------------------------------------------------------------
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
// Helper: Tanggal Kalender Hari Ini Berbasis Asia/Jakarta (YYYY-MM-DD)
// ---------------------------------------------------------------------------
function getTodayJakartaString(): string {
  const now = new Date();
  const jakartaOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const jktTime = new Date(now.getTime() + (jakartaOffset + localOffset) * 60 * 1000);
  return jktTime.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Helper: Konversi Tanggal Input Browser (YYYY-MM-DD) ke ISO 8601 Lengkap (WIB)
// ---------------------------------------------------------------------------
function convertLocalDateToIso(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date().toISOString();
  }
  // Tetapkan jam 12:00:00 WIB (+07:00) agar tanggal kalender stabil di UTC maupun WIB
  const dateObj = new Date(`${dateStr}T12:00:00+07:00`);
  if (isNaN(dateObj.getTime())) {
    return new Date().toISOString();
  }
  return dateObj.toISOString();
}

// ---------------------------------------------------------------------------
// Modal Form: Catat Pengeluaran Baru (Accessible Dialog Pattern)
// ---------------------------------------------------------------------------
interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateExpenseModal({ isOpen, onClose, onSuccess }: CreateExpenseModalProps) {
  const [expenseDate, setExpenseDate] = React.useState(() => getTodayJakartaString());
  const [category, setCategory] = React.useState<ExpenseCategory>("OPERATIONAL");
  const [amount, setAmount] = React.useState(0);
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Field validation states
  const [fieldErrors, setFieldErrors] = React.useState<{
    amount?: string;
    description?: string;
    expenseDate?: string;
  }>({});

  const dateInputRef = React.useRef<HTMLInputElement>(null);

  // Reset form state saat modal dibuka
  React.useEffect(() => {
    if (isOpen) {
      setExpenseDate(getTodayJakartaString());
      setCategory("OPERATIONAL");
      setAmount(0);
      setDescription("");
      setFieldErrors({});
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    if (fieldErrors.description) {
      setFieldErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validasi form sisi klien
    const errors: {
      amount?: string;
      description?: string;
      expenseDate?: string;
    } = {};

    if (amount <= 0) {
      errors.amount = "Nominal pengeluaran harus lebih besar dari Rp 0.";
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 2) {
      errors.description = "Keterangan pengeluaran minimal 2 karakter.";
    } else if (trimmedDesc.length > 500) {
      errors.description = "Keterangan pengeluaran maksimal 500 karakter.";
    }

    if (!expenseDate) {
      errors.expenseDate = "Tanggal pengeluaran wajib diisi.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Konversi tanggal input ke format ISO 8601 lengkap
      const isoDatetime = convertLocalDateToIso(expenseDate);

      const response = await recordExpenseAction({
        category,
        amount,
        description: trimmedDesc,
        expenseDate: isoDatetime,
      });

      if (!response.success) {
        setErrorMessage(
          response.error?.message || "Gagal menyimpan catatan pengeluaran."
        );
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan. Silakan periksa koneksi Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      preventClose={isSubmitting}
      initialFocusRef={dateInputRef}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
            <ArrowDownCircle className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="create-expense-modal-title"
              className="text-base font-bold text-[#25232B]"
            >
              Catat Pengeluaran Baru
            </h2>
            <p className="text-xs text-[#716D7A] font-normal">
              Buku catatan beban operasional non-persediaan usaha Anda
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Peringatan visual Anti-Double Count HPP */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="font-semibold text-amber-950">
              Penting: Pemisahan Beban vs Pembelian Stok
            </strong>
            <p className="text-amber-800 leading-relaxed">
              Pembelian barang dagangan/stok toko dicatat melalui menu{" "}
              <strong>Pembelian Stok</strong>, bukan di sini, agar Harga Pokok
              Penjualan (HPP) tidak terhitung ganda.
            </p>
          </div>
        </div>

        {errorMessage && (
          <Alert
            variant="danger"
            className="text-xs py-2.5 px-3.5"
            data-testid="modal-error-alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mr-2" />
            <span>{errorMessage}</span>
          </Alert>
        )}

        {/* Baris 1: Tanggal & Kategori */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="expense-input-date"
              className="block text-xs font-semibold text-[#25232B] mb-1.5"
            >
              Tanggal Pengeluaran <span className="text-[#C0392B]">*</span>
            </label>
            <input
              ref={dateInputRef}
              type="date"
              id="expense-input-date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-2 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-10 transition-colors",
                fieldErrors.expenseDate && "border-[#C0392B] focus:ring-[#C0392B]"
              )}
            />
            {fieldErrors.expenseDate && (
              <p className="mt-1 text-[11px] text-[#C0392B]">
                {fieldErrors.expenseDate}
              </p>
            )}
          </div>

          <div>
            <Select
              id="expense-input-category"
              label="Kategori Pengeluaran"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              disabled={isSubmitting}
              options={EXPENSE_CATEGORIES.map((cat) => ({
                value: cat.key,
                label: cat.label,
              }))}
            />
          </div>
        </div>

        {/* Baris 2: Nominal Pengeluaran */}
        <div>
          <CurrencyInput
            id="expense-input-amount"
            label="Nominal Pengeluaran (Rupiah)"
            required
            value={amount}
            onValueChange={(val) => {
              setAmount(val);
              if (fieldErrors.amount) {
                setFieldErrors((prev) => ({ ...prev, amount: undefined }));
              }
            }}
            disabled={isSubmitting}
            errorMessage={fieldErrors.amount}
            helperText={!fieldErrors.amount ? "Nominal bilangan bulat tanpa sen (contoh: 150000)" : undefined}
            min={0}
            placeholder="0"
          />
        </div>

        {/* Baris 3: Keterangan / Deskripsi */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="expense-input-description"
              className="block text-xs font-semibold text-[#25232B]"
            >
              Keterangan / Keperluan <span className="text-[#C0392B]">*</span>
            </label>
            <span className="text-[11px] text-[#716D7A]">
              {description.trim().length} / 500 karakter
            </span>
          </div>
          <textarea
            id="expense-input-description"
            rows={3}
            placeholder="Contoh: Pembayaran tagihan listrik toko bulan Oktober"
            value={description}
            onChange={handleDescriptionChange}
            disabled={isSubmitting}
            className={cn(
              "w-full rounded-md border border-[#E7E3EC] bg-white p-3 text-xs text-[#25232B] placeholder:text-[#A09AA8] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] transition-colors resize-none",
              fieldErrors.description && "border-[#C0392B] focus:ring-[#C0392B]"
            )}
          />
          {fieldErrors.description ? (
            <p className="mt-1 text-[11px] text-[#C0392B]">
              {fieldErrors.description}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-[#716D7A]">
              Wajib minimal 2 karakter untuk keperluan jejak audit buku kas
            </p>
          )}
        </div>

        {/* Footer buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E7E3EC]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-semibold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            id="submit-expense-button"
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-semibold"
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loading Komponen
// ---------------------------------------------------------------------------
function ExpensesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="expenses-skeleton">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-60 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      {/* 3 KPI Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 bg-white border-[#E7E3EC]">
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-7 w-36 mb-1" />
            <Skeleton className="h-3 w-44" />
          </Card>
        ))}
      </div>

      {/* Filter skeleton */}
      <Card className="p-4 bg-white border-[#E7E3EC]">
        <div className="flex flex-col md:flex-row gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>

      {/* Table skeleton */}
      <Card className="p-6 bg-white border-[#E7E3EC]">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Content Component
// ---------------------------------------------------------------------------
export interface ExpensesContentProps {
  initialExpenses?: ExpenseResponseData[];
  initialBusiness?: BusinessResponseData;
}

export function ExpensesContent({
  initialExpenses,
  initialBusiness,
}: ExpensesContentProps = {}) {
  // State Bisnis & Tenant Context
  const [activeBusiness, setActiveBusiness] = React.useState<BusinessResponseData | null>(
    initialBusiness || null
  );

  // State Data Pengeluaran
  const [expenses, setExpenses] = React.useState<ExpenseResponseData[]>(
    initialExpenses || []
  );
  const [isLoading, setIsLoading] = React.useState(!initialExpenses);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [successBanner, setSuccessBanner] = React.useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // State Filter Draft (input sebelum diterapkan)
  const [draftStartDate, setDraftStartDate] = React.useState("");
  const [draftEndDate, setDraftEndDate] = React.useState("");
  const [draftCategory, setDraftCategory] = React.useState<ExpenseCategory | "ALL">("ALL");

  // State Filter Applied (parameter aktual yang dikirim ke server)
  const [appliedFilter, setAppliedFilter] = React.useState<{
    startDate: string;
    endDate: string;
    category: ExpenseCategory | "ALL";
  }>({
    startDate: "",
    endDate: "",
    category: "ALL",
  });

  // Validasi rentang tanggal draft
  const isDateRangeInvalid = Boolean(
    draftStartDate && draftEndDate && draftStartDate > draftEndDate
  );

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
  // Fetch Expenses Data
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    if (initialExpenses && refreshTrigger === 0) return;

    let isMounted = true;

    getExpensesAction({
      startDate: appliedFilter.startDate.trim() ? appliedFilter.startDate.trim() : undefined,
      endDate: appliedFilter.endDate.trim() ? appliedFilter.endDate.trim() : undefined,
      category: appliedFilter.category !== "ALL" ? appliedFilter.category : undefined,
    })
      .then((res) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (!res.success) {
          setErrorMessage(
            res.error?.message || "Gagal memuat catatan pengeluaran operasional."
          );
          setExpenses([]);
          return;
        }
        setErrorMessage(null);
        setExpenses(res.data || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
        setErrorMessage("Terjadi kegagalan jaringan saat memuat catatan pengeluaran.");
        setExpenses([]);
      });

    return () => {
      isMounted = false;
    };
  }, [appliedFilter, refreshTrigger, initialExpenses]);

  // ---------------------------------------------------------------------------
  // Handlers Filter
  // ---------------------------------------------------------------------------
  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDateRangeInvalid) return;

    setIsLoading(true);
    setErrorMessage(null);
    setAppliedFilter({
      startDate: draftStartDate,
      endDate: draftEndDate,
      category: draftCategory,
    });
  };

  const handleResetFilter = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftCategory("ALL");
    setIsLoading(true);
    setErrorMessage(null);
    setAppliedFilter({
      startDate: "",
      endDate: "",
      category: "ALL",
    });
  };

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleCreateSuccess = () => {
    setSuccessBanner("Pengeluaran baru berhasil dicatat.");
    setIsLoading(true);
    setErrorMessage(null);
    setRefreshTrigger((prev) => prev + 1);
    setTimeout(() => {
      setSuccessBanner(null);
    }, 4000);
  };

  // ---------------------------------------------------------------------------
  // Kalkulasi 3 Kartu Ringkasan (Berdasarkan Dataset Terfilter Saat Ini)
  // ---------------------------------------------------------------------------
  const totalExpenseAmount = React.useMemo(() => {
    return expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [expenses]);

  const totalExpenseCount = expenses.length;

  const topCategoryInfo = React.useMemo(() => {
    if (expenses.length === 0) return null;
    const catSums: Record<string, number> = {};
    for (const item of expenses) {
      catSums[item.category] = (catSums[item.category] || 0) + Number(item.amount || 0);
    }
    let maxCat = "";
    let maxVal = 0;
    for (const [cat, val] of Object.entries(catSums)) {
      if (val > maxVal) {
        maxVal = val;
        maxCat = cat;
      }
    }
    if (!maxCat || maxVal === 0) return null;
    const pct = totalExpenseAmount > 0 ? Math.round((maxVal / totalExpenseAmount) * 100) : 0;
    return {
      category: maxCat as ExpenseCategory,
      label: EXPENSE_CATEGORY_MAP[maxCat as ExpenseCategory] || maxCat,
      amount: maxVal,
      percentage: pct,
    };
  }, [expenses, totalExpenseAmount]);

  return (
    <AppLayout currentPath="/expenses">
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner Sukses Notifikasi */}
        {successBanner && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded"
              aria-label="Tutup notifikasi"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Header Modul & Konteks Tenant */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E3EC] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                {activeBusiness ? activeBusiness.name : "VeyraOS Business"}
              </span>
              <span className="text-xs text-[#716D7A]">• Buku Kas Toko</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B] flex items-center gap-2">
              <ArrowDownCircle className="h-6 w-6 text-[#5B3CC4] shrink-0" />
              Buku Pengeluaran Operasional
            </h1>
            <p className="text-xs sm:text-sm text-[#716D7A] mt-1 max-w-2xl">
              Catat dan pantau seluruh beban kas non-persediaan usaha Anda untuk
              perhitungan laba operasional dan arus kas yang akurat.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              id="open-create-expense-btn"
              onClick={() => setIsModalOpen(true)}
              className="h-10 px-4 text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Catat Pengeluaran
            </Button>
          </div>
        </div>

        {/* Penanganan State Error Awal */}
        {errorMessage && !isLoading && (
          <Alert variant="danger" className="p-4" data-testid="expenses-error-alert">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{errorMessage}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="h-8 text-xs font-semibold shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Coba Lagi
              </Button>
            </div>
          </Alert>
        )}

        {/* Kondisi Loading Shimmer */}
        {isLoading && <ExpensesSkeleton />}

        {/* Konten Utama Saat Selesai Memuat */}
        {!isLoading && (
          <>
            {/* 3 Kartu Ringkasan KPI Beban Operasional */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Kartu 1: Total Pengeluaran */}
              <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#716D7A]">
                    Total Pengeluaran
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span
                    className="text-2xl font-bold text-[#25232B] tracking-tight block"
                    data-testid="summary-total-amount"
                  >
                    {formatRupiah(totalExpenseAmount)}
                  </span>
                  <span className="text-[11px] text-[#716D7A] mt-1 block">
                    Beban kas pada filter aktif
                  </span>
                </div>
              </Card>

              {/* Kartu 2: Jumlah Transaksi */}
              <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#716D7A]">
                    Jumlah Catatan
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span
                    className="text-2xl font-bold text-[#25232B] tracking-tight block"
                    data-testid="summary-total-count"
                  >
                    {totalExpenseCount} Catatan
                  </span>
                  <span className="text-[11px] text-[#716D7A] mt-1 block">
                    Frekuensi transaksi beban tercatat
                  </span>
                </div>
              </Card>

              {/* Kartu 3: Kategori Beban Terbesar */}
              <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#716D7A]">
                    Beban Terbesar
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Tag className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  {topCategoryInfo ? (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-base font-bold text-[#25232B] truncate max-w-[180px]"
                          data-testid="summary-top-category-name"
                        >
                          {topCategoryInfo.label}
                        </span>
                        <span className="text-xs font-bold text-[#5B3CC4]">
                          ({topCategoryInfo.percentage}%)
                        </span>
                      </div>
                      <span className="text-[11px] text-[#716D7A] mt-1 block">
                        {formatRupiah(topCategoryInfo.amount)} dari total beban
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xl font-bold text-[#A09AA8] block">
                        -
                      </span>
                      <span className="text-[11px] text-[#716D7A] mt-1 block">
                        Belum ada data pengeluaran
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Filter Bar Card (Draft vs Applied) */}
            <Card className="p-4 sm:p-5 bg-white border-[#E7E3EC] shadow-xs">
              <form
                onSubmit={handleApplyFilter}
                className="flex flex-col md:flex-row md:items-end gap-3.5"
              >
                <div className="w-full md:w-44">
                  <label
                    htmlFor="expense-filter-start-date"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    id="expense-filter-start-date"
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="w-full md:w-44">
                  <label
                    htmlFor="expense-filter-end-date"
                    className="block text-xs font-semibold text-[#25232B] mb-1.5"
                  >
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    id="expense-filter-end-date"
                    value={draftEndDate}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-1.5 text-xs text-[#25232B] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-9"
                  />
                </div>

                <div className="w-full md:w-56">
                  <Select
                    id="expense-filter-category-select"
                    label="Kategori Pengeluaran"
                    value={draftCategory}
                    onChange={(e) =>
                      setDraftCategory(e.target.value as ExpenseCategory | "ALL")
                    }
                    options={[
                      { value: "ALL", label: "Semua Kategori" },
                      ...EXPENSE_CATEGORIES.map((cat) => ({
                        value: cat.key,
                        label: cat.label,
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
                    disabled={isDateRangeInvalid}
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
                    onClick={handleResetFilter}
                    className="h-9 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </form>

              {isDateRangeInvalid && (
                <p className="mt-2 text-xs text-[#C0392B] font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Tanggal mulai tidak boleh lebih besar dari tanggal akhir.
                </p>
              )}
            </Card>

            {/* Tabel Riwayat Pengeluaran */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#E7E3EC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#25232B]">
                    Riwayat Pengeluaran Kas
                  </h3>
                  <p className="text-xs text-[#716D7A] mt-0.5">
                    Menampilkan {expenses.length} transaksi beban operasional tercatat
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#716D7A] bg-[#FAF9F6] px-2.5 py-1 rounded-md border border-[#E7E3EC]">
                  <Lock className="w-3.5 h-3.5 text-[#5B3CC4]" />
                  <span>Jejak Audit Buku Kas Terproteksi</span>
                </div>
              </div>

              {expenses.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#FAF9F6]">
                      <TableRow className="border-[#E7E3EC]">
                        <TableHead className="text-xs font-bold text-[#25232B] w-36">
                          Tanggal (WIB)
                        </TableHead>
                        <TableHead className="text-xs font-bold text-[#25232B] w-48">
                          Kategori
                        </TableHead>
                        <TableHead className="text-xs font-bold text-[#25232B]">
                          Keterangan / Keperluan
                        </TableHead>
                        <TableHead className="text-xs font-bold text-[#25232B] text-right w-40">
                          Nominal
                        </TableHead>
                        <TableHead className="text-xs font-bold text-[#25232B] text-center w-32">
                          Status Audit
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((item) => {
                        const catMeta = EXPENSE_CATEGORIES.find(
                          (c) => c.key === item.category
                        );
                        return (
                          <TableRow
                            key={item.id}
                            className="border-[#E7E3EC] hover:bg-[#FAF9F6] transition-colors"
                            data-testid={`expense-row-${item.id}`}
                          >
                            <TableCell className="text-xs text-[#25232B] font-medium whitespace-nowrap">
                              {formatDateTime(item.expenseDate)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                                  catMeta?.colorClass || "bg-gray-100 text-gray-800 border-gray-300"
                                )}
                              >
                                {catMeta?.label || item.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-[#25232B] max-w-md">
                              <span className="line-clamp-2">{item.description}</span>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-rose-700 text-right whitespace-nowrap">
                              {formatRupiah(item.amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20"
                                title="Catatan permanen untuk jejak audit pembukuan kas (non-destruktif)"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                Permanen
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                /* Empty state */
                <div
                  className="p-12 text-center"
                  data-testid="expenses-empty-state"
                >
                  <div className="w-12 h-12 rounded-full bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center mx-auto mb-3">
                    <ArrowDownCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#25232B]">
                    Belum Ada Catatan Pengeluaran
                  </h3>
                  <p className="text-xs text-[#716D7A] mt-1 max-w-sm mx-auto">
                    Tidak ditemukan catatan pengeluaran kas pada kriteria filter yang
                    dipilih. Mulai catat biaya operasional pertama Anda.
                  </p>
                  <div className="mt-4">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsModalOpen(true)}
                      className="text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Catat Pengeluaran Sekarang
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Modal Catat Pengeluaran (Hanya render saat aktif agar state selalu bersih) */}
        {isModalOpen && (
          <CreateExpenseModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </div>
    </AppLayout>
  );
}
