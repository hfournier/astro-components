# PROTOTYPE #298: findings (throwaway branch `prototype/298-translated-wave`)

**Question:** can ProgressLinear's and ProgressCircular's per-frame wave redraw become a wave drawn
once and moved by CSS?

**Verdict: yes for every case but one, and not by clipping.** A translated (or rotated) wave whose
extent is picked out by `stroke-dasharray` matches the current loop to under one CSS pixel. It
keeps real round caps. Clipping, as the issue first proposed, doesn't keep them. The one exception
is the circular wave's amplitude changing, which only happens for the 350ms after the value crosses
10% or 95%.

## Setup

- Page: `src/pages/tests/prototype-298-translated-wave.astro`. Each of its 28 scenarios has three
  layers that read the same animated custom properties off one root, so they can differ only in how
  they draw: `current` (the components' `draw()`, copied), `clip` and `dash`. `clip` and `dash` are
  static markup and CSS, with no script.
- Measuring script: `src/pages/tests/prototype-298.spec.ts`. It freezes every animation at the same
  time, every 13ms to 1s and every 37ms after that, up to each scenario's cycle (12 to 213 frames).
  It takes a full-page screenshot at 2x and compares each candidate with `current`. It asserts
  nothing and writes `prototype-298-results-<browser>.json`.
- Engines: the Playwright 1.64.1 builds of Chromium 156, Firefox 157 and WebKit 27.2, on Windows 11
  ARM. **This WebKit is the Windows port, not Safari's CoreGraphics, and rasterization is what's
  being compared here. Check it by eye in real Safari before shipping.**
- Run: `ASTRO_DEV_BACKGROUND=1 pnpm exec playwright test src/pages/tests/prototype-298.spec.ts --project=<browser> --reporter=list -g measure`

Two measures:

- **mismatch:** summed coverage difference over the area either covers. It's large on tiny shapes,
  where a few edge pixels are a big share.
- **peak:** the largest average difference over any 1 CSS px square. A whole wrong CSS pixel is 1,
  and an edge a quarter pixel out about 0.25. This is the one that catches a wrong cap on a long
  line.

## Results

The worst of the three engines. The engines agree to within about 0.05 of peak.

### Linear (M3's 3px amplitude, thickness 4 and 8, width 320 and 640)

| Case | dash mismatch (max) | dash peak (max) | clip peak (max) |
|---|---|---|---|
| Steady | 2.7% | 0.37 | 1.00 |
| Flat, below 10% and from 95% | 0.2% | 0.06 | 0.60 |
| Wavy, just above 10% / just below 95% | 3.4% / 2.6% | 0.37 | 1.00 |
| Amplitude held at 50% (a frozen mid-transition) | 4.3% | 0.22 | 0.94 |
| Value change: amplitude rises / falls / steady | 3.3% / 4.4% / 3.1% | 0.39 | 1.00 |
| Indeterminate, thickness 4 / 8 | 22.7% / 10.8% | 0.55 / 0.56 | 1.00 |

The indeterminate mismatch is the tiny lines at the cycle's ends (around 50 device px of ink), and
peak stays at about half a pixel there. In Chromium one frame in each indeterminate scenario peaks at
1.00, at 650ms, the instant the second line starts. Its head is about 1e-9, and the
`clamp(0, (head - tail) * 1e6, 1)` opacity hides that one dot for that one frame.

### Circular (M3's 1.6px amplitude)

| Case | dash mismatch (max) | dash peak (max) | clip peak (max) |
|---|---|---|---|
| Steady, 24 / 48 / 52 (thickness 8) / 96 / 240 | 4.5 / 2.1 / 1.5 / 1.5 / 1.3% | 0.74 / 0.56 / 0.56 / 0.41 / 0.29 | 1.00 |
| Flat, below 10% / from 95% | 4.0 / 2.2% | 0.18 / 0.23 | 1.00 |
| Wavy, just above 10% / just below 95% | 5.5 / 1.7% | 0.55 | 1.00 |
| Value change, steady amplitude | 1.8% | 0.56 | 1.00 |
| Indeterminate, 24 / 48 / 240 | 9.8 / 3.9 / 1.6% | 0.78 / 0.60 / 0.34 | 1.00 |
| **Value change, amplitude changes (crossfade)** | **34.8%** | 0.53 | 1.00 |

## The issue's questions

**Amplitude.** Scaling the wave vertically (`scale: 1 var(--amplitude)`, floored at 0.0001 so the
matrix stays invertible) with `vector-effect: non-scaling-stroke` holds in all three engines: the
stroke keeps its width at every amplitude. The registered `@property` transitions drive it as they
do today. The linear wave can therefore run its amplitude changes in CSS.

A radial wave can't be scaled, since its height is added along the radius. The circular variant
crossfades a flat ring and a wavy one. At amplitude 0 or 1 that's exact, but mid-transition it's a
blend of two shapes: 34% mismatch at its worst, for 350ms. Because it's a grey blend and not a
displaced edge, the peak stays at 0.5.

**Ends.** A clipped wave doesn't keep them. The round cap is centred on the wave, so it rides up and
down, and a clip is a straight cut: peak 1.00 in every wavy case. `stroke-dasharray` keeps the
stroke's own caps on the wave, needing no separate shapes.

**Circular.** Rotation is shift-invariant at every size, because Compose rounds the number of waves
to a whole number (at least 5), and the component already does. The wavelength divides the
circumference by construction.

**Indeterminate.** Not a clip, for the same reason as the ends. Each line is its own dash on the
moving wave, from the same registered head and tail properties the flat variant animates.

## How the dash has to be built

Each of these came from a measurement that failed first:

1. **`pathLength` is required.** Computing the dash from the wave's real arc length drifts with
   distance (peak 1.00 at 320px), since engines measure a curve differently from the exact integral.
   With `pathLength` set to the wave's run along the track, a dash is in px of track.
2. **The wave must be a polyline, not curves.** Firefox and WebKit report the same
   `getTotalLength()` as Chromium but dash along a coarser flattening of a curve, so the far end
   overshoots (+1px at 320px with a 40px wavelength, +2.5px with 20px). A polyline has only one
   length. One point per px costs about 2% mismatch against the current curve, with peak unchanged.
3. **A scaled wave needs a dash correction.** `pathLength` is measured on the unscaled path, while
   the dash runs along the scaled one. Multiply dash and offset by `stretch(a) / stretch(1)`. As
   `g0 + a²(c2 + a²c4)`, exact at 0, 0.5 and 1, that's plain `calc()` and is the same in all three
   engines.
4. **The dash must run against the motion.** `stroke-dashoffset` advances by the phase times the
   wavelength, in step with the `translate`.
5. **`100cqw` gives the track's width to the dash,** so the root needs `container-type:
   inline-size`.

## Not measured

- **Whether it's actually cheaper.** This prototype checks that the picture matches, not paint or
  main-thread time. The registered custom properties still run on the main thread, and a dash change
  still repaints the path. What goes away is the script and its `getComputedStyle` reads and
  path rebuilds.
- Right to left. The wave and dash are inside the same SVG the component mirrors today.
- Page zoom, or an ancestor with a `scale`, with `vector-effect: non-scaling-stroke`.
- The polyline's weight. It's one point per px of track, and the track's width isn't known at build
  time. It needs either a fixed maximum length in the markup, or a script that draws it once per
  width (a ResizeObserver, no per-frame work).

## A WebKit trap for tests

A paused `CSSTransition` on a registered custom property doesn't hold its value in this WebKit, so
scrubbing one measures the end state. Live, the transition interpolates normally (0.2, 0.30, 0.69,
0.7). This page runs value changes through the Web Animations API with the same easing and duration,
which scrubs in every engine.
