import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Context, Data, Effect, Layer } from "effect";

/**
 * Local CLI state at ~/.config/nightmaxxing/config.json (override with
 * NIGHTMAXXING_CONFIG_DIR; NIGHTMAXXING_API_TOKEN wins over the stored
 * token for CI). `deviceId` is generated once at first login and survives
 * logout — it is the idempotency key for every usage row this machine has
 * ever pushed.
 */

interface CliConfig {
  apiUrl: string;
  deviceId?: string;
  token?: string;
  wwwUrl: string;
}

interface StoredCliConfig {
  config: CliConfig;
  exists: boolean;
  path: string;
}

interface ClearTokenResult {
  config: CliConfig;
  token?: string;
  tokenCleared: boolean;
}

class ConfigReadError extends Data.TaggedError("ConfigReadError")<{
  readonly cause: unknown;
  readonly path: string;
}> {
  override get message() {
    return `error: failed to read CLI config: ${this.path}\nhint: check NIGHTMAXXING_CONFIG_DIR`;
  }
}

class ConfigWriteError extends Data.TaggedError("ConfigWriteError")<{
  readonly cause: unknown;
  readonly path: string;
}> {
  override get message() {
    return `error: failed to write CLI config: ${this.path}\nhint: check NIGHTMAXXING_CONFIG_DIR permissions`;
  }
}

type ConfigError = ConfigReadError | ConfigWriteError;

type NightmaxxingEnvironment = "development" | "production";

const runtimeConfigTable: Record<NightmaxxingEnvironment, { apiUrl: string; wwwUrl: string }> = {
  development: {
    apiUrl: "http://api.nightmaxxing.localhost:8788",
    wwwUrl: "http://nightmaxxing.localhost:3002",
  },
  production: {
    apiUrl: "https://api.maxxing.nrght.eu",
    wwwUrl: "https://maxxing.nrght.eu",
  },
};

const upstreamProductionUrls = {
  apiUrl: new Set(["https://api.tokenmaxxing.851.sh", "https://api.tokenmaxxing.sh"]),
  wwwUrl: new Set(["https://tokenmaxxing.851.sh", "https://tokenmaxxing.sh"]),
};

function getEnvironment(
  env: Record<string, string | undefined> = process.env,
): NightmaxxingEnvironment {
  return env["NIGHTMAXXING_ENV"] === "development" ? "development" : "production";
}

const localDevelopmentConfigDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  ".tmp",
  "nightmaxxing-cli",
);

function getConfigPath(env: Record<string, string | undefined> = process.env): string {
  const configDir =
    getEnvironment(env) === "development"
      ? localDevelopmentConfigDir
      : (env["NIGHTMAXXING_CONFIG_DIR"] ?? join(homedir(), ".config", "nightmaxxing"));

  return join(configDir, "config.json");
}

function defaultConfig(env: Record<string, string | undefined>): CliConfig {
  const runtimeConfig = runtimeConfigTable[getEnvironment(env)];

  return {
    apiUrl: runtimeConfig.apiUrl,
    wwwUrl: runtimeConfig.wwwUrl,
  };
}

function applyEnvOverrides(config: CliConfig, env: Record<string, string | undefined>): CliConfig {
  const environment = getEnvironment(env);
  const runtimeConfig = runtimeConfigTable[environment];

  return {
    ...config,
    apiUrl:
      env["NIGHTMAXXING_API_URL"] ??
      (environment === "development" ? runtimeConfig.apiUrl : config.apiUrl),
    wwwUrl:
      env["NIGHTMAXXING_WWW_URL"] ??
      (environment === "development" ? runtimeConfig.wwwUrl : config.wwwUrl),
    token: env["NIGHTMAXXING_API_TOKEN"] ?? config.token,
  };
}

function normalizeConfig(config: Partial<CliConfig>, fallback: CliConfig): CliConfig {
  return {
    ...config,
    apiUrl: normalizeStoredUrl("apiUrl", config.apiUrl ?? fallback.apiUrl),
    wwwUrl: normalizeStoredUrl("wwwUrl", config.wwwUrl ?? fallback.wwwUrl),
  };
}

