import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export interface StatCardTrend {
  value: number | string;
  isPositive: boolean;
  label?: string;
}

export interface StatCardProps {
  title: string;
  /**
   * Nilai metrik utama (misal string terformat atau elemen badge non-interaktif).
   * Catatan Aksesibilitas: Jika kartu interaktif (onClick diberikan), hindari menyematkan
   * elemen interaktif bersarang (seperti <button> atau <a>) di dalam value guna menjaga validitas DOM W3C.
   */
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: StatCardTrend;
  isFinancial?: boolean;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
  id?: string;
  disabled?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  isFinancial = false,
  isLoading = false,
  className,
  onClick,
  id,
  disabled = false,
}: StatCardProps) {
  const isInteractive = Boolean(onClick);

  const sharedCardClasses = cn(
    "w-full rounded-2xl border border-[#E7E3EC] bg-white p-5 sm:p-6 shadow-sm transition-all text-left select-none",
    isInteractive &&
      "cursor-pointer hover:border-[#5B3CC4]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[rgba(91,60,196,0.28)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
    className
  );

  const cardContent = (
    <>
      {/* Header baris atas: Judul dan Ikon */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="block text-xs sm:text-sm font-semibold text-[#716D7A] tracking-normal truncate">
          {title}
        </span>
        {icon && (
          <div
            className="p-2 sm:p-2.5 rounded-xl bg-[#EAE4FF] text-[#5B3CC4] shrink-0 flex items-center justify-center"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>

      {/* Nilai Statistik Utama */}
      <div className="my-1">
        {isLoading ? (
          <Skeleton className="h-8 w-36 sm:w-44 rounded-md my-1" />
        ) : (
          <div
            className={cn(
              "text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight leading-tight",
              isFinancial ? "font-financial font-mono tabular-nums" : undefined
            )}
          >
            {value}
          </div>
        )}
      </div>

      {/* Baris Bawah: Trend Badge & Subtitle */}
      {(trend || subtitle) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px]",
                trend.isPositive
                  ? "bg-[#E8F8F0] text-[#0E6251] border border-[#A3E4D7]"
                  : "bg-[#FDEDEC] text-[#922B21] border border-[#F5B7B1]"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3 text-[#1E824C]" aria-hidden="true" />
              ) : (
                <TrendingDown className="w-3 h-3 text-[#C0392B]" aria-hidden="true" />
              )}
              <span>{trend.value}</span>
            </span>
          )}

          {trend?.label && (
            <span className="text-[#716D7A]">{trend.label}</span>
          )}

          {!trend && subtitle && (
            <span className="text-[#716D7A] leading-relaxed">{subtitle}</span>
          )}
        </div>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        className={sharedCardClasses}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div id={id} className={sharedCardClasses}>
      {cardContent}
    </div>
  );
}
