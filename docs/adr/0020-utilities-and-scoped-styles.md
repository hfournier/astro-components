# Tailwind utilities for static styles, a scoped `<style>` for state across parts

> **Point 2's mixed-spring transitions refined by ADR-0023**: where a caller must be able to replace a component's transition with a class, the `<style>` block defines it as a custom property, and a `motion-safe:` class reads it, in place of a `transition` rule inside `@media (prefers-reduced-motion: no-preference)`.

The form controls (Checkbox, RadioButton, Switch, TextField) have large scoped `<style>` blocks, while the rest of the library is styled almost entirely with Tailwind classes. Nothing recorded where the line falls, so rules that style one element ended up in the `<style>` block just because the component already had one. TextField (#192) had many: the textarea's `resize`, `field-sizing` and height, the input's color, caret and placeholder, the legend's type and size, and each part's resting color and single-spring transition. All of them moved to classes in review, and its `<style>` block went from 369 lines to 214.

The form controls still need a `<style>` block, because each one is a native `<input>` whose state (`:checked`, `:focus`, `:disabled`, `:user-invalid`) styles other elements: the state layer, the label, the indicator, the outline, the handle. Tailwind can reach those through `group-has-[…]:` and `peer-*:` variants, but the variant has to be repeated on every part, and combined states become unreadable as class names, such as "the container hovered while the input is enabled and not focused".

We decided:

1. **Tailwind classes are the default.** Anything that styles one element goes in its `class`:
   - layout, size, spacing, corners, type and color, including a color read from the component's own custom property (`text-(--ac-text-field-label)`);
   - states the element has itself (`hover:`, `focus:`, `not-focus:`, `disabled:`, `aria-*:`);
   - its pseudo-elements (`placeholder:`, or an arbitrary variant such as `[&::-webkit-search-cancel-button]:`);
   - custom properties it sets for its children (`[--theme-color-on-bg-variant:…]`);
   - a transition on one spring (`motion-safe:transition-colors`, whose default timing is fast effects, or `motion-safe:duration-(…) motion-safe:ease-spring-*` for another spring);
   - values a prop decides, which the template chooses between (`hasFixedRows ? "h-[…]" : "field-sizing-content"`), and M3's fixed literals as arbitrary values (ADR-0005).
2. **A scoped `<style>` block holds only the CSS that classes handle badly:**
   - **State that styles other parts:** a rule whose selector reads one element's state and styles another, such as `[data-ac-text-field]:has(input:focus) [data-ac-text-field-part="label"]` or `input:checked ~ [data-ac-switch-part="handle"]`.
   - **The component's role set:** the `--ac-<component>-*` custom properties each part reads, with their defaults, and the rules that swap them per state (the error state's roles). The defaults sit beside the swaps, so the whole mapping from M3's Specs page reads in one place.
   - **Transitions that mix springs:** an element whose properties move on different springs, such as a label that moves on fast spatial while its color changes on fast effects, inside `@media (prefers-reduced-motion: no-preference)` (ADR-0016, ADR-0018). Tailwind's transition utilities give an element one timing.
3. **The `<style>` block targets parts through `data-ac-<component>-part` attributes,** never through Tailwind class names, so restyling a class can't silently break a rule. Specs find parts the same way.
4. **A state rule in the `<style>` block changes a class's value; a class never changes a `<style>` rule's.** Astro's scoped styles are unlayered, so they beat Tailwind's `utilities` layer whatever the specificity (ADR-0004). An element's resting value is a class, such as the label's `inset-s-4` and `text-(--ac-text-field-label)`, and a cross-part state rule overrides it, such as the floated outlined label's `inset-inline-start: 16px`. The reverse doesn't work: a class does nothing against a property the `<style>` block sets. So a property the `<style>` block sets at rest stays there, with its states.

We rejected styling everything with classes. The form controls' state rules would become long `group-has-[…]` chains repeated on each part, the error state's role swap would multiply into one variant per part, and the mixed-spring transitions would become arbitrary `transition-[…]` shorthands that are harder to read than the CSS they replace. We also rejected moving everything into `<style>` blocks. It would hide simple styling from someone reading the template, and give up Tailwind's class sorting and the design tokens' utilities.

## Consequences

- A reviewer can check each rule in a `<style>` block against point 2. A rule that matches none of the three kinds should be a class.
- Checkbox, RadioButton and Switch predate this ADR and may still hold rules that point 1 makes classes. Bringing them in line is follow-up work, not part of #192.
- Components that wrap a native input (Slider, the list's selection controls, the chips' checkable states) will likely need a `<style>` block too.
- An element's styling can be split: its resting value in its `class`, its states in the `<style>` block. The `data-ac-<component>-part` attributes link the two.
