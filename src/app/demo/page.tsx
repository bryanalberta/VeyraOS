"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DemoGatewayPage() {
  const router = useRouter();

  React.useEffect(() => {
    // Otomatis mengarahkan ke dashboard demo
    const timer = setTimeout(() => {
      router.replace("/demo/dashboard");
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 antialiased">
      <Card className="w-full max-w-lg border border-[#E7E3EC] bg-white shadow-lg p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#5B3CC4] flex items-center justify-center text-white shadow-md">
            <Store className="w-7 h-7" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                VeyraOS Mode Demo
              </h1>
              <Badge variant="demo" className="text-xs">
                Simulasi
              </Badge>
            </div>
            <p className="text-sm text-[#716D7A]">
              Menyiapkan simulasi interaktif <strong>Toko Sembako Sejahtera</strong>...
            </p>
          </div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#E7E3EC] rounded-xl p-4 text-xs text-[#716D7A] space-y-2">
          <div className="flex items-center gap-2 text-[#0E6251] font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Terisolasi Penuh & Aman</span>
          </div>
          <p>
            Seluruh data tersimpan secara lokal di peramban Anda. Anda bebas mencoba kasir,
            melihat laporan, dan menguji fitur tanpa memerlukan akun atau koneksi database produksi.
          </p>
        </div>

        <div className="space-y-2.5">
          <Link href="/demo/dashboard" className="w-full block">
            <Button
              type="button"
              variant="primary"
              className="w-full min-h-[44px] text-sm font-semibold"
              id="enter-demo-dashboard-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Buka Dashboard Simulasi Sekarang
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <Link href="/login" className="w-full block">
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px] text-xs text-[#716D7A]"
            >
              Kembali ke Halaman Masuk
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
