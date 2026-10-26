import * as React from "react";
import { Info, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  icon?: React.ReactNode;
}

export function Alert({
  variant = "info",
  title,
  icon,
  children,
  className,
  ...props
}: AlertProps) {
  const variantStyles = {
    info: "bg-[#EBF5FB] text-[#1B4F72] border-[#AED6F1]",
    success: "bg-[#E8F8F0] text-[#0E6251] border-[#A3E4D7]",
    warning: "bg-[#FEF9E7] text-[#7D6608] border-[#FAD7A0]",
    danger: "bg-[#FDEDEC] text-[#922B21] border-[#F5B7B1]",
  };

  const defaultIcons = {
    info: <Info className="w-5 h-5 text-[#2980B9] shrink-0" aria-hidden="true" />,
    success: <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" aria-hidden="true" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#B9770E] shrink-0" aria-hidden="true" />,
    danger: <AlertCircle className="w-5 h-5 text-[#C0392B] shrink-0" aria-hidden="true" />,
  };

  const role = variant === "danger" || variant === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      className={cn(
        "flex gap-3 p-3.5 sm:p-4 rounded-lg border text-sm leading-relaxed",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className="shrink-0 mt-0.5">{icon || defaultIcons[variant]}</div>
      <div className="space-y-1 w-full text-left">
        {title && <h5 className="font-bold text-sm leading-tight">{title}</h5>}
        {children && <div className="text-xs sm:text-sm opacity-95">{children}</div>}
      </div>
    </div>
  );
}
