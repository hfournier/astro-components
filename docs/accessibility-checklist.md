# Accessibility checklist

Manual, non-blocking PR-review companion to the automated axe-core checks (see [ADR-0002](./adr/0002-test-framework-and-a11y-tooling.md)). Run through this for any new or changed component before requesting review. Target: WCAG 2.2 AA (see [ADR-0003](./adr/0003-accessibility-standard.md)).

## Keyboard operability

- [ ] Every interactive element is reachable and operable using only the keyboard (Tab, Shift+Tab, Enter/Space, arrow keys where the pattern calls for them).
- [ ] The component's interaction pattern matches its [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/) reference (tabs, dialog, menu, etc.), or a deviation is explicitly noted in the component's docs with why.
- [ ] No keyboard trap: focus can always move away from the component (Escape, Tab out, or an explicit close action).
- [ ] Tab order follows visual/reading order.

## Focus visibility

- [ ] Every focusable element shows a visible focus indicator that meets a 3:1 non-text contrast ratio against its background (WCAG 1.4.11).
- [ ] If the default indicator is removed (e.g. `outline-none`), an equivalent replacement is present — never removed with nothing in its place.
- [ ] Focus moves sensibly on open/close (e.g. a dialog moves focus inside itself on open, returns focus to the trigger on close).

## Reduced motion

- [ ] Every transition/animation is gated behind `motion-safe:` (or equivalent `prefers-reduced-motion` check).
- [ ] An essential state-change transition (opening/closing, expanding/collapsing) still completes — instantly — under reduced motion; it never silently fails to happen.
- [ ] Purely decorative motion (hover effects, decorative entrance animation) is skipped outright under reduced motion.

## Screen-reader semantics

- [ ] Every icon-only control has an accessible name (`aria-label` or equivalent) — never relies on a tooltip or visual icon alone.
- [ ] Roles, states, and properties (`aria-expanded`, `aria-selected`, `aria-controls`, `aria-labelledby`, etc.) are present and update as component state changes.
- [ ] Native semantics are preferred over ARIA where a native element already provides them (`<dialog>`, `<button>`, the Popover API) — ARIA is added only where native semantics fall short.
- [ ] Dynamic content changes a screen-reader user needs to know about are announced (e.g. via a live region), not silently updated.

## Color contrast

- [ ] Text meets 4.5:1 contrast against its background (3:1 for large text, ≥24px or ≥19px bold).
- [ ] Non-text UI components (borders, icons that convey meaning, focus indicators) meet 3:1 contrast (WCAG 1.4.11).
- [ ] Meaning is never conveyed by color alone (e.g. an error state also has an icon or text, not just a red border).

## Automated coverage (reference)

Axe-core runs automatically on every component test via the shared Playwright fixture — a passing test suite covers common structural issues (missing labels, invalid ARIA, contrast on static content) but does **not** replace the manual pass above.
