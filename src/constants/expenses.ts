import type { ExpenseCategory } from "@/types/database";

// ---------------------------------------------------------------------------
// Kamus Kategori Beban Operasional: Label Bahasa Indonesia & Metadata Badge
// ---------------------------------------------------------------------------
export const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  colorClass: string;
}[] = [
  { key: "OPERATIONAL", label: "Operasional Umum", colorClass: "bg-slate-100 text-slate-800 border-slate-300" },
  { key: "SALARY", label: "Gaji & Upah", colorClass: "bg-blue-100 text-blue-800 border-blue-300" },
  { key: "UTILITIES", label: "Listrik, Air & Internet", colorClass: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "RENT", label: "Sewa Tempat", colorClass: "bg-rose-100 text-rose-800 border-rose-300" },
  { key: "MARKETING", label: "Pemasaran & Iklan", colorClass: "bg-purple-100 text-purple-800 border-purple-300" },
  { key: "MAINTENANCE", label: "Perbaikan & Pemeliharaan", colorClass: "bg-orange-100 text-orange-800 border-orange-300" },
  { key: "SUPPLIES", label: "Perlengkapan Toko", colorClass: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "OTHER", label: "Lain-lain", colorClass: "bg-gray-100 text-gray-800 border-gray-300" },
];

export const EXPENSE_CATEGORY_MAP: Record<ExpenseCategory, string> = {
  OPERATIONAL: "Operasional Umum",
  SALARY: "Gaji & Upah",
  UTILITIES: "Listrik, Air & Internet",
  RENT: "Sewa Tempat",
  MARKETING: "Pemasaran & Iklan",
  MAINTENANCE: "Perbaikan & Pemeliharaan",
  SUPPLIES: "Perlengkapan Toko",
  OTHER: "Lain-lain",
};
