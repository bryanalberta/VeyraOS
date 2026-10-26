"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Info,
  ArrowUpCircle,
} from "lucide-react";
import { z } from "zod";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { createProductAction } from "@/app/actions/products";
import {
  rupiahSchema,
  rupiahPositiveSchema,
} from "@/lib/validations/common";

const clientCreateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama produk wajib diisi (minimal 1 karakter)")
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
  costPrice: rupiahSchema,
});

type FormValues = {
  name: string;
  sku: string;
  category: string;
  sellingPrice: string;
  costPrice: string;
};

export default function CreateProductPage() {
  const router = useRouter();

  const [formValues, setFormValues] = React.useState<FormValues>({
    name: "",
    sku: "",
    category: "",
    sellingPrice: "",
    costPrice: "0",
  });

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleChange = (field: keyof FormValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
    // Hapus pesan error saat pengguna mulai mengetik ulang
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setGeneralError(null);
    setFieldErrors({});

    // Parse input harga menjadi integer
    const parsedSellingPrice = parseInt(formValues.sellingPrice.replace(/\D/g, ""), 10) || 0;
    const parsedCostPrice = parseInt(formValues.costPrice.replace(/\D/g, ""), 10) || 0;

    const payloadToValidate = {
      name: formValues.name,
      sku: formValues.sku.trim() ? formValues.sku.trim() : undefined,
      category: formValues.category.trim() ? formValues.category.trim() : undefined,
      sellingPrice: parsedSellingPrice,
      costPrice: parsedCostPrice,
    };

    const validationResult = clientCreateProductSchema.safeParse(payloadToValidate);
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
      // PERINGATAN INTEGRITAS: stockQuantity WAJIB 0
      const response = await createProductAction({
        name: validationResult.data.name,
        sku: validationResult.data.sku,
        category: validationResult.data.category,
        sellingPrice: validationResult.data.sellingPrice,
        costPrice: validationResult.data.costPrice,
        stockQuantity: 0,
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
        setGeneralError(
          response.error?.message || "Gagal mendaftarkan produk baru ke katalog."
        );
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/products");
      }, 1200);
    } catch {
      setGeneralError("Terjadi kegagalan jaringan saat mengirimkan data produk.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Tambah Produk Baru" currentPath="/products">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button
              variant="outline"
              size="icon"
              aria-label="Kembali ke Katalog Produk"
              id="btn-back-to-products"
            >
              <ArrowLeft className="w-4 h-4 text-[#25232B]" aria-hidden="true" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B]">
              Tambah Produk Baru
            </h1>
            <p className="text-xs sm:text-sm text-[#716D7A]">
              Daftarkan barang dagangan baru ke katalog bisnis Anda.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {isSuccess && (
          <Alert variant="success" title="Produk Berhasil Ditambahkan">
            Produk berhasil disimpan ke dalam katalog. Mengalihkan Anda ke daftar produk...
          </Alert>
        )}

        {/* Error Alert */}
        {generalError && (
          <Alert variant="danger" title="Gagal Menyimpan Produk">
            {generalError}
          </Alert>
        )}

        {/* Product Form Card */}
        <Card className="bg-white border border-[#E7E3EC]">
          <CardHeader>
            <CardTitle>Informasi Dasar Produk</CardTitle>
            <CardDescription>
              Lengkapi nama, identitas SKU, dan penetapan harga dasar produk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Product Name */}
              <Input
                id="product-name-input"
                label="Nama Produk"
                required
                placeholder="Contoh: Kopi Arabika Gayo 250g"
                value={formValues.name}
                onChange={handleChange("name")}
                errorMessage={fieldErrors.name}
                disabled={isSubmitting || isSuccess}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SKU Code */}
                <Input
                  id="product-sku-input"
                  label="SKU / Kode Barang"
                  placeholder="Contoh: KPG-250 (Opsional)"
                  value={formValues.sku}
                  onChange={handleChange("sku")}
                  errorMessage={fieldErrors.sku}
                  helperText="Harus unik per bisnis jika diisi."
                  disabled={isSubmitting || isSuccess}
                />

                {/* Category */}
                <Input
                  id="product-category-input"
                  label="Kategori"
                  placeholder="Contoh: Minuman, Sembako (Opsional)"
                  value={formValues.category}
                  onChange={handleChange("category")}
                  errorMessage={fieldErrors.category}
                  disabled={isSubmitting || isSuccess}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Selling Price */}
                <Input
                  id="product-selling-price-input"
                  label="Harga Jual Satuan"
                  required
                  placeholder="0"
                  value={formValues.sellingPrice}
                  onChange={(e) => {
                    const rawVal = e.target.value.replace(/\D/g, "");
                    setFormValues((prev) => ({ ...prev, sellingPrice: rawVal }));
                    if (fieldErrors.sellingPrice) {
                      setFieldErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.sellingPrice;
                        return updated;
                      });
                    }
                  }}
                  leftIcon={<span className="text-xs font-bold text-[#716D7A]">Rp</span>}
                  errorMessage={fieldErrors.sellingPrice}
                  helperText="Harga jual kepada pelanggan di kasir."
                  disabled={isSubmitting || isSuccess}
                />

                {/* Baseline Cost Price */}
                <Input
                  id="product-cost-price-input"
                  label="Harga Pokok Dasar (HPP Awal)"
                  placeholder="0"
                  value={formValues.costPrice}
                  onChange={(e) => {
                    const rawVal = e.target.value.replace(/\D/g, "");
                    setFormValues((prev) => ({ ...prev, costPrice: rawVal }));
                    if (fieldErrors.costPrice) {
                      setFieldErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.costPrice;
                        return updated;
                      });
                    }
                  }}
                  leftIcon={<span className="text-xs font-bold text-[#716D7A]">Rp</span>}
                  errorMessage={fieldErrors.costPrice}
                  helperText="Estimasi modal per unit saat belum ada restock."
                  disabled={isSubmitting || isSuccess}
                />
              </div>

              {/* Initial Stock Policy Notice (Fail-Closed Enforcement) */}
              <div className="p-4 rounded-lg bg-[#F6F3FF] border border-[#EAE4FF] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#5B3CC4] shrink-0" aria-hidden="true" />
                    <span className="text-xs font-bold text-[#5B3CC4]">
                      Stok Awal Persediaan
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono border-[#5B3CC4] text-[#5B3CC4]">
                    0 Unit (Terkunci)
                  </Badge>
                </div>
                <p className="text-xs text-[#5B3CC4]/90 leading-relaxed">
                  Sesuai standar audit persediaan VeyraOS, seluruh produk baru wajib didaftarkan dengan
                  stok awal <strong>0 unit</strong>. Penambahan kuantitas fisik persediaan dan pembentukan
                  HPP rata-rata (Moving Weighted Average) dilakukan secara akurat melalui alur{" "}
                  <strong>Pembelian Stok (Restock)</strong>.
                </p>
                <div className="pt-1">
                  <Link
                    href="/purchases/new"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B3CC4] hover:underline"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Buka menu Pembelian Stok setelah mendaftarkan produk</span>
                  </Link>
                </div>
              </div>

              {/* Submit Button Bar */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EDF5]">
                <Link href="/products">
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={isSubmitting || isSuccess}
                  >
                    Batal
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || isSuccess}
                  id="btn-submit-create-product"
                >
                  Simpan Produk
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
