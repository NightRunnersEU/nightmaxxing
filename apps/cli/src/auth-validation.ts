import { Effect } from "effect";
import type { AuthUser } from "@nightmaxxing/api-contract";

import {
  formatHighlight,
  humanSpinner,
  type FormatHighlightOptions,
  type HumanOutputOptions,
} from "./output";
import type { NightmaxxingApiClient } from "./services";

type ValidateCurrentLoginSuccessDisposition = "error" | "success";
type ValidateCurrentLoginSuccessMessage = ((user: AuthUser) => string) | string | undefined;

interface ValidateCurrentLoginOptions extends HumanOutputOptions {
  showSpinner?: boolean | undefined;
  successDisposition?: ValidateCurrentLoginSuccessDisposition | undefined;
  successMessage?: ValidateCurrentLoginSuccessMessage;
}

type CurrentLoginValidation =
  | { _tag: "failed"; cause: unknown }
  | { _tag: "unauthorized" }
  | { _tag: "valid"; user: AuthUser };

function validateCurrentLogin(
  client: NightmaxxingApiClient,
  options: ValidateCurrentLoginOptions = {},
) {
  return Effect.gen(function* () {
    const spinner =
      options.showSpinner === true
        ? yield* humanSpinner("Checking current login", options)
        : undefined;
    const result = yield* client.me.me().pipe(
      Effect.map((me): CurrentLoginValidation => ({ _tag: "valid", user: me.user })),
      Effect.catch((cause) =>
        Effect.succeed(
          isUnauthorizedError(cause)
            ? ({ _tag: "unauthorized" } satisfies CurrentLoginValidation)
            : ({ _tag: "failed", cause } satisfies CurrentLoginValidation),
        ),
      ),
    );

    if (result._tag === "valid") {
      const successMessage =
        typeof options.successMessage === "function"
          ? options.successMessage(result.user)
          : (options.successMessage ?? "Validated current login");
      const successDisposition = options.successDisposition ?? "success";
      yield* Effect.sync(() => {
        if (successDisposition === "error") {
          spinner?.error(successMessage);
          return;
        }

        spinner?.stop(successMessage);
      });
      return result;
    }

    yield* Effect.sync(() => spinner?.error("Could not validate current login"));
    return result;
  });
}

function isUnauthorizedError(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { _tag?: string })._tag === "Unauthorized"
  );
}

function loggedInAsMessage(
  user: Pick<AuthUser, "login">,
  options: FormatHighlightOptions = {},
): string {
  return `Logged in as ${formatHighlight(user.login, options)}`;
}

function alreadyLoggedInAsMessage(
  user: Pick<AuthUser, "login">,
  options: FormatHighlightOptions = {},
): string {
  return `Already logged in as ${formatHighlight(user.login, options)}`;
}

export { alreadyLoggedInAsMessage, isUnauthorizedError, loggedInAsMessage, validateCurrentLogin };
export type {
  CurrentLoginValidation,
  ValidateCurrentLoginSuccessDisposition,
  ValidateCurrentLoginOptions,
  ValidateCurrentLoginSuccessMessage,
};
