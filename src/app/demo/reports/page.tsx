"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Receipt,
  Coins,
  Boxes,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { demoStoreService } from "@/services/demo/demo-store.service";
import { formatRupiah, cn } from "@/lib/utils";

export default function DemoReportsPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const [activeTab, setActiveTab] = React.useState<"sales" | "expenses" | "stock">("sales");
  const [exportNotice, setExportNotice] = React.useState<string | null>(null);

  const { products, sales, expenses, purchases } = storeState;

  // Ringkasan Penjualan
  const completedSales = sales.filter((s) => s.status === "COMPLETED");
  const voidedSales = sales.filter((s) => s.status === "VOIDED");
  const netSales = completedSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const grossSales = completedSales.reduce((sum, s) => sum + s.subtotal, 0);
  const totalDiscounts = completedSales.reduce((sum, s) => sum + s.discount, 0);

  // Ringkasan Beban
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Ringkasan Stok
  const activeProducts = products.filter((p) => !p.isArchived);
  const totalStockAsset = activeProducts.reduce((sum, p) => sum + p.stockQuantity * p.cogs, 0);
  const totalPotentialRevenue = activeProducts.reduce((sum, p) => sum + p.stockQuantity * p.price, 0);
  const totalStockUnits = activeProducts.reduce((sum, p) => sum + p.stockQuantity, 0);
  const lowStockCount = activeProducts.filter((p) => p.stockQuantity <= p.minStockAlert).length;

  // Client-Side CSV Export Generator (RFC 4180 format)
  const handleExportCsv = () => {
    let csvContent = "";
    let filename = "";

    if (activeTab === "sales") {
      filename = `laporan_penjualan_demo_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = "No Faktur,Tanggal,Status,Metode,Total Kotor,Diskon,Total Bersih\n";
      for (const s of sales) {
        csvContent += `"${s.invoiceNumber}","${s.transactionDate.slice(0, 10)}","${s.status}","${s.paymentMethod}",${s.subtotal},${s.discount},${s.totalAmount}\n`;
      }
    } else if (activeTab === "expenses") {
      filename = `laporan_beban_demo_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = "ID,Tanggal,Kategori,Keterangan,Metode,Nominal\n";
      for (const e of expenses) {
        csvContent += `"${e.id}","${e.expenseDate.slice(0, 10)}","${e.category}","${e.description}","${e.paymentMethod}",${e.amount}\n`;
      }
    } else {
      filename = `laporan_stok_demo_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = "SKU,Nama Produk,Kategori,Stok Fisik,Satuan,HPP Beli,Harga Jual,Nilai Modal,Potensi Omzet\n";
      for (const p of activeProducts) {
        csvContent += `"${p.sku}","${p.name}","${p.category}",${p.stockQuantity},"${p.unit}",${p.cogs},${p.price},${p.stockQuantity * p.cogs},${p.stockQuantity * p.price}\n`;
      }
    }

    try {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportNotice(`Berkas CSV '${filename}' berhasil diunduh langsung di peramban.`);
    } catch {
      setExportNotice("Gagal memproses ekspor CSV di peramban.");
    }
  };

  return (
    <DemoLayout
      title="Laporan Finansial & Operasional (Simulasi)"
      currentPath="/demo/reports"
    >
      <div className="space-y-6 pb-12">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Laporan Keuangan &amp; Operasional
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
              >
                Toko Sembako Sejahtera
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#716D7A]">
              Rekonsiliasi omzet kasir, beban usaha, serta valuasi modal persediaan secara sandboxed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="text-xs h-9 font-semibold text-[#5B3CC4] border-[#E7E3EC] hover:bg-[#F6F3FF] hover:border-[#5B3CC4]"
              id="demo-export-csv-btn"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Ekspor CSV Klien
            </Button>
          </div>
        </div>

        {/* Notifikasi Status Ekspor CSV */}
        {exportNotice && (
          <Alert variant="success" className="flex items-center justify-between text-xs py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0E6251]" />
              <span>{exportNotice}</span>
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

        {/* Segmented Tabs Navigation */}
        <div
          role="tablist"
          aria-label="Pilihan Jenis Laporan Demo"
          className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F0EDF5] border border-[#E7E3EC] w-full sm:w-fit overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sales"}
            onClick={() => setActiveTab("sales")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap min-h-[38px]",
              activeTab === "sales"
                ? "bg-white text-[#5B3CC4] shadow-sm border border-[#EAE4FF]"
                : "text-[#716D7A] hover:text-[#25232B] hover:bg-white/50"
            )}
            id="demo-tab-sales"
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Laporan Penjualan</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "expenses"}
            onClick={() => setActiveTab("expenses")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap min-h-[38px]",
              activeTab === "expenses"
                ? "bg-white text-[#5B3CC4] shadow-sm border border-[#EAE4FF]"
                : "text-[#716D7A] hover:text-[#25232B] hover:bg-white/50"
            )}
            id="demo-tab-expenses"
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>Beban Operasional</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "stock"}
            onClick={() => setActiveTab("stock")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap min-h-[38px]",
              activeTab === "stock"
                ? "bg-white text-[#5B3CC4] shadow-sm border border-[#EAE4FF]"
                : "text-[#716D7A] hover:text-[#25232B] hover:bg-white/50"
            )}
            id="demo-tab-stock"
          >
            <Boxes className="w-4 h-4 shrink-0" />
            <span>Stok &amp; Valuasi Persediaan</span>
          </button>
        </div>

        {/* TAB 1: LAPORAN PENJUALAN */}
        {activeTab === "sales" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Penjualan Bersih
                </span>
                <div className="text-base sm:text-lg font-bold text-[#5B3CC4] mt-1 font-financial tabular-nums">
                  {formatRupiah(netSales)}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Omzet riil selesai</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Penjualan Kotor
                </span>
                <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                  {formatRupiah(grossSales)}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Sebelum diskon</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Total Diskon
                </span>
                <div className="text-base sm:text-lg font-bold text-[#B9770E] mt-1 font-financial tabular-nums">
                  {formatRupiah(totalDiscounts)}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Potongan kasir</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Total Transaksi
                </span>
                <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                  {sales.length}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Seluruh faktur</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Selesai / Lunas
                </span>
                <div className="text-base sm:text-lg font-bold text-[#1E824C] mt-1 font-financial tabular-nums">
                  {completedSales.length}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Omzet dihitung</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Dibatalkan
                </span>
                <div className="text-base sm:text-lg font-bold text-[#C0392B] mt-1 font-financial tabular-nums">
                  {voidedSales.length}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Status VOIDED</span>
              </Card>
            </div>

            {/* Tabel Penjualan */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E7E3EC]">
                <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                  Daftar Transaksi Kasir
                </h2>
                <p className="text-xs text-[#716D7A] mt-0.5">
                  Menampilkan {sales.length} transaksi penjualan simulasi.
                </p>
              </div>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAF9F6]">
                      <TableHead className="text-xs font-semibold text-[#716D7A]">No. Faktur</TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Tanggal</TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Metode</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-[#716D7A]">Status</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">Diskon</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">Total Bersih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs font-bold text-[#5B3CC4]">{s.invoiceNumber}</TableCell>
                        <TableCell className="text-xs text-[#716D7A]">{s.transactionDate.slice(0, 10)}</TableCell>
                        <TableCell className="text-xs font-medium">{s.paymentMethod}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={s.status === "COMPLETED" ? "success" : "danger"} className="text-[10px]">
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs text-[#716D7A]">
                          {formatRupiah(s.discount)}
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#25232B]">
                          {formatRupiah(s.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-[#E7E3EC]">
                {sales.map((s) => (
                  <div key={s.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-xs font-bold text-[#5B3CC4]">{s.invoiceNumber}</span>
                      <Badge variant={s.status === "COMPLETED" ? "success" : "danger"} className="text-[10px]">
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#716D7A]">{s.transactionDate.slice(0, 10)}</span>
                      <strong className="text-sm font-bold text-[#25232B] font-financial">
                        {formatRupiah(s.totalAmount)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: LAPORAN BEBAN OPERASIONAL */}
        {activeTab === "expenses" && (
          <div className="space-y-6">
            <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs">
              <span className="text-xs font-semibold text-[#716D7A] uppercase tracking-wider block">
                Total Pengeluaran Operasional Toko
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#C0392B] mt-2 font-financial tabular-nums">
                {formatRupiah(totalExpenses)}
              </div>
              <p className="text-xs text-[#716D7A] mt-1">
                Total tercatat dari {expenses.length} transaksi beban operasional.
              </p>
            </Card>

            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E7E3EC]">
                <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                  Rincian Biaya Operasional
                </h2>
              </div>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAF9F6]">
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Tanggal</TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Kategori</TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Keterangan</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-[#716D7A]">{e.expenseDate.slice(0, 10)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] text-[#5B3CC4] bg-[#F6F3FF] border-[#EAE4FF]">
                            {e.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#25232B]">{e.description}</TableCell>
                        <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#C0392B]">
                          {formatRupiah(e.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-[#E7E3EC]">
                {expenses.map((e) => (
                  <div key={e.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] text-[#5B3CC4] bg-[#F6F3FF] border-[#EAE4FF]">
                        {e.category}
                      </Badge>
                      <strong className="text-sm font-bold text-[#C0392B] font-financial">
                        {formatRupiah(e.amount)}
                      </strong>
                    </div>
                    <p className="text-xs text-[#25232B]">{e.description}</p>
                    <span className="text-[11px] text-[#716D7A] block">{e.expenseDate.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: STOK & VALUASI */}
        {activeTab === "stock" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Modal Aset Stok
                </span>
                <div className="text-base sm:text-lg font-bold text-[#5B3CC4] mt-1 font-financial tabular-nums">
                  {formatRupiah(totalStockAsset)}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Berdasarkan HPP</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Potensi Omzet
                </span>
                <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                  {formatRupiah(totalPotentialRevenue)}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Harga jual penuh</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Potensi Laba Kotor
                </span>
                <div className="text-base sm:text-lg font-bold text-[#1E824C] mt-1 font-financial tabular-nums">
                  {formatRupiah(totalPotentialRevenue - totalStockAsset)}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Selisih jual - HPP</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Total Unit Stok
                </span>
                <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                  {totalStockUnits}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Kuantitas fisik</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Jenis Produk
                </span>
                <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
                  {activeProducts.length}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Produk aktif</span>
              </Card>

              <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
                <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
                  Stok Menipis
                </span>
                <div
                  className={cn(
                    "text-base sm:text-lg font-bold mt-1 font-financial tabular-nums",
                    lowStockCount > 0 ? "text-[#C0392B]" : "text-[#1E824C]"
                  )}
                >
                  {lowStockCount}
                </div>
                <span className="text-[10px] text-[#716D7A] mt-0.5 block">Perlu restock</span>
              </Card>
            </div>

            {/* Tabel Stok */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E7E3EC]">
                <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                  Valuasi Inventaris &amp; Persediaan
                </h2>
              </div>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAF9F6]">
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Produk &amp; SKU</TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">Kategori</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-[#716D7A]">Stok Fisik</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">HPP (Modal)</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">Total Modal Aset</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">Potensi Omzet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="font-bold text-xs sm:text-sm text-[#25232B] block">{p.name}</span>
                          <span className="text-[11px] font-mono text-[#716D7A]">{p.sku}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-[#5B3CC4] bg-[#F6F3FF] border-[#EAE4FF]">
                            {p.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-financial text-xs font-bold">
                          {p.stockQuantity} {p.unit}
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs text-[#716D7A]">
                          {formatRupiah(p.cogs)}
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#5B3CC4]">
                          {formatRupiah(p.stockQuantity * p.cogs)}
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#25232B]">
                          {formatRupiah(p.stockQuantity * p.price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-[#E7E3EC]">
                {activeProducts.map((p) => (
                  <div key={p.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-sm text-[#25232B]">{p.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Stok: {p.stockQuantity} {p.unit}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF9F6] p-2.5 rounded-lg border border-[#F0EDF5]">
                      <div>
                        <span className="text-[10px] text-[#716D7A] block">Nilai Modal Aset</span>
                        <strong className="text-[#5B3CC4] font-financial">
                          {formatRupiah(p.stockQuantity * p.cogs)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#716D7A] block">Potensi Omzet</span>
                        <strong className="text-[#25232B] font-financial">
                          {formatRupiah(p.stockQuantity * p.price)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </DemoLayout>
  );
}
