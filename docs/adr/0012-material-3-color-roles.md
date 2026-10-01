# Material 3 color roles replace the derived semantic tokens; dark values ship

> **Supersedes ADR-0007** in full, and the dark-mode-readiness clause of ADR-0004 ("no dark values are designed now").

ADR-0007 derived eight semantic tokens from one `--color-primary` using `oklch(from ...)` lightness dials. It said itself that OKLCH lightness is no contrast guarantee: a new base hue could drop below 4.5:1 again. It also had no dark values, no names for "the text that goes on this background", and no way for a component on a tinted background to find a readable link or focus-ring color. Each new role meant inventing a name and tuning a lightness by hand. Material 3 solves all of this with a published, contrast-checked role system, so we adopted it rather than keep growing our own.

We decided:

1. **Colors are M3 color roles, generated, not derived in CSS.** `src/styles/colors.css` holds every M3 scheme role (`primary`, `on-primary`, `primary-container`, `surface-container-high`, `outline-variant`, `inverse-surface`, the `-fixed` roles, ...), plus custom colors (`success`, `warning`) with their own four roles, as `--theme-color-<role>`, and each key color's tonal palette (point 6). The theme generator page at `/colors` (`src/pages/colors/index.astro` + `_colors.ts`, built on `@poupe/material-color-utilities`) produces them. You give it a source color and a scheme variant (default `fidelity`), and copy its output into `colors.css`. M3's HCT tone system picks each role's tone, so on/container pairs meet contrast for any source hue. That guarantee lives in the generator, not in our math.
2. **Every role ships a real dark value via `light-dark()`**, with `color-scheme: light dark` on `:root`, so the scheme follows the OS. This replaces ADR-0004's "readiness only" clause; that ADR's choice of `light-dark()` gated by `color-scheme` is now actually in use.
3. **Roles live in `:root`, not `@theme`, and are consumed with Tailwind's arbitrary-value syntax** (`bg-(--theme-color-primary)`, `text-(--theme-color-on-surface)`). No `bg-primary`-style utilities are generated for roles: a role's value is a `light-dark()` pair, and keeping roles out of the color utilities keeps them apart from the palette steps (point 6), which are utilities. The `--theme-` prefix marks project tokens apart from Tailwind's own.
4. **Components draw from roles only, chosen by their variant or background role, as M3 defines them.** Button's `filled` variant is `primary` with `on-primary`, `tonal` is `secondary-container` with `on-secondary-container`, and so on. A component never takes a free `color` prop (see `CONTEXT.md`'s **Variant** and **Color role**).
5. **Background roles carry their own link and focus-ring colors.** M3 has no link role, and `primary` isn't readable on every background a container can take. BaseWrapper's `bgColor` sets the background and its on-role, and re-points three component tokens for its descendants:
   - `--theme-color-link-text`: `primary` on surfaces, the on-role on containers, the `on-*-fixed-variant` role on fixed colors, `inverse-primary` on `inverse-surface`.
   - `--theme-color-focus-ring-on-bg`: the same mapping, except surfaces use `secondary`.
   - `--theme-color-wrapper-bg`: the background itself, for focus-ring offsets.

   `transparent` sets none of them, so content inherits from the nearest wrapper (see `CONTEXT.md`'s **Background role** and **Wrapper background**).
6. **The tonal palettes are Tailwind colors, for content, not for components.** The generator also emits each key color's tonal palette, 16 steps from `-10` (lightest) to `-950` (darkest), for primary, secondary, tertiary, neutral, neutral-variant and error. They go in an `@theme static` block in `colors.css`, named `--color-theme-<palette>-<step>`, so Tailwind generates real utilities for them (`bg-theme-primary-500`, `text-theme-neutral-900`). The block is `static` so every step is in the CSS even when no utility uses it, since the `/colors` swatches read them through `var()` in inline styles. They are for page content and one-off styling. Library components still draw only from roles. ADR-0007's concern holds for them: a palette step has no vetted pairing, so contrast is the author's job (and axe's). Steps are also light-scheme tones with no dark value, so they don't change with the color scheme the way roles do.

The guarantee is the same one ADR-0007 relied on: axe-core runs against whatever is actually rendered (ADR-0002). `BaseWrapper.spec.ts` renders every background role with text and a link, so axe checks all of them in light mode. Dark mode isn't covered by the suite yet.

This is hard to reverse once components are styled from M3 roles, and it's a real trade-off. We give up a palette defined by one CSS dial for a generated file that has to be regenerated whenever the brand color changes. In return we get M3's published role semantics and contrast-checked tones in both schemes.

## Consequences

- Changing the theme's colors means regenerating `colors.css` at `/colors`, not editing a base token. There's no longer a `--color-primary` dial (see `CONTEXT.md`'s **Base token**).
- ADR-0007's eight tokens (`--color-primary-control`, `--color-divider`, `--color-body`, ...) and its lightness dials are gone. Their nearest M3 equivalents are `primary`, `outline-variant`, `on-surface` and so on, chosen per component as M3 specifies.
- Dark mode now has real values, but the Playwright suite runs only in light mode. A dark-mode contrast regression wouldn't fail any test.
