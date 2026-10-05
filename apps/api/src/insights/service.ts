import { Context, Effect, Option } from "effect";

import { BadRequest, MIN_USAGE_DATE_KEY, UserNotFound } from "@nightmaxxing/api-contract";
import type { ProfileInsightsResponse, UserId } from "@nightmaxxing/api-contract";

import type { DatabaseError } from "../database";
import { latestUsageDateKey, utcDayKey } from "../date-keys";
import { ProfilesRepository } from "../profiles/service";

/**
 * Profile insights over a date range (Nightmaxxing-only): per-agent totals,
 * the token mix, the top model, the peak day, the longest streak and the
 * user's spend rank. The profile page asks for all time; the monthly recap
 * asks for one calendar month. Hidden profiles follow the profile rules: a
 * shadow-banned user is not found, except by themselves.
 */

interface InsightsQuery {
  since?: string | undefined;
  until?: string | undefined;
}

interface InsightsBounds {
  since: string;
  until: string;
}

type RangeInsights = Omit<ProfileInsightsResponse, "range" | "spendRank">;

interface InsightsServiceShape {
  getProfileInsights(
    login: string,
    query: InsightsQuery,
    viewerUserId: UserId | null,
  ): Effect.Effect<ProfileInsightsResponse, BadRequest | UserNotFound>;
}

interface InsightsRepositoryShape {
  /** Aggregates over `[since, until]`; `today` anchors the streak helper. */
  insights(
    userId: string,
    window: InsightsBounds & { today: string },
  ): Effect.Effect<RangeInsights, DatabaseError>;
  spendRank(
    input: InsightsBounds & { userId: string },
  ): Effect.Effect<number | null, DatabaseError>;
}

class InsightsService extends Context.Service<InsightsService, InsightsServiceShape>()(
  "@nightmaxxing/api/InsightsService",
) {}

class InsightsRepository extends Context.Service<InsightsRepository, InsightsRepositoryShape>()(
  "@nightmaxxing/api/InsightsRepository",
) {}

const makeInsightsService = Effect.fn("makeInsightsService")(function* () {
  const repository = yield* InsightsRepository;
  const profiles = yield* ProfilesRepository;

  return InsightsService.of({
    getProfileInsights: Effect.fn("InsightsService.getProfileInsights")(
      function* (login, query, viewerUserId) {
        const found = yield* profiles.findUserByLogin(login).pipe(Effect.orDie);
        if (
          Option.isNone(found) ||
          (found.value.shadowBanned && found.value.user.id !== viewerUserId)
        ) {
          return yield* Effect.fail(new UserNotFound({ login }));
        }

        const userId = found.value.user.id;
        const now = new Date();
        const bounds = yield* insightsBounds(query, now);
        const [insights, spendRank] = yield* Effect.all(
          [
            repository.insights(userId, { ...bounds, today: utcDayKey(now) }),
            repository.spendRank({ ...bounds, userId }),
          ],
          { concurrency: "unbounded" },
        ).pipe(Effect.orDie);

        return {
          ...insights,
          range: { firstDate: bounds.since, lastDate: bounds.until },
          spendRank,
        };
      },
    ),
  });
});

/**
 * Inclusive bounds for an insights read. `until` is capped at the ingest
 * ceiling (rows past it are never real usage) and `since` defaults to, and
 * is floored at, the earliest accepted usage day. A `since` after the capped
 * `until` is an inverted range, not an empty one.
 */
function insightsBounds(
  query: InsightsQuery,
  now: Date,
): Effect.Effect<InsightsBounds, BadRequest> {
  const ceiling = latestUsageDateKey(now);
  const until = query.until === undefined || query.until > ceiling ? ceiling : query.until;
  const requested = query.since ?? MIN_USAGE_DATE_KEY;
  const since = requested < MIN_USAGE_DATE_KEY ? MIN_USAGE_DATE_KEY : requested;
  if (since > until) {
    return Effect.fail(
      new BadRequest({
        message: `Invalid date range: \`since\` (${since}) is after \`until\` (${until}).`,
      }),
    );
  }

  return Effect.succeed({ since, until });
}

export { insightsBounds, InsightsRepository, InsightsService, makeInsightsService };

export type { InsightsRepositoryShape, InsightsServiceShape, RangeInsights };
