"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  Building2,
  Store,
  Globe,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActiveTenantContextAction,
  updateBusinessAction,
} from "@/app/actions/business";
import type { BusinessResponseData } from "@/types/api";
import type { BusinessRole } from "@/types/database";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper: Format Tanggal & Waktu Lokal Indonesia (WIB)
// ---------------------------------------------------------------------------
function formatDateTime(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return "-";
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return isoOrDateString;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return isoOrDateString;
  }
}

// ---------------------------------------------------------------------------
// Skeleton Loading Komponen
// ---------------------------------------------------------------------------
function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="settings-skeleton">
      {/* Header skeleton */}
      <div className="border-b border-[#E7E3EC] pb-5">
        <Skeleton className="h-5 w-44 mb-2" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Card 1 skeleton */}
      <Card className="p-6 bg-white border-[#E7E3EC]">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-80 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>

      {/* Card 2 skeleton */}
      <Card className="p-6 bg-white border-[#E7E3EC]">
        <Skeleton className="h-6 w-56 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props Halaman Settings
// ---------------------------------------------------------------------------
export interface SettingsContentProps {
  initialBusiness?: BusinessResponseData | null;
  initialRole?: BusinessRole | null;
}
export type SettingsPageProps = SettingsContentProps;

export function SettingsContent({
  initialBusiness,
  initialRole,
}: SettingsContentProps = {}) {
  // State Konteks Bisnis & Otorisasi
  const [business, setBusiness] = React.useState<BusinessResponseData | null>(
    initialBusiness ?? null
  );
  const [role, setRole] = React.useState<BusinessRole | null>(
    initialRole !== undefined ? initialRole : (initialBusiness ? "OWNER" : null)
  );
  const [isLoading, setIsLoading] = React.useState(initialBusiness === undefined);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // State Form Edit
  const [name, setName] = React.useState(initialBusiness?.name || "");
  const [category, setCategory] = React.useState(initialBusiness?.category || "");
  const [phone, setPhone] = React.useState(initialBusiness?.phone || "");
  const [address, setAddress] = React.useState(initialBusiness?.address || "");

  // State Penanganan Aksi
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [successBanner, setSuccessBanner] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Cek apakah pengguna memiliki izin pemilik
  const isOwner = role === "OWNER";

  // Hitung apakah ada perubahan data (isDirty)
  const isDirty = React.useMemo(() => {
    if (!business) return false;
    return (
      name.trim() !== (business.name || "").trim() ||
      category.trim() !== (business.category || "").trim() ||
      phone.trim() !== (business.phone || "").trim() ||
      address.trim() !== (business.address || "").trim()
    );
  }, [business, name, category, phone, address]);

  // ---------------------------------------------------------------------------
  // Load Active Tenant Context jika initialBusiness ditiadakan
  // ---------------------------------------------------------------------------
  const loadTenantContext = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const res = await getActiveTenantContextAction();
      if (!res.success) {
        setFetchError(res.error?.message || "Gagal memuat konteks bisnis aktif.");
        setBusiness(null);
        return;
      }

      if (!res.data.hasBusiness || !res.data.activeBusiness) {
        setBusiness(null);
        return;
      }

      const activeBiz = res.data.activeBusiness;
      setBusiness(activeBiz);
      setRole(res.data.role);
      setName(activeBiz.name || "");
      setCategory(activeBiz.category || "");
      setPhone(activeBiz.phone || "");
      setAddress(activeBiz.address || "");
    } catch {
      setFetchError("Terjadi kendala jaringan saat memuat data pengaturan bisnis.");
      setBusiness(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialBusiness !== undefined) return;
    let isMounted = true;

    getActiveTenantContextAction()
      .then((res) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (!res.success) {
          setFetchError(res.error?.message || "Gagal memuat konteks bisnis aktif.");
          setBusiness(null);
          return;
        }

        if (!res.data.hasBusiness || !res.data.activeBusiness) {
          setBusiness(null);
          return;
        }

        const activeBiz = res.data.activeBusiness;
        setBusiness(activeBiz);
        setRole(res.data.role);
        setName(activeBiz.name || "");
        setCategory(activeBiz.category || "");
        setPhone(activeBiz.phone || "");
        setAddress(activeBiz.address || "");
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
        setFetchError("Terjadi kendala jaringan saat memuat data pengaturan bisnis.");
        setBusiness(null);
      });

    return () => {
      isMounted = false;
    };
  }, [initialBusiness]);

  // ---------------------------------------------------------------------------
  // Reset Form ke Nilai Tersimpan
  // ---------------------------------------------------------------------------
  const handleResetForm = () => {
    if (!business) return;
    setName(business.name || "");
    setCategory(business.category || "");
    setPhone(business.phone || "");
    setAddress(business.address || "");
    setFieldErrors({});
    setActionError(null);
  };

  // ---------------------------------------------------------------------------
  // Submit Pembaruan Profil Bisnis
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || isSubmitting || !business) return;

    // 1. Validasi Sisi Klien
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      errors.name = "Nama usaha wajib diisi (minimal 2 karakter).";
    } else if (trimmedName.length < 2) {
      errors.name = "Nama usaha minimal 2 karakter.";
    } else if (trimmedName.length > 60) {
      errors.name = "Nama usaha maksimal 60 karakter.";
    }

    if (trimmedCategory && trimmedCategory.length > 50) {
      errors.category = "Kategori usaha maksimal 50 karakter.";
    }

    if (trimmedPhone && trimmedPhone.length > 20) {
      errors.phone = "Nomor telepon maksimal 20 karakter.";
    }

    if (trimmedAddress && trimmedAddress.length > 255) {
      errors.address = "Alamat toko maksimal 255 karakter.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await updateBusinessAction({
        businessId: business.id,
        name: trimmedName,
        category: trimmedCategory || undefined,
        phone: trimmedPhone || undefined,
        address: trimmedAddress || undefined,
      });

      if (!response.success) {
        setActionError(
          response.error?.message || "Gagal menyimpan pembaruan profil bisnis."
        );
        if (response.error?.details) {
          const detailMap: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(response.error.details)) {
            if (Array.isArray(msgs) && msgs.length > 0) {
              detailMap[key] = msgs[0];
            }
          }
          setFieldErrors(detailMap);
        }
        return;
      }

      // Berhasil disimpan
      const updated = response.data;
      setBusiness(updated);
      setName(updated.name || "");
      setCategory(updated.category || "");
      setPhone(updated.phone || "");
      setAddress(updated.address || "");
      setSuccessBanner("Pengaturan profil bisnis berhasil diperbarui.");

      setTimeout(() => {
        setSuccessBanner(null);
      }, 5000);
    } catch {
      setActionError("Terjadi kegagalan koneksi saat menyimpan pengaturan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout currentPath="/settings">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner Sukses Notifikasi */}
        {successBanner && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in"
            data-testid="settings-success-alert"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded"
              aria-label="Tutup notifikasi sukses"
            >
              &times;
            </button>
          </div>
        )}

        {/* Header Modul */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E3EC] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                {business ? business.name : "VeyraOS Business"}
              </span>
              <span className="text-xs text-[#716D7A]">• Konfigurasi Toko</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#25232B] flex items-center gap-2">
              <Settings className="h-6 w-6 text-[#5B3CC4] shrink-0" />
              Pengaturan Bisnis
            </h1>
            <p className="text-xs sm:text-sm text-[#716D7A] mt-1 max-w-2xl">
              Kelola identitas usaha, informasi kontak toko, dan konfigurasi
              regional sistem VeyraOS untuk bisnis aktif Anda.
            </p>
          </div>
        </div>

        {/* Kondisi Error Saat Membaca Data */}
        {fetchError && !isLoading && (
          <Alert variant="danger" className="p-4" data-testid="settings-fetch-error">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{fetchError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTenantContext}
                className="h-8 text-xs font-semibold shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Coba Lagi
              </Button>
            </div>
          </Alert>
        )}

        {/* Kondisi Loading Shimmer */}
        {isLoading && <SettingsSkeleton />}

        {/* Kondisi Empty State (Belum Memiliki Bisnis) */}
        {!isLoading && !business && !fetchError && (
          <Card className="p-12 text-center bg-white border-[#E7E3EC] shadow-xs" data-testid="settings-no-business">
            <div className="w-12 h-12 rounded-full bg-[#F6F3FF] text-[#5B3CC4] flex items-center justify-center mx-auto mb-3">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#25232B]">
              Belum Ada Bisnis Aktif
            </h3>
            <p className="text-xs sm:text-sm text-[#716D7A] mt-1.5 max-w-sm mx-auto">
              Akun Anda belum memiliki profil bisnis aktif. Buat bisnis pertama
              Anda untuk mengaktifkan seluruh modul pencatatan.
            </p>
            <div className="mt-5">
              <Link href="/onboarding/create-business">
                <Button variant="primary" size="sm" className="text-xs font-semibold">
                  Buat Profil Bisnis Pertama
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Konten Utama Saat Data Bisnis Siap */}
        {!isLoading && business && (
          <>
            {/* Peringatan Status Hak Akses Bukan Pemilik (Non-Owner) */}
            {!isOwner && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-xs"
                data-testid="settings-non-owner-alert"
              >
                <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-semibold text-amber-950 block">
                    Status Akses: Anggota Non-Pemilik
                  </strong>
                  <p className="text-amber-800 leading-relaxed">
                    Anda terdaftar sebagai anggota dengan hak akses non-pemilik pada
                    bisnis ini. Formulir di bawah ini ditampilkan dalam mode baca
                    saja (*read-only*). Pengubahan profil usaha hanya dapat
                    dilakukan oleh pemilik sah bisnis.
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner Aksi Simpan */}
            {actionError && (
              <Alert
                variant="danger"
                className="text-xs py-3 px-4"
                data-testid="settings-action-error"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mr-2" />
                <span>{actionError}</span>
              </Alert>
            )}

            {/* Kartu 1: Profil & Identitas Usaha */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF9F6] border-b border-[#E7E3EC] px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[#25232B]">
                      Identitas &amp; Informasi Usaha
                    </CardTitle>
                    <CardDescription className="text-xs text-[#716D7A]">
                      Informasi utama toko yang tercetak pada nota kasir dan laporan keuangan.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="p-6 space-y-4">
                  {/* Field 1: Nama Usaha */}
                  <div>
                    <label
                      htmlFor="settings-input-name"
                      className="block text-xs font-semibold text-[#25232B] mb-1.5"
                    >
                      Nama Usaha / Toko <span className="text-[#C0392B]">*</span>
                    </label>
                    <input
                      type="text"
                      id="settings-input-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) {
                          setFieldErrors((prev) => ({ ...prev, name: "" }));
                        }
                      }}
                      disabled={!isOwner || isSubmitting}
                      placeholder="Contoh: Warung Berkah Nusantara"
                      className={cn(
                        "w-full rounded-md border border-[#E7E3EC] bg-white px-3.5 py-2 text-xs text-[#25232B] placeholder:text-[#A09AA8] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-10 transition-colors disabled:bg-[#FAF9F6] disabled:text-[#716D7A] disabled:cursor-not-allowed",
                        fieldErrors.name && "border-[#C0392B] focus:ring-[#C0392B]"
                      )}
                    />
                    {fieldErrors.name ? (
                      <p className="mt-1 text-[11px] text-[#C0392B] font-medium">
                        {fieldErrors.name}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-[#716D7A]">
                        Nama toko minimal 2 karakter dan maksimal 60 karakter.
                      </p>
                    )}
                  </div>

                  {/* Field 2 & 3: Kategori & Telepon */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="settings-input-category"
                        className="block text-xs font-semibold text-[#25232B] mb-1.5"
                      >
                        Kategori / Bidang Usaha
                      </label>
                      <input
                        type="text"
                        id="settings-input-category"
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          if (fieldErrors.category) {
                            setFieldErrors((prev) => ({ ...prev, category: "" }));
                          }
                        }}
                        disabled={!isOwner || isSubmitting}
                        placeholder="Contoh: Kelontong / Sembako"
                        className={cn(
                          "w-full rounded-md border border-[#E7E3EC] bg-white px-3.5 py-2 text-xs text-[#25232B] placeholder:text-[#A09AA8] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-10 transition-colors disabled:bg-[#FAF9F6] disabled:text-[#716D7A] disabled:cursor-not-allowed",
                          fieldErrors.category && "border-[#C0392B] focus:ring-[#C0392B]"
                        )}
                      />
                      {fieldErrors.category ? (
                        <p className="mt-1 text-[11px] text-[#C0392B]">
                          {fieldErrors.category}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-[#716D7A]">
                          Jenis komoditas dagangan utama toko Anda.
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="settings-input-phone"
                        className="block text-xs font-semibold text-[#25232B] mb-1.5"
                      >
                        Nomor Telepon / WhatsApp
                      </label>
                      <input
                        type="tel"
                        id="settings-input-phone"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (fieldErrors.phone) {
                            setFieldErrors((prev) => ({ ...prev, phone: "" }));
                          }
                        }}
                        disabled={!isOwner || isSubmitting}
                        placeholder="Contoh: 08123456789"
                        className={cn(
                          "w-full rounded-md border border-[#E7E3EC] bg-white px-3.5 py-2 text-xs text-[#25232B] placeholder:text-[#A09AA8] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] h-10 transition-colors disabled:bg-[#FAF9F6] disabled:text-[#716D7A] disabled:cursor-not-allowed",
                          fieldErrors.phone && "border-[#C0392B] focus:ring-[#C0392B]"
                        )}
                      />
                      {fieldErrors.phone ? (
                        <p className="mt-1 text-[11px] text-[#C0392B]">
                          {fieldErrors.phone}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-[#716D7A]">
                          Kontak resmi toko untuk layanan pelanggan.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Field 4: Alamat Usaha */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="settings-input-address"
                        className="block text-xs font-semibold text-[#25232B]"
                      >
                        Alamat Fisik Toko
                      </label>
                      <span className="text-[11px] text-[#716D7A]">
                        {address.length} / 255 karakter
                      </span>
                    </div>
                    <textarea
                      id="settings-input-address"
                      rows={3}
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (fieldErrors.address) {
                          setFieldErrors((prev) => ({ ...prev, address: "" }));
                        }
                      }}
                      disabled={!isOwner || isSubmitting}
                      placeholder="Contoh: Jl. Surya Kencana No. 45, RT 01/RW 04, Bogor Tengah"
                      className={cn(
                        "w-full rounded-md border border-[#E7E3EC] bg-white p-3 text-xs text-[#25232B] placeholder:text-[#A09AA8] focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] transition-colors resize-none disabled:bg-[#FAF9F6] disabled:text-[#716D7A] disabled:cursor-not-allowed",
                        fieldErrors.address && "border-[#C0392B] focus:ring-[#C0392B]"
                      )}
                    />
                    {fieldErrors.address ? (
                      <p className="mt-1 text-[11px] text-[#C0392B]">
                        {fieldErrors.address}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-[#716D7A]">
                        Alamat lokasi toko yang tercetak pada tanda terima nota kasir.
                      </p>
                    )}
                  </div>
                </CardContent>

                {/* Footer Buttons (Hanya aktif untuk pemilik) */}
                <CardFooter className="bg-[#FAF9F6] border-t border-[#E7E3EC] px-6 py-3.5 flex items-center justify-between">
                  <div className="text-[11px] text-[#716D7A]">
                    {isDirty ? (
                      <span className="text-amber-700 font-medium">
                        Ada perubahan yang belum disimpan.
                      </span>
                    ) : (
                      <span>Data profil tersinkronisasi.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetForm}
                      disabled={!isOwner || isSubmitting || !isDirty}
                      className="h-9 px-4 text-xs font-semibold"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      id="submit-settings-button"
                      disabled={!isOwner || isSubmitting || !isDirty}
                      className="h-9 px-5 text-xs font-semibold shadow-xs"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Card>

            {/* Kartu 2: Konfigurasi Regional & Finansial (Sistem Baku) */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF9F6] border-b border-[#E7E3EC] px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[#25232B]">
                      Konfigurasi Regional &amp; Mata Uang
                    </CardTitle>
                    <CardDescription className="text-xs text-[#716D7A]">
                      Konfigurasi regional baku sistem untuk menjaga kepatuhan dan integritas matematis pembukuan.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Kotak Mata Uang Baku */}
                  <div className="rounded-xl border border-[#E7E3EC] bg-[#FAF9F6] p-4 flex flex-col justify-between space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#25232B]">
                        Mata Uang Basis
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                        <Lock className="w-2.5 h-2.5" />
                        Baku Sistem
                      </span>
                    </div>
                    <div>
                      <span className="text-base font-bold text-[#25232B] block">
                        Rupiah Indonesia (IDR)
                      </span>
                      <p className="text-[11px] text-[#716D7A] mt-1 leading-relaxed">
                        Seluruh pencatatan moneter menggunakan bilangan bulat integer
                        tanpa sen desimal demi menjamin keakuratan hitung kasir dan laporan.
                      </p>
                    </div>
                  </div>

                  {/* Kotak Zona Waktu Baku */}
                  <div className="rounded-xl border border-[#E7E3EC] bg-[#FAF9F6] p-4 flex flex-col justify-between space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#25232B]">
                        Zona Waktu Operasional
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                        <Lock className="w-2.5 h-2.5" />
                        Baku Sistem
                      </span>
                    </div>
                    <div>
                      <span className="text-base font-bold text-[#25232B] block">
                        Asia/Jakarta (WIB — UTC+7)
                      </span>
                      <p className="text-[11px] text-[#716D7A] mt-1 leading-relaxed">
                        Batas pergantian tanggal kalender, grafik omzet harian, dan
                        riwayat transaksi diselaraskan otomatis dengan waktu lokal Indonesia Barat.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kartu 3: Metadata Sistem & Tenant Context */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF9F6] border-b border-[#E7E3EC] px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F6F3FF] text-[#5B3CC4] border border-[#5B3CC4]/20">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[#25232B]">
                      Informasi Teknis Tenant
                    </CardTitle>
                    <CardDescription className="text-xs text-[#716D7A]">
                      Identitas unik bisnis Anda pada sistem keamanan multi-tenant VeyraOS.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#716D7A] block mb-1">ID Bisnis (UUID)</span>
                    <span
                      className="font-mono text-[11px] font-semibold text-[#25232B] bg-[#FAF9F6] p-1.5 rounded border border-[#E7E3EC] block truncate"
                      title={business.id}
                      data-testid="settings-business-id"
                    >
                      {business.id}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#716D7A] block mb-1">Hak Akses Sesi</span>
                    <span className="font-semibold text-[#25232B] flex items-center gap-1.5 py-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#5B3CC4]" />
                      {isOwner ? "Pemilik Usaha (OWNER)" : "Anggota (STAFF)"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#716D7A] block mb-1">Dibuat Pada</span>
                    <span className="font-medium text-[#25232B] flex items-center gap-1.5 py-1">
                      <Clock className="w-3.5 h-3.5 text-[#716D7A]" />
                      {formatDateTime(business.createdAt)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#716D7A] block mb-1">Terakhir Diperbarui</span>
                    <span className="font-medium text-[#25232B] flex items-center gap-1.5 py-1">
                      <RefreshCw className="w-3.5 h-3.5 text-[#716D7A]" />
                      {formatDateTime(business.updatedAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default SettingsContent;
