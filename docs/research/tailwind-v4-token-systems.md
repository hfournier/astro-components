# Prior Art: Design Token Systems for Radius / Border-Width / Font-Weight / Motion (Tailwind v4)

Research date: 2026-09-05. Compiled to support a decision ticket about extending this repo's
existing color-token pattern (`src/styles/global.css`, `@theme` + CSS relative-color syntax) to
border-radius, border-width, font-weight, and motion duration/easing.

## Repo baseline (for reference)

- Color tokens live in one `@theme` block in `src/styles/global.css`: a single `--color-primary`
  source value, with `--color-primary-50…950`, `--color-secondary*`, `--color-grayish*` all
  derived via `hsl(from var(--color-primary) h s <L>%)` relative-color syntax. One variable edit
  re-tones the whole scale.
- Everything else is hardcoded per-component: breakpoint-escalating radius utilities
  (`rounded-xl md:rounded-2xl lg:rounded-3xl` in `BaseOverlay.astro`, `Dialog.astro`,
  `popover/Popover.astro`), `border-2` (`button/Button.astro`, `tab/TabList.astro`),
  `font-medium`/`font-semibold` (`button/Button.astro`, `tab/TabList.astro`), and inline
  duration/easing (`duration-300 ease-out` in `BaseOverlay.astro`, `duration-300` in
  `tab/TabList.astro`).
- `tailwind-merge` is already a dependency and already used for class merging in
  `BaseOverlay.astro` (`twMerge(...)` wrapping `class:list`), but not in `button/Button.astro`,
  which merges classes via plain `class:list` array concatenation only — an existing
  inconsistency relevant to the class-merging question below.

## Executive summary

- Tailwind v4's `@theme` mechanism cleanly extends from color to **radius**, **font-weight**, and
  **easing/animation** — each has an official namespace (`--radius-*`, `--font-weight-*`,
  `--ease-*`, `--animate-*`) that generates both a utility class *and* a real `:root` CSS custom
  property, exactly like `--color-*` does today.
- It does **not** extend as cleanly to **border-width** or **motion duration**: Tailwind v4 ships
  no `--border-width-*` namespace at all (`border-2` compiles straight to `border-width: 2px`,
  no variable indirection) and no per-step `--duration-*` scale — only a single
  `--default-transition-duration: 150ms` / `--default-transition-timing-function` pair used by
  the bare `transition`/`transition-colors` utilities. `duration-300` likewise compiles to a raw
  `transition-duration: 300ms` with no named token.
- shadcn/ui's `--radius` pattern (one base variable, `calc()`-derived scale) and Open Props'
  `--radius-1…6` / `--border-size-1…5` / `--font-weight-1…9` / `--ease-*` scales are the two most
  directly transplantable prior-art patterns for the categories Tailwind itself doesn't
  fully tokenize (border-width, duration).
- shadcn/ui's `cn()` (`clsx` + `tailwind-merge`) is the standard mechanism for letting a
  consumer's `class` reliably win over a component's internal Tailwind classes; this repo
  already depends on `tailwind-merge` but only uses it in one of several components — the
  inconsistency is worth flagging as its own finding.
- Storing tokens as single CSS custom properties (rather than baking them into many static
  utility classes) is dark-mode-and-`light-dark()`-friendly in principle, but Tailwind v4's
  `@theme` namespaces that map to *static* pre-generated utilities (radius, font-weight) don't
  literally need `.dark` overrides the way color values do — radius/font-weight are rarely
  theme-dependent. The real interaction point is Tailwind's cascade-layer order
  (`@layer theme, base, components, utilities`), which affects where token-driven custom CSS
  must be layered to reliably override or be overridden by utilities.

---

## 1. Tailwind v4's own `@theme` conventions

