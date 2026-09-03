import { Layer } from "effect";

import { ApiClientLive } from "./api-client";
import { BrowserLive } from "./browser";
import { ClockLive } from "./clock";
import { ConfigLive } from "./config";
import { ConsoleLive } from "./console";
import { TerminalLive } from "./terminal";

export { ApiClientService, type NightmaxxingApiClient } from "./api-client";
export { BrowserOpenError, BrowserService } from "./browser";
export { ClockService } from "./clock";
export { ConfigService, type CliConfig } from "./config";
export { ConsoleService } from "./console";
export { TerminalService } from "./terminal";

const CliServicesLive = Layer.mergeAll(
  ApiClientLive,
  BrowserLive,
  ClockLive,
  ConfigLive,
  ConsoleLive,
  TerminalLive,
);

export { CliServicesLive };
