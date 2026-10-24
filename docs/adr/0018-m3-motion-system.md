# Every component on M3's motion system

> **Supersedes ADR-0006's duration scale and easing role.** Its reduced-motion point still stands. **Extends ADR-0016**, whose spring tokens this builds on.

ADR-0006's motion tokens (`--theme-duration-fast/base/slow` at 150/300/500ms, the `feedback`, `overlay` and `content-swap` roles on them, and `--ease-theme-overlay` on Tailwind's `ease-out`) matched values that were already hardcoded in the components before the move to Material 3. None of them is M3's. Only FabMenu and Menu's shape morph used M3's springs (ADR-0016) (#143).

M3 Expressive drives motion with springs. "All component motion is driven by two tokens: expressive fast spatial and expressive fast effects" (m3.material.io, Motion, How it works). Its older easing and duration system "is still used for transitions … but is no longer maintained" (Easing and duration, Applying).

We decided:

1. **The expressive scheme throughout.** No standard springs, and no switch between schemes. M3 recommends expressive "for most situations", and calls the scheme at the product level, so the token names leave it out.
2. **Component motion is on the fast springs.** Movement, size, shape, corners and rotation use fast spatial. Color, opacity and shadow use fast effects. A shadow is an effect too, since an overshooting curve would make it flicker past its level. Examples: Button's and ButtonIcon's corner morph (M3's button tokens map `pressed.container.corner-size.motion.spring` to fast spatial) and their colors, the state layers, the tab indicator, Details' chevron and content, and the tooltip's fade. A component's own motion tokens on M3's Specs page come first. Where the Specs page gives none, and Compose uses something else, the component follows Compose and says so. FabMenu's morph keeps its colors on fast spatial, as Compose's toggle FAB does. TextField's placeholder fades in on slow effects as the field is focused, and out on fast effects, as Compose's does: the one use of a slow spring.
3. **The default springs are for motion that covers part of the screen**, as M3's speed table says: "Animations that partially cover the screen, such as bottom sheet and expanded navigation rail" are spatial at default speed, and "Opacity of the content within a navigation rail" is effects at default speed. So NavRail expands on default spatial, NavRailSubItems fades on default effects, and SheetBottom grows to full height on default spatial.
4. **Easing and duration only for transitions,** where something enters or leaves the screen. M3 lists dialogs, menus and sheets under its enter and exit pattern. It lists tooltips there too, but a tooltip is a small component, and M3's speed table puts small components on the fast springs, so its fade is on fast effects.
   - BaseOverlay (and so Dialog, Popover and Menu), the modal sheets and their scrims enter on emphasized decelerate over 400ms and leave on emphasized accelerate over 200ms. These are M3's suggested pairs, and its bottom sheet example uses them.
   - Tab panels swap the same way.
   - CSS takes a transition's timing from the state it moves to, so the open state carries the way in and the closed one the way out. The pattern is defined once, as the `motion-enter-exit` and `motion-enter-exit-backdrop` utilities in `theme.css`. A tab panel has no open state, so Tab keys the same timing on its `hidden` attribute.
   - M3's modal drawer "enters and exits temporarily with Emphasized easing". Emphasized has no CSS form ("The Standard set is also a fallback for platforms that don't support Emphasized easing, like iOS and Web"). So the modal NavDrawer, the modal NavRail and their scrims use standard over 300ms.
   - These keep curves rather than springs: an overshooting curve would pull a sheet or drawer off the edge it's anchored to, leaving a gap.
5. **M3's names replace ADR-0006's roles.**
   - Springs follow ADR-0016: `--ease-spring-{speed}-{kind}` with `--theme-duration-spring-{speed}-{kind}`.
   - Easing is `--ease-emphasized-decelerate`, `--ease-emphasized-accelerate` and `--ease-standard`.
   - Durations are named after M3's tokens: `--theme-duration-short-4` (200ms), `--theme-duration-medium-2` (300ms) and `--theme-duration-medium-4` (400ms).
   - As in ADR-0016, a token is added only when a component uses it. `--ease-spring-slow-effects` (`cubic-bezier(0.34, 0.88, 0.34, 1)`) and `--theme-duration-spring-slow-effects` (300ms), the curve and duration M3 publishes for slow effects on the web, came in with TextField (#191).
6. **A transition that names no timing is on fast effects.** Tailwind's `--default-transition-duration` and `--default-transition-timing-function` point at fast effects. A bare `transition-opacity`, such as a state layer's fade or Heading's anchor icon, then follows M3 without repeating the tokens.
7. **Reduced motion is unchanged.** `motion-safe:` gates the utilities, as ADR-0003 and ADR-0006 require.

## Consequences

- A component that gives each property its own timing writes the `transition` shorthand (`[transition:color_…,border-radius_…]`), so each property sits beside its timing. The shorthand resets `transition-delay`, so a delay goes inside it, as FabMenuItem's stagger does.

- ADR-0006's tokens are removed. New components pick a spring or, when they enter or leave the screen, an easing pair, by M3's rules above. They don't pick a duration step.
- The spatial curves overshoot. A Details panel or a NavRail's width briefly passes its final size, as M3's springs do.
- Dialog still slides down from above as it fades in, BaseOverlay's `fade-down`. Only its timing is M3's. M3's Android pattern expands a component along one axis instead, and a full-screen dialog opened from a FAB uses a container transform. Changing the shape of these transitions is separate work.
