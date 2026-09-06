# Document heading font-size: six-step scale replaces the two heading roles

Supersedes the font-size portion of ADR-0005 (`--font-size-heading-sm`/`-lg`, two roles). Font-weight's heading roles (`--font-weight-heading-sm`/`-lg`) and everything else in ADR-0005 stand unchanged.

ADR-0005 gave document headings two fluid font-size roles, `heading-sm` and `heading-lg`, "spec-only" pending a retrofit. That retrofit (`Heading.astro`) mapped h1-h3 onto `heading-lg` and h4-h6 onto `heading-sm` — the only grouping two roles allow for six levels. The result: h1, h2, and h3 render at an identical size (and so do h4, h5, h6), so the element consumers actually reach for six of — `level="h1"` through `level="h6"` — carries no visual distinction beyond the two group boundaries. A heading scale that only distinguishes two of its six levels isn't doing the job a document heading hierarchy exists for.

- **Six roles, one per level, named by magnitude (`xs`/`sm`/`md`/`lg`/`xl`/`2xl`) rather than by tag.** Matches the T-shirt naming `--radius-*` and `--border-width-*` already use, and keeps the token honest about what it is: a visual-weight step, not a repackaging of the HTML tag it's currently applied to (`CONTEXT.md`'s **Document heading** entry is explicit that the tag is not the scale). `Heading.astro`'s `level` prop maps `h1→2xl, h2→xl, h3→lg, h4→md, h5→sm, h6→xs` — the mapping lives in the component, not the token name, so a future consumer needing (say) an `xl`-sized heading rendered as an `<h3>` isn't fighting the token's name to do it.
- **Each step stays an independent `clamp()` literal, not a `calc()`-derived multiple of a base token.** ADR-0005 already chose hand-tuned `clamp()` expressions over aliasing a static `--text-*` step for exactly this property, reasoning that headings read better scaling continuously with viewport than jumping at breakpoints; a `calc()`-multiplier scale (the `--radius-*` pattern) would need the *same* multiplier to apply sensibly to a `clamp()`'s min, viewport-linear, and max components at once, which isn't guaranteed to stay legible at every step without independently checking each one anyway. Six hand-tuned literals cost one design pass; a formula that still needs the same pass buys nothing.
- **Font-weight's boundary does not move.** `--font-weight-heading-sm` (semibold, h4-h6) / `-lg` (bold, h1-h3) stays exactly as ADR-0005 defined it. Size alone now carries the six-way distinction; widening the bold/semibold split to more than two steps was considered and dropped; more than two weight steps in one hierarchy reads as inconsistent rather than more legible, not a real gain over what six distinct sizes already deliver.
- **Values** (`rem`, fluid between the viewport widths implied by each `clamp()`):

  | Token | clamp() | Min → max | Mapped level |
  |---|---|---|---|
  | `--font-size-heading-xs` | `clamp(1rem, 0.95rem + 0.5vw, 1.125rem)` | 16px → 18px | h6 |
  | `--font-size-heading-sm` | `clamp(1.125rem, 1.05rem + 0.75vw, 1.25rem)` | 18px → 20px | h5 |
  | `--font-size-heading-md` | `clamp(1.25rem, 1.15rem + 1vw, 1.5rem)` | 20px → 24px | h4 |
  | `--font-size-heading-lg` | `clamp(1.5rem, 1.3rem + 1.5vw, 1.875rem)` | 24px → 30px | h3 |
  | `--font-size-heading-xl` | `clamp(1.75rem, 1.45rem + 2vw, 2.25rem)` | 28px → 36px | h2 |
  | `--font-size-heading-2xl` | `clamp(2rem, 1.6rem + 3vw, 3rem)` | 32px → 48px | h1 |

  Chosen to stay monotonically increasing at both the min and max end of every step, and to roughly bracket ADR-0005's old range (old `heading-sm` 18-22px, old `heading-lg` 24-36px) rather than invent a disconnected new range.

This is hard to reverse once `Heading.astro` is retrofitted against it (collapsing back to two roles means re-deciding the same h1-h3/h4-h6 grouping this ADR just rejected), surprising without knowing the token name no longer has any fixed relationship to a specific `<h*>` tag, and reflects a real trade-off: six hand-tuned literals to maintain vs. two — more tokens for a hierarchy that, unlike radius or duration, has no natural "sweep it all faster/rounder" use case to justify a shared dial.

## Consequences

- Spec-only, same as ADR-0005/0006: this adds the six tokens to `global.css`'s `@theme` block and updates `CONTEXT.md`'s **Document heading** entry to reference them. It does not edit `Heading.astro` — retrofitting the component's `headingClasses` map onto the new tokens is deliberate follow-on work, tracked separately.
- `--font-size-heading-sm`/`-lg` change meaning: previously two three-level groups, now `-sm` means h5 alone and `-lg` means h3 alone. Nothing outside `Heading.astro` currently consumes these tokens, so no other component needs auditing, but a future PR reviewer diffing against ADR-0005 should not assume `-sm`/`-lg` still mean "h4-h6"/"h1-h3."
- No visual change ships from this ticket alone; the visible six-way size distinction lands with the `Heading.astro` retrofit.
