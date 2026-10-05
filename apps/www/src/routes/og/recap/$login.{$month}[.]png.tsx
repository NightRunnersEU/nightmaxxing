import { createFileRoute } from "@tanstack/react-router";

import { captureOgCardScreenshot, renderOgImage, type OgImageDeps } from "../../../lib/og-image";
import { getOgRuntimeEnv } from "../../../lib/og-runtime";
import { recapOgVersion, type RecapData } from "../../../lib/recap";
import { loadRecapData } from "../../../lib/recap-data";

/**
 * A monthly recap's Open Graph PNG, captured from `/og-card/recap/...` and
 * cached in R2 under the profile's scope with a `recap-<month>-…`
 * fingerprint, so it never collides with the profile card's keys.
 */

interface RecapOgRouteContext {
  context?: unknown;
  params: { login: string; month: string };
  request: Request;
}

interface RecapOgRouteDeps extends OgImageDeps {
  loadRecapData(login: string, month: string): Promise<RecapData | null>;
}

const defaultDeps: RecapOgRouteDeps = {
  captureScreenshot: captureOgCardScreenshot,
  getRuntimeEnv: getOgRuntimeEnv,
  loadRecapData,
};

function makeRecapOgImageHandler(deps: RecapOgRouteDeps = defaultDeps) {
  return function handleRecapOgImageRequest({ context, params, request }: RecapOgRouteContext) {
    return renderOgImage(deps, {
      context,
      request,
      resolveTarget: async () => {
        const data = await deps.loadRecapData(params.login, params.month);
        if (data === null) {
          return null;
        }

        const login = data.identity.login;
        return {
          cardPath: `/og-card/recap/${encodeURIComponent(login)}/${data.month}`,
          currentVersion: recapOgVersion(data),
          scope: login,
        };
      },
    });
  };
}

const Route = createFileRoute("/og/recap/$login/{$month}.png")({
  server: {
    handlers: {
      GET: makeRecapOgImageHandler(),
    },
  },
});

export { makeRecapOgImageHandler, Route };

export type { RecapOgRouteDeps };
