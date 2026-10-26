"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit,
  ArrowUpCircle,
  RefreshCw,
  Archive,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getProductsAction } from "@/app/actions/products";
import type { ProductItemResponse } from "@/types/api";
import { formatRupiah } from "@/lib/utils";

export interface ProductListContentProps {
  initialProducts?: ProductItemResponse[];
}

export function ProductListContent({
  initialProducts,
}: ProductListContentProps = {}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("query") || "";

  const [products, setProducts] = React.useState<ProductItemResponse[]>(
    initialProducts || []
  );
  const [categories, setCategories] = React.useState<string[]>(() => {
    if (!initialProducts) return [];
    return Array.from(
      new Set(
        initialProducts
          .map((p) => p.category?.trim())
          .filter((c): c is string => Boolean(c && c.length > 0))
      )
    ).sort();
  });
  const [isLoading, setIsLoading] = React.useState(!initialProducts);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = React.useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [lowStockOnly, setLowStockOnly] = React.useState(false);
  const [includeArchived, setIncludeArchived] = React.useState(false);

  React.useEffect(() => {
    if (initialProducts && initialProducts.length > 0) return;

    let isMounted = true;
    async function loadData() {
      try {
        const response = await getProductsAction({
          query: searchQuery.trim() ? searchQuery.trim() : undefined,
          category: selectedCategory !== "ALL" ? selectedCategory : undefined,
          lowStockOnly: lowStockOnly ? true : undefined,
          includeArchived: includeArchived ? true : undefined,
        });

        if (!isMounted) return;

        if (!response.success) {
          setErrorMessage(
            response.error?.message || "Gagal memuat katalog produk dari server."
          );
          setProducts([]);
          return;
        }

        const items = response.data || [];
        setProducts(items);

        // Ekstrak kategori unik untuk opsi filter
        const uniqueCats = Array.from(
          new Set(
            items
              .map((p) => p.category?.trim())
              .filter((c): c is string => Boolean(c && c.length > 0))
          )
        ).sort();
        setCategories(uniqueCats);
      } catch {
        if (!isMounted) return;
        setErrorMessage("Terjadi kesalahan jaringan saat mengambil data produk.");
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
  }, [searchQuery, selectedCategory, lowStockOnly, includeArchived, initialProducts]);

  const handleManualRefresh = () => {
    setIsLoading(true);
    setErrorMessage(null);
    getProductsAction({
      query: searchQuery.trim() ? searchQuery.trim() : undefined,
      category: selectedCategory !== "ALL" ? selectedCategory : undefined,
      lowStockOnly: lowStockOnly ? true : undefined,
      includeArchived: includeArchived ? true : undefined,
    })
      .then((response) => {
        setIsLoading(false);
        if (!response.success) {
          setErrorMessage(
            response.error?.message || "Gagal memuat katalog produk dari server."
          );
          return;
        }
        setProducts(response.data || []);
      })
      .catch(() => {
        setIsLoading(false);
        setErrorMessage("Terjadi kesalahan jaringan saat mengambil data produk.");
      });
  };

  // Statistik Ringkas
  const totalProducts = products.length;
  const lowStockCount = products.filter(
    (p) => !p.isArchived && p.stockQuantity <= 5
  ).length;
  const outOfStockCount = products.filter(
    (p) => !p.isArchived && p.stockQuantity === 0
  ).length;

  const isFiltered =
    Boolean(searchQuery.trim()) ||
    selectedCategory !== "ALL" ||
    lowStockOnly ||
    includeArchived;

  const handleResetFilter = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setLowStockOnly(false);
    setIncludeArchived(false);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B]">
            Katalog Produk & Persediaan
          </h1>
          <p className="text-xs sm:text-sm text-[#716D7A] mt-1">
            Kelola barang dagangan, pantau level stok, dan kendalikan penetapan harga jual.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/products/new">
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
              id="btn-create-product"
            >
              Tambah Produk
            </Button>
          </Link>
          <Link href="/purchases/new">
            <Button
              variant="outline"
              leftIcon={<ArrowUpCircle className="w-4 h-4 text-[#5B3CC4]" aria-hidden="true" />}
              id="btn-restock-shortcut"
            >
              Restock
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3 sm:p-4 bg-white border border-[#E7E3EC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F6F3FF] flex items-center justify-center text-[#5B3CC4] shrink-0">
              <Package className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-[#716D7A] font-medium">Total Produk</p>
              <p className="text-lg sm:text-xl font-bold text-[#25232B]">
                {isLoading ? "..." : totalProducts}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-white border border-[#E7E3EC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FEF9E7] flex items-center justify-center text-[#B9770E] shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-[#716D7A] font-medium">Stok Menipis (≤5)</p>
              <p className="text-lg sm:text-xl font-bold text-[#B9770E]">
                {isLoading ? "..." : lowStockCount}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-white border border-[#E7E3EC] col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FDEDEC] flex items-center justify-center text-[#C0392B] shrink-0">
              <Archive className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-[#716D7A] font-medium">Stok Habis (0)</p>
              <p className="text-lg sm:text-xl font-bold text-[#C0392B]">
                {isLoading ? "..." : outOfStockCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and search control bar */}
      <Card className="p-4 bg-white border border-[#E7E3EC] space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Search by name/SKU */}
          <div className="lg:col-span-5">
            <Input
              id="product-search-input"
              label="Cari Produk atau SKU"
              placeholder="Contoh: Beras Ramos, SKU-001..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" aria-hidden="true" />}
            />
          </div>

          {/* Category filter */}
          <div className="lg:col-span-3">
            <label
              htmlFor="product-category-select"
              className="block text-xs font-semibold text-[#25232B] mb-1.5"
            >
              Kategori
            </label>
            <div className="relative">
              <select
                id="product-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-[#E7E3EC] bg-white px-3.5 py-2 text-sm text-[#25232B] transition-all duration-150 focus:border-[#5B3CC4] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[rgba(91,60,196,0.20)] min-h-[44px] sm:min-h-[40px] appearance-none pr-9 shadow-2xs cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter
                className="w-4 h-4 text-[#716D7A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Quick toggle check buttons */}
          <div className="lg:col-span-4 flex flex-wrap items-center gap-3 pt-2 sm:pt-0">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#25232B] cursor-pointer select-none">
              <input
                type="checkbox"
                id="toggle-low-stock"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[#5B3CC4] focus:ring-[#5B3CC4] border-[#E7E3EC]"
              />
              <span>Stok Menipis</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#25232B] cursor-pointer select-none">
              <input
                type="checkbox"
                id="toggle-include-archived"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 rounded text-[#5B3CC4] focus:ring-[#5B3CC4] border-[#E7E3EC]"
              />
              <span>Termasuk Arsip</span>
            </label>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilter}
                className="text-xs text-[#5B3CC4] hover:bg-[#F6F3FF] ml-auto"
                id="btn-reset-filters"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error State */}
      {errorMessage && (
        <Alert
          variant="danger"
          title="Gagal Memuat Produk"
          className="my-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{errorMessage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Coba Lagi
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true" aria-label="Memuat produk...">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Harga Jual</TableHead>
                  <TableHead>HPP (Modal)</TableHead>
                  <TableHead>Sisa Stok</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State: No Products at all */}
      {!isLoading && !errorMessage && products.length === 0 && !isFiltered && (
        <EmptyState
          icon={<Package className="w-6 h-6" aria-hidden="true" />}
          title="Katalog Produk Masih Kosong"
          description="Tambahkan produk pertama Anda untuk mulai mengelola persediaan barang dan melayani transaksi kasir."
          action={
            <Link href="/products/new">
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
              >
                Tambah Produk Pertama
              </Button>
            </Link>
          }
        />
      )}

      {/* Empty State: Filter yielded no results */}
      {!isLoading && !errorMessage && products.length === 0 && isFiltered && (
        <EmptyState
          icon={<Search className="w-6 h-6" aria-hidden="true" />}
          title="Tidak Ada Produk yang Cocok"
          description="Coba ubah kata kunci pencarian atau sesuaikan filter kategori dan status stok."
          action={
            <Button
              variant="outline"
              onClick={handleResetFilter}
              leftIcon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
            >
              Reset Semua Filter
            </Button>
          }
        />
      )}

      {/* Content Loaded: Table (Desktop) & Cards (Mobile) */}
      {!isLoading && !errorMessage && products.length > 0 && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Produk & SKU</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Harga Jual</TableHead>
                  <TableHead>HPP (Modal)</TableHead>
                  <TableHead>Sisa Stok</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const isOutOfStock = product.stockQuantity === 0;
                  const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;

                  return (
                    <TableRow key={product.id} className={product.isArchived ? "opacity-60 bg-[#FAF9F6]" : undefined}>
                      <TableCell>
                        <div className="font-semibold text-[#25232B]">{product.name}</div>
                        {product.sku && (
                          <div className="text-[11px] text-[#716D7A] font-mono mt-0.5">
                            SKU: {product.sku}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-[#716D7A]">
                          {product.category || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-[#25232B]">
                          {formatRupiah(product.sellingPrice)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-[#716D7A]">
                          {formatRupiah(product.costPrice)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-[#25232B]">
                            {product.stockQuantity}
                          </span>
                          {product.isArchived ? (
                            <Badge variant="outline">Arsip</Badge>
                          ) : isOutOfStock ? (
                            <Badge variant="danger">Habis</Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning">Menipis</Badge>
                          ) : (
                            <Badge variant="success">Aman</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.isArchived ? (
                          <Badge variant="outline">Diarsipkan</Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#AED6F1] text-[#1B4F72]">
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link href={`/products/${product.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Edit className="w-3.5 h-3.5" aria-hidden="true" />}
                              aria-label={`Edit ${product.name}`}
                            >
                              Edit
                            </Button>
                          </Link>
                          {!product.isArchived && (
                            <Link href={`/purchases/new?productId=${product.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#5B3CC4] hover:bg-[#F6F3FF]"
                                leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                                aria-label={`Restock ${product.name}`}
                              >
                                Restock
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {products.map((product) => {
              const isOutOfStock = product.stockQuantity === 0;
              const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;

              return (
                <Card
                  key={product.id}
                  className={`p-4 border border-[#E7E3EC] ${
                    product.isArchived ? "opacity-60 bg-[#FAF9F6]" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#25232B] leading-snug">
                        {product.name}
                      </h4>
                      {product.sku && (
                        <p className="text-[11px] font-mono text-[#716D7A] mt-0.5">
                          SKU: {product.sku}
                        </p>
                      )}
                    </div>
                    {product.isArchived ? (
                      <Badge variant="outline">Diarsipkan</Badge>
                    ) : isOutOfStock ? (
                      <Badge variant="danger">Habis</Badge>
                    ) : isLowStock ? (
                      <Badge variant="warning">Menipis</Badge>
                    ) : (
                      <Badge variant="success">Aman</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[#F0EDF5] my-2">
                    <div>
                      <span className="text-[#716D7A] block">Harga Jual</span>
                      <span className="font-bold text-[#25232B]">
                        {formatRupiah(product.sellingPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#716D7A] block">HPP (Modal)</span>
                      <span className="text-[#25232B]">
                        {formatRupiah(product.costPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#716D7A] block">Kategori</span>
                      <span className="text-[#25232B]">{product.category || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[#716D7A] block">Sisa Stok Fisik</span>
                      <span className="font-bold text-[#25232B]">{product.stockQuantity} unit</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link href={`/products/${product.id}`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        leftIcon={<Edit className="w-3.5 h-3.5" aria-hidden="true" />}
                      >
                        Edit
                      </Button>
                    </Link>
                    {!product.isArchived && (
                      <Link
                        href={`/purchases/new?productId=${product.id}`}
                        className="flex-1"
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                        >
                          Restock
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function ProductListView({
  initialProducts,
}: ProductListContentProps = {}) {
  return (
    <AppLayout title="Produk & Stok" currentPath="/products">
      <React.Suspense
        fallback={
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <ProductListContent initialProducts={initialProducts} />
      </React.Suspense>
    </AppLayout>
  );
}
