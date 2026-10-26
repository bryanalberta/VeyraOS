"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Banknote,
  Building2,
  CheckCircle2,
  Receipt,
  X,
  Printer,
  Package,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type {
  DemoProduct,
  DemoSale,
  DemoPaymentMethod,
  RecordDemoSaleInput,
} from "@/services/demo/demo-types";
import { formatRupiah, cn } from "@/lib/utils";

import {
  posReducer,
  initialPosState,
  calculateCartSummary,
  getQuickCashOptions,
  type PosCartItem,
  type PosState,
  type PosAction,
  type PosCartSummary,
} from "./pos-state";

// ---------------------------------------------------------------------------
// Komponen Utama: DemoPosPage (/demo/sales/new)
// ---------------------------------------------------------------------------

export default function DemoPosPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const [state, dispatch] = React.useReducer(posReducer, initialPosState);
  const [activeItemDiscountId, setActiveItemDiscountId] = React.useState<string | null>(null);
  const isSubmittingRef = React.useRef(false);

  // Aksesibilitas keyboard: Tombol Escape untuk menutup modal konfirmasi atau struk
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.isConfirmOpen) {
          dispatch({ type: "CLOSE_CONFIRM" });
        } else if (state.completedSale) {
          dispatch({ type: "RESET_NEW_TRANSACTION" });
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [state.isConfirmOpen, state.completedSale]);

  // Sinkronisasi data stok terkini dari storeState ke dalam keranjang
  const products = storeState.products;

  // Kategori unik dari produk yang tersedia
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter produk berdasarkan pencarian teks dan kategori aktif
  const filteredProducts = React.useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat =
        state.selectedCategory === "ALL" || p.category === state.selectedCategory;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [products, state.searchQuery, state.selectedCategory]);

  // Perhitungan ringkasan keuangan keranjang kasir
  const summary = React.useMemo(
    () =>
      calculateCartSummary(
        state.cart,
        state.transactionDiscount,
        state.paymentMethod,
        state.cashReceived
      ),
    [state.cart, state.transactionDiscount, state.paymentMethod, state.cashReceived]
  );

  // Opsi uang tunai cepat
  const quickCashOptions = React.useMemo(
    () => getQuickCashOptions(summary.totalAmount),
    [summary.totalAmount]
  );

  // Eksekusi transaksi penjualan menggunakan Transaction Engine Batch 1
  const handleProcessCheckout = React.useCallback(async () => {
    // Perlindungan klik ganda (double-click prevention: state flag & synchronous ref mutex)
    if (isSubmittingRef.current || state.isSubmitting) return;

    if (state.cart.length === 0) {
      dispatch({ type: "SUBMIT_FAILURE", message: "Keranjang belanja masih kosong." });
      return;
    }

    // Pra-validasi ketersediaan stok terkini sebelum memanggil engine
    const stockShortfallItem = state.cart.find((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      return p ? item.quantity > p.stockQuantity : false;
    });

    if (stockShortfallItem) {
      const p = products.find((prod) => prod.id === stockShortfallItem.productId);
      dispatch({
        type: "SUBMIT_FAILURE",
        message: `Kuantitas produk "${stockShortfallItem.name}" (${stockShortfallItem.quantity}) melebihi stok yang tersedia (${p?.stockQuantity ?? 0}).`,
      });
      return;
    }

    if (state.paymentMethod === "CASH" && summary.cashShortfall > 0) {
      dispatch({
        type: "SUBMIT_FAILURE",
        message: `Uang tunai yang diserahkan kurang ${formatRupiah(summary.cashShortfall)}.`,
      });
      return;
    }

    isSubmittingRef.current = true;
    dispatch({ type: "START_SUBMITTING" });

    // Susun input sesuai kontrak RecordDemoSaleInput
    const salePayload: RecordDemoSaleInput = {
      items: state.cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        itemDiscount: item.itemDiscount > 0 ? item.itemDiscount : undefined,
      })),
      paymentMethod: state.paymentMethod,
      transactionDiscount:
        summary.transactionDiscount > 0 ? summary.transactionDiscount : undefined,
      notes: state.notes.trim() || undefined,
      cashReceived: state.paymentMethod === "CASH" ? summary.cashReceived : undefined,
    };

    try {
      const result = demoStoreService.recordSale(salePayload);

      if (result.success) {
        dispatch({ type: "SUBMIT_SUCCESS", sale: result.data });
      } else {
        dispatch({
          type: "SUBMIT_FAILURE",
          message: result.error.message || "Gagal memproses transaksi kasir.",
        });
      }
    } catch (err) {
      dispatch({
        type: "SUBMIT_FAILURE",
        message:
          (err as Error).message || "Terjadi kesalahan internal saat menyimpan transaksi.",
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }, [state.isSubmitting, state.cart, state.paymentMethod, state.notes, summary, products]);

  return (
    <DemoLayout
      title="Kasir POS Mode Demo"
      currentPath="/demo/sales"
      className="bg-[#FAF9F6]"
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
        {/* Banner Navigasi dan Breadcrumb POS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E7E3EC]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5B3CC4] bg-[#F6F3FF] px-2.5 py-0.5 rounded-full border border-[#EAE4FF]">
                Point of Sale (POS)
              </span>
              <span className="text-xs text-[#716D7A]">
                Toko: <strong className="text-[#25232B]">{storeState.business.name}</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#25232B] mt-1 tracking-tight">
              Kasir Penjualan Langsung
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/demo/dashboard">
              <Button variant="outline" size="sm" className="text-xs h-9">
                ← Kembali ke Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Notifikasi Error Transaksi (jika ada) */}
        {state.errorMessage && (
          <Alert
            variant="danger"
            title="Transaksi Tidak Dapat Dilanjutkan"
            className="animate-in fade-in"
          >
            <div className="flex items-center justify-between gap-4">
              <span>{state.errorMessage}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: "SUBMIT_FAILURE", message: "" })}
                className="text-[#922B21] hover:text-[#C0392B] text-xs underline font-semibold shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </Alert>
        )}

        {/* Tab Toggle Khusus Mobile (< lg) */}
        <div className="lg:hidden flex items-center bg-[#F0EDF5] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_MOBILE_TAB", tab: "CATALOG" })}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer",
              state.activeMobileTab === "CATALOG"
                ? "bg-white text-[#5B3CC4] shadow-sm"
                : "text-[#716D7A] hover:text-[#25232B]"
            )}
            aria-pressed={state.activeMobileTab === "CATALOG"}
          >
            <Package className="w-4 h-4" aria-hidden="true" />
            <span>Katalog ({filteredProducts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_MOBILE_TAB", tab: "CART" })}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer",
              state.activeMobileTab === "CART"
                ? "bg-white text-[#5B3CC4] shadow-sm"
                : "text-[#716D7A] hover:text-[#25232B]"
            )}
            aria-pressed={state.activeMobileTab === "CART"}
          >
            <ShoppingCart className="w-4 h-4" aria-hidden="true" />
            <span>Keranjang</span>
            {summary.itemsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#5B3CC4] text-white font-mono">
                {summary.itemsCount}
              </span>
            )}
          </button>
        </div>

        {/* Tata Letak Dua Kolom Responsif */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================================================================= */}
          {/* KOLOM KIRI: KATALOG PRODUK & PENCARIAN (lg:col-span-7 xl:col-span-8) */}
          {/* ================================================================= */}
          <div
            className={cn(
              "space-y-4 lg:col-span-7 xl:col-span-8",
              state.activeMobileTab === "CART" ? "hidden lg:block" : "block"
            )}
          >
            {/* Bar Pencarian & Filter Kategori */}
            <Card className="border-[#E7E3EC] shadow-xs">
              <CardContent className="p-4 sm:p-5 space-y-3.5">
                {/* Search Input */}
                <div className="relative">
                  <Input
                    type="search"
                    id="product-search-input"
                    placeholder="Cari produk berdasarkan nama, SKU, atau kategori..."
                    value={state.searchQuery}
                    onChange={(e) =>
                      dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })
                    }
                    leftIcon={<Search className="w-4 h-4" aria-hidden="true" />}
                    className="pr-10"
                  />
                  {state.searchQuery && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "SET_SEARCH_QUERY", query: "" })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716D7A] hover:text-[#25232B] p-1"
                      aria-label="Bersihkan pencarian"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Kategori Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SET_CATEGORY", category: "ALL" })}
                    className={cn(
                      "px-3 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer min-h-[36px]",
                      state.selectedCategory === "ALL"
                        ? "bg-[#5B3CC4] text-white"
                        : "bg-[#F0EDF5] text-[#716D7A] hover:bg-[#E7E3EC] hover:text-[#25232B]"
                    )}
                  >
                    Semua Kategori ({products.length})
                  </button>
                  {categories.map((cat) => {
                    const count = products.filter((p) => p.category === cat).length;
                    const isSelected = state.selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => dispatch({ type: "SET_CATEGORY", category: cat })}
                        className={cn(
                          "px-3 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer min-h-[36px]",
                          isSelected
                            ? "bg-[#5B3CC4] text-white"
                            : "bg-[#F0EDF5] text-[#716D7A] hover:bg-[#E7E3EC] hover:text-[#25232B]"
                        )}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Grid Kartu Produk */}
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={<Search className="w-6 h-6 text-[#716D7A]" aria-hidden="true" />}
                title="Produk Tidak Ditemukan"
                description={`Tidak ada produk yang cocok dengan "${state.searchQuery}" pada kategori yang dipilih.`}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      dispatch({ type: "SET_SEARCH_QUERY", query: "" });
                      dispatch({ type: "SET_CATEGORY", category: "ALL" });
                    }}
                  >
                    Reset Filter Pencarian
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredProducts.map((product) => {
                  const cartItem = state.cart.find((i) => i.productId === product.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;
                  const isOutOfStock = product.stockQuantity <= 0;
                  const isArchived = Boolean(product.isArchived);
                  const isLowStock =
                    !isOutOfStock && product.stockQuantity <= product.minStockAlert;
                  const isDisabled = isOutOfStock || isArchived;
                  const isMaxedInCart = inCartQty >= product.stockQuantity;

                  return (
                    <Card
                      key={product.id}
                      className={cn(
                        "relative flex flex-col justify-between border transition-all duration-150 rounded-xl overflow-hidden text-left tile-touch",
                        isDisabled
                          ? "bg-[#FAF9FB] border-[#E5E1EC] opacity-65"
                          : inCartQty > 0
                          ? "border-[#5B3CC4] bg-[#FDFDFF] shadow-xs"
                          : "border-[#E5E1EC] hover:border-[#5B3CC4]/60 hover:shadow-xs bg-white"
                      )}
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                        <div className="space-y-1.5">
                          {/* Kategori & Status Stok */}
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#767182] block truncate max-w-[120px]">
                              {product.category}
                            </span>
                            {isArchived ? (
                              <Badge variant="outline" className="text-[10px] text-[#767182]">
                                Diarsipkan
                              </Badge>
                            ) : isOutOfStock ? (
                              <Badge variant="danger" className="text-[10px]">
                                Habis
                              </Badge>
                            ) : isLowStock ? (
                              <Badge variant="warning" className="text-[10px]">
                                Sisa {product.stockQuantity} {product.unit}
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EBF8F2] text-[#0D894F] border border-[#A6E7C7] shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0D894F]" />
                                <span>Stok: {product.stockQuantity}</span>
                              </span>
                            )}
                          </div>

                          {/* Nama Produk & SKU */}
                          <div>
                            <h4
                              className="font-bold text-[#1A1820] text-sm leading-snug line-clamp-2"
                              title={product.name}
                            >
                              {product.name}
                            </h4>
                            <p className="text-[11px] font-mono text-[#767182] mt-0.5">
                              {product.sku}
                            </p>
                          </div>
                        </div>

                        {/* Harga & Tombol Tambah ke Keranjang */}
                        <div className="pt-2 border-t border-[#F0EDF5] flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-[#767182] block leading-none uppercase font-semibold">Harga</span>
                            <span className="text-base font-bold text-[#1A1820] font-mono tabular-nums">
                              {formatRupiah(product.price)}
                            </span>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            disabled={isDisabled || isMaxedInCart}
                            variant={inCartQty > 0 ? "secondary" : "primary"}
                            onClick={() => dispatch({ type: "ADD_TO_CART", product })}
                            className={cn(
                              "text-xs px-3 h-9 shrink-0",
                              inCartQty > 0 && "font-bold"
                            )}
                            aria-label={`Tambah ${product.name} ke keranjang`}
                          >
                            {isDisabled ? (
                              "Habis"
                            ) : isMaxedInCart ? (
                              "Maks"
                            ) : inCartQty > 0 ? (
                              <>
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>+{inCartQty}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Pilih</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* KOLOM KANAN: PANEL KERANJANG & CHECKOUT (lg:col-span-5 xl:col-span-4) */}
          {/* ================================================================= */}
          <div
            className={cn(
              "space-y-4 lg:col-span-5 xl:col-span-4",
              state.activeMobileTab === "CATALOG" ? "hidden lg:block" : "block"
            )}
          >
            <Card className="border border-[#E5E1EC] bg-white shadow-xs rounded-xl overflow-hidden sticky top-4">
              {/* Header Keranjang */}
              <CardHeader className="p-4 sm:p-5 pb-3 bg-[#FAF9F6] border-b border-[#E5E1EC] flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F4F0FD] text-[#5B3CC4] flex items-center justify-center border border-[#E7E0FA]">
                    <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold text-[#1A1820]">
                      Keranjang Kasir
                    </CardTitle>
                    <p className="text-xs text-[#767182]">
                      {summary.itemsCount} total item ({state.cart.length} produk)
                    </p>
                  </div>
                </div>

                {state.cart.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: "CLEAR_CART" })}
                    className="text-xs font-semibold text-[#C0392B] hover:text-[#922B21] hover:bg-[#FDEDEC] h-8 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    Kosongkan
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-5">
                {/* Daftar Item Keranjang */}
                {state.cart.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#FAF9F6] border border-[#E5E1EC] text-[#767182] mx-auto flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 opacity-40" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1A1820]">
                        Keranjang Belanja Kosong
                      </h4>
                      <p className="text-xs text-[#767182] max-w-[240px] mx-auto mt-1">
                        Pilih produk dari katalog di sebelah kiri untuk memulai transaksi baru.
                      </p>
                    </div>
                    {/* Tombol kembali ke katalog untuk layar kecil */}
                    <div className="lg:hidden pt-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => dispatch({ type: "SET_MOBILE_TAB", tab: "CATALOG" })}
                      >
                        Lihat Katalog Produk
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {state.cart.map((item) => {
                      const liveProduct = products.find((p) => p.id === item.productId);
                      const currentStock = liveProduct ? liveProduct.stockQuantity : item.availableStock;
                      const lineGross = item.quantity * item.unitPrice;
                      const lineSubtotal = lineGross - item.itemDiscount;
                      const isDiscountOpen = activeItemDiscountId === item.productId;

                      return (
                        <div
                          key={item.productId}
                          className="p-3 rounded-lg border border-[#E5E1EC] bg-[#FAF9F6]/80 hover:border-[#D5CFE0] transition-colors space-y-2.5"
                        >
                          {/* Nama Produk & Tombol Hapus */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-[#1A1820] truncate leading-tight">
                                {item.name}
                              </h5>
                              <p className="text-[11px] text-[#767182] font-mono mt-0.5">
                                {formatRupiah(item.unitPrice)} / {item.unit}
                              </p>
                              {item.quantity > currentStock && (
                                <p className="text-[10px] text-[#C0392B] font-semibold mt-0.5">
                                  Melebihi stok tersedia ({currentStock})
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                dispatch({ type: "REMOVE_ITEM", productId: item.productId })
                              }
                              className="text-[#767182] hover:text-[#C0392B] p-1 -mr-1 rounded hover:bg-white transition-colors cursor-pointer"
                              aria-label={`Hapus ${item.name} dari keranjang`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Stepper Kuantitas & Subtotal Baris */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F0EDF5]">
                            {/* Stepper Qty */}
                            <div className="flex items-center border border-[#E5E1EC] rounded-lg overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                disabled={item.quantity <= 1}
                                onClick={() =>
                                  dispatch({
                                    type: "UPDATE_QUANTITY",
                                    productId: item.productId,
                                    quantity: item.quantity - 1,
                                  })
                                }
                                className="w-8 h-8 flex items-center justify-center text-[#1A1820] hover:bg-[#F4F0FD] hover:text-[#5B3CC4] active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                                aria-label="Kurangi kuantitas"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={currentStock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) {
                                    dispatch({
                                      type: "UPDATE_QUANTITY",
                                      productId: item.productId,
                                      quantity: val,
                                    });
                                  }
                                }}
                                className="w-11 h-8 text-center text-xs font-bold font-mono bg-white text-[#1A1820] border-x border-[#E5E1EC] focus:outline-none"
                                aria-label={`Kuantitas ${item.name}`}
                              />
                              <button
                                type="button"
                                disabled={item.quantity >= currentStock}
                                onClick={() =>
                                  dispatch({
                                    type: "UPDATE_QUANTITY",
                                    productId: item.productId,
                                    quantity: item.quantity + 1,
                                  })
                                }
                                className="w-8 h-8 flex items-center justify-center text-[#1A1820] hover:bg-[#F4F0FD] hover:text-[#5B3CC4] active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                                aria-label="Tambah kuantitas"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Subtotal Baris */}
                            <div className="text-right">
                              <span className="text-xs font-bold text-[#1A1820] font-mono tabular-nums block">
                                {formatRupiah(lineSubtotal)}
                              </span>
                              {item.itemDiscount > 0 && (
                                <span className="text-[10px] text-[#0D894F] font-mono block">
                                  Hemat {formatRupiah(item.itemDiscount)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tombol Toggle Diskon Item */}
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveItemDiscountId(
                                  isDiscountOpen ? null : item.productId
                                )
                              }
                              className="text-[11px] font-semibold text-[#5B3CC4] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Tag className="w-3 h-3" />
                              <span>
                                {item.itemDiscount > 0
                                  ? `Diskon Item: ${formatRupiah(item.itemDiscount)}`
                                  : "+ Tambah Diskon Item"}
                              </span>
                            </button>

                            {/* Input Diskon Item (bisa disembunyikan/ditampilkan) */}
                            {isDiscountOpen && (
                              <div className="mt-2 p-2 rounded-lg bg-white border border-[#E5E1EC] flex items-center gap-2">
                                <label
                                  htmlFor={`discount-${item.productId}`}
                                  className="text-[11px] font-semibold text-[#1A1820] shrink-0"
                                >
                                  Diskon (Rp):
                                </label>
                                <input
                                  type="number"
                                  id={`discount-${item.productId}`}
                                  min={0}
                                  max={lineGross}
                                  step={500}
                                  value={item.itemDiscount || ""}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    dispatch({
                                      type: "SET_ITEM_DISCOUNT",
                                      productId: item.productId,
                                      discount: isNaN(val) ? 0 : val,
                                    });
                                  }}
                                  className="w-full text-xs px-2 py-1 bg-white border border-[#E5E1EC] rounded font-mono text-[#1A1820] focus:outline-none focus:ring-1 focus:ring-[#5B3CC4]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setActiveItemDiscountId(null)}
                                  className="text-xs text-[#767182] hover:text-[#1A1820] px-1"
                                >
                                  Tutup
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Seksi Ringkasan Finansial & Diskon Transaksi (Hanya jika ada item) */}
                {state.cart.length > 0 && (
                  <div className="pt-4 border-t border-[#E5E1EC] space-y-3">
                    {/* Diskon Transaksi Global */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label
                          htmlFor="transaction-discount-input"
                          className="font-semibold text-[#1A1820] flex items-center gap-1"
                        >
                          <Tag className="w-3.5 h-3.5 text-[#5B3CC4]" />
                          <span>Diskon Transaksi (Rp)</span>
                        </label>
                        <span className="text-[11px] text-[#767182]">
                          Maks: {formatRupiah(summary.grossSubtotal)}
                        </span>
                      </div>
                      <input
                        type="number"
                        id="transaction-discount-input"
                        min={0}
                        max={summary.grossSubtotal}
                        step={1000}
                        value={state.transactionDiscount || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          dispatch({
                            type: "SET_TRANSACTION_DISCOUNT",
                            discount: isNaN(val) ? 0 : val,
                          });
                        }}
                        className="w-full text-xs px-3 py-2 bg-white border border-[#E5E1EC] rounded-md font-mono text-[#1A1820] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4]"
                      />
                    </div>

                    {/* Breakdown Rincian Finansial */}
                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5E1EC] space-y-2 text-xs">
                      <div className="flex justify-between text-[#767182]">
                        <span>Subtotal Kotor</span>
                        <span className="font-mono">{formatRupiah(summary.grossTotal)}</span>
                      </div>

                      {summary.itemDiscountsTotal > 0 && (
                        <div className="flex justify-between text-[#0D894F]">
                          <span>Diskon Item</span>
                          <span className="font-mono">
                            -{formatRupiah(summary.itemDiscountsTotal)}
                          </span>
                        </div>
                      )}

                      {summary.transactionDiscount > 0 && (
                        <div className="flex justify-between text-[#0D894F]">
                          <span>Diskon Transaksi</span>
                          <span className="font-mono">
                            -{formatRupiah(summary.transactionDiscount)}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#E5E1EC] flex justify-between items-baseline font-bold text-sm text-[#1A1820]">
                        <span>Total Tagihan</span>
                        <span className="text-xl text-[#5B3CC4] font-mono tabular-nums">
                          {formatRupiah(summary.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Pemilihan Metode Pembayaran */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-semibold text-[#1A1820]">
                        Metode Pembayaran
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({ type: "SET_PAYMENT_METHOD", method: "CASH" })
                          }
                          className={cn(
                            "py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer active:scale-[0.98]",
                            state.paymentMethod === "CASH"
                              ? "bg-[#F4F0FD] border-[#5B3CC4] text-[#5B3CC4] ring-1 ring-[#5B3CC4]/20 shadow-2xs"
                              : "bg-white border-[#E5E1EC] text-[#767182] hover:bg-[#FAF9F6] hover:text-[#1A1820]"
                          )}
                          aria-pressed={state.paymentMethod === "CASH"}
                        >
                          <Banknote className="w-4 h-4" />
                          <span>Tunai (CASH)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            dispatch({ type: "SET_PAYMENT_METHOD", method: "BANK_TRANSFER" })
                          }
                          className={cn(
                            "py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer active:scale-[0.98]",
                            state.paymentMethod === "BANK_TRANSFER"
                              ? "bg-[#F4F0FD] border-[#5B3CC4] text-[#5B3CC4] ring-1 ring-[#5B3CC4]/20 shadow-2xs"
                              : "bg-white border-[#E5E1EC] text-[#767182] hover:bg-[#FAF9F6] hover:text-[#1A1820]"
                          )}
                          aria-pressed={state.paymentMethod === "BANK_TRANSFER"}
                        >
                          <Building2 className="w-4 h-4" />
                          <span>Transfer Bank</span>
                        </button>
                      </div>
                    </div>

                    {/* Khusus Pembayaran TUNAI: Input Uang Diterima & Tombol Cepat */}
                    {state.paymentMethod === "CASH" && (
                      <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5E1EC] space-y-2.5 animate-in fade-in">
                        <div className="space-y-1">
                          <label
                            htmlFor="cash-received-input"
                            className="block text-xs font-semibold text-[#1A1820]"
                          >
                            Uang Tunai Diterima (Rp)
                          </label>
                          <input
                            type="number"
                            id="cash-received-input"
                            min={0}
                            step={1000}
                            value={state.cashReceived || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              dispatch({
                                type: "SET_CASH_RECEIVED",
                                amount: isNaN(val) ? 0 : val,
                              });
                            }}
                            className={cn(
                              "w-full text-sm font-bold font-mono px-3 py-2 bg-white border rounded-md focus:outline-none focus:ring-2",
                              !summary.isCashSufficient && state.cashReceived > 0
                                ? "border-[#C0392B] focus:ring-[#C0392B]"
                                : "border-[#E5E1EC] focus:ring-[#5B3CC4]"
                            )}
                          />
                        </div>

                        {/* Tombol Pecahan Uang Cepat */}
                        <div className="flex flex-wrap gap-1.5">
                          {quickCashOptions.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                dispatch({ type: "SET_CASH_RECEIVED", amount: opt })
                              }
                              className={cn(
                                "text-[11px] px-2.5 py-1 rounded-md font-mono font-semibold border transition-all cursor-pointer shadow-2xs active:scale-95",
                                state.cashReceived === opt
                                  ? "bg-[#5B3CC4] text-white border-[#5B3CC4]"
                                  : "bg-white text-[#1A1820] border-[#E5E1EC] hover:bg-[#F4F0FD] hover:border-[#5B3CC4] hover:text-[#5B3CC4]"
                              )}
                            >
                              {opt === summary.totalAmount ? "Uang Pas" : formatRupiah(opt)}
                            </button>
                          ))}
                        </div>

                        {/* Tampilan Kembalian / Uang Kurang */}
                        <div className="pt-2 border-t border-[#E5E1EC]">
                          {state.cashReceived === 0 ? (
                            <p className="text-[11px] text-[#767182]">
                              Masukkan nominal uang tunai yang diserahkan pelanggan.
                            </p>
                          ) : summary.isCashSufficient ? (
                            <div className="flex justify-between items-center text-xs text-[#0D894F] bg-[#EBF8F2] p-2.5 rounded-lg border border-[#A6E7C7]">
                              <span className="font-semibold">Kembalian:</span>
                              <span className="font-bold text-sm font-mono tabular-nums">
                                {formatRupiah(summary.cashChange)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center text-xs text-[#C0392B] bg-[#FDF2F1] p-2.5 rounded-lg border border-[#F8C8C4]">
                              <span className="font-semibold">Uang Kurang:</span>
                              <span className="font-bold font-mono tabular-nums">
                                {formatRupiah(summary.cashShortfall)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Khusus Pembayaran TRANSFER BANK: Keterangan Lunas Otomatis */}
                    {state.paymentMethod === "BANK_TRANSFER" && (
                      <div className="p-3.5 rounded-xl bg-[#F4F0FD] border border-[#E7E0FA] text-[#392477] text-xs space-y-1 animate-in fade-in">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Building2 className="w-4 h-4 shrink-0 text-[#5B3CC4]" />
                          <span>Transfer Bank (Simulasi)</span>
                        </div>
                        <p className="text-[11px] opacity-90 leading-relaxed">
                          Transaksi akan langsung tercatat lunas penuh tanpa memerlukan input
                          uang tunai atau kembalian.
                        </p>
                      </div>
                    )}

                    {/* Catatan Transaksi Opsional */}
                    <div className="space-y-1">
                      <label
                        htmlFor="pos-notes-input"
                        className="block text-xs font-semibold text-[#1A1820]"
                      >
                        Catatan Transaksi (Opsional)
                      </label>
                      <input
                        type="text"
                        id="pos-notes-input"
                        placeholder="Contoh: Titipan tetangga, kemasan kardus..."
                        value={state.notes}
                        onChange={(e) =>
                          dispatch({ type: "SET_NOTES", notes: e.target.value })
                        }
                        className="w-full text-xs px-3 py-2 bg-white border border-[#E5E1EC] rounded-md text-[#1A1820] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4]"
                      />
                    </div>

                    {/* Tombol Utama: Proses Checkout */}
                    <div className="pt-2">
                      <Button
                        type="button"
                        id="process-checkout-button"
                        variant="primary"
                        size="lg"
                        className="w-full font-bold shadow-sm h-12 text-sm"
                        disabled={!summary.canCheckout || state.isSubmitting}
                        isLoading={state.isSubmitting}
                        onClick={() => dispatch({ type: "OPEN_CONFIRM" })}
                      >
                        {state.isSubmitting
                          ? "Memproses Transaksi..."
                          : `Bayar ${formatRupiah(summary.totalAmount)}`}
                      </Button>
                      {!summary.canCheckout && state.cart.length > 0 && (
                        <p className="text-[11px] text-center text-[#C0392B] mt-1.5">
                          {state.paymentMethod === "CASH" && !summary.isCashSufficient
                            ? "Uang tunai kurang dari total tagihan."
                            : "Lengkapi data untuk memproses transaksi."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL KONFIRMASI CHECKOUT KASIR */}
        {/* ================================================================= */}
        {state.isConfirmOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E3EC] space-y-5 animate-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="confirm-modal-title"
                      className="text-base font-bold text-[#25232B]"
                    >
                      Konfirmasi Transaksi
                    </h3>
                    <p className="text-xs text-[#716D7A]">
                      Periksa rincian sebelum menyelesaikan transaksi.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "CLOSE_CONFIRM" })}
                  className="text-[#716D7A] hover:text-[#25232B] p-1 rounded-md"
                  aria-label="Tutup dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rincian Singkat Transaksi */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E7E3EC] space-y-2 text-xs">
                <div className="flex justify-between text-[#716D7A]">
                  <span>Jumlah Item:</span>
                  <span className="font-bold text-[#25232B]">{summary.itemsCount} item</span>
                </div>
                <div className="flex justify-between text-[#716D7A]">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold text-[#25232B]">
                    {state.paymentMethod === "CASH" ? "Tunai (CASH)" : "Transfer Bank"}
                  </span>
                </div>
                {state.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between text-[#716D7A]">
                      <span>Uang Diterima:</span>
                      <span className="font-mono">{formatRupiah(summary.cashReceived)}</span>
                    </div>
                    <div className="flex justify-between text-[#0E6251]">
                      <span className="font-semibold">Kembalian:</span>
                      <span className="font-mono font-bold">
                        {formatRupiah(summary.cashChange)}
                      </span>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t border-[#E7E3EC] flex justify-between items-baseline font-bold text-sm text-[#25232B]">
                  <span>Total Tagihan:</span>
                  <span className="text-base text-[#5B3CC4] font-mono">
                    {formatRupiah(summary.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Aksi Konfirmasi */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={state.isSubmitting}
                  onClick={() => dispatch({ type: "CLOSE_CONFIRM" })}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 font-bold"
                  disabled={state.isSubmitting}
                  isLoading={state.isSubmitting}
                  onClick={handleProcessCheckout}
                >
                  Selesaikan Transaksi
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL STRUK TRANSAKSI SUKSES */}
        {/* ================================================================= */}
        {state.completedSale && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-receipt-title"
          >
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E3EC] space-y-5 my-8 animate-in zoom-in-95 text-left">
              {/* Header Sukses */}
              <div className="text-center space-y-1.5 pb-3 border-b border-[#E7E3EC]">
                <div className="w-12 h-12 rounded-full bg-[#E8F8F0] text-[#1E824C] mx-auto flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                </div>
                <h3
                  id="success-receipt-title"
                  className="text-lg font-bold text-[#25232B]"
                >
                  Transaksi Berhasil Disimpan
                </h3>
                <p className="text-xs text-[#716D7A]">
                  Stok barang telah dipotong dan transaksi tercatat pada toko simulasi.
                </p>
              </div>

              {/* Faktur dan Metadata Toko */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E7E3EC] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">Toko:</span>
                  <span className="font-bold text-[#25232B]">
                    {storeState.business.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">No. Faktur (Invoice):</span>
                  <span className="font-mono font-bold text-[#5B3CC4] bg-[#F6F3FF] px-2 py-0.5 rounded border border-[#EAE4FF]">
                    {state.completedSale.invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">Waktu:</span>
                  <span className="text-[#25232B]">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(state.completedSale.transactionDate))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#716D7A]">Metode Pembayaran:</span>
                  <span className="font-bold text-[#25232B]">
                    {state.completedSale.paymentMethod === "CASH"
                      ? "Tunai (CASH)"
                      : "Transfer Bank"}
                  </span>
                </div>
              </div>

              {/* Tabel Rincian Belanja */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-[#25232B] uppercase tracking-wider">
                  Daftar Barang Belanja
                </h5>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {state.completedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start py-1 border-b border-[#F0EDF5]"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-[#25232B] truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-[#716D7A] font-mono">
                          {item.quantity} x {formatRupiah(item.unitPrice)}
                          {item.itemDiscount && item.itemDiscount > 0 ? (
                            <span className="text-[#1E824C] ml-1">
                              (-{formatRupiah(item.itemDiscount)})
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="font-bold font-mono text-[#25232B] shrink-0">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rincian Finansial Akhir */}
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E7E3EC] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#716D7A]">
                  <span>Subtotal Kotor</span>
                  <span className="font-mono">{formatRupiah(state.completedSale.subtotal)}</span>
                </div>
                {state.completedSale.discount > 0 && (
                  <div className="flex justify-between text-[#1E824C]">
                    <span>Diskon Transaksi</span>
                    <span className="font-mono">
                      -{formatRupiah(state.completedSale.discount)}
                    </span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-[#E7E3EC] flex justify-between font-bold text-sm text-[#25232B]">
                  <span>Total Tagihan</span>
                  <span className="text-base text-[#5B3CC4] font-mono">
                    {formatRupiah(state.completedSale.totalAmount)}
                  </span>
                </div>
                {state.completedSale.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between text-[#716D7A] pt-1">
                      <span>Uang Diterima</span>
                      <span className="font-mono">
                        {formatRupiah(state.completedSale.cashReceived || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#0E6251] font-bold">
                      <span>Kembalian</span>
                      <span className="font-mono">
                        {formatRupiah(state.completedSale.cashChange || 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Catatan Transaksi (jika ada) */}
              {state.completedSale.notes && (
                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E7E3EC] text-xs">
                  <span className="font-semibold text-[#716D7A] block">Catatan:</span>
                  <span className="text-[#25232B]">{state.completedSale.notes}</span>
                </div>
              )}

              {/* Aksi Pasca-Transaksi */}
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full font-bold h-11"
                  onClick={() => dispatch({ type: "RESET_NEW_TRANSACTION" })}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Transaksi Baru
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => {
                      if (typeof window !== "undefined" && typeof window.print === "function") {
                        window.print();
                      }
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Cetak Struk
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => dispatch({ type: "RESET_NEW_TRANSACTION" })}
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoLayout>
  );
}
