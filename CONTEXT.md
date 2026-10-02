# Astro Components

An open-source library of copy-paste Astro + Tailwind components. This context covers the design system that makes them look and behave consistently: the tokens, theming mechanism, accessibility bar, and documentation convention every component is built against.

## Language

**Token**:
A single named design decision (a color role, a radius, a duration, a font weight) exposed as a CSS custom property consumed through Tailwind's `@theme`, so changing one value anywhere restyles every component that uses it.
_Avoid_: variable, design value

**Base token**:
A token that a whole derived scale is computed from via `calc()` (or an equivalent CSS function), rather than a value declared independently. None exist at the moment: with the move to Material 3 the old ones (`--color-primary`, `--radius`) were removed, since the color roles are generated whole into `colors.css` and M3's corner sizes are fixed rather than scaled from one dial. `--font-weight-semibold` is not a base token, since nothing is derived from it.
_Avoid_: root token, primary token (ambiguous with the `primary` color role)

**Role token**:
A token named for the situation it's used in (`--theme-duration-overlay`, `--ease-theme-overlay`) rather than its literal step (`--theme-duration-base`, `--ease-out`), defined via `var()` onto a value-layer token of the same property. Lets a component author pick by intent instead of by magnitude. Distinct from a [[Base token]]: a base token is what a scale derives *from*, a role token is a second name layered *on top of* an already-derived scale.
_Avoid_: semantic token, alias (too generic — every token is technically a CSS alias)

**Theme**:
The complete set of token values active for a given site — what you get by editing `src/styles/theme.css` (hand-written tokens) and regenerating `src/styles/colors.css` (M3 color roles, from the generator at `/colors`). Swapping a theme changes appearance only; it never changes a component's markup, props, or behavior.
_Avoid_: skin, style

**Color role**:
One of Material 3's named colors (`primary`, `on-primary`, `secondary-container`, `surface-container-high`, `outline-variant`, ...), generated into `src/styles/colors.css` as `--theme-color-<role>` with light and dark values. Components draw only from roles, never from a tonal-palette step. Which roles a component uses is fixed by its [[Variant]] or [[Background role]], not exposed as a separate `color` prop.
_Avoid_: color scheme, palette (a palette is the tonal scale a role is picked from), `colors` (plural)

**Variant**:
A named alternative treatment of a component, selected via a `variant` prop, following M3's own names where M3 has them: Button's `elevated`/`filled`/`tonal`/`outlined`/`text`, Tabs' `primary`/`secondary`, Details' `outlined`/`plain`. A variant fixes the color roles, border and elevation together, as M3 defines them. Other independent axes (`size`, `shape`) get one prop each rather than being folded into `variant` as a compound value.
_Avoid_: style, mode, `color` (a variant is more than a color choice)

**Background role**:
The M3 color role a container paints behind its content, chosen with a `bgColor` prop (`surface-container-high`, `primary-container`, `inverse-surface`, `transparent`, ...). Choosing one also sets the matching "on" role for text and re-points the component color roles that must stay readable on it (`--theme-color-link-text`, `--theme-color-focus-ring-on-bg`). [[BaseWrapper]] owns the full set; overlays accept a narrower subset (`OverlayBgColorType`, `PopoverBgColorType`) limited to the surfaces M3 uses for them.
_Avoid_: background color, theme (a theme is the whole token set)

**Wrapper background**:
`--theme-color-wrapper-bg`: the color actually behind a piece of content, set by the nearest [[BaseWrapper]] with a non-`transparent` [[Background role]] (or the page surface outside any wrapper). Read by descendants that must match their surroundings, most often a focus ring's offset (`ring-offset-(--theme-color-wrapper-bg)`).
_Avoid_: parent background, surface (a surface is one specific role)

**BaseWrapper**:
The [[Primitive component]] that renders one of a fixed set of sectioning/grouping elements (`as`: `div`, `section`, `header`, `footer`, `aside`, `main`, `article`, `figure`) and applies a [[Background role]]. `Section`, `Header`, `Footer` and `Aside` are thin [[Pattern component]]s over it, each fixing `as` to its own element; BaseOverlay's panel is one too.
_Avoid_: container, box, surface

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
A heading-tagged (`<h1>`–`<h6>`) piece of UI chrome scoped to one component's own visual weight — the tag exists only so assistive tech has a landmark to jump to, not to place it in a page's own heading hierarchy. `Dialog`'s `<h2>` headline is the current example, styled from M3's Headline Small regardless of where the dialog sits in the page's outline.
_Avoid_: heading (ambiguous with [[Document heading]]), title (too generic alone)

**Document heading**:
An `<h1>`–`<h6>` element belonging to a page's own content hierarchy, styled from one step of Material 3's type scale per level (h1 Display Small, h2–h4 Headline Large/Medium/Small, h5 Title Large, h6 Title Medium) rather than a [[Component title]]'s. The two must never be conflated just because they share an HTML tag — no component currently renders one.
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
