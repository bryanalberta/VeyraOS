"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { BrandLogo } from "@/components/ui/brand-logo";
import { signInAction } from "@/app/actions/auth";
import { signInSchema } from "@/lib/validations/auth";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo") || "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Client-side validation using Zod
    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors: { email?: string; password?: string } = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as "email" | "password";
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signInAction({ email, password });

      if (!result.success) {
        setErrorMessage(result.error.message || "Gagal masuk. Periksa kembali kredensial Anda.");
        setIsSubmitting(false);
        return;
      }

      // Login berhasil: alihkan ke target atau dashboard
      router.push(redirectTo);
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan. Silakan periksa koneksi Anda.");
      setIsSubmitting(false);
    }
  };

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
            Run your business. <span className="text-[#5B3CC4] font-semibold">Know your numbers.</span>
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border border-[#E7E3EC] shadow-sm bg-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg sm:text-xl font-bold text-[#25232B]">
              Masuk ke Akun Anda
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-[#716D7A]">
              Kelola toko dan pantau angka keuangan bisnis Anda secara presisi.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <Alert variant="danger" title="Gagal Masuk">
                  {errorMessage}
                </Alert>
              )}

              <Input
                id="login-email"
                type="email"
                label="Alamat Email"
                required
                autoComplete="email"
                placeholder="nama@toko.com"
                value={email}
                disabled={isSubmitting}
                onChange={(e) => setEmail(e.target.value)}
                errorMessage={fieldErrors.email}
                leftIcon={<Mail className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />}
              />

              <Input
                id="login-password"
                type="password"
                label="Kata Sandi"
                required
                autoComplete="current-password"
                placeholder="••••••••"
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
                Masuk
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2 text-center text-xs text-[#716D7A] border-t border-[#F0EDF5]">
            <p>
              Belum memiliki akun?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#5B3CC4] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5B3CC4] rounded"
              >
                Daftar Akun Bisnis Baru
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

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#5B3CC4] border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}
