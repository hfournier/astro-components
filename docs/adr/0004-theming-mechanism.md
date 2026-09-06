# Theming mechanism, class-merge convention & dark-mode readiness

> **Superseded in part by ADR-0007**: the "one base token derives a numbered 50-950 scale via `hsl(from ...)`" piece of this decision was replaced — the numbered scale is gone, replaced by curated semantic tokens derived via `oklch(from ...)`. Everything else below (the `@theme` mechanism itself, `calc()`-derived scales in general, the class-merge convention, and dark-mode readiness) still stands.

Color tokens already work via `@theme` + one base `--color-primary` token deriving a full scale via CSS relative-color syntax. This decision confirms/extends that pattern project-wide, resolves an existing class-merge inconsistency, and settles how the mechanism stays dark-mode-ready without designing a dark mode that doesn't exist yet.

- **Native-namespace tokens** (radius, font-weight, easing): extend the existing `@theme` block exactly like color — Tailwind v4 gives each an official namespace with real `var()` indirection, no departure needed.
- **Non-namespace tokens** (border-width, motion duration): Tailwind v4 has no such namespace for either — hand-roll plain CSS custom properties in the same `@theme` block, consumed via Tailwind's arbitrary-value `var()` syntax (e.g. `border-(length:--border-width-md)`), since no matching utility class will auto-generate.
- **Base-token derivation**: any scale with a natural single dial (radius chief among them) derives its whole scale from one base token via `calc()` multipliers, mirroring how color already derives its scale from one `--color-primary` — one edit reshapes every component consistently (e.g. from square toward pill), rather than requiring several literal steps to be kept in sync by hand.
- **Class-merge convention**: every component wraps its final class output in `twMerge()` (already a dependency, already used in `BaseOverlay.astro`). No `clsx` addition — Astro's `class:list` prop (and plain JS branching, as `Button.astro` already does) covers clsx's conditional-class job natively; `twMerge()` alone fixes the actual gap, a consumer's override class not reliably winning. Applying this to `Button.astro` and other holdouts is follow-on retrofit work.
- **Dark-mode readiness**: standardize on CSS's native `light-dark()` function, gated by the `color-scheme` property (set automatically from OS preference, or manually overridden via a plain class/attribute — never bound to framework/JS state) as the mechanism for whenever dark values are eventually designed. No dark values are designed now; this only confirms the mechanism doesn't foreclose the option.

This is foundational and hard to reverse once components are built against it, surprising without knowing Tailwind v4 doesn't tokenize every category equally, and reflects genuine trade-offs: `calc()`-derived vs. independent literal steps, `twMerge`-only vs. adopting `clsx`+`twMerge`, and `light-dark()` vs. class-based variable redefinition.

## Consequences

Tailwind v4 emits `@layer theme, base, components, utilities;`. Any hand-written CSS meant to override a token-driven value must sit in a layer after `utilities` (or be left unlayered) or it silently loses despite looking more specific — worth remembering the first time a component needs custom CSS outside Tailwind's utility classes.
