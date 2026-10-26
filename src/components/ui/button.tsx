import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "outline-dark";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[rgba(91,60,196,0.28)] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer";

    const variantStyles = {
      primary: "bg-[#5B3CC4] text-white hover:bg-[#4930A5] active:bg-[#3C258C]",
      secondary: "bg-white text-[#5B3CC4] border border-[#5B3CC4] hover:bg-[#F6F3FF] active:bg-[#EAE4FF]",
      outline: "bg-white text-[#25232B] border border-[#E7E3EC] hover:bg-[#F0EDF5] hover:text-[#25232B]",
      "outline-dark":
        "bg-white/10 text-white border border-white/60 hover:bg-white/20 hover:border-white hover:text-white active:bg-white/30 focus-visible:ring-2 focus-visible:ring-[#FFD54F]",
      ghost: "bg-transparent text-[#25232B] hover:bg-[#F0EDF5] active:bg-[#E7E3EC]",
      destructive:
        "bg-[#C0392B] text-white hover:bg-[#922B21] active:bg-[#78281F] focus-visible:ring-[rgba(192,57,43,0.28)]",
    };

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1.5 min-h-[36px] sm:min-h-[32px] gap-1.5",
      md: "text-sm px-4 py-2 min-h-[44px] sm:min-h-[40px] gap-2",
      lg: "text-base px-6 py-2.5 min-h-[48px] gap-2.5",
      icon: "min-h-[44px] min-w-[44px] p-2",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? "true" : undefined}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
            <span className="sr-only">Memuat...</span>
            {size !== "icon" && children}
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
