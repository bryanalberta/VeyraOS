"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpCircle,
  Plus,
  Search,
  Package,
  Calendar,
  Truck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  X,
  Boxes,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type { DemoPurchase, DemoProduct } from "@/services/demo/demo-types";
import { formatRupiah, cn } from "@/lib/utils";

export default function DemoPurchasesPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const purchases = storeState.purchases;
  const products = storeState.products.filter((p) => !p.isArchived);

  // Filter & Search
  const [searchQuery, setSearchQuery] = React.useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<string>(products[0]?.id || "");
  const [supplierName, setSupplierName] = React.useState("PT Sumber Pangan Makmur");
  const [restockQty, setRestockQty] = React.useState<number>(10);
  const [purchaseCost, setPurchaseCost] = React.useState<number>(products[0]?.cogs || 10000);
  const [notes, setNotes] = React.useState("");
  const [modalError, setModalError] = React.useState<string | null>(null);

  // Toast
  const [notice, setNotice] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Selected product object
  const currentProd = products.find((p) => p.id === selectedProductId) || products[0];

  // Proyeksi Moving Weighted Average Cost HPP Baru
  const projection = React.useMemo(() => {
    if (!currentProd) return null;
    const curStock = currentProd.stockQuantity;
    const curCogs = currentProd.cogs;
    const addedStock = restockQty;
    const addedCost = purchaseCost;
    const newStock = curStock + addedStock;
    const newCogs =
      newStock > 0
        ? Math.round((curStock * curCogs + addedStock * addedCost) / newStock)
        : addedCost;

    return {
      curStock,
      curCogs,
      newStock,
      newCogs,
      diffCogs: newCogs - curCogs,
    };
  }, [currentProd, restockQty, purchaseCost]);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setPurchaseCost(prod.cogs);
    }
  };

  const handleOpenRestockModal = () => {
    if (products.length > 0) {
      const defaultProd = products[0];
      setSelectedProductId(defaultProd.id);
      setPurchaseCost(defaultProd.cogs);
    }
    setRestockQty(10);
    setSupplierName("PT Sumber Pangan Makmur");
    setNotes("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmitRestock = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedProductId) {
      setModalError("Pilih produk yang akan direstock.");
      return;
    }
    if (restockQty <= 0) {
      setModalError("Kuantitas restock harus lebih dari 0.");
      return;
    }
    if (purchaseCost < 0) {
      setModalError("Harga beli tidak boleh negatif.");
      return;
    }

    const res = demoStoreService.recordPurchase({
      supplierName,
      paymentMethod: "CASH",
      notes: notes.trim() || undefined,
      items: [
        {
          productId: selectedProductId,
          quantity: restockQty,
          purchaseCost: purchaseCost,
        },
      ],
    });

    if (!res.success) {
      setModalError(res.error.message);
      return;
    }

    setNotice({
      type: "success",
      message: `Restock untuk '${currentProd?.name}' berhasil dicatat! Stok bertambah ${restockQty} unit.`,
    });
    setIsModalOpen(false);
  };

  // Filter list
  const filteredPurchases = React.useMemo(() => {
    return purchases.filter((pch) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchPO = pch.purchaseNumber.toLowerCase().includes(q);
      const matchSup = pch.supplierName.toLowerCase().includes(q);
      const matchItem = pch.items.some((it) => it.productName.toLowerCase().includes(q));
      return matchPO || matchSup || matchItem;
    });
  }, [purchases, searchQuery]);

  // Statistik Ringkas
  const totalPurchaseCount = purchases.length;
  const totalExpenditure = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalItemsReceived = purchases.reduce(
    (sum, p) => sum + p.items.reduce((iSum, it) => iSum + it.quantity, 0),
    0
  );

  return (
    <DemoLayout
      title="Pembelian & Restock Stok (Simulasi)"
      currentPath="/demo/purchases"
    >
      <div className="space-y-6 pb-12">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Pembelian &amp; Restock Persediaan
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
              >
                Toko Sembako Sejahtera
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#716D7A]">
              Pencatatan restock barang dagangan dari pemasok dengan rekalkulasi Moving Weighted Average Cost HPP otomatis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/demo/products">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF] hover:bg-[#EAE4FF]"
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Lihat Katalog Produk
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenRestockModal}
              className="text-xs h-9 font-semibold"
              id="demo-restock-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Catat Pembelian / Restock
            </Button>
          </div>
        </div>

        {/* Notifikasi Toast */}
        {notice && (
          <Alert
            variant={notice.type === "success" ? "success" : "danger"}
            className="flex items-center justify-between text-xs py-2.5"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0E6251]" />
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs underline hover:no-underline font-medium"
            >
              Tutup
            </button>
          </Alert>
        )}

        {/* Info Prinsip Akuntansi */}
        <div className="rounded-xl p-3.5 bg-[#F6F3FF] border border-[#EAE4FF] flex items-start gap-2.5 text-xs text-[#392477]">
          <Boxes className="w-4 h-4 shrink-0 text-[#5B3CC4] mt-0.5" />
          <div>
            <strong>Prinsip Akuntansi UMKM:</strong> Pembelian persediaan barang dagangan dicatat sebagai penambahan aset lancar
            dan memperbarui nilai HPP rata-rata berjalan (*Moving Average Cost*), bukan dihitung langsung sebagai beban operasional.
          </div>
        </div>

        {/* Ringkasan Finansial Restock (3 KPI Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Total Transaksi Restock
            </span>
            <div className="text-base sm:text-xl font-bold text-[#25232B] mt-1 font-financial tabular-nums">
              {totalPurchaseCount} Faktur PO
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Riwayat pengadaan</span>
          </Card>

          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Total Pengeluaran Pengadaan
            </span>
            <div className="text-base sm:text-xl font-bold text-[#C0392B] mt-1 font-financial tabular-nums">
              {formatRupiah(totalExpenditure)}
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Arus kas keluar untuk persediaan</span>
          </Card>

          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Total Unit Diterima
            </span>
            <div className="text-base sm:text-xl font-bold text-[#1E824C] mt-1 font-financial tabular-nums">
              {totalItemsReceived} Unit
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Masuk ke saldo stok fisik</span>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D7A]" />
            <input
              type="text"
              placeholder="Cari berdasarkan nomor PO, nama pemasok, atau nama produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-[#E7E3EC] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] min-h-[44px]"
              id="demo-purchase-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716D7A] hover:text-[#25232B]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Card>

        {/* Tabel / Card List Riwayat Pembelian */}
        <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E7E3EC] flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                Riwayat Pembelian &amp; Restock
              </h2>
              <p className="text-xs text-[#716D7A] mt-0.5">
                Menampilkan {filteredPurchases.length} faktur pembelian persediaan.
              </p>
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ArrowUpCircle className="w-6 h-6" />}
                title="Tidak Ada Riwayat Pembelian"
                description="Belum ada transaksi restock yang sesuai dengan pencarian Anda."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                  >
                    Reset Pencarian
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Mobile Card List (< 768px) */}
              <div className="md:hidden divide-y divide-[#E7E3EC]">
                {filteredPurchases.map((pch) => (
                  <div key={pch.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#5B3CC4] block">
                          {pch.purchaseNumber}
                        </span>
                        <span className="text-xs text-[#716D7A] block mt-0.5">
                          {pch.purchaseDate.slice(0, 10)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-[#25232B]">
                        {pch.paymentMethod}
                      </Badge>
                    </div>

                    <div className="text-xs font-semibold text-[#25232B] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#716D7A]" />
                      <span>{pch.supplierName}</span>
                    </div>

                    <div className="space-y-1 bg-[#FAF9F6] p-2.5 rounded-lg border border-[#F0EDF5]">
                      {pch.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs">
                          <span className="text-[#25232B] truncate mr-2">{it.productName}</span>
                          <span className="text-[#716D7A] shrink-0 font-financial">
                            {it.quantity}x @ {formatRupiah(it.purchaseCost)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#F0EDF5] text-xs">
                      <span className="text-[#716D7A]">Total Pembelian</span>
                      <strong className="text-sm font-bold text-[#C0392B] font-financial">
                        {formatRupiah(pch.totalAmount)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAF9F6]">
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        No. Faktur PO
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Tanggal
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Pemasok / Supplier
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Rincian Barang Masuk
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold text-[#716D7A]">
                        Metode
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">
                        Total Biaya
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.map((pch) => (
                      <TableRow key={pch.id} className="hover:bg-[#F6F3FF]/40 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-[#5B3CC4]">
                          {pch.purchaseNumber}
                        </TableCell>
                        <TableCell className="text-xs text-[#716D7A]">
                          {pch.purchaseDate.slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-[#25232B]">
                          {pch.supplierName}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="space-y-0.5">
                            {pch.items.map((it) => (
                              <div key={it.id} className="flex items-center gap-2">
                                <span className="font-semibold text-[#25232B]">{it.productName}:</span>
                                <span className="text-[#716D7A] font-financial">
                                  {it.quantity} unit @ {formatRupiah(it.purchaseCost)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {pch.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#C0392B]">
                          {formatRupiah(pch.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>

        {/* Modal Catat Pembelian / Restock */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Catat Pembelian Restock Persediaan"
          description="Sistem akan otomatis menghitung Moving Weighted Average Cost HPP dan memperbarui saldo stok fisik produk."
        >
          <form onSubmit={handleSubmitRestock} className="space-y-4 pt-2">
            {modalError && (
              <Alert variant="danger" className="text-xs py-2">
                <AlertTriangle className="w-4 h-4 mr-1.5 shrink-0" />
                <span>{modalError}</span>
              </Alert>
            )}

            <div>
              <Select
                id="restock-product-select"
                label="Pilih Produk Restock *"
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name} (Stok: ${p.stockQuantity} ${p.unit} | HPP Saat Ini: ${formatRupiah(p.cogs)})`,
                }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="restock-qty-input" className="block text-xs font-semibold text-[#25232B] mb-1">
                  Kuantitas Masuk *
                </label>
                <Input
                  id="restock-qty-input"
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="text-xs h-9 font-financial"
                  required
                />
              </div>

              <div>
                <CurrencyInput
                  id="restock-cost-input"
                  label="Harga Beli Satuan Baru (IDR) *"
                  value={purchaseCost}
                  onValueChange={(val: number) => setPurchaseCost(val || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Kotak Edukasi Rekalkulasi HPP Moving Average */}
            {projection && (
              <div className="rounded-xl p-3 bg-[#F6F3FF] border border-[#EAE4FF] space-y-2 text-xs">
                <div className="font-bold text-[#392477] flex items-center justify-between">
                  <span>Simulasi Moving Weighted Average Cost:</span>
                  <Badge variant="outline" className="text-[10px] bg-white text-[#5B3CC4]">
                    Otomatis
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[#25232B]">
                  <div>
                    <span className="text-[10px] text-[#716D7A] block">Stok Sebelumnya</span>
                    <span>{projection.curStock} unit @ {formatRupiah(projection.curCogs)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#716D7A] block">Stok Baru Setelah Restock</span>
                    <strong className="text-[#1E824C] font-financial">
                      {projection.newStock} unit ({formatRupiah(projection.newCogs)}/unit)
                    </strong>
                  </div>
                </div>
                {projection.diffCogs !== 0 && (
                  <p className="text-[11px] text-[#716D7A]">
                    HPP bergerak {projection.diffCogs > 0 ? "naik" : "turun"} sebesar{" "}
                    <strong>{formatRupiah(Math.abs(projection.diffCogs))}</strong> per unit mengikuti harga kulakan baru.
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="restock-supplier-input" className="block text-xs font-semibold text-[#25232B] mb-1">
                Nama Pemasok / Distributor
              </label>
              <Input
                id="restock-supplier-input"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Contoh: PT Sumber Pangan Makmur"
                className="text-xs h-9"
              />
            </div>

            <div>
              <label htmlFor="restock-notes-input" className="block text-xs font-semibold text-[#25232B] mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <Input
                id="restock-notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Nomor resi atau kondisi barang saat bongkar muat"
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#F0EDF5]">
              <div className="text-xs">
                <span className="text-[#716D7A] block">Total Pembelian</span>
                <strong className="text-base font-bold text-[#C0392B] font-financial">
                  {formatRupiah(restockQty * purchaseCost)}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="text-xs font-semibold"
                  id="submit-demo-restock-btn"
                >
                  Simpan Pembelian
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      </div>
    </DemoLayout>
  );
}
