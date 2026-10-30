# Props outside their set fail the build

> **Point 5 has an exception in ADR-0023**: Button and ButtonSplit check the props they pass to BaseButton themselves, so the error names the component the author wrote. ChipAssist and ChipSuggestion do the same for BaseChip.

Most components map a union prop to classes through a lookup, such as `{ sm: "…", md: "…" }[size]`. An unknown value finds nothing and renders the component without those classes, with no warning: `size="medium"`, a typo in MDX, or a number out of range draws something other than was asked for. TypeScript doesn't catch these. MDX pages, like the docs examples, aren't type-checked and pass every attribute as text, and TypeScript can't express a numeric range. The progress indicators (#193, #194, #195) were the first to check their props and throw. #241 extends that to every component.

We decided:

1. **Every prop whose type is a closed set of values is checked:** a union of string or number literals, inline or shared (`BgColorType`, `OverlayTransitionType`, `HeadingLevelType`), and the component's polymorphic `as`. That includes props whose type is an alias or required, which a search for `?: "` misses (Tabs, Tab, Heading), and a narrower set a wrapper allows (Popover's `bgColor`, or a toggle Button's `variant`, which can't be `text`). Booleans, free text, counts such as a badge's label, and icon names aren't checked here, nor props of internal components that only other components set.
2. **Every number prop is checked against the range the component can draw:** M3's range where the Specs page gives one (ProgressCircular's 24 to 240px), otherwise what the underlying attribute allows (TextField's `rows` is a whole number from 1). A number is read with `Number()`, so the text MDX passes (`rows="4"`) counts as the number it says. Anything that isn't a finite number in range fails.
3. **A failed check throws an `Error`, which fails the build** (and shows Astro's error overlay in dev). Its message names the component, gives the rule, and quotes the prop and its value: `<Component>: <rule>, but this one's \`<prop>\` is <value>.` A value given as text is quoted (`"medium"`, `rows` of `"tall"`) and a number isn't. The ProgressCircular, ProgressLinear and ProgressLoading messages predate this and print text that isn't a number unquoted. The rule says what M3 defines when it does (`M3's sizes are "xs", "sm", "md", "lg" and "xl"`), and what the component allows when M3 doesn't (`its placements are "anchored" and "inline"`).
4. **The checks sit inline in each component's frontmatter, right after its props are read,** before its other checks and its slot rendering, so a bad prop of its own is reported first. There is no shared helper: each component stays copyable on its own (ADR-0013). A shared union type that's checked has a runtime list beside it in `src/types.ts` (`bgColors`, with `BgColorType` derived from it), as `componentCategories` does, and the message lists its values from it.
5. **A prop is checked where it's used.** NavRail's `bgColor` goes to BaseWrapper, which checks it, so the message names BaseWrapper. BaseWrapper renders after NavRail's frontmatter, so NavRail's own checks, such as its destination count, come first.
6. **Each component's invalid props are tested by rendering them in an Astro container and reading the error,** on `/tests/component-props`, which `src/tests/ComponentProps.spec.ts` drives (ADR-0015). A component with a page of its own for this (the progress indicators) keeps it.
7. **The docs' prop descriptions say what fails the build:** "Any other value fails the build," or the range.

We rejected falling back to the default, with or without a console warning. It hides the mistake the check exists to show, and a warning during a build scrolls past. We also rejected a shared validation helper, since every component would then need it copied beside it.

## Consequences

- A new component with a union or number prop checks it the same way, and adds its cases to `/tests/component-props`.
- Adding a value to a union means adding it to the check's list too. The page's cases only cover invalid values, so a value left out of a list shows up when the component is rendered with it, as the build fails.
