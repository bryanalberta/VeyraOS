import * as React from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  options?: SelectOption[];
  leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      helperText,
      errorMessage,
      options,
      leftIcon,
      children,
      required,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const describedBy = [
      errorMessage ? errorId : null,
      helperText && !errorMessage ? helperId : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-[#25232B] select-none"
          >
            {label}
            {required && <span className="ml-1 text-[#C0392B]" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#716D7A] z-10">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={errorMessage ? "true" : undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              "w-full rounded-md border border-[#E7E3EC] bg-white px-3 py-2 text-sm text-[#25232B] placeholder:text-[#716D7A] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[rgba(91,60,196,0.28)] disabled:cursor-not-allowed disabled:bg-[#F0EDF5] disabled:opacity-75 min-h-[44px] sm:min-h-[40px] appearance-none pr-10 cursor-pointer",
              leftIcon ? "pl-9" : undefined,
              errorMessage
                ? "border-[#C0392B] focus-visible:border-[#C0392B] focus-visible:ring-[rgba(192,57,43,0.28)]"
                : undefined,
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Ikon panah kustom ChevronDown */}
          <div className="absolute right-3 flex items-center pointer-events-none text-[#716D7A]">
            <ChevronDown className="w-4 h-4 text-[#716D7A]" aria-hidden="true" />
          </div>
        </div>

        {errorMessage ? (
          <p
            id={errorId}
            role="alert"
            className="flex items-center gap-1.5 text-xs text-[#922B21]"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
            <span>{errorMessage}</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[#716D7A]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
