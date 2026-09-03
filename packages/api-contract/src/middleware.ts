import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { Unauthorized } from "./errors";
import { AuthUser, CliIdentity } from "./schemas";

/**
 * Middleware DEFINITIONS the contract's groups reference — the server
 * provides the implementations (apps/api/src/http/middleware), clients
 * see them only as error surface + OpenAPI metadata.
 */

class CurrentUser extends Context.Service<CurrentUser, typeof AuthUser.Type>()(
  "@nightmaxxing/api/CurrentUser",
) {}

/**
 * Browser authentication: the session cookie (or a bearer session token).
 * Deliberately NOT an HttpApiSecurity-scheme middleware: the builder's
 * scheme fall-through re-runs the wrapped handler per scheme and replaces
 * its domain failures with the last scheme's decode error.
 */
class Authorization extends HttpApiMiddleware.Service<Authorization, { provides: CurrentUser }>()(
  "@nightmaxxing/api/Authorization",
  {
    error: Unauthorized,
  },
) {}

class CurrentCliIdentity extends Context.Service<CurrentCliIdentity, typeof CliIdentity.Type>()(
  "@nightmaxxing/api/CurrentCliIdentity",
) {}

/** CLI authentication: a `Bearer tmx_…` token resolved against cli_tokens. */
class CliAuth extends HttpApiMiddleware.Service<CliAuth, { provides: CurrentCliIdentity }>()(
  "@nightmaxxing/api/CliAuth",
  {
    error: Unauthorized,
  },
) {}

export { Authorization, CliAuth, CurrentCliIdentity, CurrentUser };
