"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpCircle,
  Plus,
  Package,
  AlertTriangle,
  Info,
  Search,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getProductsForTransactionAction } from "@/app/actions/transactions";
import type { ProductItemResponse } from "@/types/api";
import { formatRupiah } from "@/lib/utils";

export interface PurchasesContentProps {
  initialProducts?: ProductItemResponse[];
}

export function PurchasesContent({
  initialProducts,
}: PurchasesContentProps = {}) {
  const [products, setProducts] = React.useState<ProductItemResponse[]>(
    initialProducts || []
  );
  const [isLoading, setIsLoading] = React.useState(!initialProducts);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    if (initialProducts && initialProducts.length > 0) return;

    let isMounted = true;
    async function loadData() {
      try {
        const response = await getProductsForTransactionAction(
          undefined,
          searchQuery.trim() ? searchQuery.trim() : undefined
        );

        if (!isMounted) return;

        if (!response.success) {
          setErrorMessage(
            response.error?.message || "Gagal memuat daftar produk aktif untuk pembelian stok."
          );
          setProducts([]);
          return;
        }

        setProducts(response.data || []);
      } catch {
        if (!isMounted) return;
        setErrorMessage("Terjadi kegagalan jaringan saat memuat daftar produk.");
        setProducts([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [searchQuery, initialProducts]);

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage(null);
    getProductsForTransactionAction(
      undefined,
      searchQuery.trim() ? searchQuery.trim() : undefined
    )
      .then((response) => {
        setIsLoading(false);
        if (!response.success) {
          setErrorMessage(
            response.error?.message || "Gagal memuat daftar produk aktif untuk pembelian stok."
          );
          return;
        }
        setProducts(response.data || []);
      })
      .catch(() => {
        setIsLoading(false);
        setErrorMessage("Terjadi kegagalan jaringan saat memuat daftar produk.");
      });
  };

  const lowStockProducts = products.filter((p) => p.stockQuantity <= 5);

  return (
    <AppLayout title="Pembelian Stok (Restock)" currentPath="/purchases">
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B]">
              Pembelian Persediaan (Restock)
            </h1>
            <p className="text-xs sm:text-sm text-[#716D7A] mt-1">
              Catat pembelian barang dari pemasok, tambahkan stok persediaan fisik, dan perbarui HPP otomatis.
            </p>
          </div>
          <Link href="/purchases/new">
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
              id="btn-new-purchase"
            >
              Catat Pembelian Baru
            </Button>
          </Link>
        </div>

        {/* Informative Guidance Banner */}
        <div className="p-4 rounded-xl bg-[#F6F3FF] border border-[#EAE4FF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-[#EAE4FF] flex items-center justify-center text-[#5B3CC4] shrink-0 mt-0.5">
              <Info className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#5B3CC4]">
                Perhitungan Moving Weighted Average Cost (MWAC) Otomatis
              </h4>
              <p className="text-xs text-[#5B3CC4]/90 mt-0.5 leading-relaxed">
                Setiap kali transaksi restock dicatat, kuantitas persediaan fisik bertambah secara atomik
                dan nilai Harga Pokok Penjualan (HPP) diperbarui secara proporsional berdasarkan rumus
                rata-rata tertimbang.
              </p>
            </div>
          </div>
          <Link href="/purchases/new" className="shrink-0">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Mulai Restock
            </Button>
          </Link>
        </div>

        {/* Low Stock Warning Card if any */}
        {!isLoading && lowStockProducts.length > 0 && (
          <Card className="border border-[#FAD7A0] bg-[#FEF9E7]/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B9770E]" aria-hidden="true" />
                <CardTitle className="text-sm text-[#7D6608]">
                  Peringatan Stok Menipis ({lowStockProducts.length} Produk Butuh Restock)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[#7D6608]/90">
                Produk-produk di bawah ini memiliki kuantitas ≤ 5 unit dan berisiko habis saat melayani pesanan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg bg-white border border-[#FAD7A0] flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-xs text-[#25232B] truncate max-w-[150px]">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-[#C0392B] font-bold">
                        Sisa: {p.stockQuantity} unit
                      </div>
                    </div>
                    <Link href={`/purchases/new?productId=${p.id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                        Restock
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventory Monitoring Table */}
        <Card className="bg-white border border-[#E7E3EC]">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Status Stok Barang Dagangan Aktif</CardTitle>
                <CardDescription className="text-xs">
                  Pilih produk yang ingin ditambah persediaannya ke dalam faktur pembelian baru.
                </CardDescription>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  id="search-purchase-products"
                  placeholder="Cari nama barang..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" aria-hidden="true" />}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Error state */}
            {errorMessage && (
              <Alert variant="danger" title="Gagal Memuat Data" className="my-3">
                <div className="flex items-center justify-between gap-2">
                  <span>{errorMessage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
                  >
                    Coba Lagi
                  </Button>
                </div>
              </Alert>
            )}

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="space-y-3 py-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {/* Empty state: No active products */}
            {!isLoading && !errorMessage && products.length === 0 && (
              <div className="py-8">
                <EmptyState
                  icon={<Package className="w-6 h-6" aria-hidden="true" />}
                  title="Belum Ada Produk Aktif"
                  description="Daftarkan produk baru pada katalog sebelum mencatat transaksi pembelian stok persediaan."
                  action={
                    <Link href="/products/new">
                      <Button variant="primary" leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}>
                        Tambah Produk Baru
                      </Button>
                    </Link>
                  }
                />
              </div>
            )}

            {/* Products Table (Desktop) */}
            {!isLoading && !errorMessage && products.length > 0 && (
              <>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>HPP Saat Ini</TableHead>
                        <TableHead>Harga Jual</TableHead>
                        <TableHead>Stok Fisik</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => {
                        const isOutOfStock = p.stockQuantity === 0;
                        const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= 5;

                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <span className="font-semibold text-xs sm:text-sm text-[#25232B] block">
                                {p.name}
                              </span>
                              {p.sku && (
                                <span className="text-[11px] font-mono text-[#716D7A] block">
                                  SKU: {p.sku}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-[#716D7A]">{p.category || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-medium text-[#25232B]">
                                {formatRupiah(p.costPrice)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-[#716D7A]">
                                {formatRupiah(p.sellingPrice)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-[#25232B]">
                                  {p.stockQuantity}
                                </span>
                                {isOutOfStock ? (
                                  <Badge variant="danger">Habis</Badge>
                                ) : isLowStock ? (
                                  <Badge variant="warning">Menipis</Badge>
                                ) : (
                                  <Badge variant="success">Aman</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link href={`/purchases/new?productId=${p.id}`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                                >
                                  Restock
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards View (< 640px) */}
                <div className="grid grid-cols-1 gap-3 sm:hidden pt-2">
                  {products.map((p) => {
                    const isOutOfStock = p.stockQuantity === 0;
                    const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= 5;

                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl border border-[#E7E3EC] bg-white shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-xs sm:text-sm text-[#25232B] block truncate">
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {p.sku && (
                                <span className="text-[11px] font-mono text-[#716D7A]">
                                  SKU: {p.sku}
                                </span>
                              )}
                              {p.category && (
                                <span className="text-[11px] text-[#5B3CC4] bg-[#F6F3FF] px-1.5 py-0.5 rounded">
                                  {p.category}
                                </span>
                              )}
                            </div>
                          </div>
                          {isOutOfStock ? (
                            <Badge variant="danger" className="text-[10px]">Habis</Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning" className="text-[10px]">Menipis</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px]">Aman</Badge>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#F0EDF5] grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[11px] text-[#716D7A] block">HPP</span>
                            <span className="font-medium text-[#25232B] font-mono">
                              {formatRupiah(p.costPrice)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#716D7A] block">Harga Jual</span>
                            <span className="text-[#716D7A] font-mono">
                              {formatRupiah(p.sellingPrice)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-[#716D7A] block">Stok</span>
                            <span className="font-bold text-[#25232B] font-mono">
                              {p.stockQuantity} unit
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#F0EDF5]">
                          <Link href={`/purchases/new?productId=${p.id}`} className="block">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full min-h-[44px] text-xs font-semibold"
                              leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                            >
                              Restock Produk Ini
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
