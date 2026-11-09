# PROTOTYPE #298: findings (throwaway branch `prototype/298-translated-wave`)

**Question:** can ProgressLinear's and ProgressCircular's per-frame wave redraw become a wave drawn
once and moved by CSS?

**Verdict: yes for every case but one, and not by clipping.** A translated (or rotated) wave whose
extent is picked out by `stroke-dasharray` stays within a CSS pixel of the current loop, and keeps
real round caps. Clipping, as the issue first proposed, doesn't keep them.

The error is usually a third to a half of a pixel. It's largest on the smallest ring: about 0.75 at
24px, on a 4px stroke, in steady and indeterminate alike.

**The one exception is the circular wave's amplitude changing,** after the value crosses 10% or 95%.
Nothing in CSS can reproduce it exactly (see Amplitude below). Two options:

- **Crossfade a flat ring and a wavy one.** CSS only, so the loop goes away entirely. It's visibly
  a blend for about the first 100ms of the change, then settles.
- **Keep the loop for that change.** Exact, but it keeps the `draw()` code and the scheduler for
  about 350ms around a threshold.

Recommendation: crossfade, if it passes by eye. That's a judgement for a human looking at it.

## Setup

- Page: `src/pages/tests/prototype-298-translated-wave.astro`. Each of its 39 scenarios has three
  layers that read the same animated custom properties off one root, so they can differ only in how
  they draw: `current` (the components' `draw()`, copied), `clip` and `dash`. `clip` and `dash` are
  static markup and CSS, with no script.
- Measuring script: `src/pages/tests/prototype-298.spec.ts`. It freezes every animation at the same
  time, every 13ms to 1s and every 37ms after that, up to each scenario's cycle (12 to 213 frames).
  It takes a full-page screenshot and compares each candidate with `current`. It asserts nothing and
  writes `prototype-298-results-<browser>.json` (2x) and `...-<browser>-1x.json` (1x).
- Engines: the Playwright 1.64.1 builds of Chromium 156, Firefox 157 and WebKit 27.2, on Windows 11
  ARM. **This WebKit is the Windows port, not Safari's CoreGraphics, and rasterization is what's
  being compared here. Check it by eye in real Safari before shipping.**
- Run: `ASTRO_DEV_BACKGROUND=1 pnpm exec playwright test src/pages/tests/prototype-298.spec.ts --project=<browser> --reporter=list -g measure` (`PROTO_SCALE=1` for 1x).

Two measures:

- **mismatch:** summed coverage difference over the area either covers. It's large on tiny shapes,
  where a few edge pixels are a big share.
- **peak:** the largest average difference over any 1 CSS px square. A whole wrong CSS pixel is 1,
  and an edge a quarter pixel out about 0.25. This is the one that catches a wrong cap on a long
  line.

## Results

At 2x, the worst of the three engines. The engines agree to within about 0.05 of peak, except where
noted.

### Linear (M3's 3px amplitude; thickness 4 at width 320 unless stated)

| Case | dash mismatch (max) | dash peak (max) | clip peak (max) |
|---|---|---|---|
| Steady: thickness 4 and 8, width 320 and 640 | 2.7% | 0.37 | 1.00 |
| Exactly 0% | 0 | 0 | 0 |
| 0.5%, where the cap clamp holds the line a dot | 6.7% (WebKit; 0.4% elsewhere) | 0.11 | 0.60 |
| Flat, below 10% and from 95% | 0.2% | 0.06 | 0.60 |
| Exactly 100% | 0 | 0.06 | 0.60 |
| Wavy, just above 10% / just below 95% | 3.4% / 2.6% | 0.37 | 1.00 |
| Amplitude held at 50% (a frozen mid-transition) | 4.3% | 0.22 | 0.94 |
| Value change: amplitude rises / falls | 3.3% / 4.4% | 0.39 / 0.21 | 1.00 |
| Value change, steady amplitude: 320 / thickness 8 / 640 | 3.1 / 1.8 / 2.8% | 0.33 | 1.00 |
| Indeterminate: 320 / thickness 8 / 640 | 22.7 / 10.8 / 21.8% | 1.00\* | 1.00 |

\* One frame, in Chromium only, at 650ms in each indeterminate scenario: the instant the second line
starts. Its head is about 1e-9, and the `clamp(0, (head - tail) * 1e6, 1)` opacity hides that one dot
for that one frame. Without that frame the peak is 0.55 / 0.56 / 0.55. The indeterminate mismatch is
the tiny lines at the cycle's ends (around 50 device px of ink), where the peak stays at about half
a pixel.

### Circular (M3's 1.6px amplitude; 48px unless stated)

| Case | dash mismatch (max) | dash peak (max) | clip peak (max) |
|---|---|---|---|
| Steady: 24 / 48 / 52 (thickness 8) / 96 / 240 | 4.5 / 2.1 / 1.5 / 1.5 / 1.3% | 0.75 / 0.56 / 0.60 / 0.41 / 0.29 | 1.00 |
| Exactly 0% / 0.5% / exactly 100% | 0 / 0.8 / 2.0% | 0 / 0.03 / 0.16 | 0 / 1.00 / 0.16 |
| Flat, below 10% / from 95% | 4.0 / 2.2% | 0.18 / 0.23 | 1.00 |
| Wavy, just above 10% / just below 95% | 5.5 / 1.7% | 0.55 | 1.00 |
| Value change, steady amplitude: 24 / 48 / 240 | 3.5 / 1.8 / 1.3% | 0.75 / 0.56 / 0.27 | 1.00 |
| Indeterminate: 24 / 48 / 240 | 9.8 / 3.9 / 1.6% | 0.78 / 0.60 / 0.34 | 1.00 |
| **Value change, amplitude changes (crossfade), 48** | **34.8%** (median 2.4%) | 0.53 | 1.00 |

### At 1x

All of it holds. The peak window is a single device pixel here, so it's more sensitive to
anti-aliasing. Linear: dash mismatch rises to 7.1% and peak to 0.48 (indeterminate 23.5% and 0.68,
apart from the same Chromium frame). Circular: peak at most 0.80, at 24px and in the crossfade, which
has 31.8% mismatch at its worst. WebKit's 0.5% linear dot is 14.4%, with peak 0.24.

## The issue's questions

**Amplitude.** Scaling the wave vertically (`scale: 1 var(--amplitude)`, floored at 0.0001 so the
matrix stays invertible) with `vector-effect: non-scaling-stroke` holds in all three engines, at 1x
and 2x: the stroke keeps its width at every amplitude. The linear wave can therefore run its
amplitude changes in CSS. The prototype froze those changes through the Web Animations API, with
the components' easing and duration (see the WebKit trap below). A live registered-property
transition was sampled only for the progress, not for a scaled wave.

A radial wave can't be scaled, since its height is added along the radius, so the circular variant
crossfades. At amplitude 0 or 1 that's exact. Mid-change it's a blend of two shapes: up to 35%
mismatch, though the peak stays at 0.5, since it's a grey blend and not a displaced edge. The easing
reaches full amplitude at about 100ms and the amplitude is clamped from there, so the worst frames
are at 26 to 65ms, and the median frame of the 350ms is 2%. That spring also means few frames of a
linear change sit at a mid amplitude, so "held at 50%" is the better evidence for those.

**Ends.** A clipped wave doesn't keep them. The round cap is centred on the wave, so it rides up and
down, and a clip is a straight cut: peak 1.00 in every wavy case. `stroke-dasharray` keeps the
stroke's own caps on the wave, needing no separate shapes. M3's gap to the track wasn't measured:
the page draws no track. The track's segments are positioned from the same values as today and
wouldn't change, but the gap against a moving cap should be looked at in the implementation.

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
   `getTotalLength()` as Chromium but appear to dash along a coarser flattening of a curve, so the
   far end overshoots (+1px at 320px with a 40px wavelength, +2.5px with 20px). A polyline has only
   one length, and with it all three agree. One point per px costs about 2% mismatch against the
   current curve, with the peak unchanged.
3. **A scaled wave needs a dash correction.** `pathLength` is measured on the unscaled path, while
   the dash runs along the scaled one. Multiply dash and offset by `stretch(a) / stretch(1)`. As
   `g0 + a²(c2 + a²c4)`, exact at 0, 0.5 and 1, that's plain `calc()` and is the same in all three
   engines.
4. **The dash must run against the motion.** `stroke-dashoffset` advances by the phase times the
   wavelength, in step with the `translate`.
5. **`100cqw` gives the track's width to the dash,** so the root needs `container-type:
   inline-size`.

The 24px ring's larger error is unexplained by measurement. A likely cause: `pathLength` counts
waves, but stroke length isn't uniform within a wave, so a cap wanders slightly with the phase where
the loop pins it. On a wave this tight the wander is a larger share.

## Not measured

- **Whether it's actually cheaper.** This prototype checks that the picture matches, not paint or
  main-thread time. The registered custom properties still run on the main thread, and a dash change
  still repaints the path. What goes away is the script and its `getComputedStyle` reads and
  path rebuilds.
- Right to left. The wave and dash are inside the same SVG the component mirrors today.
- Page zoom, or an ancestor with a `scale`, with `vector-effect: non-scaling-stroke`.
- Reduced motion. The phase would stop, as it does today, but that wasn't run.
- Amplitude changes at other sizes: those ran at width 320 and thickness 4, and at 48px.
- The polyline's weight. It's one point per px of track, and the track's width isn't known at build
  time. It needs either a fixed maximum length in the markup, or a script that draws it once per
  width (a ResizeObserver, no per-frame work).

## A WebKit trap for tests

A paused `CSSTransition` on a registered custom property doesn't hold its value in this WebKit, so
scrubbing one measures the end state. Live, the transition interpolates normally (the `probe` test
logged 0.2, 0.30, 0.69, 0.7; those aren't in the results files). This page runs value changes
through the Web Animations API with the same easing and duration, which scrubs in every engine.
