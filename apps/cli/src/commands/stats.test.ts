import { Cause, Effect, Exit, Layer } from "effect";
import { UserId, type AuthUser } from "@nightmaxxing/api-contract";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { makeStubApiClient, type StubResponse } from "../testing/stub-api-client";
import {
  ApiClientService,
  type CliConfig,
  ClockService,
  ConfigService,
  ConsoleService,
  type NightmaxxingApiClient,
} from "../services";
import {
  formatTokens,
  formatUsd,
  localDayKey,
  statsEffect,
  statsLines,
  type StatsReport,
} from "./stats";
import { NotLoggedInError } from "./whoami";

const promptCalls = vi.hoisted((): string[] => []);

vi.mock("@clack/prompts", () => ({
  intro: (title: string) => {
    promptCalls.push(`intro:${title}`);
  },
  log: {
    info: (message: string) => {
      promptCalls.push(`info:${message}`);
    },
  },
  outro: (message: string) => {
    promptCalls.push(`outro:${message}`);
  },
  spinner: () => ({
    error: (message?: string) => {
      promptCalls.push(`spinner-error:${message ?? ""}`);
    },
    start: (message: string) => {
      promptCalls.push(`spinner-start:${message}`);
    },
    stop: (message?: string) => {
      promptCalls.push(`spinner-stop:${message ?? ""}`);
    },
  }),
}));

const originalStdoutIsTty = process.stdout.isTTY;
const originalStderrIsTty = process.stderr.isTTY;
const originalCi = process.env.CI;
const originalNoColor = process.env.NO_COLOR;
const originalTerm = process.env.TERM;

const user: AuthUser = { avatarUrl: null, id: UserId.make("user_123"), login: "alex", name: null };

const config: CliConfig = {
  apiUrl: "https://api.nightmaxxing.test",
  token: "tmx_test",
  wwwUrl: "https://nightmaxxing.test/",
};

const stats = {
  activeDays: 75,
  avgSpendPerActiveDay: 17.4,
  currentStreakDays: 3,
  deviceCount: 2,
  firstDate: "2025-11-18",
  lastDate: "2026-10-05",
  leaderboardRank: 2,
  longestStreakDays: 16,
  peakDay: { date: "2026-07-27", spendUsd: 74 },
  sessionCount: 211,
  sources: ["claude", "codex"],
  spendUsd: 1304.67,
  topModel: { model: "gpt-5.6-sol", spendUsd: 723.2 },
  totalTokens: 2_162_481_291,
};

const insights = {
  agents: [
    { activeDays: 3, source: "codex", spendUsd: 40, totalTokens: 100_000_000 },
    { activeDays: 1, source: "claude", spendUsd: 0.01, totalTokens: 15_000_000 },
  ],
  longestStreakDays: 3,
  peakDay: { date: "2026-10-03", spendUsd: 20 },
  range: { firstDate: "2026-10-01", lastDate: "2026-10-05" },
  spendRank: 3,
  topModel: { model: "gpt-5.6-sol", spendUsd: 30, totalTokens: 90_000_000 },
  totals: {
    activeDays: 4,
    cacheCreationTokens: 0,
    cacheReadTokens: 90_000_000,
    inputTokens: 10_000_000,
    outputTokens: 15_000_000,
    spendUsd: 40.01,
    totalTokens: 115_000_000,
  },
};

const report: StatsReport = {
  insights,
  month: "2026-10",
  profileUrl: "https://nightmaxxing.test/alex",
  recapUrl: "https://nightmaxxing.test/alex/recap/2026-10",
  stats,
  user,
};

/** Early October, local time: "this month" is October whatever the host's zone. */
const now = () => new Date(2026, 9, 5, 12, 0, 0);

/** A fake client recording the insights query, or the real contract client over `responses`. */
function testLayer(options: { responses?: Record<string, StubResponse>; stored?: CliConfig } = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const insightsQueries: unknown[] = [];
  const requests: string[] = [];
  const stored = options.stored ?? config;
  const layer = Layer.mergeAll(
    Layer.succeed(ApiClientService)({
      make: () =>
        options.responses === undefined
          ? Effect.succeed({
              insights: {
                profile: (request: { query: unknown }) =>
                  Effect.sync(() => {
                    insightsQueries.push(request.query);
                    return insights;
                  }),
              },
              me: { me: () => Effect.succeed({ user }) },
              profiles: { get: () => Effect.succeed({ stats, user }) },
            } as unknown as NightmaxxingApiClient)
          : makeStubApiClient(options.responses, requests),
    }),
    Layer.succeed(ClockService)({ sleep: () => Effect.void }),
    Layer.succeed(ConfigService)({
      clearToken: () => Effect.succeed({ config: stored, token: stored.token, tokenCleared: true }),
      ensureDeviceId: () => Effect.succeed("device_123"),
      hasEnvToken: () => Effect.succeed(false),
      readConfig: () => Effect.succeed(stored),
      writeToken: () => Effect.succeed(stored),
    }),
    Layer.succeed(ConsoleService)({
      error: (message?: unknown) => {
        errors.push(String(message));
      },
      log: (message?: unknown) => {
        logs.push(String(message));
      },
    }),
  );

  return { errors, insightsQueries, layer, logs, requests };
}

function useInteractiveTerminal() {
  for (const stream of [process.stdout, process.stderr]) {
    Object.defineProperty(stream, "isTTY", { configurable: true, value: true });
  }
  delete process.env.CI;
  delete process.env.NO_COLOR;
  process.env.TERM = "xterm-256color";
}

