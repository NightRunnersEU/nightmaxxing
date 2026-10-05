import { useQuery } from "@tanstack/react-query";

import { StatCard } from "../../../components/stat-card";
import { formatInteger, formatPercent, formatTokens, formatUsd } from "../../../lib/format";
import { profileInsightsQueryOptions } from "../../../lib/queries";
import { agentRows, formatShare, tokenMix, type ProfileInsights } from "../-lib/insights-view";

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

function AgentSection({ insights }: { insights: ProfileInsights }) {
  const rows = agentRows(insights);

  return (
    <section className="bg-background p-5">
      <h2 className="font-medium">Agents</h2>
      <p className="mt-1 text-sm text-muted-foreground">All-time spend by coding agent.</p>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {rows.map((row) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3"
            key={row.source}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTokens(row.totalTokens)} tokens · {formatInteger(row.activeDays)} active{" "}
                {row.activeDays === 1 ? "day" : "days"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatUsd(row.spendUsd)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatShare(row.spendShare)} of spend
              </p>
            </div>
            <ShareBar label={`${row.label} share of spend`} share={row.spendShare} />
          </li>
        ))}
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
