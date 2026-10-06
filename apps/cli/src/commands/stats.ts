import { Data, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import type {
  AuthUser,
  ProfileInsightsResponse,
  ProfileResponse,
} from "@nightmaxxing/api-contract";

import { apiFailureMessage, ME_RETRY_POLICY, withApiRetry } from "../api-failure";
import { isUnauthorizedError } from "../auth-validation";
import { booleanFlag } from "../flags";
import { formatUrl, humanFrame, humanLog, humanSpinner, writeJson } from "../output";
import { ApiClientService, ConfigService } from "../services";
import { NotLoggedInError } from "./whoami";

/**
 * `nightmaxxing stats`: the signed-in user's public numbers in the terminal —
 * lifetime totals, streaks and rank from their profile, plus this month's
 * figures from the profile insights. "This month" is the local calendar
 * month, matching how ccusage buckets usage days.
 */

type ProfileStats = (typeof ProfileResponse.Type)["stats"];
type ProfileInsights = typeof ProfileInsightsResponse.Type;

interface StatsOptions {
  json: boolean;
  /** Clock for "this month"; tests pin it. */
  now?: (() => Date) | undefined;
}

interface StatsReport {
  insights: ProfileInsights;
  month: string;
  profileUrl: string;
  recapUrl: string;
  stats: ProfileStats;
  user: AuthUser;
}

class StatsError extends Data.TaggedError("StatsError")<{
  readonly cause: unknown;
}> {
  override get message() {
    return apiFailureMessage(
      "failed to fetch your stats",
      this.cause,
      "check your network and try again",
    );
  }
}

const statsCommand = Command.make(
  "stats",
  {
    json: booleanFlag("json").pipe(Flag.withDescription("Output machine-readable JSON")),
  },
  ({ json }) => statsEffect({ json }),
).pipe(Command.withDescription("Show your totals, streak, rank and this month's usage"));

function statsEffect(options: StatsOptions) {
  return humanFrame(
    "Stats",
    options,
    Effect.gen(function* () {
      const config = yield* Effect.service(ConfigService);
      const clients = yield* Effect.service(ApiClientService);

      const stored = yield* config.readConfig();
      if (stored.token === undefined) {
        return yield* Effect.fail(new NotLoggedInError());
      }

      const client = yield* clients.make({ baseUrl: stored.apiUrl, token: stored.token });
      const now = (options.now ?? (() => new Date()))();
      const month = localMonthKey(now);
      const spinner = yield* humanSpinner("Fetching stats", options);

      const report = yield* Effect.gen(function* () {
        const me = yield* withApiRetry(() => client.me.me(), ME_RETRY_POLICY).pipe(
          Effect.mapError(({ cause }) =>
            isUnauthorizedError(cause) ? new NotLoggedInError() : new StatsError({ cause }),
          ),
        );
        const login = me.user.login;
        // Public reads: the same quick, single retry as /me.
        const [profile, insights] = yield* Effect.all(
          [
            withApiRetry(() => client.profiles.get({ params: { login } }), ME_RETRY_POLICY),
            withApiRetry(
              () =>
                client.insights.profile({
                  params: { login },
                  query: { since: `${month}-01`, until: localDayKey(now) },
                }),
              ME_RETRY_POLICY,
            ),
          ],
          { concurrency: "unbounded" },
        ).pipe(Effect.mapError(({ cause }) => new StatsError({ cause })));
        const profilePath = `${stored.wwwUrl.replace(/\/$/, "")}/${encodeURIComponent(login)}`;

        return {
          insights,
          month,
          profileUrl: profilePath,
          recapUrl: `${profilePath}/recap/${month}`,
          stats: profile.stats,
          user: me.user,
        } satisfies StatsReport;
      }).pipe(Effect.tapError(() => Effect.sync(() => spinner.error("Could not fetch stats"))));

      if (options.json) {
        yield* writeJson(report);
        return;
      }

      yield* Effect.sync(() => spinner.stop(`Stats for ${report.user.login}`));
      for (const line of statsLines(report)) {
        yield* humanLog("info", line, options);
      }
      yield* humanLog("info", `Profile: ${formatUrl(report.profileUrl)}`, options);
      if (report.insights.totals.activeDays > 0) {
        yield* humanLog("info", `Recap: ${formatUrl(report.recapUrl)}`, options);
      }
    }),
  );
}

/** The human summary, one line per fact. */
function statsLines({ insights, month, stats }: StatsReport): string[] {
  if (stats.activeDays === 0) {
    return ["No usage synced yet; run nightmaxxing sync to fill your profile"];
  }

  const lines = [
    `All time: ${formatUsd(stats.spendUsd)} · ${formatTokens(stats.totalTokens)} tokens · ${countOf(stats.activeDays, "active day")}`,
    `Streak: ${countOf(stats.currentStreakDays, "day")} now, ${countOf(stats.longestStreakDays, "day")} longest`,
    stats.leaderboardRank === null
      ? "Rank: unranked over the last 30 days"
      : `Rank: #${integer.format(stats.leaderboardRank)} by spend over the last 30 days`,
  ];
  if (stats.topModel !== null) {
    lines.push(`Top model: ${stats.topModel.model} (${formatUsd(stats.topModel.spendUsd)})`);
  }

  const { totals } = insights;
  if (totals.activeDays === 0) {
    lines.push(`${monthLabel(month)}: no usage yet`);
    return lines;
  }

  const rank =
    insights.spendRank === null ? "" : ` · #${integer.format(insights.spendRank)} by spend`;
  lines.push(
    `${monthLabel(month)}: ${formatUsd(totals.spendUsd)} · ${formatTokens(totals.totalTokens)} tokens · ${countOf(totals.activeDays, "active day")}${rank}`,
  );
  const topAgent = insights.agents[0];
  if (topAgent !== undefined && totals.spendUsd > 0) {
    lines.push(
      `Top agent this month: ${topAgent.source} (${percent(topAgent.spendUsd / totals.spendUsd)} of spend)`,
    );
  }
  const promptTokens = totals.inputTokens + totals.cacheCreationTokens + totals.cacheReadTokens;
  if (promptTokens > 0) {
    lines.push(`Cache hit rate this month: ${percent(totals.cacheReadTokens / promptTokens)}`);
  }

  return lines;
}

/** YYYY-MM-DD in the machine's local time, like ccusage's day buckets. */
function localDayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function localMonthKey(now: Date): string {
  return localDayKey(now).slice(0, 7);
}

const usd0 = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});

