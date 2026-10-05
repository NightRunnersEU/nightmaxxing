import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { DateKey } from "./date-key";
import { BadRequest, RouteNotFound, UserNotFound } from "./errors";

/**
 * Nightmaxxing-only profile insights: what one user's usage looks like over a
 * date range, beyond the lifetime header stats upstream's ProfileStats
 * carries. The profile page reads it all-time; the monthly recap reads one
 * calendar month. Kept in its own group so upstream syncs never touch it.
 */

/** Token totals by kind; `totalTokens` is ccusage's total, not a re-sum. */
const ProfileInsightsTotals = Schema.Struct({
  activeDays: Schema.Number,
  cacheCreationTokens: Schema.Number,
  cacheReadTokens: Schema.Number,
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  spendUsd: Schema.Number,
  totalTokens: Schema.Number,
});

type ProfileInsightsTotals = typeof ProfileInsightsTotals.Type;

/** One agent (`source` tag, e.g. "claude") over the range. */
const ProfileAgentInsight = Schema.Struct({
  activeDays: Schema.Number,
  source: Schema.String,
  spendUsd: Schema.Number,
  totalTokens: Schema.Number,
});

type ProfileAgentInsight = typeof ProfileAgentInsight.Type;

const ProfileInsightsResponse = Schema.Struct({
  /** Every agent with usage in the range, highest spend first. */
  agents: Schema.Array(ProfileAgentInsight),
  /** Longest run of consecutive active days inside the range. */
  longestStreakDays: Schema.Number,
  peakDay: Schema.NullOr(Schema.Struct({ date: Schema.String, spendUsd: Schema.Number })),
  /** Inclusive day keys the insights cover. */
  range: Schema.Struct({ firstDate: Schema.String, lastDate: Schema.String }),
  /** Rank by spend among public users over the same range; null without usage. */
  spendRank: Schema.NullOr(Schema.Number),
  topModel: Schema.NullOr(
    Schema.Struct({ model: Schema.String, spendUsd: Schema.Number, totalTokens: Schema.Number }),
  ),
  totals: ProfileInsightsTotals,
});

type ProfileInsightsResponse = typeof ProfileInsightsResponse.Type;

/** See ProfilesGroup for why `:login` reads declare RouteNotFound. */
class InsightsGroup extends HttpApiGroup.make("insights").add(
  HttpApiEndpoint.get("profile", "/profiles/:login/insights", {
    params: {
      login: Schema.String,
    },
    query: {
      /** Defaults to the earliest accepted usage day (all time). */
      since: Schema.optional(DateKey),
      /** Defaults to (and is capped at) the ingest ceiling. */
      until: Schema.optional(DateKey),
    },
    success: ProfileInsightsResponse,
    // BadRequest: `since` after the (ceiling-capped) `until`.
    error: [UserNotFound, RouteNotFound, BadRequest],
  }),
) {}

export { InsightsGroup, ProfileAgentInsight, ProfileInsightsResponse, ProfileInsightsTotals };
