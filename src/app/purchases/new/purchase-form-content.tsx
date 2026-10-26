"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Package,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  recordPurchaseAction,
  getProductsForTransactionAction,
} from "@/app/actions/transactions";
import type {
  ProductItemResponse,
  PurchaseReceiptResponse,
} from "@/types/api";
import { formatRupiah } from "@/lib/utils";
import { calculateMovingAverageCost } from "@/lib/financial";

export interface PurchaseItemRow {
  rowId: string;
  productId: string;
  quantity: string;
  unitPurchaseCost: string;
}

export interface PurchaseFormContentProps {
  initialProducts?: ProductItemResponse[];
}

export function PurchaseFormContent({
  initialProducts,
}: PurchaseFormContentProps) {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId") || "";

  // Active products loaded for dropdown selection
  const [activeProducts, setActiveProducts] = React.useState<ProductItemResponse[]>(
    initialProducts || []
  );
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(!initialProducts);

  // Form states
  const [supplierName, setSupplierName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<PurchaseItemRow[]>([
    {
      rowId: "item-1",
      productId: initialProductId,
      quantity: "1",
      unitPurchaseCost: "0",
    },
  ]);

  // Idempotency Key: Dihasilkan SEKALI saat form dibuka, dipertahankan persisten saat retry
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `idemp-po-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  });

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [purchaseReceipt, setPurchaseReceipt] = React.useState<PurchaseReceiptResponse | null>(null);

  // Load active products for dropdown
  React.useEffect(() => {
    if (initialProducts && initialProducts.length > 0) return;

    let isMounted = true;
    async function loadProducts() {
      try {
        const response = await getProductsForTransactionAction();
        if (!isMounted) return;

        if (!response.success) {
          setGeneralError(response.error?.message || "Gagal memuat katalog produk aktif.");
          return;
        }

        const itemsData = response.data || [];
        setActiveProducts(itemsData);
        // Jika ada initialProductId dan baris pertama belum terisi, cocokkan harga
        if (initialProductId) {
          const matched = itemsData.find((p) => p.id === initialProductId);
          if (matched) {
            setItems([
              {
                rowId: "item-1",
                productId: matched.id,
                quantity: "1",
                unitPurchaseCost: String(matched.costPrice || 0),
              },
            ]);
          }
        }
      } catch {
        if (isMounted) {
          setGeneralError("Terjadi kegagalan jaringan saat memuat data produk.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, [initialProductId, initialProducts]);

  // Tambah baris item pembelian
  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        rowId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: "",
        quantity: "1",
        unitPurchaseCost: "0",
      },
    ]);
  };

  // Hapus baris item pembelian
  const handleRemoveItemRow = (rowId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  };

  // Update data baris item
  const handleItemChange = (
    rowId: string,
    field: keyof Omit<PurchaseItemRow, "rowId">,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId !== rowId) return item;

        const updated = { ...item, [field]: value };

        // Jika mengubah pilihan produk, otomatis isi default harga beli dari HPP produk tersebut
        if (field === "productId" && value) {
          const selected = activeProducts.find((p) => p.id === value);
          if (selected && (!item.unitPurchaseCost || item.unitPurchaseCost === "0")) {
            updated.unitPurchaseCost = String(selected.costPrice || 0);
          }
        }

        return updated;
      })
    );

    // Hapus field errors jika ada
    if (fieldErrors[rowId]) {
      setFieldErrors((prev) => {
        const u = { ...prev };
        delete u[rowId];
        return u;
      });
    }
  };

  // Hitung total pembelian secara real-time
  const calculatedTotalCost = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity.replace(/\D/g, ""), 10) || 0;
    const unitCost = parseInt(item.unitPurchaseCost.replace(/\D/g, ""), 10) || 0;
    return sum + qty * unitCost;
  }, 0);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setGeneralError(null);

    // 1. Validasi form client
    if (items.length === 0) {
      setGeneralError("Minimal harus ada 1 item dalam pembelian persediaan.");
      return;
    }

    const errors: Record<string, string> = {};
    const parsedItems: Array<{
      productId: string;
      quantity: number;
      unitPurchaseCost: number;
    }> = [];

    items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item-${index}-productId`] = "Pilih produk yang dibeli";
      }

      const qty = parseInt(item.quantity.replace(/\D/g, ""), 10);
      if (isNaN(qty) || qty <= 0) {
        errors[`item-${index}-quantity`] = "Jumlah minimal 1 unit";
      }

      const cost = parseInt(item.unitPurchaseCost.replace(/\D/g, ""), 10);
      if (isNaN(cost) || cost < 0) {
        errors[`item-${index}-unitCost`] = "Harga beli tidak boleh negatif";
      }

      if (item.productId && qty > 0 && cost >= 0) {
        parsedItems.push({
          productId: item.productId,
          quantity: qty,
          unitPurchaseCost: cost,
        });
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError("Mohon periksa kembali rincian produk dan harga pada formulir.");
      return;
    }

    setIsSubmitting(true);

    try {
      // PERINGATAN IDEMPOTENSI: Menggunakan idempotencyKey persisten untuk retry aman
      const response = await recordPurchaseAction({
        supplierName: supplierName.trim() ? supplierName.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        items: parsedItems,
        idempotencyKey,
      });

      if (!response.success) {
        setGeneralError(
          response.error?.message || "Gagal mencatat transaksi pembelian stok."
        );
        return;
      }

      setPurchaseReceipt(response.data);
    } catch {
      setGeneralError(
        "Terjadi kegagalan jaringan saat mengirimkan transaksi pembelian. Idempotency key dipertahankan, Anda dapat menekan Simpan kembali tanpa risiko duplikasi transaksi."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form untuk transaksi baru berikutnya (menghasilkan idempotency key baru)
  const handleResetForNewPurchase = () => {
    setPurchaseReceipt(null);
    setSupplierName("");
    setNotes("");
    setItems([
      {
        rowId: "item-1",
        productId: "",
        quantity: "1",
        unitPurchaseCost: "0",
      },
    ]);
    setFieldErrors({});
    setGeneralError(null);
    const newKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `idemp-po-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setIdempotencyKey(newKey);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/purchases">
          <Button
            variant="outline"
            size="icon"
            aria-label="Kembali ke Daftar Pembelian"
            id="btn-back-to-purchases"
          >
            <ArrowLeft className="w-4 h-4 text-[#25232B]" aria-hidden="true" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B]">
            Catat Pembelian Stok (Restock)
          </h1>
          <p className="text-xs sm:text-sm text-[#716D7A]">
            Tambah saldo stok fisik barang dagangan dan perbarui HPP secara atomik.
          </p>
        </div>
      </div>

      {/* Success Receipt State */}
      {purchaseReceipt && (
        <Card className="bg-white border-2 border-[#A3E4D7] shadow-md animate-in fade-in-50">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-[#E8F8F0] text-[#0E6251] flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-lg text-[#0E6251]">
              Pembelian Stok Berhasil Dicatat!
            </CardTitle>
            <CardDescription className="text-xs text-[#716D7A]">
              Stok fisik barang telah bertambah dan HPP produk diperbarui di database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-[#E7E3EC] space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#F0EDF5]">
                <span className="text-[#716D7A]">Nomor Faktur Pembelian:</span>
                <span className="font-mono font-bold text-[#25232B]">{purchaseReceipt.invoiceNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F0EDF5]">
                <span className="text-[#716D7A]">ID Pembelian:</span>
                <span className="font-mono text-[#716D7A]">{purchaseReceipt.purchaseId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F0EDF5]">
                <span className="text-[#716D7A]">Jumlah Item:</span>
                <span className="font-bold text-[#25232B]">{purchaseReceipt.itemsCount} Unit</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F0EDF5]">
                <span className="text-[#716D7A]">Waktu Transaksi:</span>
                <span className="text-[#25232B]">{new Date(purchaseReceipt.purchaseDate).toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold">
                <span className="text-[#25232B]">Total Biaya Pembelian:</span>
                <span className="text-[#5B3CC4]">{formatRupiah(purchaseReceipt.totalCost)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Link href="/products" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">
                  Lihat Katalog Produk
                </Button>
              </Link>
              <Button
                variant="primary"
                onClick={handleResetForNewPurchase}
                leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                className="w-full sm:w-auto"
                id="btn-record-another-purchase"
              >
                Catat Pembelian Baru Lainnya
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Form (Hidden when receipt is active) */}
      {!purchaseReceipt && (
        <>
          {/* General Error Alert */}
          {generalError && (
            <Alert variant="danger" title="Transaksi Belum Berhasil">
              {generalError}
            </Alert>
          )}

          {/* Loading products placeholder */}
          {isLoadingProducts && (
            <Card className="p-6 space-y-3 bg-white border border-[#E7E3EC]">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </Card>
          )}

          {/* No products registered warning */}
          {!isLoadingProducts && activeProducts.length === 0 && (
            <EmptyState
              icon={<Package className="w-6 h-6 text-[#5B3CC4]" aria-hidden="true" />}
              title="Katalog Produk Masih Kosong"
              description="Anda belum memiliki produk aktif untuk direstock. Daftarkan produk terlebih dahulu di katalog."
              action={
                <Link href="/products/new">
                  <Button variant="primary" leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}>
                    Tambah Produk Pertama
                  </Button>
                </Link>
              }
            />
          )}

          {!isLoadingProducts && activeProducts.length > 0 && (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Supplier & Notes Header Card */}
              <Card className="bg-white border border-[#E7E3EC]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Informasi Faktur & Pemasok</CardTitle>
                  <CardDescription className="text-xs">
                    Rincian nota pembelian dari supplier / vendor Anda.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="supplier-name-input"
                      label="Nama Pemasok / Supplier"
                      placeholder="Contoh: CV Sumber Makmur (Opsional)"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      disabled={isSubmitting}
                      helperText="Maksimal 100 karakter."
                    />

                    <Input
                      id="purchase-notes-input"
                      label="Catatan Pembelian"
                      placeholder="Contoh: Restock akhir pekan, diskon nota Rp 50.000 (Opsional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isSubmitting}
                      helperText="Maksimal 500 karakter."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Items Card */}
              <Card className="bg-white border border-[#E7E3EC]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Rincian Barang yang Dibeli</CardTitle>
                      <CardDescription className="text-xs">
                        Pilih produk, kuantitas restock, dan harga beli per unit.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddItemRow}
                      disabled={isSubmitting}
                      leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                      id="btn-add-item-row"
                    >
                      Tambah Baris
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item, index) => {
                    const selectedProduct = activeProducts.find((p) => p.id === item.productId);
                    const qtyNumber = parseInt(item.quantity.replace(/\D/g, ""), 10) || 0;
                    const unitCostNumber = parseInt(item.unitPurchaseCost.replace(/\D/g, ""), 10) || 0;
                    const subtotal = qtyNumber * unitCostNumber;

                    // Real-time Moving Weighted Average Cost preview
                    const currentStock = selectedProduct ? selectedProduct.stockQuantity : 0;
                    const currentHpp = selectedProduct ? selectedProduct.costPrice : 0;
                    const estimatedNewHpp = selectedProduct
                        ? calculateMovingAverageCost(currentStock, currentHpp, qtyNumber, unitCostNumber)
                        : 0;

                    return (
                      <div
                        key={item.rowId}
                        className="p-4 rounded-xl border border-[#E7E3EC] bg-[#FAF9F6] space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#5B3CC4]">
                            Item #{index + 1}
                          </span>
                          {items.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#C0392B] hover:bg-[#FDEDEC] h-8 px-2"
                              onClick={() => handleRemoveItemRow(item.rowId)}
                              disabled={isSubmitting}
                              aria-label={`Hapus Item #${index + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                          {/* Product Selection */}
                          <div className="sm:col-span-5">
                            <Select
                              id={`select-product-${item.rowId}`}
                              label="Pilih Produk"
                              required
                              value={item.productId}
                              onChange={(e) =>
                                handleItemChange(item.rowId, "productId", e.target.value)
                              }
                              disabled={isSubmitting}
                              errorMessage={fieldErrors[`item-${index}-productId`]}
                              options={[
                                { value: "", label: "-- Pilih Produk Aktif --" },
                                ...activeProducts.map((p) => ({
                                  value: p.id,
                                  label: `${p.name} (Stok: ${p.stockQuantity} | HPP: ${formatRupiah(p.costPrice)})`,
                                })),
                              ]}
                            />
                          </div>

                          {/* Quantity */}
                          <div className="sm:col-span-3">
                            <Input
                              id={`input-qty-${item.rowId}`}
                              label="Jumlah Beli"
                              required
                              placeholder="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  item.rowId,
                                  "quantity",
                                  e.target.value.replace(/\D/g, "")
                                )
                              }
                              disabled={isSubmitting}
                              errorMessage={fieldErrors[`item-${index}-quantity`]}
                              helperText="Unit integer > 0"
                            />
                          </div>

                          {/* Unit Purchase Cost */}
                          <div className="sm:col-span-4">
                            <CurrencyInput
                              id={`input-unit-cost-${item.rowId}`}
                              label="Harga Beli Satuan"
                              required
                              placeholder="0"
                              value={parseInt(item.unitPurchaseCost.replace(/\D/g, ""), 10) || 0}
                              onValueChange={(val) =>
                                handleItemChange(
                                  item.rowId,
                                  "unitPurchaseCost",
                                  String(val)
                                )
                              }
                              disabled={isSubmitting}
                              errorMessage={fieldErrors[`item-${index}-unitCost`]}
                              helperText={`Subtotal: ${formatRupiah(subtotal)}`}
                            />
                          </div>
                        </div>

                        {/* Real-time Moving Average Cost Calculation Box */}
                        {selectedProduct && qtyNumber > 0 && (
                          <div className="p-3 rounded-lg bg-white border border-[#E7E3EC] flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4 text-[#5B3CC4] shrink-0" aria-hidden="true" />
                              <span className="text-[#716D7A]">
                                Stok saat ini: <strong>{currentStock} unit</strong> | HPP lama:{" "}
                                <strong>{formatRupiah(currentHpp)}</strong>
                              </span>
                            </div>
                            <div className="font-semibold text-[#5B3CC4]">
                              Estimasi HPP Baru (MWAC): {formatRupiah(estimatedNewHpp)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Total Cost Bar */}
                  <div className="p-4 rounded-xl bg-[#F6F3FF] border border-[#EAE4FF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-[#716D7A] block">Total Transaksi Pembelian</span>
                      <span className="text-2xl font-bold text-[#5B3CC4]">
                        {formatRupiah(calculatedTotalCost)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Link href="/purchases" className="w-full sm:w-auto">
                        <Button variant="ghost" type="button" disabled={isSubmitting} className="w-full sm:w-auto">
                          Batal
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        type="submit"
                        isLoading={isSubmitting}
                        disabled={isSubmitting}
                        leftIcon={<ArrowUpCircle className="w-4 h-4" aria-hidden="true" />}
                        className="w-full sm:w-auto"
                        id="btn-submit-purchase"
                      >
                        Simpan Pembelian Stok
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function NewPurchaseView({
  initialProducts,
}: PurchaseFormContentProps = {}) {
  return (
    <AppLayout title="Catat Pembelian Stok" currentPath="/purchases">
      <React.Suspense
        fallback={
          <div className="space-y-4 max-w-4xl mx-auto p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <PurchaseFormContent initialProducts={initialProducts} />
      </React.Suspense>
    </AppLayout>
  );
}
