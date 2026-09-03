import * as prompts from "@clack/prompts";
import { Effect } from "effect";

import { ConsoleService } from "./services";

interface HumanOutputOptions {
  json?: boolean;
  silent?: boolean;
}

interface FormatUrlOptions {
  env?: Record<string, string | undefined>;
}

interface FormatHighlightOptions {
  env?: Record<string, string | undefined>;
}

interface FormatStatusMessageOptions {
  stripTerminalPunctuation?: boolean | undefined;
}

type HumanLogLevel = "error" | "info" | "step" | "success" | "warn";

interface HumanFailureContent {
  context?: readonly string[];
  hint?: string | undefined;
  message: string;
  primaryMessageRendered?: boolean | undefined;
}

interface HumanSpinner {
  error: (message?: string) => void;
  stop: (message?: string) => void;
}

interface HumanConfirmOptions<E> {
  cancelError: () => E;
  defaultValue: boolean;
}

const nightmaxxingSubcommands = new Set([
  "bootstrap",
  "login",
  "logout",
  "service",
  "sync",
  "upgrade",
  "whoami",
]);

const serviceSubcommands = new Set(["doctor", "install", "repair", "run", "status", "uninstall"]);
const nightmaxxingFlagsWithValues = new Set([
  "--completions",
  "--log-level",
  "--service",
  "--since",
  "--sources",
]);
const ansiControlCharacter = String.fromCharCode(27);
const trailingAnsiPattern = new RegExp(`(?:${ansiControlCharacter}\\[[0-9;]*m)+$`);

function writeJson(value: unknown) {
  return Effect.gen(function* () {
    const output = yield* Effect.service(ConsoleService);

    yield* Effect.sync(() => output.log(JSON.stringify(value)));
  });
}

function formatUrl(url: string, options: FormatUrlOptions = {}): string {
  const env = options.env ?? process.env;
  return Object.prototype.hasOwnProperty.call(env, "NO_COLOR") ? url : `\x1b[36;4m${url}\x1b[0m`;
}

function formatHighlight(value: string, options: FormatHighlightOptions = {}): string {
  const env = options.env ?? process.env;
  return Object.prototype.hasOwnProperty.call(env, "NO_COLOR") ? value : `\x1b[36m${value}\x1b[0m`;
}

function formatStatusMessage(message: string, options: FormatStatusMessageOptions = {}): string {
  if (options.stripTerminalPunctuation === false) {
    return message;
  }

  return message
    .split("\n")
    .map((line) => formatStatusLine(line))
    .join("\n");
}

function humanIntro(title: string, options: HumanOutputOptions = {}) {
  return Effect.gen(function* () {
    if (!shouldWriteHumanOutput(options)) {
      return;
    }

    const output = yield* Effect.service(ConsoleService);
    yield* Effect.sync(() => {
      if (shouldUseClack()) {
        prompts.intro(formatClackRow(title));
      } else {
        output.log(title);
      }
    });
  });
}

function humanOutro(message: string, options: HumanOutputOptions = {}) {
  return Effect.gen(function* () {
    if (!shouldWriteHumanOutput(options)) {
      return;
    }

    const output = yield* Effect.service(ConsoleService);
    yield* Effect.sync(() => {
      if (shouldUseClack()) {
        prompts.outro(formatClackRow(formatStatusMessage(message)));
      } else {
        output.log(formatStatusMessage(message));
      }
    });
  });
}

function humanFailure(failure: string | HumanFailureContent, options: HumanOutputOptions = {}) {
  return Effect.gen(function* () {
    if (!shouldWriteHumanOutput(options)) {
      return;
    }

    const output = yield* Effect.service(ConsoleService);
    yield* Effect.sync(() => {
      if (shouldUseClack()) {
        if (typeof failure === "string") {
          prompts.log.error(formatClackRow(formatStatusMessage(failure)));
        } else {
          if (failure.primaryMessageRendered !== true) {
            prompts.log.error(formatClackRow(formatStatusMessage(failure.message)));
          }
          for (const line of failure.context ?? []) {
            prompts.log.info(formatClackRow(formatStatusMessage(line)));
          }
          if (failure.hint !== undefined) {
            prompts.log.info(formatClackHintRow(failure.hint));
          }
        }
        prompts.outro("Failed");
      } else {
        output.error(
          typeof failure === "string" ? formatStatusMessage(failure) : plainFailureMessage(failure),
        );
      }
    });
  });
}

function humanFrame<A, E, R>(
  title: string,
  options: HumanOutputOptions,
  effect: Effect.Effect<A, E, R>,
) {
  return Effect.gen(function* () {
    if (!shouldWriteHumanOutput(options) || !shouldUseClack()) {
      return yield* effect;
    }

    yield* humanIntro(title, options);
    const result = yield* effect;
    yield* humanOutro("Done", options);

    return result;
  });
}

