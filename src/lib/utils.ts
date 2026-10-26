export { formatRupiah, formatNumber, parseRupiah } from "./formatters";

/**
 * Penggabung class name kondisional sederhana
 */
export function cn(...classes: Array<string | boolean | undefined | null>): string {
  return classes.filter(Boolean).join(" ");
}
