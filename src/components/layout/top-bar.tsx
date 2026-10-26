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
        "h-16 border-b border-[#E7E3EC] bg-white sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between",
        className
      )}
      {...props}
    >
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Buka menu navigasi"
            className="lg:hidden p-2 rounded-md text-[#25232B] hover:bg-[#F0EDF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-[#25232B] tracking-tight truncate">
            {title}
          </h1>
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E8F8F0] border border-[#A3E4D7] text-[#1E824C] text-[11px] font-semibold"
            title="Sistem Online & Terhubung"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E824C] animate-pulse" aria-hidden="true" />
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Notifications, & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {actionsSlot && <div className="flex items-center">{actionsSlot}</div>}

        <button
          type="button"
          aria-label="Notifikasi"
          className="p-2 rounded-md text-[#716D7A] hover:text-[#25232B] hover:bg-[#F0EDF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3CC4] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-[#E7E3EC]">
          <div
            title={userEmail || userName}
            className="w-9 h-9 rounded-full bg-[#EAE4FF] text-[#5B3CC4] font-bold flex items-center justify-center text-sm border border-[#D5C8FF] select-none shrink-0"
            aria-label={`Profil: ${userName}`}
          >
            {initial}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-[#25232B] leading-tight truncate max-w-[120px]">
              {userName}
            </span>
            {userEmail && (
              <span className="text-[10px] text-[#716D7A] leading-tight truncate max-w-[120px]">
                {userEmail}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
