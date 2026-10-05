import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { buildService } from "../testing/effect";
import { seedUsage, seedUser } from "../testing/seed";
import { makeTestDatabase, type TestDatabase } from "../testing/sqlite-d1";
import { InsightsRepositoryLive, peakSpendDay } from "./d1";
import { InsightsRepository } from "./service";

const today = "2026-07-07";

describe("D1 insights repository", () => {
  let database: TestDatabase;

  beforeEach(() => {
    database = makeTestDatabase();
    seedUser(database.sqlite, { id: "user" });
    seedUser(database.sqlite, { id: "rival" });
    seedUser(database.sqlite, { id: "banned", shadowBannedAt: 1 });
  });

  afterEach(() => database.close());

  function makeRepository() {
    return buildService(
      InsightsRepository,
      InsightsRepositoryLive.pipe(Layer.provide(database.drizzleLayer)),
    );
  }

  function usage(
    date: string,
    source: string,
    model: string,
    costUsd: number,
    tokens: { cacheRead?: number; input?: number; output?: number; total?: number } = {},
    userId = "user",
  ) {
    seedUsage(database.sqlite, {
      cacheReadTokens: tokens.cacheRead ?? 0,
      costUsd,
      date,
      deviceId: `${userId}-laptop`,
      inputTokens: tokens.input ?? 0,
      model,
      outputTokens: tokens.output ?? 0,
      source,
      totalTokens: tokens.total ?? 10,
      userId,
    });
  }

  it("returns empty insights for a range without usage", async () => {
    const repository = await makeRepository();

    expect(
      await Effect.runPromise(
        repository.insights("user", { since: "2026-01-01", today, until: "2026-07-08" }),
      ),
    ).toEqual({
      agents: [],
      longestStreakDays: 0,
      peakDay: null,
      topModel: null,
      totals: {
        activeDays: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        spendUsd: 0,
        totalTokens: 0,
      },
    });
  });

  it("aggregates agents, the token mix, the top model, peak day and streak", async () => {
    usage("2026-07-01", "codex", "gpt-5", 1, { cacheRead: 80, input: 15, output: 5, total: 100 });
    usage("2026-07-02", "codex", "gpt-5", 2, { cacheRead: 40, input: 5, output: 5, total: 50 });
    usage("2026-07-02", "claude", "opus", 6, { cacheRead: 10, input: 5, output: 5, total: 20 });
    usage("2026-07-05", "claude", "opus", 1, { total: 10 });
    usage("2026-07-03", "codex", "gpt-5", 500, { total: 1_000 }, "rival");
    const repository = await makeRepository();

    const insights = await Effect.runPromise(
      repository.insights("user", { since: "2026-01-01", today, until: "2026-07-08" }),
    );

    expect(insights).toEqual({
      agents: [
        { activeDays: 2, source: "claude", spendUsd: 7, totalTokens: 30 },
        { activeDays: 2, source: "codex", spendUsd: 3, totalTokens: 150 },
      ],
      longestStreakDays: 2,
      peakDay: { date: "2026-07-02", spendUsd: 8 },
      topModel: { model: "opus", spendUsd: 7, totalTokens: 30 },
      totals: {
        activeDays: 3,
        cacheCreationTokens: 0,
        cacheReadTokens: 130,
        inputTokens: 25,
        outputTokens: 15,
        spendUsd: 10,
        totalTokens: 180,
      },
    });
  });

  it("only counts days inside the range", async () => {
    usage("2026-06-30", "codex", "gpt-5", 100);
    usage("2026-07-01", "codex", "gpt-5", 1);
    usage("2026-08-01", "codex", "gpt-5", 100);
    const repository = await makeRepository();

    const insights = await Effect.runPromise(
      repository.insights("user", { since: "2026-07-01", today, until: "2026-07-31" }),
    );

    expect(insights.totals).toMatchObject({ activeDays: 1, spendUsd: 1 });
    expect(insights.peakDay).toEqual({ date: "2026-07-01", spendUsd: 1 });
  });

  it("ranks spend within the range, ignoring shadow-banned users", async () => {
    usage("2026-07-01", "codex", "gpt-5", 10);
    usage("2026-07-01", "codex", "gpt-5", 50, {}, "rival");
    usage("2026-07-01", "codex", "gpt-5", 999, {}, "banned");
    usage("2026-06-01", "codex", "gpt-5", 999, {}, "user");
    const repository = await makeRepository();
    const july = { since: "2026-07-01", until: "2026-07-31" };

    expect(await Effect.runPromise(repository.spendRank({ ...july, userId: "user" }))).toBe(2);
    expect(await Effect.runPromise(repository.spendRank({ ...july, userId: "rival" }))).toBe(1);
    expect(
      await Effect.runPromise(
        repository.spendRank({ since: "2026-08-01", until: "2026-08-31", userId: "user" }),
      ),
    ).toBeNull();
  });
});

describe("peakSpendDay", () => {
  it("keeps the earliest day on a tie", () => {
    expect(
      peakSpendDay([
        { date: "2026-07-01", spendUsd: 3 },
        { date: "2026-07-02", spendUsd: 3 },
      ]),
    ).toEqual({ date: "2026-07-01", spendUsd: 3 });
  });
});
