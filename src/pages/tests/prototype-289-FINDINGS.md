# PROTOTYPE #289: findings (throwaway branch `prototype/289-anchor-sizing`)

**Question:** can anchor positioning alone size Menu's and FabMenu's lists, replacing the
`getBoundingClientRect` fits and their scroll and resize listeners?

**Verdict:** not yet, for either half. Each fails in at least one engine. Keep both scripts.

- **Menu:** fails in WebKit (ignores `position-try-order` once the height is clamped), in Firefox
  (nothing clamps the height) and in Chromium (stops fitting once the page scrolls).
- **FabMenu:** works in all three engines only for a FAB fixed to the window, and only with a
  different technique from the one in the issue. A FAB that scrolls with the page breaks in
  Firefox (misplaced) and Chromium (stops fitting once the page scrolls).

## Setup

- Page: `src/pages/tests/prototype-289-anchor-sizing.astro`. Plain CSS, no components, driven by URL
  params, with a live readout panel.
- Measuring script: `src/pages/tests/prototype-289.spec.ts`. It asserts nothing and writes
  `prototype-289-results-<browser>.json`.
- Window 1280×720. The page is scrolled to 1000px before the list opens, unless `scroll=0`. The
  trigger is 40px tall, the items 48px each, with 3 or 30 items.
- Engines: Playwright 1.64.1 builds of Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2, on
  Windows 11 ARM.
- Run: `ASTRO_DEV_BACKGROUND=1 pnpm exec playwright test src/pages/tests/prototype-289.spec.ts --reporter=list`
- Open by hand: `/tests/prototype-289-anchor-sizing?case=menu&y=620&items=30&size=stretch&order=most`

## Finding 1: `align-self` alone doesn't clamp the box

Without a max-height, the box keeps its content height (1442px for 30 items) and overflows the
window in all three engines. The UA popover style is `height: fit-content`, and in the block axis
fit-content is just the content height. The issue assumed a "fit-content box clamped to the
inset-modified containing block", and no engine does that. The box needs an explicit clamp:
`max-height: stretch`, which resolves against the inset-modified containing block.

| | `max-height: stretch` | Clamps to the inset-modified containing block |
|---|---|---|
| Chromium 156 | computes `stretch` | yes |
| WebKit 27.2 | computes `stretch` | yes |
| Firefox 157 | computes `none`. `-moz-available` is accepted but still doesn't clamp | **no** |

## Finding 2: Menu with `position-try-order: most-block-size` and a clamped height

The CSS under test: `top: calc(anchor(bottom) + 4px)`, `bottom: 0`, `margin-bottom: 48px`,
`align-self: start`, `max-height: stretch`, `position-try-fallbacks: flip-block` and
`position-try-order: most-block-size`. Each cell gives the side the menu opened on and its
top–bottom edges, in px from the top of the window.

| Case: 30 items, the trigger's top at | Chromium | Firefox | WebKit |
|---|---|---|---|
| 40px (near the top) | below, 84–672 ✓ | covers the trigger, −1000–442 ✗ | below, 84–672 ✓ |
| 620px (near the bottom) | **above, 48–616 ✓** | above, −1000–442 ✗ | **below, 664–672 (8px tall) ✗** |
| 620px, page not scrolled | above, 48–616 ✓ | no clamp, 0–1442 ✗ | below, 664–672 ✗ |
| Opened at 620px, then the page scrolls 560px | stays above at −512–56: not refit, off the top ✗ | ✗ | below, 104–672 ✓ |
| Opened at 60px, then the page scrolls −560px | stays at 664–1232: not refit, off the bottom ✗ | ✗ | below, 664–672: stays put, now 8px tall ✗ |

- **WebKit** ignores `position-try-order` once the clamped box no longer overflows. It keeps the
  base position, so a menu near the bottom opens as an 8px sliver. Chromium sorts the base position
  in with the fallbacks, and WebKit doesn't. That's the ambiguity the issue flagged, and it decides
  the Menu half against.
- **Chromium** fits the menu as it opens. When the page scrolls with the menu open, Chromium moves
  the box (scroll compensation) without resizing it or trying another position.
- **Firefox** has no clamp (finding 1), and in a scrolled page it places the box against the
  unscrolled page (finding 4).
- Even where it works, `most-block-size` changes the behaviour. It always picks the roomier side,
  where Menu today opens below whenever the menu fits there.

## Finding 3: FabMenu

The issue's CSS (`top: 0`, `bottom: anchor(top)`, `align-self: end`, plus `max-height: stretch`)
clamps correctly in Chromium and WebKit, and not in Firefox (finding 1).

A variant that needs no sizing keyword, `size=fill`: FabMenu's list has no surface of its own, so
the box can fill the whole inset-modified containing block (`height: auto` and
`align-self: stretch` with both insets set). `margin-top: auto` on the first item then pushes the
items down to the FAB. Unlike `justify-content: end`, this still scrolls.

| `fill` case: 30 items | Chromium | Firefox | WebKit |
|---|---|---|---|
| Fixed FAB, its top at 600, 150 or 30px | 0–600, 0–150, 0–30 ✓ | 0–600, 0–150, 0–30 ✓ | 0–600, 0–150, 0–30 ✓ |
| FAB that scrolls with the page, top at 600px | 0–600 ✓ | **0–1600 ✗** | 0–600 ✓ |
| The same, then the page scrolls 300px | −300–300: moved, not resized ✗ | 0–1600 ✗ | 0–300 ✓ |
| FAB top at 300px, then the page scrolls −250px | 250–550: not resized ✗ | 0–1300 ✗ | 0–550 ✓ |

- **Fixed FAB:** correct in all three engines, with CSS only. This is the one case that works
  everywhere.
- **Firefox**, for an anchor in a scrolled page, resolves `anchor()` against the unscrolled page.
  The bottom inset comes out 1000px (the scroll offset) too low. That's the shift the comment in
  `FabMenu.astro` already describes, and it's still there in Firefox 157.
- **Chromium** has the same scroll-compensation gap as for Menu: the box moves with the page but
  isn't resized, so the top of the list runs off the window.
- **`min-height: 5rem`** (today's room for one item) makes the list cover a FAB near the top in
  Chromium and WebKit: 0–80px over a FAB at 30px. Today the list runs off the top of the window
  instead.

## What would change the verdict

- **Firefox:** `stretch` for `max-height`, and anchoring to an element in a scrolled page.
- **WebKit:** `position-try-order` applying when no position overflows.
- **Chromium:** refitting (resizing, and trying other positions) as the page scrolls.

With those fixed, FabMenu could use `fill` and Menu `max-height: stretch` with `most-block-size`.
For now, the only case that works everywhere is FabMenu with a fixed FAB. The script would still
be needed for a FAB that scrolls with the page, so it's no gain unless FabMenu requires a fixed FAB.
