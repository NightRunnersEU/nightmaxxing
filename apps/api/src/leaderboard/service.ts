import { Context } from "effect";
import { Effect } from "effect";

import type {
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardWindow,
} from "@nightmaxxing/api-contract";

import type { DatabaseError } from "../database";

/**
 * Public rankings. Windows are computed as UTC date strings and compared
 * lexicographically against the opaque YYYY-MM-DD day keys — a user's
 * "today" can wobble ±1 day at window edges (local-time buckets); accepted.
 */

const LEADERBOARD_LIMIT = 100;

interface LeaderboardServiceShape {
  list(
    metric: typeof LeaderboardMetric.Type,
    window: typeof LeaderboardWindow.Type,
  ): Effect.Effect<(typeof LeaderboardEntry.Type)[], never, any>;
}

interface LeaderboardRepositoryShape {
  list(input: {
    limit: number;
    metric: typeof LeaderboardMetric.Type;
    /** Inclusive YYYY-MM-DD lower bound; null = all time. */
    since: string | null;
  }): Effect.Effect<(typeof LeaderboardEntry.Type)[], DatabaseError, any>;
}

class LeaderboardService extends Context.Service<LeaderboardService, LeaderboardServiceShape>()(
  "@nightmaxxing/api/LeaderboardService",
) {}

class LeaderboardRepository extends Context.Service<
  LeaderboardRepository,
  LeaderboardRepositoryShape
>()("@nightmaxxing/api/LeaderboardRepository") {}

/** Inclusive lower bound covering the trailing `days` calendar days (UTC). */
function windowStart(window: typeof LeaderboardWindow.Type, now: Date): string | null {
  if (window === "all") {
    return null;
  }

  const days = window === "30d" ? 30 : 7;
  const start = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  return start.toISOString().slice(0, 10);
}

const makeLeaderboardService = Effect.fn("makeLeaderboardService")(function* () {
  const repository = yield* LeaderboardRepository;

  return LeaderboardService.of({
    list: Effect.fn("LeaderboardService.list")(function* (metric, window) {
      return yield* repository
        .list({
          limit: LEADERBOARD_LIMIT,
          metric,
          since: windowStart(window, new Date()),
        })
        .pipe(Effect.orDie);
    }),
  });
});

export { LeaderboardRepository, LeaderboardService, makeLeaderboardService, windowStart };

export type { LeaderboardRepositoryShape };
