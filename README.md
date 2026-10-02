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
and tests live in a folder of their own under `src/docs/`:

```
src/components/Button.astro         # the component itself
src/docs/button/
├── Button.spec.ts                  # Playwright + axe-core tests
├── documentation.mdx               # name, description, role, category, prop manifest, slots
├── usage.mdx                       # baseline usage: prose + a live preview/source pair
└── example-01-variants.mdx         # one file per named variant/scenario
```

`documentation.mdx` holds structured, machine-checkable frontmatter (props,
slots, `role: primitive | pattern | internal`, `category`, an optional `mdn`
link, ...) consumed by both the rendered props table and a coding agent; its
MDX body stays empty. Prose and live examples live in the sibling `usage.mdx`
and `example-*.mdx` files instead. See [`CONTEXT.md`](./CONTEXT.md) for the
full vocabulary (tokens, color roles, variants, background roles, component
roles) and [`docs/adr/`](./docs/adr) for the design decisions behind it.

### Components

| Component                        | Role      | Description                                                                                                       |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `Aside`                          | pattern   | A themed wrapper that renders as a native `<aside>`, built on BaseWrapper.                                        |
| `Badge`                          | pattern   | An M3 badge showing a count or status dot on another element (usually an icon), using CSS anchor positioning.    |
| `Button`                         | pattern   | Extends `<button>` (or `<a>` via `as="a"`) with M3's elevated/filled/tonal/outlined/text variants, shapes and sizes. |
| `Details`                        | pattern   | Extends `<details>` with an M3 summary row, optional leading icon and animated chevron; outlined or plain.        |
| `Dialog`                         | pattern   | A modal `<dialog>` styled after M3, with optional icon and headline, scrolling content and an actions footer.     |
| `DialogAcknowledge`              | pattern   | A ready-made `alertdialog` built on Dialog with a single acknowledgement action.                                  |
| `DialogConfirm`                  | pattern   | A ready-made `alertdialog` built on Dialog with a dismissing and a confirming action.                             |
| `Footer`                         | pattern   | A themed wrapper that renders as a native `<footer>`, built on BaseWrapper.                                       |
| `Header`                         | pattern   | A themed wrapper that renders as a native `<header>`, built on BaseWrapper.                                       |
| `Heading`                        | pattern   | Renders `h1`–`h6`, each level styled with one step of the M3 type scale.                                          |
| `Icon`                           | pattern   | Renders one of the library's inline SVG icons (Material Symbols), sized and colored via CSS.                      |
| `Link`                           | pattern   | A styled native anchor whose color follows the background it sits on.                                            |
| `Popover`                        | pattern   | A `<div popover>` with M3 overlay surfaces and an optional close button.                                          |
| `Section`                        | pattern   | A themed wrapper that renders as a native `<section>`, built on BaseWrapper.                                      |
| `SkipToContent`                  | pattern   | A visually-hidden-until-focused link that lets keyboard users skip to the main content.                           |
| `Tabs` / `Tab`                   | pattern   | M3 primary or secondary tabs with optional icons and badges; each `Tab` holds one tab's label and content.        |
| `BaseOverlay`                    | primitive | Renders as a native `<dialog>` or `<div popover>`, providing shared open/close transitions for Dialog and Popover. |
| `BaseWrapper`                    | primitive | Renders a sectioning/grouping element on an M3 background role, setting readable text, link and focus-ring colors. |
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
│   ├── data/tests/        # visual test pages, rendered at /tests/<id>
│   ├── docs/              # one folder per component: documentation, usage, examples, specs
│   ├── internal/          # docs-site rendering helpers (sidebar, table of contents, code preview, MDX renderers, ...)
│   ├── layouts/           # BaseLayout.astro - header, sidebar nav, footer
│   ├── pages/             # routes: home, /components/[id], /colors (theme generator), /tests/[id]
│   ├── styles/            # global.css (entry point), colors.css (generated M3 colors), theme.css (hand-written tokens)
│   ├── svgs/              # icon name list (SvgIconNameTypes) and the SVG loader Icon uses
│   ├── wip/               # components in progress, not yet documented
│   ├── component-list.ts  # every component, exposed to MDX examples
│   ├── content.config.ts  # Zod schemas for the components/usage/examples/tests content collections
│   └── types.ts           # shared prop types (background roles, variants, ...)
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
Each component's `*.spec.ts` sits in its docs folder under `src/docs/`. The suite
runs in light mode only.

## Stack

[Astro](https://astro.build) 7, [Tailwind CSS](https://tailwindcss.com) 4,
[tailwind-merge](https://github.com/dcastil/tailwind-merge), TypeScript,
MDX-backed content collections for the documentation, and
[`@poupe/material-color-utilities`](https://www.npmjs.com/package/@poupe/material-color-utilities)
for the theme generator.

## License

[MIT](./LICENSE)
