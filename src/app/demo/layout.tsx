import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mode Demo — VeyraOS",
  description:
    "Simulasi manajemen bisnis dan keuangan UMKM Toko Sembako Sejahtera tanpa login. Terisolasi penuh di peramban Anda.",
};

export default function DemoRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
