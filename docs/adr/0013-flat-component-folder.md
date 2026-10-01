# Components sit flat in src/components; their docs and specs move to src/docs

> **Supersedes the folder layout assumed by ADR-0009 and ADR-0010**: a component's `.astro` file no longer shares a folder with its `documentation.mdx`, `usage.mdx`, `example-*.mdx` and `.spec.ts`. The file split and frontmatter those ADRs define are unchanged.

Each component used to live in its own folder (`src/components/button/Button.astro`) next to the files that document and test it. That suited this site, but it isn't how anyone uses the components. A project that copies them in puts the `.astro` files straight into its own `src/components/`. Because components import each other by relative path (`../icon/Icon.astro`, `../../types`), a flat copy broke every import, and the getting-started guide had to tell users to recreate this repo's folders.

We decided:

1. **Components live flat in `src/components/<Name>.astro`**, exactly as they'd sit in a consuming project. They import each other as `./<Name>.astro` and the shared files as `../types` and `../svgs`, so a copied file works unchanged.
2. **Each component's docs and specs move to `src/docs/<id>/`**: `documentation.mdx`, `usage.mdx`, `example-*.mdx` and `<Name>.spec.ts`. `<id>` is the kebab-case name the folder had before, so content-collection ids and the `/components/<id>` routes don't change. The `components`, `usage` and `examples` collections glob `src/docs/` instead of `src/components/`.

We rejected two alternatives. Rewriting imports into a generated flat copy at build time would have kept co-location, but it adds a build step and a second copy of every component to keep correct. Path aliases can't map a flat name onto a nested file, and consumers would need the same alias anyway.

## Consequences

- What's in `src/components/` is exactly what a user copies. Instructions, a future registry or an agent can name files without translating paths.
- A component's source and its docs are no longer side by side. Editing a component means opening `src/components/<Name>.astro` and `src/docs/<id>/`.
- `src/components/` holds only components. Anything else there would be copied by users who take the whole folder.
