import type { ProfileResponse } from "@nightmaxxing/api-contract";

import { formatInteger, formatTokens, formatUsd } from "./format";
import { SITE_ORIGIN } from "./site";

type Profile = typeof ProfileResponse.Type;

const OG_IMAGE_HEIGHT = 630;
/** Bump when the card's rendering changes so versioned image URLs refresh. */
const OG_IMAGE_STYLE_VERSION = 4;
const OG_IMAGE_WIDTH = 1200;

/** The site-wide card (`/og-card`), used by every page without its own image. */
const SITE_OG_VERSION = `site-s${OG_IMAGE_STYLE_VERSION}`;
const SITE_OG_IMAGE_PATH = `/og.png?${new URLSearchParams({ v: SITE_OG_VERSION }).toString()}`;
const SITE_OG_IMAGE_URL = new URL(SITE_OG_IMAGE_PATH, SITE_ORIGIN).toString();

function profileOgTitle(profile: Profile): string {
  return `${profile.user.login} on maxxing.nrght.eu`;
}

function profileOgDescription(profile: Profile): string {
  const { stats } = profile;
  if (stats.activeDays === 0) {
    return `${profile.user.login} has not synced usage yet.`;
  }

  return `${profile.user.login} has spent ${formatUsd(stats.spendUsd)} across ${formatInteger(
    stats.activeDays,
  )} active days and ${formatTokens(stats.totalTokens)} tokens.`;
}

interface OgMetric {
  label: string;
  /** Formatted exactly as the card renders it. */
  value: string;
}

/** The six figures the profile card shows, formatted as it shows them. */
function profileOgMetrics(profile: Profile): OgMetric[] {
  const { stats } = profile;
  return [
    { label: "Total spend", value: formatUsd(stats.spendUsd) },
    { label: "Total tokens", value: formatTokens(stats.totalTokens) },
    { label: "Active days", value: formatInteger(stats.activeDays) },
    { label: "Current streak", value: formatInteger(stats.currentStreakDays) },
    { label: "Sessions", value: formatInteger(stats.sessionCount) },
    { label: "Top spend model", value: stats.topModel === null ? "—" : stats.topModel.model },
  ];
}

/**
 * Fingerprint of a card as it renders: the image is re-captured only when
 * something visible changes, not on every sync that moves a cent or a token.
 * It keys the R2 cache and the `?v=` that lets crawlers cache immutably.
 */
function ogFingerprint(rendered: readonly string[]): string {
  return `${fnv1a(rendered.join("\u0000"))}-s${OG_IMAGE_STYLE_VERSION}`;
}

function profileOgVersion(profile: Profile): string {
  return ogFingerprint([
    profile.user.login,
    profile.user.avatarUrl ?? "",
    ...profileOgMetrics(profile).map((metric) => metric.value),
  ]);
}

/** 32-bit FNV-1a as 8 hex digits: short, stable, and plenty within one profile's keys. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function profileOgImagePath(profile: Profile): string {
  const path = `/og/${encodeURIComponent(profile.user.login)}.png`;
  const params = new URLSearchParams({
    v: profileOgVersion(profile),
  });

  return `${path}?${params.toString()}`;
}

function profileOgImageUrl(profile: Profile, origin = SITE_ORIGIN): string {
  return new URL(profileOgImagePath(profile), origin).toString();
}

function profileUrl(profile: Profile, origin = SITE_ORIGIN): string {
  return new URL(`/${encodeURIComponent(profile.user.login)}`, origin).toString();
}

export {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_STYLE_VERSION,
  OG_IMAGE_WIDTH,
  ogFingerprint,
  profileOgDescription,
  profileOgImagePath,
  profileOgImageUrl,
  profileOgMetrics,
  profileOgTitle,
  profileOgVersion,
  profileUrl,
  SITE_OG_IMAGE_PATH,
  SITE_OG_IMAGE_URL,
  SITE_OG_VERSION,
  // Re-exported for routes that still import it from here; prefer lib/site.
  SITE_ORIGIN,
};

export type { OgMetric };
