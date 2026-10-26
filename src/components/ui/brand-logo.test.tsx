import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLogo, BrandSymbol } from "./brand-logo";

describe("Brand Identity Component Suite (BrandSymbol & BrandLogo)", () => {
  // -------------------------------------------------------------------------
  // 1. BrandSymbol (SVG Icon)
  // -------------------------------------------------------------------------
  describe("BrandSymbol Component", () => {
    it("renders modern SVG symbol with correct viewBox and geometric facets", () => {
      const html = renderToStaticMarkup(<BrandSymbol size="md" />);
      expect(html).toContain("<svg");
      expect(html).toContain('viewBox="0 0 32 32"');
      expect(html).toContain('width="28"');
      expect(html).toContain('height="28"');
      expect(html).toContain('aria-hidden="true"');
      // Palette gradient definitions & precision gold pip
      expect(html).toContain("#5B3CC4");
      expect(html).toContain("#392477");
      expect(html).toContain("#EAE4FF");
      expect(html).toContain("#FFD54F");
      // Squircle base
      expect(html).toContain('rx="7.5"');
    });

    it("renders proportional dimensions for all standard sizes (sm, md, lg, xl)", () => {
      const sm = renderToStaticMarkup(<BrandSymbol size="sm" />);
      expect(sm).toContain('width="20"');
      expect(sm).toContain('height="20"');

      const md = renderToStaticMarkup(<BrandSymbol size="md" />);
      expect(md).toContain('width="28"');
      expect(md).toContain('height="28"');

      const lg = renderToStaticMarkup(<BrandSymbol size="lg" />);
      expect(lg).toContain('width="38"');
      expect(lg).toContain('height="38"');

      const xl = renderToStaticMarkup(<BrandSymbol size="xl" />);
      expect(xl).toContain('width="48"');
      expect(xl).toContain('height="48"');
    });

    it("supports custom numeric dimension for exact layout needs", () => {
      const custom = renderToStaticMarkup(<BrandSymbol size={32} />);
      expect(custom).toContain('width="32"');
      expect(custom).toContain('height="32"');
    });
  });

  // -------------------------------------------------------------------------
  // 2. BrandLogo (Emblem + Wordmark + Tagline)
  // -------------------------------------------------------------------------
  describe("BrandLogo Component", () => {
    it("renders default wordmark 'VeyraOS' alongside BrandSymbol", () => {
      const html = renderToStaticMarkup(<BrandLogo size="md" />);
      expect(html).toContain("VeyraOS");
      expect(html).toContain("<svg");
      expect(html).toContain("text-[#25232B]");
    });

    it("renders official tagline when showTagline is enabled", () => {
      const html = renderToStaticMarkup(
        <BrandLogo size="lg" showTagline tagline="Business &amp; Finance Engine" />
      );
      expect(html).toContain("VeyraOS");
      expect(html).toContain("Business &amp; Finance Engine");
      expect(html).toContain("text-[#716D7A]");
    });

    it("renders dark surface variant with high-contrast text-white wordmark", () => {
      const html = renderToStaticMarkup(
        <BrandLogo size="md" variant="on-dark" showTagline tagline="Simulasi Mandiri" />
      );
      expect(html).toContain("VeyraOS");
      expect(html).toContain("text-white");
      expect(html).toContain("Simulasi Mandiri");
    });

    it("supports symbol-only rendering when showWordmark is false", () => {
      const html = renderToStaticMarkup(<BrandLogo showWordmark={false} />);
      expect(html).toContain("<svg");
      expect(html).not.toContain("VeyraOS");
    });
  });
});
