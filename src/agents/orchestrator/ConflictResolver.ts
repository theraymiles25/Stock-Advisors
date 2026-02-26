// =============================================================================
// Conflict Resolver - Detects and Resolves Agent Disagreements
// =============================================================================

import {
  AgentId,
  AgentOutput,
  ConflictReport,
  Recommendation,
  RecommendationAction,
} from '../base/types';

// Classify actions into directional buckets
function isBullish(action: RecommendationAction): boolean {
  return action === 'STRONG_BUY' || action === 'BUY';
}

function isBearish(action: RecommendationAction): boolean {
  return action === 'STRONG_SELL' || action === 'SELL';
}

interface AgentRecommendation {
  agentId: AgentId;
  recommendation: Recommendation;
}

/**
 * Detects conflicts between agent recommendations and produces
 * resolution summaries for the Master Orchestrator.
 */
export class ConflictResolver {
  /**
   * Analyze all agent outputs and detect symbols where agents disagree.
   */
  detect(outputs: Map<AgentId, AgentOutput>): ConflictReport[] {
    // Group all recommendations by symbol
    const bySymbol = new Map<string, AgentRecommendation[]>();

    for (const [agentId, output] of outputs) {
      if (output.status !== 'complete' && output.status !== ('COMPLETE' as never)) continue;

      for (const rec of output.recommendations) {
        const existing = bySymbol.get(rec.symbol) ?? [];
        existing.push({ agentId, recommendation: rec });
        bySymbol.set(rec.symbol, existing);
      }
    }

    const conflicts: ConflictReport[] = [];

    for (const [symbol, agentRecs] of bySymbol) {
      // Need at least 2 agents to have a conflict
      if (agentRecs.length < 2) continue;

      const bulls = agentRecs.filter((ar) => isBullish(ar.recommendation.action));
      const bears = agentRecs.filter((ar) => isBearish(ar.recommendation.action));
      const neutrals = agentRecs.filter(
        (ar) => ar.recommendation.action === 'HOLD'
      );

      // Only flag if there are agents on both sides
      if (bulls.length === 0 || bears.length === 0) continue;

      const resolution = this.resolveConflict(bulls, bears, neutrals);
      const severity = this.calculateSeverity(bulls, bears, agentRecs.length);

      conflicts.push({
        symbol,
        bullishAgents: bulls.map((ar) => ar.agentId),
        bearishAgents: bears.map((ar) => ar.agentId),
        neutralAgents: neutrals.map((ar) => ar.agentId),
        resolution,
        severityScore: severity,
      });
    }

    // Sort by severity (most severe first)
    return conflicts.sort((a, b) => b.severityScore - a.severityScore);
  }

  /**
   * Resolve a conflict using confidence-weighted voting.
   */
  private resolveConflict(
    bulls: AgentRecommendation[],
    bears: AgentRecommendation[],
    neutrals: AgentRecommendation[]
  ): string {
    const bullConfidence =
      bulls.reduce((sum, ar) => sum + ar.recommendation.confidence, 0) /
      bulls.length;
    const bearConfidence =
      bears.reduce((sum, ar) => sum + ar.recommendation.confidence, 0) /
      bears.length;

    // Weight by both count and average confidence
    const bullWeight = bulls.length * bullConfidence;
    const bearWeight = bears.length * bearConfidence;

    const totalAgents = bulls.length + bears.length + neutrals.length;
    const bullPercent = Math.round((bulls.length / totalAgents) * 100);
    const bearPercent = Math.round((bears.length / totalAgents) * 100);

    if (bullWeight > bearWeight * 1.5) {
      return `Strong lean bullish: ${bulls.length} agents (${bullPercent}%) bullish with avg confidence ${Math.round(bullConfidence)}% vs ${bears.length} agents (${bearPercent}%) bearish with avg confidence ${Math.round(bearConfidence)}%. The weight of evidence favors the upside thesis.`;
    } else if (bearWeight > bullWeight * 1.5) {
      return `Strong lean bearish: ${bears.length} agents (${bearPercent}%) bearish with avg confidence ${Math.round(bearConfidence)}% vs ${bulls.length} agents (${bullPercent}%) bullish with avg confidence ${Math.round(bullConfidence)}%. The weight of evidence favors caution.`;
    } else if (bullWeight > bearWeight) {
      return `Slight lean bullish: ${bulls.length} agents (${bullPercent}%) bullish vs ${bears.length} agents (${bearPercent}%) bearish. Close call — consider smaller position size due to divided opinion.`;
    } else if (bearWeight > bullWeight) {
      return `Slight lean bearish: ${bears.length} agents (${bearPercent}%) bearish vs ${bulls.length} agents (${bullPercent}%) bullish. Close call — recommend caution and tighter stops if entering.`;
    } else {
      return `Evenly split: ${bulls.length} agents bullish vs ${bears.length} agents bearish with similar conviction. Consider staying on the sidelines or trading with reduced size.`;
    }
  }

  /**
   * Calculate how severe a conflict is (0-100).
   * Higher severity = more agents disagree with higher conviction.
   */
  private calculateSeverity(
    bulls: AgentRecommendation[],
    bears: AgentRecommendation[],
    totalAgents: number
  ): number {
    // Factor 1: How evenly split are the agents? (50/50 = max severity)
    const splitRatio = Math.min(bulls.length, bears.length) / Math.max(bulls.length, bears.length);

    // Factor 2: How many agents are involved?
    const participationRate = (bulls.length + bears.length) / totalAgents;

    // Factor 3: How confident are the disagreeing agents?
    const avgBullConf =
      bulls.reduce((s, ar) => s + ar.recommendation.confidence, 0) / bulls.length;
    const avgBearConf =
      bears.reduce((s, ar) => s + ar.recommendation.confidence, 0) / bears.length;
    const avgConfidence = (avgBullConf + avgBearConf) / 2;

    // Combine: more even split, more participants, higher confidence = more severe
    const severity = splitRatio * 40 + participationRate * 30 + (avgConfidence / 100) * 30;

    return Math.round(Math.min(100, Math.max(0, severity)));
  }

  /**
   * Format conflict reports as a readable summary for the Master Orchestrator prompt.
   */
  formatForPrompt(conflicts: ConflictReport[]): string {
    if (conflicts.length === 0) {
      return 'No significant conflicts detected — agents are broadly in agreement.';
    }

    const lines: string[] = ['## Agent Conflicts Detected\n'];

    for (const conflict of conflicts) {
      lines.push(`### ${conflict.symbol} (Severity: ${conflict.severityScore}/100)`);
      lines.push(`- Bullish: ${conflict.bullishAgents.join(', ')}`);
      lines.push(`- Bearish: ${conflict.bearishAgents.join(', ')}`);
      if (conflict.neutralAgents.length > 0) {
        lines.push(`- Neutral: ${conflict.neutralAgents.join(', ')}`);
      }
      lines.push(`- Resolution: ${conflict.resolution}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
