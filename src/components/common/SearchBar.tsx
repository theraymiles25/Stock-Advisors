// =============================================================================
// Stock Advisors - Search Bar Component
// =============================================================================
// Stock symbol search input with auto-uppercase, search icon, and Enter key
// submission. Clean, minimal styling that integrates with the dark theme.
// =============================================================================

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface SearchBarProps {
  onSubmit: (symbol: string) => void;
  placeholder?: string;
  className?: string;
}

// -----------------------------------------------------------------------------
// Search Bar
// -----------------------------------------------------------------------------

export default function SearchBar({
  onSubmit,
  placeholder = 'Search symbol...',
  className = '',
}: SearchBarProps) {
  const [value, setValue] = useState('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value.toUpperCase());
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const trimmed = value.trim();
        if (trimmed) {
          onSubmit(trimmed);
          setValue('');
        }
      }
    },
    [value, onSubmit]
  );

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-[var(--color-sa-border)]
                  bg-[var(--color-sa-bg-secondary)] px-3 py-2 transition-colors duration-150
                  focus-within:border-[var(--color-sa-accent)]/50 ${className}`}
    >
      <Search size={14} className="shrink-0 text-[var(--color-sa-text-dim)]" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] text-[var(--color-sa-text-primary)]
                   placeholder:text-[var(--color-sa-text-dim)] outline-none"
      />
    </div>
  );
}
