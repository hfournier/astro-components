# Filter chips are native checkboxes and radios, set in a ChipGroup

M3's filter chips (#200) are a selection: several chips in a set, any number selected, or, in a single-select set, one at a time. M3's Accessibility page gives a selectable chip the role of a checkbox or a radio button. A first version made each chip a `<button>` with `aria-pressed`, toggled by a script, as #200 asked ("exposed as toggle buttons with their pressed state"). It had no single-select set, and its sets were whatever parent the page put the chips in: the arrow keys moved between any chips that shared a parent, and each docs example spaced its chips with its own `flex flex-wrap gap-2` div.

ADR-0022 already settled how the connected button group, M3's other selection set, is built: native radios and checkboxes inside `<label>`s styled as the component, the radios keeping the browser's keyboard.

We decided:

1. **A filter chip is a native input inside a `<label>` drawn as the chip,** as ADR-0022 has it for ButtonGroupConnected: a checkbox by default, or a radio with `selection="single"` and a shared `name`. The chips submit with a form, keep their state with no script, and are announced with M3's roles. Every attribute but `class` goes on the input.
2. **BaseChip draws the label too.** It takes `as="label"` beside `button` and `a`. The chip's states (disabled, enabled, focus-visible, pressed) come from the element itself or from its input, through four custom variants in theme.css: `chip-disabled`, `chip-enabled`, `chip-focus-visible` and `chip-active`. Each matches either, pressed matching a mark BaseChip's script sets while the pointer presses a label chip, as Firefox gives `:active` to neither the label nor its input, so BaseChip's classes are written once for all three elements, rather than copied as `has-*` classes the way ButtonGroupConnected copies Button's (ADR-0022's first consequence).
3. **A menu chip stays a `<button>`.** It's a menu button, like ButtonSplit's and FabMenu's: Menu's script gives it aria-haspopup, aria-expanded and aria-controls, and it has no selected state to announce. Its label becomes the option its menu sets, which names its selection instead, and it takes the selected look from its menu's checked item.
4. **ChipGroup is M3's chip set.** It holds any chips in its slot, sets them 8px apart, wrapping onto rows 16px apart or scrolling sideways in one row, and owns the arrow keys between them, which leave BaseChip. With `selection="single"` it's a radiogroup. The chips stay in the slot, unlike ButtonGroupConnected's `options`, because a set mixes what a prop list would have to model (menu chips, links, and later input chips), and ChipFilter can render its own input.
5. **Single-select keeps the native radio keyboard,** departing from M3's Accessibility page as ADR-0022 §3 does: Tab lands on the checked radio and leaves the set, and the arrow keys move the selection. Multi-select follows M3: each chip is a Tab stop, the group's arrow keys move focus, and ChipFilter adds Enter to select a checkbox, which would otherwise submit the form.

We rejected keeping `aria-pressed` buttons. They'd follow #200's wording, but not M3's roles, they need a script to hold their state and hidden inputs to take part in a form, and a single-select set of them would need `role="radio"` on buttons, which ADR-0022 rejected. We also rejected an `options` prop on ChipGroup, for the reasons in §4.

## Consequences

- A single-select set is declared twice: `selection="single"` on the ChipGroup, for its radiogroup role, and on each ChipFilter, for its radio. A slot can't pass props to its children, and checking the rendered HTML is what ADR-0022 moved away from. ChipFilter fails the build on a `single` chip with no `name`; a mismatch with the group isn't caught.
- Chips outside a ChipGroup get no arrow keys. M3 says chips appear in sets, so the docs put every set in one.
- The `chip-*` variants are global, in theme.css, alongside the rail and scroll-state variants. A chip that copies BaseChip needs them too.
- WebKit doesn't treat focus moved between radios by the arrow keys as `:focus-visible` (ADR-0022), so a single-select chip reached that way there shows no focus ring.
