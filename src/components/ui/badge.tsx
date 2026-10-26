import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "demo" | "outline";
  icon?: React.ReactNode;
}

export function Badge({
  className,
  variant = "default",
  icon,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-[#F6F3FF] text-[#5B3CC4] border-[#EAE4FF]",
    success: "bg-[#E8F8F0] text-[#0E6251] border-[#A3E4D7]",
    warning: "bg-[#FEF9E7] text-[#7D6608] border-[#FAD7A0]",
    danger: "bg-[#FDEDEC] text-[#922B21] border-[#F5B7B1]",
    info: "bg-[#EBF5FB] text-[#1B4F72] border-[#AED6F1]",
    demo: "bg-[#FFD54F] text-[#25232B] font-bold border-[#FBC02D] uppercase tracking-wider",
    outline: "bg-white text-[#716D7A] border-[#E7E3EC]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0 w-3 h-3 items-center justify-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
