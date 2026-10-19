# M3 spring motion tokens, as `linear()` curves

> **Extends ADR-0006**: its duration scale and `--ease-theme-overlay` are unchanged for now. This adds M3's motion springs beside them, starting with the two FabMenu needs.

ADR-0006's motion tokens (150/300/500ms, Tailwind's `ease-out`) were chosen to match values already hardcoded in the components, before the move to Material 3, so none of them is M3's. M3 Expressive components such as the FAB menu don't use a duration and easing at all: Compose drives them with springs from a motion scheme (`MotionScheme.kt`), named by what they animate and how fast. **Spatial** springs move things (size, position, shape) and may overshoot. **Effects** springs change color and opacity and never do. Each spring is a damping ratio and a stiffness (`ExpressiveMotionTokens.kt`). For example, fast spatial is damping 0.6 and stiffness 800, and fast effects is damping 1 and stiffness 3800.

CSS has no spring timing function, so we decided:

1. **Each spring becomes a pair of tokens: a `linear()` easing and the duration it's sampled over.** The easing is `--ease-spring-<speed>-<kind>` in `@theme` (Tailwind's `--ease-*` namespace, as ADR-0006 put easing), so `ease-spring-fast-spatial` works as a utility. The duration is `--theme-duration-spring-<speed>-<kind>` in `:root`, beside ADR-0006's durations. The duration is how long the spring takes to settle within 0.2% of its target from rest, rounded to 10ms. The curve is the spring's position from 0 to 1 sampled evenly over that duration: 24 segments for a spatial spring, to keep its overshoot and settling, and 12 for an effects spring, which only eases out. Both use Compose's unit mass and start at rest.
2. **The values are M3 Expressive's, not standard's.** The components these tokens are for come from M3 Expressive. The standard scheme's springs are stiffer and barely overshoot.
3. **Tokens are added when a component needs them**, as the springs that component's Compose implementation uses. FabMenu (#142) adds fast spatial (350ms) and fast effects (140ms).
4. **A component's own staggers stay local.** Compose staggers the FAB menu's items by animating the count of items shown on the slow effects spring. FabMenu spreads its items' delays evenly over a 140ms span, which puts each start within 20ms of Compose's for any number of items. The span is a FabMenu custom property, not a token, since no other component staggers this way.
5. **Reduced motion is unchanged.** `motion-safe:` gates the utilities, as ADR-0003 and ADR-0006 require.

We rejected approximating each spring with a `cubic-bezier()`. A cubic Bézier can overshoot only once and can't settle back, so a spatial spring's bounce would be lost. We also rejected computing the curves at runtime (a script, or CSS `exp()` and `cos()` in a custom property per frame), since a fixed `linear()` list is plain CSS and every supported browser has had it since 2023.

## Consequences

- To regenerate a curve, sample the spring's closed-form solution: underdamped for damping below 1, critically damped at 1. The values in `theme.css` were made that way, from Compose's `ExpressiveMotionTokens`.
- The other components still use ADR-0006's pre-M3 durations and `ease-out`. Moving them, and the duration scale itself, onto M3's motion system (springs for Expressive components; M3's duration and easing tokens, such as emphasized `cubic-bezier(0.2, 0, 0, 1)`, for the rest) is follow-on work with its own ADR.
- A `linear()` curve played over a fixed duration matches the spring only when it starts from rest. Compose's springs carry their velocity into an interruption, such as closing the menu while it's still opening. CSS restarts the curve from the current value instead, which settles a little more abruptly.
