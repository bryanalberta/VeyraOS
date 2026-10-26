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

export interface DemoNavGroup {
  title: string;
  items: DemoNavItem[];
}

export const DEMO_NAV_GROUPS: DemoNavGroup[] = [
  {
    title: "Utama",
    items: [DEMO_NAV_ITEMS[0]],
  },
  {
    title: "Operasional",
    items: [DEMO_NAV_ITEMS[1], DEMO_NAV_ITEMS[2], DEMO_NAV_ITEMS[4]],
  },
  {
    title: "Keuangan",
    items: [DEMO_NAV_ITEMS[3], DEMO_NAV_ITEMS[5]],
  },
  {
    title: "Sistem",
    items: [DEMO_NAV_ITEMS[6]],
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
          className="fixed inset-0 bg-[#1A1820]/40 backdrop-blur-xs z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar Navigasi Mode Demo"
        className={cn(
          "fixed top-0 bottom-0 left-0 w-64 bg-[#FFFFFF] border-r border-[#E5E1EC] flex flex-col z-40 transition-transform duration-200 ease-in-out lg:translate-x-0 shadow-xs",
          isOpenMobile ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-[#E5E1EC] flex items-center justify-between shrink-0 bg-white">
          <Link
            href="/demo/dashboard"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-lg"
          >
            <BrandSymbol size="md" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#1A1820] text-base tracking-tight leading-none">
                  VeyraOS
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#FFD54F] text-[#25232B] font-bold uppercase tracking-wider border border-[#FBC02D]">
                  DEMO
                </span>
              </div>
              <span className="text-[10px] text-[#767182] font-medium leading-tight mt-0.5">
                Simulasi Lokal Sandboxed
              </span>
            </div>
          </Link>
        </div>

        {/* Business Context Slot: Toko Sembako Sejahtera */}
        <div className="p-3 border-b border-[#E5E1EC] bg-[#FAF9F6]">
          <div
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[#E5E1EC] bg-white min-h-[44px] shadow-2xs"
            role="region"
            aria-label="Profil Bisnis Simulasi"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F4F0FD] to-[#EAE4FF] border border-[#DDD5F5] text-[#5B3CC4] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                <Store className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="truncate min-w-0">
                <div className="text-xs font-bold text-[#1A1820] truncate leading-tight">
                  Toko Sembako Sejahtera
                </div>
                <div className="text-[10px] text-[#767182] truncate leading-tight mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D894F]" aria-hidden="true" />
                  <span>Kelontong / Sembako</span>
                </div>
              </div>
            </div>
            <span
              className="text-[10px] font-bold text-[#7D6608] bg-[#FEF9E7] border border-[#FAD7A0] px-2 py-0.5 rounded-md shrink-0 ml-1 select-none"
              title="Data simulasi lokal"
            >
              Simulasi
            </span>
          </div>
        </div>

        {/* Grouped Navigation Menu */}
        <nav
          aria-label="Navigasi Menu Demo"
          className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
        >
          {DEMO_NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9C97A8] select-none">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
                          "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 min-h-[40px] select-none",
                          isActive
                            ? "bg-[#F3F0FC] text-[#5B3CC4] font-semibold border-l-[3px] border-[#5B3CC4] pl-2.5 shadow-2xs"
                            : "text-[#4A4654] hover:bg-[#F8F7FA] hover:text-[#1A1820]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-4.5 h-4.5 shrink-0 transition-colors stroke-[1.75]",
                            isActive ? "text-[#5B3CC4]" : "text-[#767182]"
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate flex-1">{item.label}</span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5B3CC4]" aria-hidden="true" />
                        )}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-[#A09AA8] cursor-not-allowed select-none min-h-[40px]"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4.5 h-4.5 shrink-0 text-[#C4BFCB]" aria-hidden="true" />
                        <span>{item.label}</span>
                      </div>
                      {item.stageNote && (
                        <span className="text-[10px] text-[#716D7A] bg-[#F0EDF5] px-1.5 py-0.5 rounded">
                          {item.stageNote}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-[#E5E1EC] bg-[#FAF9F6] text-xs text-[#767182] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0D894F]" aria-hidden="true" />
            <span className="font-semibold text-[#1A1820]">VeyraOS Demo</span>
            <span className="text-[11px] text-[#9C97A8]">v1.0</span>
          </div>
          <span className="text-[10px] bg-[#FEF9E7] text-[#7D6608] font-bold px-2 py-0.5 rounded-md border border-[#FAD7A0]">
            IDR · Sandboxed
          </span>
        </div>
      </aside>
    </>
  );
}
