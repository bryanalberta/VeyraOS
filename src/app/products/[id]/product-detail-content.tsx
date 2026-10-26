"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Archive,
  ArrowUpCircle,
  Save,
  Lock,
} from "lucide-react";
import { z } from "zod";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getProductByIdAction,
  updateProductAction,
  archiveProductAction,
} from "@/app/actions/products";
import type { ProductItemResponse } from "@/types/api";
import { formatRupiah } from "@/lib/utils";
import { rupiahPositiveSchema } from "@/lib/validations/common";

const clientUpdateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama produk minimal 1 karakter")
    .max(200, "Nama produk maksimal 200 karakter"),
  sku: z
    .string()
    .trim()
    .max(50, "SKU maksimal 50 karakter")
    .optional(),
  category: z
    .string()
    .trim()
    .max(50, "Kategori maksimal 50 karakter")
    .optional(),
  sellingPrice: rupiahPositiveSchema,
});

export interface ProductDetailProps {
  params: Promise<{ id: string }> | { id: string };
  initialProduct?: ProductItemResponse;
}

export function ProductDetailContent({ params, initialProduct }: ProductDetailProps) {
  const unwrappedParams =
    params && "then" in params
      ? React.use(params as Promise<{ id: string }>)
      : params;
  const productId = unwrappedParams.id;

  const [product, setProduct] = React.useState<ProductItemResponse | null>(
    initialProduct || null
  );
  const [isLoading, setIsLoading] = React.useState(!initialProduct);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Form states for editable metadata
  const [name, setName] = React.useState(initialProduct?.name || "");
  const [sku, setSku] = React.useState(initialProduct?.sku || "");
  const [category, setCategory] = React.useState(initialProduct?.category || "");
  const [sellingPrice, setSellingPrice] = React.useState(
    initialProduct ? String(initialProduct.sellingPrice) : ""
  );

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saveSuccessMessage, setSaveSuccessMessage] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Archive modal state
  const [showArchiveConfirm, setShowArchiveConfirm] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);

  React.useEffect(() => {
    if (initialProduct) return;

    let isMounted = true;
    async function loadProduct() {
      try {
        const response = await getProductByIdAction(productId);
        if (!isMounted) return;

        if (!response.success) {
          setLoadError(response.error?.message || "Produk tidak ditemukan atau akses ditolak.");
          setProduct(null);
          return;
        }

        const p = response.data;
        setProduct(p);
        setName(p.name);
        setSku(p.sku || "");
        setCategory(p.category || "");
        setSellingPrice(String(p.sellingPrice));
      } catch {
        if (!isMounted) return;
        setLoadError("Terjadi kegagalan jaringan saat mengambil data produk.");
        setProduct(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [productId, initialProduct]);

  // Handle Save Metadata
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || product?.isArchived) return;

    setFieldErrors({});
    setActionError(null);
    setSaveSuccessMessage(null);

    const parsedSellingPrice = parseInt(sellingPrice.replace(/\D/g, ""), 10) || 0;

    const payloadToValidate = {
      name,
      sku: sku.trim() ? sku.trim() : undefined,
      category: category.trim() ? category.trim() : undefined,
      sellingPrice: parsedSellingPrice,
    };

    const validationResult = clientUpdateProductSchema.safeParse(payloadToValidate);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path && !errors[path]) {
          errors[path] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // HANYA mengirimkan field metadata. DILARANG mengirimkan stockQuantity atau costPrice.
      const response = await updateProductAction(productId, {
        name: validationResult.data.name,
        sku: validationResult.data.sku,
        category: validationResult.data.category,
        sellingPrice: validationResult.data.sellingPrice,
      });

      if (!response.success) {
        if (response.error?.details) {
          const serverFieldErrors: Record<string, string> = {};
          Object.entries(response.error.details).forEach(([key, msgs]) => {
            if (Array.isArray(msgs) && msgs.length > 0) {
              serverFieldErrors[key] = msgs[0];
            }
          });
          setFieldErrors(serverFieldErrors);
        }
        setActionError(
          response.error?.message || "Gagal memperbarui metadata produk."
        );
        return;
      }

      setProduct(response.data);
      setSaveSuccessMessage("Informasi produk berhasil diperbarui.");
      setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 3000);
    } catch {
      setActionError("Terjadi kegagalan jaringan saat menyimpan pembaruan produk.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Soft Archive
  const handleArchive = async () => {
    if (isArchiving || !product || product.isArchived) return;

    setIsArchiving(true);
    setActionError(null);

    try {
      const response = await archiveProductAction(productId);
      if (!response.success) {
        setActionError(
          response.error?.message || "Gagal mengarsipkan produk."
        );
        setShowArchiveConfirm(false);
        return;
      }

      setProduct(response.data);
      setShowArchiveConfirm(false);
      setSaveSuccessMessage("Produk berhasil diarsipkan (soft-archive).");
    } catch {
      setActionError("Terjadi kegagalan jaringan saat mengarsipkan produk.");
      setShowArchiveConfirm(false);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button
              variant="outline"
              size="icon"
              aria-label="Kembali ke Daftar Produk"
              id="btn-back-to-products"
            >
              <ArrowLeft className="w-4 h-4 text-[#25232B]" aria-hidden="true" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B]">
              {isLoading ? "Memuat Produk..." : product ? product.name : "Detail Produk"}
            </h1>
            <p className="text-xs sm:text-sm text-[#716D7A]">
              Kelola informasi barang, pantau status persediaan, dan arsipkan jika tidak digunakan.
            </p>
          </div>
        </div>

        {product && !product.isArchived && (
          <Link href={`/purchases/new?productId=${product.id}`}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowUpCircle className="w-4 h-4" aria-hidden="true" />}
              id="btn-restock-this-product"
            >
              Beli Stok (Restock)
            </Button>
          </Link>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-6 space-y-4 bg-white border border-[#E7E3EC]">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </Card>
      )}

      {/* Load Error State */}
      {!isLoading && loadError && (
        <EmptyState
          icon={<AlertTriangle className="w-6 h-6 text-[#C0392B]" aria-hidden="true" />}
          title="Produk Tidak Ditemukan"
          description={loadError}
          action={
            <Link href="/products">
              <Button variant="outline">Kembali ke Katalog</Button>
            </Link>
          }
        />
      )}

      {/* Content Loaded */}
      {!isLoading && product && (
        <>
          {/* Status Alerts */}
          {product.isArchived && (
            <Alert variant="warning" title="Produk Diarsipkan">
              Produk ini telah diarsipkan. Produk tidak lagi dapat dipilih pada transaksi kasir atau
              pembelian stok baru. Riwayat mutasi dan nota terdahulu tetap dipertahankan utuh.
            </Alert>
          )}

          {saveSuccessMessage && (
            <Alert variant="success" title="Berhasil">
              {saveSuccessMessage}
            </Alert>
          )}

          {actionError && (
            <Alert variant="danger" title="Perhatian">
              {actionError}
            </Alert>
          )}

          {/* Read-Only Financial & Stock Integrity Panel */}
          <Card className="bg-[#FAF9F6] border border-[#E7E3EC]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />
                  <CardTitle className="text-sm">Status Persediaan & Keuangan (Terkunci)</CardTitle>
                </div>
                {product.isArchived ? (
                  <Badge variant="outline">Diarsipkan</Badge>
                ) : product.stockQuantity === 0 ? (
                  <Badge variant="danger">Habis</Badge>
                ) : product.stockQuantity <= 5 ? (
                  <Badge variant="warning">Menipis (≤5)</Badge>
                ) : (
                  <Badge variant="success">Aman</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Stok dan HPP tidak dapat diubah langsung melalui form metadata guna mencegah
                desinkronisasi ledger akuntansi dan persediaan fisik.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-3 bg-white rounded-lg border border-[#E7E3EC]">
                  <span className="text-xs text-[#716D7A] block">Sisa Stok Fisik</span>
                  <span className="text-xl font-bold text-[#25232B] block mt-0.5">
                    {product.stockQuantity} Unit
                  </span>
                  <span className="text-[11px] text-[#716D7A] block mt-1">
                    Mutasi kuantitas hanya melalui Restock, Penjualan, atau Void.
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-[#E7E3EC]">
                  <span className="text-xs text-[#716D7A] block">HPP Rata-rata Bergerak (MWAC)</span>
                  <span className="text-xl font-bold text-[#25232B] block mt-0.5">
                    {formatRupiah(product.costPrice)}
                  </span>
                  <span className="text-[11px] text-[#716D7A] block mt-1">
                    Dihitung otomatis saat transaksi pembelian persediaan tercatat.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Metadata Form */}
          <Card className="bg-white border border-[#E7E3EC]">
            <CardHeader>
              <CardTitle className="text-base">Metadata Produk</CardTitle>
              <CardDescription>
                Ubah nama dagang, kode SKU, kategori, atau harga jual produk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4" noValidate>
                {/* Name */}
                <Input
                  id="edit-product-name"
                  label="Nama Produk"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => {
                        const u = { ...prev };
                        delete u.name;
                        return u;
                      });
                    }
                  }}
                  errorMessage={fieldErrors.name}
                  disabled={isSubmitting || product.isArchived}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SKU */}
                  <Input
                    id="edit-product-sku"
                    label="SKU / Kode Barang"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      if (fieldErrors.sku) {
                        setFieldErrors((prev) => {
                          const u = { ...prev };
                          delete u.sku;
                          return u;
                        });
                      }
                    }}
                    errorMessage={fieldErrors.sku}
                    helperText="Kode identifikasi barang dagangan."
                    disabled={isSubmitting || product.isArchived}
                  />

                  {/* Category */}
                  <Input
                    id="edit-product-category"
                    label="Kategori"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      if (fieldErrors.category) {
                        setFieldErrors((prev) => {
                          const u = { ...prev };
                          delete u.category;
                          return u;
                        });
                      }
                    }}
                    errorMessage={fieldErrors.category}
                    disabled={isSubmitting || product.isArchived}
                  />
                </div>

                {/* Selling Price */}
                <Input
                  id="edit-product-selling-price"
                  label="Harga Jual Satuan"
                  required
                  value={sellingPrice}
                  onChange={(e) => {
                    const rawVal = e.target.value.replace(/\D/g, "");
                    setSellingPrice(rawVal);
                    if (fieldErrors.sellingPrice) {
                      setFieldErrors((prev) => {
                        const u = { ...prev };
                        delete u.sellingPrice;
                        return u;
                      });
                    }
                  }}
                  leftIcon={<span className="text-xs font-bold text-[#716D7A]">Rp</span>}
                  errorMessage={fieldErrors.sellingPrice}
                  helperText="Harga yang dibebankan kepada pembeli di kasir."
                  disabled={isSubmitting || product.isArchived}
                />

                {/* Submit Button Bar */}
                {!product.isArchived && (
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EDF5]">
                    <Button
                      variant="primary"
                      type="submit"
                      isLoading={isSubmitting}
                      disabled={isSubmitting}
                      leftIcon={<Save className="w-4 h-4" aria-hidden="true" />}
                      id="btn-save-product-changes"
                    >
                      Simpan Perubahan
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Soft Archive Action Area */}
          {!product.isArchived && (
            <Card className="border border-[#FAD7A0] bg-[#FEF9E7]/40">
              <CardHeader>
                <CardTitle className="text-sm text-[#7D6608]">Pengarsipan Produk</CardTitle>
                <CardDescription className="text-xs text-[#7D6608]/90">
                  Menonaktifkan produk tanpa menghapus data historis (Soft Delete). Produk tidak akan
                  dapat dipilih lagi saat mencatat penjualan atau pembelian baru.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-end pt-0">
                <Button
                  variant="outline"
                  className="border-[#C0392B] text-[#C0392B] hover:bg-[#FDEDEC]"
                  onClick={() => setShowArchiveConfirm(true)}
                  leftIcon={<Archive className="w-4 h-4" aria-hidden="true" />}
                  id="btn-open-archive-modal"
                >
                  Arsipkan Produk Ini
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Confirmation Dialog / Modal for Soft Archive */}
          {showArchiveConfirm && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-dialog-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#25232B]/50 backdrop-blur-xs"
            >
              <Card className="max-w-md w-full bg-white border border-[#E7E3EC] shadow-xl animate-in fade-in-50">
                <CardHeader>
                  <div className="w-10 h-10 rounded-full bg-[#FDEDEC] flex items-center justify-center text-[#C0392B] mb-2">
                    <Archive className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <CardTitle id="archive-dialog-title" className="text-base text-[#25232B]">
                    Konfirmasi Pengarsipan Produk
                  </CardTitle>
                  <CardDescription className="text-xs text-[#716D7A]">
                    Apakah Anda yakin ingin mengarsipkan produk{" "}
                    <strong className="text-[#25232B]">{product.name}</strong>?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-[#716D7A] leading-relaxed">
                    Produk yang diarsipkan tidak akan muncul lagi di kasir penjualan atau menu
                    pembelian stok. Seluruh rekaman penjualan dan laporan masa lalu tetap tersimpan utuh.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowArchiveConfirm(false)}
                      disabled={isArchiving}
                      id="btn-cancel-archive"
                    >
                      Batal
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleArchive}
                      isLoading={isArchiving}
                      disabled={isArchiving}
                      id="btn-confirm-archive"
                    >
                      Ya, Arsipkan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ProductDetailView({ params, initialProduct }: ProductDetailProps) {
  return (
    <AppLayout title="Detail & Edit Produk" currentPath="/products">
      <React.Suspense
        fallback={
          <div className="max-w-3xl mx-auto space-y-6 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <ProductDetailContent params={params} initialProduct={initialProduct} />
      </React.Suspense>
    </AppLayout>
  );
}
