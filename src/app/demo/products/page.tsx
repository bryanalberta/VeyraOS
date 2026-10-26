"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit,
  Archive,
  ShoppingCart,
  Boxes,
  DollarSign,
  TrendingUp,
  X,
  CheckCircle2,
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
import type { DemoProduct } from "@/services/demo/demo-types";
import { formatRupiah, cn } from "@/lib/utils";

export default function DemoProductsPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const products = storeState.products;

  // Filter & Search States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [lowStockOnly, setLowStockOnly] = React.useState(false);
  const [includeArchived, setIncludeArchived] = React.useState(false);

  // Form Modal States (Add / Edit)
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<DemoProduct | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formSku, setFormSku] = React.useState("");
  const [formCategory, setFormCategory] = React.useState("Beras & Biji-bijian");
  const [formPrice, setFormPrice] = React.useState<number>(0);
  const [formCogs, setFormCogs] = React.useState<number>(0);
  const [formStock, setFormStock] = React.useState<number>(0);
  const [formMinStock, setFormMinStock] = React.useState<number>(5);
  const [formUnit, setFormUnit] = React.useState("pcs");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Archive Confirm Modal
  const [archiveTarget, setArchiveTarget] = React.useState<DemoProduct | null>(null);

  // Toast Notification
  const [notice, setNotice] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Ekstrak kategori unik
  const categories = React.useMemo(() => {
    return Array.from(
      new Set(products.map((p) => p.category?.trim()).filter(Boolean))
    ).sort();
  }, [products]);

  // Filter produk
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      if (!includeArchived && p.isArchived) return false;
      if (includeArchived && !p.isArchived) {
        // jika includeArchived dicentang, kita tampilkan semua
      }
      if (lowStockOnly && p.stockQuantity > p.minStockAlert) return false;
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }

      return true;
    });
  }, [products, includeArchived, lowStockOnly, selectedCategory, searchQuery]);

  // Statistik Ringkas
  const activeProducts = products.filter((p) => !p.isArchived);
  const totalProductsCount = activeProducts.length;
  const totalStockUnits = activeProducts.reduce((sum, p) => sum + p.stockQuantity, 0);
  const totalAssetValue = activeProducts.reduce((sum, p) => sum + p.stockQuantity * p.cogs, 0);
  const totalPotentialRevenue = activeProducts.reduce((sum, p) => sum + p.stockQuantity * p.price, 0);
  const lowStockCount = activeProducts.filter((p) => p.stockQuantity <= p.minStockAlert).length;

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormSku(`SKU-${Date.now().toString().slice(-4)}`);
    setFormCategory(categories[0] || "Umum");
    setFormPrice(15000);
    setFormCogs(12000);
    setFormStock(10);
    setFormMinStock(5);
    setFormUnit("pcs");
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (prod: DemoProduct) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormSku(prod.sku);
    setFormCategory(prod.category);
    setFormPrice(prod.price);
    setFormCogs(prod.cogs);
    setFormStock(prod.stockQuantity);
    setFormMinStock(prod.minStockAlert);
    setFormUnit(prod.unit);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Nama produk wajib diisi.");
      return;
    }
    if (!formSku.trim()) {
      setFormError("SKU produk wajib diisi.");
      return;
    }
    if (formPrice <= 0) {
      setFormError("Harga jual harus lebih besar dari Rp 0.");
      return;
    }
    if (formCogs < 0) {
      setFormError("HPP tidak boleh bernilai negatif.");
      return;
    }

    if (editingProduct) {
      const res = demoStoreService.updateProduct({
        id: editingProduct.id,
        name: formName,
        sku: formSku,
        category: formCategory,
        price: formPrice,
        cogs: formCogs,
        stockQuantity: formStock,
        minStockAlert: formMinStock,
        unit: formUnit,
      });

      if (!res.success) {
        setFormError(res.error.message);
        return;
      }

      setNotice({ type: "success", message: `Produk '${formName}' berhasil diperbarui!` });
    } else {
      const res = demoStoreService.createProduct({
        name: formName,
        sku: formSku,
        category: formCategory,
        price: formPrice,
        cogs: formCogs,
        stockQuantity: formStock,
        minStockAlert: formMinStock,
        unit: formUnit,
      });

      if (!res.success) {
        setFormError(res.error.message);
        return;
      }

      setNotice({ type: "success", message: `Produk baru '${formName}' berhasil ditambahkan ke katalog demo!` });
    }

    setIsFormOpen(false);
  };

  const handleConfirmArchive = () => {
    if (!archiveTarget) return;
    const res = demoStoreService.archiveProduct(archiveTarget.id);
    if (res.success) {
      setNotice({ type: "success", message: `Produk '${archiveTarget.name}' berhasil diarsipkan.` });
    } else {
      setNotice({ type: "error", message: res.error.message });
    }
    setArchiveTarget(null);
  };

  return (
    <DemoLayout
      title="Katalog Produk & Stok (Simulasi)"
      currentPath="/demo/products"
    >
      <div className="space-y-6 pb-12">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Katalog Produk & Persediaan
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
              >
                Toko Sembako Sejahtera
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#716D7A]">
              Kelola daftar barang dagangan, kode SKU, batas peringatan stok minimum, dan margin HPP secara sandboxed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/demo/sales/new">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF] hover:bg-[#EAE4FF]"
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                Kasir POS Demo
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              className="text-xs h-9 font-semibold"
              id="demo-add-product-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Tambah Produk
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

        {/* Ringkasan Finansial Stok (5 KPI Cards) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Total Jenis Produk
            </span>
            <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
              {totalProductsCount} Produk
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Katalog aktif</span>
          </Card>

          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Total Fisik Barang
            </span>
            <div className="text-base sm:text-lg font-bold text-[#25232B] mt-1 font-financial tabular-nums">
              {totalStockUnits} Unit
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Persediaan di rak/gudang</span>
          </Card>

          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Nilai Modal (HPP)
            </span>
            <div className="text-base sm:text-lg font-bold text-[#5B3CC4] mt-1 font-financial tabular-nums">
              {formatRupiah(totalAssetValue)}
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Aset persediaan</span>
          </Card>

          <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
            <span className="text-[11px] font-semibold text-[#716D7A] block uppercase tracking-wider">
              Potensi Omzet
            </span>
            <div className="text-base sm:text-lg font-bold text-[#1E824C] mt-1 font-financial tabular-nums">
              {formatRupiah(totalPotentialRevenue)}
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Jika seluruh stok laku</span>
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
              {lowStockCount} Produk
            </div>
            <span className="text-[10px] text-[#716D7A] mt-0.5 block">Perlu restock</span>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D7A]" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama produk, SKU, atau kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-[#E7E3EC] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] min-h-[44px]"
                id="demo-product-search-input"
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

            <div className="w-full md:w-56">
              <Select
                id="demo-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: "ALL", label: "Semua Kategori" },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#25232B] select-none min-h-[44px] px-2 rounded hover:bg-[#F6F3FF]">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="rounded text-[#5B3CC4] focus:ring-[#5B3CC4] w-4 h-4"
                  id="demo-low-stock-checkbox"
                />
                <span>Hanya Stok Menipis</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#716D7A] select-none min-h-[44px] px-2 rounded hover:bg-[#F6F3FF]">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded text-[#5B3CC4] focus:ring-[#5B3CC4] w-4 h-4"
                  id="demo-archived-checkbox"
                />
                <span>Tampilkan Arsip</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Tabel / Card List Produk */}
        <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E7E3EC] flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                Daftar Inventaris Produk
              </h2>
              <p className="text-xs text-[#716D7A] mt-0.5">
                Menampilkan {filteredProducts.length} dari total {products.length} produk simulasi.
              </p>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Package className="w-6 h-6" />}
                title="Tidak Ada Produk Ditemukan"
                description="Coba ubah kata kunci pencarian atau sesuaikan filter kategori Anda."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("ALL");
                      setLowStockOnly(false);
                      setIncludeArchived(false);
                    }}
                  >
                    Reset Filter
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Mobile Card List (< 768px) */}
              <div className="md:hidden divide-y divide-[#E7E3EC]">
                {filteredProducts.map((prod) => {
                  const isZero = prod.stockQuantity === 0;
                  const isLow = prod.stockQuantity <= prod.minStockAlert;
                  return (
                    <div key={prod.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-[#25232B] block truncate">
                            {prod.name}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-[#716D7A]">
                              {prod.sku}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                            >
                              {prod.category}
                            </Badge>
                          </div>
                        </div>
                        {prod.isArchived ? (
                          <Badge variant="outline" className="text-[10px] text-[#716D7A]">
                            Diarsipkan
                          </Badge>
                        ) : isZero ? (
                          <Badge variant="danger" className="text-[10px]">
                            Habis (0)
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="warning" className="text-[10px]">
                            Menipis ({prod.stockQuantity})
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Stok: {prod.stockQuantity} {prod.unit}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF9F6] p-2.5 rounded-lg border border-[#F0EDF5]">
                        <div>
                          <span className="text-[#716D7A] block text-[10px]">Harga Jual</span>
                          <strong className="text-[#25232B] font-financial">
                            {formatRupiah(prod.price)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#716D7A] block text-[10px]">HPP (Modal)</span>
                          <span className="text-[#716D7A] font-financial">
                            {formatRupiah(prod.cogs)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(prod)}
                          className="text-xs h-9 min-h-[44px] px-3 font-semibold text-[#5B3CC4]"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        {!prod.isArchived && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setArchiveTarget(prod)}
                            className="text-xs h-9 min-h-[44px] px-3 text-[#C0392B] hover:bg-[#FDEDEC]"
                          >
                            <Archive className="w-3.5 h-3.5 mr-1" />
                            Arsipkan
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAF9F6]">
                      <TableHead className="w-12 text-center text-xs font-semibold text-[#716D7A]">
                        No
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Produk &amp; SKU
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Kategori
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">
                        Harga Jual
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">
                        HPP (Modal)
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold text-[#716D7A]">
                        Stok Fisik
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold text-[#716D7A]">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((prod, idx) => {
                      const isZero = prod.stockQuantity === 0;
                      const isLow = prod.stockQuantity <= prod.minStockAlert;
                      return (
                        <TableRow
                          key={prod.id}
                          className={cn(
                            "hover:bg-[#F6F3FF]/40 transition-colors",
                            prod.isArchived && "opacity-60 bg-gray-50"
                          )}
                        >
                          <TableCell className="text-center text-xs font-mono text-[#716D7A]">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-xs sm:text-sm text-[#25232B] block">
                              {prod.name}
                            </span>
                            <span className="text-[11px] font-mono text-[#716D7A]">
                              {prod.sku}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[11px] text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                            >
                              {prod.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#25232B]">
                            {formatRupiah(prod.price)}
                          </TableCell>
                          <TableCell className="text-right font-financial text-xs sm:text-sm text-[#716D7A]">
                            {formatRupiah(prod.cogs)}
                          </TableCell>
                          <TableCell className="text-center font-financial text-xs sm:text-sm font-bold">
                            {prod.stockQuantity} {prod.unit}
                          </TableCell>
                          <TableCell className="text-center">
                            {prod.isArchived ? (
                              <Badge variant="outline" className="text-[10px] text-[#716D7A]">
                                Diarsipkan
                              </Badge>
                            ) : isZero ? (
                              <Badge variant="danger" className="text-[10px]">
                                Habis
                              </Badge>
                            ) : isLow ? (
                              <Badge variant="warning" className="text-[10px]">
                                Menipis (≤ {prod.minStockAlert})
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                Aman
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditModal(prod)}
                                className="h-8 px-2 text-xs text-[#5B3CC4] hover:bg-[#F6F3FF]"
                                title="Edit data produk"
                              >
                                <Edit className="w-3.5 h-3.5 mr-1" />
                                Edit
                              </Button>
                              {!prod.isArchived && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setArchiveTarget(prod)}
                                  className="h-8 px-2 text-xs text-[#C0392B] hover:bg-[#FDEDEC]"
                                  title="Arsipkan produk"
                                >
                                  <Archive className="w-3.5 h-3.5 mr-1" />
                                  Arsip
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>

        {/* Modal Form Tambah / Edit Produk */}
        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title={editingProduct ? "Edit Data Produk (Simulasi)" : "Tambah Produk Baru (Simulasi)"}
          description="Seluruh perubahan tersimpan di storage peramban lokal dan terisolasi penuh dari database nyata."
        >
          <form onSubmit={handleSaveProduct} className="space-y-4 pt-2">
            {formError && (
              <Alert variant="danger" className="text-xs py-2">
                <AlertTriangle className="w-4 h-4 mr-1.5 shrink-0" />
                <span>{formError}</span>
              </Alert>
            )}

            <div>
              <label htmlFor="prod-form-name" className="block text-xs font-semibold text-[#25232B] mb-1">
                Nama Produk *
              </label>
              <Input
                id="prod-form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Beras Ramos Super 5kg"
                className="text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prod-form-sku" className="block text-xs font-semibold text-[#25232B] mb-1">
                  Kode SKU *
                </label>
                <Input
                  id="prod-form-sku"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="BRS-RMS-05"
                  className="text-xs font-mono h-9 uppercase"
                  required
                />
              </div>

              <div>
                <Select
                  id="prod-form-category"
                  label="Kategori"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  options={[
                    { value: "Beras & Biji-bijian", label: "Beras & Biji-bijian" },
                    { value: "Minyak & Mentega", label: "Minyak & Mentega" },
                    { value: "Bumbu & Pemanis", label: "Bumbu & Pemanis" },
                    { value: "Tepung", label: "Tepung" },
                    { value: "Minuman", label: "Minuman" },
                    { value: "Makanan Instan", label: "Makanan Instan" },
                    { value: "Kebersihan & Rumah Tangga", label: "Kebersihan & Rumah Tangga" },
                    { value: "Umum", label: "Umum" },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <CurrencyInput
                  id="prod-form-price"
                  label="Harga Jual Satuan (IDR) *"
                  value={formPrice}
                  onValueChange={(val: number) => setFormPrice(val || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <CurrencyInput
                  id="prod-form-cogs"
                  label="HPP Satuan Beli (IDR) *"
                  value={formCogs}
                  onValueChange={(val: number) => setFormCogs(val || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="prod-form-stock" className="block text-xs font-semibold text-[#25232B] mb-1">
                  Stok Awal
                </label>
                <Input
                  id="prod-form-stock"
                  type="number"
                  min="0"
                  value={formStock}
                  onChange={(e) => setFormStock(parseInt(e.target.value, 10) || 0)}
                  className="text-xs h-9 font-financial"
                />
              </div>

              <div>
                <label htmlFor="prod-form-min-stock" className="block text-xs font-semibold text-[#25232B] mb-1">
                  Batas Peringatan
                </label>
                <Input
                  id="prod-form-min-stock"
                  type="number"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(parseInt(e.target.value, 10) || 0)}
                  className="text-xs h-9 font-financial"
                />
              </div>

              <div>
                <label htmlFor="prod-form-unit" className="block text-xs font-semibold text-[#25232B] mb-1">
                  Satuan
                </label>
                <Input
                  id="prod-form-unit"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="pcs / kg / sak"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F0EDF5]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="text-xs font-semibold"
                id="demo-submit-product-btn"
              >
                {editingProduct ? "Simpan Perubahan" : "Tambah Produk"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Konfirmasi Arsipkan Produk */}
        <Modal
          isOpen={Boolean(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
          title="Konfirmasi Arsipkan Produk"
          description="Produk yang diarsipkan tidak akan muncul di kasir POS penjualan, namun riwayat transaksi terdahulu tetap terjaga."
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs sm:text-sm text-[#25232B]">
              Apakah Anda yakin ingin mengarsipkan produk{" "}
              <strong>&ldquo;{archiveTarget?.name}&rdquo;</strong> (SKU: {archiveTarget?.sku})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0EDF5]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setArchiveTarget(null)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmArchive}
                className="text-xs font-semibold"
                id="confirm-archive-btn"
              >
                Ya, Arsipkan
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DemoLayout>
  );
}
