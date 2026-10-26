"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, AlertTriangle, ArrowRight, X, Sparkles, Check } from "lucide-react";
import { demoStoreService } from "@/services/demo/demo-store.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DemoBanner() {
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState("");

  const handleOpenConfirm = () => {
    setShowConfirmModal(true);
  };

  const handleCloseConfirm = () => {
    setShowConfirmModal(false);
  };

  const handleExecuteReset = () => {
    demoStoreService.resetState();
    setShowConfirmModal(false);
    setToastMessage("Data simulasi Toko Sembako Sejahtera berhasil dikembalikan ke kondisi awal.");
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // Tutup dialog dengan tombol Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showConfirmModal) {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmModal]);

  return (
    <>
      {/* Toast Notifikasi Reset Sukses */}
      {showToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 bg-[#0E6251] text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="ml-2 text-white/70 hover:text-white"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* Banner Persisten di Bagian Atas */}
      <header
        role="region"
        aria-label="Banner Penanda Mode Demo"
        className="sticky top-0 z-40 w-full bg-[#392477] text-white border-b border-[#251554] shadow-xs"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 sm:py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          {/* Lencana & Deskripsi Status Simulasi */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Badge
              variant="demo"
              className="shrink-0 text-[10px] tracking-wider py-0.5 px-2 bg-[#FFD54F] text-[#25232B] font-bold border-[#FBC02D]"
            >
              MODE DEMO — SIMULASI
            </Badge>
            <p className="text-xs text-white/90 truncate leading-snug">
              <span className="font-semibold text-white">Toko Sembako Sejahtera.</span>{" "}
              <span className="hidden sm:inline text-white/80">
                Data disimpan lokal di peramban Anda dan terisolasi dari database produksi.
              </span>
            </p>
          </div>

          {/* Tombol Aksi: Reset & Daftar Nyata */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenConfirm}
              id="demo-reset-btn"
              className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/40 transition-colors font-medium"
              title="Kembalikan seluruh data demo ke kondisi awal"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-[#FFD54F]" aria-hidden="true" />
              Reset Data
            </Button>

            <Link href="/register" tabIndex={-1}>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-[#FFD54F] hover:bg-[#FBC02D] text-[#25232B] font-bold border-none transition-colors"
                id="demo-register-link-btn"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#392477]" aria-hidden="true" />
                Daftar Akun Nyata
                <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Modal Dialog Konfirmasi Reset Data Demo */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-reset-title"
          aria-describedby="confirm-reset-desc"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-[#25232B]/60 backdrop-blur-xs transition-opacity"
            onClick={handleCloseConfirm}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#E7E3EC] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#FDEDEC] text-[#922B21] flex items-center justify-center shrink-0 border border-[#F5B7B1]">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 id="confirm-reset-title" className="text-base font-bold text-[#25232B]">
                  Reset Data Mode Demo?
                </h2>
                <p id="confirm-reset-desc" className="text-xs text-[#716D7A] leading-relaxed">
                  Tindakan ini akan mengembalikan seluruh produk, transaksi kasir, pembelian restock,
                  dan pengeluaran kas simulasi kembali ke dataset awal default (*Toko Sembako Sejahtera*).
                  Perubahan lokal yang belum disimpan akan terhapus.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F0EDF5]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseConfirm}
                className="text-xs min-h-[38px] px-4"
                id="cancel-reset-btn"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleExecuteReset}
                className="text-xs min-h-[38px] px-4 bg-[#922B21] hover:bg-[#78281F] text-white font-semibold"
                id="confirm-reset-btn"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Ya, Reset ke Seed Awal
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
