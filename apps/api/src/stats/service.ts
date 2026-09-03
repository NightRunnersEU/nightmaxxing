import { Context } from "effect";
import { Effect } from "effect";

import type { StatsResponse } from "@nightmaxxing/api-contract";

import type { DatabaseError } from "../database";

const STATS_RANK_LIMIT = 10;
const THIRTY_DAYS = 30;
const STATS_2026_START = "2026-01-01";

type StatsSnapshot = Omit<
  typeof StatsResponse.Type,
  "generatedAt" | "last30dSince" | "year2026Since"
>;

interface StatsServiceShape {
  getStats(): Effect.Effect<typeof StatsResponse.Type, never, any>;
}

interface StatsRepositoryShape {
  snapshot(input: {
    last30dSince: string;
    limit: number;
  }): Effect.Effect<StatsSnapshot, DatabaseError, any>;
}

class StatsService extends Context.Service<StatsService, StatsServiceShape>()(
  "@nightmaxxing/api/StatsService",
) {}

class StatsRepository extends Context.Service<StatsRepository, StatsRepositoryShape>()(
  "@nightmaxxing/api/StatsRepository",
) {}

const makeStatsService = Effect.fn("makeStatsService")(function* (
  options: { now?: () => Date } = {},
) {
  const repository = yield* StatsRepository;
  const now = options.now ?? (() => new Date());

  return StatsService.of({
    getStats: Effect.fn("StatsService.getStats")(function* () {
      const generatedAt = now();
      const last30dSince = statsWindowStart(generatedAt);
      const snapshot = yield* repository
        .snapshot({ last30dSince, limit: STATS_RANK_LIMIT })
        .pipe(Effect.orDie);

      return {
        ...snapshot,
        generatedAt: generatedAt.toISOString(),
        last30dSince,
        year2026Since: STATS_2026_START,
      };
    }),
  });
});

function statsWindowStart(now: Date): string {
  const start = new Date(now.getTime() - (THIRTY_DAYS - 1) * 24 * 60 * 60 * 1000);
  return start.toISOString().slice(0, 10);
}

export {
  makeStatsService,
  STATS_2026_START,
  STATS_RANK_LIMIT,
  StatsRepository,
  StatsService,
  statsWindowStart,
};

export type { StatsRepositoryShape, StatsSnapshot };