function humanLog(level: HumanLogLevel, message: string, options: HumanOutputOptions = {}) {
  return Effect.gen(function* () {
    if (!shouldWriteHumanOutput(options)) {
      return;
    }

    const output = yield* Effect.service(ConsoleService);
    yield* Effect.sync(() => {
      if (shouldUseClack()) {
        prompts.log[level](formatClackRow(formatStatusMessage(message)));
      } else if (level === "error") {
        output.error(formatStatusMessage(message));
      } else {
        output.log(formatStatusMessage(message));
      }
    });
  });
}

function humanSpinner(message: string, options: HumanOutputOptions = {}) {
  return Effect.gen(function* () {
    const output = yield* Effect.service(ConsoleService);
    if (!shouldWriteHumanOutput(options)) {
      return {
        error: () => {},
        stop: () => {},
      } satisfies HumanSpinner;
    }

    if (shouldUseClack()) {
      const spinner = prompts.spinner();
      spinner.start(formatClackRow(formatStatusMessage(message)));

      return {
        error: (nextMessage?: string) =>
          spinner.error(
            nextMessage === undefined
              ? nextMessage
              : formatClackRow(formatStatusMessage(nextMessage)),
          ),
        stop: (nextMessage?: string) =>
          spinner.stop(
            nextMessage === undefined
              ? nextMessage
              : formatClackRow(formatStatusMessage(nextMessage)),
          ),
      } satisfies HumanSpinner;
    }

    output.log(formatStatusMessage(message));

    return {
      error: (nextMessage?: string) => {
        if (nextMessage !== undefined) {
          output.error(formatStatusMessage(nextMessage));
        }
      },
      stop: (nextMessage?: string) => {
        if (nextMessage !== undefined) {
          output.log(formatStatusMessage(nextMessage));
        }
      },
    } satisfies HumanSpinner;
  });
}

function humanConfirm<E>(
  message: string,
  options: HumanOutputOptions,
  confirmOptions: HumanConfirmOptions<E>,
) {
  return Effect.gen(function* () {
    if (!shouldWriteHumanOutput(options)) {
      return confirmOptions.defaultValue;
    }

    const answer = yield* Effect.promise(() =>
      prompts.confirm({
        initialValue: confirmOptions.defaultValue,
        message: formatClackRow(message),
      }),
    );
    if (prompts.isCancel(answer)) {
      return yield* Effect.fail(confirmOptions.cancelError());
    }

    return answer;
  });
}

function shouldWriteHumanOutput(options: HumanOutputOptions = {}): boolean {
  return options.json !== true && options.silent !== true;
}

function shouldUseClack(): boolean {
  return (
    process.stdout.isTTY === true &&
    process.stderr.isTTY === true &&
    process.env.CI !== "true" &&
    process.env.TERM !== "dumb" &&
    !Object.prototype.hasOwnProperty.call(process.env, "NO_COLOR")
  );
}

function plainFailureMessage(failure: HumanFailureContent): string {
  const lines = [
    ...(failure.primaryMessageRendered === true ? [] : [failure.message]),
    ...(failure.context ?? []),
  ];
  if (failure.hint !== undefined) {
    lines.push(`hint: ${failure.hint}`);
  }

  return formatStatusMessage(lines.join("\n"));
}

function formatStatusLine(line: string): string {
  if (line.trim() === "" || hasInternalSentenceBreak(line)) {
    return line;
  }

  const trailingWhitespace = line.match(/\s+$/)?.[0] ?? "";
  const lineWithoutWhitespace =
    trailingWhitespace === "" ? line : line.slice(0, -trailingWhitespace.length);
  const trailingAnsi = lineWithoutWhitespace.match(trailingAnsiPattern)?.[0] ?? "";
  const body =
    trailingAnsi === ""
      ? lineWithoutWhitespace
      : lineWithoutWhitespace.slice(0, -trailingAnsi.length);

  if (!/[.!?]$/.test(body)) {
    return line;
  }

  return `${body.replace(/[.!?]+$/, "")}${trailingAnsi}${trailingWhitespace}`;
}

function hasInternalSentenceBreak(line: string): boolean {
  const visible = stripAnsi(line).replace(/[.!?]+\s*$/, "");
  return /[.!?]\s+\S/.test(visible);
}

function stripAnsi(value: string): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const ansiLength = ansiSequenceLengthAt(value, index);
    if (ansiLength > 0) {
      index += ansiLength;
      continue;
    }

    result += value[index] ?? "";
    index += 1;
  }

  return result;
}

function formatClackRow(message: string): string {
  return message
    .split("\n")
    .map((line) => capitalizeClackLine(line))
    .join("\n");
}

function formatClackHintRow(hint: string, options: FormatHighlightOptions = {}): string {
  return `Hint: ${formatClackRow(formatClackHintBody(formatStatusMessage(hint), options))}`;
}

