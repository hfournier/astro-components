# Semantic color tokens replace the raw 50-950 scale; derivation moves to OKLCH

Supersedes the color-scale portion of ADR-0004 (the `@theme`/class-merge/dark-mode decisions there stand; only "one base token derives a numbered 50-950 scale via `hsl(from ...)`" is replaced).

Two independent WCAG AA contrast failures shipped from the same root cause: a raw scale step (`primary-600`) that isn't safe as text-on-white, reused in two unrelated components without anything catching it until axe-core did.

- #24: `Button`'s solid-primary hover background used `primary-600` with white text (4.31:1, fails 4.5:1).
- #25: `TabList`'s hover tab-label text used `primary-600` against a white page background (4.31:1, fails 4.5:1).

Both were fixed component-by-component. #28 asked the systemic question: what stops a third component from reintroducing the same bug? Two follow-on constraints emerged during that discussion: the fix has to hold for **any** user-supplied base color, not just today's `#cc5500` — the whole scale derives from one `--color-primary` dial (ADR-0004), and HSL lightness doesn't predict WCAG relative luminance consistently across hues (a yellow and a blue at the same `L%` have very different luminance), so a fix that hardcodes "step N is safe" is a fact about today's palette, not a general one; and exposing a raw numbered scale at all means any future component can reach for an unsafe step/role combination — a documented contrast table or lint rule reduces the odds, it doesn't remove the option.

**Delete the raw 50-950 scale as public API.** `--color-primary-*`, `--color-secondary-*`, and `--color-grayish-*` (all 33 numbered tokens, plus the unused bare `--color-secondary`) are removed from `@theme` entirely — not hidden, not renamed, gone. Nothing in the codebase needs an arbitrary intermediate step; every real usage maps to one of a small set of roles. Since Tailwind v4 only generates `bg-*`/`text-*`/`border-*` utilities for names registered under `--color-*` in `@theme`, removing the numbered entries means `bg-primary-400` (or any other unvetted step) doesn't exist as a class — there's nothing to misuse.

**Replace them with 8 semantic tokens**, each mapped from real usage found across the codebase:

| Token | Replaces | Role | Contrast requirement |
|---|---|---|---|
| `--color-primary-control` | `primary-700`/`800` (mixed per-component) | Solid-fill background (with white text) or text/border-on-white for primary controls | 4.5:1 |
| `--color-primary-control-hover` | `primary-600`/`700`/`800` (mixed) | Same, hover state | 4.5:1 |
| `--color-secondary-control` | `secondary-600` | Same role, secondary color | 4.5:1 |
| `--color-secondary-control-hover` | `secondary-500`/`700` | Same, hover state | 4.5:1 |
| `--color-divider` | `grayish-200` | Borders/dividers | 3:1 (non-text UI, WCAG 1.4.11) |
| `--color-container` | `grayish-50` | Panel/surface backgrounds | none (near-white, sits under other tokens) |
| `--color-icon` | `grayish-500` | Icon color | 3:1 (graphical object) |
| `--color-body` | `grayish-950` | Default body text | 4.5:1 |

The `-control`/`-control-hover` pair is deliberately reused everywhere a primary/secondary color pairs with white, in either direction (fill-with-white-text or text-on-white) — contrast ratio is symmetric under swapping foreground/background, so one pair covers both. `TabList`'s decorative sliding-indicator bar also reuses `-control`/`-control-hover` (previously tuned separately to `primary-600`/`700`, since a decorative bar only needs 3:1) rather than getting its own tokens — one fewer role to keep track of, at the cost of a slightly darker, less vibrant bar than before.

**Move scale derivation from `hsl(from ...)` to `oklch(from ...)`.** Two shared lightness dials replace per-color hand-tuning:

```css
--control-lightness-resting: 0.45;
--control-lightness-hover: 0.35;

--color-primary-control: oklch(from var(--color-primary) var(--control-lightness-resting) c h);
--color-primary-control-hover: oklch(from var(--color-primary) var(--control-lightness-hover) c h);
--color-secondary-control: oklch(from var(--color-primary) var(--control-lightness-resting) c calc(h + 180));
--color-secondary-control-hover: oklch(from var(--color-primary) var(--control-lightness-hover) c calc(h + 180));
```

Both hue families now pull the *same* lightness value by construction, so a role's contrast character can't drift between colors by accident (which is how #24 and #25 ended up with different, independently-tuned resting/hover steps for what was conceptually the same role). Verified for the current base color `#cc5500` (OKLCH `L 0.59 C 0.169 H 45.5°`) by computing actual sRGB + WCAG relative luminance (not read off a color picker):

| Role | L | Contrast vs white, primary (H 45.5°) | Contrast vs white, secondary (H 225.5°) |
|---|---|---|---|
| control (resting) | 0.45 | 7.95:1 | 6.49:1 |
| control-hover | 0.35 | 11.59:1 | 9.89:1 |

Both comfortably clear 4.5:1 for both hues at the same L. `--color-divider`/`-icon`/`-body` use the same hue at low chroma (`calc(c * 0.12)`) with independently chosen lightness values (0.85 / 0.55 / 0.2) — these aren't contrast-critical in the same way, so they weren't tuned to a target ratio, just to roughly the prior visual weight. `--color-container` (L 0.96) needed a much lower chroma fraction (`c * 0.03`) than the others: a near-white surface shows a given chroma as a far more visible tint than a mid or dark tone does at the same chroma, so the shared 0.12 factor read as a distinct peach rather than a neutral panel background — caught visually, not by any contrast check, since this role has no contrast requirement to fail.

**OKLCH lightness is not a formal contrast guarantee.** WCAG 2.x relative luminance still weights green far more than blue or red; OKLCH's perceptual uniformity narrows how much a given L shifts in luminance across hues, it doesn't eliminate it. If `--color-primary` is ever changed to a hue nothing here was checked against, `0.45`/`0.35` could theoretically land below 4.5:1 again. **The actual guarantee is unchanged from #24/#25's tests**: the Playwright hover tests in `Button.spec.ts` and `Tabs.spec.ts` run axe-core against whatever is actually rendered, not a hardcoded expectation — they'll catch a bad base-color pick regardless of the derivation math. This ADR reduces how often that check would ever go red; it doesn't replace it.

This is hard to reverse once components are built against a semantic-only palette (reintroducing a numbered scale later means re-auditing every consumer for which role it actually needs), surprising without knowing Tailwind v4 only generates utilities for names registered in `@theme` (so deleting a token deletes the class, not just the variable), and reflects a real trade-off: a curated, misuse-resistant token set vs. the improvisational freedom a numbered scale gives every future component.

## Consequences

- Every component consuming a numbered step needed retrofitting in the same change: `Button`, `TabList`, `Dialog`, `Popover`, `BaseLayout`. There's no incremental migration path once the numbered tokens are deleted — this is why it shipped as one PR rather than sequenced.
- The whole existing palette recolors simultaneously (OKLCH lightness ≠ HSL lightness numerically for the same label), a visible but expected side effect, not a regression: focus rings, indicator bars, and panel borders all shift slightly.
- A future component that needs a role not on this list (e.g. a "danger" or "success" color) adds a new named semantic token deliberately, the same way `-control`/`-divider`/etc. were added — it does not get a numbered scale to freely pick a step from. This is the tradeoff for closing off invalid combinations: less improvisation, more upfront naming.
