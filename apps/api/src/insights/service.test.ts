import { Effect, Option, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { BadRequest, MIN_USAGE_DATE_KEY, UserId, UserNotFound } from "@nightmaxxing/api-contract";

import { ProfilesRepository } from "../profiles/service";
import { insightsBounds, InsightsRepository, makeInsightsService } from "./service";

describe("insightsBounds", () => {
  const now = new Date("2026-06-21T23:30:00.000Z");
  const bounds = (query: { since?: string; until?: string }) =>
    Effect.runSync(Effect.result(insightsBounds(query, now)));

  it("defaults to all time, read up to the ingest ceiling", () => {
    expect(bounds({})).toEqual(Result.succeed({ since: MIN_USAGE_DATE_KEY, until: "2026-06-22" }));
  });

  it("passes a calendar month through and caps a future `until`", () => {
    expect(bounds({ since: "2026-05-01", until: "2026-05-31" })).toEqual(
      Result.succeed({ since: "2026-05-01", until: "2026-05-31" }),
    );
    expect(bounds({ since: "2026-06-01", until: "2026-06-30" })).toEqual(
      Result.succeed({ since: "2026-06-01", until: "2026-06-22" }),
    );
  });

  it("floors `since` at the earliest accepted usage day", () => {
    expect(bounds({ since: "2000-01-01" })).toEqual(
      Result.succeed({ since: MIN_USAGE_DATE_KEY, until: "2026-06-22" }),
    );
  });

  it("rejects an inverted range", () => {
    expect(bounds({ since: "2026-07-01" })).toEqual(
      Result.fail(
        new BadRequest({
          message: "Invalid date range: `since` (2026-07-01) is after `until` (2026-06-22).",
        }),
      ),
    );
  });
});

const rangeInsights = {
  agents: [{ activeDays: 1, source: "codex", spendUsd: 2, totalTokens: 100 }],
  longestStreakDays: 1,
  peakDay: { date: "2026-06-21", spendUsd: 2 },
  topModel: { model: "gpt-5", spendUsd: 2, totalTokens: 100 },
  totals: {
    activeDays: 1,
    cacheCreationTokens: 0,
    cacheReadTokens: 60,
    inputTokens: 30,
    outputTokens: 10,
    spendUsd: 2,
    totalTokens: 100,
  },
};

const targetId = UserId.make("user_target");

function makeService(shadowBanned: boolean) {
  return Effect.runPromise(
    makeInsightsService().pipe(
      Effect.provideService(InsightsRepository, {
        insights: () => Effect.succeed(rangeInsights),
        spendRank: () => Effect.succeed(3),
      }),
      Effect.provideService(ProfilesRepository, {
        daily: () => Effect.die("unused"),
        findUserByLogin: (login) =>
          Effect.succeed(
            login === "target"
              ? Option.some({
                  shadowBanned,
                  user: { avatarUrl: null, id: targetId, login: "target", name: null },
                })
              : Option.none(),
          ),
        leaderboardRank: () => Effect.die("unused"),
        stats: () => Effect.die("unused"),
      }),
    ),
  );
}

describe("InsightsService", () => {
  it("returns the range insights with the requested range and spend rank", async () => {
    const service = await makeService(false);

    const result = await Effect.runPromise(
      service.getProfileInsights("target", { since: "2026-06-01", until: "2026-06-21" }, null),
    );

    expect(result).toEqual({
      ...rangeInsights,
      range: { firstDate: "2026-06-01", lastDate: "2026-06-21" },
      spendRank: 3,
    });
  });

  it("hides unknown and shadow-banned profiles from everyone but their owner", async () => {
    const visible = await makeService(false);
    const banned = await makeService(true);
    const notFound = (login: string) => Result.fail(new UserNotFound({ login }));
    const read = (service: typeof visible, login: string, viewer: UserId | null) =>
      Effect.runPromise(Effect.result(service.getProfileInsights(login, {}, viewer)));

    expect(await read(visible, "nobody", null)).toEqual(notFound("nobody"));
    expect(await read(banned, "target", null)).toEqual(notFound("target"));
    expect(Result.isSuccess(await read(banned, "target", targetId))).toBe(true);
  });
});
