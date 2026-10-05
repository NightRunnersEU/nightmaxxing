import * as OpenApi from "effect/unstable/httpapi/OpenApi";
import { describe, expect, it } from "vite-plus/test";

import { NightmaxxingApi } from "./api";

/**
 * Review aid, not a compatibility contract: every endpoint's params,
 * payload, success and error schemas in one file, so any wire change shows
 * up as a diff. Only the CLI slice (cli-endpoints.test.ts) is frozen for
 * published CLIs; www-only endpoints here may change with www.
 */

describe("NightmaxxingApi wire format", () => {
  it("matches the full OpenAPI snapshot", async () => {
    await expect(
      `${JSON.stringify(OpenApi.fromApi(NightmaxxingApi), null, 2)}\n`,
    ).toMatchFileSnapshot("../fixtures/full-api.openapi.json");
  });
});
