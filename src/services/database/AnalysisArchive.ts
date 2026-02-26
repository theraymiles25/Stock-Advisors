// =============================================================================
// Stock Advisors - Analysis Archive (Snapshot Operations)
// =============================================================================
// Archives full agent input/output snapshots for every pipeline run.
// Enables historical lookback, debugging, back-testing, and injecting
// prior analyses into agent prompts for context continuity.
// =============================================================================

import { execute, select } from './Database';
import type { AgentId, TokenUsage } from '../../agents/base/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * A single analysis snapshot row from the database.
 * The `input_data` and `output_data` fields store JSON-serialized objects.
 */
export interface AnalysisSnapshot {
  id: number;
  pipeline_id: string | null;
  agent_id: string;
  symbols: string;
  input_data: string;
  output_data: string;
  summary: string | null;
  confidence: number | null;
  token_usage: string | null;
  created_at: string;
}

/**
 * Parsed version of an AnalysisSnapshot with deserialized JSON fields.
 */
export interface ParsedAnalysisSnapshot {
  id: number;
  pipelineId: string | null;
  agentId: string;
  symbols: string[];
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  summary: string | null;
  confidence: number | null;
  tokenUsage: TokenUsage | null;
  createdAt: string;
}

/**
 * All snapshots from a single pipeline run, grouped for easy consumption.
 */
export interface PipelineSnapshot {
  pipelineId: string;
  snapshots: ParsedAnalysisSnapshot[];
  agentCount: number;
  symbols: string[];
  totalTokens: number;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parse a raw AnalysisSnapshot row into the deserialized form.
 */
function parseSnapshot(row: AnalysisSnapshot): ParsedAnalysisSnapshot {
  let inputData: Record<string, unknown> = {};
  let outputData: Record<string, unknown> = {};
  let tokenUsage: TokenUsage | null = null;

  try {
    inputData = JSON.parse(row.input_data);
  } catch {
    inputData = { raw: row.input_data };
  }

  try {
    outputData = JSON.parse(row.output_data);
  } catch {
    outputData = { raw: row.output_data };
  }

  if (row.token_usage) {
    try {
      tokenUsage = JSON.parse(row.token_usage);
    } catch {
      tokenUsage = null;
    }
  }

  return {
    id: row.id,
    pipelineId: row.pipeline_id,
    agentId: row.agent_id,
    symbols: row.symbols.split(',').map((s) => s.trim()),
    inputData,
    outputData,
    summary: row.summary,
    confidence: row.confidence,
    tokenUsage,
    createdAt: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Write Operations
// -----------------------------------------------------------------------------

/**
 * Archive a complete agent analysis snapshot.
 * Returns the ID of the inserted snapshot.
 */
export async function saveSnapshot(
  pipelineId: string | null,
  agentId: AgentId | string,
  symbols: string[],
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  summary: string | null,
  confidence: number | null,
  tokenUsage: TokenUsage | null
): Promise<number> {
  const result = await execute(
    `INSERT INTO analysis_snapshots
      (pipeline_id, agent_id, symbols, input_data, output_data, summary, confidence, token_usage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pipelineId,
      agentId,
      symbols.map((s) => s.toUpperCase()).join(','),
      JSON.stringify(input),
      JSON.stringify(output),
      summary,
      confidence,
      tokenUsage ? JSON.stringify(tokenUsage) : null,
    ]
  );
  return result.lastInsertId;
}

// -----------------------------------------------------------------------------
// Read Operations
// -----------------------------------------------------------------------------

/**
 * Get all agent snapshots from a specific pipeline run.
 */
export async function getSnapshotsForPipeline(
  pipelineId: string
): Promise<PipelineSnapshot> {
  const rows = await select<AnalysisSnapshot>(
    'SELECT * FROM analysis_snapshots WHERE pipeline_id = ? ORDER BY created_at ASC',
    [pipelineId]
  );

  const snapshots = rows.map(parseSnapshot);

  // Gather all unique symbols across the pipeline
  const allSymbols = new Set<string>();
  for (const snap of snapshots) {
    for (const sym of snap.symbols) {
      allSymbols.add(sym);
    }
  }

  // Sum total tokens
  const totalTokens = snapshots.reduce((sum, snap) => {
    return sum + (snap.tokenUsage?.totalTokens ?? 0);
  }, 0);

  return {
    pipelineId,
    snapshots,
    agentCount: snapshots.length,
    symbols: Array.from(allSymbols),
    totalTokens,
    createdAt: snapshots.length > 0 ? snapshots[0].createdAt : new Date().toISOString(),
  };
}

/**
 * Get recent snapshots for a specific agent.
 */
export async function getSnapshotsForAgent(
  agentId: AgentId | string,
  limit: number = 20
): Promise<ParsedAnalysisSnapshot[]> {
  const rows = await select<AnalysisSnapshot>(
    'SELECT * FROM analysis_snapshots WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
    [agentId, limit]
  );
  return rows.map(parseSnapshot);
}

/**
 * Get all analyses that include a specific symbol.
 * Uses LIKE to match the comma-separated symbols field.
 */
export async function getSnapshotsForSymbol(
  symbol: string,
  limit: number = 20
): Promise<ParsedAnalysisSnapshot[]> {
  const upperSymbol = symbol.toUpperCase();
  const rows = await select<AnalysisSnapshot>(
    'SELECT * FROM analysis_snapshots WHERE symbols LIKE ? ORDER BY created_at DESC LIMIT ?',
    [`%${upperSymbol}%`, limit]
  );

  // Post-filter to avoid false positives (e.g., "AAPL" matching "AAPL,MSFT"
  // is fine, but we want exact symbol matches within the CSV)
  return rows
    .map(parseSnapshot)
    .filter((snap) => snap.symbols.includes(upperSymbol));
}

/**
 * Get the most recent analysis runs across all agents.
 */
export async function getRecentAnalyses(
  limit: number = 50
): Promise<ParsedAnalysisSnapshot[]> {
  const rows = await select<AnalysisSnapshot>(
    'SELECT * FROM analysis_snapshots ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(parseSnapshot);
}
