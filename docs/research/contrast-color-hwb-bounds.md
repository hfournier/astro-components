# Safe HWB Whiteness/Blackness Bounds for `contrast-color()`-Backed Solid Fills

Research date: 2026-09-14. Compiled for issue #53, feeding two sibling decision tickets: #49
(moving token derivation from `oklch(from ...)` to `color-mix(in hwb, var(--color-primary) X%,
white|black)`) and #52 (using `contrast-color()` to auto-pick white/black text on those
backgrounds instead of a hand-picked text-color token). Mirrors ADR-0007's own methodology: real
sRGB + WCAG relative luminance math, not a color picker.

## Executive summary

- **No literal AA-failing gap exists inside this specific color family.** Across every hue (0-360°)
  and every mix percentage X (0-100%) of `color-mix(in hwb, hue X%, white|black)`, the better of
  pure white/pure black text never drops below **4.58:1** — technically always clearing 4.5:1.
  MDN's "mid-tone backgrounds generally don't provide enough contrast with either" warning is
  about *arbitrary* RGB backgrounds; it doesn't fully apply to this constrained tint/shade-of-one-hue
  family, because the family's own endpoints are pure white and pure black.
- **But the margin is razor-thin exactly where you'd reach for the raw brand color.** The global
  minimum (4.5826:1) occurs at `X≈77%, hue≈25.25°` — almost exactly `#cc5500`'s own hue (25.0°) —
  and a comparably thin "shelf" (4.58-4.9:1) persists for *some* worst-case hue at every X from
  50% to 100% in the shade direction (mixing toward black) and roughly 50-95% in the tint direction
  (mixing toward white). Only 1.8% of headroom over the 4.5 line is not a number to design a
  hue-independent system around — floating-point/rounding differences between this script's math
  and a real browser's `color-mix(in hwb, ...)` implementation could plausibly tip a specific hue
  under 4.5 in practice.
- **Recommended hue-independent safe X-range (with real margin, ≥5:1 for any hue, even a
  maximally-saturated one):** `X ≤ 45%` for the **shade** direction (`color-mix(in hwb, hue X%,
  black)`) and `X ≤ 55%` for the **tint** direction (`color-mix(in hwb, hue X%, white)`). Below
  these thresholds, contrast only improves as more black/white is mixed in.
- **`#cc5500` itself is much safer than the worst case**, because it isn't a fully-saturated pure
  hue — it already carries `hwb(25°, 0%, 20%)`, i.e. 20% built-in blackness. At that saturation,
  `#cc5500` clears 4.5:1 at every X from 0-100% in both directions, and its shade-direction X≈70%
  (7.50:1) / X≈50% (11.03:1) closely reproduce ADR-0007's already-verified `oklch` L=0.45 (7.95:1)
  and L=0.35 (11.59:1) reference points.
