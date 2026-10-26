"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Info,
  X,
  PieChart,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type { DemoExpense } from "@/services/demo/demo-types";
import { formatRupiah, cn } from "@/lib/utils";

const DEMO_EXPENSE_CATEGORIES = [
  "Sewa Tempat",
  "Gaji Karyawan",
  "Listrik & Air",
  "Transportasi & Bensin",
  "Konsumsi & Logistik Toko",
  "Pemeliharaan & Renovasi",
  "Pemasaran & Pulsa",
  "Lain-lain",
];

export default function DemoExpensesPage() {
  const storeState = React.useSyncExternalStore(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const expenses = storeState.expenses;

  // Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [category, setCategory] = React.useState(DEMO_EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = React.useState<number>(100000);
  const [description, setDescription] = React.useState("");
  const [expenseDate, setExpenseDate] = React.useState("");
  const [modalError, setModalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setExpenseDate(new Date().toISOString().slice(0, 10));
  }, []);

  // Toast Notice
  const [notice, setNotice] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filtered Expenses
  const filteredExpenses = React.useMemo(() => {
    return expenses.filter((exp) => {
      if (selectedCategory !== "ALL" && exp.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDesc = exp.description.toLowerCase().includes(q);
        const matchCat = exp.category.toLowerCase().includes(q);
        if (!matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [expenses, selectedCategory, searchQuery]);

  // Statistik & Breakdown Kategori
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const expenseCount = expenses.length;

  const categoryBreakdown = React.useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const exp of expenses) {
      const existing = map.get(exp.category) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += exp.amount;
      map.set(exp.category, existing);
    }

    return Array.from(map.entries())
      .map(([cat, val]) => ({
        category: cat,
        count: val.count,
        total: val.total,
        percentage: totalExpenses > 0 ? Math.round((val.total / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, totalExpenses]);

  const topCategory = categoryBreakdown[0];

  const handleOpenModal = () => {
    setCategory(DEMO_EXPENSE_CATEGORIES[0]);
    setAmount(100000);
    setDescription("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (amount <= 0) {
      setModalError("Nominal pengeluaran harus lebih besar dari Rp 0.");
      return;
    }
    if (!description.trim()) {
      setModalError("Keterangan pengeluaran wajib diisi.");
      return;
    }

    const res = demoStoreService.recordExpense({
      category,
      amount,
      description: description.trim(),
      expenseDate: new Date(expenseDate).toISOString(),
      paymentMethod: "CASH",
    });

    if (!res.success) {
      setModalError(res.error.message);
      return;
    }

    setNotice({
      type: "success",
      message: `Beban operasional '${category}' sebesar ${formatRupiah(amount)} berhasil dicatat!`,
    });
    setIsModalOpen(false);
  };

  const handleDeleteExpense = (exp: DemoExpense) => {
    const res = demoStoreService.deleteExpense(exp.id);
    if (res.success) {
      setNotice({
        type: "success",
        message: `Catatan beban '${exp.category}' sebesar ${formatRupiah(exp.amount)} telah dihapus.`,
      });
    } else {
      setNotice({ type: "error", message: res.error.message });
    }
  };

  return (
    <DemoLayout
      title="Buku Beban Operasional (Simulasi)"
      currentPath="/demo/expenses"
    >
      <div className="space-y-6 pb-12">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#25232B] tracking-tight">
                Buku Pengeluaran Operasional
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
              >
                Toko Sembako Sejahtera
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#716D7A]">
              Pencatatan beban rutin usaha: sewa, listrik, gaji, dan logistik toko yang mempengaruhi laba bersih.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/demo/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 font-semibold text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF] hover:bg-[#EAE4FF]"
              >
                Lihat Ringkasan Dashboard
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenModal}
              className="text-xs h-9 font-semibold"
              id="demo-record-expense-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Catat Pengeluaran Baru
            </Button>
          </div>
        </div>

        {/* Notifikasi Toast */}
        {notice && (
          <Alert
            variant={notice.type === "success" ? "success" : "danger"}
            className="flex items-center justify-between text-xs py-2.5"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0E6251]" />
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs underline hover:no-underline font-medium"
            >
              Tutup
            </button>
          </Alert>
        )}

        {/* Info Edukasi Finansial */}
        <div className="rounded-xl p-3.5 bg-[#F6F3FF] border border-[#EAE4FF] flex items-start gap-2.5 text-xs text-[#392477]">
          <Info className="w-4 h-4 shrink-0 text-[#5B3CC4] mt-0.5" />
          <div>
            <strong>Prinsip Akuntansi UMKM:</strong> Pengeluaran yang dicatat di sini adalah beban operasional toko murni.
            Pengeluaran untuk pembelian barang dagangan dicatat di menu <strong>Pembelian / Restock</strong> agar tidak mendistorsi HPP dan laba kotor.
          </div>
        </div>

        {/* Ringkasan KPI Beban & Komposisi */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-[#716D7A] uppercase tracking-wider block">
                Total Beban Operasional
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#C0392B] mt-2 font-financial tabular-nums">
                {formatRupiah(totalExpenses)}
              </div>
              <p className="text-xs text-[#716D7A] mt-1">
                Total akumulasi biaya operasional toko
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-[#F0EDF5] flex items-center justify-between text-xs text-[#716D7A]">
              <span>Jumlah Transaksi Beban</span>
              <strong className="text-[#25232B] font-bold">
                {expenseCount} Transaksi
              </strong>
            </div>
          </Card>

          <Card className="p-5 bg-white border-[#E7E3EC] shadow-xs lg:col-span-2">
            <h3 className="text-xs font-bold text-[#25232B] uppercase tracking-wider mb-3">
              Komposisi Beban per Kategori
            </h3>

            {categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 4).map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#25232B]">{cat.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#716D7A] font-financial tabular-nums font-mono">
                          ({cat.count}x)
                        </span>
                        <strong className="text-[#25232B] font-financial tabular-nums">
                          {formatRupiah(cat.total)}
                        </strong>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF] font-financial tabular-nums"
                        >
                          {cat.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F0EDF5] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#5B3CC4] transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#716D7A]">Belum ada catatan pengeluaran.</p>
            )}
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <Card className="p-4 bg-white border-[#E7E3EC] shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D7A]" />
              <input
                type="text"
                placeholder="Cari berdasarkan keterangan atau kategori beban..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-[#E7E3EC] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B3CC4] min-h-[44px]"
                id="demo-expense-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716D7A] hover:text-[#25232B]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="w-full sm:w-60">
              <Select
                id="demo-expense-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: "ALL", label: "Semua Kategori" },
                  ...DEMO_EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Tabel / Card List Pengeluaran */}
        <Card className="bg-white border-[#E7E3EC] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E7E3EC] flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#25232B]">
                Rincian Biaya Operasional
              </h2>
              <p className="text-xs text-[#716D7A] mt-0.5">
                Menampilkan {filteredExpenses.length} catatan pengeluaran.
              </p>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ArrowDownCircle className="w-6 h-6" />}
                title="Tidak Ada Catatan Pengeluaran"
                description="Belum ada catatan beban operasional yang sesuai dengan filter pencarian."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("ALL");
                    }}
                  >
                    Reset Filter
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Mobile Card List (< 768px) */}
              <div className="md:hidden divide-y divide-[#E7E3EC]">
                {filteredExpenses.map((exp) => (
                  <div key={exp.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                        >
                          {exp.category}
                        </Badge>
                        <span className="text-xs text-[#716D7A] block mt-1">
                          {exp.expenseDate.slice(0, 10)}
                        </span>
                      </div>
                      <strong className="text-base font-bold text-[#C0392B] font-financial">
                        {formatRupiah(exp.amount)}
                      </strong>
                    </div>

                    <p className="text-xs text-[#25232B]">{exp.description}</p>

                    <div className="flex items-center justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteExpense(exp)}
                        className="text-xs h-9 min-h-[44px] px-3 text-[#C0392B] hover:bg-[#FDEDEC]"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAF9F6]">
                      <TableHead className="w-32 text-xs font-semibold text-[#716D7A]">
                        Tanggal
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Kategori Beban
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#716D7A]">
                        Keterangan
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold text-[#716D7A]">
                        Metode
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A]">
                        Nominal (IDR)
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold text-[#716D7A] w-20">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((exp) => (
                      <TableRow key={exp.id} className="hover:bg-[#F6F3FF]/40 transition-colors">
                        <TableCell className="text-xs text-[#716D7A]">
                          {exp.expenseDate.slice(0, 10)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[11px] text-[#5B3CC4] border-[#EAE4FF] bg-[#F6F3FF]"
                          >
                            {exp.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#25232B]">
                          {exp.description}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {exp.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-financial text-xs sm:text-sm font-bold text-[#C0392B]">
                          {formatRupiah(exp.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteExpense(exp)}
                            className="h-8 px-2 text-xs text-[#C0392B] hover:bg-[#FDEDEC]"
                            title="Hapus catatan pengeluaran"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>

        {/* Modal Catat Beban Operasional */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Catat Beban Operasional Baru"
          description="Catat pengeluaran rutin toko untuk sewa, gaji, listrik, dan biaya operasional lainnya."
        >
          <form onSubmit={handleSubmitExpense} className="space-y-4 pt-2">
            {modalError && (
              <Alert variant="danger" className="text-xs py-2">
                <AlertTriangle className="w-4 h-4 mr-1.5 shrink-0" />
                <span>{modalError}</span>
              </Alert>
            )}

            <div>
              <Select
                id="expense-form-category"
                label="Kategori Pengeluaran *"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={DEMO_EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>

            <div>
              <CurrencyInput
                id="expense-form-amount"
                label="Nominal Pengeluaran (IDR) *"
                value={amount}
                onValueChange={(val: number) => setAmount(val || 0)}
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="expense-form-desc" className="block text-xs font-semibold text-[#25232B] mb-1">
                Keterangan Keperluan *
              </label>
              <Input
                id="expense-form-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Bayar listrik kasir & lampu toko bulan berjalan"
                className="text-xs h-9"
                required
              />
            </div>

            <div>
              <label htmlFor="expense-form-date" className="block text-xs font-semibold text-[#25232B] mb-1">
                Tanggal Pengeluaran
              </label>
              <Input
                id="expense-form-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F0EDF5]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="text-xs font-semibold"
                id="submit-demo-expense-btn"
              >
                Simpan Pengeluaran
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DemoLayout>
  );
}
