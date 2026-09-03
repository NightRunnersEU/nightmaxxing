# @nightrunners/nightmaxxing

CLI for [nightmaxxing](https://maxxing.nrght.eu) — the social leaderboard
for LLM token usage. Parses your local agent usage (Claude Code, Codex,
OpenCode, Gemini CLI, Copilot CLI, Hermes, Pi) via
[ccusage](https://github.com/ryoppippi/ccusage) and pushes daily aggregates
to your public profile.

## Usage

```bash
npm install -g @nightrunners/nightmaxxing@latest
nightmaxxing login              # sign in in the browser, approves this device
nightmaxxing sync               # parse local usage and push it
nightmaxxing service install    # optional: sync automatically every 5 minutes
nightmaxxing upgrade            # upgrade the global CLI and refresh the service
```

You can also install globally with `bun add -g --trust @nightrunners/nightmaxxing@latest`,
`pnpm add -g @nightrunners/nightmaxxing@latest`, or
`yarn global add @nightrunners/nightmaxxing@latest`.

The background service uses the global `nightmaxxing` binary and syncs every
5 minutes. It auto-updates through the package manager that installed the
global binary (bun, npm, pnpm, or yarn) when that package manager can be
detected.
Use `nightmaxxing service status` for the last run and `nightmaxxing service
doctor` to inspect scheduler files, auth, auto-update, locks, and recent logs.

Run `sync` as often as you like, from as many machines as you like —
profiles aggregate across devices. Useful flags: `--dry-run`,
`--since YYYY-MM-DD`, `--sources claude,codex`, `--json`.

### What gets uploaded (privacy)

Daily aggregates only: date, model name, agent name, token counts, and the
API-equivalent cost — never prompts, file paths, project names, or session
content. Revoke access anytime with `nightmaxxing logout` or from
[settings](https://maxxing.nrght.eu/settings).

## License

MIT