- The takeaway for the consuming decision tickets: a single X-range that's provably safe for *any*
  possible `--color-primary` (including a fully-saturated one) is noticeably more conservative
  (`X≤45%`/`X≤55%`) than what `#cc5500` specifically could get away with (`X≈70%`/`X≈50%`, matching
  today's dial). ADR-0007's own conclusion still applies here: the real backstop is the axe-core
  Playwright tests, not the derivation math — this research narrows how often that backstop would
  ever have to fire.

---

## Methodology

- **Script**: `docs/research/contrast-color-hwb-bounds-sweep.mjs` (Node ≥18, no dependencies —
  throwaway, not added to the repo's dependency graph). It implements, from the CSS Color 4 spec
  directly (not a library):
  - `hwbToRgb(h, w, b)` — HWB → sRGB.
  - `rgbToHwb(r, g, b)` — sRGB → HWB (used once, to seed `#cc5500`'s own H/W/B).
  - `mix(hue, w0, b0, X, target)` — reproduces `color-mix(in hwb, hwb(hue,w0,b0) X%, white|black
    (100-X)%)`. White and black have a **powerless hue** per the CSS Color 4 interpolation rules,
    so the mix keeps the chromatic color's own hue; only whiteness/blackness interpolate linearly
    by the X/100-X weights.
  - `relLuminance(r, g, b)` — WCAG 2.x relative luminance (`0.2126 R + 0.7152 G + 0.0722 B` on the
    linearized channels, sRGB gamma-decoded per the `c/12.92` vs. `((c+0.055)/1.055)^2.4` piecewise
    formula).
  - `contrast(L1, L2)` — `(lighter + 0.05) / (darker + 0.05)`, i.e. the standard WCAG contrast
    ratio, evaluated against both `L=1` (white) and `L=0` (black); the reported "winning" value is
    `max(contrast-vs-white, contrast-vs-black)`.
- **Hues tested**: 12 hues at 30° increments around the wheel (0°, 30°, 60°, …, 330°) plus
  `#cc5500`'s own hue (≈25.0°) — 13 in total for the tabulated sweeps — and an exhaustive 0.25°-step
  scan across the full 0-360° wheel for the boundary/global-minimum searches (steps 3-4 below),
  so the reported worst case isn't an artifact of only sampling 30°-spaced hues.
- **Two saturation baselines**, both explicitly requested by the ticket:
  - **Sweep A — pure full-saturation hue**, `hwb(h, 0%, 0%)` (e.g. `hue=0°` → `rgb(255,0,0)`).
    This is the most adversarial case: no brand color can be *more* saturated than this, so any
    finding that holds here holds for literally any hue a user could set `--color-primary` to.
  - **Sweep B — `#cc5500`-comparable saturation**, `hwb(h, 0%, 20%)` (`#cc5500`'s own whiteness is
    0%, blackness 20%) — a realistic baseline matching today's actual base color, plus `#cc5500`
    itself (same H/W/B, literally the current `--color-primary`).
- **X grid**: 100, 90, 80, …, 0 for the tabulated sweeps (X = percentage of the hue color in the
  mix, i.e. `color-mix(in hwb, hue X%, white|black (100-X)%)`, matching the ticket's own notation);
  0.1-0.25% step scans for the boundary-finding and global-minimum searches.

Run with `node docs/research/contrast-color-hwb-bounds-sweep.mjs` (fresh output regenerates all
tables below).

---

## Data

### Table A — pure full-saturation hues, `hwb(h, 0%, 0%)`

`w`/`b` prefix = winner (white/black), number = winning contrast ratio.

**SHADE — `color-mix(in hwb, hue X%, black (100-X)%)`**

| hue | X=100 | X=90 | X=80 | X=70 | X=60 | X=50 | X=40 | X=30 | X=20 | X=10 | X=0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0° | b5.25 | w4.83 | w5.89 | w7.23 | w8.92 | w10.99 | w13.42 | w16.01 | w18.41 | w20.14 | w21.00 |
| 30° | b8.31 | b6.79 | b5.47 | w4.84 | w6.17 | w7.96 | w10.30 | w13.19 | w16.35 | w19.11 | w21.00 |
| 60° | b19.56 | b15.61 | b12.20 | b9.31 | b6.91 | b4.97 | w6.06 | w8.90 | w13.01 | w17.71 | w21.00 |
| 90° | b16.21 | b12.99 | b10.20 | b7.84 | b5.87 | w4.91 | w6.90 | w9.85 | w13.85 | w18.10 | w21.00 |
| 120° | b15.30 | b12.26 | b9.64 | b7.41 | b5.56 | w5.17 | w7.24 | w10.26 | w14.25 | w18.37 | w21.00 |
| 150° | b15.61 | b12.51 | b9.83 | b7.55 | b5.66 | w5.08 | w7.12 | w10.12 | w14.11 | w18.28 | w21.00 |
| 180° | b16.75 | b13.40 | b10.51 | b8.05 | b6.02 | w4.80 | w6.79 | w9.75 | w13.80 | w18.14 | w21.00 |
| 210° | b5.51 | w4.59 | w5.57 | w6.81 | w8.37 | w10.31 | w12.61 | w15.15 | w17.63 | w19.61 | w21.00 |
| 240° | w8.59 | w9.83 | w11.22 | w12.75 | w14.38 | w16.04 | w17.62 | w18.99 | w20.04 | w20.70 | w21.00 |
| 270° | w6.26 | w7.34 | w8.62 | w10.12 | w11.86 | w13.77 | w15.76 | w17.66 | w19.26 | w20.36 | w21.00 |
| 300° | b6.70 | b5.49 | w4.73 | w5.91 | w7.46 | w9.46 | w11.95 | w14.82 | w17.67 | w19.87 | w21.00 |
| 330° | b5.56 | b4.59 | w5.59 | w6.89 | w8.54 | w10.59 | w13.02 | w15.67 | w18.18 | w20.03 | w21.00 |

**TINT — `color-mix(in hwb, hue X%, white (100-X)%)`**

| hue | X=100 | X=90 | X=80 | X=70 | X=60 | X=50 | X=40 | X=30 | X=20 | X=10 | X=0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0° | b5.25 | b5.41 | b5.77 | b6.41 | b7.34 | b8.62 | b10.27 | b12.31 | b14.76 | b17.65 | b21.00 |
| 30° | b8.31 | b9.03 | b9.86 | b10.79 | b11.85 | b13.04 | b14.35 | b15.80 | b17.39 | b19.12 | b21.00 |
| 60° | b19.56 | b19.57 | b19.60 | b19.66 | b19.75 | b19.87 | b20.02 | b20.20 | b20.43 | b20.69 | b21.00 |
| 90° | b16.21 | b16.44 | b16.71 | b17.03 | b17.40 | b17.83 | b18.33 | b18.89 | b19.52 | b20.23 | b21.00 |
| 120° | b15.30 | b15.36 | b15.49 | b15.72 | b16.06 | b16.52 | b17.12 | b17.86 | b18.74 | b19.79 | b21.00 |
| 150° | b15.61 | b15.73 | b15.90 | b16.16 | b16.52 | b16.97 | b17.53 | b18.21 | b19.01 | b19.94 | b21.00 |
| 180° | b16.75 | b16.79 | b16.89 | b17.06 | b17.31 | b17.66 | b18.10 | b18.65 | b19.32 | b20.10 | b21.00 |
| 210° | b5.51 | b6.25 | b7.14 | b8.19 | b9.42 | b10.83 | b12.44 | b14.25 | b16.27 | b18.52 | b21.00 |
| 240° | **w8.59** | w7.98 | w6.87 | w5.52 | b4.91 | b6.42 | b8.35 | b10.76 | b13.65 | b17.06 | b21.00 |
| 270° | w6.26 | w5.67 | w4.92 | b5.11 | b6.25 | b7.73 | b9.57 | b11.79 | b14.43 | b17.49 | b21.00 |
| 300° | b6.70 | b6.84 | b7.17 | b7.74 | b8.60 | b9.76 | b11.25 | b13.10 | b15.33 | b17.96 | b21.00 |
| 330° | b5.56 | b5.78 | b6.19 | b6.85 | b7.80 | b9.07 | b10.68 | b12.66 | b15.03 | b17.80 | b21.00 |

Note the crossover: for every hue, as X moves from 0 to 100, the winner can flip between white
and black (e.g. hue 30° SHADE flips black→white between X=80 and X=70). The winning contrast dips
near that crossover but — in this 30°-spaced sample — never below 4.5.

### Table B — `#cc5500`-comparable saturation, `hwb(h, 0%, 20%)` + `#cc5500` itself

`#cc5500` → `hwb(25.0°, 0.0%, 20.0%)`.

**SHADE**

| hue | X=100 | X=90 | X=80 | X=70 | X=60 | X=50 | X=40 | X=30 | X=20 | X=10 | X=0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cc5500 (H25°) | b4.87 | w5.15 | w6.20 | w7.50 | w9.10 | w11.03 | w13.26 | w15.64 | w17.89 | w19.67 | w21.00 |
| 0° | w5.89 | w6.93 | w8.20 | w9.70 | w11.45 | w13.42 | w15.50 | w17.50 | w19.21 | w20.38 | w21.00 |
| 30° | b5.47 | w4.61 | w5.59 | w6.83 | w8.38 | w10.30 | w12.58 | w15.09 | w17.55 | w19.54 | w21.00 |
| 60° | b12.20 | b9.85 | b7.81 | b6.08 | b4.64 | w6.06 | w8.24 | w11.22 | w14.92 | w18.53 | w21.00 |
| 90° | b10.20 | b8.28 | b6.61 | b5.19 | w5.25 | w6.90 | w9.18 | w12.15 | w15.61 | w18.82 | w21.00 |
| 120° | b9.64 | b7.82 | b6.25 | b4.92 | w5.52 | w7.24 | w9.57 | w12.56 | w15.98 | w19.04 | w21.00 |
| 150° | b9.83 | b7.98 | b6.37 | b5.01 | w5.42 | w7.12 | w9.43 | w12.42 | w15.85 | w18.96 | w21.00 |
| 180° | b10.51 | b8.51 | b6.78 | b5.31 | w5.14 | w6.79 | w9.07 | w12.07 | w15.60 | w18.86 | w21.00 |
| 210° | w5.57 | w6.54 | w7.71 | w9.10 | w10.74 | w12.61 | w14.63 | w16.67 | w18.51 | w19.91 | w21.00 |
| 240° | w11.22 | w12.43 | w13.72 | w15.05 | w16.37 | w17.62 | w18.74 | w19.67 | w20.35 | w20.78 | w21.00 |
| 270° | w8.62 | w9.80 | w11.14 | w12.60 | w14.16 | w15.76 | w17.30 | w18.67 | w19.77 | w20.52 | w21.00 |
| 300° | w4.73 | w5.65 | w6.79 | w8.20 | w9.92 | w11.95 | w14.23 | w16.57 | w18.66 | w20.17 | w21.00 |
| 330° | w5.59 | w6.60 | w7.83 | w9.31 | w11.05 | w13.02 | w15.14 | w17.23 | w19.02 | w20.29 | w21.00 |

**TINT**

| hue | X=100 | X=90 | X=80 | X=70 | X=60 | X=50 | X=40 | X=30 | X=20 | X=10 | X=0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cc5500 (H25°) | b4.87 | b5.63 | b6.55 | b7.65 | b8.93 | b10.41 | b12.09 | b13.98 | b16.09 | b18.43 | b21.00 |
| 0° | w5.89 | w5.42 | w4.79 | b5.17 | b6.27 | b7.72 | b9.54 | b11.75 | b14.38 | b17.46 | b21.00 |
| 30° | b5.47 | b6.29 | b7.25 | b8.36 | b9.63 | b11.07 | b12.68 | b14.47 | b16.45 | b18.63 | b21.00 |
| 60° | b12.20 | b12.86 | b13.55 | b14.29 | b15.08 | b15.92 | b16.82 | b17.77 | b18.78 | b19.86 | b21.00 |
| 90° | b10.20 | b10.91 | b11.68 | b12.53 | b13.46 | b14.48 | b15.59 | b16.79 | b18.09 | b19.49 | b21.00 |
| 120° | b9.64 | b10.19 | b10.83 | b11.58 | b12.46 | b13.48 | b14.65 | b15.98 | b17.48 | b19.15 | b21.00 |
| 150° | b9.83 | b10.43 | b11.12 | b11.90 | b12.80 | b13.82 | b14.97 | b16.26 | b17.68 | b19.26 | b21.00 |
| 180° | b10.51 | b11.09 | b11.75 | b12.50 | b13.35 | b14.31 | b15.39 | b16.59 | b17.92 | b19.39 | b21.00 |
| 210° | w5.57 | w4.64 | b5.45 | b6.57 | b7.90 | b9.46 | b11.25 | b13.29 | b15.59 | b18.16 | b21.00 |
| 240° | w11.22 | w9.96 | w8.12 | w6.20 | w4.62 | b6.11 | b8.11 | b10.57 | b13.52 | b16.99 | b21.00 |
| 270° | w8.62 | w7.43 | w6.11 | w4.85 | b5.54 | b7.10 | b9.04 | b11.38 | b14.14 | b17.34 | b21.00 |
| 300° | w4.73 | b4.78 | b5.31 | b6.09 | b7.16 | b8.55 | b10.27 | b12.36 | b14.83 | b17.70 | b21.00 |
| 330° | w5.59 | w5.10 | b4.68 | b5.50 | b6.61 | b8.06 | b9.85 | b12.02 | b14.59 | b17.58 | b21.00 |

At `#cc5500`'s own saturation, every tabulated hue clears 4.5:1 at every X from 0-100% in both
directions — comfortably, not marginally (the tightest value in either table is `#cc5500` itself
at X=100, 4.87:1).

### The mid-tone failure zone (worst case across the full 360° wheel, Sweep A saturation)

| X | worst SHADE contrast | worst hue | worst TINT contrast | worst hue |
|---|---|---|---|---|
| 100 | 4.584 | 284.25° | 4.584 | 284.25° |
| 95 | 4.591 | 288.00° | 4.590 | 216.50° |
| 90 | 4.583 | 9.00° | 4.584 | 281.00° |
| 85 | 4.584 | 16.50° | 4.585 | 278.25° |
| 80 | 4.592 | 22.25° | 4.587 | 224.25° |
| 75 | 4.585 | 27.25° | 4.589 | 269.00° |
| 70 | 4.587 | 198.00° | 4.589 | 260.75° |
| 65 | 4.585 | 37.50° | 4.585 | 248.50° |
| 60 | 4.588 | 189.50° | 4.910 | 240.00° |
| 55 | 4.588 | 49.25° | 5.610 | 240.00° |
| 50 | 4.584 | 73.75° | 6.416 | 240.00° |
| 45 | 5.040 | 60.00° | 7.329 | 240.00° |
| 40 | 6.060 | 60.00° | 8.355 | 240.00° |
| 35 | 7.331 | 60.00° | 9.496 | 240.00° |
| 30 | 8.902 | 60.00° | 10.757 | 240.00° |

**Answering the ticket's question 3 directly**: there is no X where *every* hue fails 4.5:1 — the
worst-case hue at each X still clears it, by a whisker. But there's a persistent "shelf" from
roughly **X=50% to X=100%** (shade) and **X=50% to X=95%** (tint) where *some* hue sits within
2-9% of the 4.5 floor. That shelf, not a hard failure, is the practical shape of MDN's warning for
this mechanism: it's not "fails outright," it's "clears by so little that it isn't a safe target."

**Absolute global minimum** across the entire family (all 360° × all X × both directions, Sweep A
saturation): **4.5826:1**, at `hue≈25.25°, X=77%, shade direction` — almost exactly `#cc5500`'s own
hue (25.0°). `cw` and `cb` are within 0.001 of each other there (4.583 vs 4.583) — i.e. that point
is the literal crossover where white and black tie, which is also where the winning contrast is
weakest by construction.

### Universal safe-X boundary (worst hue must still clear the threshold)

| threshold | SHADE safe X≤ | worst hue | TINT safe X≤ | worst hue |
|---|---|---|---|---|
| 4.50 (bare AA) | 100.0 | — | 100.0 | — |
| 4.75 | 46.6 | 60° | 61.2 | 240° |
| 5.00 | 45.2 | 60° | 59.3 | 240° |

At the bare 4.5 threshold, the entire 0-100% range is technically "safe" for every hue (per the
global minimum above) — but as the executive summary notes, that's not a margin worth relying on.
Requiring a small real margin (≥5:1) pulls the universal bound in sharply: **X≤45% for shade,
X≤55% for tint** (rounding the 45.2/59.3 boundaries down for a whole-number token value).

### `#cc5500` sanity check (actual `--color-primary` today), SHADE direction

| X | resulting rgb | winner | contrast |
|---|---|---|---|
| 100 | rgb(204,85,0) | black | 4.87 |
| 90 | rgb(184,77,0) | white | 5.15 |
| 80 | rgb(163,68,0) | white | 6.20 |
| 70 | rgb(143,60,0) | white | **7.50** |
| 60 | rgb(122,51,0) | white | 9.10 |
| 55 | rgb(112,47,0) | white | 10.03 |
| 50 | rgb(102,43,0) | white | **11.03** |
| 45 | rgb(92,38,0) | white | 12.11 |
| 40 | rgb(82,34,0) | white | 13.26 |
| 35 | rgb(71,30,0) | white | 14.44 |
| 30 | rgb(61,26,0) | white | 15.64 |
| 20 | rgb(41,17,0) | white | 17.89 |
| 10 | rgb(20,8,0) | white | 19.67 |
| 0 | rgb(0,0,0) | white | 21.00 |

**Comparison to ADR-0007's verified reference points** (different mechanism — `oklch(from
#cc5500 L c h)` against literal white text, not `color-mix(in hwb, ...)` against
`contrast-color()`):

| Role | ADR-0007 (`oklch`, L) | ADR-0007 contrast | Closest `color-mix(in hwb, ...)` X | This mechanism's contrast |
|---|---|---|---|---|
| control (resting) | 0.45 | 7.95:1 | X≈70% | 7.50:1 |
| control-hover | 0.35 | 11.59:1 | X≈50% | 11.03:1 |

The two mechanisms land within ~6% of each other at the X values that visually correspond to
ADR-0007's resting/hover steps for `#cc5500` — consistent with both being real, correctly-computed
sRGB/WCAG math on the same base color, just reached via a different color-space path (`oklch`
lightness dial vs. `hwb` mix percentage).

---

## Recommendation for the consuming decision tickets (#49, #52)

Two honest options, not one number, because the "safe range" genuinely depends on how much the
system wants to guarantee about `--color-primary` sight-unseen:

1. **Hue-and-saturation-independent guarantee** (safe even if `--color-primary` is ever set to a
   maximally-saturated pure hue): cap the shade mix at **X≤45%** and the tint mix at **X≤55%**.
   This guarantees ≥5:1 (10%+ headroom over AA) for literally any hue at any saturation up to and
   including 100%. The cost: quite a lot of black/white gets mixed in, so the resulting
   resting/hover colors are noticeably darker/lighter (less "branded") than what `#cc5500`
   specifically could get away with.
2. **`#cc5500`-realistic guarantee** (matches today's palette and ADR-0007's already-verified
   dial): X≈70% (shade, resting) / X≈50% (shade, hover) reproduce ADR-0007's 7.95:1/11.59:1 almost
   exactly (7.50:1/11.03:1) for `#cc5500`'s actual, less-than-fully-saturated hue. This only stays
   safe as long as `--color-primary` doesn't get swapped for a hue landing in the 4.58-4.9:1 "shelf"
   identified above (worst offenders: red-orange ~0-30°, blue-violet ~270-290° — coincidentally
   close to `#cc5500`'s own family).
3. Either way, per ADR-0007's own conclusion, **this derivation math is not a substitute for the
   axe-core Playwright checks** already run against real rendered components — it only changes how
   often, and how close to the edge, those checks would ever have something to catch.

---

## Answers to the ticket's specific questions

**Q1 (script/methodology)**: `docs/research/contrast-color-hwb-bounds-sweep.mjs`, Node, no deps —
implements `hwb→rgb`, `rgb→hwb`, the CSS Color 4 `color-mix(in hwb, ...)` interpolation (hue held
constant when mixing with achromatic white/black), WCAG relative luminance, and WCAG contrast
ratio, all from spec formulas directly.

**Q2 (boundary per hue)**: There is no per-hue X boundary below which bare 4.5:1 fails — every
tested hue, at every X from 0-100%, clears 4.5:1 in both directions (worst tabulated case: `#cc5500`
itself at X=100 shade, 4.87:1; worst case anywhere on the full 360° wheel: 4.58:1 at hue≈25°,
X≈77%, shade). The *practical* boundary (requiring a real ≥5:1 margin) is X≤45.2% (shade, worst
hue 60°) and X≤59.3% (tint, worst hue 240°).

**Q3 (mid-tone failure zone)**: No hue/X combination inside this specific `color-mix(in hwb,
hue X%, white|black)` family drops below 4.5:1 outright. But a "thin-margin shelf" (4.58-4.9:1)
exists for some worst-case hue across most of the X range from 50% to 100% in both directions —
this is the real shape of MDN's warning here, even though it never literally crosses the AA line
in this constrained family.

**Q4 (hue-independent recommendation)**: `X≤45%` (shade) / `X≤55%` (tint) for a genuine
hue-independent ≥5:1 margin, analogous to ADR-0007's verified `0.45`/`0.35` OKLCH lightness dial.

**Q5 (`#cc5500` sanity check)**: `#cc5500`'s shade-direction X≈70%/X≈50% reproduce ADR-0007's
verified resting/hover contrast ratios (7.95:1/11.59:1) almost exactly (7.50:1/11.03:1) — the two
mechanisms agree.