Source: [Tailwind CSS v4 — Theme variables](https://tailwindcss.com/docs/theme) (official docs),
[Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) (official blog),
[Tailwind CSS v4 — Functions and directives](https://tailwindcss.com/docs/functions-and-directives),
default theme source: `packages/tailwindcss/theme.css` in
[tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css).

**Mechanism.** `@theme` is a top-level-only at-rule (cannot nest inside selectors/media queries).
Each variable declared inside it does two things simultaneously: it defines a real CSS custom
property on `:root` (usable in arbitrary values, inline styles, or plain CSS via `var()`), *and*,
if its name matches a namespace Tailwind recognizes, it generates matching utility classes. This
is exactly the mechanism the repo's `--color-primary-*` scale already relies on — `--color-*` is
one of the recognized namespaces.

**Recognized namespaces** (from the official docs table) include, among others:

| Namespace | Utilities generated | Relevant to this repo |
|---|---|---|
| `--color-*` | `bg-*`, `text-*`, `border-*` color, etc. | already used |
| `--radius-*` | `rounded-*` | **yes** — radius work |
| `--font-weight-*` | `font-*` (`font-bold`, `font-semibold`, …) | **yes** — font-weight work |
| `--ease-*` | `ease-*` | **yes** — motion easing |
| `--animate-*` | `animate-*` (paired with `@keyframes` inside `@theme`) | possible for motion |
| `--text-*` | `text-*` (font size) | not in scope |
| `--tracking-*`, `--leading-*` | letter-spacing / line-height | not in scope |
| `--breakpoint-*`, `--container-*` | responsive/container variants | not in scope |

**Notably absent from the namespace table:** there is **no** `--border-width-*` namespace and
**no** per-step `--duration-*` (or `--transition-duration-*`) namespace. Confirmed against the
default theme source (`packages/tailwindcss/theme.css`): the only duration-related token is
`--default-transition-duration: .15s` (and `--default-transition-timing-function:
cubic-bezier(0.4, 0, 0.2, 1)`), used solely by the bare `transition`/`transition-colors`/etc.
utilities' unqualified defaults. `border-<number>` and `duration-<number>` are both **direct
numeric-scale utilities** — Tailwind computes `border-width: <number>px` /
`transition-duration: <number>ms` straight from the number in the class name, with no named
token or CSS variable in between. This is corroborated by a live Tailwind GitHub issue,
[tailwindlabs/tailwindcss#16639](https://github.com/tailwindlabs/tailwindcss/issues/16639),
where a user hits the same gap for `transition-property` variables and is told this is a known,
still-incomplete corner of v4's CSS-variable-ification of the old JS theme config.

**Default values actually shipped** (from `theme.css`, confirmed via direct fetch):
- `--radius-xs: 0.125rem` · `sm: 0.25rem` · `md: 0.375rem` · `lg: 0.5rem` · `xl: 0.75rem` ·
  `2xl: 1rem` · `3xl: 1.5rem` · `4xl: 2rem`
- `--font-weight-thin: 100` … `extralight: 200` · `light: 300` · `normal: 400` · `medium: 500` ·
  `semibold: 600` · `bold: 700` · `extrabold: 800` · `black: 900`
- `--ease-in: cubic-bezier(0.4, 0, 1, 1)` · `--ease-out: cubic-bezier(0, 0, 0.2, 1)` ·
  `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)`
- `--animate-spin`, `--animate-ping`, `--animate-pulse`, `--animate-bounce` (each a full
  `name duration timing-function iteration-count` shorthand, e.g.
  `--animate-spin: spin 1s linear infinite`)

**Extending vs. overriding.** Per the docs: add a new key to extend (`--font-script: ...`
alongside existing `--font-*`), override one key by redeclaring it (`--breakpoint-sm: 30rem`),
reset a whole namespace with `--color-*: initial;` then redefine only what you want, or nuke
everything with `--*: initial;` for a fully custom theme. This is the same lever this repo
already pulls for `--color-primary`.

**`@theme inline`.** Needed only when a theme variable's value itself references another CSS
variable that might not resolve identically at every DOM depth (e.g. wiring in a
framework-injected font variable). Not needed for the color pattern already in use here (which
resolves `--color-primary` directly, not through indirection), and likely not needed for
radius/font-weight/easing either since those are typically static literals, not references to
other runtime variables.

**Cascade layers.** From the [v4.0 blog post](https://tailwindcss.com/blog/tailwindcss-v4):
Tailwind v4 emits `@layer theme, base, components, utilities;` and states it uses "native cascade
layers — giving us more control than ever over how different style rules interact with each
other." The generated `--color-*`/`--radius-*`/etc. custom properties themselves land in the
`theme` layer (lowest priority of the four). Practical implication (see Pitfalls section): any
hand-written CSS overriding a theme-derived value has to either sit in a *later* layer than
`theme`, or be unlayered (unlayered CSS always wins over any named layer per the CSS cascade
spec), or it will silently lose to Tailwind's own generated rules.

---

## 2. shadcn/ui's CSS-variable theming

Source: [shadcn/ui — Theming](https://ui.shadcn.com/docs/theming) (official docs), `cn()` utility
source: [`apps/www/registry/default/lib/utils.ts`](https://github.com/shadcn-ui/ui/blob/a62a155aac6409d41ea27529be2eef65e3db2723/apps/www/registry/default/lib/utils.ts) in `shadcn-ui/ui`.

**Radius.** shadcn defines one base variable, `--radius`, and derives the whole radius scale from
it with `calc()` multipliers rather than independent literals:

```css
--radius-sm: calc(var(--radius) * 0.6);
--radius-md: calc(var(--radius) * 0.8);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.4);
--radius-2xl: calc(var(--radius) * 1.8);
--radius-3xl: calc(var(--radius) * 2.2);
--radius-4xl: calc(var(--radius) * 2.6);
```

Per the docs, "changing `--radius` updates the entire radius scale" — a consumer overrides a
single `:root` value and every `rounded-*` utility that points at `--radius-*` shifts together.
This is structurally identical to how this repo derives its whole color scale from one
`--color-primary`, just with `calc()` multiplication instead of relative-color-syntax lightness
steps.

**Color / dark mode.** Colors are semantic pairs (`--primary` / `--primary-foreground`, etc.),
each defined once under `:root` for light and re-defined under a `.dark` class selector for dark
— e.g. `:root { --primary: oklch(0.205 0 0); }` / `.dark { --primary: oklch(0.922 0 0); }`.
Components never reference light/dark conditionally in markup; they always use
`bg-primary`/`text-primary-foreground`, and the `.dark` class toggle on a wrapper flips every
consuming component at once purely through the variable redefinition. This is the direct
prior-art answer to "does overriding a token variable inside `.dark` just work" — yes, because
Tailwind compiles the utility to reference `var(--primary)`, not a baked-in literal, so
redefining the variable anywhere higher in the cascade (here, `.dark` acting as a more specific
selector within the same layer) changes what every utility using it resolves to.

**Class merging (`cn()`).** shadcn/ui's canonical utility, quoted in full from the primary
source:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`clsx` does conditional joining; `twMerge` (`tailwind-merge`) then resolves *conflicting*
Tailwind classes (e.g. a component's own `rounded-md` vs. a consumer-supplied `rounded-full`) so
the *last* one wins by CSS-utility identity rather than by cascade order/specificity — critical
because two conflicting Tailwind utility classes have identical specificity, so plain
concatenation is a coin flip decided by generation order, not intent. (Note: shadcn/ui has since
published a newer, faster drop-in replacement, [`shadcn-ui/cn`](https://github.com/shadcn-ui/cn),
with the same API — same conclusion applies.) This repo already depends on `tailwind-merge` and
already applies this exact pattern in `BaseOverlay.astro` (`twMerge(...)` around `class:list`),
but `button/Button.astro` merges classes with a bare `class:list` array (Astro's built-in
merge, which is concatenation, not conflict-resolution) — so a consumer passing `rounded-full` to
`Button` today is not guaranteed to override the component's own radius class.

---

## 3. Open Props

Source: [Open Props — sub-atomic styles](https://open-props.style/) (official site), source
files in [argyleink/open-props](https://github.com/argyleink/open-props) (`src/props.borders.css`,
`src/props.easing.css`, `src/props.animations.css`, `src/props.fonts.css` etc.).

**Naming conventions**, confirmed against source (`src/props.borders.css`):

- Radius: `--radius-1` (`2px`) … `--radius-6` (`8rem`), plus `--radius-round` (`1e5px`),
  `--radius-drawn-1..6` (hand-drawn multi-corner values), `--radius-blob-1..5` (organic blob
  shapes), and `--radius-conditional-*` (`clamp()`-based, viewport-aware radius that collapses to
  square corners at small sizes via `calc(100vw - 100%)` tricks).
- Border size: `--border-size-1: 1px` … `--border-size-5: 25px`.
- Font weight: `--font-weight-1` (100) … `--font-weight-9` (900) — same 100-step numeric scale as
  Tailwind's `--font-weight-*`, just numbered 1-9 instead of named `thin…black`.
- Easing: a much larger vocabulary than Tailwind's three keywords — strength-graded
  `--ease-1..5`, `--ease-in-1..5`, `--ease-out-1..5`, `--ease-in-out-1..5`, plus named
  `elastic`/`spring`/`bounce`/`step` variants and Robert Penner's classic
  `--ease-{circ,cubic,expo,quad,quart,quint,sine}-{in,out,in-out}` equations.
- Animation: `--animation-fade-in/out`, `--animation-slide-in/out-{up,down,left,right}`,
  `--animation-{spin,ping,blink,float,bounce,pulse}`, shake variants.

**Import model.** Fully opt-in / incrementally adoptable: a single full import (~4.0 kB
compressed) pulls in 500+ variables, or consumers import individual "PropPacks" per category
(e.g. only `animations.css`), plus an optional `normalize.css`/`normalize` extra for baseline
resets in light/dark variants. This is a pure CSS-custom-property library with no Tailwind
dependency — the relevant transplantable idea is the *category taxonomy* (radius / border-size /
font-weight / ease / animation as five independent, consistently-numbered scales) rather than
the import tooling itself, since this repo's `@theme` block is Tailwind-native already.

**Overriding without touching markup.** Same single-`:root`-variable-redefinition pattern as
everywhere else in this research: e.g. redefine `--brand: var(--brand-light)` at `:root` and flip
it to `var(--brand-dark)` inside a `prefers-color-scheme: dark` media query; consuming components
reference only `var(--brand)` and never know which mode is active.

---

## 4. Radix Themes

Source: [Radix Themes — Radius](https://www.radix-ui.com/themes/docs/theme/radius) and
[Radix Themes — Dark mode](https://www.radix-ui.com/themes/docs/theme/dark-mode) (official docs).

**Radius.** A 6-step scale, `var(--radius-1)` … `var(--radius-6)`, plus derived
`var(--radius-full)` and `var(--radius-thumb)` (both typically combined with CSS `max()` for
edge cases like a fully-rounded button that shouldn't over-round on tiny sizes). Rather than
exposing raw radius values for consumers to pick a number, Radix's `Theme` root component takes
a coarser **`radius` prop** (`none | small | medium | large | full`) that sets an underlying
`--radius-factor` multiplier — individual components then interpret the scale differently for
visual consistency (e.g. a `Card`'s "large" radius reads differently than a `Button`'s "large").
This is a more opinionated, component-aware layer on top of the plain-CSS-variable pattern; some
components (panels — `Card`, `Dialog`, `Popover`) don't expose an individual `radius` override
prop at all, deliberately, to keep visual consistency. Relevant nuance for the decision ticket:
a coarse "radius factor" abstraction (one dial that maps non-linearly per component) is a
heavier design commitment than "one CSS variable, `calc()`-scaled everywhere the same way"
(shadcn's approach) — worth flagging as an alternative, not a requirement.

**Dark mode.** Class-based, not `prefers-color-scheme`-only: Radix Themes recognizes
`className="light"`, `"light-theme"`, `"dark"`, `"dark-theme"` on an ancestor, and the root
`Theme` component's `appearance` prop can force one. The docs explicitly warn **against** binding
`<Theme appearance={resolvedTheme}>` directly to a hook like `next-themes`' `resolvedTheme`,
because that reintroduces an SSR/hydration flash — instead, integrate purely through class
switching and let CSS variable redefinition under the matching class do the work, no JS-driven
prop plumbing. This is a direct, documented pitfall about *how not to* wire dark mode even when
using a token system that's otherwise "just CSS variables."

---

## 5. Context: Material Design 3 / Adobe Spectrum (naming conventions only)

Not deeply investigated (time-boxed as optional per the brief), but for naming-convention
context: Material Design 3 tokens use a `--md-sys-*` / `--md-ref-*` two-tier reference/system
namespace (e.g. `--md-sys-shape-corner-large`), and Adobe Spectrum (via Spectrum CSS / Spectrum 2
tokens) uses `--spectrum-*` prefixed tokens with explicit `-{scale}` steps
(`--spectrum-corner-radius-100`, `--spectrum-border-width-200`, etc.), plus dedicated "alias"
tokens that redirect a semantic name to a primitive value — conceptually the same
base-variable-plus-derived-scale idea as shadcn's `--radius`, just with an extra indirection
tier (primitive → alias → component). Neither uses Tailwind; cited here only for the
double-indirection naming pattern (primitive scale vs. semantic alias), which is a heavier
structure than this repo likely needs at its current size.

---

## Pitfalls

1. **Tailwind v4 doesn't fully "theme-ify" every category.** Radius, font-weight, and easing get
   real namespaces (`--radius-*`, `--font-weight-*`, `--ease-*`) with `var()` indirection built
   in by Tailwind itself — extending the existing color pattern to these is low-friction (add
   keys to the existing `@theme` block, exactly like `--color-primary`). Border-width and
   duration do **not**: `border-2` and `duration-300` compile straight to literal
   `border-width`/`transition-duration` declarations, no CSS variable involved, confirmed against
   `packages/tailwindcss/theme.css` and reinforced by the still-open Tailwind issue
   [#16639](https://github.com/tailwindlabs/tailwindcss/issues/16639) about the analogous
   `transition-property` gap. A token scale for these two categories has to be **hand-rolled**
   (e.g. define `--border-width-thin`/`--border-width-thick` and `--duration-fast`/`-slow`
   custom properties in the same `@theme` block, then reference them via Tailwind's arbitrary-
   value/custom-property syntax — `border-(length:--border-width-thick)`,
   `duration-(--duration-fast)` — rather than expecting `border-thick`/`duration-fast` utility
   classes to be auto-generated, because those two namespaces aren't in Tailwind's recognized
   list).
2. **Cascade layers can silently defeat a hand-written override.** Tailwind v4 emits
   `@layer theme, base, components, utilities;` ([source](https://tailwindcss.com/blog/tailwindcss-v4)).
   A rule in an earlier-declared layer always loses to a rule in a later layer regardless of
   selector specificity, and any CSS written *outside* an `@layer` block is implicitly "unlayered"
   and beats every named layer. Practically: theme-derived custom properties/utilities Tailwind
   generates live in the `theme`/`utilities` layers; if this project ever hand-writes plain CSS
   to override a token-driven value, that CSS needs to be deliberately placed in a layer that
   sorts after `utilities` (or left unlayered) or it will lose even though it "looks" more
   specific.
3. **Dark-mode variable overrides "just work" only when the utility itself is var()-driven.**
   shadcn's `.dark { --primary: ... }` pattern only works because Tailmind compiles
   `bg-primary` to `background-color: var(--primary)`. This repo's color tokens are already
   built this way (relative-color syntax over `var(--color-primary)`), so a future `.dark`
   override of `--color-primary` would work identically. But radius/font-weight tokens compiled
   from `@theme` are typically static per-breakpoint utility classes with no light/dark
   dependency in the first place (radius doesn't usually change with color scheme) — so the
   "does overriding inside `.dark` work" question is largely moot for those categories; it's a
   real question only for anything color-adjacent (e.g. a focus-ring color token).
4. **Radix Themes' explicit warning**: don't drive the dark-mode class/prop from framework state
   (`<Theme appearance={resolvedTheme}>`) — bind dark mode purely through a class/attribute toggle
   applied ahead of hydration, or you reintroduce SSR flash-of-wrong-theme, even though the token
   values themselves are "just CSS variables."
5. **Inconsistent class-merge safety already exists in this repo.** `BaseOverlay.astro` uses
   `twMerge(...)` (tailwind-merge) so consumer classes reliably override internal ones;
   `button/Button.astro` uses Astro's plain `class:list` array, which is concatenation only. If a
   token refactor introduces more consumer-overridable utility classes (radius, border-width,
   font-weight), the safe-override guarantee should be applied consistently, not per-component
   ad hoc.

---

## Answers to the decision questions

**Does `@theme` + CSS custom properties extend cleanly from color to radius/border-width/font-weight/motion?**
Cleanly for **radius**, **font-weight**, and **easing** — Tailwind v4 ships official
`--radius-*`, `--font-weight-*`, and `--ease-*` namespaces that already generate both utilities
and `var()`-backed custom properties, so the existing `@theme` block just needs more keys
alongside `--color-primary`, no new mechanism. **Not clean** for **border-width** and **motion
duration** — Tailwind v4 has no official namespace for either (`border-2`/`duration-300` compile
to hardcoded literals), so those two require defining custom `--*` variables by hand inside
`@theme` and consuming them via Tailwind's `(--custom-property)`/arbitrary-value syntax rather
than expecting new named utility classes to appear automatically. This asymmetry (some
namespaces "native," two "DIY") is the single most decision-relevant fact from this research.

**How do shadcn-style libraries make consumer `className`/`class` reliably win over internal classes?**
Via `cn()` = `twMerge(clsx(inputs))` — `clsx` for conditional joining, `tailwind-merge` for
resolving same-property Tailwind class conflicts by keeping the last one rather than relying on
cascade order (source:
[shadcn-ui/ui utils.ts](https://github.com/shadcn-ui/ui/blob/a62a155aac6409d41ea27529be2eef65e3db2723/apps/www/registry/default/lib/utils.ts)).
This repo already has `tailwind-merge` installed and already uses this exact pattern in
`src/components/BaseOverlay.astro`, but not in `src/components/button/Button.astro` (plain
`class:list`) — worth reconciling as part of any token-system rollout so radius/border-width/
font-weight overrides passed in by consumers are guaranteed to win everywhere, not just in the
overlay components.

**Does storing tokens as single CSS custom properties leave room for `light-dark()` or
`prefers-color-scheme` later?**
Yes. [MDN — `light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
(Baseline since May 2024) composes directly with `var()`:
`background-color: light-dark(var(--light-bg), var(--dark-bg));`, gated by
`color-scheme: light dark;` on `:root` (or overridden locally via `.light`/`.dark` scoped
`color-scheme` declarations). Because this repo's color scale is already one indirection level
(`--color-primary` → derived shades via relative-color syntax), swapping in `light-dark()` later
only requires redefining the *source* variable(s), not touching any component markup or utility
classes — exactly the same non-invasive-override property that motivated tokenizing color in the
first place. The same holds for any future token category expressed as a single custom property
rather than baked into multiple discrete utility classes.
