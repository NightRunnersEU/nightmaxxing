<div align="center">
  <h1><b><a href="https://github.com/NightRunnersEU/nightmaxxing">Nightmaxxing</a></b></h1>
  <p>
    A community fork for tracking coding-agent token usage.<br>
    A local CLI, built on ccusage, that syncs your token usage with everyone else.
  </p>
</div>

<div align="center">
  <a href="https://www.npmjs.com/package/@nightrunners/nightmaxxing">
    <img src="https://img.shields.io/npm/v/%40nightrunners%2Fnightmaxxing?label=npm&style=flat" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@nightrunners/nightmaxxing">
    <img src="https://img.shields.io/npm/dm/%40nightrunners%2Fnightmaxxing?label=downloads&style=flat" alt="npm downloads">
  </a>
  <a href="https://github.com/NightRunnersEU/nightmaxxing">
    <img src="https://img.shields.io/github/stars/NightRunnersEU/nightmaxxing?style=flat" alt="Nightmaxxing GitHub stars">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat" alt="MIT License">
  </a>
</div>

<br>

<div align="center">
  <a href="https://github.com/NightRunnersEU/nightmaxxing">
    <img src="docs/screenshots/profile.png" alt="nightmaxxing profile dashboard with usage stats and daily spend">
  </a>
</div>

## Fork notice

Nightmaxxing is a fork of [851-labs/tokenmaxxing](https://github.com/851-labs/tokenmaxxing),
the original project by 851 Labs. It keeps the upstream project's MIT license and builds on its
excellent local-usage aggregation work with [ccusage](https://ccusage.com/). Please give the
[original project](https://github.com/851-labs/tokenmaxxing) a star.

## Installation

```bash
npm install -g @nightrunners/nightmaxxing@latest
nightmaxxing bootstrap
```

`bootstrap` signs you in, syncs the usage already on your machine, optionally
installs automatic syncing, and opens your public profile.

## How it works

nightmaxxing uses [ccusage](https://ccusage.com/) to read local coding-agent
usage, turn it into daily token and API-equivalent spend totals, and sync those
aggregates to your public profile. The leaderboard lets you compare spend or
tokens over the last 7 days, 30 days, or all time.

Sync is idempotent and profiles aggregate across devices, so you can run
`nightmaxxing bootstrap` on every machine and sync as often as you like.

## Supported agents

- Claude Code
- OpenAI Codex
- OpenCode
- Gemini CLI
- GitHub Copilot CLI
- Hermes
- Pi
- Oh My Pi
- Grok Build CLI
- Antigravity
- ZCode
- Amp
- Qwen Code
- Kimi CLI
- Kilo Code
- Goose
- Droid
- Codebuff
- OpenClaw

Agents stored outside their default location are found through the same
environment variables ccusage reads (for example `CODEX_HOME`, `GROK_HOME`, or
`AMP_DATA_DIR`; see ccusage's
[environment variables](https://ccusage.com/guide/environment-variables)).

Oh My Pi is read with ccusage's Pi parser, pointed at OMP's own sessions:
`~/.omp/agent/sessions` and every named profile under `~/.omp/profiles/`,
following `PI_CONFIG_DIR` and an existing `$XDG_DATA_HOME/omp` like OMP does.
Pi and Oh My Pi never count each other's sessions: OMP ignores `PI_AGENT_DIR`,
and Pi skips any `PI_AGENT_DIR` entry that points at OMP's sessions.

## Usage

```bash
nightmaxxing sync                         # Sync all local usage
nightmaxxing sync --dry-run               # Preview exactly what would be sent
nightmaxxing sync --since 2026-01-01      # Only sync usage on or after a date
nightmaxxing sync --sources claude,codex  # Only sync selected agents

nightmaxxing service install              # Sync automatically every 5 minutes
nightmaxxing service status               # Show service health and the last run
nightmaxxing service doctor               # Check auth, scheduler, locks, and logs (exit 1 on a problem)

nightmaxxing whoami                        # Show the signed-in account
nightmaxxing stats                         # Your totals, streak, rank and this month
nightmaxxing upgrade                       # Upgrade the CLI and refresh the service
nightmaxxing logout                        # Revoke this device's CLI token
```

The background service supports macOS, Linux, and Windows. It uses the global
`nightmaxxing` binary and keeps itself current through the package manager that
installed the CLI when that package manager can be detected.

Custom agent log roots (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `OPENCODE_DATA_DIR`,
`GEMINI_DATA_DIR`, `COPILOT_HOME`, `COPILOT_OTEL_FILE_EXPORTER_PATH`,
`HERMES_HOME`, `PI_AGENT_DIR`, `GROK_HOME`, `ANTIGRAVITY_DATA_DIR`, `ZCODE_HOME`,
`AMP_DATA_DIR`, `QWEN_DATA_DIR`, `KIMI_DATA_DIR`, `KILO_DATA_DIR`,
`GOOSE_PATH_ROOT`, `DROID_SESSIONS_DIR`, `CODEBUFF_DATA_DIR`, `OPENCLAW_DIR`,
`PI_CONFIG_DIR`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`) are captured from
your shell when you run `nightmaxxing service install` or
`nightmaxxing service repair`; rerun one of those after changing them, and
`nightmaxxing service doctor` warns when they drift. Without `HERMES_HOME`, both
`sync` and the service read the default Hermes root plus every named profile
under `~/.hermes/profiles/`.

## Privacy

Only daily aggregates are uploaded: date, model name, agent name, token counts,
and API-equivalent cost. nightmaxxing never uploads prompts, file paths, project
names, code, or session content. Preview the exact payload anytime with
`nightmaxxing sync --dry-run`.

Profiles and leaderboard totals are public. Device hostnames are visible only
to you in settings and your per-device breakdown. CLI tokens do not expire
automatically; revoke one with `nightmaxxing logout` or from
[settings](https://maxxing.nrght.eu/settings).

## Development

Use Bun 1.4.2 and Node.js 24.18.0 (the CI runtime). Vite+ is installed locally;
no global CLI installation is required.

```bash
bun install --frozen-lockfile
bun run dev          # Start the Alchemy development environment
bun run check        # Check formatting, lint rules, and types
bun run test         # Run all test projects
bun run build        # Build workspaces in dependency order
bun run fmt:fix      # Format files
```

Shared formatting, linting, and test settings live in the root
`vite.config.ts`; the web app keeps its framework plugins in `apps/www/vite.config.ts`.
`bun run check` includes TypeScript diagnostics through `lint.options.typeCheck`.
Builds use Vite Task caching. Checks, tests, and database generation are uncached.
Run tests from the repository root. To run one project, use
`bun run vp test --project cli` (or `api`, `www`, `api-contract`, or `db`).
Use `bun run vp test watch --project cli` for watch mode.

Vite+ pins its bundled tools. Keep the `vite` catalog alias and override aligned
with the `vite-plus` version so framework plugins and Alchemy use the same Vite core.
The root Vitest 5 dependency satisfies Alchemy's `@effect/vitest` peer; our tests
import `vite-plus/test` and run on Vite+'s bundled Vitest version.

## Support

Open an [issue](https://github.com/NightRunnersEU/nightmaxxing/issues) to contribute or report a
problem. If you like Nightmaxxing, please consider giving the project a star.

## License

This project is released under the [MIT License](LICENSE).
