import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Modal, determineInitialFocus, getFocusableElements } from "./modal";
import { Button } from "./button";

describe("Shared UI Primitive: Modal — Comprehensive & Remediation Suite", () => {
  it("tidak merender apapun saat isOpen bernilai false", () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Konten Rahasia</p>
      </Modal>
    );
    expect(html).toBe("");
  });

  it("merender dialog dengan role='dialog' dan aria-modal='true' saat isOpen bernilai true", () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={true} onClose={() => {}} title="Konfirmasi Void" id="modal-test">
        <p>Apakah Anda yakin?</p>
      </Modal>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="modal-test-title"');
    expect(html).toContain("Konfirmasi Void");
    expect(html).toContain("Apakah Anda yakin?");
  });

  it("merender deskripsi dengan aria-describedby yang sesuai", () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Detail Transaksi"
        description="Ringkasan item dan pembayaran kasir"
        id="modal-desc-test"
      >
        <p>Konten</p>
      </Modal>
    );
    expect(html).toContain('aria-describedby="modal-desc-test-desc"');
    expect(html).toContain("Ringkasan item dan pembayaran kasir");
  });

  it("merender slot footer dengan aksi tombol", () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Modal dengan Footer"
        footer={
          <>
            <Button variant="outline">Batal</Button>
            <Button variant="primary">Simpan</Button>
          </>
        }
      >
        <p>Isi formulir</p>
      </Modal>
    );
    expect(html).toContain("Batal");
    expect(html).toContain("Simpan");
    expect(html).toContain("bg-[#FAF9F6]");
  });

  it("menampilkan spinner dan men-disable tombol tutup saat isLoading bernilai true", () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Sedang Memproses"
        isLoading={true}
      >
        <p>Mohon tunggu...</p>
      </Modal>
    );
    expect(html).toContain("animate-spin");
    expect(html).toContain("disabled");
  });

  it("men-disable tombol tutup saat preventClose bernilai true", () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Operasi Wajib"
        preventClose={true}
      >
        <p>Tidak boleh ditutup sembarangan</p>
      </Modal>
    );
    expect(html).toContain("disabled");
  });

  it("menerapkan ukuran yang dipilih (sm, md, lg, xl, full)", () => {
    const smHtml = renderToStaticMarkup(
      <Modal isOpen={true} onClose={() => {}} size="sm">
        <p>Small</p>
      </Modal>
    );
    expect(smHtml).toContain("max-w-sm");

    const lgHtml = renderToStaticMarkup(
      <Modal isOpen={true} onClose={() => {}} size="lg">
        <p>Large</p>
      </Modal>
    );
    expect(lgHtml).toContain("max-w-lg");

    const fullHtml = renderToStaticMarkup(
      <Modal isOpen={true} onClose={() => {}} size="full">
        <p>Full</p>
      </Modal>
    );
    expect(fullHtml).toContain("max-w-4xl");
  });

  it("dapat menyembunyikan tombol close saat showCloseButton=false", () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={true} onClose={() => {}} title="Tanpa Tombol Silang" showCloseButton={false}>
        <p>Konten</p>
      </Modal>
    );
    expect(html).not.toContain('aria-label="Tutup dialog"');
  });

  it("memiliki container dengan tabIndex -1 untuk menangkap fokus dialog", () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={true} onClose={() => {}} title="Focus Container Test">
        <p>Konten</p>
      </Modal>
    );
    expect(html).toContain('tabindex="-1"');
  });

  describe("Fokus Awal & Focus Trap Helpers (determineInitialFocus & getFocusableElements)", () => {
    function createMockElement(tag: string, attrs: Record<string, string> = {}, tabIndex = 0) {
      const attributes = { ...attrs };
      return {
        tagName: tag.toUpperCase(),
        tabIndex,
        hasAttribute: (name: string) => name in attributes,
        getAttribute: (name: string) => attributes[name] ?? null,
        focus: vi.fn(),
      } as unknown as HTMLElement;
    }

    function createMockContainer(elements: HTMLElement[]) {
      return {
        querySelectorAll: () => elements,
        contains: (el: HTMLElement | Node | null) => el !== null && elements.includes(el as HTMLElement),
        focus: vi.fn(),
      } as unknown as HTMLElement;
    }

    it("menyaring elemen yang disabled, aria-hidden, atau input hidden", () => {
      const validButton = createMockElement("button", {});
      const disabledButton = createMockElement("button", { disabled: "" });
      const hiddenAria = createMockElement("button", { "aria-hidden": "true" });
      const container = createMockContainer([validButton, disabledButton, hiddenAria]);

      const result = getFocusableElements(container);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(validButton);
    });

    it("memprioritaskan elemen form di body/footer dibanding tombol close X di header", () => {
      const closeButton = createMockElement("button", { "aria-label": "Tutup dialog" });
      const bodyInput = createMockElement("input", { id: "nominal-input" });
      const submitButton = createMockElement("button", { type: "submit" });

      const container = createMockContainer([closeButton, bodyInput, submitButton]);
      const initialTarget = determineInitialFocus(container);

      // Fokus awal harus memilih bodyInput, BUKAN closeButton
      expect(initialTarget).toBe(bodyInput);
    });

    it("memprioritaskan elemen dengan atribut [data-autofocus] jika ada", () => {
      const closeButton = createMockElement("button", { "aria-label": "Tutup dialog" });
      const bodyInput = createMockElement("input", { id: "nominal-input" });
      const primaryBtn = createMockElement("button", { "data-autofocus": "" });

      const container = createMockContainer([closeButton, bodyInput, primaryBtn]);
      const initialTarget = determineInitialFocus(container);

      expect(initialTarget).toBe(primaryBtn);
    });

    it("menghormati initialFocusRef jika dipasok oleh parent", () => {
      const closeButton = createMockElement("button", { "aria-label": "Tutup dialog" });
      const bodyInput = createMockElement("input", { id: "nominal-input" });
      const specialInput = createMockElement("input", { id: "special" });

      const container = createMockContainer([closeButton, bodyInput, specialInput]);
      const ref = { current: specialInput };

      const initialTarget = determineInitialFocus(container, ref);
      expect(initialTarget).toBe(specialInput);
    });

    it("fallback ke tombol close jika tidak ada input atau aksi lain di dalam modal", () => {
      const closeButton = createMockElement("button", { "aria-label": "Tutup dialog" });
      const container = createMockContainer([closeButton]);

      const initialTarget = determineInitialFocus(container);
      expect(initialTarget).toBe(closeButton);
    });

    it("mengembalikan null jika tidak ada elemen fokus sama sekali di modal", () => {
      const container = createMockContainer([]);
      const initialTarget = determineInitialFocus(container);
      expect(initialTarget).toBeNull();
    });
  });
});
