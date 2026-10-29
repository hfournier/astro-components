# The connected button group renders native radios and checkboxes

M3's connected button group (#197) is a choice: single-select or multi-select, the replacement for segmented buttons. A first version let ButtonGroup hold Buttons in its slot and took over their selection. That left the group little control over its buttons. Each one had to be a toggle, of one style, and correctly selected to start with, and the group could only check those rules by matching the rendered slot HTML. To make single-select buttons radios, it rewrote their `aria-pressed` into `role="radio"` and `aria-checked` as text, and switched off their own toggle scripts.

M3's Accessibility page describes the keyboard for all button groups: Tab moves between the buttons, the arrow keys move between them too, and Space or Enter selects the focused one. Native radios behave differently. A radio group is one Tab stop, and the arrow keys move the selection, not just the focus.

We decided:

1. **ButtonGroupConnected is its own component, and it renders its options from an `options` prop.** The group owns everything M3 makes the group's: one `variant`, `size` and `shape`, and its `selection`. Each option gives only its label, value, icon and state. Rules that depend on the options, such as at most one selected in single-select, fail the build (ADR-0021). ButtonGroup stays the standard group, holding any Buttons and ButtonIcons in its slot.
2. **Each option is a native input inside a `<label>` styled as M3's toggle button,** as RadioButton, Checkbox and Switch style theirs (ADR-0020):
   - single-select: radios sharing `name`, in a `radiogroup`
   - multi-select: checkboxes in a `group`, as Compose's toggle buttons are announced as checkboxes

   The options submit with a form, need no script to keep their selection, and work before JavaScript loads.
3. **Single-select keeps the native radio keyboard, unlike M3's Accessibility page.** Tab lands on the checked radio (or the first), the arrow keys move the check, and Tab leaves the group. A screen-reader user hears radios and expects radios to behave this way. Every option being a Tab stop, with arrows that only move focus, would contradict the role announced.
4. **Multi-select follows M3's Accessibility page.** Every checkbox is a Tab stop, the left and right arrow keys move between them (mirrored right to left, skipping disabled ones), and Space checks the focused one. Checkboxes have no arrow-key behaviour of their own, so this adds it without contradicting anything.
5. **Selection required means the group always has a selection.** One option starts selected, or the build fails. A radio can't be unchecked by clicking, and the radios carry `required` for form validation. The group's script stops the last checked checkbox from being unchecked.

We rejected keeping Buttons in the slot. The group's rules would stay checks on rendered HTML, and the radio role would stay a text rewrite of another component's markup. We also rejected `role="radio"` on `<button>`s with M3's keyboard. It would follow M3's text, but announce radios that behave unlike radios, and need script and hidden inputs to take part in a form.

## Consequences

- ButtonGroupConnected repeats Button's toggle styling (sizes, colors, state layer, motion) on its labels. Its states come from the input through `has-*` variants, rather than from the element itself. A change to Button's look needs copying across (ADR-0013).
- The pressed shape is set by a small script, not `:active`, because Firefox doesn't give `:active` to a radio pressed while another radio in its group has focus.
- WebKit doesn't treat focus moved between radios by the arrow keys as `:focus-visible`, so there a radio the arrow keys move to shows no focus ring, though one reached with Tab does. That's WebKit's behaviour for every native radio.
