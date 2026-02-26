// =============================================================================
// Stock Advisors - Global Keyboard Shortcuts
// =============================================================================
// Registers global keyboard shortcuts for navigation and app-wide actions.
// Uses Cmd (Mac) or Ctrl (non-Mac) as the modifier key.
//
// Shortcuts:
//   Cmd+K     Focus search bar
//   Cmd+1..8  Navigate to app sections
//   Escape    Close modals / dropdowns
// =============================================================================

import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';

// -----------------------------------------------------------------------------
// Route Map
// -----------------------------------------------------------------------------

/** Maps digit keys (1-8) to their corresponding routes */
const DIGIT_ROUTES: Record<string, string> = {
  '1': '/',
  '2': '/analysis',
  '3': '/paper-trading',
  '4': '/portfolio',
  '5': '/watchlist',
  '6': '/history',
  '7': '/performance',
  '8': '/settings',
};

// -----------------------------------------------------------------------------
// Platform Detection
// -----------------------------------------------------------------------------

/** Returns true when running on macOS (uses Cmd; other platforms use Ctrl) */
function isMac(): boolean {
  return navigator.platform.toUpperCase().includes('MAC');
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Registers global keyboard shortcuts for the application.
 * Must be called inside a component that has access to React Router context.
 *
 * @param navigate - The `useNavigate()` function from react-router-dom
 */
export function useKeyboardShortcuts(navigate: NavigateFunction): void {
  useEffect(() => {
    const mac = isMac();

    function handleKeyDown(e: KeyboardEvent) {
      const modifier = mac ? e.metaKey : e.ctrlKey;

      // --- Escape: close modals / dropdowns ---
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('stock-advisors:escape'));
        return;
      }

      // All remaining shortcuts require the modifier key
      if (!modifier) return;

      // --- Cmd+K: focus search ---
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('stock-advisors:focus-search'));
        return;
      }

      // --- Cmd+1 through Cmd+8: navigate ---
      const route = DIGIT_ROUTES[e.key];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);
}
