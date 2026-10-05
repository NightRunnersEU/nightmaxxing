# @nightrunners/nightmaxxing

CLI for [nightmaxxing](https://maxxing.nrght.eu) — the social leaderboard
for LLM token usage. Parses your local agent usage (Claude Code, Codex,
OpenCode, Gemini CLI, Copilot CLI, Hermes, Pi, Oh My Pi, Grok Build CLI,
Antigravity, ZCode, Amp, Qwen Code, Kimi CLI, Kilo Code, Goose, Droid,
Codebuff, OpenClaw) via [ccusage](https://github.com/ryoppippi/ccusage) and
pushes daily aggregates to your public profile.

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
detected. Custom log roots (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `HERMES_HOME`,
the other agents' data-directory variables such as `OPENCODE_DATA_DIR`,
`GEMINI_DATA_DIR`, `COPILOT_HOME`, `PI_AGENT_DIR`, `GROK_HOME` or
`AMP_DATA_DIR`, and `XDG_DATA_HOME`/`XDG_CONFIG_HOME`) are captured at
`nightmaxxing service install` or `nightmaxxing service repair`; rerun one of
those after changing them. Without `HERMES_HOME`, Hermes usage includes every
named profile under `~/.hermes/profiles/`.
Use `nightmaxxing service status` for the last run and `nightmaxxing service
doctor` to inspect scheduler files, auth, auto-update, locks, and recent logs.
Each doctor check is `OK`, `INFO` (fine, but worth knowing: never synced yet, a
sync running right now), `WARN` (syncs still run, but something is off) or
`FAIL` (scheduled syncs can't happen); every `WARN` and `FAIL` line ends with
the command that fixes it. `service doctor` exits 1 when any check is `WARN` or
`FAIL` and 0 otherwise, so scripts and CI can gate on it. With `--json`, the
report's `health` is `ok`, `warn` or `fail` (`status` only says the doctor ran).

Run `sync` as often as you like, from as many machines as you like —
profiles aggregate across devices. Useful flags: `--dry-run`,
`--since YYYY-MM-DD`, `--sources claude,codex`, `--json`. `sync` exits
non-zero when no agent's usage could be collected; if only some agents fail,
it still uploads the rest and exits 0 with `"status": "partial"` in `--json`
output.

### What gets uploaded (privacy)

Daily aggregates only: date, model name, agent name, token counts, and the
API-equivalent cost — never prompts, file paths, project names, or session
content. Revoke access anytime with `nightmaxxing logout` or from
[settings](https://maxxing.nrght.eu/settings).

## License

MIT