function restoreEnvironment() {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: originalStdoutIsTty,
  });
  Object.defineProperty(process.stderr, "isTTY", {
    configurable: true,
    value: originalStderrIsTty,
  });
  for (const [key, value] of [
    ["CI", originalCi],
    ["NO_COLOR", originalNoColor],
    ["TERM", originalTerm],
  ] as const) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("statsEffect", () => {
  afterEach(() => {
    promptCalls.length = 0;
    restoreEnvironment();
  });

  it("frames the summary and resolves the spinner into the login", async () => {
    const { errors, layer, logs } = testLayer();
    useInteractiveTerminal();

    await Effect.runPromise(statsEffect({ json: false, now }).pipe(Effect.provide(layer)));

    expect(errors).toEqual([]);
    expect(logs).toEqual([]);
    expect(promptCalls.slice(0, 3)).toEqual([
      "intro:Stats",
      "spinner-start:Fetching stats",
      "spinner-stop:Stats for alex",
    ]);
    expect(promptCalls).toContain("info:All time: $1,305 · 2.16B tokens · 75 active days");
    // URLs are colored on a TTY, so match on the link itself.
    expect(promptCalls.at(-3)).toMatch(/^info:Profile: .*https:\/\/nightmaxxing\.test\/alex\b/);
    expect(promptCalls.at(-2)).toMatch(
      /^info:Recap: .*https:\/\/nightmaxxing\.test\/alex\/recap\/2026-10/,
    );
    expect(promptCalls.at(-1)).toBe("outro:Done");
  });

  it("asks for the local month to date", async () => {
    const { insightsQueries, layer } = testLayer();

    await Effect.runPromise(statsEffect({ json: true, now }).pipe(Effect.provide(layer)));

    expect(insightsQueries).toEqual([{ since: "2026-10-01", until: "2026-10-05" }]);
  });

  it("writes only the JSON report for --json", async () => {
    const { errors, layer, logs } = testLayer();
    useInteractiveTerminal();

    await Effect.runPromise(statsEffect({ json: true, now }).pipe(Effect.provide(layer)));

    expect(errors).toEqual([]);
    expect(promptCalls).toEqual([]);
    expect(logs).toEqual([JSON.stringify(report)]);
  });

  it("fails as not logged in without a stored token, before any request", async () => {
    const { layer, requests } = testLayer({
      responses: {},
      stored: { ...config, token: undefined },
    });

    const exit = await Effect.runPromiseExit(
      statsEffect({ json: true, now }).pipe(Effect.provide(layer)),
    );

    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(NotLoggedInError);
    expect(requests).toEqual([]);
  });

  it("treats a rejected token as not logged in", async () => {
    const { layer, requests } = testLayer({
      responses: {
        "GET /me": {
          body: { _tag: "Unauthorized", message: "Sign in required." },
          status: 401,
        },
      },
    });

    const exit = await Effect.runPromiseExit(
      statsEffect({ json: true, now }).pipe(Effect.provide(layer)),
    );

    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(NotLoggedInError);
    expect(requests).toEqual(["GET /me"]);
  });
});

describe("statsLines", () => {
  it("summarises lifetime and this month, never rounding a real share to zero", () => {
    expect(statsLines(report)).toEqual([
      "All time: $1,305 · 2.16B tokens · 75 active days",
      "Streak: 3 days now, 16 days longest",
      "Rank: #2 by spend over the last 30 days",
      "Top model: gpt-5.6-sol ($723)",
      "October 2026: $40.01 · 115.0M tokens · 4 active days · #3 by spend",
      "Top agent this month: codex (100.0% of spend)",
      "Cache hit rate this month: 90.0%",
    ]);
  });

  it("points a new user at sync", () => {
    expect(statsLines({ ...report, stats: { ...stats, activeDays: 0 } })).toEqual([
      "No usage synced yet; run nightmaxxing sync to fill your profile",
    ]);
  });

  it("says when this month has no usage yet and the user is unranked", () => {
    const quiet = statsLines({
      ...report,
      insights: { ...insights, agents: [], totals: { ...insights.totals, activeDays: 0 } },
      stats: { ...stats, leaderboardRank: null },
    });

    expect(quiet).toContain("Rank: unranked over the last 30 days");
    expect(quiet.at(-1)).toBe("October 2026: no usage yet");
  });
});

describe("localDayKey", () => {
  it("uses the machine's local calendar day", () => {
    expect(localDayKey(new Date(2026, 0, 31, 23, 59))).toBe("2026-01-31");
    expect(localDayKey(new Date(2026, 1, 1, 0, 1))).toBe("2026-02-01");
  });
});

describe("stat formatters", () => {
  it("read like the website, including compact and capped extremes", () => {
    expect([
      formatUsd(0.46),
      formatUsd(1_397.58),
      formatUsd(1_234_567),
      formatUsd(2.7e296),
    ]).toEqual(["$0.46", "$1,398", "$1.2M", ">$999T"]);
    expect([formatTokens(726_700), formatTokens(2.44e9), formatTokens(8.6e15)]).toEqual([
      "726.7K",
      "2.44B",
      ">999T",
    ]);
    expect([formatUsd(Number.NaN), formatTokens(Number.NaN)]).toEqual(["—", "—"]);
  });
});
