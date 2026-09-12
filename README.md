# astro-components

An open-source library of copy-paste Astro + Tailwind components, published as a
documentation site at [`/components`](/components). Each component's source is
meant to be copied straight into your own project rather than installed as a
package dependency — there's no upstream link to keep in sync.

## What's here

Every component lives in its own folder under `src/components/`, alongside the
files that generate its documentation page:

```
src/components/button/
├── Button.astro                    # the component itself
├── Button.spec.ts                  # Playwright + axe-core tests
├── documentation.mdx               # name, description, role, prop manifest, slots
├── usage.mdx                       # baseline usage: prose + a live preview/source pair
└── example-01-variant-solid.mdx    # one file per named variant/scenario
```

`documentation.mdx` holds structured, machine-checkable frontmatter (props,
slots, `role: primitive | pattern | internal`, ...) consumed by both the
rendered props table and a coding agent; its MDX body stays empty. Prose and
live examples live in the sibling `usage.mdx` and `example-*.mdx` files
instead. See [`CONTEXT.md`](./CONTEXT.md) for the full vocabulary (tokens,
theming, component roles) and [`docs/adr/`](./docs/adr) for the design
decisions behind it.

### Components

| Component        | Role      | Description                                                                                                  |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `Button`          | pattern   | A custom Button component that extends HTML's `<button>` element.                                             |
| `Details`         | pattern   | A custom Details component that extends HTML's `<details>` element with a styled summary and animated chevron toggle. |
| `Dialog`          | pattern   | A custom Dialog component that extends HTML's `<dialog>` element.                                             |
| `DialogConfirm`   | pattern   | A ready-made confirmation dialog built on Dialog, with a title and a footer of confirm/cancel buttons wired to close it. |
| `Popover`         | pattern   | A custom Popover component that extends HTML's `<div>` element with a `popover` attribute.                    |
| `Tabs` / `Tab`    | pattern   | A custom Tabs component that extends HTML's `<section>` element; `Tab` holds one tab's label and content.     |
| `Heading`         | pattern   | A heading element rendering as h1-h6, styled from this repo's Document heading font-size/weight scale.        |
| `Icon`            | pattern   | Renders one of the library's inline SVG icons, sized and colored via CSS like any other inline SVG.           |
| `Link`            | pattern   | A styled native anchor element, providing consistent link color and hover/underline treatment.                |
| `BaseOverlay`     | primitive | Renders as a native `<dialog>` or `<div popover>`, providing shared open/close transitions for Dialog and Popover. |
| `TabList` / `TabPanels` | internal | Implementation detail of `Tabs` — not meant to be used on their own.                                     |

## Project structure

```
/
├── src/
│   ├── components/       # one folder per component (see above)
│   ├── internal/         # docs-site rendering helpers (table of contents, code preview, MDX renderers, ...)
│   ├── layouts/           # BaseLayout.astro - header, sidebar nav, footer
│   ├── pages/             # file-based routes, incl. src/pages/components/[id].astro
│   ├── content.config.ts  # Zod schemas for the components/usage/examples content collections
│   └── styles/global.css  # design tokens (Tailwind v4 @theme)
├── docs/
│   ├── adr/               # architecture decision records
│   └── agents/            # conventions for AI coding agents working in this repo
└── CONTEXT.md             # domain vocabulary for the design system
```

## Commands

All commands are run with [pnpm](https://pnpm.io) from the root of the project:

| Command             | Action                                             |
| :------------------ | :-------------------------------------------------- |
| `pnpm install`      | Install dependencies                               |
| `pnpm dev`          | Start the local dev server at `localhost:4321`     |
| `pnpm build`        | Build the production site to `./dist/`             |
| `pnpm preview`      | Preview the production build locally               |
| `pnpm test`         | Run the Playwright + axe-core test suite           |
| `pnpm lint`         | Lint with ESLint                                    |
| `pnpm format`       | Format with Prettier                               |
| `pnpm astro ...`    | Run Astro CLI commands (`astro check`, `astro add`, ...) |

### Testing

Tests run with Playwright across Chromium, Firefox, and WebKit, with
`@axe-core/playwright` wired in for accessibility assertions
(see [`docs/adr/0002-test-framework-and-a11y-tooling.md`](./docs/adr/0002-test-framework-and-a11y-tooling.md)
and [`docs/accessibility-checklist.md`](./docs/accessibility-checklist.md)).
Each component's `*.spec.ts` sits alongside it in its own folder.

## Stack

[Astro](https://astro.build) 7, [Tailwind CSS](https://tailwindcss.com) 4,
TypeScript, and MDX-backed content collections for the documentation.

## License

[MIT](./LICENSE)
