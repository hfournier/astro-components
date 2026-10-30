import { test, expect } from "./support/a11y-fixture";

// A prop outside its set fails the build rather than drawing something other than was asked for
// (ADR-0021). /tests/component-props renders each case and lists "rendered" or the error it threw.
const sizes = `"xs", "sm", "md", "lg" and "xl"`;
const fabSizes = `"default", "md" and "lg"`;
const expected: Record<string, string | RegExp> = {
  "badge-placement": `Badge: its placements are "anchored" and "inline", but this one's \`placement\` is "floating".`,
  "base-chip-as": `BaseChip: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "base-chip-variant": `BaseChip: M3's chip styles are "flat" and "elevated", but this one's \`variant\` is "outlined".`,
  "base-overlay-as": `BaseOverlay: its elements are "dialog" and "div", but this one's \`as\` is "section".`,
  "base-overlay-bg-color": `BaseOverlay: M3's overlay surfaces are "surface", "surface-container-low", "surface-container", "surface-container-high", "inverse-surface" and "tertiary-container", but this one's \`bgColor\` is "primary-container".`,
  "base-overlay-transition": `BaseOverlay: its transitions are "fade", "fade-scale" and "fade-down", but this one's \`transition\` is "slide".`,
  "base-wrapper-as": `BaseWrapper: its elements are "article", "aside", "div", "figure", "footer", "header", "main" and "section", but this one's \`as\` is "span".`,
  "base-wrapper-bg-color":
    /^BaseWrapper: its backgrounds are "primary-container", .+ and "transparent", but this one's `bgColor` is "primary"\.$/,
  "base-button-as": `BaseButton: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "base-button-variant": `BaseButton: M3's button styles are "elevated", "filled", "tonal", "outlined" and "text", but this one's \`variant\` is "contained".`,
  "base-button-size": `BaseButton: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "base-button-toggle-text": `BaseButton: M3's toggle buttons are "elevated", "filled", "tonal" and "outlined", but this one's \`variant\` is "text".`,
  "button-as": `Button: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "button-variant": `Button: M3's button styles are "elevated", "filled", "tonal", "outlined" and "text", but this one's \`variant\` is "contained".`,
  "button-shape": `Button: M3's shapes are "round" and "square", but this one's \`shape\` is "oval".`,
  "button-size": `Button: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "button-toggle-text": `Button: M3's toggle buttons are "elevated", "filled", "tonal" and "outlined", but this one's \`variant\` is "text".`,
  "button-group-connected-name":
    "ButtonGroupConnected: its options submit as one form field, which needs a name, but this one's `name` is undefined.",
  "button-group-connected-selection": `ButtonGroupConnected: its selections are "single" and "multi", but this one's \`selection\` is "exclusive".`,
  "button-group-connected-shape": `ButtonGroupConnected: M3's shapes are "round" and "square", but this one's \`shape\` is "oval".`,
  "button-group-connected-size": `ButtonGroupConnected: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "button-group-connected-variant": `ButtonGroupConnected: M3's toggle buttons are "elevated", "filled", "tonal" and "outlined", but this one's \`variant\` is "text".`,
  "button-group-connected-one-option":
    "ButtonGroupConnected: M3's connected button groups join two or more buttons, but this one has 1.",
  "button-group-connected-two-selected":
    "ButtonGroupConnected: a single-select group has at most one option selected, but this one has 2.",
  "button-group-connected-required-none":
    "ButtonGroupConnected: a group whose selection is required starts with an option selected, but this one has none.",
  "button-icon-shape": `ButtonIcon: M3's shapes are "round" and "square", but this one's \`shape\` is "oval".`,
  "button-icon-size": `ButtonIcon: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "button-icon-variant": `ButtonIcon: M3's icon button styles are "filled", "tonal", "outlined" and "standard", but this one's \`variant\` is "text".`,
  "button-icon-width": `ButtonIcon: M3's widths are "narrow", "default" and "wide", but this one's \`width\` is "full".`,
  "button-split-menu-id":
    "ButtonSplit: its trailing button opens a Menu, which needs the menu's id, but this one's `menuId` is undefined.",
  "button-split-menu-id-empty":
    "ButtonSplit: its trailing button opens a Menu, which needs the menu's id, but this one's `menuId` is \"\".",
  "button-split-menu-label":
    "ButtonSplit: its trailing button shows only an icon, which needs a name, but this one's `menuLabel` is undefined.",
  "button-split-name":
    "ButtonSplit: its leading button needs a name, from its label or an `aria-label`, but this one has neither.",
  "button-split-size": `ButtonSplit: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "button-split-variant": `ButtonSplit: M3's split buttons are "elevated", "filled", "tonal" and "outlined", but this one's \`variant\` is "text".`,
  // checked where it's used, in BaseChip (ADR-0021 §5)
  "chip-assist-as": `ChipAssist: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "chip-assist-variant": `ChipAssist: M3's chip styles are "flat" and "elevated", but this one's \`variant\` is "tonal".`,
  "chip-suggestion-as": `ChipSuggestion: its elements are "button" and "a", but this one's \`as\` is "span".`,
  "chip-suggestion-variant": `ChipSuggestion: M3's chip styles are "flat" and "elevated", but this one's \`variant\` is "outlined".`,
  "details-size": `Details: its sizes are "md" and "lg", but this one's \`size\` is "sm".`,
  "details-variant": `Details: its variants are "outlined" and "plain", but this one's \`variant\` is "filled".`,
  "divider-inset": `Divider: M3's insets are "none", "start" and "middle", but this one's \`inset\` is "end".`,
  "divider-orientation": `Divider: M3's orientations are "horizontal" and "vertical", but this one's \`orientation\` is "diagonal".`,
  "fab-size": `Fab: M3's sizes are ${fabSizes}, but this one's \`size\` is "sm".`,
  "fab-color": `Fab: M3's colors are "primary-container", "secondary-container", "tertiary-container", "primary", "secondary" and "tertiary", but this one's \`color\` is "surface".`,
  "fab-menu-size": `FabMenu: M3's sizes are ${fabSizes}, but this one's \`size\` is "sm".`,
  "fab-menu-color": `FabMenu: M3's colors are "primary", "secondary" and "tertiary", but this one's \`color\` is "primary-container".`,
  "fab-menu-align": `FabMenu: its alignments are "end" and "start", but this one's \`align\` is "center".`,
  "heading-level": `Heading: HTML's heading levels are 1 to 6, but this one's \`level\` is 7.`,
  "heading-level-not-a-number": `Heading: HTML's heading levels are 1 to 6, but this one's \`level\` is "two".`,
  "heading-level-as-text": "rendered h2",
  "menu-color": `Menu: M3's colors are "standard" and "vibrant", but this one's \`color\` is "tonal".`,
  "menu-layout": `Menu: M3's layouts are "standard" and "grouped", but this one's \`layout\` is "list".`,
  "nav-drawer-width": `NavDrawer: its widths are "narrow" and "wide", but this one's \`width\` is "medium".`,
  "nav-rail-expanded-width": `NavRail: its expanded widths are "narrow" and "wide", but this one's \`expandedWidth\` is "medium".`,
  "nav-rail-align": `NavRail: M3's alignments are "top" and "center", but this one's \`align\` is "bottom".`,
  "popover-bg-color": `Popover: M3's popover surfaces are "surface-container", "surface-container-high" and "inverse-surface", but this one's \`bgColor\` is "surface-container-low".`,
  "sheet-side-edge": `SheetSide: its edges are "start" and "end", but this one's \`edge\` is "left".`,
  "switch-icons": `Switch: M3's icon options are "none", "selected" and "both", but this one's \`icons\` is "unselected".`,
  "tab-transition": `Tab: its transitions are "fade", "fade-up" and "slide-left", but this one's \`transition\` is "slide".`,
  "tabs-align": `Tabs: M3's alignments are "start" and "center", but this one's \`align\` is "end".`,
  "tabs-variant": `Tabs: M3's tabs are "primary" and "secondary", but this one's \`variant\` is "tertiary".`,
  "text-field-type": `TextField: its types are "text", "email", "number", "password", "search", "tel", "url" and "textarea", but this one's \`type\` is "date".`,
  "text-field-variant": `TextField: M3's styles are "filled" and "outlined", but this one's \`variant\` is "standard".`,
  "text-field-rows-as-text": "rendered 4 rows",
  "text-field-rows-zero": `TextField: a text area is a whole number of lines tall, from 1, but this one's \`rows\` is 0.`,
  "text-field-rows-fraction": `TextField: a text area is a whole number of lines tall, from 1, but this one's \`rows\` is 2.5.`,
  "text-field-rows-not-a-number": `TextField: a text area is a whole number of lines tall, from 1, but this one's \`rows\` is "tall".`,
  "text-field-maxlength-as-text": "rendered 20 characters",
  "text-field-maxlength-negative": `TextField: a character limit is a whole number, from 0, but this one's \`maxlength\` is -1.`,
  "text-field-maxlength-not-a-number": `TextField: a character limit is a whole number, from 0, but this one's \`maxlength\` is "long".`,
  "tooltip-placement": `Tooltip: its placements are "above" and "below", but this one's \`placement\` is "left".`,
  "tooltip-variant": `Tooltip: M3's tooltips are "plain" and "rich", but this one's \`variant\` is "tooltip".`,
};

// One page load for every case, each checked softly so a run reports all that fail
test("each component throws on a prop outside its set, naming the prop and its value", async ({
  page,
}) => {
  await page.goto("/tests/component-props");
  for (const [name, outcome] of Object.entries(expected)) {
    await expect
      .soft(page.getByTestId(`component-props-${name}`), name)
      .toHaveText(outcome);
  }
  await expect(page.locator("[data-testid^=component-props-]")).toHaveCount(
    Object.keys(expected).length
  );
});
