import { usageDays, users } from "@nightmaxxing/db";
import { and, asc, desc, eq, gte, isNull, sql, type SQL } from "drizzle-orm";
import { Effect } from "effect";
import { Layer } from "effect";

import type { StatsTotals } from "@nightmaxxing/api-contract";

import { Drizzle } from "../database";
import { STATS_2026_START, StatsRepository } from "./service";

type StatsTotalsValue = typeof StatsTotals.Type;

const makeD1StatsRepository = Effect.fn("makeD1StatsRepository")(function* () {
  const database = yield* Drizzle;

  const totals = (since: string | null): Effect.Effect<StatsTotalsValue, any, any> =>
    Effect.gen(function* () {
      const rows = yield* database.use((db) => {
        const base = db
          .select({
            activeDates: sql<number>`count(distinct ${usageDays.date})`,
            cacheCreationTokens: sql<number>`coalesce(sum(${usageDays.cacheCreationTokens}), 0)`,
            cacheReadTokens: sql<number>`coalesce(sum(${usageDays.cacheReadTokens}), 0)`,
            deviceCount: sql<number>`count(distinct ${usageDays.deviceId})`,
            firstDate: sql<string | null>`min(${usageDays.date})`,
            inputTokens: sql<number>`coalesce(sum(${usageDays.inputTokens}), 0)`,
            lastDate: sql<string | null>`max(${usageDays.date})`,
            outputTokens: sql<number>`coalesce(sum(${usageDays.outputTokens}), 0)`,
            rowCount: sql<number>`count(*)`,
            totalSpendUsd: sql<number>`coalesce(sum(${usageDays.costUsd}), 0)`,
            totalTokens: sql<number>`coalesce(sum(${usageDays.totalTokens}), 0)`,
            userCount: sql<number>`count(distinct ${usageDays.userId})`,
          })
          .from(usageDays)
          .innerJoin(users, eq(usageDays.userId, users.id));

        return since === null
          ? base.where(isNull(users.shadowBannedAt))
          : base.where(and(isNull(users.shadowBannedAt), gte(usageDays.date, since)));
      });

      return (
        rows[0] ?? {
          activeDates: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          deviceCount: 0,
          firstDate: null,
          inputTokens: 0,
          lastDate: null,
          outputTokens: 0,
          rowCount: 0,
          totalSpendUsd: 0,
          totalTokens: 0,
          userCount: 0,
        }
      );
    });

  return StatsRepository.of({
    snapshot: ({ last30dSince, limit }) =>
      Effect.gen(function* () {
        const [
          allTime,
          last30d,
          year2026,
          daily,
          allTimeModelsBySpend,
          allTimeModelsByTokens,
          last30dModelsBySpend,
          last30dModelsByTokens,
          year2026ModelsBySpend,
          year2026ModelsByTokens,
          allTimeSources,
          last30dSources,
          year2026Sources,
          topUsersBySpend,
          topUsersByTokens,
          peakSpendDays,
          peakTokenDays,
          dailyByModel,
        ] = yield* Effect.all(
          [
            totals(null),
            totals(last30dSince),
            totals(STATS_2026_START),
            dailyTotals(),
            rankedBy(usageDays.model, null, "spend", limit),
            rankedBy(usageDays.model, null, "tokens", limit),
            rankedBy(usageDays.model, last30dSince, "spend", limit),
            rankedBy(usageDays.model, last30dSince, "tokens", limit),
            rankedBy(usageDays.model, STATS_2026_START, "spend", limit),
            rankedBy(usageDays.model, STATS_2026_START, "tokens", limit),
            rankedBy(usageDays.source, null, "tokens", limit),
            rankedBy(usageDays.source, last30dSince, "tokens", limit),
            rankedBy(usageDays.source, STATS_2026_START, "tokens", limit),
            usersBy("spend", limit),
            usersBy("tokens", limit),
            peakDays("spend"),
            peakDays("tokens"),
            dailyModels(),
          ],
          { concurrency: "unbounded" },
        );

        return {
          allTime,
          daily,
          dailyByModel,
          last30d,
          peaks: {
            spend: peakSpendDays[0] ?? null,
            tokens: peakTokenDays[0] ?? null,
          },
          sources: {
            allTime: allTimeSources,
            last30d: last30dSources,
            year2026: year2026Sources,
          },
          topModels: {
            allTimeBySpend: allTimeModelsBySpend,
            allTimeByTokens: allTimeModelsByTokens,
            last30dBySpend: last30dModelsBySpend,
            last30dByTokens: last30dModelsByTokens,
            year2026BySpend: year2026ModelsBySpend,
            year2026ByTokens: year2026ModelsByTokens,
          },
          topUsers: {
            bySpend: topUsersBySpend,
            byTokens: topUsersByTokens,
          },
          year2026,
        };
      }),
  });

  function dailyTotals() {
    return database.use((db) =>
      db
        .select({
          date: usageDays.date,
          spendUsd: sql<number>`coalesce(sum(${usageDays.costUsd}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${usageDays.totalTokens}), 0)`,
          userCount: sql<number>`count(distinct ${usageDays.userId})`,
        })
        .from(usageDays)
        .innerJoin(users, eq(usageDays.userId, users.id))
        .where(isNull(users.shadowBannedAt))
        .groupBy(usageDays.date)
        .orderBy(asc(usageDays.date)),
    );
  }

  function dailyModels() {
    return database.use((db) =>
      db
        .select({
          costUsd: sql<number>`coalesce(sum(${usageDays.costUsd}), 0)`,
          date: usageDays.date,
          key: usageDays.model,
          outputTokens: sql<number>`coalesce(sum(${usageDays.outputTokens}), 0)`,
          rowCount: sql<number>`count(*)`,
          totalTokens: sql<number>`coalesce(sum(${usageDays.totalTokens}), 0)`,
        })
        .from(usageDays)
        .innerJoin(users, eq(usageDays.userId, users.id))
        .where(isNull(users.shadowBannedAt))
        .groupBy(usageDays.date, usageDays.model)
        .orderBy(asc(usageDays.date), asc(usageDays.model)),
    );
  }

  function rankedBy(
    keyColumn: typeof usageDays.model | typeof usageDays.source,
    since: string | null,
    orderBy: "spend" | "tokens",
    limit: number,
  ) {
    const conditions: SQL[] = [isNull(users.shadowBannedAt)];
    if (since !== null) {
      conditions.push(gte(usageDays.date, since));
    }

    const spendUsd = sql<number>`coalesce(sum(${usageDays.costUsd}), 0)`.as("spend_usd");
    const totalTokens = sql<number>`coalesce(sum(${usageDays.totalTokens}), 0)`.as(
      "total_tokens_sum",
    );

    return database.use((db) => {
      const base = db
        .select({
          key: sql<string>`${keyColumn}`.as("rank_key"),
          rowCount: sql<number>`count(*)`,
          spendUsd,
          totalTokens,
          userCount: sql<number>`count(distinct ${usageDays.userId})`,
        })
        .from(usageDays)
        .innerJoin(users, eq(usageDays.userId, users.id));

      return base
        .where(and(...conditions))
        .groupBy(sql`rank_key`)
        .orderBy(orderBy === "spend" ? desc(spendUsd) : desc(totalTokens))
        .limit(limit);
    });
  }

  function usersBy(orderBy: "spend" | "tokens", limit: number) {
    const spendUsd = sql<number>`coalesce(sum(${usageDays.costUsd}), 0)`.as("spend_usd");
    const totalTokens = sql<number>`coalesce(sum(${usageDays.totalTokens}), 0)`.as(
      "total_tokens_sum",
    );

    return database
      .use((db) =>
        db
          .select({
            activeDays: sql<number>`count(distinct ${usageDays.date})`,
            lastDate: sql<string | null>`max(${usageDays.date})`,
            spendUsd,
            totalTokens,
            user: users,
          })
          .from(usageDays)
          .innerJoin(users, eq(usageDays.userId, users.id))
          .where(isNull(users.shadowBannedAt))
          .groupBy(usageDays.userId)
          .orderBy(orderBy === "spend" ? desc(spendUsd) : desc(totalTokens))
          .limit(limit),
      )
      .pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            activeDays: row.activeDays,
            lastDate: row.lastDate,
            spendUsd: row.spendUsd,
            totalTokens: row.totalTokens,
            user: {
              avatarUrl: row.user.avatarUrl,
              id: row.user.id,
              login: row.user.login,
              name: row.user.name,
            },
          })),
        ),
      );
  }

  function peakDays(orderBy: "spend" | "tokens") {
    const spendUsd = sql<number>`coalesce(sum(${usageDays.costUsd}), 0)`.as("spend_usd");
    const totalTokens = sql<number>`coalesce(sum(${usageDays.totalTokens}), 0)`.as(
      "total_tokens_sum",
    );

    return database.use((db) =>
      db
        .select({
          date: usageDays.date,
          spendUsd,
          totalTokens,
          userCount: sql<number>`count(distinct ${usageDays.userId})`,
        })
        .from(usageDays)
        .innerJoin(users, eq(usageDays.userId, users.id))
        .where(isNull(users.shadowBannedAt))
        .groupBy(usageDays.date)
        .orderBy(orderBy === "spend" ? desc(spendUsd) : desc(totalTokens))
        .limit(1),
    );
  }
});

const StatsRepositoryLive = Layer.effect(StatsRepository, makeD1StatsRepository());

export { StatsRepositoryLive };
