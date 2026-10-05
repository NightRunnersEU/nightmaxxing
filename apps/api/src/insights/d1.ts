import { usageDays } from "@nightmaxxing/db";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { Drizzle } from "../database";
import { ProfilesRepositoryLive } from "../profiles/d1";
import { usageStreaks } from "../profiles/streaks";
import { singleAggregateRow, usageAggregates } from "../usage/aggregates";
import { userRank } from "../usage/ranking";
import { InsightsRepository, InsightsService, makeInsightsService } from "./service";

const makeD1InsightsRepository = Effect.fn("makeD1InsightsRepository")(function* () {
  const database = yield* Drizzle;

  return InsightsRepository.of({
    insights: (userId, { since, today, until }) =>
      Effect.gen(function* () {
        const inRange = and(
          eq(usageDays.userId, userId),
          gte(usageDays.date, since),
          lte(usageDays.date, until),
        );
        // One D1 round trip. Batched rows come back keyed by column name, so
        // every aggregate is aliased to a name unique within its statement.
        const [totalRows, agentRows, modelRows, dayRows] = yield* database.use((db) =>
          db.batch([
            db
              .select({
                activeDays: usageAggregates.activeDays().as("active_days"),
                cacheCreationTokens: usageAggregates.cacheCreationTokens().as("cache_creation"),
                cacheReadTokens: usageAggregates.cacheReadTokens().as("cache_read"),
                inputTokens: usageAggregates.inputTokens().as("input"),
                outputTokens: usageAggregates.outputTokens().as("output"),
                spendUsd: usageAggregates.spendUsd().as("spend"),
                totalTokens: usageAggregates.totalTokens().as("tokens"),
              })
              .from(usageDays)
              .where(inRange),
            db
              .select({
                activeDays: usageAggregates.activeDays().as("agent_days"),
                source: usageDays.source,
                spendUsd: usageAggregates.spendUsd().as("agent_spend"),
                totalTokens: usageAggregates.totalTokens().as("agent_tokens"),
              })
              .from(usageDays)
              .where(inRange)
              .groupBy(usageDays.source)
              .orderBy(desc(sql`agent_spend`), asc(usageDays.source)),
            db
              .select({
                model: usageDays.model,
                spendUsd: usageAggregates.spendUsd().as("model_spend"),
                totalTokens: usageAggregates.totalTokens().as("model_tokens"),
              })
              .from(usageDays)
              .where(inRange)
              .groupBy(usageDays.model)
              .orderBy(desc(sql`model_spend`), asc(usageDays.model))
              .limit(1),
            db
              .select({
                date: usageDays.date,
                spendUsd: usageAggregates.spendUsd().as("day_spend"),
              })
              .from(usageDays)
              .where(inRange)
              .groupBy(usageDays.date)
              .orderBy(asc(usageDays.date)),
          ]),
        );

        const totals = yield* singleAggregateRow(totalRows);
        const { longestStreakDays } = usageStreaks(
          dayRows.map((row) => row.date),
          today,
        );

        return {
          agents: agentRows,
          longestStreakDays,
          peakDay: peakSpendDay(dayRows),
          topModel: modelRows[0] ?? null,
          totals,
        };
      }),
    spendRank: ({ since, until, userId }) =>
      Effect.gen(function* () {
        const rows = yield* database.use((db) =>
          userRank(db, { metric: "spend", since, until, userId }),
        );

        return rows[0]?.rank ?? null;
      }),
  });
});

/** The highest-spend day; the earliest one wins a tie. */
function peakSpendDay(days: readonly { date: string; spendUsd: number }[]) {
  let peak: { date: string; spendUsd: number } | null = null;
  for (const day of days) {
    if (peak === null || day.spendUsd > peak.spendUsd) {
      peak = day;
    }
  }

  return peak;
}

const InsightsRepositoryLive = Layer.effect(InsightsRepository, makeD1InsightsRepository());

const InsightsServiceLive = Layer.effect(InsightsService, makeInsightsService()).pipe(
  Layer.provide(Layer.mergeAll(InsightsRepositoryLive, ProfilesRepositoryLive)),
);

export { InsightsRepositoryLive, InsightsServiceLive, peakSpendDay };
