"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Settings,
  Store,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BrandSymbol } from "@/components/ui/brand-logo";

export interface DemoNavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  isAvailable: boolean;
  stageNote?: string;
}

export const DEMO_NAV_ITEMS: DemoNavItem[] = [
  {
    label: "Ringkasan",
    href: "/demo/dashboard",
    icon: LayoutDashboard,
    isAvailable: true,
  },
  {
    label: "Penjualan",
    href: "/demo/sales",
    icon: ShoppingCart,
    isAvailable: true,
  },
  {
    label: "Produk & Stok",
    href: "/demo/products",
    icon: Package,
    isAvailable: true,
  },
  {
    label: "Pengeluaran",
    href: "/demo/expenses",
    icon: ArrowDownCircle,
    isAvailable: true,
  },
  {
    label: "Pembelian",
    href: "/demo/purchases",
    icon: ArrowUpCircle,
    isAvailable: true,
  },
  {
    label: "Laporan",
    href: "/demo/reports",
    icon: FileText,
    isAvailable: true,
  },
  {
    label: "Pengaturan",
    href: "/demo/settings",
    icon: Settings,
    isAvailable: true,
  },
];

export interface DemoSidebarProps extends React.HTMLAttributes<HTMLElement> {
  currentPath?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function DemoSidebar({
  currentPath = "/demo/dashboard",
  isOpenMobile = false,
  onCloseMobile,
  className,
  ...props
}: DemoSidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[#25232B]/50 backdrop-blur-xs z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar Navigasi Mode Demo"
        className={cn(
          "fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-[#E7E3EC] flex flex-col z-40 transition-transform duration-200 ease-in-out lg:translate-x-0",
          isOpenMobile ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-[#E7E3EC] flex items-center justify-between shrink-0">
          <Link
            href="/demo/dashboard"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-md"
          >
            <BrandSymbol size="md" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#25232B] text-base tracking-tight leading-none">
                  VeyraOS
                </span>
                <Badge
                  variant="demo"
                  className="text-[9px] px-1.5 py-0 bg-[#FFD54F] text-[#25232B] font-bold"
                >
                  DEMO
                </Badge>
              </div>
              <span className="text-[10px] text-[#716D7A] font-medium leading-tight mt-0.5">
                Simulasi Lokal Sandboxed
              </span>
            </div>
          </Link>
        </div>

        {/* Business Context Slot: Toko Sembako Sejahtera */}
        <div className="p-3 border-b border-[#F0EDF5] bg-[#FAF9F6]">
          <div
            className="w-full flex items-center justify-between p-2 rounded-lg border border-[#E7E3EC] bg-white min-h-[44px]"
            role="region"
            aria-label="Profil Bisnis Simulasi"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-[#F6F3FF] border border-[#EAE4FF] text-[#5B3CC4] flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-[#25232B] truncate leading-tight">
                  Toko Sembako Sejahtera
                </div>
                <div className="text-[10px] text-[#716D7A] truncate leading-tight">
                  Kelontong / Sembako
                </div>
              </div>
            </div>
            <span
              className="text-[10px] font-bold text-[#7D6608] bg-[#FEF9E7] border border-[#FAD7A0] px-1.5 py-0.5 rounded shrink-0 ml-1"
              title="Data simulasi lokal"
            >
              Simulasi
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav
          aria-label="Navigasi Menu Demo"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
        >
          {DEMO_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.isAvailable &&
              Boolean(
                currentPath === item.href ||
                  (item.href &&
                    item.href !== "/demo/dashboard" &&
                    currentPath?.startsWith(item.href))
              );

            if (item.isAvailable && item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] select-none",
                    isActive
                      ? "bg-[#F6F3FF] text-[#5B3CC4] font-semibold"
                      : "text-[#25232B] hover:bg-[#F6F3FF] hover:text-[#5B3CC4]"
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] bg-[#5B3CC4] rounded-r"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "w-5 h-5 shrink-0 transition-colors",
                        isActive ? "text-[#5B3CC4]" : "text-[#716D7A]"
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5B3CC4]" aria-hidden="true" />
                  )}
                </Link>
              );
            }

            // Menu yang belum tersedia pada langkah 4B (ditandai jujur, tidak mengarah ke produksi)
            return (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-[#A09AA8] cursor-not-allowed select-none min-h-[44px] bg-[#FAF9F6]/60 border border-transparent hover:border-[#E7E3EC]"
                title={`Modul ${item.label} sedang disiapkan pada ${item.stageNote}.`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0 text-[#C4BFCB]" aria-hidden="true" />
                  <span className="text-[#8D8896]">{item.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#A09AA8]" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-[#716D7A] bg-[#F0EDF5] px-1.5 py-0.5 rounded">
                    {item.stageNote}
                  </span>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E7E3EC] bg-[#FAF9F6] text-xs text-[#716D7A] flex items-center justify-between">
          <span className="font-medium">VeyraOS Demo v1.0</span>
          <span className="text-[10px] bg-[#FEF9E7] text-[#7D6608] font-bold px-2 py-0.5 rounded-full border border-[#FAD7A0]">
            IDR · Sandboxed
          </span>
        </div>
      </aside>
    </>
  );
}
