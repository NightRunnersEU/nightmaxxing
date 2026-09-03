import type { ProfileDailyResponse, ProfileResponse } from "@nightmaxxing/api-contract";

import { resolveApiUrl } from "./config";

type Profile = typeof ProfileResponse.Type;
type Daily = typeof ProfileDailyResponse.Type;

interface ProfileOgData {
  daily: Daily;
  profile: Profile;
}

async function loadProfileOgData(login: string): Promise<ProfileOgData | null> {
  const apiUrl = resolveApiUrl().replace(/\/$/, "");
  const encodedLogin = encodeURIComponent(login);
  const profileResponse = await fetch(`${apiUrl}/profiles/${encodedLogin}`);
  if (profileResponse.status === 404) {
    return null;
  }
  if (!profileResponse.ok) {
    throw new Error(`Failed to load OG profile ${login}: ${profileResponse.status}`);
  }

  const dailyResponse = await fetch(`${apiUrl}/profiles/${encodedLogin}/daily?groupBy=model`);
  if (dailyResponse.status === 404) {
    return null;
  }
  if (!dailyResponse.ok) {
    throw new Error(`Failed to load OG daily data ${login}: ${dailyResponse.status}`);
  }

  return {
    daily: (await dailyResponse.json()) as Daily,
    profile: (await profileResponse.json()) as Profile,
  };
}

export { loadProfileOgData };

export type { Daily, Profile, ProfileOgData };
