# Test framework & accessibility tooling choice

No test framework exists yet, and this library's components depend on the native `<dialog>` element, the Popover API, and CSS anchor positioning — none of which jsdom supports (confirmed architectural gaps: [jsdom#3721](https://github.com/jsdom/jsdom/issues/3721), [jsdom#3294](https://github.com/jsdom/jsdom/issues/3294), and no layout engine at all for anchor positioning), so testing requires a real browser. Anchor positioning also has genuine cross-engine gaps (partial Firefox/Safari support), so the suite needs to catch cross-browser breakage, not just prove markup renders in one engine.

We chose **Playwright**, running against Chromium + Firefox + WebKit, over Vitest browser mode — the deciding factor is `@axe-core/playwright`, maintained by Deque (axe-core's own authors), versus Vitest browser mode's thinner community axe wrappers. Given accessibility is this project's top priority, we didn't trade tooling maturity there for a marginally better DX elsewhere.

axe-core wires in via a shared render/test fixture that runs an accessibility check by default on every component test (opt-out, not opt-in) — a new component fails its own tests immediately if inaccessible, rather than accessibility checks being something a contributor has to remember to add. No separate Node-only unit-test layer was added for `Tabs.astro`'s one pure-logic case (AST parsing); Playwright covers it by rendering and inspecting output. Test files are co-located next to each component (`Button.spec.ts` beside `Button.astro`) — copy-paste consumers grab the specific `.astro` file they want and aren't confused by a sibling spec file.

Installing Playwright/axe-core and wiring CI is follow-on execution work, out of this decision.

## Consequences

Running three browser engines costs more CI time than a Chromium-only suite. Accepted, because anchor positioning's cross-engine gaps are exactly the kind of bug a Chromium-only suite would hide.
