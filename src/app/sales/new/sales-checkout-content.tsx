"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle2,
  Banknote,
  Building2,
  Tag,
  RotateCcw,
  PackageOpen,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createSaleAction,
  getProductsForTransactionAction,
} from "@/app/actions/transactions";
import type {
  ProductItemResponse,
  SaleReceiptResponse,
} from "@/types/api";
import type { PaymentMethod } from "@/types/database";
import { formatRupiah, cn } from "@/lib/utils";

export interface CartItem {
  productId: string;
  productName: string;
  sku: string | null;
  category: string | null;
  sellingPrice: number;
  stockQuantity: number;
  quantity: number;
  itemDiscount: number;
}

export function SalesCheckoutContent({
  initialProducts,
}: {
  initialProducts?: ProductItemResponse[];
}) {
  // 1. Data Katalog Produk
  const [activeProducts, setActiveProducts] = React.useState<ProductItemResponse[]>(
    initialProducts || []
  );
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(!initialProducts);
  const [productLoadError, setProductLoadError] = React.useState<string | null>(null);

  // 2. Filter & Pencarian
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");

  // 3. State Keranjang Kasir POS
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);
  const [transactionDiscount, setTransactionDiscount] = React.useState<number>(0);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("CASH");
  const [cashReceivedInput, setCashReceivedInput] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [expandedDiscountItemId, setExpandedDiscountItemId] = React.useState<string | null>(null);

  // 4. Idempotency Key — Dihasilkan 1x per sesi keranjang & dipertahankan saat retry
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  });

  // 5. State Transaksi & Submission
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isNetworkRetryable, setIsNetworkRetryable] = React.useState(false);
  const [saleReceipt, setSaleReceipt] = React.useState<SaleReceiptResponse | null>(null);
  const [recordedCashReceived, setRecordedCashReceived] = React.useState<number | null>(null);

  // Fungsi helper untuk memuat produk aktif (dipanggil saat event manual: retry / reset)
  const loadProducts = React.useCallback(async () => {
    setIsLoadingProducts(true);
    setProductLoadError(null);
    try {
      const response = await getProductsForTransactionAction();
      if (!response.success) {
        setProductLoadError(
          response.error?.message || "Gagal memuat katalog produk aktif dari server."
        );
        return;
      }
      setActiveProducts(response.data || []);
    } catch {
      setProductLoadError("Terjadi kegagalan jaringan saat menghubungi server.");
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialProducts && initialProducts.length > 0) return;

    let isMounted = true;
    getProductsForTransactionAction()
      .then((response) => {
        if (!isMounted) return;
        if (!response.success) {
          setProductLoadError(
            response.error?.message || "Gagal memuat katalog produk aktif dari server."
          );
          return;
        }
        setActiveProducts(response.data || []);
      })
      .catch(() => {
        if (isMounted) {
          setProductLoadError("Terjadi kegagalan jaringan saat menghubungi server.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  // Daftar kategori unik untuk filter pill
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [activeProducts]);

  // Produk yang difilter pencarian dan kategori
  const filteredProducts = React.useMemo(() => {
    return activeProducts.filter((product) => {
      if (product.isArchived) return false;

      const matchesCategory =
        selectedCategory === "ALL" || product.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchName = product.name.toLowerCase().includes(q);
      const matchSku = product.sku ? product.sku.toLowerCase().includes(q) : false;
      return matchName || matchSku;
    });
  }, [activeProducts, searchQuery, selectedCategory]);

  // Kalkulasi Finansial Keranjang (Real-time Frontend Presentation)
  const financialSummary = React.useMemo(() => {
    let grossSubtotal = 0;
    let totalItemDiscounts = 0;

    cartItems.forEach((item) => {
      const lineGross = item.quantity * item.sellingPrice;
      const lineDiscount = Math.min(item.itemDiscount || 0, lineGross);
      grossSubtotal += lineGross;
      totalItemDiscounts += lineDiscount;
    });

    const netSubtotalBeforeTxDiscount = Math.max(0, grossSubtotal - totalItemDiscounts);
    const validTxDiscount = Math.min(
      Math.max(0, transactionDiscount || 0),
      netSubtotalBeforeTxDiscount
    );
    const totalAmount = netSubtotalBeforeTxDiscount - validTxDiscount;

    const parsedCash = parseInt(cashReceivedInput.replace(/\D/g, ""), 10);
    const numericCashReceived = isNaN(parsedCash) ? 0 : parsedCash;
    const cashChange = numericCashReceived >= totalAmount ? numericCashReceived - totalAmount : 0;
    const isCashSufficient = numericCashReceived >= totalAmount;

    return {
      grossSubtotal,
      totalItemDiscounts,
      netSubtotalBeforeTxDiscount,
      validTxDiscount,
      totalAmount,
      numericCashReceived,
      cashChange,
      isCashSufficient,
    };
  }, [cartItems, transactionDiscount, cashReceivedInput]);

  // Menambahkan produk ke keranjang
  const handleAddToCart = (product: ProductItemResponse) => {
    if (product.stockQuantity <= 0) return;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        // Jangan melampaui sisa stok fisik
        if (existing.quantity >= product.stockQuantity) {
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.category,
          sellingPrice: product.sellingPrice,
          stockQuantity: product.stockQuantity,
          quantity: 1,
          itemDiscount: 0,
        },
      ];
    });
  };

  // Mengubah kuantitas item di keranjang
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const targetQty = item.quantity + delta;
          if (targetQty <= 0) return null;
          // Batasi tidak boleh melebihi stok yang diketahui
          const boundedQty = Math.min(targetQty, item.stockQuantity);
          // Pastikan diskon per item tidak melebihi harga kotor baris baru
          const maxAllowedDiscount = boundedQty * item.sellingPrice;
          const adjustedDiscount = Math.min(item.itemDiscount, maxAllowedDiscount);
          return {
            ...item,
            quantity: boundedQty,
            itemDiscount: adjustedDiscount,
          };
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Mengubah kuantitas via input manual
  const handleSetExactQuantity = (productId: string, rawVal: string) => {
    const parsed = parseInt(rawVal.replace(/\D/g, ""), 10);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const validQty = isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, item.stockQuantity);
        const maxAllowedDiscount = validQty * item.sellingPrice;
        const adjustedDiscount = Math.min(item.itemDiscount, maxAllowedDiscount);
        return {
          ...item,
          quantity: validQty,
          itemDiscount: adjustedDiscount,
        };
      })
    );
  };

  // Menghapus item dari keranjang
  const handleRemoveFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Mengubah diskon per item
  const handleSetItemDiscount = (productId: string, rawVal: string) => {
    const parsed = parseInt(rawVal.replace(/\D/g, ""), 10);
    const discountVal = isNaN(parsed) || parsed < 0 ? 0 : parsed;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const maxAllowed = item.quantity * item.sellingPrice;
        return {
          ...item,
          itemDiscount: Math.min(discountVal, maxAllowed),
        };
      })
    );
  };

  // Reset keranjang dan buat transaksi baru
  const handleStartNewSale = () => {
    setCartItems([]);
    setTransactionDiscount(0);
    setPaymentMethod("CASH");
    setCashReceivedInput("");
    setNotes("");
    setSubmitError(null);
    setIsNetworkRetryable(false);
    setSaleReceipt(null);
    setRecordedCashReceived(null);

    // Hasilkan idempotency key BARU setelah transaksi selesai dikonfirmasi
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      setIdempotencyKey(crypto.randomUUID());
    } else {
      setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    }

    // Refresh katalog produk di background untuk mendapatkan stok terbaru
    loadProducts();
  };

  // Submit Transaksi Kasir POS
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0 || isSubmitting) return;

    // Validasi lokal sebelum memanggil Server Action
    for (const item of cartItems) {
      if (item.quantity <= 0) {
        setSubmitError(`Kuantitas produk "${item.productName}" harus lebih dari 0.`);
        return;
      }
      if (item.quantity > item.stockQuantity) {
        setSubmitError(
          `Kuantitas produk "${item.productName}" (${item.quantity}) melebihi stok yang tersedia (${item.stockQuantity}).`
        );
        return;
      }
      if (item.itemDiscount < 0 || item.itemDiscount > item.quantity * item.sellingPrice) {
        setSubmitError(`Diskon pada item "${item.productName}" melebihi harga kotor.`);
        return;
      }
    }

    if (
      financialSummary.validTxDiscount < 0 ||
      financialSummary.validTxDiscount > financialSummary.netSubtotalBeforeTxDiscount
    ) {
      setSubmitError("Diskon transaksi global melebihi subtotal yang diizinkan.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setIsNetworkRetryable(false);

    try {
      const payload = {
        idempotencyKey,
        paymentMethod,
        transactionDiscount: financialSummary.validTxDiscount,
        notes: notes.trim() ? notes.trim() : undefined,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          itemDiscount: item.itemDiscount > 0 ? item.itemDiscount : undefined,
        })),
      };

      const result = await createSaleAction(payload);

      if (!result.success) {
        setSubmitError(result.error?.message || "Gagal mencatat transaksi penjualan.");
        // Idempotency key TETAP DIPERTAHANKAN pada state untuk percobaan retry berikutnya
        setIsNetworkRetryable(true);
        return;
      }

      // Transaksi Berhasil!
      setSaleReceipt(result.data);
      if (paymentMethod === "CASH" && financialSummary.numericCashReceived > 0) {
        setRecordedCashReceived(financialSummary.numericCashReceived);
      }
    } catch {
      // Kesalahan jaringan tidak terduga: Pertahankan key dan keranjang untuk retry aman
      setSubmitError(
        "Koneksi terputus saat menghubungi server. Keranjang dan kunci transaksi Anda disimpan aman. Silakan klik 'Coba Lagi' untuk mengirim ulang tanpa duplikasi stok."
      );
      setIsNetworkRetryable(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // VIEW: STRUK NOTA PENJUALAN SUKSES
  // ==========================================================================
  if (saleReceipt) {
    const isCash = saleReceipt.paymentMethod === "CASH";
    const change =
      recordedCashReceived !== null && recordedCashReceived >= saleReceipt.totalAmount
        ? recordedCashReceived - saleReceipt.totalAmount
        : 0;

    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        <Card className="border-2 border-[#A3E4D7] bg-white shadow-xl overflow-hidden">
          <div className="bg-[#E8F8F0] p-6 border-b border-[#A3E4D7] text-center space-y-2">
            <div className="w-14 h-14 bg-[#27AE60] text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#0E6251]">Transaksi Penjualan Berhasil</h1>
            <p className="text-sm text-[#0E6251]/80">
              Stok produk telah terpotong secara atomik dan tersimpan di buku besar keuangan.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Header Struk */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-dashed border-[#E7E3EC] gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#716D7A] font-semibold">Nomor Invoice</p>
                <p className="text-xl font-mono font-bold text-[#5B3CC4]">{saleReceipt.invoiceNumber}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wider text-[#716D7A] font-semibold">Waktu Transaksi</p>
                <p className="text-sm text-[#25232B] font-medium">
                  {new Date(saleReceipt.transactionDate).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  WIB
                </p>
              </div>
            </div>

            {/* Rincian Transaksi */}
            <div className="space-y-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#716D7A]">Total Item Terjual</span>
                <span className="font-semibold text-[#25232B]">{saleReceipt.itemsCount} item</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#716D7A]">Subtotal Kotor</span>
                <span className="font-mono text-[#25232B]">{formatRupiah(saleReceipt.subtotalAmount)}</span>
              </div>
              {saleReceipt.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-[#C0392B]">
                  <span>Total Diskon Nota</span>
                  <span className="font-mono font-medium">-{formatRupiah(saleReceipt.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#716D7A]">Metode Pembayaran</span>
                <Badge variant={isCash ? "default" : "info"}>
                  {isCash ? "Tunai (CASH)" : "Transfer Bank"}
                </Badge>
              </div>

              <div className="pt-4 border-t border-[#E7E3EC] flex justify-between items-baseline">
                <span className="text-base font-bold text-[#25232B]">Total Bayar</span>
                <span className="text-2xl font-bold font-mono text-[#5B3CC4]">
                  {formatRupiah(saleReceipt.totalAmount)}
                </span>
              </div>

              {/* Rincian Uang Tunai & Kembalian */}
              {isCash && recordedCashReceived !== null && (
                <div className="pt-3 border-t border-dashed border-[#E7E3EC] space-y-2 bg-[#FAF9F6] p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#716D7A]">Uang Diterima</span>
                    <span className="font-mono text-[#25232B]">{formatRupiah(recordedCashReceived)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[#0E6251]">
                    <span>Kembalian</span>
                    <span className="font-mono">{formatRupiah(change)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Aksi Struk */}
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="lg"
                className="flex-1 font-semibold"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={handleStartNewSale}
              >
                + Transaksi Baru
              </Button>
              <Button
                variant="outline"
                size="lg"
                leftIcon={<Printer className="w-5 h-5" />}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.print();
                  }
                }}
              >
                Cetak Struk
              </Button>
              <Link href="/sales" className="flex-1">
                <Button variant="ghost" size="lg" className="w-full">
                  Lihat Riwayat Penjualan
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: ANTARMUKA KASIR CEPAT POS
  // ==========================================================================
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/sales">
            <Button variant="ghost" size="icon" aria-label="Kembali ke Riwayat Penjualan">
              <ArrowLeft className="w-5 h-5 text-[#716D7A]" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#25232B]">Kasir Cepat (POS)</h1>
            <p className="text-sm text-[#716D7A]">
              Pencatatan transaksi penjualan instan dengan pemotongan stok otomatis.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Idempotency Lock Active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={handleStartNewSale}
            disabled={cartItems.length === 0 && !searchQuery}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Alert Error Pengiriman / Jaringan */}
      {submitError && (
        <Alert variant="danger" title="Transaksi Tidak Tersimpan">
          <div className="space-y-2">
            <p>{submitError}</p>
            {isNetworkRetryable && (
              <div className="pt-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCheckoutSubmit}
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                >
                  Coba Lagi (Kirim Ulang)
                </Button>
              </div>
            )}
          </div>
        </Alert>
      )}

      {/* Grid Layout 2 Kolom Desktop: Kiri Katalog Produk, Kanan Keranjang */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================== */}
        {/* KOLOM KIRI (7/12): KATALOG PRODUK AKTIF */}
        {/* ================================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-[#E7E3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Kolom Pencarian */}
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#716D7A]" />
                <Input
                  type="text"
                  placeholder="Cari nama produk atau SKU barang... (Ketik untuk filter instan)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 min-h-[44px] text-base"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#716D7A] hover:text-[#25232B] px-2 py-1 bg-[#F0EDF5] rounded"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {/* Filter Kategori Pills */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("ALL")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                      selectedCategory === "ALL"
                        ? "bg-[#5B3CC4] text-white shadow-sm"
                        : "bg-[#F0EDF5] text-[#25232B] hover:bg-[#E7E3EC]"
                    )}
                  >
                    Semua Kategori
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                        selectedCategory === cat
                          ? "bg-[#5B3CC4] text-white shadow-sm"
                          : "bg-[#F0EDF5] text-[#25232B] hover:bg-[#E7E3EC]"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Area Konten Katalog: Loading, Error, Empty, atau Grid */}
          {isLoadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="p-4 space-y-3 border-[#E7E3EC]">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : productLoadError ? (
            <Alert variant="danger" title="Gagal Memuat Produk">
              <p className="mb-2">{productLoadError}</p>
              <Button variant="outline" size="sm" onClick={loadProducts}>
                Coba Muat Ulang
              </Button>
            </Alert>
          ) : activeProducts.length === 0 ? (
            <EmptyState
              title="Belum Ada Produk Tersedia"
              description="Anda belum memiliki produk aktif untuk dijual. Tambahkan produk ke katalog terlebih dahulu."
              action={
                <Link href="/products/new">
                  <Button variant="primary" size="md">
                    + Tambah Produk Baru
                  </Button>
                </Link>
              }
            />
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-[#E7E3EC] p-6 space-y-3">
              <PackageOpen className="w-10 h-10 text-[#716D7A] mx-auto opacity-60" />
              <p className="text-base font-semibold text-[#25232B]">
                Tidak ada produk yang cocok dengan pencarian
              </p>
              <p className="text-sm text-[#716D7A]">
                Coba gunakan kata kunci lain atau hapus filter kategori.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                }}
              >
                Reset Filter
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stockQuantity <= 0;
                const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;
                const existingInCart = cartItems.find((item) => item.productId === product.id);
                const isCartAtMaxStock =
                  existingInCart && existingInCart.quantity >= product.stockQuantity;

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      "border transition-all duration-150 flex flex-col justify-between",
                      isOutOfStock
                        ? "bg-[#F9F8FA] border-[#E7E3EC] opacity-70"
                        : "bg-white border-[#E7E3EC] hover:border-[#5B3CC4]/40 hover:shadow-md cursor-pointer"
                    )}
                    onClick={() => {
                      if (!isOutOfStock && !isCartAtMaxStock) {
                        handleAddToCart(product);
                      }
                    }}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="font-semibold text-sm sm:text-base text-[#25232B] truncate">
                            {product.name}
                          </h2>
                          {product.sku && (
                            <p className="text-xs text-[#716D7A] font-mono truncate">
                              SKU: {product.sku}
                            </p>
                          )}
                        </div>
                        {isOutOfStock ? (
                          <Badge variant="danger">Habis</Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning">Sisa {product.stockQuantity}</Badge>
                        ) : (
                          <Badge variant="success">Stok: {product.stockQuantity}</Badge>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-2 border-t border-[#F0EDF5]">
                        <span className="text-base sm:text-lg font-bold font-mono text-[#5B3CC4]">
                          {formatRupiah(product.sellingPrice)}
                        </span>
                        {existingInCart && (
                          <span className="text-xs font-semibold px-2 py-0.5 bg-[#F6F3FF] text-[#5B3CC4] rounded-full border border-[#EAE4FF]">
                            Di keranjang: {existingInCart.quantity}
                          </span>
                        )}
                      </div>
                    </CardContent>

                    <div className="px-4 pb-3 pt-0">
                      <Button
                        variant={isOutOfStock ? "outline" : "primary"}
                        size="sm"
                        className="w-full text-xs font-medium"
                        disabled={isOutOfStock || isCartAtMaxStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                      >
                        {isOutOfStock
                          ? "Stok Habis"
                          : isCartAtMaxStock
                          ? "Maksimal Stok Tercapai"
                          : "+ Tambah ke Keranjang"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* KOLOM KANAN (5/12): KERANJANG PENJUALAN & CHECKOUT */}
        {/* ================================================================== */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          <Card className="border-2 border-[#5B3CC4]/20 bg-white shadow-md">
            <CardHeader className="bg-[#FAF9F6] border-b border-[#E7E3EC] p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#5B3CC4]" />
                <CardTitle className="text-base font-bold text-[#25232B]">
                  Keranjang Penjualan
                </CardTitle>
                <Badge variant="default" className="text-xs">
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)} item
                </Badge>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-xs text-[#C0392B] hover:underline cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Daftar Item di Keranjang */}
              {cartItems.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <ShoppingCart className="w-10 h-10 text-[#716D7A] mx-auto opacity-30" />
                  <p className="text-sm font-medium text-[#716D7A]">Keranjang masih kosong</p>
                  <p className="text-xs text-[#716D7A]/80 max-w-[240px] mx-auto">
                    Klik produk di katalog sebelah kiri untuk mulai menambahkan ke transaksi kasir.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {cartItems.map((item) => {
                    const lineGross = item.quantity * item.sellingPrice;
                    const lineNet = Math.max(0, lineGross - (item.itemDiscount || 0));
                    const isDiscountExpanded = expandedDiscountItemId === item.productId;

                    return (
                      <div
                        key={item.productId}
                        className="p-3 rounded-lg border border-[#E7E3EC] bg-[#FAF9F6] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-[#25232B] truncate">
                              {item.productName}
                            </h4>
                            <p className="text-xs text-[#716D7A] font-mono">
                              {formatRupiah(item.sellingPrice)} / unit
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.productId)}
                            className="text-[#716D7A] hover:text-[#C0392B] p-1 transition-colors"
                            aria-label={`Hapus ${item.productName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Pengatur Kuantitas & Subtotal Baris */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center border border-[#E7E3EC] bg-white rounded-md shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.productId, -1)}
                              className="w-8 h-8 flex items-center justify-center text-[#25232B] hover:bg-[#F0EDF5] transition-colors rounded-l-md"
                              aria-label="Kurangi kuantitas"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              value={item.quantity}
                              onChange={(e) =>
                                handleSetExactQuantity(item.productId, e.target.value)
                              }
                              className="w-12 h-8 text-center text-xs font-semibold border-x border-[#E7E3EC] focus:outline-none"
                              aria-label="Jumlah kuantitas"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.productId, 1)}
                              disabled={item.quantity >= item.stockQuantity}
                              className="w-8 h-8 flex items-center justify-center text-[#25232B] hover:bg-[#F0EDF5] disabled:opacity-40 transition-colors rounded-r-md"
                              aria-label="Tambah kuantitas"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-right">
                            {item.itemDiscount > 0 && (
                              <p className="text-[11px] text-[#716D7A] line-through font-mono">
                                {formatRupiah(lineGross)}
                              </p>
                            )}
                            <p className="text-sm font-bold font-mono text-[#5B3CC4]">
                              {formatRupiah(lineNet)}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Diskon Khusus Baris Item */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDiscountItemId(
                                isDiscountExpanded ? null : item.productId
                              )
                            }
                            className="text-[11px] font-medium text-[#5B3CC4] flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Tag className="w-3 h-3" />
                            {item.itemDiscount > 0
                              ? `Diskon item: ${formatRupiah(item.itemDiscount)}`
                              : "+ Diskon Khusus Item"}
                            {isDiscountExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          {isDiscountExpanded && (
                            <div className="mt-2 p-2 bg-white rounded border border-[#E7E3EC] flex items-center gap-2">
                              <div className="flex-1">
                                <CurrencyInput
                                  placeholder="0"
                                  value={item.itemDiscount}
                                  max={item.quantity * item.sellingPrice}
                                  onValueChange={(val) =>
                                    handleSetItemDiscount(item.productId, String(val))
                                  }
                                  className="text-xs min-h-[32px] py-1"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSetItemDiscount(item.productId, "0")}
                                className="text-xs text-[#716D7A] hover:text-[#C0392B] px-1.5 py-1 rounded border border-transparent hover:border-[#E7E3EC] transition-colors"
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rincian Finansial & Parameter Checkout Form */}
              <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2 border-t border-[#E7E3EC]">
                  {/* Diskon Transaksi Global */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="pos-tx-discount" className="text-xs font-semibold text-[#25232B]">
                        Diskon Nota Global (Rp)
                      </label>
                      {transactionDiscount > 0 && (
                        <span className="text-[#C0392B] font-mono text-xs">
                          -{formatRupiah(financialSummary.validTxDiscount)}
                        </span>
                      )}
                    </div>
                    <CurrencyInput
                      id="pos-tx-discount"
                      placeholder="0"
                      value={transactionDiscount}
                      max={financialSummary.netSubtotalBeforeTxDiscount}
                      onValueChange={(val) => setTransactionDiscount(val)}
                      className="min-h-[38px] text-sm"
                    />
                  </div>

                  {/* Pilihan Metode Pembayaran: CASH vs BANK_TRANSFER */}
                  <div>
                    <label className="text-xs font-semibold text-[#25232B] block mb-1.5">
                      Metode Pembayaran
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CASH")}
                        className={cn(
                          "flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                          paymentMethod === "CASH"
                            ? "bg-[#F6F3FF] border-[#5B3CC4] text-[#5B3CC4] shadow-xs"
                            : "bg-white border-[#E7E3EC] text-[#25232B] hover:bg-[#FAF9F6]"
                        )}
                      >
                        <Banknote className="w-4 h-4" />
                        Tunai (Cash)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("BANK_TRANSFER")}
                        className={cn(
                          "flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                          paymentMethod === "BANK_TRANSFER"
                            ? "bg-[#F6F3FF] border-[#5B3CC4] text-[#5B3CC4] shadow-xs"
                            : "bg-white border-[#E7E3EC] text-[#25232B] hover:bg-[#FAF9F6]"
                        )}
                      >
                        <Building2 className="w-4 h-4" />
                        Transfer Bank
                      </button>
                    </div>
                  </div>

                  {/* Kalkulator Uang Diterima & Kembalian Cepat (Khusus Tunai) */}
                  {paymentMethod === "CASH" && (
                    <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7E3EC] space-y-2.5">
                      <label htmlFor="pos-cash-received" className="text-xs font-semibold text-[#25232B] block">
                        Uang Tunai Diterima (Kalkulator Kembalian)
                      </label>
                      <CurrencyInput
                        id="pos-cash-received"
                        placeholder="Contoh: 50.000 (Opsional)"
                        value={financialSummary.numericCashReceived}
                        onValueChange={(val) => setCashReceivedInput(val > 0 ? String(val) : "")}
                        className="bg-white min-h-[38px] font-mono font-semibold"
                      />

                      {/* Tombol Uang Pas & Uang Pecahan Cepat */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setCashReceivedInput(String(financialSummary.totalAmount))
                          }
                          className="px-2 py-1 text-[11px] font-medium bg-white border border-[#E7E3EC] rounded hover:bg-[#F0EDF5]"
                        >
                          Uang Pas
                        </button>
                        {[50000, 100000].map((amt) => {
                          if (amt < financialSummary.totalAmount) return null;
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashReceivedInput(String(amt))}
                              className="px-2 py-1 text-[11px] font-medium bg-white border border-[#E7E3EC] rounded hover:bg-[#F0EDF5]"
                            >
                              {formatRupiah(amt)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Tampilan Kembalian */}
                      {financialSummary.numericCashReceived > 0 && (
                        <div className="pt-2 border-t border-dashed border-[#E7E3EC] flex justify-between items-center text-xs">
                          <span className="text-[#716D7A]">Kembalian:</span>
                          <span
                            className={cn(
                              "font-mono font-bold text-sm",
                              financialSummary.isCashSufficient
                                ? "text-[#0E6251]"
                                : "text-[#C0392B]"
                            )}
                          >
                            {financialSummary.isCashSufficient
                              ? formatRupiah(financialSummary.cashChange)
                              : `Kurang ${formatRupiah(
                                  financialSummary.totalAmount -
                                    financialSummary.numericCashReceived
                                )}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Catatan Transaksi */}
                  <div>
                    <label className="text-xs font-semibold text-[#25232B] block mb-1">
                      Catatan Nota (Opsional)
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: Titipan pesanan Bu Rina"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      className="min-h-[36px] text-xs"
                    />
                  </div>

                  {/* Box Ringkasan Total Tagihan */}
                  <div className="p-4 bg-[#F6F3FF] rounded-xl border border-[#EAE4FF] space-y-1.5">
                    <div className="flex justify-between text-xs text-[#716D7A]">
                      <span>Subtotal Kotor</span>
                      <span className="font-mono">
                        {formatRupiah(financialSummary.grossSubtotal)}
                      </span>
                    </div>
                    {financialSummary.totalItemDiscounts > 0 && (
                      <div className="flex justify-between text-xs text-[#C0392B]">
                        <span>Diskon Per Item</span>
                        <span className="font-mono">
                          -{formatRupiah(financialSummary.totalItemDiscounts)}
                        </span>
                      </div>
                    )}
                    {financialSummary.validTxDiscount > 0 && (
                      <div className="flex justify-between text-xs text-[#C0392B]">
                        <span>Diskon Transaksi Global</span>
                        <span className="font-mono">
                          -{formatRupiah(financialSummary.validTxDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#EAE4FF] flex justify-between items-baseline">
                      <span className="text-sm font-bold text-[#25232B]">Total Bayar</span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-[#5B3CC4]">
                        {formatRupiah(financialSummary.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Eksekusi Bayar / Simpan Transaksi */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full font-bold text-sm shadow-md"
                    disabled={isSubmitting || cartItems.length === 0}
                    isLoading={isSubmitting}
                    id="submit-sale-button"
                  >
                    {isSubmitting
                      ? "Menyimpan Transaksi..."
                      : `Selesaikan Pembayaran (${formatRupiah(
                          financialSummary.totalAmount
                        )})`}
                  </Button>
                </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function NewSaleView({
  initialProducts,
}: {
  initialProducts?: ProductItemResponse[];
} = {}) {
  return (
    <AppLayout title="Kasir Cepat (POS)" currentPath="/sales">
      <React.Suspense
        fallback={
          <div className="max-w-7xl mx-auto p-4 space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-3">
                <Skeleton className="h-12 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
              <div className="lg:col-span-5">
                <Skeleton className="h-96 w-full" />
              </div>
            </div>
          </div>
        }
      >
        <SalesCheckoutContent initialProducts={initialProducts} />
      </React.Suspense>
    </AppLayout>
  );
}
