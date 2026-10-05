import { MIN_USAGE_DATE_KEY, utcDayKey } from "@nightmaxxing/api-contract";
import type { ProfileIdentityResponse, ProfileInsightsResponse } from "@nightmaxxing/api-contract";

import { agentLabel } from "./agents";
import { formatMonthLong, percentOf } from "./format";
import { OG_IMAGE_STYLE_VERSION } from "./og";
import { SITE_ORIGIN } from "./site";

/**
 * Monthly recaps (Nightmaxxing): one calendar month of a profile's usage,
 * shared as a page and an Open Graph card. Months are opaque `YYYY-MM` keys
 * handled with string arithmetic, like the usage day keys they bound.
 */

type ProfileInsights = typeof ProfileInsightsResponse.Type;
type ProfileIdentity = typeof ProfileIdentityResponse.Type;

/** The first month any usage can fall in. */
const FIRST_RECAP_MONTH = MIN_USAGE_DATE_KEY.slice(0, 7);
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

interface RecapData {
  identity: ProfileIdentity;
  insights: ProfileInsights;
  month: string;
}

interface RecapFigures {
  activeDays: number;
  /** Percentage (0–100) of prompt tokens read from cache; null without prompts. */
  cacheHitRate: number | null;
  longestStreakDays: number;
  peakDay: ProfileInsights["peakDay"];
  spendRank: number | null;
  spendUsd: number;
  topAgent: string | null;
  topModel: string | null;
  totalTokens: number;
}

/** The current UTC month, the latest month a recap exists for. */
function currentRecapMonth(now: Date): string {
  return utcDayKey(now).slice(0, 7);
}

/** A well-formed month between the first usage month and the current UTC month. */
function isRecapMonth(month: string, now: Date): boolean {
  return MONTH_KEY.test(month) && month >= FIRST_RECAP_MONTH && month <= currentRecapMonth(now);
}

/** `month` moved by `delta` months, e.g. `shiftMonth("2026-01", -1)` is "2025-12". */
function shiftMonth(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  const year = Math.floor(index / 12);
  const monthNumber = index - year * 12 + 1;

  return `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(monthNumber) ? 30 : 31;
}

/** Inclusive day-key bounds of a month, as the insights endpoint takes them. */
function monthBounds(month: string): { since: string; until: string } {
  return { since: `${month}-01`, until: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

function recapFigures(insights: ProfileInsights): RecapFigures {
  const { totals } = insights;
  const promptTokens = totals.inputTokens + totals.cacheCreationTokens + totals.cacheReadTokens;
  const topAgent = insights.agents[0];

  return {
    activeDays: totals.activeDays,
    cacheHitRate: promptTokens === 0 ? null : percentOf(totals.cacheReadTokens, promptTokens),
    longestStreakDays: insights.longestStreakDays,
    peakDay: insights.peakDay,
    spendRank: insights.spendRank,
    spendUsd: totals.spendUsd,
    topAgent: topAgent === undefined ? null : agentLabel(topAgent.source),
    topModel: insights.topModel?.model ?? null,
    totalTokens: totals.totalTokens,
  };
}

function recapPath(login: string, month: string): string {
  return `/${encodeURIComponent(login)}/recap/${month}`;
}

function recapUrl(login: string, month: string, origin = SITE_ORIGIN): string {
  return new URL(recapPath(login, month), origin).toString();
}

function recapTitle(login: string, month: string): string {
  return `${login}'s ${formatMonthLong(month)} recap`;
}

/** Fingerprint of the recap card as it renders now: the R2 key and `?v=`. */
function recapOgVersion({ insights, month }: Pick<RecapData, "insights" | "month">): string {
  return [
    "recap",
    month,
    Math.round(insights.totals.spendUsd * 100),
    Math.round(insights.totals.totalTokens),
    insights.totals.activeDays,
    insights.spendRank ?? "none",
    `s${OG_IMAGE_STYLE_VERSION}`,
  ].join("-");
}

function recapOgImageUrl(data: RecapData, origin = SITE_ORIGIN): string {
  const path = `/og/recap/${encodeURIComponent(data.identity.login)}/${data.month}.png`;
  const url = new URL(path, origin);
  url.searchParams.set("v", recapOgVersion(data));

  return url.toString();
}

export {
  currentRecapMonth,
  FIRST_RECAP_MONTH,
  isRecapMonth,
  monthBounds,
  recapFigures,
  recapOgImageUrl,
  recapOgVersion,
  recapPath,
  recapTitle,
  recapUrl,
  shiftMonth,
};

export type { RecapData, RecapFigures };
