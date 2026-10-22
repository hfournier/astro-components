# Breakpoints are M3's window size classes, under M3's names

Components followed Tailwind's default breakpoints (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px). Material 3 sizes layouts by window size class instead: compact (below 600px), medium (600px), expanded (840px), large (1200px) and extra-large (1600px), and pairs each with a navigation pattern. The two scales don't line up one-to-one, and every M3 threshold sits above the Tailwind one it would replace, so NavRail and NavDrawer switched modes at widths M3 doesn't use.

We decided:

1. **Tailwind's breakpoints are cleared** (`--breakpoint-*: initial` in `theme.css`) and replaced by `medium`, `expanded`, `large` and `xlarge`, in rem (37.5, 52.5, 75 and 100rem) so they follow the reader's font size. Compact is everything below `medium`, so it has no variant.
2. **M3's names, not Tailwind's.** Giving `lg` a new value would make `lg:` silently mean 1200px to anyone who knows Tailwind. With the defaults cleared, a leftover `lg:` generates no CSS at all.
3. **Navigation follows M3's pairing**: below `medium`, NavRail is a modal expanded rail opened by its MenuToggle; from `medium` to `large`, a collapsed rail, with NavDrawer as an overlay; from `large` up, NavDrawer is a standard drawer in the layout and an expandable rail starts expanded, its MenuToggle still able to collapse it (#158). On the docs site, the table of contents is M3's supporting pane, in a SheetSide: from `large` up, a standard side sheet docked to the window's end edge (256px, growing to fit its longest heading, up to 400px, only where that leaves the article its full 75ch), beside the page's `<main>` and below the header, level with the article (BaseLayout's `sheet` slot); below `large`, a modal side sheet behind a button. M3 allows two panes from `expanded`, but there the article would be left about 500px wide. Beside the rail, drawer and sheet, the article still has about 61ch at 1200px, and reaches its full width (75ch) by about 1325px.
4. **Other responsive steps go to the nearest M3 size**: `sm` to `medium`, `md` to `expanded`, `lg` to `large`.

## Consequences

- NavDrawer and NavRail repeat the `medium` and `large` widths in their `matchMedia()` calls (NavRail twice for `large`: in its module script and in the inline script that expands it before first paint), so changing a breakpoint in `theme.css` means changing those too.
- A project that imports `theme.css` gets these breakpoints for its whole app, not just these components, and loses Tailwind's `sm`-`2xl`.
- Between 1024px and 1199px, pages now get the collapsed rail and overlay drawer instead of the standard drawer, and the docs site's table of contents is a menu rather than a column. From 1200px to 1279px it's a column where it used to be a menu.
- Prettier's Tailwind plugin reads `src/styles/global.css` (`tailwindStylesheet`), so it sorts the new variants as breakpoints rather than as unknown classes.
