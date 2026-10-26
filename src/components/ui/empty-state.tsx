import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-[#E7E3EC] bg-white",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-[#F6F3FF] border border-[#EAE4FF] text-[#5B3CC4] flex items-center justify-center mb-4 shrink-0 shadow-xs">
          {icon}
        </div>
      )}
      <h4 className="text-base font-bold text-[#25232B] mb-1">{title}</h4>
      <p className="text-xs sm:text-sm text-[#716D7A] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && <div className="inline-flex">{action}</div>}
    </div>
  );
}
