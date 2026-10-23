# M3 spring motion tokens, as M3's web curves

> **Extends ADR-0006**, which ADR-0018 has since superseded: every component is now on M3's motion system, using these springs and the default ones ADR-0018 adds. This added M3's motion springs, starting with the two FabMenu needs.

ADR-0006's motion tokens (150/300/500ms, Tailwind's `ease-out`) were chosen to match values already hardcoded in the components, before the move to Material 3, so none of them is M3's. M3 Expressive replaced easing and duration with a motion physics system: "The physics system is replacing the previous system based on easing and duration" (m3.material.io, Motion, How it works). Its easing and duration tokens are now "no longer maintained", though M3's transition patterns still use them.

The physics system drives motion with springs. Each spring is a damping ratio and a stiffness, and is named by what it animates and how fast. **Spatial** springs move things (position, rotation, size, rounded corners) and overshoot. **Effects** springs change color and opacity and don't. Each comes in fast, default and slow, in an expressive and a standard scheme. M3 recommends expressive "for most situations", and says "All component motion is driven by two tokens: expressive fast spatial and expressive fast effects".

CSS has no spring timing function. For the web, M3 says to "use springs when possible, otherwise use curves that mimic the springs for animations without interruptions or gestures". It publishes those curves in a "Web: Convert springs to curves" table (Motion, Specs): a `cubic-bezier()` and a duration for every spring. So we decided:

1. **Each spring becomes a pair of tokens, copied from M3's web table: its curve and its duration.** The curve is `--ease-spring-<speed>-<kind>` in `@theme` (Tailwind's `--ease-*` namespace, as ADR-0006 put easing), so `ease-spring-fast-spatial` works as a utility. The duration is `--theme-duration-spring-<speed>-<kind>` in `:root`.
2. **The values are the expressive scheme's**, as M3 recommends.
3. **Tokens are added when a component needs them**, as the springs that component's Compose implementation uses. FabMenu (#142) adds fast spatial (`cubic-bezier(0.42, 1.67, 0.21, 0.90)`, 350ms) and fast effects (`cubic-bezier(0.31, 0.94, 0.34, 1.00)`, 150ms).
4. **A component's own staggers stay local.** Compose staggers the FAB menu's items by animating the count of items shown on the slow effects spring. FabMenu spreads its items' delays evenly over a 140ms span, which puts each start within 20ms of Compose's for any number of items. The span is a FabMenu custom property, not a token, since no other component staggers this way.
5. **Reduced motion is unchanged.** `motion-safe:` gates the utilities, as ADR-0003 and ADR-0006 require.

We first sampled each spring's motion into a `linear()` curve, which keeps a spatial spring settling back after its overshoot, where a `cubic-bezier()` can only overshoot once and come to rest. We dropped it for M3's published curves. They're the spec, the same values any M3 web implementation uses, and the difference is barely visible at these durations.

## Consequences

- To add a spring, copy its row from M3's web conversion table. Nothing is derived in this repo.
- The other components moved onto M3's motion system in #143 (ADR-0018).
- A curve played over a fixed duration matches the spring only when it starts from rest, as M3's "without interruptions or gestures" caveat says. Compose's springs carry their velocity into an interruption, such as closing the menu while it's still opening. CSS restarts the curve from the current value instead.
