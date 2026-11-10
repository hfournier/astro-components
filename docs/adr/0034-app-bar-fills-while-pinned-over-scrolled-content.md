# An app bar goes in the page's header and fills only while it's pinned over scrolled content

M3's small app bar sits at the top of the page and fills with surface container when content scrolls under it (#209). Compose ties this to a scroll behavior the app attaches to its scrolling content. A web page has no such link: an app bar is just an element, and whether content passes under it depends on how the page positions it. We decided:

1. **AppBar is a `<div>` that goes in the page's `<Header>`.** It doesn't render the `<header>` itself. M3 calls it part of the page's header, and a page's header can hold more than the app bar. Pinning is the page's choice: `sticky top-0` on the header, or on the app bar itself inside a scrolling box. AppBar sets no position of its own.
2. **It's marked scrolled while it's pinned and its scroll container has scrolled.** One script listener for the page, in the capture phase so it hears every scroll container's scroll as well as the window's, runs once a frame. It finds each app bar then, so bars added later are covered. For each, it finds the scroll container: the nearest ancestor that scrolls vertically and overflows, or the window. Overflowing is checked too, since an element with `overflow-x: hidden` has `overflow-y: auto` but never scrolls. It also finds the element that pins the bar: the bar itself or an ancestor below that container, `sticky` or `fixed`. It sets `data-ac-app-bar-scrolled` when the container has scrolled and that element is fixed, or is sticky and at its `top`. CSS sets the wrapper background to surface container from that attribute, so focus rings' offsets follow it.
3. **A bar that scrolls with its page stays surface.** Nothing passes under it, so there's nothing to set it apart from. This also keeps the docs' examples on surface as the docs page scrolls.
4. **The headline is text, not a heading, and takes text only.** M3 gives it the accessibility role "Title", which the web has no match for. A heading would sit outside the page's own outline, since M3 lets the headline name the product or a section as well as the page, so the page's `<h1>` stays in `<main>`. M3's image or logo in place of the headline is left for later: `headline` is required text.

We rejected `scroll-state()` container queries, which DialogFullscreen's header uses. They're Chromium only, and the acceptance criteria ask for the fill in every engine. Scroll-driven animations can't run the fill on M3's fast effects spring as a transition, and Firefox doesn't ship them yet. We also rejected marking the bar scrolled whenever its container has scrolled. Every app bar in a docs page would then fill once the page scrolled, with nothing under it.

## Consequences

- A pinned app bar needs a `z-index` above the content that scrolls under it, such as `z-1`, since icon buttons and other positioned content otherwise paint over it.
- An app bar pinned below another sticky element (a `top` other than 0) still fills from its own `top`.
- Once `scroll-state(stuck: top)` is in every engine, the script could give way to it: the pinned element would be the container, and the bar would restyle from its state.