function normalizeStoredUrl(key: "apiUrl" | "wwwUrl", value: string): string {
  return upstreamProductionUrls[key].has(value) ? runtimeConfigTable.production[key] : value;
}

function readConfigFileProgram(
  path: string,
  fallback: CliConfig,
): Effect.Effect<StoredCliConfig, ConfigReadError> {
  return Effect.tryPromise({
    try: async () => JSON.parse(await readFile(path, "utf8")) as Partial<CliConfig>,
    catch: (cause) => cause,
  }).pipe(
    Effect.map((config) => ({
      config: normalizeConfig(config, fallback),
      exists: true,
      path,
    })),
    Effect.catch((cause) => {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
        return Effect.succeed({
          config: fallback,
          exists: false,
          path,
        });
      }

      return Effect.fail(new ConfigReadError({ cause, path }));
    }),
  );
}

function readConfigProgram(
  path = getConfigPath(),
  env: Record<string, string | undefined> = process.env,
): Effect.Effect<CliConfig, ConfigReadError> {
  return readConfigFileProgram(path, defaultConfig(env)).pipe(
    Effect.map((stored) => applyEnvOverrides(stored.config, env)),
  );
}

function writeConfigProgram(
  config: CliConfig,
  path = getConfigPath(),
): Effect.Effect<void, ConfigWriteError> {
  return Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), {
        recursive: true,
      });
      await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
    },
    catch: (cause) => new ConfigWriteError({ cause, path }),
  });
}

/** Returns the stable device id, minting and persisting one on first use. */
function ensureDeviceIdProgram(
  path = getConfigPath(),
  env: Record<string, string | undefined> = process.env,
): Effect.Effect<string, ConfigError> {
  return Effect.gen(function* () {
    const { config } = yield* readConfigFileProgram(path, defaultConfig(env));
    if (config.deviceId !== undefined) {
      return config.deviceId;
    }

    const deviceId = crypto.randomUUID();
    yield* writeConfigProgram({ ...config, deviceId }, path);

    return deviceId;
  });
}

function writeTokenProgram(
  token: string,
  path = getConfigPath(),
  env: Record<string, string | undefined> = process.env,
): Effect.Effect<CliConfig, ConfigError> {
  return Effect.gen(function* () {
    const { config } = yield* readConfigFileProgram(path, defaultConfig(env));
    const nextConfig = {
      ...config,
      token,
    };

    yield* writeConfigProgram(nextConfig, path);

    return nextConfig;
  });
}

/** Drops the token but keeps deviceId — logout must not orphan history. */
function clearTokenProgram(
  path = getConfigPath(),
  env: Record<string, string | undefined> = process.env,
): Effect.Effect<ClearTokenResult, ConfigError> {
  return Effect.gen(function* () {
    const stored = yield* readConfigFileProgram(path, defaultConfig(env));
    const { token, ...nextConfig } = stored.config;

    if (!stored.exists || !token) {
      return {
        config: nextConfig,
        token,
        tokenCleared: false,
      };
    }

    yield* writeConfigProgram(nextConfig, path);

    return {
      config: nextConfig,
      token,
      tokenCleared: true,
    };
  });
}

function hasEnvTokenProgram(
  env: Record<string, string | undefined> = process.env,
): Effect.Effect<boolean> {
  return Effect.succeed(Boolean(env["NIGHTMAXXING_API_TOKEN"]));
}

class ConfigService extends Context.Service<
  ConfigService,
  {
    readonly clearToken: typeof clearTokenProgram;
    readonly ensureDeviceId: typeof ensureDeviceIdProgram;
    readonly hasEnvToken: typeof hasEnvTokenProgram;
    readonly readConfig: typeof readConfigProgram;
    readonly writeToken: typeof writeTokenProgram;
  }
>()("ConfigService") {}

const ConfigLive = Layer.succeed(ConfigService)({
  clearToken: clearTokenProgram,
  ensureDeviceId: ensureDeviceIdProgram,
  hasEnvToken: hasEnvTokenProgram,
  readConfig: readConfigProgram,
  writeToken: writeTokenProgram,
});

export {
  ConfigLive,
  ConfigReadError,
  ConfigService,
  ConfigWriteError,
  getConfigPath,
  readConfigProgram,
};

export type { CliConfig, ConfigError };
