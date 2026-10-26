"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, ArrowRight, Lock, Mail, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { BrandLogo } from "@/components/ui/brand-logo";
import { signUpAction } from "@/app/actions/auth";
import { signUpSchema } from "@/lib/validations/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  // State jika pendaftaran berhasil dan memerlukan verifikasi email oleh Supabase
  const [emailConfirmationRequired, setEmailConfirmationRequired] = React.useState(false);
  const [registeredEmail, setRegisteredEmail] = React.useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Client-side validation using Zod
    const validation = signUpSchema.safeParse({ fullName, email, password });
    if (!validation.success) {
      const errors: { fullName?: string; email?: string; password?: string } = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as "fullName" | "email" | "password";
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUpAction({ fullName, email, password });

      if (!result.success) {
        setErrorMessage(
          result.error.message || "Gagal mendaftarkan akun. Silakan coba kembali."
        );
        setIsSubmitting(false);
        return;
      }

      // Periksa apakah konfirmasi email diwajibkan oleh Supabase Auth
      if (result.data.requiresEmailConfirmation) {
        setRegisteredEmail(result.data.email);
        setEmailConfirmationRequired(true);
        setIsSubmitting(false);
        return;
      }

      // Jika sesi langsung aktif (misal auto-confirm aktif), lanjutkan ke onboarding bisnis
      if (result.data.sessionEstablished) {
        router.push("/onboarding/create-business");
        router.refresh();
      } else {
        // Fallback aman: arahkan ke login
        router.push("/login");
        router.refresh();
      }
    } catch {
      setErrorMessage("Terjadi kesalahan sistem saat mendaftarkan akun.");
      setIsSubmitting(false);
    }
  };

  // Tampilan Berhasil: Konfirmasi Email Diwajibkan
  if (emailConfirmationRequired) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 antialiased">
        <div className="w-full max-w-md space-y-6">
          <Card className="border border-[#E7E3EC] shadow-sm bg-white text-center p-4 sm:p-6">
            <CardHeader className="space-y-3 pb-4">
              <div className="w-14 h-14 rounded-full bg-[#E8F8F0] border border-[#A3E4D7] text-[#1E824C] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl font-bold text-[#25232B]">
                Tautan Konfirmasi Terkirim
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                Kami telah mengirimkan email verifikasi ke{" "}
                <span className="font-semibold text-[#25232B]">{registeredEmail}</span>.
                Silakan buka tautan tersebut untuk mengaktifkan akun Anda sebelum masuk.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              <div className="p-3 bg-[#F6F3FF] rounded-lg border border-[#EAE4FF] text-left text-xs text-[#5B3CC4] space-y-1">
                <p className="font-semibold">Tips:</p>
                <p className="text-[11px] text-[#716D7A]">
                  Jika email belum sampai dalam 2 menit, periksa folder Spam atau Promosi Anda.
                </p>
              </div>

              <Link href="/login" className="block w-full">
                <Button variant="primary" size="md" className="w-full">
                  Menuju Halaman Masuk
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 antialiased">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-lg p-1"
          >
            <BrandLogo size="lg" />
          </Link>
          <p className="text-xs sm:text-sm text-[#716D7A] font-medium">
            Mulai kelola operasional dan keuangan usaha Anda dengan rapi.
          </p>
        </div>

        {/* Register Form Card */}
        <Card className="border border-[#E7E3EC] shadow-sm bg-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg sm:text-xl font-bold text-[#25232B]">
              Daftar Akun Pemilik Usaha
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-[#716D7A]">
              Gratis untuk UMKM. Tanpa kartu kredit atau biaya tersembunyi.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <Alert variant="danger" title="Pendaftaran Gagal">
                  {errorMessage}
                </Alert>
              )}

              <Input
                id="register-fullname"
                type="text"
                label="Nama Lengkap"
                required
                autoComplete="name"
                placeholder="Contoh: Budi Santoso"
                value={fullName}
                disabled={isSubmitting}
                onChange={(e) => setFullName(e.target.value)}
                errorMessage={fieldErrors.fullName}
                leftIcon={<User className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              <Input
                id="register-email"
                type="email"
                label="Alamat Email"
                required
                autoComplete="email"
                placeholder="budi@tokoberkah.com"
                value={email}
                disabled={isSubmitting}
                onChange={(e) => setEmail(e.target.value)}
                errorMessage={fieldErrors.email}
                leftIcon={<Mail className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              <Input
                id="register-password"
                type="password"
                label="Kata Sandi"
                required
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                helperText="Gunakan minimal 8 karakter dengan kombinasi angka dan huruf"
                value={password}
                disabled={isSubmitting}
                onChange={(e) => setPassword(e.target.value)}
                errorMessage={fieldErrors.password}
                leftIcon={<Lock className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="w-full font-semibold mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                Daftar Akun Bisnis
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2 text-center text-xs text-[#716D7A] border-t border-[#F0EDF5]">
            <p>
              Sudah memiliki akun?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#5B3CC4] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5B3CC4] rounded"
              >
                Masuk ke Akun Anda
              </Link>
            </p>

            <div className="pt-1">
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#716D7A] hover:text-[#25232B] transition-colors p-1"
              >
                <Store className="w-3.5 h-3.5 text-[#5B3CC4]" aria-hidden="true" />
                <span>Coba Dulu di Mode Demo (Tanpa Akun)</span>
              </Link>
            </div>
          </CardFooter>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-[#716D7A]">
          &copy; 2026 VeyraOS. Platform Manajemen Operasional &amp; Keuangan UMKM.
        </p>
      </div>
    </div>
  );
}
