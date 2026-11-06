# A snackbar is a manual popover the page shows natively, and its script queues and places it

M3's snackbar shows a short update at the bottom of the window, one at a time, and announces it without moving focus (#206). Compose gives it a host object: the app calls `showSnackbar()` with a message, and the host queues, times and draws each one. A copy-paste Astro component has no app state to hold a host, and the library's other overlays are shown by the browser (`commandfor` with `show-modal` or `toggle-popover`). We decided:

1. **Each snackbar is its own `<Snackbar id>`, rendered with the page, and a `popover="manual"`.** The page shows it the same way as the other overlays: a button with `commandfor` and `command="show-popover"`, or `showPopover()` from a script. Its close button is `command="hide-popover"`. It sits in the top layer, above a navigation bar or a modal sheet's scrim, and a manual popover doesn't close on a click elsewhere, which a snackbar mustn't.
2. **The queue is a cancelled `beforetoggle`.** When a snackbar is about to open while another is open, its script cancels the opening and queues it, and shows the next one once the open one hides. So "only one at a time" holds whichever way the page shows a snackbar, with no API of the library's own.
3. **The announcement goes through a `role="status"` region beside the popover, not on it.** A popover is `display: none` until it shows, and screen readers don't reliably announce a live region that appears with its text already in it. The region is on the page from the start, and the script writes the text into it as the snackbar shows and clears it as it hides.
4. **The script places it from marker attributes, before it shows.** It goes up above a fixed `[data-ac-nav-bar]`, `[data-ac-fab]` (added to Fab for this) or `[data-ac-fab-menu]` beneath it, and from medium up starts past a `[data-ac-nav-rail]` or `[data-ac-nav-drawer]` running down the window's start side, through two custom properties its classes read. It runs in `beforetoggle`, before the snackbar is drawn, so it reckons with the widest the snackbar can be and two lines' height rather than measuring it.

We rejected a host component holding one snackbar whose text a script swaps. It would need a JavaScript API to show a message, unlike the other overlays, and an action's click handler would have to change with each message. We also rejected finding what to avoid by probing the page for fixed elements with `elementsFromPoint`. It would also avoid fixed elements that aren't M3's, such as Astro's dev toolbar, and move the snackbar between dev and production.

## Consequences

- A page renders every snackbar it might show. A message that changes, such as a count, is set on the snackbar's `[data-ac-snackbar-part="text"]` before it shows.
- Something else fixed to the bottom of the window, such as a future docked toolbar, needs adding to the script's list of what to avoid.
- While a snackbar shows, its text is on the page twice for a screen reader browsing it: in the snackbar and in the live region.
