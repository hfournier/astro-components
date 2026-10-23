# CLAUDE.md

Guidance for AI agents working in this repo.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Material 3 reference

`docs/m3-documentation-links.md` lists every page on m3.material.io. Check it for the page that settles a design or implementation question. The pages render client-side, so read them with Playwright rather than a plain fetch, including image alt text, which often carries guidance the prose doesn't.

## Package manager

This repo uses `pnpm`. Use `pnpm <script>` (e.g. `pnpm test`, `pnpm dev`) and `pnpm dlx` in place of `npm run` / `npx`.

## Running the test suite

While working on a component, run `pnpm test:quick <spec path>`: Chromium only, with the axe scan. The full three-browser suite takes about 9 minutes (the quick run about 3) and runs in CI on every pull request (ADR-0019), so run it locally only before opening a PR that touches cross-browser behaviour (layout, anchor positioning, popovers, dialogs).

Astro 7 auto-detects an AI-agent shell and silently runs `astro dev`/`pnpm dev` as a detached background daemon instead of a normal foreground process. This breaks Playwright's `webServer` process tracking (`pnpm test` fails with `Error: Process from config.webServer exited early`), especially after a manual `astro dev` invocation left a daemon registered. If `pnpm test` fails with that error:

1. `pnpm dlx astro dev stop` to clear any registered daemon.
2. Run tests with `ASTRO_DEV_BACKGROUND=1 pnpm test` — this env var (normally set by Astro itself on its background child) skips the agent auto-detection, so `astro dev` runs as a normal long-lived foreground process the way Playwright expects.
