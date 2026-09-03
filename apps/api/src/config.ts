import * as Config from "effect/Config";
import { Context } from "effect";
import { Effect } from "effect";
import * as Redacted from "effect/Redacted";

const productName = "Nightmaxxing";
const apiWorkerName = "nightmaxxing-api";

type NightmaxxingSandbox = "development" | "production";

interface RuntimeUrls {
  apiUrl: string;
  sandbox: NightmaxxingSandbox;
  wwwUrl: string;
}

const runtimeUrlTable = {
  development: {
    apiUrl: "http://api.nightmaxxing.localhost:8788",
    sandbox: "development",
    wwwUrl: "http://nightmaxxing.localhost:3002",
  },
  production: {
    apiUrl: "https://api.maxxing.nrght.eu",
    sandbox: "production",
    wwwUrl: "https://maxxing.nrght.eu",
  },
} as const satisfies Record<NightmaxxingSandbox, RuntimeUrls>;

interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
}

interface AppConfigShape {
  adminEmails: readonly string[];
  apiWorkerName: string;
  corsOrigins: string[];
  github: GitHubOAuthConfig;
  productName: string;
  urls: RuntimeUrls;
}

/**
 * The worker's complete configuration, resolved once per invocation in the
 * worker's OUTER Effect.gen — alchemy discovers the Config.* reads there and
 * binds them as deploy-time secrets — and provided as a plain Layer.succeed
 * everywhere else.
 */
class AppConfig extends Context.Service<AppConfig, AppConfigShape>()(
  "@nightmaxxing/api/AppConfig",
) {
  /** Secrets resolve from .env at deploy time and bind as secret_text. */
  static readonly fromEnv = Effect.gen(function* () {
    const adminEmails = yield* Config.string("ADMIN_EMAILS");
    const githubClientId = yield* Config.string("GITHUB_CLIENT_ID");
    const githubClientSecret = yield* Config.redacted("GITHUB_CLIENT_SECRET");

    return makeAppConfig(
      { adminEmails },
      {
        github: {
          clientId: githubClientId,
          clientSecret: Redacted.value(githubClientSecret),
        },
      },
    );
  });
}

interface AppConfigEnv {
  adminEmails?: string;
  NIGHTMAXXING_ENV?: string;
}

interface AppConfigSecrets {
  github: GitHubOAuthConfig;
}

function makeAppConfig(env: AppConfigEnv, secrets: AppConfigSecrets): AppConfigShape {
  const urls = resolveRuntimeUrls(env);

  return {
    adminEmails: parseAdminEmails(env.adminEmails),
    apiWorkerName,
    corsOrigins: corsOriginsFor(urls),
    productName,
    urls,
    ...secrets,
  };
}

function parseAdminEmails(value: string | undefined): readonly string[] {
  return value === undefined
    ? []
    : value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);
}

function corsOriginsFor(urls: RuntimeUrls): string[] {
  return [
    ...new Set([
      new URL(urls.wwwUrl).origin,
      // Local dev always passes browser CORS, regardless of resolved sandbox.
      new URL(runtimeUrlTable.development.wwwUrl).origin,
    ]),
  ];
}

function resolveRuntimeUrls(env: AppConfigEnv): RuntimeUrls {
  const sandbox: NightmaxxingSandbox =
    env.NIGHTMAXXING_ENV === "development" ? "development" : "production";

  return runtimeUrlTable[sandbox];
}

export { AppConfig };

export type { AppConfigShape, GitHubOAuthConfig };
