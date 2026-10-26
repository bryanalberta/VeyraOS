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

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [NAV_ITEMS[0]],
  },
  {
    title: "Operasional",
    items: [NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[4]],
  },
  {
    title: "Keuangan",
    items: [NAV_ITEMS[3], NAV_ITEMS[5]],
  },
  {
    title: "Sistem",
    items: [NAV_ITEMS[6]],
  },
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
          className="fixed inset-0 bg-[#1A1820]/40 backdrop-blur-xs z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar Navigasi"
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
            href="/dashboard"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-lg"
          >
            <BrandLogo size="md" showTagline tagline="Manajemen UMKM" />
          </Link>
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#F4F0FD] text-[#5B3CC4] border border-[#E7E0FA]">
            Retail
          </span>
        </div>

        {/* Business Context Switcher */}
        <div className="p-3 border-b border-[#E5E1EC] bg-[#FAF9F6]">
          <button
            type="button"
            onClick={onBusinessSwitchClick}
            aria-label="Pilih atau ganti bisnis aktif"
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[#E5E1EC] bg-white hover:bg-[#FBF9FD] hover:border-[#5B3CC4]/40 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px] shadow-2xs group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F4F0FD] to-[#EAE4FF] border border-[#DDD5F5] text-[#5B3CC4] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                {activeBusinessName.charAt(0).toUpperCase() || <Store className="w-4 h-4" aria-hidden="true" />}
              </div>
              <div className="truncate min-w-0">
                <div className="text-xs font-bold text-[#1A1820] truncate leading-tight group-hover:text-[#5B3CC4] transition-colors">
                  {activeBusinessName}
                </div>
                <div className="text-[10px] text-[#767182] truncate leading-tight mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D894F]" aria-hidden="true" />
                  <span>{businessCategory || "Bisnis Aktif"}</span>
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#9C97A8] shrink-0 ml-1 group-hover:text-[#5B3CC4] transition-colors" aria-hidden="true" />
          </button>
        </div>

        {/* Grouped Navigation Menu */}
        <nav
          aria-label="Navigasi Utama"
          className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9C97A8] select-none">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-[#E5E1EC] bg-[#FAF9F6] text-xs text-[#767182] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0D894F]" aria-hidden="true" />
            <span className="font-semibold text-[#1A1820]">VeyraOS</span>
            <span className="text-[11px] text-[#9C97A8]">v1.0</span>
          </div>
          <span className="text-[10px] bg-[#EAE4FF] text-[#5B3CC4] font-bold px-2 py-0.5 rounded-md border border-[#D5C8FF]">
            IDR · WIB
          </span>
        </div>
      </aside>
    </>
  );
}
