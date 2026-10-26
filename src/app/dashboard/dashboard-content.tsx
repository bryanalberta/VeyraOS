"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Boxes,
  Coins,
  Receipt,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Info,
  Clock,
  ArrowUpRight,
  Store,
  ShoppingCart,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Banknote,
  Building2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getDashboardSummaryAction } from "@/app/actions/reports";
import { getActiveTenantContextAction } from "@/app/actions/business";
import type {
  DashboardSummaryResponseData,
  DailySalesTrendItem,
  BusinessResponseData,
} from "@/types/api";
import type { PaymentMethod, SaleStatus } from "@/types/database";
import { formatRupiah, cn } from "@/lib/utils";

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

function formatShortDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Jakarta",
    }).format(date);
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Helper: Default 30 hari terakhir (Asia/Jakarta)
// ---------------------------------------------------------------------------
function getDefaultDateRange(days = 30) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Helper: Badge dan label metode pembayaran
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
// Komponen: Native SVG Bar Chart Tren Penjualan Harian
// ---------------------------------------------------------------------------
interface SalesTrendChartProps {
  data: DailySalesTrendItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

function SalesTrendChart({ data, selectedDate, onSelectDate }: SalesTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-center text-sm text-[#716D7A] bg-[#FAF9F6] rounded-xl border border-dashed border-[#E7E3EC] p-6">
        <Clock className="w-8 h-8 text-[#A09AA8] mb-2" />
        <p className="font-medium text-[#25232B]">Belum ada data penjualan harian</p>
        <p className="text-xs text-[#716D7A] mt-1">
          Grafik akan muncul otomatis setelah transaksi kasir tercatat.
        </p>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount), 0);
  const chartHeight = 160;
  const paddingX = 16;
  const paddingBottom = 28;
  const paddingTop = 20;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const totalBars = data.length;
  const slotWidth = totalBars > 0 ? (700 - paddingX * 2) / totalBars : 20;
  const barWidth = Math.max(4, Math.min(slotWidth * 0.65, 24));

  // Item yang sedang aktif (hover atau keyboard focus)
  const activeItem =
    hoveredIndex !== null
      ? data[hoveredIndex]
      : selectedDate
      ? data.find((d) => d.date === selectedDate) ?? null
      : null;

