# Accessibility standard & enforcement

Accessibility is this project's stated top priority, but until now there was no stated conformance target and no way to check a component against one — no CI, no manual checklist, and only `motion-safe:` used inconsistently across components (`Button`/`Tab` gate their transitions behind it, `BaseOverlay`'s open/close and backdrop transitions currently don't).

We adopted **WCAG 2.2 AA** as the target conformance level, with no exceptions carved out in advance — an exception gets recorded against a specific component if one is ever genuinely needed, not assumed up front. Four requirements follow from it:

- **Focus visibility**: every interactive element needs a visible focus indicator meeting WCAG 1.4.11 (3:1 non-text contrast). An indicator may be swapped for an equivalent (e.g. `TabList`'s `outline-none` + border-color change) but never removed with nothing replacing it.
- **Reduced motion**: every transition/animation is gated behind `motion-safe:` (or equivalent). An *essential* state-change transition (dialog/popover open-close) still happens **instantly** under reduced motion — it never means "doesn't open" — while purely decorative motion can be skipped outright.
- **Keyboard interaction**: WAI-ARIA APG is the canonical reference pattern for every interactive component; a deliberate deviation from an APG pattern is noted, with why, next to the component.
- **Enforcement, two layers**: automated axe-core (already wired per ADR-0002) blocks CI/merge once CI exists; a manual checklist (`docs/accessibility-checklist.md`) is also required as a non-blocking PR-review step, because axe-core structurally can't catch keyboard-only operability, focus order, or screen-reader announcement quality — commonly cited as catching only roughly a third to half of real WCAG issues on its own.

This is hard to reverse once components exist against a lower bar, surprising without the "no CI yet" context, and trades CI simplicity (automated-only) for real coverage (automated + manual) — a deliberate call given the project's accessibility-first pitch.
