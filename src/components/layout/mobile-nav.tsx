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
      className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-[#E5E1EC] z-30 lg:hidden flex items-center justify-around px-2 shadow-[0_-2px_12px_rgba(26,24,32,0.05)]"
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
              "flex flex-col items-center justify-center flex-1 h-[48px] py-1 text-[10px] font-medium transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-xl min-h-[44px] active:scale-95",
              isActive
                ? "text-[#5B3CC4] font-bold bg-[#F4F0FD]"
                : "text-[#767182] hover:text-[#1A1820] hover:bg-[#FAF9F6]"
            )}
          >
            <Icon
              className={cn("w-5 h-5 mb-0.5 shrink-0 transition-transform stroke-[1.75]", isActive && "text-[#5B3CC4] stroke-[2]")}
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
        className="flex flex-col items-center justify-center flex-1 h-[48px] py-1 text-[10px] font-medium text-[#767182] hover:text-[#1A1820] hover:bg-[#FAF9F6] transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] rounded-xl min-h-[44px] cursor-pointer active:scale-95"
      >
        <Menu className="w-5 h-5 mb-0.5 shrink-0 text-[#767182] stroke-[1.75]" aria-hidden="true" />
        <span>Lainnya</span>
      </button>
    </nav>
  );
}
