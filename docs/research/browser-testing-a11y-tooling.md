# Browser testing & accessibility tooling for `<dialog>`, Popover API, and CSS anchor positioning

**Date researched:** 2026-09-05
**Context:** This repo ships copy-paste Astro components that lean on native platform features rather than JS reimplementations — `BaseOverlay.astro` uses `<dialog>` plus CSS anchor positioning (`anchor-name` / `position-anchor` custom properties, `anchor()`), and `popover/Popover.astro` uses the Popover API (`popover` attribute). `Dialog.astro` / `DialogConfirm.astro` build on `BaseOverlay`. The repo currently has **no test framework at all**. This doc exists to ground a "test framework & a11y tooling choice" decision in primary sources rather than assumption, before any test infra is added.

The core question driving this: can these components be tested in a simulated DOM (jsdom, via Vitest's default environment), or do they require an actual browser engine — and if a real browser is required, which tool, and how does axe-core plug into it?

---

## 1. Does jsdom support Popover API, `<dialog>`, and CSS anchor positioning?

**Short answer: no, on all three, confirmed directly against jsdom's own repo — and yes, all three are shipped, non-experimental browser features, so the gap is real and one-directional (browser support is fine; jsdom is what's missing).**

### jsdom side (the tooling gap)

- **Popover API** — open feature request, unimplemented: [jsdom/jsdom#3721 "Implement popover attribute and related APIs"](https://github.com/jsdom/jsdom/issues/3721), opened May 22, 2024, **still open**. The issue's own repro shows `element.showPopover()` throwing / not working and `:popover-open` not matching in jsdom today. The issue explicitly calls out the same surface this repo touches: implicit `popovertarget` behavior, Escape-key handling, and light-dismiss.
- **`<dialog>` (`HTMLDialogElement.show()`/`showModal()`)** — open feature request, unimplemented: [jsdom/jsdom#3294 "Implement `HTMLDialogElement`"](https://github.com/jsdom/jsdom/issues/3294), opened November 23, 2021, **still open** (~4 years old, no maintainer resolution). `show()`/`showModal()` do not exist on jsdom's `HTMLDialogElement`; the common workaround people cite is manually stubbing `HTMLDialogElement.prototype.showModal`/`close` with `vi.fn()`, which only fakes the call and provides zero behavioral coverage (no `open` attribute toggling side effects, no `::backdrop`, no focus trapping, no top-layer semantics).
- **CSS anchor positioning** (`anchor-name`, `position-anchor`, `anchor()`) — no jsdom issue was found for this at all (searched jsdom's issue tracker directly; nothing filed). That absence is itself the more damning data point once you read jsdom's own scope statement: jsdom's README ([jsdom/jsdom README](https://github.com/jsdom/jsdom#readme)) states plainly that **layout is explicitly out of scope**: jsdom does not implement "the ability to calculate where elements will be visually laid out as a result of CSS," and provides only dummy/zeroed values for layout-dependent APIs like `getBoundingClientRect()`/`offsetTop`. Anchor positioning is a *layout* feature by definition (it computes an element's position relative to another element's box) — it doesn't fail because of a missing-feature bug, it fails because jsdom has no CSS layout engine at all. The README also states jsdom "does not have the capability to render visual content, and will act like a headless browser by default" — reinforcing that this isn't a near-term roadmap item, it's architectural.

Net: for this repo's components specifically, jsdom cannot exercise `showModal()`/`close()`/native `open` state, cannot exercise `showPopover()`/`hidePopover()`/`togglePopover()`/`:popover-open`, and cannot compute anchored positions at all. Anything beyond "does the initial server-rendered HTML have the right attributes" requires a real browser.

### Platform side (confirming these are real, current, non-experimental features — this isn't jsdom lagging an edge-case)

- **Popover API**: MDN marks it **["Baseline 2025 — Newly available": supported across the latest devices and browser versions since January 2025](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)**. This is a shipped, standardized feature, not a proposal.
- **`<dialog>` element**: long-standing, Baseline since 2022 per MDN ([`<dialog>` — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)); this is the most mature of the three.
- **CSS anchor positioning**: per [caniuse.com/css-anchor-positioning](https://caniuse.com/css-anchor-positioning) (checked live, September 2026): full support in current Chrome/Edge and Safari 27+, with Safari 26.x and Firefox in partial/behind-flag or recently-landed support and combined global usage in the mid-to-high 80s%. This is the least mature of the three platform features — worth knowing independent of the testing question, since it affects what a "passes in real Chromium" test actually proves about cross-browser behavior. Firefox shipping it is comparatively recent, so a Playwright run against only Chromium will validate the anchor-positioning code path but not full cross-engine behavior; Safari/WebKit and Firefox runs are where the partial-support caveats would surface. (Exact version numbers drift with caniuse's rolling data — re-check caniuse.com/css-anchor-positioning for the current figure rather than treating the numbers above as fixed.)

**Conclusion for sub-question 1:** The premise in the task ("these features are real-browser-only for testing purposes") is confirmed from both ends: jsdom has two open, unresolved, multi-year-old issues for `<dialog>` and Popover, and an architectural (not incidental) lack of CSS layout that rules out anchor positioning; meanwhile all three platform features are shipped/Baseline (or, for anchor positioning, shipped-but-uneven-across-engines), so there's no jsdom-catching-up-any-day-soon story here.

---

## 2. jsdom-based unit testing vs. real-browser testing for these components

### Vitest + jsdom (status quo option)
- Fast (in-process, no browser process spawn), zero CI browser-install burden, works with the existing Vite/Astro toolchain via `getViteConfig()` (see §4).
- **Cannot** exercise the actual open/close/anchor behavior described in §1 — at best it can assert on server-rendered markup (attributes present, class names, ARIA attributes in the initial HTML) or on mocked method calls (`vi.fn()` stand-ins for `showModal`/`showPopover`), which verifies "did our code call the right platform API" but not "does the platform API do the right thing when called," nor cross-cutting behavior like focus trapping, light-dismiss, Escape handling, or anchored positioning math.
- Bottom line: fine for pure-logic units (e.g., an ID-generation helper, a class-name builder), not adequate as the only test layer for `BaseOverlay`/`Dialog`/`Popover`.

### Playwright (playwright.dev)
- **Browser automation model**: drives real Chromium, Firefox, and WebKit via the Chrome DevTools Protocol / native protocols — actual browser engines, not simulation, so `<dialog>`, Popover, and anchor positioning all behave exactly as they would for a real user, across engines if you configure multiple projects (this directly answers the Firefox/WebKit partial-support caveat from §1 — Playwright is how you'd actually observe that gap rather than just read about it on caniuse).
- **"Component testing" caveat, checked directly against current docs**: Playwright's dedicated component-testing packages were framework-bound (React/Vue/Svelte/Solid) and are being wound down — the current [playwright.dev component testing page](https://playwright.dev/docs/test-components) states the experimental `@playwright/experimental-ct-react`, `-ct-react17`, and `-ct-vue` packages **"have been removed and are no longer published,"** with Playwright 1.59 (April 2026) having removed `@playwright/experimental-ct-svelte` too. The replacement direction is a framework-agnostic "gallery" pattern ("if your dev server can render it, Playwright can test it") with no explicit Astro support called out. **Practical implication for this repo**: Astro's components aren't a JS-framework component-testing target anyway — the natural fit is plain Playwright end-to-end testing, pointing `page.goto()` at pages served by an Astro dev/preview server (which is exactly the pattern Astro's own docs recommend — see §4), not the (deprecated) component-testing packages.
- **CI setup complexity**: one required step, `npx playwright install --with-deps`, which installs the pinned browser binaries plus OS-level dependencies; Playwright's own [CI docs](https://playwright.dev/docs/ci-intro) ship a ready-made GitHub Actions workflow (checkout → setup Node → `npm ci` → `npx playwright install --with-deps` → `npx playwright test` → upload HTML report artifact). This is a known, well-trodden path with first-party guidance, at the cost of a heavier CI job (browser download + install) than a pure-Node jsdom run.

### Vitest browser mode (`@vitest/browser`)
- **What it does differently from jsdom**: per [vitest.dev/guide/browser](https://vitest.dev/guide/browser/), Browser Mode runs your test file's code in an actual browser (via a Playwright, WebdriverIO, or preview provider) and drives interactions through the Chrome DevTools Protocol/WebDriver — "these tools [jsdom/happy-dom] only simulate a browser environment and not an actual browser, which may result in some discrepancies between the simulated environment and the real environment." So it gets you real `<dialog>`/Popover/anchor-positioning behavior while keeping the Vitest test-writing API/workflow.
- **Maturity — checked directly, this is the important update for a 2026 decision**: Browser Mode was long labeled experimental, but the official [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) (released October 22, 2025) states explicitly: **"With this release we are removing the `experimental` tag from Browser Mode."** As of the current docs it also ships `toMatchScreenshot` (visual regression) and Playwright trace capture (`test.browser.trace`) for debugging. So as of Vitest 4.x (current in Sept 2026), Browser Mode is a stable, first-class, non-experimental feature — this materially changes the "is it safe to depend on" calculus versus how this option would have looked even a year earlier.
- **Setup**: install `vitest` plus a provider package — `@vitest/browser-playwright` (recommended), `@vitest/browser-webdriverio`, or `@vitest/browser-preview` (dev-only) — and set `test.browser.enabled: true` plus at least one browser instance in `vitest.config.ts`. Because the Playwright provider is just Playwright under the hood, it inherits the same `npx playwright install` CI requirement as plain Playwright — so the CI browser-install cost is comparable, not avoided.
- **Astro-specific integration exists and is current**: [`vitest-browser-astro`](https://github.com/ascorbic/vitest-browser-astro) (by Matt Kane / `ascorbic`, an Astro core-team-adjacent maintainer) renders `.astro` component output server-side and injects the HTML into a real browser DOM via Vitest Browser Mode, explicitly supporting plain Astro components as well as ones wrapping React/Vue/Svelte islands (with a `waitForHydration()` helper for `client:*` directives). It requires Astro 5.x+, Vitest 4.x+, Vite 6.x+ — i.e., it's built against the current stack, not legacy. This is a close match for testing `BaseOverlay`/`Dialog`/`Popover` while staying inside the Vitest test-runner/reporter/watch-mode experience already implied by using Vitest for unit tests.

### Comparison summary

| | Vitest + jsdom | Playwright (E2E) | Vitest browser mode |
|---|---|---|---|
| Exercises real `<dialog>`/Popover/anchor behavior | No (confirmed gap, §1) | Yes | Yes |
| Setup burden | Lowest (already Vite-native) | Moderate (separate test runner + config) | Moderate (provider package + config; can reuse Vitest) |
| CI complexity | Lowest (no browser install) | `playwright install --with-deps` step, documented GH Actions template | Same browser-install cost as Playwright (uses Playwright provider) |
| Speed | Fastest | Slower (full browser + page navigation per test) | Slower than jsdom, comparable to Playwright per-test |
| Maturity/stability (2026) | Stable, long-established | Stable, long-established; component-testing sub-feature is the one still churning/being removed | Stable as of Vitest 4.0 (Oct 2025) — experimental tag dropped |
| Cross-engine coverage | N/A | Chromium/Firefox/WebKit via `projects` | Chromium/Firefox/WebKit via provider config |
| a11y tooling | Awkward (jsdom lacks real rendering axe needs, see §3) | First-party (`@axe-core/playwright`) | Direct axe-core works (real DOM); community matcher wrappers less mature (see §3) |

---

## 3. How does axe-core integrate with each viable option?

### axe-core + Playwright: `@axe-core/playwright`
- Official Deque package: [`@axe-core/playwright` on npm](https://www.npmjs.com/package/@axe-core/playwright) / [source](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright), maintained by Deque Systems (axe-core's own authors) — this is the most first-party option of anything in this doc.
- API shape is a chainable `AxeBuilder`:
  ```js
  const { AxeBuilder } = require('@axe-core/playwright');
  const results = await new AxeBuilder({ page }).analyze();
  ```
  `.include('.selector')` / `.exclude(...)` scope the scan to a subset of the page (useful for scanning just the open dialog/popover subtree rather than the whole document), and `.analyze()` runs axe-core against the page in its current rendered state — meaning you can open the dialog/popover first (`await page.getByRole('button', {name: 'Open'}).click()`), then run the scan against the post-open DOM, which is exactly the state that matters for these components (their a11y-relevant state, e.g. focus containment/backdrop, only exists once opened).
- Playwright's own docs also cover this pattern directly: [playwright.dev/docs/accessibility-testing](https://playwright.dev/docs/accessibility-testing).

### axe-core + Vitest browser mode
- Because Browser Mode runs in a real browser, axe-core's own `axe.run()` works directly against the live DOM — there's no jsdom-shaped obstacle here, unlike jsdom where axe-core would be auditing an unrendered/no-layout tree.
- Community wrapper landscape (checked npm directly, since "current and maintained" was explicitly asked):
  - [`vitest-axe`](https://www.npmjs.com/package/vitest-axe) (chaance/vitest-axe, forked from `jest-axe`) — latest release **0.1.0, published ~4 years ago**; per its own README it has a known incompatibility with `happy-dom` (`Node.prototype.isConnected` bug) and no explicit statement of Browser Mode support one way or the other. Treat as effectively unmaintained for a 2026 decision.
  - [`@chialab/vitest-axe`](https://www.npmjs.com/package/@chialab/vitest-axe) — a more recently published fork/alternative (last publish reported within the last ~6 months as of this research), providing the same `expect(await axe(element)).toHaveNoViolations()` matcher pattern, installed alongside `axe-core` directly (`npm i -D axe-core @chialab/vitest-axe`).
  - Given the thinness of the matcher-wrapper ecosystem, the more robust option for Vitest browser mode is arguably to **skip the wrapper and call `axe-core`'s own `run()` directly** inside a Browser Mode test, asserting on `results.violations.length === 0` (or filtering to serious/critical impact) — same idea as `@axe-core/playwright`'s `AxeBuilder`, just without a maintained first-party adapter package the way Playwright has one. This removes a dependency on a small, thinly-maintained community package for a fairly small amount of boilerplate.

**Conclusion for sub-question 3:** Playwright has an unambiguous, first-party, actively-maintained a11y story (`@axe-core/playwright`, published by axe-core's own maintainers). Vitest browser mode can get equivalent a11y coverage since it's a real browser, but there is no equally first-party wrapper — the ecosystage's dedicated matcher packages are either stale (`vitest-axe`) or a smaller third-party fork (`@chialab/vitest-axe`); direct `axe-core` usage sidesteps that maturity gap entirely.

---

## 4. Astro's first-party testing guidance

Astro's own docs, [docs.astro.build/en/guides/testing/](https://docs.astro.build/en/guides/testing/), checked directly:

- **Unit testing**: recommends **Vitest** ("A Vite-native unit test framework with ESM, TypeScript and JSX support powered by esbuild"), configured via Astro's own `getViteConfig()` helper inside `vitest.config.ts` so Vitest picks up the project's Vite/Astro config. Jest, Mocha, and Jasmine are mentioned as alternatives, without the same first-party integration helper.
- **Container API** (for testing `.astro` component output directly, without a running server): [docs.astro.build/en/reference/container-reference/](https://docs.astro.build/en/reference/container-reference/) — explicitly marked **experimental** ("This API is experimental and subject to breaking changes, even in minor or patch releases," added in Astro 4.9.0) and **explicitly scoped to server-side rendering only**: it's for testing `.astro` component *output* (HTML string or `Response`) in Vite-based environments like Vitest. The reference makes no mention of executing client-side JavaScript, hydrating islands, or otherwise producing an interactive DOM — i.e., it is a templating/markup-output test, not a behavior test. **This directly matters for this repo**: the Container API could assert that `Dialog.astro` renders the right `id`, `popover`/`command`/`commandfor` attributes, and anchor-name custom property into markup, but it structurally cannot open the dialog, toggle the popover, or evaluate anchor positioning, because none of that is server-rendered behavior. It's a complement to, not a substitute for, real-browser testing of these three features.
- **End-to-end testing**: the docs cover **Playwright**, **Cypress**, and **NightwatchJS**, each run against a dev/preview server URL (not a special component-testing integration) — Playwright's entry notes support for "Chromium, WebKit, and Firefox" and shows configuring a `webServer` to boot the Astro dev/preview server automatically before tests run. This matches the "plain Playwright E2E, not component-testing packages" conclusion reached independently in §2.
- No Astro-first-party guidance calls out `<dialog>`, Popover, or anchor positioning specifically, nor axe-core — those are left to whichever E2E/browser tool you choose, consistent with everything above.

---

## Recommendation / Shortlist

Given: (a) jsdom cannot exercise any of the three platform features this repo's overlay components depend on (§1, confirmed via jsdom's own open issues + architectural README statement), (b) Astro's own docs steer E2E work toward Playwright/Cypress/Nightwatch against a real server rather than component-testing packages, and (c) axe-core's most first-party, actively-maintained integration is Playwright-specific:

**1. Playwright + `@axe-core/playwright` — recommended pragmatic default for this repo.**
Rationale: exercises real `<dialog>`/Popover/anchor-positioning behavior in actual Chromium/Firefox/WebKit; has the most first-party a11y integration of any option surveyed (built by Deque, axe-core's own authors); matches Astro's own documented E2E guidance almost exactly (`webServer` config against `astro dev`/`astro preview`); CI path is a well-trodden, officially-documented GitHub Actions template (`playwright install --with-deps`). Trade-off: heavier CI job than pure-Node tests (browser download+install), and it's a second test runner alongside whatever unit-tests you eventually add — but for a component library whose entire value proposition is "these native-platform behaviors work correctly," that's the layer that actually has to exist regardless of what else you pick.

**2. Vitest browser mode + `vitest-browser-astro` + direct `axe-core` — viable, more unified DX, slightly less first-party a11y tooling.**
Rationale: now stable (experimental tag dropped in Vitest 4.0, Oct 2025), keeps everything — unit tests and real-browser overlay/a11y tests — inside one Vitest config/runner/watch-mode/reporter, and `vitest-browser-astro` is a current, actively-built adapter specifically for rendering `.astro` output into a real browser DOM (including hydrated islands, which this repo's Astro-only components don't need but is a nice ceiling if that changes). Trade-off: same Playwright-provider CI install cost as option 1 with less ecosystem maturity around it (fewer examples, a thinner/staler axe matcher-wrapper landscape meaning you'd hand-roll the axe assertion rather than import a first-party helper), and it's a newer combination (`vitest-browser-astro` is a small, single-maintainer project) versus Playwright's long track record.

**3. Hybrid — Vitest + jsdom for pure logic, Playwright + `@axe-core/playwright` for overlay/a11y behavior.**
Rationale: this is likely where most repos land in practice once they have enough surface area to want it — jsdom/Vitest for anything that's pure JS logic with no platform-feature dependency (id generation, class-name merging helpers, prop validation), Playwright for anything touching `<dialog>`/Popover/anchor positioning or accessibility semantics. Trade-off: two test runners/configs to maintain, which is arguably overhead this repo (small, no test framework yet) doesn't need on day one — **if starting from zero, going straight to option 1 (skip jsdom entirely) is simpler and covers everything this component library actually needs to assert, since virtually all of its components are thin wrappers around native platform behavior rather than complex pure-JS logic.**

**Bottom line for a small OSS component library with no existing test infra:** start with **Playwright + `@axe-core/playwright`** (option 1). Revisit Vitest browser mode later only if/when a real need emerges to unify with a growing suite of pure-logic unit tests under one runner — the tooling (Vitest 4, `vitest-browser-astro`) is credible enough by 2026 to not be a risky bet, it's just less proven specifically for this repo's shape of problem than Playwright's much longer track record and Astro's own documented preference.

---

## References

- jsdom Popover API issue: https://github.com/jsdom/jsdom/issues/3721
- jsdom `HTMLDialogElement` issue: https://github.com/jsdom/jsdom/issues/3294
- jsdom README (scope/unimplemented features): https://github.com/jsdom/jsdom#readme
- MDN Popover API (Baseline status): https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
- MDN `<dialog>` element: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- caniuse: CSS anchor positioning: https://caniuse.com/css-anchor-positioning
- Playwright CI docs: https://playwright.dev/docs/ci-intro
- Playwright component testing (current, deprecation note): https://playwright.dev/docs/test-components
- Playwright accessibility testing: https://playwright.dev/docs/accessibility-testing
- `@axe-core/playwright` (npm): https://www.npmjs.com/package/@axe-core/playwright
- `@axe-core/playwright` (source/README): https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md
- Vitest Browser Mode guide: https://vitest.dev/guide/browser/
- Vitest 4.0 announcement (Browser Mode stabilized): https://vitest.dev/blog/vitest-4
- `vitest-browser-astro`: https://github.com/ascorbic/vitest-browser-astro
- `vitest-axe`: https://www.npmjs.com/package/vitest-axe and https://github.com/chaance/vitest-axe
- `@chialab/vitest-axe`: https://www.npmjs.com/package/@chialab/vitest-axe
- Astro Testing guide: https://docs.astro.build/en/guides/testing/
- Astro Container API reference (experimental status): https://docs.astro.build/en/reference/container-reference/
