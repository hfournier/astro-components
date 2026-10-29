import { test, expect } from "./support/a11y-fixture";

// A prop outside its set fails the build rather than drawing something other than was asked for
// (ADR-0021). /tests/component-props renders each case and lists "rendered" or the error it threw.
const sizes = `"xs", "sm", "md", "lg" and "xl"`;
const fabSizes = `"default", "md" and "lg"`;
const expected: Record<string, string | RegExp> = {
  "badge-placement": `Badge: its placements are "anchored" and "inline", but this one's \`placement\` is "floating".`,
  "base-overlay-as": `BaseOverlay: its elements are "dialog" and "div", but this one's \`as\` is "section".`,
  "base-overlay-bg-color": `BaseOverlay: M3's overlay surfaces are "surface", "surface-container-low", "surface-container", "surface-container-high", "inverse-surface" and "tertiary-container", but this one's \`bgColor\` is "primary-container".`,
  "base-overlay-transition": `BaseOverlay: its transitions are "fade", "fade-scale" and "fade-down", but this one's \`transition\` is "slide".`,
  "base-wrapper-as": `BaseWrapper: its elements are "article", "aside", "div", "figure", "footer", "header", "main" and "section", but this one's \`as\` is "span".`,
  "base-wrapper-bg-color":
    /^BaseWrapper: its backgrounds are "primary-container", .+ and "transparent", but this one's `bgColor` is "primary"\.$/,
  "button-as": `Button: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "button-variant": `Button: M3's button styles are "elevated", "filled", "tonal", "outlined" and "text", but this one's \`variant\` is "contained".`,
  "button-shape": `Button: M3's shapes are "round" and "square", but this one's \`shape\` is "oval".`,
  "button-size": `Button: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "button-icon-shape": `ButtonIcon: M3's shapes are "round" and "square", but this one's \`shape\` is "oval".`,
  "button-icon-size": `ButtonIcon: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "button-icon-variant": `ButtonIcon: M3's icon button styles are "filled", "tonal", "outlined" and "standard", but this one's \`variant\` is "text".`,
  "button-icon-width": `ButtonIcon: M3's widths are "narrow", "default" and "wide", but this one's \`width\` is "full".`,
  "details-size": `Details: its sizes are "md" and "lg", but this one's \`size\` is "sm".`,
  "details-variant": `Details: its variants are "outlined" and "plain", but this one's \`variant\` is "filled".`,
  "divider-inset": `Divider: M3's insets are "none", "start" and "middle", but this one's \`inset\` is "end".`,
  "divider-orientation": `Divider: M3's orientations are "horizontal" and "vertical", but this one's \`orientation\` is "diagonal".`,
  "fab-size": `Fab: M3's sizes are ${fabSizes}, but this one's \`size\` is "sm".`,
  "fab-color": `Fab: M3's colors are "primary-container", "secondary-container", "tertiary-container", "primary", "secondary" and "tertiary", but this one's \`color\` is "surface".`,
  "fab-menu-size": `FabMenu: M3's sizes are ${fabSizes}, but this one's \`size\` is "sm".`,
  "fab-menu-color": `FabMenu: M3's colors are "primary", "secondary" and "tertiary", but this one's \`color\` is "primary-container".`,
  "fab-menu-align": `FabMenu: its alignments are "end" and "start", but this one's \`align\` is "center".`,
  "menu-color": `Menu: M3's colors are "standard" and "vibrant", but this one's \`color\` is "tonal".`,
  "menu-layout": `Menu: M3's layouts are "standard" and "grouped", but this one's \`layout\` is "list".`,
  "nav-drawer-width": `NavDrawer: its widths are "narrow" and "wide", but this one's \`width\` is "medium".`,
  "nav-rail-expanded-width": `NavRail: its expanded widths are "narrow" and "wide", but this one's \`expandedWidth\` is "medium".`,
  "nav-rail-align": `NavRail: M3's alignments are "top" and "center", but this one's \`align\` is "bottom".`,
  "sheet-side-edge": `SheetSide: its edges are "start" and "end", but this one's \`edge\` is "left".`,
  "switch-icons": `Switch: M3's icon options are "none", "selected" and "both", but this one's \`icons\` is "unselected".`,
  "text-field-type": `TextField: its types are "text", "email", "number", "password", "search", "tel", "url" and "textarea", but this one's \`type\` is "date".`,
  "text-field-variant": `TextField: M3's styles are "filled" and "outlined", but this one's \`variant\` is "standard".`,
  "text-field-rows-as-text": "rendered",
  "text-field-rows-zero": `TextField: \`rows\` is a whole number of lines from 1, but this one's is 0.`,
  "text-field-rows-fraction": `TextField: \`rows\` is a whole number of lines from 1, but this one's is 2.5.`,
  "text-field-rows-not-a-number": `TextField: \`rows\` is a whole number of lines from 1, but this one's is tall.`,
  "text-field-maxlength-as-text": "rendered",
  "text-field-maxlength-negative": `TextField: \`maxlength\` is a whole number of characters from 0, but this one's is -1.`,
  "text-field-maxlength-not-a-number": `TextField: \`maxlength\` is a whole number of characters from 0, but this one's is long.`,
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
