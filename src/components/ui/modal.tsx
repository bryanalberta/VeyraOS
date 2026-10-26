import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  isLoading?: boolean;
  preventClose?: boolean;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /** Ref ke elemen yang diprioritaskan menerima fokus awal saat modal terbuka */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Mengambil seluruh elemen yang valid untuk menerima fokus di dalam kontainer modal.
 * Menyaring elemen yang disabled, aria-hidden="true", type="hidden", atau tersembunyi via CSS.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  return Array.from(elements).filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") {
      return false;
    }
    if (el.getAttribute("type") === "hidden") {
      return false;
    }
    if (typeof window !== "undefined" && window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
      } catch {
        // Fallback aman jika getComputedStyle tidak didukung/gagal
      }
    }
    return true;
  });
}

/**
 * Menentukan elemen yang harus menerima fokus awal saat modal dibuka:
 * 1. initialFocusRef (jika disediakan oleh parent)
 * 2. Elemen dengan atribut [data-autofocus] atau [autofocus]
 * 3. Input, textarea, select, atau aksi utama di dalam konten body/footer modal (bukan tombol close X)
 * 4. Tombol close (X) jika tidak ada elemen interaktif lain di dalam body/footer
 * 5. null jika tidak ada elemen fokus sama sekali (akan fallback ke kontainer modal)
 */
export function determineInitialFocus(
  container: HTMLElement,
  initialRef?: React.RefObject<HTMLElement | null>
): HTMLElement | null {
  if (initialRef?.current && container.contains(initialRef.current)) {
    return initialRef.current;
  }

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    return null;
  }

  // 1. Cari elemen dengan autofocus eksplisit
  const autoFocusEl = focusables.find(
    (el) => el.hasAttribute("data-autofocus") || el.hasAttribute("autofocus")
  );
  if (autoFocusEl) return autoFocusEl;

  // 2. Prioritaskan elemen form atau aksi di dalam konten body/footer (bukan tombol close header)
  const bodyActionEl = focusables.find((el) => {
    const isCloseButton = el.getAttribute("aria-label") === "Tutup dialog";
    return !isCloseButton;
  });
  if (bodyActionEl) return bodyActionEl;

  // 3. Fallback ke elemen pertama (misal tombol close jika modal hanya teks informatif)
  return focusables[0];
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  isLoading = false,
  preventClose = false,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  bodyClassName,
  id,
  initialFocusRef,
}: ModalProps) {
  const generatedId = React.useId();
  const modalId = id || generatedId;
  const titleId = `${modalId}-title`;
  const descId = `${modalId}-desc`;

  // Ref container modal untuk focus trap
  const modalContainerRef = React.useRef<HTMLDivElement | null>(null);
  // Simpan elemen aktif sebelum modal dibuka untuk pemulihan fokus saat ditutup
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  // Pengelolaan Fokus Masuk & Pemulihan Fokus saat Tutup / Unmount
  React.useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    const focusTimer = setTimeout(() => {
      if (!modalContainerRef.current) return;
      const targetElement = determineInitialFocus(modalContainerRef.current, initialFocusRef);

      if (targetElement && typeof targetElement.focus === "function") {
        targetElement.focus();
      } else {
        modalContainerRef.current.focus();
      }
    }, 20);

    return () => {
      clearTimeout(focusTimer);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  // Penanganan Keyboard Escape & Focus Trap (Tab Key)
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Penanganan Escape: hormati isLoading dan preventClose
      if (e.key === "Escape") {
        if (closeOnEscape && !isLoading && !preventClose) {
          onClose();
        }
        return;
      }

      // Focus Trap untuk navigasi tombol Tab
      if (e.key === "Tab" && modalContainerRef.current) {
        const focusable = getFocusableElements(modalContainerRef.current);

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalContainerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalContainerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeOnEscape, isLoading, preventClose, onClose]);

  // Mengunci scroll body saat modal aktif dan memulihkan saat tutup / unmount
  React.useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  // Penutupan via klik backdrop: hormati isLoading dan preventClose
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick && !isLoading && !preventClose) {
      onClose();
    }
  };

  // Penutupan via tombol silang: hormati isLoading dan preventClose
  const handleCloseButtonClick = () => {
    if (!isLoading && !preventClose) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div
        ref={modalContainerRef}
        tabIndex={-1}
        className={cn(
          "w-full bg-white rounded-2xl border border-[#E7E3EC] shadow-2xl overflow-hidden transition-all my-8 text-left focus:outline-none",
          sizeClasses[size],
          className
        )}
      >
        {/* Header Modal */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-5 sm:p-6 border-b border-[#E7E3EC] bg-white">
            <div className="space-y-1 pr-4">
              {title && (
                <h3
                  id={titleId}
                  className="text-base sm:text-lg font-bold text-[#25232B] tracking-tight flex items-center gap-2"
                >
                  {title}
                  {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-[#5B3CC4]" aria-hidden="true" />
                  )}
                </h3>
              )}
              {description && (
                <p id={descId} className="text-xs sm:text-sm text-[#716D7A] leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={handleCloseButtonClick}
                disabled={isLoading || preventClose}
                aria-label="Tutup dialog"
                className="text-[#716D7A] hover:text-[#25232B] hover:bg-[#F0EDF5] rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Konten Utama (Body) */}
        <div className={cn("p-5 sm:p-6 text-sm text-[#25232B]", bodyClassName)}>
          {children}
        </div>

        {/* Footer Modal */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-[#E7E3EC] bg-[#FAF9F6]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