function formatClackHintBody(hint: string, options: FormatHighlightOptions): string {
  const runCommandPattern = /\brun(\s+)nightmaxxing\b/g;
  let result = "";
  let cursor = 0;

  for (const match of hint.matchAll(runCommandPattern)) {
    const runIndex = match.index;
    const whitespace = match[1] ?? " ";
    const commandStart = runIndex + "run".length + whitespace.length;
    const commandLength = nightmaxxingCommandLength(hint.slice(commandStart));
    const command = hint.slice(commandStart, commandStart + commandLength);

    result += hint.slice(cursor, commandStart);
    result += formatHighlight(command, options);
    cursor = commandStart + commandLength;
  }

  result += hint.slice(cursor);
  return result;
}

function nightmaxxingCommandLength(input: string): number {
  const tokens = Array.from(input.matchAll(/[^\s,;.]+/g));
  const firstToken = tokens[0];
  if (firstToken === undefined || firstToken.index !== 0 || firstToken[0] !== "nightmaxxing") {
    return "nightmaxxing".length;
  }

  let lastIncludedIndex = 0;
  const command = tokens[1]?.[0];
  if (command !== undefined && nightmaxxingSubcommands.has(command)) {
    lastIncludedIndex = 1;
  }

  const serviceAction = tokens[2]?.[0];
  if (command === "service" && serviceSubcommands.has(serviceAction ?? "")) {
    lastIncludedIndex = 2;
  }

  let cursor = lastIncludedIndex + 1;
  while (tokens[cursor]?.[0].startsWith("-") === true) {
    const flag = tokens[cursor]?.[0] ?? "";
    lastIncludedIndex = cursor;
    cursor += 1;
    const nextToken = tokens[cursor]?.[0];
    if (
      nightmaxxingFlagsWithValues.has(flag) &&
      nextToken !== undefined &&
      !nextToken.startsWith("-")
    ) {
      lastIncludedIndex = cursor;
      cursor += 1;
    }
  }

  const lastToken = tokens[lastIncludedIndex];
  return (lastToken?.index ?? 0) + (lastToken?.[0].length ?? "nightmaxxing".length);
}

function capitalizeClackLine(line: string): string {
  const visibleStart = firstVisibleCharacterIndex(line);
  const rest = line.slice(visibleStart);
  if (shouldPreserveInitialToken(rest)) {
    return line;
  }

  const letterIndex = firstAlphabeticalCharacterIndex(line, visibleStart);
  if (letterIndex === -1) {
    return line;
  }

  const letter = line[letterIndex] ?? "";
  return `${line.slice(0, letterIndex)}${letter.toLocaleUpperCase("en-US")}${line.slice(
    letterIndex + 1,
  )}`;
}

function firstVisibleCharacterIndex(line: string): number {
  let index = 0;

  while (index < line.length) {
    const char = line[index];
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }

    const ansiLength = ansiSequenceLengthAt(line, index);
    if (ansiLength > 0) {
      index += ansiLength;
      continue;
    }

    break;
  }

  return index;
}

function ansiSequenceLengthAt(line: string, index: number): number {
  if (line.charCodeAt(index) !== 0x1b || line[index + 1] !== "[") {
    return 0;
  }

  let cursor = index + 2;
  while (cursor < line.length) {
    const code = line.charCodeAt(cursor);
    if (code >= 0x40 && code <= 0x7e) {
      return cursor - index + 1;
    }
    cursor += 1;
  }

  return 0;
}

function shouldPreserveInitialToken(rest: string): boolean {
  return (
    rest.startsWith("http://") ||
    rest.startsWith("https://") ||
    rest.startsWith("/") ||
    rest.startsWith("./") ||
    rest.startsWith("../") ||
    rest.startsWith("~/") ||
    rest.startsWith("@") ||
    rest.startsWith("-")
  );
}

function firstAlphabeticalCharacterIndex(line: string, start: number): number {
  let index = start;

  while (index < line.length) {
    const ansiLength = ansiSequenceLengthAt(line, index);
    if (ansiLength > 0) {
      index += ansiLength;
      continue;
    }

    if (/[a-z]/.test(line[index] ?? "")) {
      return index;
    }

    if (/[A-Z]/.test(line[index] ?? "")) {
      return -1;
    }

    index += 1;
  }

  return -1;
}

export {
  formatHighlight,
  formatClackHintRow,
  formatClackRow,
  formatStatusMessage,
  formatUrl,
  humanConfirm,
  humanFailure,
  humanFrame,
  humanLog,
  humanSpinner,
  shouldUseClack,
  writeJson,
};

export type {
  FormatHighlightOptions,
  FormatStatusMessageOptions,
  FormatUrlOptions,
  HumanConfirmOptions,
  HumanFailureContent,
  HumanOutputOptions,
  HumanSpinner,
};
