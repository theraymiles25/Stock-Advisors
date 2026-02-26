// =============================================================================
// Stock Advisors - Application Constants
// =============================================================================

import { AgentId } from '../agents/base/types';

// -----------------------------------------------------------------------------
// Agent Display Order
// -----------------------------------------------------------------------------

/**
 * The canonical order in which agents appear in the sidebar and throughout
 * the UI. Specialist agents first (grouped by domain), then the master
 * orchestrator last.
 */
export const AGENT_DISPLAY_ORDER: AgentId[] = [
  AgentId.GOLDMAN_SCREENER,
  AgentId.MORGAN_STANLEY_DCF,
  AgentId.JPMORGAN_EARNINGS,
  AgentId.CITADEL_TECHNICAL,
  AgentId.RENTECH_PATTERNS,
  AgentId.BRIDGEWATER_RISK,
  AgentId.BLACKROCK_PORTFOLIO,
  AgentId.HARVARD_DIVIDEND,
  AgentId.BAIN_COMPETITIVE,
  AgentId.MCKINSEY_MACRO,
  AgentId.SENTINEL_SENTIMENT,
  AgentId.SUSQUEHANNA_OPTIONS,
  AgentId.SHORT_TERM_TRADER,
  AgentId.NEWS_RESEARCH,
  AgentId.PERFORMANCE_ANALYST,
  AgentId.MASTER_ORCHESTRATOR,
];

// -----------------------------------------------------------------------------
// Claude Model Configuration
// -----------------------------------------------------------------------------

/** Default model used by most specialist agents */
export const MODEL_DEFAULT = 'claude-sonnet-4-20250514';

/** Deep-analysis model used by the master orchestrator and complex tasks */
export const MODEL_DEEP = 'claude-opus-4-20250514';

// -----------------------------------------------------------------------------
// Alpha Vantage
// -----------------------------------------------------------------------------

/** Base URL for all Alpha Vantage API requests */
export const AV_BASE_URL = 'https://www.alphavantage.co/query';
