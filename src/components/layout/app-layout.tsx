"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileNav } from "./mobile-nav";
import { cn } from "@/lib/utils";

export interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  currentPath?: string;
  activeBusinessName?: string;
  businessCategory?: string;
  userName?: string;
  userEmail?: string;
  actionsSlot?: React.ReactNode;
  onBusinessSwitchClick?: () => void;
  className?: string;
}

export function AppLayout({
  children,
  title = "VeyraOS",
  currentPath = "/dashboard",
  activeBusinessName = "Bisnis Saya",
  businessCategory,
  userName = "Pengguna",
  userEmail,
  actionsSlot,
  onBusinessSwitchClick,
  className,
}: AppLayoutProps) {
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
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#5B3CC4] focus:text-white focus:font-semibold focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-3 focus:ring-[rgba(91,60,196,0.5)]"
      >
        Lewati ke konten utama
      </a>

      {/* Desktop Sidebar & Mobile Drawer */}
      <Sidebar
        currentPath={currentPath}
        activeBusinessName={activeBusinessName}
        businessCategory={businessCategory}
        onBusinessSwitchClick={onBusinessSwitchClick}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={closeMobileMenu}
      />

      {/* Main Content Area (offset by 64 (256px) on lg) */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <TopBar
          title={title}
          userName={userName}
          userEmail={userEmail}
          actionsSlot={actionsSlot}
          onMenuToggle={toggleMobileMenu}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-24 lg:pb-8 focus:outline-none",
            className
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav currentPath={currentPath} onMoreMenuClick={toggleMobileMenu} />
    </div>
  );
}
