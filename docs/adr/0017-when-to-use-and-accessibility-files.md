# When to use it and Accessibility get their own files, in a fixed place on the page

> **Amends ADR-0010 point 1**: `documentation.mdx`'s body still holds a component's guidance prose, but no longer its When to use it or Accessibility sections.

ADR-0010's amendment let `documentation.mdx`'s body hold free guidance prose, rendered after Usage. The sections every component ought to have drifted in it (#177):

- **The same topic had different names.** Accessibility guidance was headed "Accessibility" on seven pages, "Keyboard and screen readers" on FabMenu and NavDrawer, and "Labels" on SheetBottom.
- **Its place varied.** Divider had "When to use it" and "When not to use it" as two sections with another between them; FabMenu's "When not to use it" sat near the end.
- **The order was off.** Usage rendered before the body, so "When to use it" came after the code sample, though it's what tells a reader whether they want the component at all.

We decided:

1. **Two more optional files per component, each one section.** `when-to-use.mdx` (collection `whenToUse`) and `accessibility.mdx` (collection `accessibility`), with no frontmatter. Their body is the section's content; the page gives the heading, "When to use it" or "Accessibility", so it can't be renamed. "When not to use it" goes in `when-to-use.mdx` as an h3.
2. **The page renders the sections in a fixed order:** overview, When to use it, Usage, the `documentation.mdx` body, Accessibility, Properties, Slots, Examples. Guidance comes first, Accessibility closing it since it often builds on the body's sections, then the reference material.
3. **Only these two.** They're the sections most components share. Component-specific guidance (Placement, Heights, Roles...) stays in the body. Anatomy, so far only on SheetBottom, is the next candidate if more components get one.

Unlike `usage.mdx` and `example-*.mdx` (ADR-0010), these files aren't split out to render their source as code. They exist so the page, not each author, decides what the sections are called and where they go.

## Consequences

`src/internal/DocSection.astro` renders either file, with the same heading and spacing as the body's own sections. `src/pages/components/[id].astro` adds both, and their h3s, to the table of contents in page order. `src/internal/DocsPages.spec.ts` checks the order on SheetBottom's page, which has every section.

Neither file is required yet: many components have no accessibility notes, and requiring them is a content task of its own.
