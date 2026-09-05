# Astro Components

An open-source library of copy-paste Astro + Tailwind components. This context covers the design system that makes them look and behave consistently: the tokens, theming mechanism, accessibility bar, and documentation convention every component is built against.

## Language

**Token**:
A single named design decision (a color step, a radius, a border width, a font weight) exposed as a CSS custom property consumed through Tailwind's `@theme`, so changing one value anywhere restyles every component that uses it.
_Avoid_: variable, design value

**Base token**:
A token that a whole derived scale is computed from via `calc()` (or an equivalent CSS function), rather than a value declared independently. `--color-primary` (the whole primary/secondary/grayish scale derives from it) and `--radius` (the radius scale derives from it) are base tokens; `--font-weight-semibold` is not, since it isn't derived from anything.
_Avoid_: root token, primary token (ambiguous with the `primary` color role)

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

**Copy-paste component**:
A component distributed as source a consumer copies directly into their own project, rather than installed as a package dependency. The copied source is theirs to edit; there is no upstream link to keep in sync.
_Avoid_: package component, library component
