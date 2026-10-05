import { describe, expect, it } from "vite-plus/test";

import { agentRows, formatShare, rankAgentRows, tokenMix } from "./insights-view";

const totals = {
  activeDays: 3,
  cacheCreationTokens: 10,
  cacheReadTokens: 150,
  inputTokens: 40,
  outputTokens: 0,
  spendUsd: 10,
  totalTokens: 200,
};

describe("agentRows", () => {
  it("labels agents and computes their spend and token shares", () => {
    expect(
      agentRows({
        agents: [
          { activeDays: 2, source: "codex", spendUsd: 7.5, totalTokens: 50 },
          { activeDays: 1, source: "someday-agent", spendUsd: 2.5, totalTokens: 150 },
        ],
        totals,
      }),
    ).toEqual([
      {
        activeDays: 2,
        label: "OpenAI Codex",
        source: "codex",
        spendShare: 75,
        spendUsd: 7.5,
        tokenShare: 25,
        totalTokens: 50,
      },
      {
        activeDays: 1,
        label: "someday-agent",
        source: "someday-agent",
        spendShare: 25,
        spendUsd: 2.5,
        tokenShare: 75,
        totalTokens: 150,
      },
    ]);
  });
});

describe("tokenMix", () => {
  it("reports the cache hit rate over every prompt token", () => {
    const mix = tokenMix({ ...totals, outputTokens: 50 });

    // 150 cache reads of 200 prompt tokens (40 input + 10 writes + 150 reads).
    expect(mix.cacheHitRate).toBe(75);
    expect(mix.rows.map((row) => [row.key, row.tokens, row.share])).toEqual([
      ["cacheRead", 150, 60],
      ["input", 40, 16],
      ["cacheCreation", 10, 4],
      ["output", 50, 20],
    ]);
  });

  it("has no hit rate and zero shares without any tokens", () => {
    const mix = tokenMix({
      ...totals,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      inputTokens: 0,
    });

    expect(mix.cacheHitRate).toBeNull();
    expect(mix.rows.every((row) => row.share === 0)).toBe(true);
  });
});

describe("formatShare", () => {
  it("never rounds a real share down to zero", () => {
    expect(formatShare(0)).toBe("0.0%");
    expect(formatShare(0.04)).toBe("<0.1%");
    expect(formatShare(0.05)).toBe("0.1%");
    expect(formatShare(89.64)).toBe("89.6%");
  });
});

describe("rankAgentRows", () => {
  const rows = agentRows({
    agents: [
      { activeDays: 1, source: "claude", spendUsd: 8, totalTokens: 50 },
      { activeDays: 1, source: "gemini", spendUsd: 1, totalTokens: 900 },
      { activeDays: 1, source: "codex", spendUsd: 1, totalTokens: 50 },
    ],
    totals: { ...totals, spendUsd: 10, totalTokens: 1_000 },
  });

  it("keeps the API's spend order for spend", () => {
    expect(rankAgentRows(rows, "spend").map((row) => row.source)).toEqual([
      "claude",
      "gemini",
      "codex",
    ]);
  });

  it("reranks by tokens, keeping spend order on a tie, without mutating the input", () => {
    expect(rankAgentRows(rows, "tokens").map((row) => row.source)).toEqual([
      "gemini",
      "claude",
      "codex",
    ]);
    expect(rows.map((row) => row.source)).toEqual(["claude", "gemini", "codex"]);
  });
});
