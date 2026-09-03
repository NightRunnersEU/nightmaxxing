import { Context, Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { NightmaxxingApi } from "@nightmaxxing/api-contract";

/**
 * The typed client derived from the shared contract — every call the CLI
 * makes goes through here, authenticated by the `tmx_` bearer when one is
 * configured.
 */

type NightmaxxingApiClient = HttpApiClient.ForApi<typeof NightmaxxingApi>;

interface ApiClientOptions {
  baseUrl: string;
  token?: string | undefined;
}

class ApiClientService extends Context.Service<
  ApiClientService,
  {
    readonly make: (options: ApiClientOptions) => Effect.Effect<NightmaxxingApiClient>;
  }
>()("ApiClientService") {}

const ApiClientLive = Layer.succeed(ApiClientService)({
  make: (options) =>
    HttpApiClient.make(NightmaxxingApi, {
      baseUrl: options.baseUrl.replace(/\/$/, ""),
      ...(options.token === undefined
        ? {}
        : {
            transformClient: (client: HttpClient.HttpClient) =>
              client.pipe(
                HttpClient.mapRequest(
                  HttpClientRequest.setHeader("authorization", `Bearer ${options.token}`),
                ),
              ),
          }),
    }).pipe(Effect.provide(FetchHttpClient.layer)),
});

export { ApiClientLive, ApiClientService };

export type { NightmaxxingApiClient };
