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
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/ui/brand-logo";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Penjualan", href: "/sales", icon: ShoppingCart },
  { label: "Produk & Stok", href: "/products", icon: Package },
  { label: "Pengeluaran", href: "/expenses", icon: ArrowDownCircle },
  { label: "Pembelian", href: "/purchases", icon: ArrowUpCircle },
  { label: "Laporan", href: "/reports", icon: FileText },
  { label: "Pengaturan", href: "/settings", icon: Settings },
];

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  currentPath?: string;
  activeBusinessName?: string;
  businessCategory?: string;
  onBusinessSwitchClick?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentPath = "/dashboard",
  activeBusinessName = "Bisnis Saya",
  businessCategory,
  onBusinessSwitchClick,
  isOpenMobile = false,
  onCloseMobile,
  className,
  ...props
}: SidebarProps) {
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
        aria-label="Sidebar Navigasi"
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
            href="/dashboard"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-md"
          >
            <BrandLogo size="md" showTagline tagline="Manajemen UMKM" />
          </Link>
        </div>

        {/* Business Context Slot */}
        <div className="p-3 border-b border-[#F0EDF5] bg-[#FAF9F6]">
          <button
            type="button"
            onClick={onBusinessSwitchClick}
            aria-label="Pilih atau ganti bisnis aktif"
            className="w-full flex items-center justify-between p-2 rounded-lg border border-[#E7E3EC] bg-white hover:bg-[#F6F3FF] hover:border-[#5B3CC4] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-[#F6F3FF] border border-[#EAE4FF] text-[#5B3CC4] flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-[#25232B] truncate leading-tight">
                  {activeBusinessName}
                </div>
                {businessCategory ? (
                  <div className="text-[10px] text-[#716D7A] truncate leading-tight">
                    {businessCategory}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#5B3CC4] font-medium leading-tight">
                    Bisnis Aktif
                  </div>
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#716D7A] shrink-0 ml-1" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav
          aria-label="Navigasi Utama"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.href ||
              (item.href !== "/dashboard" && currentPath.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] select-none",
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
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-colors",
                    isActive ? "text-[#5B3CC4]" : "text-[#716D7A]"
                  )}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E7E3EC] bg-[#FAF9F6] text-xs text-[#716D7A] flex items-center justify-between">
          <span className="font-medium">VeyraOS v1.0</span>
          <span className="text-[10px] bg-[#EAE4FF] text-[#5B3CC4] font-bold px-2 py-0.5 rounded-full">
            IDR · WIB
          </span>
        </div>
      </aside>
    </>
  );
}
