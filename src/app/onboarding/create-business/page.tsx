"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, ArrowRight, Phone, MapPin, Tag, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import { createBusinessAction, getActiveTenantContextAction } from "@/app/actions/business";
import { createBusinessSchema } from "@/lib/validations/business";

const BUSINESS_CATEGORIES = [
  "Sembako / Kelontong",
  "Kuliner / Makanan & Minuman",
  "Fashion / Pakaian",
  "Elektronik & Gadget",
  "Kesehatan & Kecantikan",
  "Jasa",
  "Lainnya",
];

export default function CreateBusinessOnboardingPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("Sembako / Kelontong");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCheckingContext, setIsCheckingContext] = React.useState(true);
  const [alreadyHasBusiness, setAlreadyHasBusiness] = React.useState(false);
  const [existingBusinessName, setExistingBusinessName] = React.useState<string | null>(null);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    category?: string;
    phone?: string;
    address?: string;
  }>({});

  // Cek apakah pengguna sudah memiliki bisnis sebelumnya
  React.useEffect(() => {
    let isMounted = true;

    async function checkTenantContext() {
      try {
        const result = await getActiveTenantContextAction();
        if (isMounted && result.success && result.data.hasBusiness && result.data.activeBusiness) {
          setAlreadyHasBusiness(true);
          setExistingBusinessName(result.data.activeBusiness.name);
        }
      } catch {
        // Safe fallback, pengguna dapat tetap mengisi formulir
      } finally {
        if (isMounted) {
          setIsCheckingContext(false);
        }
      }
    }

    checkTenantContext();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const payload = {
      name: name.trim(),
      category: category.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
    };

    // Client-side validation using Zod schema
    const validation = createBusinessSchema.safeParse(payload);
    if (!validation.success) {
      const errors: { name?: string; category?: string; phone?: string; address?: string } = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as "name" | "category" | "phone" | "address";
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBusinessAction(payload);

      if (!result.success) {
        setErrorMessage(
          result.error.message || "Gagal membuat profil bisnis. Silakan coba kembali."
        );
        setIsSubmitting(false);
        return;
      }

      // Pembuatan bisnis berhasil dan cookie aktif telah ditetapkan di server:
      // Arahkan pengguna langsung ke Dashboard aplikasi
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan sistem saat mendaftarkan bisnis.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 antialiased">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-lg p-1"
          >
            <BrandLogo size="lg" />
          </Link>
          <div className="flex justify-center">
            <Badge variant="default" icon={<Building2 className="w-3 h-3" />}>
              Langkah Onboarding: Profil Usaha
            </Badge>
          </div>
        </div>

        {/* Existing Business Notice if already has business */}
        {alreadyHasBusiness && !isCheckingContext && (
          <Alert variant="info" title="Anda Sudah Memiliki Bisnis Aktif">
            Saat ini Anda sudah terdaftar pada usaha{" "}
            <span className="font-semibold text-[#1B4F72]">{existingBusinessName}</span>. Anda
            dapat melanjutkan pembuatan cabang/toko baru (maksimal 5 toko pada MVP), atau langsung{" "}
            <Link
              href="/dashboard"
              className="font-bold underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2980B9]"
            >
              kembali ke Dashboard
            </Link>
            .
          </Alert>
        )}

        {/* Onboarding Form Card */}
        <Card className="border border-[#E7E3EC] shadow-sm bg-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg sm:text-xl font-bold text-[#25232B]">
              Daftarkan Toko / Usaha Anda
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-[#716D7A]">
              Isi informasi dasar toko Anda untuk memulai pencatatan produk, transaksi kasir, dan laporan keuangan.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <Alert variant="danger" title="Pendaftaran Toko Gagal">
                  {errorMessage}
                </Alert>
              )}

              <Input
                id="biz-name"
                type="text"
                label="Nama Toko / Usaha"
                required
                placeholder="Contoh: Toko Sembako Berkah"
                value={name}
                disabled={isSubmitting}
                onChange={(e) => setName(e.target.value)}
                errorMessage={fieldErrors.name}
                leftIcon={<Store className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              {/* Kategori Usaha Select */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="biz-category"
                  className="block text-xs font-semibold text-[#25232B] select-none"
                >
                  Bidang / Kategori Usaha
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center pointer-events-none text-[#716D7A]">
                    <Tag className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <select
                    id="biz-category"
                    value={category}
                    disabled={isSubmitting}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-md border border-[#E7E3EC] bg-white pl-9 pr-3 py-2 text-sm text-[#25232B] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[rgba(91,60,196,0.28)] disabled:cursor-not-allowed disabled:bg-[#F0EDF5] min-h-[44px] sm:min-h-[40px] cursor-pointer"
                  >
                    {BUSINESS_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                id="biz-phone"
                type="tel"
                label="Nomor Telepon / WhatsApp (Opsional)"
                placeholder="Contoh: 081234567890"
                value={phone}
                disabled={isSubmitting}
                onChange={(e) => setPhone(e.target.value)}
                errorMessage={fieldErrors.phone}
                leftIcon={<Phone className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              <Input
                id="biz-address"
                type="text"
                label="Alamat Toko (Opsional)"
                placeholder="Contoh: Jl. Merdeka No. 10, Jakarta"
                value={address}
                disabled={isSubmitting}
                onChange={(e) => setAddress(e.target.value)}
                errorMessage={fieldErrors.address}
                leftIcon={<MapPin className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              <div className="p-3 bg-[#FAF9F6] rounded-lg border border-[#E7E3EC] text-xs text-[#716D7A] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[#25232B]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E824C]" aria-hidden="true" />
                  <span>Pengaturan Regional Otomatis:</span>
                </div>
                <p className="text-[11px]">
                  Mata Uang: <strong>Rupiah (IDR)</strong> &bull; Zona Waktu: <strong>WIB (Asia/Jakarta)</strong>
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="w-full font-semibold mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                Mulai Kelola Bisnis
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center pt-2 text-center text-xs text-[#716D7A] border-t border-[#F0EDF5]">
            <p>
              Perlu bantuan? Hubungi tim panduan VeyraOS di{" "}
              <span className="font-semibold text-[#5B3CC4]">support@veyraos.com</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
