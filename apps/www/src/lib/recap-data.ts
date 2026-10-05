import { ProfileIdentityResponse, ProfileInsightsResponse } from "@nightmaxxing/api-contract";

import { fetchPublicProfile } from "./public-api";
import { isRecapMonth, monthBounds, type RecapData } from "./recap";

/**
 * Everything a recap card renders, read anonymously like the profile OG card.
 * Null for an unknown or hidden profile, or a month outside the recap range.
 */
async function loadRecapData(
  login: string,
  month: string,
  now = new Date(),
): Promise<RecapData | null> {
  if (!isRecapMonth(month, now)) {
    return null;
  }

  const { since, until } = monthBounds(month);
  const query = new URLSearchParams({ since, until }).toString();
  const [identity, insights] = await Promise.all([
    fetchPublicProfile(login, "/identity", ProfileIdentityResponse),
    fetchPublicProfile(login, `/insights?${query}`, ProfileInsightsResponse),
  ]);

  return identity === null || insights === null ? null : { identity, insights, month };
}

export { loadRecapData };
