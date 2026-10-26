import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, parseRupiah } from "@/lib/formatters";

/**
 * Kontrak Nilai & Batasan Finansial CurrencyInput:
 * 1. Nilai Integer IDR: Nilai input selalu dikelola dan diteruskan sebagai integer murni (Rupiah).
 *    Tidak ada konversi ke floating-point untuk menjaga presisi finansial.
 * 2. Kontrak Nilai Kosong & Angka Nol:
 *    - Input yang dikosongkan (empty string "") secara deterministik menghasilkan nilai integer 0
 *      pada callback onValueChange(0). Display string dikosongkan ("") agar placeholder (default "0")
 *      terlihat jelas dalam warna muted.
 *    - Pengguna yang secara eksplisit mengetik digit nol ("0") menghasilkan display string "0" dan
 *      onValueChange(0). Ini memberikan umpan balik visual langsung bahwa angka 0 telah dimasukkan.
 * 3. Normalisasi Batas (min/max): Prop min dan max dinormalisasi ke rentang integer aman
 *    [0, Number.MAX_SAFE_INTEGER]. Jika user memasukkan angka di luar batas, nilai otomatis
 *    di-clamp ke batas terdekat sebelum diteruskan ke onValueChange.
 * 4. Sinkronisasi Controlled Value & Preservasi Kursor: Pembaruan prop dari parent tidak
 *    mengganggu pengetikan aktif atau mereset posisi kursor ke akhir teks saat user mengedit
 *    di tengah digit.
 * 5. Lifecycle rAF: RequestAnimationFrame untuk pemulihan posisi kursor dibatalkan saat unmount
 *    atau sebelum penjadwalan frame berikutnya guna mencegah kebocoran frame.
 */
export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> {
  /** Nilai controlled integer Rupiah murni (misal: 25000) */
  value?: number;
  /** Nilai awal integer jika komponen bersifat uncontrolled (default: 0) */
  defaultValue?: number;
  /** Callback saat nilai nominal berubah, menerima integer Rupiah (0 jika kosong) */
  onValueChange?: (value: number) => void;
  /** Label formulir */
  label?: string;
  /** Pesan bantuan di bawah input */
  helperText?: string;
  /** Pesan error validasi (memicu border merah & aria-invalid) */
  errorMessage?: string;
  /** Batas minimum integer Rupiah (default: 0) */
  min?: number;
  /** Batas maksimum integer Rupiah (default: Number.MAX_SAFE_INTEGER) */
  max?: number;
  /** Teks prefix mata uang (default: "Rp") */
  prefix?: string;
  /** Sembunyikan badge prefix "Rp" jika true (default: false) */
  hidePrefix?: boolean;
}

/**
 * Menghitung posisi kursor baru setelah pemformatan ribuan titik agar kursor tidak
 * melompat ke akhir input saat user mengetik atau menghapus di tengah angka.
 */
