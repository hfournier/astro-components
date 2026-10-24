# Tailwind utilities for static styles, a scoped `<style>` for state across parts

The form controls (Checkbox, RadioButton, Switch, TextField) have large scoped `<style>` blocks, while the rest of the library is styled almost entirely with Tailwind classes. Nothing recorded where the line falls, so a static rule could end up in the `<style>` block just because the component already had one. TextField's first multi-line rules (#192) were three of these, `resize`, `field-sizing` and a fixed `height` on the textarea, and they moved to classes in review.

The form controls need their `<style>` blocks because each one is a native `<input>` whose state (`:checked`, `:focus`, `:disabled`, `:user-invalid`) styles other elements: the state layer, the label, the indicator, the outline, the handle. Tailwind can reach those through `group-has-[…]:` and `peer-*:` variants, but the variant has to be repeated on every part, and combined states become unreadable as class names, such as "the container hovered while the input is enabled and not focused".

We decided:

1. **Tailwind classes are the default.** Layout, size, spacing, corners, type and color for a single element go in its `class`, including states the element has itself (`hover:`, `focus-visible:`, `disabled:`, `aria-*:`). This also covers values that vary by prop, which the template chooses between (`hasFixedRows ? "h-[…]" : "field-sizing-content"`), and M3's fixed literals as arbitrary values (ADR-0005).
2. **A scoped `<style>` block holds only the CSS that classes handle badly:**
   - **State that styles other parts:** a rule whose selector reads one element's state and styles another, such as `[data-ac-text-field]:has(input:focus) [data-ac-text-field-part="label"]` or `input:checked ~ [data-ac-switch-part="handle"]`, when the variant would repeat across several parts or combine several states.
   - **Swapping roles per state:** a state that redefines a set of the component's own `--ac-<component>-*` custom properties in one rule (the error state's roles), which each part then reads.
   - **Pseudo-elements and native parts with no Tailwind variant,** or only an awkward one: `::placeholder` under a condition, `::-webkit-search-cancel-button`, a fieldset's `<legend>`.
   - **Transitions with motion tokens:** several properties, each on its own M3 spring token (ADR-0016, ADR-0018), inside `@media (prefers-reduced-motion: no-preference)`.
3. **The `<style>` block targets parts through `data-ac-<component>-part` attributes,** never through Tailwind class names, so restyling a class can't silently break a rule. Specs find parts the same way.
4. **A property is set in one place only.** Astro's scoped styles are unlayered, so they beat Tailwind's `utilities` layer whatever the specificity (ADR-0004). A property set both as a class and in the `<style>` block on the same element shows the `<style>` value, and the class does nothing.

We rejected styling everything with classes. The form controls' state rules would become long `group-has-[…]` chains repeated on each part, the error state's role swap would multiply into one variant per part, and the transitions would become arbitrary-value classes that are harder to read than the CSS they replace. We also rejected moving everything into `<style>` blocks. It would hide simple layout from someone reading the template, and give up Tailwind's class sorting and the design tokens' utilities.

## Consequences

- A reviewer can check each rule in a `<style>` block against point 2. A rule that matches none of the four kinds should be a class.
- The form controls keep their large `<style>` blocks, and future components that wrap a native input (Slider, the list's selection controls, the chips' checkable states) will likely have one too.
- Some states are written as classes on one element and in the `<style>` block on another, so a component's styling is read in two places. The `data-ac-<component>-part` attributes are what link the two.
