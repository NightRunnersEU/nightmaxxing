import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { StatCard } from "../../../components/stat-card";
import { SegmentedControl, type SegmentedOption } from "../../../components/ui/segmented-control";
import { formatInteger, formatPercent, formatTokens, formatUsd } from "../../../lib/format";
import { profileInsightsQueryOptions } from "../../../lib/queries";
import {
  agentRows,
  formatShare,
  rankAgentRows,
  tokenMix,
  type AgentMetric,
  type ProfileInsights,
} from "../-lib/insights-view";

/**
 * Nightmaxxing's all-time profile insights: spend and tokens by agent, and
 * the token mix with the cache hit rate. Fetched on the client after the
 * dashboard renders, so the profile loader (shared with upstream) stays as
 * is; the sections hold their height while loading and disappear on error.
 */

function ProfileInsightsSections({ login }: { login: string }) {
  const { data, status } = useQuery(profileInsightsQueryOptions(login));

  if (status === "error") {
    return null;
  }
  if (status === "pending") {
    return (
      <>
        <PendingSection title="Agents" />
        <PendingSection title="Token mix" />
      </>
    );
  }

  return (
    <>
      <AgentSection insights={data} />
      <TokenMixSection insights={data} />
    </>
  );
}

function PendingSection({ title }: { title: string }) {
  return (
    <section aria-busy="true" className="bg-background p-5">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-4 h-40 animate-pulse bg-muted" />
    </section>
  );
}

const AGENT_METRIC_OPTIONS = [
  { label: "Spend", value: "spend" },
  { label: "Tokens", value: "tokens" },
] as const satisfies readonly SegmentedOption<AgentMetric>[];

function AgentSection({ insights }: { insights: ProfileInsights }) {
  const [metric, setMetric] = useState<AgentMetric>("spend");
  const rows = rankAgentRows(agentRows(insights), metric);
  const bySpend = metric === "spend";

  return (
    <section className="bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All-time {bySpend ? "spend" : "tokens"} by coding agent.
          </p>
        </div>
        <SegmentedControl
          label="Measure agents by"
          onChange={setMetric}
          options={AGENT_METRIC_OPTIONS}
          value={metric}
        />
      </div>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {rows.map((row) => {
          const share = bySpend ? row.spendShare : row.tokenShare;
          const unit = bySpend ? "spend" : "tokens";

          return (
            <li
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3"
              key={row.source}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bySpend ? `${formatTokens(row.totalTokens)} tokens` : formatUsd(row.spendUsd)} ·{" "}
                  {formatInteger(row.activeDays)} active {row.activeDays === 1 ? "day" : "days"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {bySpend ? formatUsd(row.spendUsd) : formatTokens(row.totalTokens)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatShare(share)} of {unit}
                </p>
              </div>
              <ShareBar label={`${row.label} share of ${unit}`} share={share} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TokenMixSection({ insights }: { insights: ProfileInsights }) {
  const mix = tokenMix(insights.totals);
  const cacheReads = mix.rows.find((row) => row.key === "cacheRead");

  return (
    <section className="bg-background">
      <div className="p-5 pb-0">
        <h2 className="font-medium">Token mix</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Where all-time tokens went. Cache reads cost a fraction of fresh input.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px border-y border-border bg-border">
        <StatCard
          label="Cache hit rate"
          value={mix.cacheHitRate === null ? "—" : formatPercent(mix.cacheHitRate)}
        />
        <StatCard
          label="Cached tokens"
          value={cacheReads === undefined ? "—" : formatTokens(cacheReads.tokens)}
        />
      </div>
      <ol className="divide-y divide-border px-5 pb-2">
        {mix.rows.map((row) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3"
            key={row.key}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.description}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatTokens(row.tokens)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatShare(row.share)}</p>
            </div>
            <ShareBar label={`${row.label} share of tokens`} share={row.share} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A single-hue part-of-whole bar; the row's text carries the exact value. */
function ShareBar({ label, share }: { label: string; share: number }) {
  const width = Math.min(100, Math.max(0, share));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(width)}
      className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted"
      role="meter"
    >
      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${width}%` }} />
    </div>
  );
}

export { ProfileInsightsSections };
