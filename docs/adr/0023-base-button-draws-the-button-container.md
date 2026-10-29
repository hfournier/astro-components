# BaseButton draws M3's button container once

Button, ButtonSplit, ButtonIcon and ButtonGroupConnected each copied M3's button styling class for class: the state layer, the 48px touch target, the focus ring, the mixed-spring transition, the disabled look, and each style's colors, elevation and outline width. A fix to a button's color or motion had to be made in each copy, and each copy carried the transition as one long `[transition:…]` class, against ADR-0020 §2 (#246).

We decided:

1. **BaseButton is a primitive that renders the `<button>` (or `<a>`) and draws the container.** It owns each style's colors, the elevation rising on hover, the outline width for each size, the state layer (with an open menu's), the touch target, the focus ring, the disabled look and the motion. The glossary's *Primitive component* now covers a piece of M3 styling that several pattern components share, as BaseWrapper's background role already was.
2. **Its props are `as`, `variant`, `size` and `isToggle`.** `size` only sets the outline width. `isToggle` gives a toggle's colors: the filled toggle's surface-container resting colors and every style's selected colors while `aria-pressed`. So every button color is in BaseButton. Button keeps `aria-pressed`, the script that flips it, the icon swap and the selected shape.
3. **The caller's `class` gives corners, height, padding and layout, and is merged last.** Corners stay out of BaseButton, so Button's four-corner morph and ButtonSplit's inner-corner morph don't have to override a radius BaseButton set. A caller can still replace any color or the transition, as FabMenuItem does.
4. **The mixed-spring transition sits in BaseButton's scoped `<style>`, as a custom property (`--ac-base-button-transition`) that a `motion-safe:[transition:var(…)]` class reads.** A plain `transition` rule there would beat any caller's transition class (ADR-0020 §4), and FabMenuItem replaces Button's transition with its own stagger. The property keeps the springs readable in CSS, and the class keeps them replaceable.
5. **Button and ButtonSplit keep their own prop checks** as well as BaseButton's, so a bad prop is reported under the component the author wrote, and ButtonSplit's narrower set (no `text`) stays its own (ADR-0021 §1). This departs from ADR-0021 §5, which checks a prop only where it's used.

We kept two components out:

- **ButtonIcon keeps its copy.** Its styles differ from Button's: it has `standard` and no `elevated` or `text`, its outlined and standard styles use `on-bg-variant`, its touch target is 48×48 rather than 48 high, its transition has no shadow, and its outline width also sets the tooltip's anchor inset. Fitting it would give BaseButton values that only some callers may use, or modes that switch half its styling off.
- **ButtonGroupConnected keeps its copy** (ADR-0022): it styles a `<label>` from its input's state through `has-*` variants, not a `<button>` from its own.

## Consequences

- A change to a button's colors, state layer, focus ring or motion is made once, in BaseButton, and reaches Button, ButtonSplit and everything built on Button (FabMenuItem, the dialogs' actions, SkipToContent).
- ButtonIcon and ButtonGroupConnected still need a change to BaseButton copied across where it applies to them.
- Copying Button or ButtonSplit into a project means copying BaseButton with it, as copying Section means copying BaseWrapper (ADR-0013).
