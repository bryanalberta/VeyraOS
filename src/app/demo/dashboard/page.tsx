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
  Clock,
  ArrowRight,
  Info,
  RefreshCw,
  Store,
  MapPin,
  Phone,
  Sparkles,
  ShoppingCart,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Banknote,
  Building2,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type {
  DemoDashboardSummary,
  DailySalesTrendItem,
  DemoPaymentMethod,
  DemoSaleStatus,
} from "@/services/demo/demo-types";
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

function getPaymentMethodLabel(method: DemoPaymentMethod): string {
  switch (method) {
    case "CASH":
      return "Tunai";
    case "BANK_TRANSFER":
      return "Transfer Bank";
    default:
      return method;
  }
}

function getStatusBadge(status: DemoSaleStatus) {
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
// Komponen: Native SVG Bar Chart Tren Penjualan Harian Simulasi
// ---------------------------------------------------------------------------
interface DemoSalesTrendChartProps {
  data: DailySalesTrendItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

function DemoSalesTrendChart({
  data,
  selectedDate,
  onSelectDate,
}: DemoSalesTrendChartProps) {
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

  const activeItem =
    hoveredIndex !== null
      ? data[hoveredIndex]
      : selectedDate
      ? data.find((d) => d.date === selectedDate) ?? null
      : null;

  return (
    <div className="space-y-3" role="region" aria-label="Grafik Tren Penjualan Harian Mode Demo">
      {/* Tooltip Info Bar */}
      <div className="flex items-center justify-between min-h-[28px] px-1">
        {activeItem ? (
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#25232B] bg-[#F6F3FF] border border-[#EAE4FF] px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
            <span className="font-semibold text-[#5B3CC4]">
              {formatDate(activeItem.date)}:
            </span>
            <span className="font-mono font-bold">{formatRupiah(activeItem.amount)}</span>
            <span className="text-[#716D7A]">
              ({activeItem.transactionsCount} transaksi)
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#716D7A]">
            Arahkan kursor atau gunakan tombol Tab pada batang grafik untuk melihat rincian omzet.
          </span>
        )}

        <div className="text-xs text-[#716D7A] hidden sm:block">
          Puncak Omzet Harian:{" "}
          <span className="font-semibold text-[#25232B] font-mono">
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
          {/* Garis Horizontal Pedoman */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + usableHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={700 - paddingX}
                y2={y}
                stroke="#F0EDF5"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
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

      {/* Screen Reader Table Fallback */}
      <div className="sr-only">
        <table>
          <caption>Tabel Data Tren Penjualan Harian Mode Demo</caption>
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
// Halaman Utama: DemoDashboardPage
// ---------------------------------------------------------------------------
export default function DemoDashboardPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const [activeFilter, setActiveFilter] = React.useState<"ALL" | "7D" | "30D">("ALL");
  const [selectedTrendDate, setSelectedTrendDate] = React.useState<string | null>(null);
  const [, setRefreshTick] = React.useState(0);
  const handleRefresh = () => setRefreshTick((t) => t + 1);

  const business = storeState.business;

  // Hitung metrik dashboard secara deterministik berdasarkan filter aktif
  const summaryData = React.useMemo<DemoDashboardSummary>(() => {
    let start: string | undefined;
    let end: string | undefined;

    if (activeFilter === "7D" || activeFilter === "30D") {
      const days = activeFilter === "7D" ? 7 : 30;
      const now = new Date("2026-10-15T23:59:59+07:00");
      end = now.toISOString().slice(0, 10);
      const startDateObj = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
      start = startDateObj.toISOString().slice(0, 10);
    }

    // Akses storeState.lastResetAt untuk memastikan reaktivitas eksplisit terhadap mutasi store
    void storeState.lastResetAt;

    return demoStoreService.getDashboardSummary(start, end);
  }, [storeState, activeFilter]);

  const handleFilterChange = (filter: "ALL" | "7D" | "30D") => {
    setActiveFilter(filter);
  };

  return (
    <DemoLayout
      title="Dashboard Simulasi"
      currentPath="/demo/dashboard"
    >
      <div className="space-y-6 pb-12">
        {/* ------------------------------------------------------------------ */}
        {/* Profil Usaha Simulasi & Header Dashboard */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Dashboard Performa Toko
              </h1>
              <Badge
                variant="demo"
                className="text-xs font-bold text-[#25232B] bg-[#FFD54F] border-[#FBC02D]"
              >
                MODE DEMO
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-[#716D7A] flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-[#25232B]" suppressHydrationWarning>
                <Store className="w-3.5 h-3.5 text-[#5B3CC4]" />
                {business.name}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#A09AA8]" />
                {business.address}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#A09AA8]" />
                {business.phone}
              </span>
            </div>
          </div>

          {/* Filter Periode & Refresh */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              variant={activeFilter === "7D" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleFilterChange("7D")}
              className="text-xs h-8"
              id="filter-7d-btn"
            >
              7 Hari
            </Button>
            <Button
              type="button"
              variant={activeFilter === "30D" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleFilterChange("30D")}
              className="text-xs h-8"
              id="filter-30d-btn"
            >
              30 Hari
            </Button>
            <Button
              type="button"
              variant={activeFilter === "ALL" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleFilterChange("ALL")}
              className="text-xs h-8"
              id="filter-all-btn"
            >
              Semua Data
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="text-xs h-8 px-2.5"
              id="refresh-demo-dashboard-btn"
              title="Segarkan data simulasi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Quick Actions Bar (Aksi Cepat Operasional Simulasi) */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 select-none">
          <Link href="/demo/sales/new">
            <Button
              variant="primary"
              size="sm"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 shadow-xs"
              id="demo-quick-pos-btn"
            >
              <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Buka Kasir POS</span>
            </Button>
          </Link>
          <Link href="/demo/purchases">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-white border-[#E5E1EC] hover:bg-[#F8F7FA] text-[#1A1820] shadow-xs"
              id="demo-quick-purchase-btn"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 text-[#5B3CC4]" aria-hidden="true" />
              <span>Restock Produk</span>
            </Button>
          </Link>
          <Link href="/demo/expenses">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-white border-[#E5E1EC] hover:bg-[#F8F7FA] text-[#1A1820] shadow-xs"
              id="demo-quick-expense-btn"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 text-[#B25E09]" aria-hidden="true" />
              <span>Catat Beban Kas</span>
            </Button>
          </Link>
          <Link href="/demo/reports">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 bg-white border-[#E5E1EC] hover:bg-[#F8F7FA] text-[#767182] shadow-xs"
              id="demo-quick-report-btn"
            >
              <FileText className="w-3.5 h-3.5 text-[#767182]" aria-hidden="true" />
              <span>Laporan Finansial</span>
            </Button>
          </Link>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Banner Edukasi Disiplin Finansial UMKM */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-[#FAF9F6] border border-[#E5E1EC] rounded-xl p-3.5 flex items-start gap-3 text-xs text-[#767182]">
          <div className="w-5 h-5 rounded-md bg-[#F4F0FD] text-[#5B3CC4] flex items-center justify-center shrink-0 mt-0.5 border border-[#E7E0FA]">
            <Info className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-[#1A1820]">
              Prinsip Akuntansi UMKM Disiplin (Anti-Double-Count)
            </p>
            <p className="leading-relaxed">
              VeyraOS memisahkan antara <strong>Omzet Penjualan</strong>, <strong>HPP Persediaan</strong>,{" "}
              <strong>Beban Operasional Kas</strong>, dan <strong>Arus Kas Riil</strong>. Pembelian restock
              barang dagang dicatat sebagai arus kas keluar dan aset persediaan, sehingga tidak mengurangi laba operasional secara ganda.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 6 Kartu KPI Finansial Utama dengan Hirarki Asimetris */}
        {/* ------------------------------------------------------------------ */}
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
                <span data-testid="demo-kpi-net-sales">
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
              <span data-testid="demo-kpi-cogs">
                {formatRupiah(summaryData.cogs)}
              </span>
            }
            isFinancial
            icon={<Boxes className="w-4 h-4 text-[#1A1820]" />}
            subtitle="Modal produk terjual dari transaksi lunas"
          />

          {/* 3. Laba Kotor & Margin */}
          <StatCard
            title="Laba Kotor (Gross Profit)"
            value={
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[#0D894F]" data-testid="demo-kpi-gross-profit">
                  {formatRupiah(summaryData.grossProfit)}
                </span>
                <Badge
                  variant={summaryData.grossProfit >= 0 ? "success" : "danger"}
                  className="text-[10px] tabular-nums font-bold"
                >
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
              <span className="text-[#B25E09]" data-testid="demo-kpi-operating-expenses">
                {formatRupiah(summaryData.operatingExpenses)}
              </span>
            }
            isFinancial
            icon={<Receipt className="w-4 h-4 text-[#B25E09]" />}
            subtitle="Listrik, ATK, gaji kasir, perbaikan, & operasional"
          />

          {/* 5. Laba Operasional Sederhana */}
          <StatCard
            title="Laba Operasional Sederhana"
            value={
              <span
                className={summaryData.operatingProfit >= 0 ? "text-[#5B3CC4]" : "text-[#C0392B]"}
                data-testid="demo-kpi-operating-profit"
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
                data-testid="demo-kpi-net-cash-flow"
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

        {/* ------------------------------------------------------------------ */}
        {/* Visualisasi Tren Penjualan Harian */}
        {/* ------------------------------------------------------------------ */}
        <Card className="border border-[#E7E3EC] bg-white shadow-xs">
          <CardHeader className="p-5 pb-2 border-b border-[#F0EDF5] flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold text-[#25232B]">
                Tren Penjualan Harian (Simulasi)
              </CardTitle>
              <p className="text-xs text-[#716D7A] mt-0.5">
                Grafik omzet bersih harian sesuai zona waktu Jakarta (WIB)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-mono text-[#5B3CC4]">
                {summaryData.dailySalesTrend.length} hari aktif
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <DemoSalesTrendChart
              data={summaryData.dailySalesTrend}
              selectedDate={selectedTrendDate}
              onSelectDate={setSelectedTrendDate}
            />
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Baris Bawah: Transaksi Terbaru & Peringatan Stok */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 5 Transaksi Penjualan Terbaru */}
          <Card className="border border-[#E7E3EC] bg-white shadow-xs flex flex-col justify-between">
            <div>
              <CardHeader className="p-5 pb-3 border-b border-[#F0EDF5] flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold text-[#25232B]">
                  Transaksi Kasir Terbaru
                </CardTitle>
                <Badge variant="outline" className="text-xs text-[#716D7A]">
                  Simulasi 5 Terkini
                </Badge>
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
                          <TableRow
                            key={tx.id}
                            className="text-xs hover:bg-[#FAF9F6] transition-colors"
                            data-testid={`demo-recent-tx-${tx.id}`}
                          >
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
              <span>Fitur Kasir POS Lengkap tersedia pada Langkah 4C</span>
              <span className="text-[11px] font-semibold text-[#5B3CC4] flex items-center gap-1">
                Langkah 4C Segera
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Peringatan Stok Rendah */}
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
                <Badge variant="outline" className="text-xs text-[#716D7A]">
                  Katalog Sembako
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {summaryData.lowStockAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#E8F8F0] text-[#0E6251] flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-[#25232B]">
                      Semua Stok Produk Aman
                    </p>
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
                          data-testid={`demo-low-stock-${item.id}`}
                        >
                          <div className="min-w-0 pr-3">
                            <p className="text-sm font-semibold text-[#25232B] truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-[#716D7A] font-mono mt-0.5">
                              {item.sku ? `SKU: ${item.sku}` : item.category}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <Badge
                              variant={isOutOfStock ? "danger" : "warning"}
                              className="text-xs font-semibold"
                            >
                              {isOutOfStock ? "Habis (0)" : `Sisa ${item.stockQuantity}`}
                            </Badge>
                            <p className="text-[10px] text-[#716D7A] mt-0.5">
                              Batas Min: {item.minStockAlert} unit
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
              <span>
                Valuasi Total Persediaan:{" "}
                <strong className="text-[#25232B] font-mono">
                  {formatRupiah(summaryData.inventoryValuation)}
                </strong>
              </span>
              <span className="text-[11px] font-semibold text-[#5B3CC4] flex items-center gap-1">
                Katalog Produk (Langkah 4C)
              </span>
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Call-to-Action Pendaftaran Akun Nyata */}
        {/* ------------------------------------------------------------------ */}
        <Card className="border border-[#EAE4FF] bg-gradient-to-r from-[#F6F3FF] via-white to-[#FAF9F6] p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#5B3CC4]" />
              <h2 className="text-base sm:text-lg font-bold text-[#25232B]">
                Siap Mengelola Bisnis Nyata Anda dengan VeyraOS?
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
              Daftarkan usaha Anda dalam 2 menit. Dapatkan pencatatan kasir kilat, manajemen stok
              multi-harga, pemantauan laba bersih otomatis, dan laporan arus kas berstandar akuntansi UMKM.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <Link href="/register">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="text-sm font-bold shadow-md h-11 px-6 bg-[#5B3CC4] hover:bg-[#482EA3]"
                id="cta-register-from-demo-btn"
              >
                Daftar Akun Nyata Gratis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </DemoLayout>
  );
}
