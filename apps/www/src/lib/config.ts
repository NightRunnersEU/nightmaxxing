/**
 * Environment resolution mirrors the API's cookieScopeFor: vite dev (or a
 * *.nightmaxxing.localhost host) means the local stack, anything else means
 * production. SSR without a window falls back to the build mode.
 */

const DEV_API_URL = "http://api.nightmaxxing.localhost:8788";
const PROD_API_URL = "https://api.maxxing.nrght.eu";

function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.hostname.endsWith("nightmaxxing.localhost") ? DEV_API_URL : PROD_API_URL;
  }

  return import.meta.env.DEV ? DEV_API_URL : PROD_API_URL;
}

export { resolveApiUrl };
