import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { createIsomorphicFn } from "@tanstack/react-start";
import { NightmaxxingApi } from "@nightmaxxing/api-contract";

import { resolveApiUrl } from "./config";

/**
 * The typed client derived from the shared contract, cookie-authenticated
 * (credentials ride on every request). Library functions keep Promise
 * signatures — Effects stay inside this module; components never see them.
 */

type NightmaxxingApiClient = HttpApiClient.ForApi<typeof NightmaxxingApi>;

interface ApiClientHandle {
  client(): Promise<NightmaxxingApiClient>;
  run<A, E>(effect: Effect.Effect<A, E, never>): Promise<A>;
}

function createApiClient(apiUrl: string, requestInit: RequestInit): ApiClientHandle {
  const layer = Layer.mergeAll(
    FetchHttpClient.layer,
    Layer.succeed(FetchHttpClient.RequestInit, requestInit),
  );
  const runtime = ManagedRuntime.make(layer);

  let cached: Promise<NightmaxxingApiClient> | null = null;
  const build = HttpApiClient.make(NightmaxxingApi, {
    baseUrl: apiUrl.replace(/\/$/, ""),
  });

  return {
    client: () => (cached ??= runtime.runPromise(build)),
    run: (effect) => runtime.runPromise(effect),
  };
}

let handle: ApiClientHandle | null = null;

async function clientHandle(): Promise<ApiClientHandle> {
  if (typeof window === "undefined") {
    return createApiClient(resolveApiUrl(), await serverRequestInit());
  }

  handle ??= createApiClient(resolveApiUrl(), { credentials: "include" });
  return handle;
}

const requestCookie = createIsomorphicFn()
  .client(() => undefined)
  .server(async () => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    return getRequestHeader("cookie");
  });

async function serverRequestInit(): Promise<RequestInit> {
  const cookie = await requestCookie();

  return {
    credentials: "include",
    headers: cookie === undefined ? undefined : { cookie },
  };
}

async function runApi<A, E>(
  call: (client: NightmaxxingApiClient) => Effect.Effect<A, E, never>,
): Promise<A> {
  const active = await clientHandle();
  const client = await active.client();

  return active.run(call(client));
}

/** Best-effort message extraction from the contract's tagged errors. */
function errorMessage(error: unknown, fallback: string): string {
  const inner = apiError(error);
  const message = (inner as { message?: unknown }).message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  return fallback;
}

function isApiError(error: unknown, tag: string): boolean {
  const inner = apiError(error);
  const innerTag = (inner as { _tag?: unknown })._tag;

  return innerTag === tag;
}

function apiError(error: unknown): unknown {
  if (typeof error === "object" && error !== null) {
    const cause = (error as { cause?: unknown }).cause ?? error;
    return typeof cause === "object" && cause !== null && "_tag" in cause && cause._tag === "Fail"
      ? ((cause as { error?: unknown }).error ?? cause)
      : cause;
  }

  return error;
}

/** Raw routes (OAuth signout) sit outside the derived client. */
async function signOut(): Promise<void> {
  await fetch(`${resolveApiUrl()}/auth/signout`, {
    credentials: "include",
    method: "POST",
  });
}

export { errorMessage, isApiError, runApi, signOut };
