# axe scan in Chromium only, full matrix in CI

> **Supersedes part of ADR-0002**: the shared fixture's axe scan now runs in the Chromium project only. Every test still gets a scan, opt-out rather than opt-in, and every test still runs in Chromium, Firefox and WebKit.

The full suite took about 15 minutes locally, which slowed development. Timing a quarter of it (Button, Menu and Tabs, 384 runs) showed where the time went:

| Run                              | Time |
| -------------------------------- | ---- |
| Three browsers, axe in each      | 221s |
| Three browsers, no axe           | 79s  |
| Chromium only, axe               | 49s  |
| Chromium only, no axe            | 14s  |

The scan after each test was about 65% of the time, and the three browsers each repeated it. Serving a built site instead of the dev server saved only about 15%, so the suite still runs against `astro dev`.

We decided:

1. **axe scans in Chromium only.** axe checks the DOM, ARIA and computed colors, and those come out the same in every engine, since the markup and CSS are the same. ADR-0002 runs three engines for anchor positioning's cross-engine gaps, which are layout bugs that behavioural tests catch and axe doesn't. Firefox and WebKit still run every test, only without the scan.
2. **A quick local run.** `pnpm test:quick` runs the Chromium project only, with its scans, and takes a spec path to narrow it further. It's the run to use while working on a component.
3. **The full matrix runs in CI.** A GitHub Actions workflow runs lint, the format check, the build and the full suite on every pull request, one job per browser, so the three-engine run no longer has to happen on the developer's machine.

## Consequences

The full suite (1575 runs) went from about 15 minutes to 8.7 locally, and the quick Chromium run takes 3.3 minutes.

An accessibility failure that shows up only in Firefox or WebKit would go unreported. That's unlikely for the rules axe applies. The main case it could miss is a CSS feature one engine doesn't support, leaving a fallback color with too little contrast.
