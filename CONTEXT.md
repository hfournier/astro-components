# Astro Components

An open-source library of copy-paste Astro + Tailwind components. This context covers the design system that makes them look and behave consistently: the tokens, theming mechanism, accessibility bar, and documentation convention every component is built against.

## Language

**Token**:
A single named design decision (a color step, a radius, a border width, a font weight) exposed as a CSS custom property consumed through Tailwind's `@theme`, so changing one value anywhere restyles every component that uses it.
_Avoid_: variable, design value

**Base token**:
A token that a whole derived scale is computed from via `calc()` (or an equivalent CSS function), rather than a value declared independently. `--color-primary` (the whole primary/secondary/grayish scale derives from it) and `--radius` (the radius scale derives from it) are base tokens; `--font-weight-semibold` is not, since it isn't derived from anything.
_Avoid_: root token, primary token (ambiguous with the `primary` color role)

**Role token**:
A token named for the situation it's used in (`--font-weight-nav`, `--radius-container`) rather than its literal step (`--font-weight-semibold`, `--radius-xl`), defined via `var()` onto a value-layer token of the same property. Lets a component author pick by intent instead of by magnitude. Distinct from a [[Base token]]: a base token is what a scale derives *from*, a role token is a second name layered *on top of* an already-derived scale.
_Avoid_: semantic token, alias (too generic — every token is technically a CSS alias)

**Theme**:
The complete set of token values active for a given site — what you get by editing `src/styles/global.css`. Swapping a theme changes appearance only; it never changes a component's markup, props, or behavior.
_Avoid_: skin, style

**Color role**:
A semantic name for which color scale a component draws from (`primary`, `secondary`, `grayish`), independent of how that scale is styled onto the component. Exposed on components as the `color` prop (singular — one role is active at a time).
_Avoid_: color scheme, palette (palette is the scale itself, e.g. "the primary palette"), `colors` (plural; the prop takes one value)

**Variant**:
A named alternative treatment of a component's structural/shape axis, selected via a `variant` prop (e.g. Button's `solid` vs `outline`). Reserved exclusively for that one axis — a component with more than one independent axis (color role, size, ...) gets one prop per axis rather than folding them into `variant` as a compound value.
_Avoid_: style, mode, using `variant` for any axis other than structure/shape

**Primitive component**:
A component that supplies structural or interactive behavior (focus handling, open/close state, positioning) with little to no visual styling of its own, meant to be composed inside a pattern component rather than used directly. `BaseOverlay` is the current example.
_Avoid_: base component, headless component

**Pattern component**:
A component built on top of one or more primitives that adds the actual visual styling and public API a consumer reaches for (`Dialog`, `Popover`, `Tab`). This is what gets copy-pasted.
_Avoid_: composite component, styled component

**Component title**:
A heading-tagged (`<h1>`–`<h6>`) piece of UI chrome scoped to one component's own visual weight — the tag exists only so assistive tech has a landmark to jump to, not to place it in a page's own heading hierarchy. `DialogConfirm`'s `<h3>` is the current example, styled from `--font-weight-title`/`--font-size-title`.
_Avoid_: heading (ambiguous with [[Document heading]]), title (too generic alone)

**Document heading**:
An `<h1>`–`<h6>` element belonging to a page's own content hierarchy, styled from its own scale (`--font-weight-heading-sm`/`-lg`; `--font-size-heading-xs`/`-sm`/`-md`/`-lg`/`-xl`/`-2xl`, one step per level, mapped `h1→2xl … h6→xs`) rather than a [[Component title]]'s. The two must never be conflated just because they share an HTML tag — no component currently renders one.
_Avoid_: heading level, page title

**Copy-paste component**:
A component distributed as source a consumer copies directly into their own project, rather than installed as a package dependency. The copied source is theirs to edit; there is no upstream link to keep in sync.
_Avoid_: package component, library component
