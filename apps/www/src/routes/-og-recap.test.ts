import { describe, expect, it } from "vite-plus/test";

import { ogCacheKey, PREVIEW_CACHE_CONTROL } from "../lib/og-image";
import type { OgR2Bucket } from "../lib/og-runtime";
import { recapOgVersion, type RecapData } from "../lib/recap";
import { makeRecapOgImageHandler, recapOgScope } from "./og/recap/$login.{$month}[.]png";

const JULY_PRIOR = new Uint8Array([137, 80, 78, 71, 1]);
const JUNE = new Uint8Array([137, 80, 78, 71, 2]);
const PROFILE = new Uint8Array([137, 80, 78, 71, 3]);

const july: RecapData = {
  identity: { avatarUrl: null, login: "alex" },
  insights: {
    agents: [{ activeDays: 2, source: "codex", spendUsd: 30, totalTokens: 900 }],
    longestStreakDays: 2,
    peakDay: { date: "2026-07-02", spendUsd: 20 },
    range: { firstDate: "2026-07-01", lastDate: "2026-07-31" },
    spendRank: 1,
    topModel: { model: "gpt-5", spendUsd: 30, totalTokens: 900 },
    totals: {
      activeDays: 2,
      cacheCreationTokens: 0,
      cacheReadTokens: 600,
      inputTokens: 200,
      outputTokens: 100,
      spendUsd: 30,
      totalTokens: 900,
    },
  },
  month: "2026-07",
};

describe("recap OG image route", () => {
  it("caches each month under its own scope, apart from the profile card", () => {
    expect(recapOgScope("alex", "2026-07")).toBe("alex/recap-2026-07");
    expect(ogCacheKey(recapOgScope("alex", "2026-07"), "v")).not.toMatch(/^og\/alex\//);
  });

  it("falls back only to an earlier image of the same month when a capture fails", async () => {
    const response = await requestWithFailingCapture([
      [ogCacheKey("alex", "profile-version"), PROFILE],
      [ogCacheKey(recapOgScope("alex", "2026-06"), "june-version"), JUNE],
      [ogCacheKey(recapOgScope("alex", "2026-07"), "older-july-version"), JULY_PRIOR],
    ]);

    expect(response.headers.get("x-og-source")).toBe("prior-cache");
    expect(response.headers.get("cache-control")).toBe(PREVIEW_CACHE_CONTROL);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...JULY_PRIOR]);
  });

  it("serves the neutral fallback rather than another month or the profile card", async () => {
    const response = await requestWithFailingCapture([
      [ogCacheKey("alex", "profile-version"), PROFILE],
      [ogCacheKey(recapOgScope("alex", "2026-06"), "june-version"), JUNE],
    ]);

    expect(response.headers.get("x-og-source")).toBe("fallback");
  });
});

async function requestWithFailingCapture(entries: Array<[string, Uint8Array]>) {
  const handler = makeRecapOgImageHandler({
    captureScreenshot: async () => {
      throw new Error("Browser Run rate limited");
    },
    getRuntimeEnv: async () => ({
      BROWSER: { quickAction: async () => new Response(null, { status: 429 }) },
      BUCKET: memoryBucket(entries),
    }),
    loadRecapData: async () => july,
  });

  return handler({
    params: { login: "alex", month: "2026-07" },
    request: new Request(
      `https://maxxing.nrght.eu/og/recap/alex/2026-07.png?v=${recapOgVersion(july)}`,
    ),
  });
}

function memoryBucket(entries: Array<[string, Uint8Array]>): OgR2Bucket {
  const store = new Map(entries.map(([key, bytes], index) => [key, { bytes, index }]));

  return {
    get: async (key) => {
      const object = store.get(key);
      return object === undefined
        ? null
        : {
            arrayBuffer: async () => object.bytes.slice().buffer as ArrayBuffer,
            key,
            uploaded: new Date(1_000 + object.index),
          };
    },
    list: async ({ prefix }) => ({
      objects: [...store.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, object]) => ({ key, uploaded: new Date(1_000 + object.index) })),
    }),
    put: async () => undefined,
  };
}
