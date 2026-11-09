# Modern CSS

Whenever possible, modern CSS should be used to improve web page performance and eliminate or reduce the need for Javascript code.

## Resources

[Modern CSS](https://modern-css.com/)
[Modern CSS Techniques](https://modern-css.com/category/css/)

[Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance)
[Modern Web Guidance guides](https://developer.chrome.com/docs/modern-web-guidance/guides)

[prop-for-that](https://prop-for-that.netlify.app/docsite/)

## Where the scripts could shrink (November 2026)

This section reviews every component with a `<script>` against the platform features that could replace it. It was written on 2026-11-08. Support figures come from MDN's browser-compat-data 8.1.8 and web-features 3.45.0 (the data behind caniuse's and webstatus.dev's Baseline badges), fetched that day, and the behaviour from the specs and MDN. Each claim cites its source; [Sources](#sources) lists them all. [Unverified](#unverified) lists what couldn't be confirmed.

Nothing here has been implemented. Each change still needs its spec run in all three engines (ADR-0002, ADR-0019), since most of the features below are new and their cross-engine gaps are the kind of bug only behavioural tests catch.

### The support bar this review assumes

No ADR sets a browser baseline. The code already sets one in practice: it relies on invoker commands (`commandfor`), anchor positioning, `@starting-style`, `transition-behavior: allow-discrete` and `field-sizing`, and it uses `scroll-state()` container queries and `interpolate-size` as Chromium-only enhancements (the scroll-state variants in `theme.css`, `Fab`). Its comments also work around single-engine bugs (Firefox's right-to-left `position-area`, WebKit's focus return). This review judges each feature in three tiers:

- **All three engines.** Safe to replace JS outright.
- **Two engines, or all three only recently.** Replace the JS where the feature exists, and keep a feature-detected fallback until the third engine ships.
- **Chromium only.** An enhancement at most. The JS stays, so the page carries more code, not less.

Recording this as an ADR ("evergreen engines; a feature in one engine is an enhancement with a fallback") would settle future decisions of this kind.

### Prioritised summary

Ordered by JS removed against risk: biggest saving and lowest risk first.

| #   | Change                                                                                                    | Components                                       | JS affected                                                                   | Support                                        | Risk   | Verdict                                       |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------- | ------ | --------------------------------------------- |
| 1   | `closedby="any"` for the scrim click                                                                      | Dialog, DialogFullscreen, SheetBottom, SheetSide | ~60 lines in four copies → one ~15-line fallback for Safari                    | Chrome 134, Firefox 141; Safari not yet         | Low    | Reduce (eliminate once Safari ships)          |
| 2   | Implicit anchors from `commandfor`, `popovertarget` and `showPopover({ source })`                         | Menu, BaseOverlay, Tooltip                       | ~40 lines of `anchor-name` bookkeeping, plus Tooltip's anchor `<span>`         | Chrome 133–135, Firefox 147, Safari 26–26.2     | Low    | Reduce                                        |
| 3   | `field-sizing: content` on the chip's edit field                                                          | ChipInput                                        | ~20 lines (canvas text measuring)                                             | Baseline 2026 (Chrome 123, Firefox 152, Safari 26.2) | Low | Eliminated (#287)                             |
| 4   | One shared "pressed" marker, and one shared scrim and inert helper                                        | BaseChip, BaseListItem, ButtonGroupConnected, NavRail, NavDrawer, the dialogs | ~120 lines of near-duplicates → ~40                       | n/a (refactor)                                 | Low    | Reduce                                        |
| 5   | Anchor-positioned sizing in place of `getBoundingClientRect` plus scroll and resize listeners             | Menu, FabMenu                                    | ~45 lines                                                                     | Chrome 125, Firefox 148, Safari 26              | Medium | Reduce (prototype first)                      |
| 6   | Precomputed SVG `<animate>` (SMIL) in place of a `requestAnimationFrame` morph loop                       | ProgressLoading                                  | ~80 lines                                                                     | All engines                                    | Medium | Eliminate (prototype first)                   |
| 7   | Stop the wave loops under reduced motion and off screen                                                   | ProgressLinear, ProgressCircular                 | adds ~10 lines, saves CPU                                                     | All engines                                    | Low    | Improve                                       |
| 8   | `:has()` in place of the `data-ac-menu-inactive` bookkeeping                                              | Menu                                             | ~15 lines                                                                     | Baseline widely available                      | Low    | Reduce                                        |
| 9   | `formdata` event in place of hidden inputs kept by a MutationObserver                                     | TextFieldChips                                   | ~30 lines                                                                     | Baseline widely available                      | Medium | Reduce (optional)                             |
| 10  | Same-document view transitions in place of FLIP for keyboard moves                                        | TextFieldChips                                   | ~25 lines; drag stays                                                         | Baseline 2025                                  | Medium | Improve (optional)                            |
| 11  | `hidden="until-found"` and `beforematch` on tab panels                                                    | Tabs                                             | adds ~10 lines                                                                | Chrome 102, Firefox 148; Safari partial         | Low    | Improve (adds JS, gains find-in-page)         |
| 12  | `interestfor`, `popover="hint"` and `interest-delay`                                                      | Tooltip; later NavDrawer, Menu submenus          | none until Firefox and Safari ship; then ~250 lines                           | Chromium only                                  | Medium | Watch, or enhance with the JS kept            |
| 13  | `focusgroup` in place of roving tabindex and arrow-key scripts                                            | List, Tabs, Menu, NavRail, NavDrawer, ChipGroup, ButtonGroup | none until Firefox and Safari ship; then ~150 lines              | Chrome 150 only                                | Medium | Watch                                         |
| 14  | `anchor-size()` in `@starting-style` and `interpolate-size` for the container transform                   | BaseOverlay                                      | none until Firefox and Safari ship                                            | Chromium only                                  | High   | Watch                                         |

Items 1 to 4 can land now, since every engine already has the feature or the change is a refactor. Items 12 to 14 are the biggest eventual savings, but they're Chromium only today, so adopting them now adds code rather than removing it.

### Per-component analysis

The line numbers are the `.astro` file's own. "Keep" means no platform feature replaces the responsibility today.

#### Dialog, DialogFullscreen, SheetBottom (modal), SheetSide (modal)

**What the script does**

- Clears `returnValue` on `cancel`, so a dismissal never reads as the last action chosen: Dialog.astro:99-101, DialogFullscreen.astro:193-195, SheetBottom.astro:186-188, SheetSide.astro:223-225.
- Closes on a click on the scrim, firing a cancelable `cancel` first, only when the press started on the scrim too: Dialog.astro:103-112, DialogFullscreen.astro:197-206, SheetBottom.astro:173-185, SheetSide.astro:210-222.

**Recommendation: reduce, then eliminate the scrim handler.**

- `closedby="any"` gives a modal dialog light dismiss: it closes "when the user clicks or taps outside it", like an auto popover ([MDN `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)). The spec covers the drag-out case the script guards against. On `pointerdown` it records the dialog under the pointer, and on `pointerup` it does nothing unless the release is over the same one. A press inside the panel that ends on the scrim doesn't close it ([HTML, dialog light dismiss](https://html.spec.whatwg.org/multipage/interactive-elements.html#attr-dialog-closedby)). A click on `::backdrop` counts as outside, because the hit point is outside the dialog's box. These components rely on the same thing: their panel fills the dialog.
- Light dismiss closes through the dialog's close watcher, which fires `cancel` first, as Escape does ([HTML spec](https://html.spec.whatwg.org/multipage/interactive-elements.html#attr-dialog-closedby)). So the page's `cancel` handlers keep working.
- **The `returnValue` clearing stays.** The spec's close steps set `returnValue` only "if result is not null", and neither Escape nor light dismiss passes a result. Keeping the last value is the specified behaviour, not just a Firefox and WebKit quirk.
- **Support:** Chrome 134, Firefox 141. Safari only has it in Technology Preview ([BCD `html.elements.dialog.closedby`](https://github.com/mdn/browser-compat-data); [webstatus.dev](https://webstatus.dev/features/dialog-closedby): not Baseline). Keep one shared fallback, run only when `!("closedBy" in HTMLDialogElement.prototype)`, rather than four copies (see [Cross-cutting](#cross-cutting)).
- **DialogFullscreen:** in a compact window the panel fills the viewport, so there's nowhere outside to click, which is what the script does today. Set the attribute unconditionally.
- **A11y:** no change. Escape still closes (`closerequest` is included in `any`), and focus still returns natively.

**Estimated reduction:** about 13 of 27 lines in Dialog, and the same in each of the other three. With the shared fallback, about 60 lines become about 15.

#### SheetBottom (other responsibilities)

- **Makes the content a Tab stop only while it overflows** (SheetBottom.astro:193-202). Chrome 132 and later makes a scroller keyboard-focusable by default when it has no focusable children ([Chrome blog](https://developer.chrome.com/blog/keyboard-focusable-scrollers): announced for 130, then "pushed back to Chrome 132"). The blog says nothing about Firefox or Safari, and a sheet with buttons in it doesn't qualify. **Keep.**
- **One or two heights, the expanded state, and the handle's label** (SheetBottom.astro:218-284). These depend on measured content height against half the window. CSS can't toggle `aria-expanded` or an accessible name. **Keep.**
- **Drag on the handle** (SheetBottom.astro:287-331). A scroll-snap sheet driven by scroll-driven animations could replace the drag, but it would rebuild the component, and the handle's keyboard and button semantics (M3's Accessibility page) would still need script. **Keep.**

**Estimate:** reduce by the scrim part only.

#### SheetSide (standard)

- The close button hides a standard sheet, and the back button fires `back` (SheetSide.astro:231-241). No invoker command sets `hidden`. Custom commands (`command="--close"`) still need a listener ([MDN invoker commands](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)). **Keep.** It's 11 lines.

#### Menu

The largest script after TextFieldChips (Menu.astro:129-610).

| Responsibility                                                                                     | Lines   | Platform replacement                                                                                                                                                                       | Verdict |
| -------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Anchor the menu to the trigger that opened it (`useTrigger`, moving an `anchor-name` between triggers) | 208-219, 260-271 | A button with `commandfor` is the popover's implicit anchor, and so is the `source` passed to `showPopover()`. With `position-anchor: auto`, the menu anchors to whichever trigger opened it, with no named anchor. | Reduce |
| `aria-haspopup`, `aria-controls`, `aria-expanded`, trigger ids                                       | 253-258, 308-313 | The HTML-AAM maps a `command` toggle-popover button to `aria-expanded` true or false and gives it an `aria-details` relation ([HTML-AAM §3.6.25](https://w3c.github.io/html-aam/)). It maps nothing for `aria-haspopup="menu"`. The CSS reads the explicit attribute (`aria-expanded:` variants). | Keep |
| Max height from the roomier side, refit on scroll and resize                                         | 231-240, 282-300 | Anchor insets plus `align-self: start` for a fit-content box clamped to the inset-modified containing block, with `position-try-fallbacks: flip-block` and `position-try-order: most-block-size`. | Reduce (prototype) |
| Grouped layout falls back to standard when the list scrolls                                          | 244-251 | A `scroll-state(scrollable: block)` container query on the list could drop the gaps. It's Chromium only, and a layout that turns scrolling off once it applies could oscillate. | Keep |
| Focus the first item on open, arrow keys, Home and End, Tab closes the tree                          | 223-226, 406-439 | `focusgroup="menu"` gives arrow keys, Home and End, and a single Tab stop ([Open UI explainer](https://open-ui.org/components/scoped-focusgroup.explainer/)). It's Chrome 150 only. | Keep, then watch |
| Type-ahead                                                                                         | 403-479 | None.                                                                                                                                                                                      | Keep |
| Active (16px) and inactive (8px) corners                                                           | 163-171, 302-306, 321-322 | `[data-ac-menu]:popover-open:not(:focus-within, :hover)` inside `:root:has([data-ac-menu]:popover-open:is(:focus-within, :hover))`. One difference: when the pointer leaves every menu and focus sits nowhere, no menu is inactive. | Reduce |
| Submenu opens on hover after 200ms and closes 300ms after leaving                                    | 139-157, 356-401 | `interestfor` on the parent item, with `interest-delay: 200ms 300ms`. Chromium only, and see Tooltip for the touch and announcement caveats. | Keep, then watch |
| Disabled items swallow clicks, checkbox and radio items, `change` event, close after choosing        | 483-533 | None. `aria-disabled` items stay focusable by design.                                                                                                                                     | Keep |
| Context menu at the pointer or the target                                                          | 535-608 | None. A point can't be an implicit anchor.                                                                                                                                                 | Keep |

**Support for the reductions**

- Implicit anchor through `commandfor`: Chrome 135, Firefox 147, Safari 26.2. Through `showPopover({ source })`: Chrome 133, Firefox 147, Safari 26 ([BCD `html.elements.button.commandfor.implicit_anchor_reference`, `api.HTMLElement.showPopover.options_source_parameter.implicit_anchor_reference`](https://github.com/mdn/browser-compat-data); [CSS Anchor Positioning §implicit anchor element](https://drafts.csswg.org/css-anchor-position/#implicit-anchor-element)). Firefox before 147 has no anchor positioning at all, so nothing that works today is lost. Write `position-anchor: auto` explicitly. BCD notes that the property's initial value differs between engines and versions (`auto`, `none`, `normal`).
- `position-try-order`: Chrome 125, Firefox 148, Safari 26. It picks the fallback that "gives the element the most space in the block direction" when the element is first displayed ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-try-order)). MDN doesn't say how this interacts with a max size, hence "prototype".
- `align-self` on absolutely positioned boxes: Chrome 122, Firefox 134, Safari 26 ([BCD `css.properties.align-self.context_position_absolute`](https://github.com/mdn/browser-compat-data)).
- `:has()`: Baseline widely available since 2026-06-19 ([webstatus.dev](https://webstatus.dev/features/has)).

**A11y:** none of the reductions touch the menu button pattern. Keep setting `aria-expanded` explicitly: the CSS reads it, and an explicit value overrides the implicit mapping consistently.

**Estimate:** reduce by about 70 of 482 lines.

#### FabMenu

| Responsibility                                                             | Lines   | Platform replacement                                                                                                                                                       | Verdict |
| -------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| A large-window MenuItem clicks its FabMenuItem                             | 317-322 | None.                                                                                                                                                                      | Keep |
| Crossing the large breakpoint closes the open menu and moves focus          | 327-333 | None. CSS can hide the FAB, but not close a popover.                                                                                                                       | Keep |
| Focus back to the FAB on close (Safari doesn't focus a clicked button)       | 342-357 | The popover's own focus restore works only when the invoker had focus.                                                                                                     | Keep |
| ArrowDown from the FAB to the first item                                   | 360-365 | None.                                                                                                                                                                      | Keep |
| A click on the list's padding closes                                       | 368-370 | None. That padding is inside the popover.                                                                                                                                  | Keep |
| `--ac-fab-menu-room` from the FAB's top, refit on scroll and resize          | 374-391 | The list is already anchored (`position-anchor`, FabMenu.astro:274). Set `bottom: anchor(top)` and `top: 0` with `align-self: end`, and the box can't grow past the FAB's top. | Eliminate this part |
| Close after an item's click                                                | 397-403 | None (see the comment: the items may need `command` for their own action).                                                                                                 | Keep |

**Support:** anchor positioning in Chrome 125, Firefox 147 and Safari 26; abspos `align-self` as above. **Estimate:** reduce by about 18 of 110 lines.

#### BaseOverlay (container transform)

- **Anchor the overlay to its opener** (BaseOverlay.astro:153-164) by writing an `anchor-name` on the opener. The opener is always the `source` of the toggle (a `commandfor` button or `showPopover({ source })`), which is the implicit anchor, so `position-anchor: auto` replaces this. **Reduce.** One part stays: `data-ac-overlay-opener-dir`, which reads the opener's `direction`. **Tried in #286 and kept:** WebKit drops the implicit anchor as the popover starts to close, before `beforetoggle` fires, so the exit's clip, measured then, starts from the unanchored box (ChipInput.spec.ts's closing test fails in WebKit). Menu and Tooltip don't measure themselves on close, and moved to implicit anchors.
- **Grow from the opener's box with the Web Animations API** (BaseOverlay.astro:167-248, 260-291). A CSS version would start the panel at `width: anchor-size(width); height: anchor-size(height)` in `@starting-style` and transition to `auto` under `interpolate-size: allow-keywords`. `anchor-size()` exists in Chrome 125, Firefox 147 and Safari 26, but `interpolate-size` and `calc-size()` are Chrome 129 only ([BCD](https://github.com/mdn/browser-compat-data); [MDN `interpolate-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size): "Limited availability"). Two more losses: a size transition reflows the content, unlike the current clip, and the sequencing (content fades only once the container has mostly grown) would become delays. **Keep.** Revisit when `interpolate-size` reaches two engines.
- **Return focus to the opener on close** (BaseOverlay.astro:251-255), which WebKit leaves to the page. **Keep.**

**Estimate:** reduce by about 12 of 161 lines.

#### Tooltip

| Responsibility                                                                                        | Lines   | Platform replacement                                                                       | Verdict |
| ----------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ | ------- |
| Hover 500ms, linger 1500ms, focus, Escape, one at a time                                               | 171-179, 247-331 | `interestfor` + `popover="hint"` + `interest-delay: 500ms 1500ms`                         | Watch |
| Long press on touch shows it and swallows the click and callout                                         | 186-242 | Interest invokers' long press, in the explainer only                                       | Watch |
| Plain tooltip anchors to an inner `<span>`, so its `anchor-name` doesn't clash                          | template 88-92 | `showPopover({ source: parent })` makes the parent the implicit anchor, with no span        | Reduce |
| Rich tooltip appends its `anchor-name` to the trigger's                                                | 339-348 | Implicit anchor from `popoverTargetElement` (the persistent tooltip) or `source` (the transient one) | Reduce |
| `aria-describedby` on the trigger                                                                     | 351-359 | Interest invokers would add `aria-details` and `aria-expanded`, not `aria-describedby`        | Keep |
| Persistent rich tooltip: auto popover, `aria-expanded`, closes when focus leaves                       | 386-416 | `aria-expanded` is mapped natively for `popovertarget` ([HTML-AAM §3.6.109](https://w3c.github.io/html-aam/)), but the CSS may read it | Keep |
| Transient rich tooltip: hover and focus delays, dismissal                                              | 418-488 | `interestfor`, as above                                                                    | Watch |

**What interest invokers would give.** Interest is shown by hovering, focusing or long-pressing the element. The invoker becomes the popover's implicit anchor, and Escape "cancels all interest" ([MDN, Using interest invokers](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers)). `interest-delay-start` and `interest-delay-end` set the delays. Chromium's defaults are 0.25s and 0.15s. Touch interest shows at once and lasts until Escape, until the popover closes, or until something else shows interest ([Open UI explainer](https://open-ui.org/components/interest-invokers.explainer/)). Hint popovers close other hint popovers, which is M3's one-at-a-time rule.

**Why it's "watch".**

- **Support:** `interestfor` and `interest-delay` are Chrome 142 only; Firefox and Safari have neither ([BCD](https://github.com/mdn/browser-compat-data)). web-features counts full support from Chrome 149 ([webstatus.dev](https://webstatus.dev/features/interest-invokers)). `popover="hint"` is fully supported only in Chrome 151 and Firefox 153, where earlier versions implement "an older version of the specification" (Chrome 133, Firefox 149), and Safari has it only in preview ([BCD `html.global_attributes.popover.hint`](https://github.com/mdn/browser-compat-data)). The current script would have to stay for Firefox and Safari, behind `Object.hasOwn(HTMLButtonElement.prototype, "interestForElement")`.
- **Semantics change, so it needs a screen-reader pass.** For a "plain hint" the explainer makes the hint text the invoker's name when it has none, or else its description. For a "rich hint" it adds `aria-details` and `aria-expanded`. The plain tooltip is `aria-hidden` today because the element is named elsewhere, so a native plain hint could announce the text a second time.
- **Different timings.** The touch long press would show at once, where M3 asks for 500ms. Whether a touch release starts the 1500ms linger (lines 199-202) isn't specified.

**Estimate:** reduce by about 20 of 321 lines now (anchoring). Once Firefox and Safari ship interest invokers, most of the 321 could go.

#### ChipInput

| Responsibility                                                       | Lines   | Platform replacement                                                                                                                                                                         | Verdict |
| -------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Remove a chip, move focus to a neighbour, cancelable `remove`          | 208-242, 366-369 | None.                                                                                                                                                                                        | Keep |
| Edit mode: swap the body for a field, cancelable `edit` and `change`   | 252-332, 334-397 | None.                                                                                                                                                                                        | Keep |
| Size the edit field to its text by measuring it on a canvas            | 260-274, 386-389 (before #287) | `field-sizing: content` sizes an `<input>` to its value. It's Baseline newly available since 2026-06-16: Chrome 123, Firefox 152, Safari 26.2 ([webstatus.dev](https://webstatus.dev/features/field-sizing); [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing)). TextField already uses it (TextField.astro:144). Add a `min-inline-size` and 1px of end padding for the caret. Done in #287. WebKit still scrolls the text by up to 1px as the caret reaches the end, which the start padding takes. | Eliminated |
| Toggle `aria-pressed` on the body                                    | 345-349 | None.                                                                                                                                                                                        | Keep |
| Mirror the popover's state into `aria-expanded`                       | 401-414 | The HTML-AAM already exposes expanded for a `command` toggle-popover button ([§3.6.25](https://w3c.github.io/html-aam/)). The attribute stays because BaseChip's pressed style reads it, and no selector exposes an invoker's open state. | Keep |

**Estimate:** reduce by about 20 of 219 lines. Done in #287, which removed the canvas measuring.

#### TextFieldChips

The largest script (TextFieldChips.astro:186-787). Most of it is behaviour M3 defines and the platform has no equivalent for: committing text to a chip, Backspace selecting a chip, Shift with an arrow moving a chip, dragging, and the overflow scroll that follows the caret.

| Responsibility                                                      | Lines   | Platform replacement                                                                                                                                                                                                 | Verdict |
| ------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| A hidden input per chip, kept by MutationObservers; `required` only while empty | 237-287 | A `formdata` listener on the form can append each chip's value when the form's data is built (Baseline widely available: Chrome 77, Firefox 72, Safari 15; [MDN](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/formdata_event)). The `required` toggle still needs the observer. A page that reads `form.elements` would no longer see the values. | Reduce (optional) |
| Position announcement in a status region                              | 289-309 | None.                                                                                                                                                                                                                | Keep |
| FLIP slide of chips that change place                                  | 314-346 | `document.startViewTransition()` with a `view-transition-name` per chip and one `view-transition-class` for the spring. Same-document view transitions are Baseline newly available since 2025-10-14: Chrome 111, Firefox 144, Safari 18 ([webstatus.dev](https://webstatus.dev/features/view-transitions)). `view-transition-class` is Chrome 125, Firefox 144, Safari 18.2. The drag must keep FLIP, since a document transition stops the page responding while it runs. Element-scoped transitions (`Element.startViewTransition`) would avoid that, but they're Chrome 147 only. | Improve (optional) |
| `moveBefore` with an `insertBefore` fallback                           | 353-365 | Already the platform feature: Chrome 133, Firefox 144; Safari has none ([BCD](https://github.com/mdn/browser-compat-data)). The fallback stays.                                                                     | Keep |
| Keyboard: Enter commits, Backspace selects, arrows, typing on a chip   | 396-539 | None.                                                                                                                                                                                                                | Keep |
| Scroll to the start or end on blur and focus                          | 556-598 | None.                                                                                                                                                                                                                | Keep |
| Pointer drag between fields                                          | 603-786 | HTML drag and drop was rejected (ADR-0026 §6).                                                                                                                                                                       | Keep |

**Estimate:** reduce by about 30 of 602 lines at most. Both reductions are optional and cost risk.

#### BaseTextField

| Responsibility                                                                    | Lines   | Platform replacement                                                                                                                                                                       | Verdict |
| --------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| A press on the container focuses the input                                         | 570-581 | A `<label>` around the container would do it, but a label can't hold the field's icon buttons ([HTML label content model](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)). | Keep |
| Animate a growing textarea's height                                                | 590-610 | `field-sizing` changes the used height, not the computed one, so neither a transition nor `interpolate-size` reacts to it.                                                                 | Keep |
| Counter, over-limit `setCustomValidity`, announcement                              | 616-646 | `maxlength` stops input at the limit instead of showing M3's error, and nothing counts characters in CSS.                                                                                 | Keep |
| `aria-disabled` on the field; `role="alert"` while in error (`:user-invalid` read in JS) | 622-623, 648-657 | `:user-invalid` styling is native (Baseline widely available; [webstatus.dev](https://webstatus.dev/features/user-pseudos)). The alert role must come from script.                       | Keep |
| Observers for `disabled` and `aria-invalid`, form reset                            | 668-698 | None.                                                                                                                                                                                      | Keep |

**Estimate:** keep.

#### BaseChip, BaseListItem, ButtonGroupConnected (the pressed state)

All three set a `data-*-pressed` mark from `pointerdown` to `pointerup` or `pointercancel`. BaseChip and ButtonGroupConnected also set it while Space (and Enter) is held. The reason given is that Firefox applies `:active` to neither a `<label>` nor its input (before #288: BaseChip.astro:125-156, BaseListItem.astro:435-453, ButtonGroupConnected.astro:292-327; ADR-0022, ADR-0024, ADR-0028).

- **No platform replacement** if Firefox still behaves that way. The HTML spec says a labelable element is `:active` while its label is ([HTML §selector-active](https://html.spec.whatwg.org/multipage/semantics-other.html#selector-active)). Re-tested in Firefox 157 (#288): it still falls short. The first press on a label chip matches `:active`, but after it, while that chip's input keeps focus, a press on another label matches `:active` on neither the label nor its input. Chromium 156 and WebKit 27.2 match every press. The scripts stay.
- **Reduced** (#288): the three now call one delegated helper, `markPressed` in `src/utils.ts` (see [Cross-cutting](#cross-cutting)).
- **Dragged state** (BaseChip.astro:159-168, Card.astro:133-146): no CSS pseudo-class matches an element being dragged. **Keep.**

#### BaseListItem (line count)

A ResizeObserver recounts the item's lines and top-aligns any item 88px or taller (BaseListItem.astro:401-433, ADR-0027). CSS can't count the lines a text wraps to. A container size query on height would need `container-type: size`, which fixes the height it's measuring. **Keep.**

#### List, ChipGroup, ButtonGroup, ButtonGroupConnected, NavRail, NavDrawer, Tabs (arrow keys)

- **List** (List.astro:101-177): one Tab stop by roving `tabindex`, with memory, wrap, and right-to-left mirroring; Space activates links, Enter toggles checkboxes. This is `focusgroup` almost exactly. A behaviour token "supplies a minimum role only when the container is generic", so the list keeps `role="list"`, and arrow direction "follows content direction" ([Open UI explainer](https://open-ui.org/components/scoped-focusgroup.explainer/)). Chrome 150 shipped it to replace "hand-coded roving tabindex scripts" ([Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150)). It's Chrome 150 only ([BCD](https://github.com/mdn/browser-compat-data)). **Watch.** Space and Enter stay.
- **Tabs** (Tabs.astro:171-207): roving tabindex, arrows, Home and End fit `focusgroup="tablist"` (implying `inline wrap`). **Watch.**
- **ChipGroup** (ChipGroup.astro:64-120), **ButtonGroup** (ButtonGroup.astro:210-226), **ButtonGroupConnected multi-select** (ButtonGroupConnected.astro:338-362): ADR-0022 §4 and ADR-0024 §5 keep every item a Tab stop, while `focusgroup` always makes the group one Tab stop. Adopting it means revisiting those ADRs, not just swapping code.
- **NavRail and NavDrawer up and down arrows** (NavRail.astro:205-216, NavDrawer.astro:367-375): no roving, every link a Tab stop. Same conflict.
- **ADR-0022 §3:** native radios already keep their own keyboard, and nothing here changes that.

#### Tabs (selection)

- **Selection, `aria-selected`, showing a panel** (Tabs.astro:209-244). **Keep.** CSS-only tabs (`:target`, radios, `::scroll-marker`) don't give the APG tabs pattern's roles and states. `::scroll-marker` is Chrome 135 only anyway ([webstatus.dev](https://webstatus.dev/features/scroll-markers)).
- **Scrolling a tab into view without scrolling the page** (Tabs.astro:150-158): `scrollIntoView({ container: "nearest" })` does this in one call. It's Chrome 140 only ([webstatus.dev](https://webstatus.dev/features/scroll-into-view-container)). **Keep.**
- **Improve:** `hidden="until-found"` on inactive panels, with a `beforematch` listener that selects the panel's tab, would let find-in-page reach hidden tab content. `beforematch` is in Chrome 102, Firefox 139 and Safari 26.2. `until-found` is in Chrome 102 and Firefox 148 (139 partial). Safari 26.2 has it partially: it "does not correctly scroll to the matching text" ([BCD](https://github.com/mdn/browser-compat-data); [MDN `beforematch`](https://developer.mozilla.org/docs/Web/API/Element/beforematch_event)). Caveat: `until-found` hides with `content-visibility: hidden` rather than `display: none`, so Tab's enter and exit classes, which transition `display`, would need rework. This adds about 10 lines.

#### NavRail and NavDrawer

- **Initial expanded state before first paint** (NavRail.astro:137-149, inline). It sets an ARIA attribute, which CSS can't. **Keep.**
- **Modal rail and drawer: inert the rest of the page, close on Escape and outside click** (NavRail.astro:221-271, NavDrawer.astro:220-238, 397-408). A modal `<dialog>` (`showModal()`, `closedby="any"`) would do all of this natively. But the rail and drawer are in the layout from medium up and only modal below it, and one element can't be a modal dialog in one size class and an in-flow element in another without forcing `dialog:not([open]) { display: block }`. **Keep**, but share one `setInert` helper (see [Cross-cutting](#cross-cutting)). `inert` itself is Baseline widely available ([webstatus.dev](https://webstatus.dev/features/inert)).
- **NavDrawer hover open and close with 200ms and 300ms delays** (NavDrawer.astro:298-312, 354-360). `interestfor` with `interest-delay: 200ms 300ms` is the platform shape for this. The drawer isn't a popover from large up, though, and the feature is Chromium only. **Keep.**
- **Section swap with a fade** (NavDrawer.astro:175-202). It waits on `transitionDuration` with a timer. **Keep.** A same-document view transition could cross-fade the sections, but M3 wants the outgoing links to fade out before the new ones fade in.
- **Breakpoint resets** (NavRail.astro:276-284, NavDrawer.astro:413-433). Moving the sections between `<nav>`s needs script. **Keep.**

#### NavBarItem

Re-selecting the current destination scrolls to the top (NavBarItem.astro:122-155). No declarative equivalent. **Keep** (about 30 lines).

#### Snackbar

| Responsibility                                                       | Lines   | Platform replacement                                                                                                                                                                                                     | Verdict |
| -------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Queue by cancelling `beforetoggle` (ADR-0031)                          | 293-300, 325-331 | None.                                                                                                                                                                                                                    | Keep |
| Live-region text                                                     | 306-311, 327 | None (ADR-0031 §3).                                                                                                                                                                                                      | Keep |
| Timeout, paused by hover and focus                                    | 280-291, 333-357 | None.                                                                                                                                                                                                                    | Keep |
| Placement clear of the nav bar, FAB, rail and drawer                  | 172-264, 388-391 | Anchor positioning could express "above the nav bar" with `bottom: anchor(--nav-bar top, 12px)`, using the fallback value when the anchor is absent. But anchor names must be unique, a FAB may be one of several, and the "widest it can be" logic doesn't map. | Keep (investigate) |
| Action click and Escape close, Alt+G focus shortcut                   | 360-385 | A manual popover has no light dismiss, and `closedby` is for `<dialog>` only.                                                                                                                                           | Keep |

**Estimate:** keep.

#### ProgressLinear and ProgressCircular

- **A MutationObserver copies `position` into a custom property** (ProgressLinear.astro:339-355, ProgressCircular.astro:284-300). Typed `attr()` could read `value` and `max` as numbers, but only on the `<progress>` itself, and the drawn parts are its siblings. It's also Chrome 133 and Firefox 155 only, with Safari in preview ([BCD `css.types.attr.type_function`](https://github.com/mdn/browser-compat-data)). **Keep.**
- **A `requestAnimationFrame` loop redraws the wavy path every frame** (ProgressLinear.astro:357-468, ProgressCircular.astro:302-366). It reads a CSS-animated `@property` phase through `getComputedStyle`. The CSS `d` property could animate the path, but Safari parses it and ignores it ([BCD `css.properties.d`](https://github.com/mdn/browser-compat-data)). A periodic wave is shift-invariant, so a long precomputed wave translated by CSS, clipped to the progress, would replace the loop for a steady amplitude. M3's amplitude, though, eases to flat near 0% and 100%. **Keep**, and prototype the translated wave.
- **Improve now:** the loops keep running under `prefers-reduced-motion`, where the phase doesn't move. They also run for indicators scrolled out of view. Stop the loop as ProgressLoading does (lines 136-139, 153-160), and skip roots an IntersectionObserver reports off screen.

#### ProgressLoading

A `requestAnimationFrame` loop morphs between M3's shapes on a damped spring, turning a quarter each time (ProgressLoading.astro:82-161).

- The sequence is fixed: the same morphs, the same 650ms interval, the same spring. So it can be computed at build time. One option is SVG `<animate attributeName="d">` with precomputed `values`, sampling the spring finely, plus `<animateTransform type="rotate">`. SMIL `<animate>` works in every engine ([BCD `svg.elements.animate`](https://github.com/mdn/browser-compat-data)). Another is CSS `@keyframes` on `clip-path: shape()` (Baseline newly available since 2026-02-24; [webstatus.dev](https://webstatus.dev/features/shape-function)), with a `linear()` easing for the spring (Baseline widely available; [webstatus.dev](https://webstatus.dev/features/linear-easing)).
- **Caveat:** SMIL ignores `prefers-reduced-motion`. Render a static first frame and the animated SVG, and switch between them with `motion-safe:` and `motion-reduce:` classes. Interpolating between `d` values needs the same command structure at each key. The morphs are already cubic-matched, but this needs checking.
- **A11y:** none. The indicator's role and name are on the markup.

**Estimate:** eliminate about 80 lines (prototype first).

#### Button and ButtonIcon (toggles)

Flip `aria-pressed` (or `aria-expanded`) on click (Button.astro:219-231, ButtonIcon.astro:236-248). A toggle button's state lives in ARIA, which nothing declarative flips. A native checkbox would change the role, and ADR-0022 reserves that for groups. **Keep** (13 lines each).

#### Checkbox

Sets `indeterminate`, which has no content attribute (Checkbox.astro:247-259; [MDN](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/indeterminate)). **Keep.**

#### Switch

Enter toggles the switch (Switch.astro:287-302). No native control answers Enter. Safari's `<input type="checkbox" switch>` gives a native switch role, but only in Safari 17.4 and later ([webstatus.dev](https://webstatus.dev/features/switch-control)), and it doesn't change the keys. **Keep.**

#### ChipFilter

- Enter checks a checkbox chip (ChipFilter.astro:202-211). **Keep**, for the same reason as Switch.
- A menu chip shows its menu's choice (ChipFilter.astro:218-245). **Keep.** A customizable `<select>` (`appearance: base-select`) is the platform's control for "a button showing the chosen option", but it announces a combobox and listbox rather than M3's menu button, and it's Chrome 135 and Safari 27 only ([webstatus.dev](https://webstatus.dev/features/customizable-select)).

#### Card

Dragged state only (Card.astro:133-146). **Keep.**

#### ButtonGroup (press widening)

The pressed button grows 15%, taken from its neighbours within their padding, on the fast spatial spring, and springs back only once it's 75% wide (ButtonGroup.astro:37-181). A CSS approximation would give `:active` and its neighbours (`:has(+ :active)`, `:active + *`) `calc-size(auto, size …)` widths under `interpolate-size`. That's Chromium only, can't honour the "75% before release" rule, and Enter doesn't set `:active`. **Keep.**

#### TableOfContents (internal) and the `/colors` page

TableOfContents.astro:61-84 closes the modal sheet on an in-page link and at the large breakpoint. `/colors` (src/pages/colors/index.astro:323-415) applies a generated theme and lazy-loads Shiki. Neither has a declarative equivalent. **Keep.** The MDX examples' scripts (chip-input and text-field-chips `documentation.mdx`) demonstrate the components' events and are out of scope.

### Cross-cutting

1. **A shared "pressed" helper.** BaseChip.astro:128-156, BaseListItem.astro:438-453 and ButtonGroupConnected.astro:294-327 repeat the same `pointerdown` → mark → `pointerup` or `pointercancel` → unmark logic, plus BaseChip's and ButtonGroupConnected's Space and Enter variant. One delegated function in `src/utils.ts` (already imported by NavBarItem and NavDrawer) taking a selector and an attribute would save about 40 lines. Copy-paste consumers already copy `utils.ts` with NavBarItem, so it adds no new dependency. If Firefox now applies `:active` through labels, all of it goes.
2. **A shared scrim fallback.** The four modal surfaces repeat the scrim-click handler. With `closedby="any"` in the markup, one helper attached under `!("closedBy" in HTMLDialogElement.prototype)` covers Safari until it ships. The `returnValue` clearing on `cancel` stays in each component, since it's specified behaviour (see Dialog).
3. **A shared `setInert`.** NavRail.astro:221-238 and NavDrawer.astro:220-238 are identical apart from the scrim selector.
4. **Implicit anchors everywhere.** Menu, BaseOverlay and Tooltip all write `anchor-name` on another element from script. Every popover they open has an invoker or a `source`, and that is the implicit anchor in Chrome 133, Firefox 147 and Safari 26 (see Menu). This is the biggest safe win in positioning code. The context menu's point is the one exception. Done for Menu and Tooltip in #286; BaseOverlay keeps its named anchor (see BaseOverlay).
5. **Spring timing read from CSS in four places.** ButtonGroup.astro:88-95, BaseTextField.astro:603-609 and TextFieldChips.astro:315-323 read `--theme-duration-spring-fast-spatial` and `--ease-spring-fast-spatial` through `getComputedStyle` to drive `element.animate()`. Share one `springTiming(name)` helper. Where a transition can be triggered by a class instead (TextFieldChips' FLIP with view transitions), the timing can stay in CSS.
6. **Duplicated breakpoints.** NavRail, NavDrawer, FabMenu, Snackbar and TableOfContents repeat `(width >= 37.5rem)` and `(width >= 75rem)` as literals beside theme.css's `--breakpoint-*` (ADR-0014). A tiny exported `breakpoints` constant would keep them in step. CSS custom media queries (`@custom-media`) would let CSS share them too, but `matchMedia` can't read those.
7. **`aria-expanded` mirroring.** Menu, ChipInput and Tooltip (persistent) set `aria-expanded` that the HTML-AAM already maps for `commandfor` and `popovertarget` invokers ([HTML-AAM §3.6.25, §3.6.109](https://w3c.github.io/html-aam/)). It stays because the CSS reads the attribute. A future `:open`-style selector for invokers would let it go.
8. **Watch list.** When Firefox and Safari ship `interestfor` and `popover="hint"` (Tooltip, NavDrawer, Menu submenus), `focusgroup` (List, Tabs, Menu, and the groups if their ADRs change), and `interpolate-size` (BaseOverlay, ButtonGroup), the scripts could shrink by roughly 700 lines. Track them on [webstatus.dev](https://webstatus.dev/).

### Unverified

- **Firefox's `:active` on a label and its input.** The ADRs rely on Firefox giving `:active` to neither, but no current Bugzilla bug was found confirming it as of Firefox 155. Related reports exist ([1795620](https://bugzilla.mozilla.org/show_bug.cgi?id=1795620), [1167862](https://bugzilla.mozilla.org/show_bug.cgi?id=1167862)). Re-tested in Firefox 157 (#288): a press on a label after an earlier press elsewhere, with focus still on the earlier input, matches `:active` on neither, so the helper stays.
- ~~**`closedby` light dismiss in practice.**~~ Settled by #285. The Dialog, DialogFullscreen, SheetBottom and SheetSide specs pass with native light dismiss in Playwright's Chromium 156, Firefox 157 and WebKit 27.2: `cancel` fires first, `preventDefault()` keeps the dialog open, a press dragged out of the panel doesn't close it, and `returnValue` is left unchanged. Under the close watcher rules, `cancel` is cancelable only when the window has history-action activation, which the scrim click gives. A `requestClose()` from script without a user action fires a `cancel` that can't be prevented. Playwright's WebKit is ahead of shipping Safari, so the Safari fallback (`closeOnScrimClick` in `src/utils.ts`) is tested by forcing it in Dialog.spec.
- **`position-try-order` with a bounded size.** MDN doesn't say how it interacts with `align-self: start` and a clamped height. Item 5 needs a prototype.
- **Interest invokers on touch.** The long press, its timing and the accessibility mappings come from the Open UI explainer, not from the HTML spec or Chrome's release notes. No primary source confirmed which of them Chrome 142–149 ships.
- **`focusgroup` syntax as shipped.** Chrome 150's post gives only `focusgroup="toolbar wrap"`. The token list here is the Open UI explainer's.
- **Version numbers.** All versions come from BCD 8.1.8 and web-features 3.45.0 as fetched on 2026-11-08, including Safari 27 and Firefox 152–155. They weren't cross-checked against each vendor's release notes.

### Sources

Support data:

- MDN browser-compat-data 8.1.8: https://github.com/mdn/browser-compat-data (keys cited inline)
- web-features 3.45.0 (Baseline status): https://github.com/web-platform-dx/web-features, browsable at https://webstatus.dev/
- webstatus.dev feature pages: https://webstatus.dev/features/dialog-closedby, https://webstatus.dev/features/field-sizing, https://webstatus.dev/features/has, https://webstatus.dev/features/inert, https://webstatus.dev/features/user-pseudos, https://webstatus.dev/features/interest-invokers, https://webstatus.dev/features/view-transitions, https://webstatus.dev/features/scroll-markers, https://webstatus.dev/features/scroll-into-view-container, https://webstatus.dev/features/shape-function, https://webstatus.dev/features/linear-easing, https://webstatus.dev/features/switch-control, https://webstatus.dev/features/customizable-select

Specs:

- HTML, the dialog element, `closedby` and light dismiss: https://html.spec.whatwg.org/multipage/interactive-elements.html#attr-dialog-closedby
- HTML, `:active`: https://html.spec.whatwg.org/multipage/semantics-other.html#selector-active
- HTML, the label element: https://html.spec.whatwg.org/multipage/forms.html#the-label-element
- HTML Accessibility API Mappings (`command`, `commandfor`, `popovertarget`): https://w3c.github.io/html-aam/
- CSS Anchor Positioning, implicit anchor element: https://drafts.csswg.org/css-anchor-position/#implicit-anchor-element

MDN:

- `<dialog>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- Using interest invokers: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
- Invoker Commands API: https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API
- `position-try-order`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-try-order
- `interpolate-size`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size
- `field-sizing`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing
- `beforematch`: https://developer.mozilla.org/docs/Web/API/Element/beforematch_event
- `formdata` event: https://developer.mozilla.org/docs/Web/API/HTMLFormElement/formdata_event
- `HTMLInputElement.indeterminate`: https://developer.mozilla.org/docs/Web/API/HTMLInputElement/indeterminate

Vendors and explainers:

- Chrome, keyboard-focusable scrollers: https://developer.chrome.com/blog/keyboard-focusable-scrollers
- Chrome 150 (`focusgroup`): https://developer.chrome.com/blog/new-in-chrome-150
- Open UI, interest invokers explainer: https://open-ui.org/components/interest-invokers.explainer/
- Open UI, scoped focusgroup explainer: https://open-ui.org/components/scoped-focusgroup.explainer/
- Mozilla Bugzilla 1795620: https://bugzilla.mozilla.org/show_bug.cgi?id=1795620
- Mozilla Bugzilla 1167862: https://bugzilla.mozilla.org/show_bug.cgi?id=1167862
