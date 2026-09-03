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

## Usage

```bash
nightmaxxing sync                         # Sync all local usage
nightmaxxing sync --dry-run               # Preview exactly what would be sent
nightmaxxing sync --since 2026-01-01      # Only sync usage on or after a date
nightmaxxing sync --sources claude,codex  # Only sync selected agents

nightmaxxing service install              # Sync automatically every 5 minutes
nightmaxxing service status               # Show service health and the last run
nightmaxxing service doctor               # Inspect auth, scheduler, locks, and logs

nightmaxxing whoami                        # Show the signed-in account
nightmaxxing upgrade                       # Upgrade the CLI and refresh the service
nightmaxxing logout                        # Revoke this device's CLI token
```

The background service supports macOS, Linux, and Windows. It uses the global
`nightmaxxing` binary and keeps itself current through the package manager that
installed the CLI when that package manager can be detected.

## Privacy

Only daily aggregates are uploaded: date, model name, agent name, token counts,
and API-equivalent cost. nightmaxxing never uploads prompts, file paths, project
names, code, or session content. Preview the exact payload anytime with
`nightmaxxing sync --dry-run`.

Profiles and leaderboard totals are public. Device hostnames are visible only
to you in settings and your per-device breakdown. CLI tokens do not expire
automatically; revoke one with `nightmaxxing logout` or from
[settings](https://maxxing.nrght.eu/settings).

## Support

Open an [issue](https://github.com/NightRunnersEU/nightmaxxing/issues) to contribute or report a
problem. If you like Nightmaxxing, please consider giving the project a star.

## License

This project is released under the [MIT License](LICENSE).