  return (
    <div className="space-y-3" role="region" aria-label="Grafik Tren Penjualan Harian">
      {/* Detail info badge di atas grafik (Keyboard & Touch Accessible) */}
      <div className="flex items-center justify-between min-h-[28px] px-1">
        {activeItem ? (
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#25232B] bg-[#F6F3FF] border border-[#EAE4FF] px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
            <span className="font-semibold text-[#5B3CC4]">
              {formatDate(activeItem.date)}:
            </span>
            <span>{formatRupiah(activeItem.amount)}</span>
            <span className="text-[#716D7A]">
              ({activeItem.transactionsCount} transaksi)
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#716D7A]">
            Arahkan kursor atau gunakan tombol Tab pada batang grafik untuk melihat rincian.
          </span>
        )}

        <div className="text-xs text-[#716D7A] hidden sm:block">
          Puncak Omzet:{" "}
          <span className="font-semibold text-[#25232B]">
            {formatRupiah(maxAmount)}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 700 160"
          className="w-full min-w-[500px] h-48 select-none"
          aria-hidden="true"
        >
          {/* Garis Horizontal Pedoman (3 Tingkat) */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + usableHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={700 - paddingX}
                  y2={y}
                  stroke="#F0EDF5"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Batang Penjualan */}
          {data.map((item, idx) => {
            const x = paddingX + idx * slotWidth + (slotWidth - barWidth) / 2;
            const barH =
              maxAmount > 0 ? (item.amount / maxAmount) * usableHeight : 0;
            const y = paddingTop + usableHeight - barH;
            const isHovered = hoveredIndex === idx;
            const isSelected = selectedDate === item.date;
            const isActive = isHovered || isSelected;

            return (
              <g key={item.date}>
                {/* Area klik/hover lebar tak terlihat untuk kemudahan sentuh */}
                <rect
                  x={paddingX + idx * slotWidth}
                  y={paddingTop}
                  width={slotWidth}
                  height={usableHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatDate(item.date)}: ${formatRupiah(item.amount)}, ${item.transactionsCount} transaksi`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => {
                    setHoveredIndex(idx);
                    onSelectDate(item.date);
                  }}
                  onBlur={() => setHoveredIndex(null)}
                  onClick={() =>
                    onSelectDate(selectedDate === item.date ? null : item.date)
                  }
                />

                {/* Batang utama */}
                <rect
                  x={x}
                  y={item.amount > 0 ? y : paddingTop + usableHeight - 2}
                  width={barWidth}
                  height={item.amount > 0 ? Math.max(barH, 3) : 2}
                  rx={3}
                  className={cn(
                    "transition-all duration-150 pointer-events-none",
                    item.amount === 0
                      ? "fill-[#E7E3EC]"
                      : isActive
                      ? "fill-[#392477]"
                      : "fill-[#5B3CC4]"
                  )}
                />

                {/* Label Tanggal Sumbu X (Ditampilkan berkala untuk keterbacaan) */}
                {(totalBars <= 10 ||
                  idx === 0 ||
                  idx === totalBars - 1 ||
                  idx % Math.ceil(totalBars / 7) === 0) && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-[#716D7A] font-medium pointer-events-none"
                  >
                    {formatShortDate(item.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Ringkasan Tabel Alternatif untuk Screen Reader (A11y) */}
      <div className="sr-only">
        <table>
          <caption>Tabel Data Tren Penjualan Harian</caption>
          <thead>
            <tr>
              <th scope="col">Tanggal</th>
              <th scope="col">Penjualan Bersih</th>
              <th scope="col">Jumlah Transaksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date}>
                <td>{item.date}</td>
                <td>{formatRupiah(item.amount)}</td>
                <td>{item.transactionsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loading Komprehensif
// ---------------------------------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="dashboard-loading-skeleton">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* 6 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-5 space-y-3 border-[#E7E3EC]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-3 w-48" />
          </Card>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Card className="p-5 space-y-4 border-[#E7E3EC]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </Card>

      {/* Split Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4 border-[#E7E3EC]">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        </Card>
        <Card className="p-5 space-y-4 border-[#E7E3EC]">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponen Utama: DashboardContent
// ---------------------------------------------------------------------------
export function DashboardContent({
  initialData,
  initialBusiness,
}: {
  initialData?: DashboardSummaryResponseData;
  initialBusiness?: BusinessResponseData;
}) {
  const defaultDates = React.useMemo(() => getDefaultDateRange(30), []);

  // Filter state
  const [startDate, setStartDate] = React.useState<string>(defaultDates.start);
  const [endDate, setEndDate] = React.useState<string>(defaultDates.end);
  const [activePeriodLabel, setActivePeriodLabel] = React.useState<string>("30 Hari Terakhir");

  // Data state
  const [summaryData, setSummaryData] = React.useState<DashboardSummaryResponseData | null>(
    initialData ?? null
  );
  const [activeBusiness, setActiveBusiness] = React.useState<BusinessResponseData | null>(
    initialBusiness ?? null
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialData);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  // Interaktivitas grafik
  const [selectedTrendDate, setSelectedTrendDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialData) return;
    let isMounted = true;
    const queryParams = {
      startDate: startDate.trim() ? startDate.trim() : undefined,
      endDate: endDate.trim() ? endDate.trim() : undefined,
    };

    Promise.all([
      getDashboardSummaryAction(queryParams),
      getActiveTenantContextAction(),
    ])
      .then(([reportRes, tenantRes]) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (tenantRes.success && tenantRes.data?.activeBusiness) {
          setActiveBusiness(tenantRes.data.activeBusiness);
        }

        if (!reportRes.success) {
          setLoadError(
            reportRes.error?.message || "Gagal memuat ringkasan performa bisnis dari server."
          );
          setSummaryData(null);
          return;
        }

        setLoadError(null);
        setSummaryData(reportRes.data);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
        setLoadError("Terjadi kegagalan koneksi ke server. Silakan coba lagi.");
        setSummaryData(null);
      });

    return () => {
      isMounted = false;
    };
  }, [initialData, startDate, endDate, refreshIndex]);

  const handleApplyFilter = (days: number, label: string) => {
    const range = getDefaultDateRange(days);
    setIsLoading(true);
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePeriodLabel(label);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  const isBusinessEmpty =
    summaryData &&
    summaryData.netSales === 0 &&
    summaryData.cogs === 0 &&
    summaryData.operatingExpenses === 0 &&
    summaryData.recentTransactions.length === 0 &&
    summaryData.lowStockAlerts.length === 0;

  return (
    <AppLayout
      title="Dashboard"
      currentPath="/dashboard"
      activeBusinessName={activeBusiness?.name || "Bisnis Saya"}
      businessCategory={activeBusiness?.category || undefined}
    >
      <div className="space-y-6 pb-12">
        {/* ------------------------------------------------------------------ */}
        {/* Header Dashboard */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Dashboard Bisnis
              </h1>
              {activeBusiness && (
                <Badge variant="outline" className="text-xs font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]">
                  {activeBusiness.name}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#716D7A]">
              Kondisi performa keuangan dan operasional untuk periode:{" "}
              <strong className="text-[#25232B] font-semibold">{activePeriodLabel}</strong>{" "}
              ({formatDate(startDate)} – {formatDate(endDate)})
            </p>
          </div>

          {/* Tombol Pemilihan Periode Singkat */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              variant={activePeriodLabel === "7 Hari Terakhir" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleApplyFilter(7, "7 Hari Terakhir")}
              disabled={isLoading}
              className="text-xs h-8"
              id="period-7d-btn"
            >
              7 Hari
            </Button>
            <Button
              type="button"
              variant={activePeriodLabel === "30 Hari Terakhir" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleApplyFilter(30, "30 Hari Terakhir")}
              disabled={isLoading}
              className="text-xs h-8"
              id="period-30d-btn"
            >
              30 Hari
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-xs h-8 px-2.5"
              id="refresh-dashboard-btn"
              title="Perbarui data terkini"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </Button>
          </div>
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
              onClick={handleRefresh}
              id="retry-dashboard-btn"
              className="shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Coba Lagi
            </Button>
          </Alert>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Loading Skeleton State */}
        {/* ------------------------------------------------------------------ */}
        {isLoading && <DashboardSkeleton />}

        {/* ------------------------------------------------------------------ */}
        {/* Empty State: Bisnis Baru / Belum Ada Transaksi Sama Sekali */}
        {/* ------------------------------------------------------------------ */}
        {!isLoading && !loadError && isBusinessEmpty && (
          <Card className="border border-[#E7E3EC] bg-white p-8 sm:p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#F6F3FF] border border-[#EAE4FF] flex items-center justify-center mx-auto text-[#5B3CC4]">
              <Store className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-lg font-bold text-[#25232B]">
                Selamat Datang di VeyraOS!
              </h2>
              <p className="text-sm text-[#716D7A] leading-relaxed">
                Belum ada transaksi maupun pencatatan biaya pada periode ini.
                Mulai catat transaksi pertama melalui kasir kilat atau tambahkan produk ke katalog Anda.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/sales/new">
                <Button variant="primary" size="sm" id="empty-go-pos-btn">
                  Buka Kasir POS
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <Link href="/products/new">
                <Button variant="outline" size="sm" id="empty-go-products-btn">
                  Tambah Produk
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Normal Content State */}
        {/* ------------------------------------------------------------------ */}
        {!isLoading && !loadError && summaryData && !isBusinessEmpty && (
          <>
            {/* -------------------------------------------------------------- */}
            {/* Quick Actions Bar (Aksi Cepat Kasir & Operasional Toko) */}
            {/* -------------------------------------------------------------- */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 select-none">
              <Link href="/sales/new">
                <Button
                  variant="primary"
                  size="sm"
                  className="h-9 px-3.5 text-xs font-semibold gap-1.5 shadow-xs"
                  id="dash-quick-pos-btn"
                >
                  <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Buka Kasir POS</span>
                </Button>
              </Link>
              <Link href="/purchases/new">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-white border-[#E5E1EC] hover:bg-[#F8F7FA] text-[#1A1820] shadow-xs"
                  id="dash-quick-purchase-btn"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 text-[#5B3CC4]" aria-hidden="true" />
                  <span>+ Beli Stok Baru</span>
                </Button>
              </Link>
              <Link href="/expenses">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-white border-[#E5E1EC] hover:bg-[#F8F7FA] text-[#1A1820] shadow-xs"
                  id="dash-quick-expense-btn"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5 text-[#B25E09]" aria-hidden="true" />
                  <span>Catat Beban Kas</span>
                </Button>
              </Link>
              <Link href="/reports">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-white border-[#E5E1EC] hover:bg-[#F8F7FA] text-[#767182] shadow-xs"
                  id="dash-quick-report-btn"
                >
                  <FileText className="w-3.5 h-3.5 text-[#767182]" aria-hidden="true" />
                  <span>Laporan Finansial</span>
                </Button>
              </Link>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* 6 Kartu KPI Finansial Utama dengan Hirarki Asimetris */}
            {/* -------------------------------------------------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Penjualan Bersih (Hero Metric Card) */}
              <div className="sm:col-span-2 lg:col-span-1 rounded-2xl border border-[#DDD5F5] bg-gradient-to-br from-white via-white to-[#F9F7FE] p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B3CC4] bg-[#F4F0FD] px-2 py-0.5 rounded-md border border-[#E7E0FA]">
                      Performa Utama
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[#767182] tracking-normal">
                      Penjualan Bersih (Net Sales)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F4F0FD] text-[#5B3CC4] border border-[#E7E0FA] shrink-0 flex items-center justify-center shadow-2xs">
                    <TrendingUp className="w-4.5 h-4.5 stroke-[1.75]" />
                  </div>
                </div>

                <div className="my-2">
                  <div className="text-2xl sm:text-3xl font-bold text-[#1A1820] font-mono tabular-nums tracking-tight">
                    <span data-testid="kpi-net-sales">
                      {formatRupiah(summaryData.netSales)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-[#767182] border-t border-[#F0ECF8] pt-2.5 leading-relaxed">
                  Omzet kotor {formatRupiah(summaryData.grossSales)} (diskon {formatRupiah(summaryData.totalDiscounts)})
                </div>
              </div>

              {/* 2. Harga Pokok Penjualan (HPP / COGS) */}
              <StatCard
                title="Harga Pokok Penjualan (HPP)"
                value={
                  <span data-testid="kpi-cogs">
                    {formatRupiah(summaryData.cogs)}
                  </span>
                }
                isFinancial
                icon={<Boxes className="w-4 h-4 text-[#1A1820]" />}
                subtitle="Modal historis dari seluruh produk yang terjual"
              />

              {/* 3. Laba Kotor & Margin */}
              <StatCard
                title="Laba Kotor (Gross Profit)"
                value={
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#0D894F]" data-testid="kpi-gross-profit">
                      {formatRupiah(summaryData.grossProfit)}
                    </span>
                    <Badge variant={summaryData.grossProfit >= 0 ? "success" : "danger"} className="text-[10px] tabular-nums">
                      {summaryData.grossProfitMargin}% margin
                    </Badge>
                  </div>
                }
                isFinancial
                icon={<Coins className="w-4 h-4 text-[#0D894F]" />}
                subtitle="Penjualan bersih dikurangi total HPP"
              />

              {/* 4. Beban Operasional */}
              <StatCard
                title="Beban Operasional"
                value={
                  <span className="text-[#B25E09]" data-testid="kpi-operating-expenses">
                    {formatRupiah(summaryData.operatingExpenses)}
                  </span>
                }
                isFinancial
                icon={<Receipt className="w-4 h-4 text-[#B25E09]" />}
                subtitle="Biaya sewa, utilitas listrik/air, gaji, & operasional"
              />

              {/* 5. Laba Operasional Sederhana */}
              <StatCard
                title="Laba Operasional Sederhana"
                value={
                  <span
                    className={summaryData.operatingProfit >= 0 ? "text-[#5B3CC4]" : "text-[#C0392B]"}
                    data-testid="kpi-operating-profit"
                  >
                    {formatRupiah(summaryData.operatingProfit)}
                  </span>
                }
                isFinancial
                icon={<CheckCircle2 className="w-4 h-4 text-[#5B3CC4]" />}
                subtitle="Laba kotor dikurangi seluruh beban operasional"
              />

              {/* 6. Arus Kas Bersih (Cash Flow) */}
              <StatCard
                title="Arus Kas Bersih (Cash Flow)"
                value={
                  <span
                    className={summaryData.recordedCashFlow.netCashFlow >= 0 ? "text-[#0D894F]" : "text-[#C0392B]"}
                    data-testid="kpi-net-cash-flow"
                  >
                    {summaryData.recordedCashFlow.netCashFlow >= 0 ? "+" : ""}
                    {formatRupiah(summaryData.recordedCashFlow.netCashFlow)}
                  </span>
                }
                isFinancial
                icon={<Wallet className="w-4 h-4 text-[#1A1820]" />}
                subtitle={`Masuk: ${formatRupiah(summaryData.recordedCashFlow.cashInflows)} · Keluar: ${formatRupiah(summaryData.recordedCashFlow.cashOutflows)}`}
              />
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Visualisasi Tren Penjualan Harian */}
            {/* -------------------------------------------------------------- */}
            <Card className="border border-[#E7E3EC] bg-white shadow-xs">
              <CardHeader className="p-5 pb-2 border-b border-[#F0EDF5] flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold text-[#25232B]">
                    Tren Penjualan Harian
                  </CardTitle>
                  <p className="text-xs text-[#716D7A] mt-0.5">
                    Grafik omzet bersih harian sesuai zona waktu Jakarta (WIB)
                  </p>
                </div>
                <Link href="/sales">
                  <Button variant="ghost" size="sm" className="text-xs text-[#5B3CC4] hover:bg-[#F6F3FF] h-8">
                    Lihat Riwayat
                    <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-5 pt-3">
                <SalesTrendChart
                  data={summaryData.dailySalesTrend}
                  selectedDate={selectedTrendDate}
                  onSelectDate={setSelectedTrendDate}
                />
              </CardContent>
            </Card>

            {/* -------------------------------------------------------------- */}
            {/* Baris Bawah: Transaksi Terbaru & Peringatan Stok */}
            {/* -------------------------------------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 5 Transaksi Penjualan Terbaru */}
              <Card className="border border-[#E7E3EC] bg-white shadow-xs flex flex-col justify-between">
                <div>
                  <CardHeader className="p-5 pb-3 border-b border-[#F0EDF5] flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base font-semibold text-[#25232B]">
                      Transaksi Terbaru
                    </CardTitle>
                    <Link href="/sales" className="text-xs font-semibold text-[#5B3CC4] hover:underline flex items-center gap-1">
                      Semua Transaksi
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0">
                    {summaryData.recentTransactions.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#716D7A]">
                        Belum ada transaksi pada periode ini.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#FAF9F6] text-[11px] text-[#716D7A]">
                            <TableHead className="py-2.5">No. Invoice</TableHead>
                            <TableHead className="py-2.5">Waktu</TableHead>
                            <TableHead className="py-2.5">Metode</TableHead>
                            <TableHead className="text-right py-2.5">Total</TableHead>
                            <TableHead className="text-center py-2.5">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaryData.recentTransactions.map((tx) => {
                            const badge = getStatusBadge(tx.status);
                            return (
                              <TableRow key={tx.id} className="text-xs hover:bg-[#FAF9F6] transition-colors" data-testid={`recent-tx-${tx.id}`}>
                                <TableCell className="font-mono font-medium text-[#5B3CC4]">
                                  {tx.invoiceNumber}
                                </TableCell>
                                <TableCell className="text-[#716D7A] whitespace-nowrap">
                                  {formatDate(tx.transactionDate)}
                                </TableCell>
                                <TableCell className="text-[#25232B]">
                                  {getPaymentMethodLabel(tx.paymentMethod)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold tabular-nums text-[#25232B]">
                                  {formatRupiah(tx.totalAmount)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={badge.variant} className="text-[10px]">
                                    {badge.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </div>

                <div className="p-4 border-t border-[#F0EDF5] bg-[#FAF9F6] rounded-b-xl flex items-center justify-between text-xs text-[#716D7A]">
                  <span>Maksimal 5 transaksi penjualan terkini</span>
                  <Link href="/sales/new">
                    <Button variant="outline" size="sm" className="h-7 text-xs" id="quick-new-sale-btn">
                      + Penjualan Baru
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* Peringatan Stok Menipis */}
              <Card className="border border-[#E7E3EC] bg-white shadow-xs flex flex-col justify-between">
                <div>
                  <CardHeader className="p-5 pb-3 border-b border-[#F0EDF5] flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold text-[#25232B]">
                        Peringatan Stok Rendah
                      </CardTitle>
                      {summaryData.lowStockAlerts.length > 0 && (
                        <Badge variant="warning" className="text-[10px] tabular-nums font-bold">
                          {summaryData.lowStockAlerts.length} produk
                        </Badge>
                      )}
                    </div>
                    <Link href="/products" className="text-xs font-semibold text-[#5B3CC4] hover:underline flex items-center gap-1">
                      Katalog Produk
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {summaryData.lowStockAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-[#E8F8F0] text-[#0E6251] flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-[#25232B]">Semua Stok Produk Aman</p>
                        <p className="text-xs text-[#716D7A] max-w-xs">
                          Tidak ada produk aktif yang berada di bawah batas minimum stok saat ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                        {summaryData.lowStockAlerts.map((item) => {
                          const isOutOfStock = item.stockQuantity <= 0;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-[#E7E3EC] bg-white hover:border-[#5B3CC4]/30 transition-colors"
                              data-testid={`low-stock-${item.id}`}
                            >
                              <div className="min-w-0 pr-3">
                                <p className="text-sm font-semibold text-[#25232B] truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-[#716D7A] font-mono mt-0.5">
                                  {item.sku ? `SKU: ${item.sku}` : item.category || "Tanpa Kategori"}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <Badge variant={isOutOfStock ? "danger" : "warning"} className="text-xs">
                                  {isOutOfStock ? "Habis (0)" : `Sisa ${item.stockQuantity}`}
                                </Badge>
                                <p className="text-[10px] text-[#716D7A] mt-0.5">
                                  Min: {item.minStockAlert} unit
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-4 border-t border-[#F0EDF5] bg-[#FAF9F6] rounded-b-xl flex items-center justify-between text-xs text-[#716D7A]">
                  <span>Peringatan stok berdasarkan batas minimum</span>
                  <Link href="/purchases/new">
                    <Button variant="outline" size="sm" className="h-7 text-xs" id="quick-restock-btn">
                      + Beli Stok Baru
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Wrapper View
// ---------------------------------------------------------------------------
export function DashboardView() {
  return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </React.Suspense>
  );
}

export default DashboardContent;
