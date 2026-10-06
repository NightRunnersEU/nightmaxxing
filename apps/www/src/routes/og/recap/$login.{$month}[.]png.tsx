import { createFileRoute } from "@tanstack/react-router";

import { captureOgCardScreenshot, renderOgImage, type OgImageDeps } from "../../../lib/og-image";
import { getOgRuntimeEnv } from "../../../lib/og-runtime";
import { recapOgVersion, type RecapData } from "../../../lib/recap";
import { loadRecapData } from "../../../lib/recap-data";

/**
 * A monthly recap's Open Graph PNG, captured from `/og-card/recap/...` and
 * cached in R2 under its own `<login>/recap-<month>` scope. The scope is also
 * where a failed capture looks for an earlier image, so it must never reach
 * the profile card or another month's recap.
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
          scope: recapOgScope(login, data.month),
        };
      },
    });
  };
}

function recapOgScope(login: string, month: string): string {
  return `${login}/recap-${month}`;
}

const Route = createFileRoute("/og/recap/$login/{$month}.png")({
  server: {
    handlers: {
      GET: makeRecapOgImageHandler(),
    },
  },
});

export { makeRecapOgImageHandler, recapOgScope, Route };

export type { RecapOgRouteDeps };
