# PROTOTYPE #290: findings (throwaway branch `prototype/290-progress-loading-precomputed`)

**Question:** can ProgressLoading's `requestAnimationFrame` morph loop become an animation computed
at build time that matches it by eye in Chromium, Firefox and WebKit? And which one: SMIL, or CSS
`@keyframes` on `clip-path: shape()`?

**Verdict: yes, and use CSS.** Both options match the current loop frame for frame in all three
engines, to within an edge pixel. CSS costs 43KB once per page and SMIL 152KB per indicator.
CSS also honours reduced motion on its own.

## Setup

- Page: `src/pages/tests/prototype-290-progress-loading.astro`. It shows three indicators side by
  side: the current loop (its `draw()`, copied so its clock can be set), SMIL and CSS. All frames
  are generated in the frontmatter from `loadingIndicatorSequence()` and `morphPathData()` in
  `src/shapes.ts`, with the component's spring constants. Nothing is hand-written. Tick **Scrub**
  to freeze all three at the slider's time.
- Measuring script: `src/pages/tests/prototype-290.spec.ts`. It sets all three to the same time
  every 37ms over two full shape cycles (0–9100ms: 14 morphs and 3.5 turns, 246 frames). It
  screenshots each indicator at 200px and scores the mismatch: pixels filled in one but not the
  other, over pixels filled in either. It asserts nothing and writes
  `prototype-290-results-<browser>.json`.
- Engines: the Playwright 1.64.1 builds of Chromium 156, Firefox 157 and WebKit 27.2, on
  Windows 11 ARM.
- Run: `ASTRO_DEV_BACKGROUND=1 pnpm exec playwright test src/pages/tests/prototype-290.spec.ts --reporter=list`

## How each option is built

The current loop runs two clocks, so each option runs two animations:

- the shape sequence: 7 morphs, a new one every 650ms, repeating every **4550ms**
- the quarter turns: 4 of them, repeating every **2600ms**

The component's 4666ms rotation of the whole indicator stays as it is today.

The seven morphs have different numbers of cubics: 58, 28, 22, 44, 48, 24 and 48. A path only
interpolates between frames of the same morph, so there is a discrete switch at each morph
boundary. The switch can't be seen, because a morph's end shape is the next morph's start shape,
only split into cubics differently. All three engines handle it this way, for both `d` and
`shape()`.

- **SMIL:** one `<animate attributeName="d">` and one `<animateTransform type="rotate">`, with
  `calcMode="linear"`. Each morph's spring is sampled at 13 knots, the last one 0.5ms before the
  spring settles, where Compose snaps to the end shape. After the knots comes a hold until the
  next morph.
- **CSS:** each morph has just two keyframes, its start shape and its end shape, as `shape()` in
  percentages. The keyframe between them uses the spring as a `linear()` easing of 40 samples
  that ends in the snap. As the spring overshoots, the easing output goes past 1, and CSS
  interpolation carries the shape beyond the end shape, as `morphPathData()` does. That works in
  all three engines. The quarter turns use the same easing on `rotate`.

## Results

Mismatch against the current loop's frame at the same time, as a share of the filled area. On a
200px indicator, 1% is about one pixel of edge all the way round.

| | Chromium | Firefox | WebKit |
|---|---|---|---|
| SMIL: median / p95 / max | 0 / 0.54% / 1.46% | 0 / 0.54% / 1.46% | 0 / 0.52% / 1.49% |
| CSS: median / p95 / max | 0.22% / 1.04% / 1.69% | 0.03% / 1.07% / 1.67% | 0 / 1.03% / 1.73% |
| Both move without the scrubber | ✓ | ✓ | ✓ |
| Reduced motion: both hold the first frame, unmoving | ✓ | ✓ (CSS 0.02%) | ✓ (CSS 0.002%) |

- **Morph order, timing, rotation and overshoot** all match. The worst frames fall during the
  spring's rise and overshoot, at 6–110ms and 260–297ms into a morph. Even there, the mismatch is
  under an edge pixel.
- **SMIL** draws the same path as the loop, so it scores 0 except between knots. Before the
  pre-settle knot was added, the last knot sat at 273ms, and the ~25ms before each snap reached
  8%.
- **CSS** has a small constant mismatch. Part of it is antialiasing: a clipped `<div>` versus an
  SVG path. The other part is centering: the loop recenters each frame on its own bounds, but
  interpolating between two centered end shapes doesn't recenter in between.

## Size

| | Bytes | Paid |
|---|---|---|
| SMIL (13 knots) | 152,116 | per indicator, inline in its SVG. A shared `<symbol>` and `<use>` would make it once per page |
| CSS keyframes | 43,558 | once per page, if emitted as a shared stylesheet (see the implementation notes) |

Both are uncompressed, with 2 decimal places. The CSS could shrink further, to 1 decimal place or
with a shared custom property for the easing, which is repeated 11 times now.

## Choice: CSS

- **Size:** a third of SMIL's at best, and that's against SMIL with `<use>` added.
- **Reduced motion:** the CSS animation sits behind
  `@media (prefers-reduced-motion: no-preference)`, as Tailwind's `motion-safe:` puts it. SMIL
  ignores the preference, so it needs a second, static SVG and a class to swap between the two.
- **Accuracy:** a draw. Both stay within an edge pixel of the current loop in every engine.

## Notes for the implementation

- The active indicator becomes a `<div>` filled with the fill color and clipped by `shape()`,
  instead of an SVG `<path>`. Percentage coordinates scale with `size`. Its static `clip-path` is
  the first frame and its static `rotate` is 90deg, so it stays there without motion.
- Generate the keyframes at build time from `loadingIndicatorSequence()`, and emit them once per
  page. They're the same for every instance. The prototype inlines them with
  `<style set:html>`, which a component would repeat for each instance. Astro emits a
  component's `<style>` once only when it's static, so the keyframes need to go in a generated
  stylesheet, for example a Vite virtual module or a build script that writes a `.css` file.
- The rAF loop, its `animationstart` restart for indicators added later, and its reduced-motion
  listener all go. With no script left, an indicator added later by a script or by Astro's
  ClientRouter animates as soon as it's in the page.
