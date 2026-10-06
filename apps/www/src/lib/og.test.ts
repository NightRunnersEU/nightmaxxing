import { describe, expect, it } from "vite-plus/test";
import type { ProfileResponse } from "@nightmaxxing/api-contract";

import {
  profileOgDescription,
  profileOgImagePath,
  profileOgImageUrl,
  profileOgVersion,
  profileUrl,
} from "./og";

type Profile = typeof ProfileResponse.Type;

describe("profile OG helpers", () => {
  it("keeps the fingerprint when a sync only moves values the card rounds away", () => {
    const base = profile({ spendUsd: 123.45, totalTokens: 987_654 });

    expect(profileOgVersion(base)).toMatch(/^[0-9a-f]{8}-s\d+$/);
    // "$123" and "987.7K" either way, and the card never shows the last date.
    expect(
      profileOgVersion(profile({ lastDate: "2026-06-22", spendUsd: 123.4, totalTokens: 987_699 })),
    ).toBe(profileOgVersion(base));
  });

  it("changes the fingerprint when anything the card shows changes", () => {
    const base = profile();
    const changed = [
      profile({ spendUsd: 124.5 }),
      profile({ totalTokens: 1_100_000 }),
      profile({ activeDays: 8 }),
      withStats(base, { currentStreakDays: 4 }),
      withStats(base, { sessionCount: 15 }),
      withStats(base, { topModel: { model: "gpt-5", spendUsd: 42 } }),
      { ...base, user: { ...base.user, avatarUrl: "https://example.com/new.png" } },
      profile({ login: "alex" }),
    ];

    for (const subject of changed) {
      expect(profileOgVersion(subject)).not.toBe(profileOgVersion(base));
    }
  });

  it("describes usage with the same formatters as the profile page", () => {
    expect(profileOgDescription(profile())).toBe(
      "pondorasti has spent $123 across 7 active days and 987.7K tokens.",
    );
    expect(profileOgDescription(profile({ spendUsd: 42.5 }))).toContain("$42.50");
  });

  it("builds sane metadata for an empty profile", () => {
    const empty = profile({
      activeDays: 0,
      lastDate: null,
      spendUsd: 0,
      totalTokens: 0,
    });

    expect(profileOgDescription(empty)).toBe("pondorasti has not synced usage yet.");
    expect(profileOgImagePath(empty)).toBe(`/og/pondorasti.png?v=${profileOgVersion(empty)}`);
  });

  it("encodes logins in image and profile URLs", () => {
    const subject = profile({ login: "alex test" });

    expect(profileOgImageUrl(subject, "https://example.com")).toBe(
      `https://example.com/og/alex%20test.png?v=${profileOgVersion(subject)}`,
    );
    expect(profileUrl(subject, "https://example.com")).toBe("https://example.com/alex%20test");
  });
});

function withStats(subject: Profile, stats: Partial<Profile["stats"]>): Profile {
  return { ...subject, stats: { ...subject.stats, ...stats } };
}

function profile({
  activeDays = 7,
  lastDate = "2026-06-21",
  login = "pondorasti",
  spendUsd = 123.45,
  totalTokens = 987_654,
}: {
  activeDays?: number;
  lastDate?: string | null;
  login?: string;
  spendUsd?: number;
  totalTokens?: number;
} = {}): Profile {
  return {
    stats: {
      activeDays,
      avgSpendPerActiveDay: activeDays === 0 ? 0 : spendUsd / activeDays,
      currentStreakDays: activeDays === 0 ? 0 : 3,
      deviceCount: activeDays === 0 ? 0 : 2,
      firstDate: activeDays === 0 ? null : "2026-01-01",
      lastDate,
      leaderboardRank: activeDays === 0 ? null : 7,
      longestStreakDays: activeDays === 0 ? 0 : 12,
      peakDay: activeDays === 0 ? null : { date: "2026-06-20", spendUsd: 42 },
      sessionCount: activeDays === 0 ? 0 : 14,
      sources: activeDays === 0 ? [] : ["claude", "codex"],
      topModel: activeDays === 0 ? null : { model: "claude-opus", spendUsd: 42 },
      spendUsd,
      totalTokens,
    },
    user: {
      avatarUrl: "https://github.com/pondorasti.png",
      login,
      name: null,
    },
  };
}
