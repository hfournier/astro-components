# A list is one Tab stop, and its items count their own lines

M3's standard list (#202) has two needs with no precedent in the library.

The first is keyboard. M3's Accessibility page gives a list a different model from a chip set's: Tab moves to the list's first item, or its selected one, the arrow keys move through the items and wrap at the ends, Tab leaves the list, and Space or Enter activates an item. ChipGroup stops at its ends and leaves every chip a Tab stop. A list's items are not a composite widget, though: on the web, a list that isn't a selection list has no role but `list`, and its items are links and buttons.

The second is height. M3 sizes an item by its lines of text, 56, 72 or 88px, and top-aligns its parts at three lines or 88px. Compose counts supporting text that wraps as two lines, so a wrapped item is a three-line item. Which items wrap depends on the width they're given, which the build doesn't know.

We decided:

1. **A List is one Tab stop, by roving `tabindex`.** Its script gives the first link or button `tabindex="0"`, the others `-1`, and moves the `0` to whichever item takes focus, so Tab comes back to the item focused last. The arrow keys move between links and buttons, skipping static and disabled items, wrapping at the ends; Left and Right swap right to left. Space activates a link, as M3 asks, by clicking it. The list keeps `role="list"` and its items their own roles: a `listbox` is for M3's selection lists, where the item is an option.
2. **An item's line count is an attribute, set at build and kept by a script.** `data-ac-list-item-lines` is 1, 2 or 3 from the overline and supporting text an item has, which sets its minimum height, and three top-aligns it. A ResizeObserver recounts it, making it 3 when the supporting text runs past one line, and marks an item 88px or taller for top alignment, such as one whose label wraps.

We rejected leaving every item a Tab stop, as ChipGroup does, since M3's page is explicit and a long list would take a Tab per item to pass. We rejected a `lines` prop, which would be wrong as soon as the item's width changed its wrapping.

## Consequences

- Without the scripts, every link and button is a Tab stop, and an item's height follows its parts, not its wrapping, so a wrapped two-line item is a little shorter than 88px and middle-aligned.
- M3's multi-action items, with a trailing button beside the item's own action, would need the arrow keys to move between every action in the list, not only between items. M3's selection lists would need the selected item as the Tab stop. Both extend the same script.
