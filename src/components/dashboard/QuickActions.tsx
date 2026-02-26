// =============================================================================
// Stock Advisors - Quick Actions Component
// =============================================================================
// Row of quick action buttons for common tasks: Full Analysis, Quick Screen,
// Paper Trade, and View History. Each button navigates to the corresponding
// application page.
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { Workflow, Search, LineChart, Clock } from 'lucide-react';

// -----------------------------------------------------------------------------
// Action Definition
// -----------------------------------------------------------------------------

interface ActionItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

// -----------------------------------------------------------------------------
// Quick Actions
// -----------------------------------------------------------------------------

export default function QuickActions() {
  const navigate = useNavigate();

  const actions: ActionItem[] = [
    {
      icon: <Workflow size={16} className="text-[var(--color-sa-accent)]" />,
      label: 'Run Full Analysis',
      path: '/analysis',
    },
    {
      icon: <Search size={16} className="text-[var(--color-sa-accent)]" />,
      label: 'Quick Screen',
      path: '/agent/goldman_screener',
    },
    {
      icon: <LineChart size={16} className="text-[var(--color-sa-accent)]" />,
      label: 'Paper Trade',
      path: '/paper-trading',
    },
    {
      icon: <Clock size={16} className="text-[var(--color-sa-accent)]" />,
      label: 'View History',
      path: '/history',
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => navigate(action.path)}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-sa-border)]
                     bg-[var(--color-sa-bg-secondary)] px-3.5 py-2 text-left transition-all duration-150
                     hover:border-[var(--color-sa-border-hover)] hover:bg-[var(--color-sa-bg-hover)]"
        >
          {action.icon}
          <span className="text-[12px] font-medium text-[var(--color-sa-text-primary)]">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}
