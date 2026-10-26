import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileNavProps {
  currentPath?: string;
  onMoreMenuClick?: () => void;
}

export function MobileNav({ currentPath = "/dashboard", onMoreMenuClick }: MobileNavProps) {
  const PRIMARY_MOBILE_LINKS = [
    { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
    { label: "Penjualan", href: "/sales", icon: ShoppingCart },
    { label: "Produk", href: "/products", icon: Package },
    { label: "Laporan", href: "/reports", icon: FileText },
  ];

  return (
    <nav
      aria-label="Navigasi Bawah Ponsel"
      className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E7E3EC] z-30 lg:hidden flex items-center justify-around px-1 shadow-[0_-2px_10px_rgba(37,35,43,0.04)]"
    >
      {PRIMARY_MOBILE_LINKS.map((item) => {
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
              "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-md min-h-[44px]",
              isActive
                ? "text-[#5B3CC4] font-bold"
                : "text-[#716D7A] hover:text-[#25232B]"
            )}
          >
            <Icon
              className={cn("w-5 h-5 mb-1 shrink-0", isActive ? "text-[#5B3CC4]" : "text-[#716D7A]")}
              aria-hidden="true"
            />
            <span className="truncate max-w-[64px]">{item.label}</span>
          </Link>
        );
      })}

      {/* Button for More Menu / Drawer */}
      <button
        type="button"
        onClick={onMoreMenuClick}
        aria-label="Buka menu navigasi lainnya"
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium text-[#716D7A] hover:text-[#25232B] transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-md min-h-[44px] cursor-pointer"
      >
        <Menu className="w-5 h-5 mb-1 shrink-0 text-[#716D7A]" aria-hidden="true" />
        <span>Lainnya</span>
      </button>
    </nav>
  );
}
