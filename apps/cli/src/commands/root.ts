import { Command } from "effect/unstable/cli";

import packageJson from "../../package.json";
import { verboseGlobalFlag } from "../errors";
import { bootstrapCommand } from "./bootstrap";
import { loginCommand } from "./login";
import { logoutCommand } from "./logout";
import { serviceCommand } from "./service";
import { syncCommand } from "./sync";
import { upgradeCommand } from "./upgrade";
import { whoamiCommand } from "./whoami";

const nightmaxxingCommand = Command.make("nightmaxxing").pipe(
  Command.withDescription("Sync your LLM token usage to the Nightmaxxing leaderboard"),
  Command.withGlobalFlags([verboseGlobalFlag]),
  Command.withSubcommands([
    bootstrapCommand,
    loginCommand,
    logoutCommand,
    whoamiCommand,
    syncCommand,
    upgradeCommand,
    serviceCommand,
  ]),
);

const runNightmaxxingCommand = Command.runWith(nightmaxxingCommand, {
  version: packageJson.version,
});

export { runNightmaxxingCommand };
