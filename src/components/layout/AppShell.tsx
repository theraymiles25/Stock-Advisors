// =============================================================================
// Stock Advisors - Application Shell Layout
// =============================================================================
// The root layout wrapper for the entire application. Composes TitleBar,
// Sidebar, StatusBar, and the main content area into a cohesive layout that
// fills the full viewport height. Used by App.tsx to wrap all routes.
//
// Layout structure:
// +-------------------------------------------+
// |              TitleBar (38px)               |
// +----------+--------------------------------+
// |          |                                |
// | Sidebar  |        Main Content            |
// | (260px)  |        (flex-1, scrollable)    |
// |          |                                |
// +----------+--------------------------------+
// |              StatusBar (28px)              |
// +-------------------------------------------+
// =============================================================================

import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AppShellProps {
  children: React.ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-sa-bg-primary)]">
      {/* Fixed title bar at the top */}
      <TitleBar />

      {/* Middle row: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-[var(--color-sa-bg-primary)] p-6">
          {children}
        </main>
      </div>

      {/* Fixed status bar at the bottom */}
      <StatusBar />
    </div>
  );
}
