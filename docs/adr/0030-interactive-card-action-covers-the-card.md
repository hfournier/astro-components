# An interactive card's action is a link or button covering the card

M3's cards (#205) come in two kinds. A non-actionable card is "purely a container" with no role, and the buttons and links in it are the tab stops. A directly actionable card is one tab stop, with "the button or link role", and is "one large touch target". The issue also asks that an interactive card "still allows separate buttons inside it", as M3's Guidelines draw: an album card with a primary action area and an overflow menu, or a card with a slider. Compose's `Card(onClick)` allows that, since a clickable `Surface` can hold other clickable children.

HTML can't do that. A `<button>` can't hold another button, and an `<a>` can't hold any interactive content: the browser re-parents a nested link, a nested button breaks keyboard and screen reader behavior, and axe reports it. M3's Accessibility page says the same thing for the same reason: "An action shouldn't be placed on an actionable surface."

We decided:

1. **`as` picks the kind:** `"div"` (the default) or `"article"` for a static card, and `"a"` or `"button"` for an interactive one. ListItem picks a static, link or button item with `as` the same way.
2. **An interactive card's action is its own element, a sibling of the content, covering the card.** The card is a `<div>` whose first child is an empty `<a>` or `<button>` (`data-ac-card-part="action"`), absolutely positioned over the whole card, below the content. It's first, so Tab reaches the card before the buttons in it, as M3's Accessibility page orders them.
3. **The content lets clicks through to the action, except its own controls.** An interactive card sets `pointer-events: none`, and the links, buttons, form controls and other focusable elements in it set `pointer-events: auto`. A click on the card's text or image hits the action. A click on a button inside the card hits that button, and the card shows no state for it.
4. **The action is named through `aria-label` or `aria-labelledby`.** It has no text of its own, so a card without either fails the build (ADR-0021). The usual name is the card's headline, through `aria-labelledby`. Every attribute other than `class` and `draggable` goes on the action, so `href`, `disabled`, `aria-*` and `id` are the link's or button's. Only a button card can be `disabled`. A disabled link card fails the build, since HTML has no disabled link.
5. **The card shows the action's states,** through `card-*` variants in `theme.css` that read the action's state with `:has()`, as the `chip-*` variants do for a chip's input: its elevation, the on-surface state layer, a focused outlined card's on-surface outline, and the focus indicator. The indicator is a CSS `outline` 2px outside the card rather than the ring box-shadow other components use. The card sets its own `--theme-color-wrapper-bg`, so a ring offset would be drawn in the card's own color, not the page's.

We rejected these alternatives:

- **The whole card as one `<a>` or `<button>`.** It can't hold buttons, and a `<button>`'s content is presentational, so a heading inside it is no longer a heading.
- **A link around the headline, stretched over the card by a pseudo-element.** This is the usual "stretched link" pattern. It needs the page to mark which element is the action, and a positioned control in the content would then have to be raised above the stretched area one by one.

## Consequences

- An interactive card's text can't be selected, as with any whole-card link or button.
- Content that scrolls inside an interactive card won't scroll with the wheel, since the wheel goes to the action. M3 lets a card's content scroll only on desktop. A card like that is better static, with a button for its action.
- Screen readers read the card's name on its action, then its content, headline included, as they read any link named by `aria-labelledby`.
- Card clips its content to its corners, as Compose's does. Its outline is a border, so an outlined card's 1px edge is outside the action.
