// =============================================================================
// Stock Advisors - Agent Avatar Component
// =============================================================================
// Reusable avatar showing a colored circle with an optional lucide-react icon
// and a status ring overlay. Used in the sidebar, chat header, dashboard cards,
// and agent detail pages.
// =============================================================================

import {
  TrendingUp,
  Calculator,
  Shield,
  BarChart3,
  PieChart,
  Activity,
  Landmark,
  Target,
  Brain,
  Globe,
  Radar,
  GitBranch,
  Award,
  Zap,
  Newspaper,
  Crown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AgentStatus } from '../../agents/base/types';

// -----------------------------------------------------------------------------
// Icon Registry
// -----------------------------------------------------------------------------

/**
 * Map of icon name strings (from AgentPersonality.avatarIcon) to the actual
 * lucide-react component. This avoids dynamic imports and keeps the bundle
 * tree-shakeable.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  Calculator,
  Shield,
  BarChart3,
  PieChart,
  Activity,
  Landmark,
  Target,
  Brain,
  Globe,
  Radar,
  GitBranch,
  Award,
  Zap,
  Newspaper,
  Crown,
};

// -----------------------------------------------------------------------------
// Size Variants
// -----------------------------------------------------------------------------

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CONFIG: Record<
  AvatarSize,
  { container: string; iconSize: number; ringWidth: string }
> = {
  sm: { container: 'h-6 w-6', iconSize: 12, ringWidth: 'ring-[1.5px]' },
  md: { container: 'h-8 w-8', iconSize: 16, ringWidth: 'ring-2' },
  lg: { container: 'h-12 w-12', iconSize: 24, ringWidth: 'ring-2' },
};

// -----------------------------------------------------------------------------
// Status Ring Colors
// -----------------------------------------------------------------------------

function getStatusRingClass(status?: AgentStatus): string {
  switch (status) {
    case AgentStatus.THINKING:
      return 'ring-[var(--color-sa-amber)] agent-thinking';
    case AgentStatus.STREAMING:
      return 'ring-[var(--color-sa-accent)]';
    case AgentStatus.ERROR:
      return 'ring-[var(--color-sa-red)]';
    case AgentStatus.COMPLETE:
      return 'ring-[var(--color-sa-green)]';
    default:
      return 'ring-transparent';
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface AgentAvatarProps {
  /** Hex color for the avatar background */
  avatarColor: string;
  /** Name of the lucide-react icon to display inside the circle */
  avatarIcon?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Optional agent status for ring overlay */
  status?: AgentStatus;
  /** Additional CSS classes */
  className?: string;
}

export default function AgentAvatar({
  avatarColor,
  avatarIcon,
  size = 'md',
  status,
  className = '',
}: AgentAvatarProps) {
  const config = SIZE_CONFIG[size];
  const IconComponent = avatarIcon ? ICON_MAP[avatarIcon] : null;
  const ringClass = status ? getStatusRingClass(status) : 'ring-transparent';

  return (
    <div
      className={`
        relative inline-flex shrink-0 items-center justify-center rounded-full
        ${config.container} ${config.ringWidth} ${ringClass}
        transition-shadow duration-300
        ${className}
      `}
      style={{ backgroundColor: avatarColor }}
    >
      {IconComponent && (
        <IconComponent
          size={config.iconSize}
          strokeWidth={1.8}
          className="text-white/90"
        />
      )}
    </div>
  );
}
