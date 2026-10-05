import { describe, expect, it } from "vite-plus/test";

import {
  currentRecapMonth,
  isRecapMonth,
  monthBounds,
  recapFigures,
  recapOgImageUrl,
  recapOgVersion,
  recapPath,
  shiftMonth,
} from "./recap";

const now = new Date("2026-10-05T12:00:00Z");

const insights = {
  agents: [
    { activeDays: 3, source: "codex", spendUsd: 80, totalTokens: 900 },
    { activeDays: 1, source: "claude", spendUsd: 20, totalTokens: 100 },
  ],
  longestStreakDays: 3,
  peakDay: { date: "2026-09-12", spendUsd: 40 },
  range: { firstDate: "2026-09-01", lastDate: "2026-09-30" },
  spendRank: 2,
  topModel: { model: "gpt-5.6-sol", spendUsd: 70, totalTokens: 800 },
  totals: {
    activeDays: 4,
    cacheCreationTokens: 0,
    cacheReadTokens: 600,
    inputTokens: 200,
    outputTokens: 200,
    spendUsd: 100.004,
    totalTokens: 1_000,
  },
};

describe("recap months", () => {
  it("accepts well-formed months from the first usage month through the current UTC month", () => {
    expect(currentRecapMonth(now)).toBe("2026-10");
    expect(isRecapMonth("2026-10", now)).toBe(true);
    expect(isRecapMonth("2024-01", now)).toBe(true);
    expect(isRecapMonth("2026-11", now)).toBe(false);
    expect(isRecapMonth("2023-12", now)).toBe(false);
    expect(isRecapMonth("2026-13", now)).toBe(false);
    expect(isRecapMonth("2026-9", now)).toBe(false);
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-05", -17)).toBe("2024-12");
  });

  it("bounds each month by its real last day, leap years included", () => {
    expect(monthBounds("2026-09")).toEqual({ since: "2026-09-01", until: "2026-09-30" });
    expect(monthBounds("2026-10")).toEqual({ since: "2026-10-01", until: "2026-10-31" });
    expect(monthBounds("2026-02").until).toBe("2026-02-28");
    expect(monthBounds("2028-02").until).toBe("2028-02-29");
    expect(monthBounds("2100-02").until).toBe("2100-02-28");
    expect(monthBounds("2000-02").until).toBe("2000-02-29");
  });
});

describe("recapFigures", () => {
  it("names the top agent and derives the cache hit rate", () => {
    expect(recapFigures(insights)).toEqual({
      activeDays: 4,
      // 600 cache reads of 800 prompt tokens.
      cacheHitRate: 75,
      longestStreakDays: 3,
      peakDay: { date: "2026-09-12", spendUsd: 40 },
      spendRank: 2,
      spendUsd: 100.004,
      topAgent: "OpenAI Codex",
      topModel: "gpt-5.6-sol",
      totalTokens: 1_000,
    });
  });

  it("leaves names empty for a month without usage", () => {
    const figures = recapFigures({
      ...insights,
      agents: [],
      peakDay: null,
      spendRank: null,
      topModel: null,
      totals: { ...insights.totals, cacheReadTokens: 0, inputTokens: 0 },
    });

    expect(figures).toMatchObject({
      cacheHitRate: null,
      spendRank: null,
      topAgent: null,
      topModel: null,
    });
  });
});

describe("recap links", () => {
  const data = { identity: { avatarUrl: null, login: "yann" }, insights, month: "2026-09" };

  it("fingerprints the card by month and figures, never colliding with profile keys", () => {
    expect(recapOgVersion(data)).toMatch(/^recap-2026-09-10000-1000-4-2-s\d+$/);
  });

  it("builds the page path and a versioned image URL", () => {
    expect(recapPath("yann", "2026-09")).toBe("/yann/recap/2026-09");
    expect(recapOgImageUrl(data, "https://maxxing.nrght.eu")).toBe(
      `https://maxxing.nrght.eu/og/recap/yann/2026-09.png?v=${recapOgVersion(data)}`,
    );
  });
});
