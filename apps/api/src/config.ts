import { Context, Effect } from "effect";
import * as Config from "effect/Config";
import * as Redacted from "effect/Redacted";

const productName = "Nightmaxxing";
const apiWorkerName = "nightmaxxing-api";

/** Where one environment lives; cookie attributes and redirect targets derive from it. */
interface Deployment {
  apiOrigin: string;
  cookieDomain: string;
  secure: boolean;
  wwwOrigin: string;
}

const deployments = {
  development: {
    apiOrigin: "http://api.nightmaxxing.localhost:8788",
    cookieDomain: ".nightmaxxing.localhost",
    secure: false,
    wwwOrigin: "http://nightmaxxing.localhost:3002",
  },
  production: {
    apiOrigin: "https://api.maxxing.nrght.eu",
    cookieDomain: ".maxxing.nrght.eu",
    secure: true,
    wwwOrigin: "https://maxxing.nrght.eu",
  },
} as const satisfies Record<"development" | "production", Deployment>;

/**
 * One deploy serves dev (api.nightmaxxing.localhost, http) and prod
 * (api.maxxing.nrght.eu, https); the request host picks which. The local dev
 * provider proxies with a rewritten Host (127.0.0.1:port), so any
 * loopback-ish host means dev. Browser trust (CORS, sign-out CSRF) is scoped
 * the same way: each deployment trusts only its own www.
 */
function deploymentForHost(host: string): Deployment {
  const hostname = host.split(":")[0] ?? host;
  const isDev =
    hostname.endsWith(".nightmaxxing.localhost") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  return isDev ? deployments.development : deployments.production;
}

/** An empty clientId means the provider is not configured for this deploy. */
interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

interface AppConfigShape {
  /** Users with a verified account email in this list can use the admin API. */
  adminEmails: readonly string[];
  apiWorkerName: string;
  github: OAuthClientConfig;
  google: OAuthClientConfig;
  productName: string;
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
    const adminEmails = yield* Config.String("ADMIN_EMAILS");
    const githubClientId = yield* Config.String("GITHUB_CLIENT_ID");
    const githubClientSecret = yield* Config.Redacted("GITHUB_CLIENT_SECRET");
    // Google sign-in is optional for Nightmaxxing: unset means not configured.
    const googleClientId = yield* Config.String("GOOGLE_CLIENT_ID").pipe(Config.withDefault(""));
    const googleClientSecret = yield* Config.Redacted("GOOGLE_CLIENT_SECRET").pipe(
      Config.withDefault(Redacted.make("")),
    );

    return AppConfig.of({
      adminEmails: parseAdminEmails(adminEmails),
      apiWorkerName,
      github: {
        clientId: githubClientId,
        clientSecret: Redacted.value(githubClientSecret),
      },
      google: {
        clientId: googleClientId,
        clientSecret: Redacted.value(googleClientSecret),
      },
      productName,
    });
  });
}

function parseAdminEmails(value: string): readonly string[] {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export { AppConfig, deploymentForHost, deployments };

export type { AppConfigShape, Deployment };
