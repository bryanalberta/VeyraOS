"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, RotateCcw, Sparkles } from "lucide-react";
import { DemoBanner } from "./demo-banner";
import { DemoSidebar } from "./demo-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { demoStoreService } from "@/services/demo/demo-store.service";
import { cn } from "@/lib/utils";

export interface DemoLayoutProps {
  children: React.ReactNode;
  title?: string;
  currentPath?: string;
  className?: string;
}

export function DemoLayout({
  children,
  title = "Dashboard Demo",
  currentPath = "/demo/dashboard",
  className,
}: DemoLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const toggleMobileMenu = React.useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = React.useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#25232B] flex flex-col antialiased">
      {/* Skip to Content for Accessibility */}
      <a
        href="#demo-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#5B3CC4] focus:text-white focus:font-semibold focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-3 focus:ring-[rgba(91,60,196,0.5)]"
      >
        Lewati ke konten demo
      </a>

      {/* Persistent Demo Banner (Top of Screen) */}
      <DemoBanner />

      <div className="flex-1 flex relative">
        {/* Desktop Sidebar & Mobile Drawer */}
        <DemoSidebar
          currentPath={currentPath}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={closeMobileMenu}
        />

        {/* Main Content Area (offset by 256px on lg screens) */}
        <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
          {/* Demo Top Bar */}
          <header className="h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-[#E5E1EC] sticky top-0 z-20 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="p-2 -ml-2 rounded-xl text-[#767182] hover:bg-[#F4F0FD] hover:text-[#5B3CC4] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Buka menu navigasi demo"
                aria-expanded={isMobileMenuOpen}
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>

              <div className="flex items-center gap-2 truncate">
                <span className="text-[11px] font-medium text-[#767182] hidden sm:inline select-none">
                  Simulasi
                </span>
                <span className="text-[#C4BFCB] hidden sm:inline select-none">/</span>
                <h1 className="text-sm sm:text-base font-bold text-[#1A1820] tracking-tight truncate">
                  {title}
                </h1>
                <Badge variant="demo" className="text-[9px] hidden sm:inline-flex shrink-0">
                  Simulasi
                </Badge>
              </div>
            </div>

            {/* Quick Actions in Top Bar */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => demoStoreService.resetState()}
                id="topbar-demo-reset-btn"
                className="text-xs h-8 hidden sm:flex items-center gap-1.5"
                title="Reset seluruh data ke seed awal"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#5B3CC4]" aria-hidden="true" />
                Reset Data
              </Button>

              <Link href="/register">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className="text-xs h-8 px-3.5"
                  id="topbar-demo-register-btn"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  <span className="hidden xs:inline">Daftar</span> Akun Nyata
                </Button>
              </Link>
            </div>
          </header>

          {/* Main Container */}
          <main
            id="demo-main-content"
            tabIndex={-1}
            suppressHydrationWarning
            className={cn(
              "flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-24 lg:pb-8 focus:outline-none",
              className
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
