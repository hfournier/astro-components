# Prop-naming convention for component APIs

Components need predictable prop names so both humans and coding agents can use one correctly without reading its source — copy-paste components have no editor tooling nudging consumers toward the right shape. We decided:

1. **Boolean props split by meaning**: `show*` for a prop that toggles whether optional UI renders (e.g. Popover's `showCloseX`); `is*`/`has*` for a prop describing state or capability rather than rendering. Collapsing to one prefix would lose that distinction.
2. **The color-role prop is `color`** (singular), not `colors` — it takes exactly one value, so the name should say so. Button's existing `colors` prop is renamed under this convention (the rename itself is follow-on retrofit work, out of this map's scope).
3. **`variant` is reserved for a component's structural/shape axis only.** A new independent visual axis (color role, size, ...) always gets its own prop; it's never folded into `variant` as a compound string (no `variant="outline-secondary"`). Button's existing `variant` (solid/outline) + `color` (primary/secondary) already demonstrates this.
4. **Slots are named for the layout region or role they fill**, lowercase, single word where possible (e.g. Dialog's `header`/`footer`).
5. **A child element's bundled configuration is passed as an object-shaped prop named after that child's role** (e.g. `buttonConfirm`, `buttonCancel`), typed via a shared exported type (e.g. `ButtonPropsType`).
6. **Exported shared types use a `<Thing>Type` suffix** (`ButtonPropsType`, `OverlayTransitionType`, `TabTransitionType`).

This is hard to reverse once components exist and consumers have copy-pasted them (a rename is a breaking change with no upgrade path, by design — see the copy-paste distribution model), would otherwise be surprising (why `color` and not `colors`, why doesn't `variant` cover everything), and reflects a real trade-off between a single flexible `variant` prop and many single-purpose, more predictable props.
