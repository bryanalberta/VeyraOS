"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  Store,
  Printer,
  Database,
  RefreshCw,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { DemoLayout } from "@/components/demo/demo-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { demoStoreService } from "@/services/demo/demo-store.service";
import type { DemoStoreState, DemoBusinessProfile } from "@/services/demo/demo-types";

// ---------------------------------------------------------------------------
// Kategori Usaha Demo
// ---------------------------------------------------------------------------
const BUSINESS_CATEGORIES = [
  { value: "Kelontong / Sembako", label: "Kelontong / Sembako" },
  { value: "Makanan & Minuman", label: "Makanan & Minuman" },
  { value: "Ritel & Minimarket", label: "Ritel & Minimarket" },
  { value: "Pakaian & Fashion", label: "Pakaian & Fashion" },
  { value: "Kesehatan & Farmasi", label: "Kesehatan & Farmasi" },
  { value: "Jasa & Layanan", label: "Jasa & Layanan" },
  { value: "Lainnya", label: "Lainnya" },
];

export default function DemoSettingsPage() {
  const storeState = React.useSyncExternalStore<DemoStoreState>(
    demoStoreService.subscribe,
    demoStoreService.getState,
    demoStoreService.getServerSnapshot
  );

  const business = storeState.business;

  // Form State
  const [name, setName] = React.useState(business.name);
  const [category, setCategory] = React.useState(business.category);
  const [phone, setPhone] = React.useState(business.phone);
  const [address, setAddress] = React.useState(business.address);
  const [receiptFooter, setReceiptFooter] = React.useState(
    business.receiptFooter || "Terima kasih atas kunjungan Anda! Barang yang sudah dibeli tidak dapat ditukar."
  );
  const [receiptPaperSize, setReceiptPaperSize] = React.useState<"58mm" | "80mm">(
    business.receiptPaperSize || "58mm"
  );

  // Status feedback
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Modals confirmation
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
  const [isClearTransModalOpen, setIsClearTransModalOpen] = React.useState(false);

  // Sinkronkan form saat business profile berubah di luar
  React.useEffect(() => {
    setName(business.name);
    setCategory(business.category);
    setPhone(business.phone);
    setAddress(business.address);
    if (business.receiptFooter) setReceiptFooter(business.receiptFooter);
    if (business.receiptPaperSize) setReceiptPaperSize(business.receiptPaperSize);
  }, [business]);

  // Cek apakah ada perubahan
  const isDirty =
    name !== business.name ||
    category !== business.category ||
    phone !== business.phone ||
    address !== business.address ||
    receiptFooter !== (business.receiptFooter || "Terima kasih atas kunjungan Anda! Barang yang sudah dibeli tidak dapat ditukar.") ||
    receiptPaperSize !== (business.receiptPaperSize || "58mm");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Nama toko tidak boleh kosong.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const res = demoStoreService.updateBusinessProfile({
      name: name.trim(),
      category: category.trim(),
      phone: phone.trim(),
      address: address.trim(),
      receiptFooter: receiptFooter.trim(),
      receiptPaperSize,
    });

    setIsSaving(false);

    if (res.success) {
      setSuccessMessage("Pengaturan profil toko dan struk kasir berhasil diperbarui!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(res.error.message);
    }
  };

  const handleConfirmResetAll = () => {
    demoStoreService.resetState();
    setIsResetModalOpen(false);
    setSuccessMessage("Seluruh data mode demo berhasil dipulihkan ke seed awal Toko Sembako Sejahtera!");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleConfirmClearTransactions = () => {
    demoStoreService.clearTransactionsOnly();
    setIsClearTransModalOpen(false);
    setSuccessMessage("Seluruh riwayat transaksi (penjualan, pembelian, pengeluaran) berhasil dibersihkan! Katalog produk tetap aman.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleExportBackupJson = () => {
    try {
      const state = demoStoreService.getState();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(state, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("download", `VeyraOS_Demo_Backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      setErrorMessage("Gagal mengunduh file backup JSON simulasi.");
    }
  };

  return (
    <DemoLayout title="Pengaturan Mode Demo">
      <div className="space-y-6 pb-12" id="demo-settings-content">
        {/* Banner Edukasi Pengaturan Demo */}
        <div className="rounded-xl p-4 bg-[#F6F3FF] border border-[#EAE4FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#D9D0F5] flex items-center justify-center shrink-0 text-[#5B3CC4] shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-[#392477] text-sm">
                Pengaturan Toko Simulasi Lokal
              </p>
              <p className="text-[#5B3CC4] mt-0.5">
                Anda dapat mengubah nama toko, alamat, dan nomor kontak di bawah ini. Seluruh perubahan langsung tercermin pada struk kasir POS, faktur invoice, dan laporan demo.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto bg-white text-[#5B3CC4] border-[#D9D0F5] shrink-0 font-semibold px-2.5 py-1">
            Lokal Sandboxed
          </Badge>
        </div>

        {/* Notifikasi Sukses / Error */}
        {successMessage && (
          <Alert variant="success" className="bg-[#EBFBF0] border-[#C3F2D1] text-[#0A6C2F]">
            <CheckCircle2 className="w-4 h-4 text-[#107E3E] shrink-0" />
            <div className="flex-1 text-xs font-semibold">{successMessage}</div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-[#107E3E] hover:underline text-xs"
            >
              Tutup
            </button>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="danger" className="bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <div className="flex-1 text-xs font-semibold">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-[#DC2626] hover:underline text-xs"
            >
              Tutup
            </button>
          </Alert>
        )}

        {/* Grid Formulir Utama */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Form Profil Toko & Format Struk (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Card 1: Identitas Toko */}
              <Card className="bg-white border-[#E7E3EC] shadow-xs">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#F0EDF5] pb-3">
                    <Store className="w-4 h-4 text-[#5B3CC4]" />
                    <h3 className="font-bold text-sm text-[#25232B]">
                      Profil & Identitas Toko
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-biz-name" className="block text-xs font-semibold text-[#25232B] mb-1">
                        Nama Toko / Usaha *
                      </label>
                      <Input
                        id="settings-biz-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Toko Berkah Mandiri"
                        className="text-xs h-9"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-biz-category" className="block text-xs font-semibold text-[#25232B] mb-1">
                        Kategori Usaha
                      </label>
                      <Select
                        id="settings-biz-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        options={BUSINESS_CATEGORIES}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-biz-phone" className="block text-xs font-semibold text-[#25232B] mb-1">
                        Nomor WhatsApp / Telepon
                      </label>
                      <Input
                        id="settings-biz-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Contoh: 081298765432"
                        className="text-xs h-9"
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-biz-currency" className="block text-xs font-semibold text-[#25232B] mb-1">
                        Mata Uang & Zona Waktu
                      </label>
                      <div className="h-9 px-3 flex items-center justify-between bg-[#F8F7FA] border border-[#E7E3EC] rounded-lg text-xs text-[#6E6A7C]">
                        <span>Rupiah (IDR)</span>
                        <span className="font-semibold text-[#5B3CC4]">WIB (Jakarta)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="settings-biz-address" className="block text-xs font-semibold text-[#25232B] mb-1">
                      Alamat Lengkap Toko
                    </label>
                    <Input
                      id="settings-biz-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Contoh: Jl. Surya Kencana No. 45, Bogor Tengah, Kota Bogor"
                      className="text-xs h-9"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Pengaturan Struk Kasir POS */}
              <Card className="bg-white border-[#E7E3EC] shadow-xs">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#F0EDF5] pb-3">
                    <Printer className="w-4 h-4 text-[#5B3CC4]" />
                    <h3 className="font-bold text-sm text-[#25232B]">
                      Preferensi Struk & Cetak Nota POS
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-[#25232B]">
                      Lebar Kertas Printer Kasir
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReceiptPaperSize("58mm")}
                        className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                          receiptPaperSize === "58mm"
                            ? "bg-[#F6F3FF] border-[#5B3CC4] text-[#392477]"
                            : "bg-white border-[#E7E3EC] text-[#25232B] hover:bg-[#FDFBFF]"
                        }`}
                      >
                        <Receipt className="w-4 h-4 mt-0.5 text-[#5B3CC4] shrink-0" />
                        <div>
                          <p className="font-bold text-xs">Thermal 58mm (Kecil)</p>
                          <p className="text-[11px] text-[#6E6A7C] mt-0.5">
                            Standar kasir mobile & printer Bluetooth portable.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReceiptPaperSize("80mm")}
                        className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                          receiptPaperSize === "80mm"
                            ? "bg-[#F6F3FF] border-[#5B3CC4] text-[#392477]"
                            : "bg-white border-[#E7E3EC] text-[#25232B] hover:bg-[#FDFBFF]"
                        }`}
                      >
                        <Printer className="w-4 h-4 mt-0.5 text-[#5B3CC4] shrink-0" />
                        <div>
                          <p className="font-bold text-xs">Thermal 80mm (Besar)</p>
                          <p className="text-[11px] text-[#6E6A7C] mt-0.5">
                            Standar kasir meja kasir minimarket & desktop POS.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="settings-receipt-footer" className="block text-xs font-semibold text-[#25232B] mb-1">
                      Pesan Catatan Kaki Struk (Receipt Footer)
                    </label>
                    <Input
                      id="settings-receipt-footer"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Contoh: Terima kasih atas kunjungan Anda!"
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Tombol Simpan */}
                  <div className="pt-2 flex items-center justify-end">
                    <Button
                      type="submit"
                      disabled={isSaving || !isDirty}
                      className="text-xs font-semibold h-9 px-4"
                      id="save-demo-settings-btn"
                    >
                      {isSaving ? "Menyimpan..." : "Simpan Pengaturan Toko"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>

            {/* Card 3: Zona Bahaya & Kontrol Penyimpanan Data Simulasi */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#F0EDF5] pb-3">
                  <Database className="w-4 h-4 text-[#DC2626]" />
                  <h3 className="font-bold text-sm text-[#25232B]">
                    Kontrol Penyimpanan & Reset Simulasi
                  </h3>
                </div>

                <div className="text-xs text-[#6E6A7C] space-y-2">
                  <p>
                    Data demo ini tersimpan secara lokal di peramban Anda (<code className="bg-[#F3F0F7] px-1 py-0.5 rounded text-[#5B3CC4] font-mono">localStorage</code>). Anda dapat mencadangkan data simulasi ke file JSON atau meresetnya kapan saja.
                  </p>
                </div>

                {/* Ringkasan Entitas Aktif */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-[#F8F7FA] border border-[#E7E3EC]">
                    <span className="block text-[11px] text-[#6E6A7C]">Katalog</span>
                    <span className="font-bold text-[#25232B]">{storeState.products.length} Produk</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8F7FA] border border-[#E7E3EC]">
                    <span className="block text-[11px] text-[#6E6A7C]">Penjualan</span>
                    <span className="font-bold text-[#25232B]">{storeState.sales.length} Transaksi</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8F7FA] border border-[#E7E3EC]">
                    <span className="block text-[11px] text-[#6E6A7C]">Pembelian</span>
                    <span className="font-bold text-[#25232B]">{storeState.purchases.length} Faktur</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8F7FA] border border-[#E7E3EC]">
                    <span className="block text-[11px] text-[#6E6A7C]">Pengeluaran</span>
                    <span className="font-bold text-[#25232B]">{storeState.expenses.length} Beban</span>
                  </div>
                </div>

                {/* Tombol Aksi Penyimpanan */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportBackupJson}
                    className="text-xs h-9"
                    id="export-backup-json-btn"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-[#5B3CC4]" />
                    Ekspor Backup JSON
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsClearTransModalOpen(true)}
                    className="text-xs h-9 text-[#C2410C] hover:bg-[#FFF7ED] border-[#FED7AA]"
                    id="clear-transactions-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5 text-[#EA580C]" />
                    Kosongkan Transaksi Saja
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsResetModalOpen(true)}
                    className="text-xs h-9 text-[#DC2626] hover:bg-[#FEF2F2] border-[#FCA5A5]"
                    id="reset-demo-all-btn"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-[#DC2626]" />
                    Reset ke Seed Awal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kolom Kanan: Pratinjau Struk Kasir & Banner Registrasi Akun Nyata */}
          <div className="space-y-6">
            {/* Pratinjau Struk Kasir POS */}
            <Card className="bg-white border-[#E7E3EC] shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#F0EDF5] pb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#5B3CC4]" />
                    <h3 className="font-bold text-sm text-[#25232B]">
                      Pratinjau Struk Kasir
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-[#F8F7FA]">
                    {receiptPaperSize}
                  </Badge>
                </div>

                {/* Kertas Struk Simulasi Thermal */}
                <div
                  className={`mx-auto bg-[#FFFEFC] border border-[#E7E3EC] rounded-lg p-4 font-mono text-[11px] text-[#25232B] shadow-xs space-y-2.5 transition-all ${
                    receiptPaperSize === "58mm" ? "max-w-[260px]" : "max-w-[320px]"
                  }`}
                  id="receipt-live-preview"
                >
                  <div className="text-center space-y-0.5 border-b border-dashed border-[#CBC4D8] pb-2">
                    <p className="font-bold text-xs uppercase tracking-wider">{name || "NAMA TOKO"}</p>
                    <p className="text-[10px] text-[#6E6A7C] leading-tight">{address || "Alamat Toko Belum Diisi"}</p>
                    <p className="text-[10px] text-[#6E6A7C]">Telp: {phone || "-"}</p>
                  </div>

                  <div className="flex justify-between text-[10px] text-[#6E6A7C]">
                    <span>INV-20261026-001</span>
                    <span>26/10/26 14:30</span>
                  </div>

                  <div className="border-b border-dashed border-[#CBC4D8] pb-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Beras Ramos 5kg (1x)</span>
                      <span>76.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Minyak Goreng 2L (2x)</span>
                      <span>73.000</span>
                    </div>
                  </div>

                  <div className="space-y-1 border-b border-dashed border-[#CBC4D8] pb-2">
                    <div className="flex justify-between font-bold">
                      <span>TOTAL:</span>
                      <span>Rp 149.000</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>TUNAI (CASH):</span>
                      <span>Rp 150.000</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>KEMBALIAN:</span>
                      <span>Rp 1.000</span>
                    </div>
                  </div>

                  <div className="text-center pt-1 text-[10px] text-[#6E6A7C] italic leading-tight">
                    {receiptFooter || "Terima kasih atas kunjungan Anda!"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Banner CTA Registrasi Akun Nyata */}
            <Card className="bg-gradient-to-br from-[#392477] to-[#5B3CC4] text-white border-0 shadow-md">
              <CardContent className="p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-base leading-snug">
                  Siap Beralih ke Akun Nyata VeyraOS?
                </h3>
                <p className="text-xs text-white/80 leading-relaxed">
                  Dapatkan sinkronisasi cloud real-time, multi-kasir, pencatatan otomatis Supabase PostgreSQL RLS, dan laporan keuangan komprehensif tanpa batasan browser lokal.
                </p>
                <div className="pt-2">
                  <Link href="/register" className="block">
                    <Button
                      type="button"
                      className="w-full bg-[#E8B931] hover:bg-[#D9A820] text-[#1E1B4B] font-bold text-xs h-10 shadow-sm"
                    >
                      Daftar Akun Nyata Sekarang
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal Konfirmasi Reset Seluruh Data */}
        <Modal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          title="Reset Seluruh Data Mode Demo"
        >
          <div className="space-y-4">
            <p className="text-xs text-[#6E6A7C] leading-relaxed">
              Tindakan ini akan mengembalikan seluruh katalog produk, riwayat transaksi penjualan, pembelian, dan pengeluaran kembali ke data seed awal (*Toko Sembako Sejahtera*).
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0EDF5]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmResetAll}
                className="text-xs font-semibold"
                id="confirm-reset-all-btn"
              >
                Ya, Reset Seluruh Data
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Konfirmasi Bersihkan Transaksi Saja */}
        <Modal
          isOpen={isClearTransModalOpen}
          onClose={() => setIsClearTransModalOpen(false)}
          title="Kosongkan Transaksi Saja"
        >
          <div className="space-y-4">
            <p className="text-xs text-[#6E6A7C] leading-relaxed">
              Tindakan ini akan menghapus seluruh faktur penjualan, pembelian restock, dan beban operasional, tetapi <strong>katalog produk dan profil toko Anda akan tetap aman</strong>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0EDF5]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClearTransModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmClearTransactions}
                className="text-xs font-semibold"
                id="confirm-clear-trans-btn"
              >
                Ya, Kosongkan Transaksi
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DemoLayout>
  );
}