const usd2 = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const monthName = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const usdCompact = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  notation: "compact",
  style: "currency",
});

/** Fabricated values past this print as a fixed cap (the website's rule). */
const DISPLAY_CEILING = 1e15;

/** The website's formatUsd: whole dollars from $100, "$1.2M" from $1M, capped at ">$999T". */
function formatUsd(value: number): string {
  if (Number.isNaN(value)) {
    return "—";
  }
  const magnitude = Math.abs(value);
  if (magnitude >= DISPLAY_CEILING) {
    return value < 0 ? "<-$999T" : ">$999T";
  }
  if (magnitude >= 1e6) {
    return usdCompact.format(value);
  }

  return magnitude >= 100 ? usd0.format(value) : usd2.format(value);
}

/** The website's formatTokens, so both read alike. */
function formatTokens(value: number): string {
  if (Number.isNaN(value)) {
    return "—";
  }
  const magnitude = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (magnitude >= DISPLAY_CEILING) {
    return value < 0 ? "<-999T" : ">999T";
  }
  if (magnitude >= 1e12) {
    return `${sign}${(magnitude / 1e12).toFixed(2)}T`;
  }
  if (magnitude >= 1e9) {
    return `${sign}${(magnitude / 1e9).toFixed(2)}B`;
  }
  if (magnitude >= 1e6) {
    return `${sign}${(magnitude / 1e6).toFixed(1)}M`;
  }
  if (magnitude >= 1e3) {
    return `${sign}${(magnitude / 1e3).toFixed(1)}K`;
  }

  return value.toFixed(0);
}

function countOf(value: number, singular: string): string {
  return `${integer.format(value)} ${value === 1 ? singular : `${singular}s`}`;
}

/** A 0–1 ratio as a percentage; a real but tiny share reads "<0.1%". */
function percent(ratio: number): string {
  const value = ratio * 100;
  return value > 0 && value < 0.05 ? "<0.1%" : `${value.toFixed(1)}%`;
}

/** "October 2026" for a YYYY-MM key, read as a calendar label (no timezone shift). */
function monthLabel(month: string): string {
  return monthName.format(new Date(`${month}-01T00:00:00Z`));
}

export { formatTokens, formatUsd, localDayKey, statsCommand, statsEffect, statsLines };

export type { StatsOptions, StatsReport };
