import { Menu, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  onMenuToggle?: () => void;
  userEmail?: string;
  userName?: string;
  actionsSlot?: React.ReactNode;
}

export function TopBar({
  title = "VeyraOS",
  onMenuToggle,
  userEmail,
  userName = "Pengguna",
  actionsSlot,
  className,
  ...props
}: TopBarProps) {
  const initial = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <header
      aria-label="Bilah Atas Aplikasi"
      className={cn(
        "h-16 border-b border-[#E5E1EC] bg-white/95 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between shadow-2xs",
        className
      )}
      {...props}
    >
      {/* Left: Mobile Toggle & Page Title with Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Buka menu navigasi"
            className="lg:hidden p-2 rounded-xl text-[#1A1820] hover:bg-[#F4F0FD] hover:text-[#5B3CC4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#767182] hidden sm:inline select-none">
              VeyraOS
            </span>
            <span className="text-[#C4BFCB] hidden sm:inline select-none">/</span>
            <h1 className="text-sm sm:text-base font-bold text-[#1A1820] tracking-tight truncate">
              {title}
            </h1>
            <div
              className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EBF8F2] border border-[#A6E7C7] text-[#0D894F] text-[10px] font-semibold select-none ml-1 shrink-0"
              title="Sistem Online & Terhubung"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0D894F]" aria-hidden="true" />
              <span>Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions, Search Prompt, Notifications, & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actionsSlot && <div className="flex items-center">{actionsSlot}</div>}

        <button
          type="button"
          aria-label="Notifikasi"
          className="p-2 rounded-xl text-[#767182] hover:text-[#1A1820] hover:bg-[#F8F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
        >
          <Bell className="w-4.5 h-4.5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5 pl-2.5 border-l border-[#E5E1EC]">
          <div
            title={userEmail || userName}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F4F0FD] to-[#EAE4FF] text-[#5B3CC4] font-bold flex items-center justify-center text-sm border border-[#DDD5F5] select-none shrink-0 shadow-2xs"
            aria-label={`Profil: ${userName}`}
          >
            {initial}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-[#1A1820] leading-tight truncate max-w-[130px]">
              {userName}
            </span>
            {userEmail && (
              <span className="text-[10px] text-[#767182] leading-tight truncate max-w-[130px]">
                {userEmail}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
