# `color-mix(in hwb, ...)` replaces `oklch(from ...)`; dark mode ships real values

> **Supersedes ADR-0004's dark-mode-readiness clause**: `color-scheme: light dark` + `light-dark()`
> now ships real per-role values, not just the mechanism ("no dark values are designed now" is
> retired). ADR-0004's other decisions (the `@theme` mechanism, `calc()`-derived scales,
> `twMerge()`-only class-merging) still stand.
>
> **Supersedes ADR-0007's derivation formula**: `oklch(from var(--color-primary) L c h)` is
> replaced project-wide by `color-mix(in hwb, var(--color-primary) X%, white|black)`.
> `oklch(from ...)` is fully retired — nothing in the codebase keeps it. ADR-0007's semantic-token
> roster (the 8 roles, their contrast requirements, the reasoning for deleting the numbered
> 50-950 scale as public API) still stands; only the formula computing each role's value changes.

Two independent findings drove this, both surfaced while charting the design-system map
(issue #1) into tickets:

- Testing `color-mix(in hwb, ...)` against `hwb()` alone and against `oklch(from ...)` directly
  (the `src/styles/theme.css` prototype's switchable-mode scaffold) found `color-mix()` + `hwb`
  gives more visually consistent shades than `hwb()` alone, especially in darker shades. A
  switchable oklab/oklch/hwb mode was dropped from the prototype rather than shipped as a
  project-wide option — three color spaces to WCAG-verify for every role is complexity this
  project doesn't need, when one (well-verified) space does the job.
- ADR-0007 deleted the numbered 50-950 scale as **public API** but the `theme.css` prototype had
  quietly kept an equivalent scale as **private derivation plumbing** (`--theme-color-primary-50`
  through `-950`, never registered in `@theme`). That's the same failure mode ADR-0007's own
  rationale already rejects — hiding a scale from consumers doesn't stop this codebase's own
  future roles from reaching into it the way #24/#25 did to the public scale. **The numbered scale
  is gone entirely, public or private.** Every role token in this ADR derives its value straight
  from `--color-primary`, with its own named mix-percentage dial — no intermediate scale, no
  private token, matching CONTEXT.md's [Private token] entry (added while charting this ticket)
  and its own "no token should reach for an unvetted step" logic.

`src/styles/theme.css` — explicitly scratch/prototype, never a second source of truth — is
**deleted**; everything from it worth keeping is folded into `global.css`'s `@theme` block below.

## Decision

1. **Every role token derives via `color-mix(in hwb, var(--color-primary) X%, white|black)`**,
   `X` a named percentage dial (`--control-mix-resting`, `--control-mix-hover`, `--icon-mix`,
   `--body-mix`, `--divider-mix`, `--container-mix`) — the same relationship ADR-0007 had between
   its two OKLCH lightness dials and the roles built on them, just one shared `X` per role instead
   of a shared `L`. Secondary's 180°-rotated hue is produced with `hwb(from var(--color-primary)
   calc(h + 180) w b)` inline, the one relative-color-syntax step `color-mix()` itself can't do
   (it interpolates toward an endpoint, it doesn't rotate hue) — this is the only place relative
   color syntax survives; `oklch(from ...)` itself is gone.
2. **`color-scheme: light dark` + `light-dark()` ship real values now**, superseding ADR-0004's
   readiness-only stance. Every color role becomes a `light-dark(light-value, dark-value)` pair:
   the light branch mixes toward **black** (dark, readable against white), the dark branch mixes
   toward **white** (light, readable against a dark surface) — the *same* named `X` in both
   branches, just aimed at the mode-appropriate neutral endpoint, so a role's "how much brand hue
   survives" character doesn't drift between modes any more than it drifts between primary and
   secondary.
3. **`--color-surface` gets a real dark value**: `light-dark(#fff, #0a0a0a)`. The dark value is a
   literal, not derived from `--color-primary` — a primary-tinted dark surface wasn't tested and
   isn't what any component currently renders; a plain near-black keeps today's `bg-white` /
   `text-body` literals in Dialog/Popover/CodePreview meaningful once dark mode is live.
4. **A new `--color-on-control` token** (`light-dark(white, black)`) replaces the `text-white`
   literal hardcoded in every solid-fill consumer (Button's solid variant and its outline-hover
   state, Header's chrome bar). This is a new finding, not something the grilling session had
   already settled — see "The fill/text-pairing conflict" below for why it's necessary.
5. **`oklch(from ...)` is fully retired.** Confirmed by search: the only remaining occurrences in
   the codebase before this change were `global.css` and the now-deleted `theme.css`; no component
   or other stylesheet referenced it directly. Nothing keeps it.

## Verification

Same methodology as ADR-0007 and issue #53's research: real sRGB + WCAG 2.x relative luminance and
contrast ratio, computed directly from the CSS Color 4 spec formulas (not a color picker), swept
across hues at **full saturation** (`hwb(h, 0%, 0%)`) — the worst case any `--color-primary` could
ever be, not just today's `#cc5500`. This is a stronger guarantee than ADR-0007's own table, which
was only checked against `#cc5500` itself.

### `-control` / `-control-hover` (needs 4.5:1)

Light mode mixes toward black, verified against white text/surface. Dark mode mixes toward white,
verified against the `#0a0a0a` dark surface. `--control-mix-resting: 45%`, `--control-mix-hover:
25%` — chosen from the universal safe-X boundary below with real margin, not just past the bare
4.5 line:

| X (shade, light) | worst-case contrast vs. white | worst hue |
| ----------------- | ------------------------------ | --------- |
| 50%                | 4.22 (fails)                   | 60°       |
| **45%**            | **5.04**                       | 60°       |
| 40%                | 6.06                           | 60°       |
| 25%                | 10.80                          | 60°       |

| X (tint, dark) | worst-case contrast vs. `#0a0a0a` | worst hue |
| --------------- | ----------------------------------- | --------- |
| 50%              | 6.05                                 | 240°      |
| **45%**          | **6.91**                             | 240°      |
| 25%              | 11.45                                | 240°      |

Both dials clear 4.5:1 with real margin (5.04:1 / 6.91:1 at the weakest hue) for **any** hue at
full saturation, in both modes — a stronger guarantee than ADR-0007's dials, which were verified
only against `#cc5500`. (This reproduces issue #53's own boundary-search numbers almost exactly —
that research found X≤45.2% as the universal ≥5:1 shade boundary at worst hue 60°, and X≤45% here
lands at 5.04:1, confirming the two independent scripts agree.)

Per-hue spread at the chosen dials (12 hues, full saturation):

| hue  | shade 45% vs. white | shade 25% vs. white | tint 45% vs. `#0a0a0a` | tint 25% vs. `#0a0a0a` |
| ---- | -------------------- | -------------------- | ------------------------ | ------------------------ |
| 0°   | 12.17                 | 17.27                 | 8.86                      | 12.71                     |
| 30°  | 9.06                  | 14.77                 | 12.89                     | 15.63                     |
| 60°  | **5.04**               | 10.80                 | 18.80                     | 19.15                     |
| 90°  | 5.81                  | 11.74                 | 17.04                     | 18.10                     |
| 120° | 6.10                  | 12.15                 | 15.84                     | 17.23                     |
| 150° | 6.00                  | 12.01                 | 16.25                     | 17.53                     |
| 180° | 5.70                  | 11.66                 | 16.84                     | 17.88                     |
| 210° | 11.42                 | 16.42                 | 10.94                     | 14.36                     |
| 240° | 16.85                 | 19.56                 | **6.91**                  | 11.45                     |
| 270° | 14.76                 | 18.51                 | 8.11                      | 12.31                     |
| 300° | 10.65                 | 16.28                 | 9.86                      | 13.36                     |
| 330° | 11.76                 | 16.98                 | 9.27                      | 13.00                     |

`#cc5500` sanity check (today's actual `--color-primary`, `hwb(25°, 0%, 20%)`, well under full
saturation): resting/hover reproduce ADR-0007's already-verified `oklch` reference points
(7.95:1 / 11.59:1) almost exactly — `rgb(92,38,0)` at 12.11:1 (light, resting) is actually *more*
conservative than ADR-0007's dial here because `#cc5500` isn't the worst-case hue; the 45%/25%
dials were chosen for the worst case, not tuned to today's color the way ADR-0007's were.

### `--icon-mix` (needs 3:1) and `--body-mix` (needs 4.5:1)

Same full-saturation, worst-hue methodology:

| Role (X)      | light (shade, vs. white) | dark (tint, vs. `#0a0a0a`) |
| -------------- | ------------------------- | ---------------------------- |
| icon (50%)     | 4.22 (worst hue 60°)       | 6.05 (worst hue 240°)         |
| body (20%)     | 13.01 (worst hue 60°)      | 12.87 (worst hue 240°)        |

Both clear their target with real margin at any hue. `--divider-mix` (15%) and `--container-mix`
(6%) are **not** independently checked against a contrast target — same position ADR-0007 already
took for these two roles ("aren't contrast-critical in the same way… just tuned to roughly the
prior visual weight"), carried forward unchanged.

### The fill/text-pairing conflict, and `--color-on-control`

ADR-0007 established `-control`/`-control-hover` as doing two jobs with one value: a solid-fill
background (paired with literal white text) and a text/border color sitting on `--color-surface`.
That works in light mode because both jobs want the *same* thing — a color dark enough to read
against white. Shipping a real dark value breaks that symmetry: the dark-mode value now needs to
be **light** (to read as text against the dark surface), and a light fill paired with literal
white text fails outright.

This isn't a tuning problem — it's a hard ceiling. For any single luminance `L` to clear 4.5:1
against both pure white *and* a near-black surface simultaneously, the best that's mathematically
achievable is the crossover point where `contrast(L, white) = contrast(L, black)`; solving that
puts the ceiling at **~4.58:1** for a literal-black surface and lands *just under* 4.5:1 once the
surface is `#0a0a0a` instead of pure black — and only at one exact `L`, leaving no room for a
second, distinguishable hover value on either side of it. No choice of dial threads this needle.

**Resolution**: `-control`'s value stays optimized for its text-on-surface job (verified above).
For the fill job, a new token, `--color-on-control: light-dark(white, black)`, supplies the
paired text/icon color instead of a literal `text-white`. It isn't hue-dependent: the "Per-hue
spread" table above already shows every fill value clears 4.5:1 against literal white (light mode)
and black (dark mode, `tint45%`/`tint25%` vs. `#0a0a0a` numbers upper-bound the vs.-pure-black
case, which is never smaller). `Button.astro`'s solid variant, its outline-hover state, and
`Header.astro`'s chrome bar now read `text-on-control` instead of `text-white`.

This is deliberately **not** `contrast-color()` — issue #52, still open, is where that mechanism
gets decided (scoped to solid-fill text specifically); `--color-on-control` is a plain
hand-verified `light-dark()` pair, consistent with how every other token in this ADR ships a real
dark value. If #52 lands `contrast-color()` for solid fills, it supersedes this one token, not the
rest of this ADR.

## Consequences

- `src/styles/theme.css` is deleted. Its switchable-color-space scaffold and private 50-950 scale
  are gone, not migrated — neither survived this ADR's decisions.
- Every color-bearing token in `global.css`'s `@theme` block now carries a real dark value; toggling
  `color-scheme` (OS preference, or a manual override per ADR-0004's original mechanism) changes
  every component's rendered colors with no component-level code change, except the three
  `text-white` → `text-on-control` call sites this ADR touches directly.
- No Playwright/axe-core coverage runs in a forced dark `color-scheme` yet — every existing a11y
  test (Button, Tabs, Dialog, Popover) still only exercises the light branch. The WCAG table above
  is this ADR's guarantee for the dark branch in the same sense ADR-0007's table was for light:
  real math, not yet backed by an automated dark-mode check. Adding that coverage is follow-on
  work, not part of this ticket.
- `--color-on-control` is a new role not in ADR-0007's original 8-token roster; CONTEXT.md's
  [[Role token]]/[[Composite token]] vocabulary already covers it without a new term.
- A future `--color-primary` at full saturation now renders noticeably darker (light mode) or
  lighter (dark mode) at the `-control` roles than `#cc5500`'s own comparatively gentle values —
  the deliberate cost of a dial verified for any hue rather than tuned to today's brand color.