export function calculateCursorPosition(rawText: string, rawCursor: number, formattedText: string): number {
  const digitsBefore = rawText.slice(0, rawCursor).replace(/\D/g, "").length;
  if (digitsBefore === 0) return 0;

  let seenDigits = 0;
  for (let i = 0; i < formattedText.length; i++) {
    if (/\d/.test(formattedText[i])) {
      seenDigits++;
      if (seenDigits === digitsBefore) {
        return i + 1;
      }
    }
  }
  return formattedText.length;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      value,
      defaultValue = 0,
      onValueChange,
      label,
      helperText,
      errorMessage,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      prefix = "Rp",
      hidePrefix = false,
      required,
      id,
      disabled,
      placeholder = "0",
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Ref internal input untuk kontrol kursor & DOM
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    // Ref ID requestAnimationFrame untuk lifecycle cleanup
    const rafIdRef = React.useRef<number | null>(null);

    // Meneruskan ref internal ke forwardRef
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Normalisasi batas min dan max ke safe integer
    const safeMin = Number.isSafeInteger(min) ? Math.max(0, min) : 0;
    const safeMax = Number.isSafeInteger(max) ? Math.max(safeMin, max) : Number.MAX_SAFE_INTEGER;

    // Normalisasi nilai awal uncontrolled
    const initialNormalizedDefault = Number.isSafeInteger(defaultValue)
      ? Math.min(Math.max(defaultValue, safeMin), safeMax)
      : 0;

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<number>(initialNormalizedDefault);

    // Simpan nilai terakhir yang di-emit agar tidak memicu sinkronisasi balik yang mengganggu kursor
    const lastEmittedValueRef = React.useRef<number>(
      isControlled
        ? Number.isSafeInteger(value)
          ? Math.min(Math.max(value, safeMin), safeMax)
          : 0
        : initialNormalizedDefault
    );

    // Teks tampilan input (string berpemisah titik)
    const [displayString, setDisplayString] = React.useState<string>(() => {
      const rawVal = isControlled ? value : internalValue;
      if (rawVal !== undefined && Number.isSafeInteger(rawVal)) {
        const clampedInitial = Math.min(Math.max(rawVal, safeMin), safeMax);
        if (clampedInitial > 0) {
          return formatNumber(clampedInitial);
        }
      }
      return "";
    });

    // Cleanup requestAnimationFrame saat unmount
    React.useEffect(() => {
      return () => {
        if (rafIdRef.current !== null && typeof window !== "undefined") {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }, []);

    // Sinkronisasi controlled value dari luar HANYA jika nilainya berbeda secara substansial
    // dari apa yang baru saja diketik/di-emit pengguna
    React.useEffect(() => {
      if (isControlled && value !== undefined) {
        const normalizedExternal = Number.isSafeInteger(value)
          ? Math.min(Math.max(value, safeMin), safeMax)
          : 0;

        const currentParsed = parseRupiah(displayString);

        if (normalizedExternal !== currentParsed && normalizedExternal !== lastEmittedValueRef.current) {
          lastEmittedValueRef.current = normalizedExternal;
          setDisplayString(normalizedExternal > 0 ? formatNumber(normalizedExternal) : (displayString === "0" ? "0" : ""));
        }
      } else if (!isControlled) {
        // Pada mode uncontrolled, pastikan nilai internal tetap dalam batas jika min/max berubah
        setInternalValue((prev) => {
          const clamped = Math.min(Math.max(prev, safeMin), safeMax);
          if (clamped !== prev) {
            setDisplayString(clamped > 0 ? formatNumber(clamped) : "");
          }
          return clamped;
        });
      }
    }, [isControlled, value, safeMin, safeMax, displayString]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawText = e.target.value;
      const cursorPosition = e.target.selectionStart ?? rawText.length;

      // Cek apakah ada digit angka di dalam teks input
      const rawDigits = rawText.replace(/\D/g, "");
      const hasDigits = rawDigits.length > 0;

      // Parsing integer murni dari input
      const parsedInteger = parseRupiah(rawText);

      // Clamp ke batas aman yang telah dinormalisasi
      const clamped = Math.min(Math.max(parsedInteger, safeMin), safeMax);

      // Teks baru berformat:
      // - Jika clamped > 0: format ribuan titik
      // - Jika clamped == 0 dan pengguna mengetik digit nol: tampilkan "0"
      // - Jika kosong murni tanpa digit: string kosong "" agar placeholder terlihat
      let newFormatted = "";
      if (clamped > 0) {
        newFormatted = formatNumber(clamped);
      } else if (hasDigits) {
        newFormatted = "0";
      } else {
        newFormatted = "";
      }

      // Hitung posisi kursor yang dipertahankan
      const newCursorPos = calculateCursorPosition(rawText, cursorPosition, newFormatted);

      if (!isControlled) {
        setInternalValue(clamped);
      }

      lastEmittedValueRef.current = clamped;
      setDisplayString(newFormatted);

      // Restore posisi kursor setelah re-render dengan membatalkan frame aktif sebelumnya
      if (typeof window !== "undefined") {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (inputRef.current) {
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        });
      }

      onValueChange?.(clamped);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const currentNumeric = isControlled
        ? Number.isSafeInteger(value)
          ? Math.min(Math.max(value, safeMin), safeMax)
          : 0
        : internalValue;

      // Saat blur, format ulang secara presisi jika > 0.
      // Jika 0, pertahankan "0" jika display sebelumnya "0", atau kosong "" jika kosong murni agar placeholder muncul.
      if (currentNumeric > 0) {
        setDisplayString(formatNumber(currentNumeric));
      } else {
        setDisplayString(displayString === "0" ? "0" : "");
      }
      props.onBlur?.(e);
    };

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
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#25232B] select-none"
          >
            {label}
            {required && <span className="ml-1 text-[#C0392B]" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {!hidePrefix && (
            <span
              className="absolute left-3 text-xs font-bold text-[#716D7A] select-none pointer-events-none"
              aria-hidden="true"
            >
              {prefix}
            </span>
          )}

          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            value={displayString}
            onChange={handleInputChange}
            onBlur={handleBlur}
            aria-invalid={errorMessage ? "true" : undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              "w-full rounded-lg sm:rounded-xl border border-[#E7E3EC] bg-white py-2 text-sm font-semibold text-[#25232B] placeholder:text-[#9A95A2] transition-all duration-150 focus:border-[#5B3CC4] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[rgba(91,60,196,0.20)] disabled:cursor-not-allowed disabled:bg-[#F0EDF5] disabled:opacity-75 min-h-[44px] sm:min-h-[40px] font-mono tabular-nums shadow-2xs",
              !hidePrefix ? "pl-9 pr-3" : "px-3",
              errorMessage
                ? "border-[#C0392B] focus-visible:border-[#C0392B] focus-visible:ring-[rgba(192,57,43,0.28)]"
                : undefined,
              className
            )}
            {...props}
          />
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

CurrencyInput.displayName = "CurrencyInput";
