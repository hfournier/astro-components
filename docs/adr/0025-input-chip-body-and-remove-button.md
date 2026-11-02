# An input chip is a body button beside a remove button

M3's input chips (#201) are pieces of information a person entered, such as contacts. Each has a trailing remove icon, which M3 requires, and M3's Accessibility page makes the chip's content and the remove icon two focusable elements when the chip has a second action. Its states image draws each with its own focus ring and state layer: hovering, pressing or focusing the remove icon lights a circle around it alone. The Guidelines page gives a tap on the chip three possible results: it selects the chip, ready for Backspace to delete it; it turns the chip back into text to edit, as for a mistyped email address; or it expands the chip to show more, as for a contact. The filter chip's answer (ADR-0024), a native checkbox in a `<label>`, doesn't fit. A remove button can't sit inside a `<label>` or a `<button>`. And an entered item, such as a recipient, must be kept whether or not its chip is selected, while a checkbox submits only while checked.

We decided:

1. **The chip is a wrapper around two sibling buttons.** BaseChip draws the body, a `<button>`. The remove `<button>` sits over the body's trailing end, in padding the body leaves for it, so the body's states (hover, pressed, focus) come from the body alone and the remove button's from itself, with no `:has()` from the wrapper. The remove button is named "Remove" and the label, through `aria-labelledby`, so an edit renames it too. The chip is at least 88px wide, as M3's Guidelines ask, so the remove button's 48px target leaves the body some of its own.
2. **A tap does one thing, chosen by props, as ChipFilter's `menuId` chooses a menu:** by default it selects the chip, the body a toggle button (`aria-pressed`), one of the roles M3's Accessibility page gives a chip with two actions. `isEditable` makes it turn the chip into a text field, and `popoverId` makes the body that popover's button (`commandfor`). Giving both, or `isSelected` with either, fails the build (ADR-0021).
3. **The chip removes and edits itself, and tells the page.** Its remove button, or Backspace or Delete on it, fires a cancelable `remove`, then moves focus to the next chip, or the previous one, and removes the chip. An edit fires a cancelable `change` with the new text, which the page can refuse to keep the field open. The page keeps the data; the chip doesn't submit with a form.
4. **What belongs to a field holding chips waits for one** (#251): turning typed text into a chip, Backspace from the field's cursor selecting the chip before it, moving chips between fields, and submitting their values.

We rejected the native checkbox of ADR-0024 for the reasons above, and a single focusable chip whose whole surface removes it, M3's case for a chip with no other action, since every input chip here has one: selecting, editing or expanding.

## Consequences

- ChipGroup's arrow keys treat an input chip's wrapper as one chip, moving to its body, and leave an edit field's arrow keys to its text.
- The selected state is the body's `aria-pressed`, set by the script, unlike a filter chip's, which needs none.
- A chip that expands shows BaseChip's pressed state while its popover is open, through the `aria-expanded` the script mirrors from the popover's `toggle` event. Where the popover appears, and the container transform M3 draws it with, are the popover's: BaseOverlay's `container-transform` transition anchors it over the button that opened it and grows it out of that button's box (#252).
