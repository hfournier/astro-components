# A segmented list is one group, its items filled in surface-container

M3 Expressive's lists come in two styles (#204), "a visual choice" that doesn't change a list's behavior: standard, its items edge to edge, and segmented, its items in separate containers with gaps between them. M3's Guidelines say to "use segmented gaps and filled list items to define a list group", and its Specs give the corners: "4dp inner, 16dp outer", and 16dp all around a selected item. Compose has `SegmentedListItem`, with `ListItemDefaults.SegmentedGap` (2dp) between items and `segmentedShapes(index, count)`, which rounds the first item's top corners, the last item's bottom ones and all four of an only item's to the list's `ContainerShape` (16dp). Its hovered (12dp), focused, pressed and selected (16dp) shapes replace that shape, all around.

Compose's token for the segmented container is `surface`, the standard item's color. Every Compose sample overrides it with `surfaceContainer`, and the Specs and Guidelines draw segmented items in it: #F3EDF7 on a #FEF7FF page in light and #211F26 on #141218 in dark, M3's baseline `surface-container` on `surface`. On `surface`, a `surface` item couldn't be seen, and neither could its gaps.

We decided:

1. **`variant` on List picks the style,** `"standard"` (the default) or `"segmented"`, as `variant` picks a style on Button, the chips and TextField. The items don't take it, since a group's items share one style and Compose's shapes depend on an item's place in the list.
2. **A segmented List is one group.** Its first item's top corners and its last item's bottom ones are 16px, the corners between items 4px, and an only item's 16px, as Compose's `segmentedShapes` counts them in its list. Several groups are several Lists, each named by the heading before it, as M3's inbox shows a day's messages under a "Today" heading. A group part inside a List was rejected: M3's anatomy has none, and a nested list would announce a list inside a list.
3. **Segmented items are `surface-container`,** as M3 draws them and Compose's samples fill them, not the `surface` token, which the drawings don't match. Their text and icons keep the item's roles.
4. **List sets its items' container and corners through custom properties** on each `<li>`, `--ac-list-item-container` and `--ac-list-item-corners`, which BaseListItem reads with its standard values as fallbacks (ADR-0020). An item's state and selected corners are classes and rules of its own, so they replace the group's while they apply, as Compose's state shapes do.
5. **A segmented list takes no dividers,** and asking for one fails the build (ADR-0021). M3's Guidelines give gaps to contained lists and limit dividers to uncontained ones.

## Consequences

- A hovered first or last item morphs its 16px ends to 12px with the rest of its corners, as Compose's hovered shape does.
- A segmented list on a `surface-container` page shows no fill. M3 draws it on `surface`, and the docs say so.
- The style changes no behavior: roles, names, the Tab stop and the arrow keys are the standard list's.
