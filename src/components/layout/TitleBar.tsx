// =============================================================================
// Stock Advisors - Custom macOS Title Bar
// =============================================================================
// A 38px draggable title bar that integrates with Tauri's titleBarStyle: Overlay.
// Left side reserves space for macOS traffic light buttons. Center displays the
// app name. Right side has search and notification controls.
// =============================================================================

import { Search, Bell } from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TitleBarProps {
  /** Number of unread notifications to display as a badge */
  notificationCount?: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function TitleBar({ notificationCount = 0 }: TitleBarProps) {
  return (
    <header
      className="titlebar-drag flex h-[var(--spacing-titlebar)] shrink-0 items-center
                 bg-[var(--color-sa-bg-secondary)]/80 backdrop-blur-md
                 border-b border-[var(--color-sa-border)]"
    >
      {/* Left: Reserve space for macOS traffic light buttons */}
      <div className="w-[68px] shrink-0" />

      {/* Center: App title */}
      <div className="flex-1 text-center">
        <span className="text-[13px] font-medium text-[var(--color-sa-text-muted)] tracking-wide select-none">
          Stock Advisors
        </span>
      </div>

      {/* Right: Action buttons */}
      <div className="titlebar-no-drag flex items-center gap-1 pr-3">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md
                     text-[var(--color-sa-text-muted)]
                     hover:bg-[var(--color-sa-bg-hover)] hover:text-[var(--color-sa-text-secondary)]
                     transition-colors duration-150"
          aria-label="Search"
        >
          <Search size={14} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className="relative flex h-7 w-7 items-center justify-center rounded-md
                     text-[var(--color-sa-text-muted)]
                     hover:bg-[var(--color-sa-bg-hover)] hover:text-[var(--color-sa-text-secondary)]
                     transition-colors duration-150"
          aria-label="Notifications"
        >
          <Bell size={14} strokeWidth={1.8} />

          {notificationCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center
                         justify-center rounded-full bg-[var(--color-sa-red)] px-1
                         text-[9px] font-bold leading-none text-white"
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
