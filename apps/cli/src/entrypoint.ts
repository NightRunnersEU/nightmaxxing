import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";

import { runNightmaxxingCommand } from "./commands/root";
import { isJsonArgv, isVerboseArgv, renderCliFailure } from "./errors";
import { CliServicesLive } from "./services";

const rootArgvStarters = new Set([
  "bootstrap",
  "login",
  "logout",
  "service",
  "sync",
  "upgrade",
  "whoami",
]);

function defaultCliArgv(argv = process.argv) {
  const second = argv[1];
  if (second !== undefined && isCliArgvStarter(second)) {
    return argv.slice(1);
  }

  return argv.slice(2);
}

function isCliArgvStarter(value: string) {
  return value.startsWith("-") || rootArgvStarters.has(value);
}

function mainEffect(argv = defaultCliArgv()) {
  const normalizedArgv = normalizeRootVersionArgv(argv);

  return runNightmaxxingCommand(normalizedArgv).pipe(
    Effect.tapCause((cause) =>
      renderCliFailure(cause, {
        json: isJsonArgv(normalizedArgv),
        verbose: isVerboseArgv(normalizedArgv),
      }),
    ),
  );
}

function normalizeRootVersionArgv(argv: readonly string[]) {
  if (argv.length === 1 && argv[0] === "-v") {
    return ["--version"];
  }

  return argv;
}

function runCliMain() {
  NodeRuntime.runMain(
    mainEffect().pipe(Effect.provide(Layer.mergeAll(CliServicesLive, NodeServices.layer))),
    {
      disableErrorReporting: true,
    },
  );
}

export { defaultCliArgv, mainEffect, normalizeRootVersionArgv, runCliMain };
