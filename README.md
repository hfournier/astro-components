# astro-components

An open-source library of accessible, copy-paste Astro + Tailwind components
styled after [Material 3](https://m3.material.io), published as a documentation
site. Each component's source is meant to be copied straight into your own
project rather than installed as a package dependency, so there's no upstream
link to keep in sync.

The site's home page has the full **getting started** guide: requirements,
which files to copy, how to set up the theme and generate your own colors, and
which components depend on which. The summary below is for working on this
repo itself.

## What's here

Components live flat in `src/components/`, laid out exactly as they'd sit in
your own project, so you can copy them as-is. Each component's documentation
lives in a folder of its own under `src/docs/`, and its tests in `src/tests/`:

```
src/components/Button.astro         # the component itself
src/docs/button/
├── documentation.mdx               # name, description, role, category, prop manifest, slots
├── usage.mdx                       # baseline usage: prose + a live preview/source pair
├── accessibility.mdx               # optional: the Accessibility section (when-to-use.mdx likewise)
└── example-01-variants.mdx         # one file per named variant/scenario
src/tests/
├── button.mdx                      # test page at /tests/button: the cases the spec runs against
└── Button.spec.ts                  # Playwright + axe-core tests (most specs are still moving here from src/docs/, #78)
```

`documentation.mdx` holds structured, machine-checkable frontmatter (props,
slots, `role: primitive | pattern | internal`, `category`, an optional `mdn`
link, ...) consumed by both the rendered props table and a coding agent; its
MDX body holds the component's own guidance prose. The When to use it and
Accessibility sections live in the optional sibling `when-to-use.mdx` and
`accessibility.mdx`, which the page places in a fixed order, and live examples
in `usage.mdx` and `example-*.mdx`. See [`CONTEXT.md`](./CONTEXT.md) for the
full vocabulary (tokens, color roles, variants, background roles, component
roles) and [`docs/adr/`](./docs/adr) for the design decisions behind it.

### Components

| Component                        | Role      | Description                                                                                                       |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `Aside`                          | pattern   | A themed wrapper that renders as a native `<aside>`, built on BaseWrapper.                                        |
| `Badge`                          | pattern   | An M3 badge showing a count or status dot on another element (usually an icon), using CSS anchor positioning.    |
| `Button`                         | pattern   | Extends `<button>` (or `<a>` via `as="a"`) with M3's elevated/filled/tonal/outlined/text variants, shapes and sizes. |
| `ButtonIcon`                     | pattern   | An M3 icon button: four styles, five sizes, three widths, an optional toggle state and a tooltip with its label.  |
| `Details`                        | pattern   | Extends `<details>` with an M3 summary row, optional leading icon and animated chevron; outlined or plain.        |
| `Dialog`                         | pattern   | A modal `<dialog>` styled after M3, with optional icon and headline, scrolling content and an actions footer.     |
| `DialogAcknowledge`              | pattern   | A ready-made `alertdialog` built on Dialog with a single acknowledgement action.                                  |
| `DialogConfirm`                  | pattern   | A ready-made `alertdialog` built on Dialog with a dismissing and a confirming action.                             |
| `Divider`                        | pattern   | An M3 divider built on `<hr>`, horizontal or vertical, full length or inset.                                      |
| `Fab`                            | pattern   | An M3 floating action button in three sizes and six color sets, for a screen's most important action.            |
| `Footer`                         | pattern   | A themed wrapper that renders as a native `<footer>`, built on BaseWrapper.                                       |
| `Header`                         | pattern   | A themed wrapper that renders as a native `<header>`, built on BaseWrapper.                                       |
| `Heading`                        | pattern   | Renders `h1`–`h6`, each level styled with one step of the M3 type scale.                                          |
| `Icon`                           | pattern   | Renders one of the library's inline SVG icons (Material Symbols), sized and colored via CSS.                      |
| `Link`                           | pattern   | A styled native anchor whose color follows the background it sits on.                                            |
| `Main`                           | pattern   | A themed wrapper that renders as a native `<main>`, built on BaseWrapper, with the id SkipToContent targets.     |
| `MenuToggle`                     | pattern   | The menu toggle button at the top of a NavRail, which also opens the rail on small screens, built on ButtonIcon.  |
| `NavBar` / `NavBarItem`          | pattern   | An M3 flexible navigation bar fixed to the bottom of the viewport, with its destinations stacked below the medium breakpoint (600px) and side by side from there up; each `NavBarItem` is one destination link, with an optional Badge. |
| `NavDrawer`                      | pattern   | An M3 navigation drawer beside a NavRail, showing the current or hovered destination's NavRailSubItems section.  |
| `NavRail` / `NavRailItem`        | pattern   | An M3 navigation rail, collapsed or expandable (adding its own menu button), with an optional FAB, opening as a modal from its menu button below the medium breakpoint (600px); each `NavRailItem` is one destination link, with an optional Badge. |
| `NavRailSubItems`                | pattern   | A labelled section of sub-items for one NavRail destination, shown in a NavDrawer or an expanded NavRail.        |
| `Popover`                        | pattern   | A `<div popover>` with M3 overlay surfaces and an optional close button.                                          |
| `Section`                        | pattern   | A themed wrapper that renders as a native `<section>`, built on BaseWrapper.                                      |
| `SheetBottom`                    | pattern   | An M3 bottom sheet: standard at the bottom of the content, collapsing to its drag handle, or modal over it.      |
| `SheetSide`                      | pattern   | An M3 side sheet on the start or end edge: standard beside the content, or modal over it; docked or detached.    |
| `SkipToContent`                  | pattern   | A visually-hidden-until-focused link that lets keyboard users skip to the main content.                           |
| `Tabs` / `Tab`                   | pattern   | M3 primary or secondary tabs with optional icons and badges; each `Tab` holds one tab's label and content.        |
| `Tooltip`                        | pattern   | M3 plain and rich tooltips, shown on hover and keyboard focus and placed with CSS anchor positioning.             |
| `BaseOverlay`                    | primitive | Renders as a native `<dialog>` or `<div popover>`, providing shared open/close transitions for Dialog and Popover. |
| `BaseWrapper`                    | primitive | Renders a sectioning/grouping element on an M3 background role, setting readable text, link and focus-ring colors. |
| `NavDrawerItem`                  | internal  | A full-width drawer link with an optional icon, rendered by NavRailSubItems for each sub-item.                    |
| `TabList` / `TabPanels`          | internal  | Implementation details of `Tabs`, not meant to be used on their own.                                              |

## Theme

Colors are Material 3 color roles generated by the theme generator page at
[`/colors`](/colors): pick a source color and a scheme variant, then copy the
generated CSS into `src/styles/colors.css`. Roles live in `:root` as
`--theme-color-<role>` with light and dark values (`light-dark()`, following the
OS color scheme); each key color's tonal palette is also available as Tailwind
colors (`bg-theme-primary-500`). Everything else (motion, elevation, the
component color roles that background roles re-point) is hand-written in
`src/styles/theme.css`. See [ADR-0012](./docs/adr/0012-material-3-color-roles.md).

## Project structure

```
/
├── src/
│   ├── assets/svgs/       # Material Symbols icon files used by Icon
│   ├── components/        # the components, flat, as they're copied into a project
│   ├── docs/              # one folder per component: documentation, usage, examples (specs are moving to tests/, see ADR-0015)
│   ├── internal/          # docs-site rendering helpers (table of contents, code preview, MDX renderers, ...)
│   ├── layouts/           # BaseLayout.astro - header, nav rail and drawer, footer
│   ├── pages/             # routes: home, /components/[id], /colors (theme generator), /tests/[id]
│   ├── styles/            # global.css (entry point), colors.css (generated M3 colors), theme.css (hand-written tokens)
│   ├── svgs/              # icon name list (SvgIconNameTypes) and the SVG loader Icon uses
│   ├── tests/             # test pages (rendered at /tests/<id>), the specs that drive them, fixtures, and the shared Playwright harness (support/)
│   ├── wip/               # components in progress, not yet documented
│   ├── component-list.ts  # every component, exposed to MDX examples
│   ├── content.config.ts  # Zod schemas for the components/usage/examples/tests content collections
│   ├── types.ts           # shared prop types (background roles, variants, ...)
│   ├── shapes.ts          # M3's shapes and morphs, ported from AndroidX graphics-shapes (ProgressLoading)
│   └── utils.ts           # shared helpers (current-path matching, MDX paragraph unwrapping, ...)
├── docs/
│   ├── adr/               # architecture decision records
│   └── agents/            # conventions for AI coding agents working in this repo
└── CONTEXT.md             # domain vocabulary for the design system
```

## Commands

All commands are run with [pnpm](https://pnpm.io) from the root of the project:

| Command          | Action                                                   |
| :--------------- | :------------------------------------------------------- |
| `pnpm install`   | Install dependencies                                     |
| `pnpm dev`       | Start the local dev server at `localhost:4321`           |
| `pnpm build`     | Build the production site to `./dist/`                   |
| `pnpm preview`   | Preview the production build locally                     |
| `pnpm test`      | Run the Playwright + axe-core test suite                 |
| `pnpm lint`      | Lint with ESLint                                         |
| `pnpm format`    | Format with Prettier                                     |
| `pnpm astro ...` | Run Astro CLI commands (`astro check`, `astro add`, ...) |

### Testing

Tests run with Playwright across Chromium, Firefox, and WebKit, with
`@axe-core/playwright` scanning every test's page for WCAG 2.2 AA violations
(see [`docs/adr/0002-test-framework-and-a11y-tooling.md`](./docs/adr/0002-test-framework-and-a11y-tooling.md)
and [`docs/accessibility-checklist.md`](./docs/accessibility-checklist.md)).
Each component's `*.spec.ts` sits in `src/tests/` beside its test page, which
holds the cases it runs against; specs never target the docs examples, and one
smoke spec (`src/internal/DocsPages.spec.ts`) checks every docs page with axe
(see [`docs/adr/0015-specs-drive-test-pages.md`](./docs/adr/0015-specs-drive-test-pages.md)).
Specs not yet migrated still sit in their docs folder under `src/docs/` (#78).
The suite runs in light mode only.

## Stack

[Astro](https://astro.build) 7, [Tailwind CSS](https://tailwindcss.com) 4,
[tailwind-merge](https://github.com/dcastil/tailwind-merge), TypeScript,
MDX-backed content collections for the documentation, and
[`@poupe/material-color-utilities`](https://www.npmjs.com/package/@poupe/material-color-utilities)
for the theme generator.

## License

[MIT](./LICENSE)
