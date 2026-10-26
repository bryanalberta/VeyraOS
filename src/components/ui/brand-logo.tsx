import * as React from "react";
import { cn } from "@/lib/utils";

export type BrandLogoSize = "sm" | "md" | "lg" | "xl";

export interface BrandSymbolProps extends React.SVGAttributes<SVGSVGElement> {
  size?: BrandLogoSize | number;
  className?: string;
}

const SIZE_MAP: Record<BrandLogoSize, number> = {
  sm: 20,
  md: 28,
  lg: 38,
  xl: 48,
};

/**
 * BrandSymbol — Simbol geometris resmi VeyraOS.
 * Menggabungkan siluet huruf V dengan dua facet arsitektural:
 * - Sayap Kiri: Fondasi operasional pembukuan (ledger foundation) bergaris tegas.
 * - Sayap Kanan: Kurva pertumbuhan finansial UMKM (growth trajectory) terintegrasi.
 * - Gold Node: Aksen titik presisi kalkulasi moneter integer (#FFD54F).
 */
export function BrandSymbol({
  size = "md",
  className,
  ...props
}: BrandSymbolProps) {
  const dimension = typeof size === "number" ? size : SIZE_MAP[size] || 28;

  // Unique ID prefix for gradients to prevent clashes across multi-instance rendering
  const id = React.useId().replace(/:/g, "");
  const bgGradId = `veyra-bg-${id}`;
  const rightGradId = `veyra-right-${id}`;

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0 select-none", className)}
      {...props}
    >
      <defs>
        <linearGradient
          id={bgGradId}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5B3CC4" />
          <stop offset="100%" stopColor="#392477" />
        </linearGradient>
        <linearGradient
          id={rightGradId}
          x1="14"
          y1="22"
          x2="26"
          y2="8"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#EAE4FF" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>

      {/* Squircle Background Base */}
      <rect width="32" height="32" rx="7.5" fill={`url(#${bgGradId})`} />

      {/* Left Foundation Facet: Operasional & Ledger Base */}
      <path
        d="M7 8.5H12L16 17.5L12.5 24.5H7.5L7 8.5Z"
        fill="#FFFFFF"
        fillOpacity="0.96"
      />

      {/* Right Trajectory Facet: Pertumbuhan Omzet & Laba */}
      <path
        d="M15.5 24.5L25 8.5H20L13.5 19.5L15.5 24.5Z"
        fill={`url(#${rightGradId})`}
      />

      {/* Subtle Bevel Shading: Kedalaman Dimensional */}
      <path
        d="M12 8.5L16 17.5L13.5 19.5L10 12.5Z"
        fill="#392477"
        fillOpacity="0.22"
      />

      {/* Golden Precision Node: Integritas Finansial Integer Tanpa Desimal */}
      <circle cx="21" cy="8.5" r="1.75" fill="#FFD54F" />
    </svg>
  );
}

export interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: BrandLogoSize;
  showWordmark?: boolean;
  showTagline?: boolean;
  tagline?: string;
  variant?: "default" | "on-dark";
  symbolClassName?: string;
}

const WORDMARK_SIZE_CLASSES: Record<BrandLogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl sm:text-3xl font-extrabold",
};

const TAGLINE_SIZE_CLASSES: Record<BrandLogoSize, string> = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-[10px] sm:text-xs",
  xl: "text-xs sm:text-sm",
};

/**
 * BrandLogo — Komponen brand identity VeyraOS terpadu dan reusable.
 * Menyajikan BrandSymbol dipadukan dengan wordmark "VeyraOS" dan tagline resmi.
 */
export function BrandLogo({
  size = "md",
  showWordmark = true,
  showTagline = false,
  tagline = "Business & Finance Engine",
  variant = "default",
  symbolClassName,
  className,
  ...props
}: BrandLogoProps) {
  const isDark = variant === "on-dark";

  return (
    <div
      className={cn("inline-flex items-center gap-2.5", className)}
      {...props}
    >
      <BrandSymbol size={size} className={symbolClassName} />

      {showWordmark && (
        <div className="flex flex-col text-left leading-none">
          <span
            className={cn(
              "font-bold tracking-tight",
              WORDMARK_SIZE_CLASSES[size],
              isDark ? "text-white" : "text-[#25232B]"
            )}
          >
            VeyraOS
          </span>

          {showTagline && (
            <span
              className={cn(
                "font-medium tracking-wide mt-0.5",
                TAGLINE_SIZE_CLASSES[size],
                isDark ? "text-[#FAF9F6]/80" : "text-[#716D7A]"
              )}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
