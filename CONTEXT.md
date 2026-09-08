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
A component that supplies structural or interactive behavior (focus handling, open/close state, positioning) with little to no visual styling of its own, meant to be composed inside a pattern component rather than used directly. It's still an independently meaningful building block — generic enough that more than one [[Pattern component]] can compose it, and worth documenting on its own terms. `BaseOverlay` is the current example, composed by both `Dialog` and `Popover`. Declared on a component's [[Component documentation file]] as `role: primitive`. Contrast with [[Internal component]], which isn't independently reusable at all.
_Avoid_: base component, headless component

**Pattern component**:
The public, consumer-facing component a consumer reaches for and copy-pastes directly into their own markup (`Button`, `Dialog`, `Popover`, `Tab`, `Tabs`). Composing one or more primitives is common (`Dialog`/`Popover` build on `BaseOverlay`) but not required — `Button` is a pattern component with no primitive underneath it, just a styled native element. What makes a component a pattern component is that it's meant to be used directly, not that it's built on something else. Declared on a component's [[Component documentation file]] as `role: pattern`.
_Avoid_: composite component, styled component

**Internal component**:
A component that exists purely as an implementation detail of one specific other component, split into its own file for code organization rather than because it's an independently meaningful or reusable piece of the design system. Unlike a [[Primitive component]], it's never composed by more than one owner and carries no generic, reusable API of its own — its props are shaped by, and only make sense in terms of, that one owner's internals. `TabList` and `TabPanels` are the current examples: both are imported and rendered directly by `Tabs` alone, with props (`labels`, `randomId`) derived from `Tabs`' own build-time logic. Declared on a component's [[Component documentation file]] as `role: internal`, with its sole owner named in `parents`.
_Avoid_: private component, helper component

**Component title**:
A heading-tagged (`<h1>`–`<h6>`) piece of UI chrome scoped to one component's own visual weight — the tag exists only so assistive tech has a landmark to jump to, not to place it in a page's own heading hierarchy. `DialogConfirm`'s `<h3>` is the current example, styled from `--font-weight-title`/`--text-title`.
_Avoid_: heading (ambiguous with [[Document heading]]), title (too generic alone)

**Document heading**:
An `<h1>`–`<h6>` element belonging to a page's own content hierarchy, styled from its own scale (`--font-weight-heading-sm`/`-lg`; `--text-heading-xs`/`-sm`/`-md`/`-lg`/`-xl`/`-2xl`, one step per level, mapped `h1→2xl … h6→xs`) rather than a [[Component title]]'s. The two must never be conflated just because they share an HTML tag — no component currently renders one.
_Avoid_: heading level, page title

**Copy-paste component**:
A component distributed as source a consumer copies directly into their own project, rather than installed as a package dependency. The copied source is theirs to edit; there is no upstream link to keep in sync.
_Avoid_: package component, library component

**Component documentation file**:
The `documentation.mdx` file co-located in a component's folder (superseding the working name `examples.mdx`). Its frontmatter holds structured, machine-checkable facts — `name`, `description`, `role`, `meta`, the [[Prop manifest]], and `slots`/`cssProps`/`extends`/`parents` — consumed equally by a rendered props table for humans and by a coding agent. Its MDX body is empty; prose and live rendered examples live in the component's sibling [[Usage file]] and [[Example file]]s instead.
_Avoid_: examples.mdx (superseded name), examples file

**Usage file**:
The `usage.mdx` file co-located in a component's folder alongside its [[Component documentation file]]: one per component, frontmatter `title`/`description`/`show`, MDX body showing the component's baseline usage. `show` (`"both"` | `"code-only"` | `"preview-only"` | `"none"`) picks whether the body renders as a live preview, its raw source, both as a tab pair, or neither.
_Avoid_: example (ambiguous with [[Example file]]), demo

**Example file**:
An `example-NN-<slug>.mdx` file co-located in a component's folder: one per named variant or scenario (a component can have several), frontmatter `title`/`description`, MDX body showing that one variant. Always rendered as a live-preview/source-code tab pair — unlike a [[Usage file]], it has no `show` field, since showing both is the whole point.
_Avoid_: usage (ambiguous with [[Usage file]]), demo

**Prop manifest**:
The `props` array in a [[Component documentation file]]'s frontmatter: one entry per [[Own prop]], hand-authored and Zod-validated rather than derived from the component's actual `Props` type.
_Avoid_: prop schema, docs schema

**Own prop**:
A prop declared directly in a component's own `Props` type/interface, as distinct from one it only exposes by composing another component (e.g. Popover's `showCloseX` is an own prop; everything it gets via `BaseOverlayProps` is not). A [[Component documentation file]]'s [[Prop manifest]] lists only own props; props gained purely through composition are covered instead by the file's `extends` field, naming the composed [[Primitive component]] whose own documentation file covers them.
_Avoid_: inherited prop, flattened prop

**Component role**:
The `role` field in a [[Component documentation file]]'s frontmatter: `primitive`, `pattern`, or `internal`, naming which of the three a component is. Structural, not prose — put there so an agent can tell "don't use this directly" apart from "this is what you reach for" without parsing a sentence in `description`.
_Avoid_: kind, type (both already used elsewhere in the manifest for unrelated axes)

**Component slot**:
A named or default `<slot>` whose [[Component documentation file]] entry declares `kind: component` — the slot only accepts one or more instances of a specific named sub-component, rather than arbitrary content. Tabs' default slot is the current example: it only does anything sensible with `Tab` instances, so its manifest names `component: Tab` and `multiple: true` instead of describing that constraint in prose.
_Avoid_: children prop, restricted slot

**Required parent**:
An entry in a component's `parents` field: another documented component this one may only be used inside. Two different relationships can produce this restriction: being the sole accepted content of that parent's own [[Component slot]] (`Tab`'s `parents: [Tabs]`, mirroring Tabs' `slots[].component: Tab`), or being an [[Internal component]] that parent renders directly, with no slot involved at all (`TabList`/`TabPanels`' `parents: [Tabs]`). Which one applies is read off the component's own `role`, not encoded twice. A component with no `parents` field carries no such restriction — usable standalone or composed anywhere.
_Avoid_: allowed parent, valid ancestor
