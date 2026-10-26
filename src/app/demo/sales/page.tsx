"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  Plus,
  Eye,
  RotateCcw,
  AlertTriangle,
  X,
  Receipt,
  Banknote,
  CheckCircle2,
  Filter,
  ShieldAlert,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type {
  DemoSale,
  DemoSaleStatus,
  DemoPaymentMethod,
} from "@/services/demo/demo-types";
import { formatRupiah, cn } from "@/lib/utils";

import {
  formatSaleDate,
  sortSalesLatestFirst,
  filterSales,
  calculateSalesStats,
  validateVoidReason,
} from "./demo-sales-utils";

// ---------------------------------------------------------------------------
// Komponen Utama: DemoSalesHistoryPage (/demo/sales)
// ---------------------------------------------------------------------------
export default function DemoSalesHistoryPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const sales = storeState.sales;

  // Filter & Search State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | DemoSaleStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = React.useState<"ALL" | DemoPaymentMethod>("ALL");

  // Modal State
  const [selectedSaleId, setSelectedSaleId] = React.useState<string | null>(null);
  const [voidingSaleId, setVoidingSaleId] = React.useState<string | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const [voidError, setVoidError] = React.useState<string | null>(null);
  const [isVoidSubmitting, setIsVoidSubmitting] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  const voidMutexRef = React.useRef(false);

  // Ambil objek transaksi aktif dari snapshot terkini
  const selectedSale = React.useMemo(() => {
    if (!selectedSaleId) return null;
    return sales.find((s) => s.id === selectedSaleId) || null;
  }, [sales, selectedSaleId]);

  const voidingSale = React.useMemo(() => {
    if (!voidingSaleId) return null;
    return sales.find((s) => s.id === voidingSaleId) || null;
  }, [sales, voidingSaleId]);

  // Keyboard shortcut: Escape untuk menutup modal secara aman
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isVoidSubmitting) return; // Lindungi agar tidak menutup dialog saat proses pembatalan sedang berjalan
        if (voidingSaleId) {
          // Tutup void dialog terlebih dahulu jika sedang terbuka
          setVoidingSaleId(null);
          setVoidError(null);
        } else if (selectedSaleId) {
          setSelectedSaleId(null);
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [voidingSaleId, selectedSaleId, isVoidSubmitting]);

  // Urutan transaksi terbaru terlebih dahulu (chronological descending)
  const sortedSales = React.useMemo(() => sortSalesLatestFirst(sales), [sales]);

  // Filter transaksi berdasarkan pencarian, status, dan metode pembayaran
  const filteredSales = React.useMemo(
    () => filterSales(sortedSales, searchQuery, statusFilter, paymentFilter),
    [sortedSales, searchQuery, statusFilter, paymentFilter]
  );

  // Statistik Ringkas Penjualan
  const stats = React.useMemo(() => calculateSalesStats(sales), [sales]);

  // Handler Buka Dialog Void
  const handleOpenVoidDialog = (sale: DemoSale) => {
    if (sale.status === "VOIDED") return;
    setVoidingSaleId(sale.id);
    setVoidReason("");
    setVoidError(null);
  };

  // Handler Tutup Dialog Void
  const handleCloseVoidDialog = () => {
    setVoidingSaleId(null);
    setVoidReason("");
    setVoidError(null);
  };

  // Handler Eksekusi Pembatalan Transaksi (Void)
  const handleExecuteVoid = async () => {
    if (!voidingSale) return;
    if (voidMutexRef.current || isVoidSubmitting) return;

    const validation = validateVoidReason(voidReason);
    if (!validation.isValid) {
      setVoidError(validation.message || "Alasan pembatalan wajib diisi minimal 5 karakter non-spasi.");
      return;
    }

    voidMutexRef.current = true;
    setIsVoidSubmitting(true);
    setVoidError(null);

    try {
      const result = demoStoreService.voidSale({
        saleId: voidingSale.id,
        voidReason: voidReason.trim(),
      });

      if (result.success) {
        setFeedbackMessage(
          `Transaksi "${result.data.invoiceNumber}" berhasil dibatalkan. Kuantitas stok persediaan telah dipulihkan secara otomatis.`
        );
        handleCloseVoidDialog();
      } else {
        setVoidError(result.error.message || "Gagal membatalkan transaksi.");
      }
    } catch (err) {
      setVoidError(
        (err as Error).message || "Terjadi kesalahan sistem saat membatalkan transaksi."
      );
    } finally {
      voidMutexRef.current = false;
      setIsVoidSubmitting(false);
    }
  };

  return (
    <DemoLayout
      title="Riwayat Penjualan Demo"
      currentPath="/demo/sales"
      className="bg-[#FAF9F6]"
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
        {/* Header Modul Penjualan */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E7E3EC]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5B3CC4] bg-[#F6F3FF] px-2.5 py-0.5 rounded-full border border-[#EAE4FF]">
                Penjualan & Kasir
              </span>
              <span className="text-xs text-[#716D7A]">
                Toko: <strong className="text-[#25232B]">{storeState.business.name}</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#25232B] mt-1 tracking-tight">
              Riwayat Transaksi Penjualan
            </h2>
            <p className="text-xs text-[#716D7A] mt-0.5">
              Kelola daftar faktur penjualan, detail transaksi historis, dan pembatalan (void) stok.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/demo/sales/new">
              <Button
                variant="primary"
                size="md"
                id="open-pos-button"
                className="font-bold shadow-xs flex items-center gap-2 min-h-[44px]"
              >
                <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                <span>Buka Kasir POS</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Feedback Sukses Aksi (Dismissible) */}
        {feedbackMessage && (
          <Alert
            variant="success"
            title="Aksi Berhasil"
            className="animate-in fade-in"
          >
            <div className="flex items-center justify-between gap-4">
              <span>{feedbackMessage}</span>
              <button
                type="button"
                onClick={() => setFeedbackMessage(null)}
                className="text-[#0E6251] hover:underline text-xs font-semibold shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </Alert>
        )}

        {/* KPI Mini Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-[#E7E3EC]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#716D7A] font-medium">Total Transaksi</p>
                <p className="text-xl font-bold text-[#25232B] font-mono mt-0.5">
                  {stats.totalCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center">
                <Receipt className="w-5 h-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E7E3EC]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#716D7A] font-medium">Transaksi Lunas</p>
                <p className="text-xl font-bold text-[#1E824C] font-mono mt-0.5">
                  {stats.completedCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#E8F8F0] text-[#1E824C] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E7E3EC]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#716D7A] font-medium">Transaksi Dibatalkan</p>
                <p className="text-xl font-bold text-[#C0392B] font-mono mt-0.5">
                  {stats.voidedCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#FDEDEC] text-[#C0392B] flex items-center justify-center">
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E7E3EC]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#716D7A] font-medium">Omzet Bersih Lunas</p>
                <p className="text-xl font-bold text-[#5B3CC4] font-mono tabular-nums mt-0.5">
                  {formatRupiah(stats.completedNetSales)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center">
                <Banknote className="w-5 h-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Bar Pencarian */}
        <Card className="border-[#E7E3EC] shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Input Pencarian */}
              <div className="md:col-span-6 relative">
                <Input
                  type="search"
                  id="sales-search-input"
                  placeholder="Cari berdasarkan No. Faktur atau Nama Produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" aria-hidden="true" />}
                  className="pr-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716D7A] hover:text-[#25232B] p-1"
                    aria-label="Bersihkan pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Status */}
              <div className="md:col-span-3">
                <Select
                  id="sales-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "ALL" | DemoSaleStatus)}
                  options={[
                    { value: "ALL", label: `Semua Status (${sales.length})` },
                    { value: "COMPLETED", label: `Selesai / Lunas (${stats.completedCount})` },
                    { value: "VOIDED", label: `Dibatalkan / Void (${stats.voidedCount})` },
                  ]}
                />
              </div>

              {/* Filter Metode Pembayaran */}
              <div className="md:col-span-3">
                <Select
                  id="sales-payment-filter"
                  value={paymentFilter}
                  onChange={(e) =>
                    setPaymentFilter(e.target.value as "ALL" | DemoPaymentMethod)
                  }
                  options={[
                    { value: "ALL", label: "Semua Pembayaran" },
                    { value: "CASH", label: "Tunai (CASH)" },
                    { value: "BANK_TRANSFER", label: "Transfer Bank" },
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabel Riwayat Transaksi */}
        {filteredSales.length === 0 ? (
          sales.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="w-6 h-6 text-[#716D7A]" aria-hidden="true" />}
              title="Belum Ada Transaksi Penjualan"
              description="Toko Anda belum memiliki catatan penjualan. Buka kasir POS untuk membuat transaksi simulasi pertama."
              action={
                <Link href="/demo/sales/new">
                  <Button variant="primary" size="md">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Buka Kasir POS Sekarang
                  </Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Filter className="w-6 h-6 text-[#716D7A]" aria-hidden="true" />}
              title="Tidak Ada Transaksi yang Cocok"
              description="Tidak ditemukan transaksi yang memenuhi kriteria pencarian dan filter yang aktif."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setPaymentFilter("ALL");
                  }}
                >
                  Reset Semua Filter
                </Button>
              }
            />
          )
        ) : (
          <div className="space-y-4">
            {/* Tampilan Tabel Desktop (hidden pada layar sangat kecil) */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">No. Faktur</TableHead>
                    <TableHead className="w-[180px]">Waktu Transaksi</TableHead>
                    <TableHead>Item Belanja</TableHead>
                    <TableHead className="w-[130px]">Metode</TableHead>
                    <TableHead className="w-[150px] text-right">Total Tagihan</TableHead>
                    <TableHead className="w-[120px] text-center">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => {
                    const isVoided = sale.status === "VOIDED";
                    const itemsSummary =
                      sale.items.length === 0
                        ? "Tidak ada item"
                        : sale.items.length === 1
                        ? sale.items[0].productName
                        : `${sale.items[0].productName} (+${sale.items.length - 1} item lainnya)`;

                    return (
                      <TableRow
                        key={sale.id}
                        className={cn(isVoided && "bg-[#FAF9F6]/80 opacity-75")}
                      >
                        {/* No. Faktur */}
                        <TableCell className="font-mono font-bold text-xs text-[#25232B]">
                          <span className="bg-[#F6F3FF] text-[#5B3CC4] border border-[#EAE4FF] px-2 py-0.5 rounded">
                            {sale.invoiceNumber}
                          </span>
                        </TableCell>

                        {/* Waktu Transaksi */}
                        <TableCell className="text-xs text-[#716D7A]">
                          {formatSaleDate(sale.transactionDate)}
                        </TableCell>

                        {/* Item Belanja */}
                        <TableCell className="text-xs">
                          <p className="font-medium text-[#25232B] truncate max-w-[260px]">
                            {itemsSummary}
                          </p>
                          <span className="text-[11px] text-[#716D7A]">
                            {sale.items.reduce((sum, i) => sum + i.quantity, 0)} unit barang
                          </span>
                        </TableCell>

                        {/* Metode Pembayaran */}
                        <TableCell className="text-xs">
                          {sale.paymentMethod === "CASH" ? (
                            <Badge variant="outline" className="text-[10px]">
                              Tunai
                            </Badge>
                          ) : (
                            <Badge variant="info" className="text-[10px]">
                              Transfer Bank
                            </Badge>
                          )}
                        </TableCell>

                        {/* Total Tagihan */}
                        <TableCell className="text-right text-xs font-mono font-bold tabular-nums text-[#25232B]">
                          {formatRupiah(sale.totalAmount)}
                        </TableCell>

                        {/* Status Transaksi */}
                        <TableCell className="text-center">
                          {isVoided ? (
                            <Badge variant="danger" className="text-[10px]">
                              Dibatalkan
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px]">
                              Selesai
                            </Badge>
                          )}
                        </TableCell>

                        {/* Aksi */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSaleId(sale.id)}
                              className="text-xs h-8 px-2.5"
                              title="Lihat Rincian Faktur"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Detail
                            </Button>

                            {!isVoided ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenVoidDialog(sale)}
                                className="text-xs text-[#C0392B] hover:text-[#922B21] hover:bg-[#FDEDEC] h-8 px-2"
                                title="Batalkan Transaksi (Void)"
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                Batal
                              </Button>
                            ) : (
                              <span
                                className="text-[11px] text-[#716D7A] italic px-2"
                                title={sale.voidReason || "Transaksi telah dibatalkan"}
                              >
                                Voided
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Tampilan Kartu Mobile (< 768px) */}
            <div className="md:hidden space-y-3">
              {filteredSales.map((sale) => {
                const isVoided = sale.status === "VOIDED";

                return (
                  <Card
                    key={sale.id}
                    className={cn(
                      "border-[#E7E3EC] shadow-xs text-left",
                      isVoided && "bg-[#FAF9F6] opacity-80"
                    )}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-xs bg-[#F6F3FF] text-[#5B3CC4] border border-[#EAE4FF] px-2 py-0.5 rounded block w-fit">
                            {sale.invoiceNumber}
                          </span>
                          <p className="text-[11px] text-[#716D7A] mt-1">
                            {formatSaleDate(sale.transactionDate)}
                          </p>
                        </div>

                        {isVoided ? (
                          <Badge variant="danger" className="text-[10px]">
                            Dibatalkan
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Selesai
                          </Badge>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#F0EDF5] flex justify-between items-baseline">
                        <span className="text-xs text-[#716D7A]">
                          {sale.items.length} jenis produk ({sale.paymentMethod})
                        </span>
                        <span className="text-base font-bold font-mono text-[#25232B] tabular-nums">
                          {formatRupiah(sale.totalAmount)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#F0EDF5] flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSaleId(sale.id)}
                          className="text-xs h-8"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detail
                        </Button>

                        {!isVoided && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenVoidDialog(sale)}
                            className="text-xs text-[#C0392B] hover:text-[#922B21] hover:bg-[#FDEDEC] h-8"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Batalkan
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL DETAIL TRANSAKSI HISTORIS */}
        {/* ================================================================= */}
        {selectedSale && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedSaleId(null)}
            size="lg"
            title={
              <div className="space-y-1">
                <h3 id="detail-modal-title" className="text-lg font-bold text-[#25232B]">
                  Rincian Transaksi Penjualan
                </h3>
                <p className="text-xs text-[#716D7A] font-normal">
                  Faktur:{" "}
                  <strong className="font-mono text-[#5B3CC4]">
                    {selectedSale.invoiceNumber}
                  </strong>
                </p>
              </div>
            }
            footer={
              <div className="flex items-center justify-end gap-2 w-full">
                {selectedSale.status === "COMPLETED" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const saleToVoid = selectedSale;
                      setSelectedSaleId(null);
                      handleOpenVoidDialog(saleToVoid);
                    }}
                    className="mr-auto font-bold text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Batalkan Transaksi (Void)
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSaleId(null)}
                  className="text-xs"
                >
                  Tutup
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Status Banner Jika Dibatalkan */}
              {selectedSale.status === "VOIDED" && (
                <div className="p-3.5 rounded-xl bg-[#FDEDEC] border border-[#F5B7B1] text-xs text-[#922B21] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Transaksi Ini Telah Dibatalkan (VOID)</span>
                  </div>
                  {selectedSale.voidedAt && (
                    <p className="text-[11px] opacity-90">
                      Waktu Pembatalan: {formatSaleDate(selectedSale.voidedAt)}
                    </p>
                  )}
                  {selectedSale.voidReason && (
                    <p className="text-[11px] font-medium pt-1 border-t border-[#F5B7B1]/60">
                      Alasan: &ldquo;{selectedSale.voidReason}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Metadata Transaksi */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E7E3EC] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">Tanggal & Waktu:</span>
                  <span className="font-medium text-[#25232B]">
                    {formatSaleDate(selectedSale.transactionDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">Status Transaksi:</span>
                  <span>
                    {selectedSale.status === "COMPLETED" ? (
                      <Badge variant="success" className="text-[10px]">
                        Selesai / Lunas
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="text-[10px]">
                        Dibatalkan (Void)
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">Metode Pembayaran:</span>
                  <span className="font-bold text-[#25232B]">
                    {selectedSale.paymentMethod === "CASH" ? "Tunai (CASH)" : "Transfer Bank"}
                  </span>
                </div>
              </div>

              {/* Daftar Barang Belanja */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-[#25232B] uppercase tracking-wider">
                  Daftar Barang ({selectedSale.items.length})
                </h5>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                  {selectedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-[#F0EDF5] bg-white flex justify-between items-start"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-[#25232B] truncate">{item.productName}</p>
                        <p className="text-[11px] text-[#716D7A] font-mono mt-0.5">
                          {item.quantity} x {formatRupiah(item.unitPrice)}
                          {item.itemDiscount && item.itemDiscount > 0 ? (
                            <span className="text-[#1E824C] ml-1">
                              (Diskon -{formatRupiah(item.itemDiscount)})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-[#716D7A] font-mono mt-0.5">
                          Snapshot HPP: {formatRupiah(item.costPrice)} / unit
                        </p>
                      </div>
                      <span className="font-bold font-mono text-[#25232B] shrink-0">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ringkasan Finansial Lengkap */}
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E7E3EC] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#716D7A]">
                  <span>Subtotal Kotor</span>
                  <span className="font-mono">{formatRupiah(selectedSale.subtotal)}</span>
                </div>

                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-[#1E824C]">
                    <span>Diskon Transaksi</span>
                    <span className="font-mono">-{formatRupiah(selectedSale.discount)}</span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-[#E7E3EC] flex justify-between font-bold text-sm text-[#25232B]">
                  <span>Total Tagihan (Penjualan Bersih)</span>
                  <span className="text-base text-[#5B3CC4] font-mono tabular-nums">
                    {formatRupiah(selectedSale.totalAmount)}
                  </span>
                </div>

                {/* Info Tunai jika CASH dan ada data uang diterima */}
                {selectedSale.paymentMethod === "CASH" && selectedSale.cashReceived !== undefined && (
                  <>
                    <div className="flex justify-between text-[#716D7A] pt-1 border-t border-[#F0EDF5]">
                      <span>Uang Diterima</span>
                      <span className="font-mono">
                        {formatRupiah(selectedSale.cashReceived)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#0E6251] font-semibold">
                      <span>Kembalian</span>
                      <span className="font-mono">
                        {formatRupiah(selectedSale.cashChange || 0)}
                      </span>
                    </div>
                  </>
                )}

                {/* Snapshot HPP & Laba Kotor Toko */}
                <div className="pt-2 border-t border-[#E7E3EC] flex justify-between text-[11px] text-[#716D7A]">
                  <span>Total HPP Terjual (COGS):</span>
                  <span className="font-mono">{formatRupiah(selectedSale.totalCogs)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[#0E6251] font-semibold">
                  <span>Laba Kotor Transaksi:</span>
                  <span className="font-mono">{formatRupiah(selectedSale.grossProfit)}</span>
                </div>
              </div>

              {/* Catatan Transaksi */}
              {selectedSale.notes && (
                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E7E3EC] text-xs">
                  <span className="font-semibold text-[#716D7A] block">Catatan:</span>
                  <span className="text-[#25232B]">{selectedSale.notes}</span>
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* ================================================================= */}
        {/* MODAL DIALOG PEMBATALAN TRANSAKSI (VOID SALE) */}
        {/* ================================================================= */}
        {voidingSale && (
          <Modal
            isOpen={true}
            onClose={handleCloseVoidDialog}
            size="md"
            preventClose={isVoidSubmitting}
            title={
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FDEDEC] text-[#C0392B] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="void-modal-title" className="text-base font-bold text-[#25232B]">
                    Konfirmasi Pembatalan Transaksi
                  </h3>
                  <p className="text-xs text-[#716D7A] mt-0.5 font-normal">
                    Faktur:{" "}
                    <strong className="font-mono text-[#C0392B]">
                      {voidingSale.invoiceNumber}
                    </strong>{" "}
                    • Total: {formatRupiah(voidingSale.totalAmount)}
                  </p>
                </div>
              </div>
            }
            footer={
              <div className="flex items-center gap-3 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isVoidSubmitting}
                  onClick={handleCloseVoidDialog}
                >
                  Batal (Tutup)
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1 font-bold"
                  id="confirm-void-button"
                  disabled={isVoidSubmitting || voidReason.trim().length < 5}
                  isLoading={isVoidSubmitting}
                  onClick={handleExecuteVoid}
                >
                  {isVoidSubmitting ? "Membatalkan..." : "Ya, Batalkan Transaksi"}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Peringatan Konsekuensi Pembatalan */}
              <div className="p-3.5 rounded-xl bg-[#FEF9E7] border border-[#FAD7A0] text-[#7D6608] text-xs leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-[#B9770E]" />
                  <span>Peringatan Pembatalan Finansial:</span>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    Stok seluruh barang pada faktur ini akan <strong>dipulihkan</strong> ke
                    persediaan toko secara otomatis.
                  </li>
                  <li>
                    Nominal transaksi akan <strong>dikeluarkan</strong> dari omzet bersih dan
                    arus kas pada dashboard.
                  </li>
                  <li>
                    Tindakan ini bersifat <strong>permanen</strong> dan tidak dapat dibatalkan
                    kembali.
                  </li>
                </ul>
              </div>

              {/* Pesan Kesalahan Validasi (jika ada) */}
              {voidError && (
                <Alert variant="danger" title="Gagal Membatalkan">
                  <span>{voidError}</span>
                </Alert>
              )}

              {/* Input Alasan Pembatalan (Wajib minimal 5 karakter) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label
                    htmlFor="void-reason-textarea"
                    className="block text-xs font-bold text-[#25232B]"
                  >
                    Alasan Pembatalan <span className="text-[#C0392B]">*</span>
                  </label>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      voidReason.trim().length >= 5 ? "text-[#1E824C]" : "text-[#716D7A]"
                    )}
                  >
                    {voidReason.trim().length} / min. 5 karakter
                  </span>
                </div>
                <textarea
                  id="void-reason-textarea"
                  rows={3}
                  required
                  autoFocus
                  disabled={isVoidSubmitting}
                  placeholder="Contoh: Pelanggan salah memilih varian, barang dikembalikan sebelum dibawa pulang..."
                  value={voidReason}
                  onChange={(e) => {
                    setVoidReason(e.target.value);
                    if (voidError) setVoidError(null);
                  }}
                  className="w-full text-xs p-3 rounded-lg border border-[#E7E3EC] bg-white text-[#25232B] placeholder:text-[#716D7A] focus:outline-none focus:ring-2 focus:ring-[#C0392B] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </DemoLayout>
  );
}
