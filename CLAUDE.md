# CLAUDE.md

Guidance for AI agents working in this repo.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Running the test suite

Astro 7 auto-detects an AI-agent shell and silently runs `astro dev`/`pnpm dev` as a detached background daemon instead of a normal foreground process. This breaks Playwright's `webServer` process tracking (`npm test` fails with `Error: Process from config.webServer exited early`), especially after a manual `astro dev` invocation left a daemon registered. If `npm test` fails with that error:

1. `npx astro dev stop` to clear any registered daemon.
2. Run tests with `ASTRO_DEV_BACKGROUND=1 npm test` — this env var (normally set by Astro itself on its background child) skips the agent auto-detection, so `astro dev` runs as a normal long-lived foreground process the way Playwright expects.
