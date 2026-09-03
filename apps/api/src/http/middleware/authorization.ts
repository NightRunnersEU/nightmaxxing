import { Effect } from "effect";
import { Layer } from "effect";
import { Option } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { Authorization, CurrentUser, Unauthorized } from "@nightmaxxing/api-contract";

import { CLI_TOKEN_PREFIX } from "../../auth/crypto";
import { sessionTokenFrom } from "../../auth/cookies";
import { AuthService, type CurrentUser as AuthUser } from "../../auth/service";
import { TokensService } from "../../tokens/service";

/**
 * Request authentication for the session-guarded contract groups: the
 * session cookie (browsers) or a bearer token — a `tmx_` CLI token acts as
 * the account it belongs to (whoami, device management from the terminal).
 *
 * Deliberately NOT an HttpApiSecurity-scheme middleware: the builder's
 * scheme fall-through re-runs the wrapped handler per scheme and treats the
 * handler's own domain failures as scheme failures, replacing them with the
 * last scheme's decode error. One plain middleware, one execution.
 */

const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const tokens = yield* TokensService;

    const resolve = Effect.fn("Authorization.resolve")(function* (token: string) {
      if (token.startsWith(CLI_TOKEN_PREFIX)) {
        const identity = yield* tokens.resolveCliToken(token);
        return Option.map(identity, ({ user }) => user);
      }

      return yield* auth.resolveSession(token);
    });

    return Authorization.of((httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const token = sessionTokenFrom(request);
        const user =
          token === null
            ? Option.none<AuthUser>()
            : yield* resolve(token).pipe(Effect.catchCause(() => Effect.succeedNone));
        if (Option.isNone(user)) {
          return yield* Effect.fail(new Unauthorized({ message: "Sign in required." }));
        }

        return yield* Effect.provideService(httpEffect, CurrentUser, user.value);
      }),
    );
  }),
);

export { AuthorizationLive };
