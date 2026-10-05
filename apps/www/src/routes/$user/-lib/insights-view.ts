import type { ProfileInsightsResponse } from "@nightmaxxing/api-contract";

import { agentLabel } from "../../../lib/agents";
import { formatPercent, percentOf } from "../../../lib/format";

/**
 * Pure view-models for the Nightmaxxing profile insights: the per-agent
 * breakdown and the token mix. ccusage splits every agent's total into four
 * disjoint kinds (input excludes cached tokens, even for Codex), so the kinds
 * sum to the total and their shares are exact.
 */

type ProfileInsights = typeof ProfileInsightsResponse.Type;
type InsightsTotals = ProfileInsights["totals"];

/** What the Agents section ranks and measures by. */
type AgentMetric = "spend" | "tokens";

interface AgentRow {
  activeDays: number;
  label: string;
  /** Percentage (0–100) of the range's spend. */
  spendShare: number;
  spendUsd: number;
  source: string;
  /** Percentage (0–100) of the range's tokens. */
  tokenShare: number;
  totalTokens: number;
}

interface TokenMixRow {
  description: string;
  key: "cacheCreation" | "cacheRead" | "input" | "output";
  label: string;
  /** Percentage (0–100) of all tokens. */
  share: number;
  tokens: number;
}

interface TokenMix {
  /**
   * Percentage (0–100) of prompt tokens served from cache: cache reads over
   * everything the model read (fresh input, cache writes and cache reads).
   * Null without any prompt tokens.
   */
  cacheHitRate: number | null;
  rows: TokenMixRow[];
}

/** Agents ranked by spend (the API's order), with each one's share. */
function agentRows(insights: Pick<ProfileInsights, "agents" | "totals">): AgentRow[] {
  return insights.agents.map((agent) => ({
    activeDays: agent.activeDays,
    label: agentLabel(agent.source),
    source: agent.source,
    spendShare: percentOf(agent.spendUsd, insights.totals.spendUsd),
    spendUsd: agent.spendUsd,
    tokenShare: percentOf(agent.totalTokens, insights.totals.totalTokens),
    totalTokens: agent.totalTokens,
  }));
}

function tokenMix(totals: InsightsTotals): TokenMix {
  const kinds = [
    {
      description: "Prompt tokens served from the provider's cache",
      key: "cacheRead",
      label: "Cache reads",
      tokens: totals.cacheReadTokens,
    },
    {
      description: "Fresh prompt tokens, read at full price",
      key: "input",
      label: "Input",
      tokens: totals.inputTokens,
    },
    {
      description: "Prompt tokens written into the cache",
      key: "cacheCreation",
      label: "Cache writes",
      tokens: totals.cacheCreationTokens,
    },
    {
      description: "Tokens the model generated",
      key: "output",
      label: "Output",
      tokens: totals.outputTokens,
    },
  ] as const;
  const sum = kinds.reduce((total, kind) => total + kind.tokens, 0);
  const promptTokens = totals.inputTokens + totals.cacheCreationTokens + totals.cacheReadTokens;

  return {
    cacheHitRate: promptTokens === 0 ? null : percentOf(totals.cacheReadTokens, promptTokens),
    rows: kinds.map((kind) => ({ ...kind, share: percentOf(kind.tokens, sum) })),
  };
}

/**
 * Rows ranked by `metric`, highest first. The API already orders by spend;
 * the sort is stable, so agents tied on tokens keep their spend order.
 */
function rankAgentRows(rows: readonly AgentRow[], metric: AgentMetric): AgentRow[] {
  return metric === "spend"
    ? [...rows]
    : [...rows].sort((left, right) => right.totalTokens - left.totalTokens);
}

/** A share for display; a real but sub-0.1% share reads "<0.1%", never "0.0%". */
function formatShare(share: number): string {
  return share > 0 && share < 0.05 ? "<0.1%" : formatPercent(share);
}

export { agentRows, formatShare, rankAgentRows, tokenMix };

export type { AgentMetric, AgentRow, ProfileInsights, TokenMix, TokenMixRow };
