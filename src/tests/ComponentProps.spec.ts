import { test, expect } from "./support/a11y-fixture";

// A prop outside its set fails the build rather than drawing something other than was asked for
// (ADR-0021). /tests/component-props renders each case and lists "rendered" or the error it threw.
const sizes = `"xs", "sm", "md", "lg" and "xl"`;
const fabSizes = `"default", "md" and "lg"`;
const expected: Record<string, string | RegExp> = {
  "app-bar-align": `AppBar: M3's alignments are "start" and "center", but this one's \`align\` is "end".`,
  "app-bar-size": `AppBar: M3's sizes are "sm", "md" and "lg", but this one's \`size\` is "xl".`,
  "badge-placement": `Badge: its placements are "anchored" and "inline", but this one's \`placement\` is "floating".`,
  "base-chip-as": `BaseChip: its elements are "button", "a" and "label", but this one's \`as\` is "div".`,
  "base-chip-variant": `BaseChip: M3's chip styles are "flat" and "elevated", but this one's \`variant\` is "outlined".`,
  "base-overlay-as": `BaseOverlay: its elements are "dialog" and "div", but this one's \`as\` is "section".`,
  "base-overlay-bg-color": `BaseOverlay: M3's overlay surfaces are "surface", "surface-container-low", "surface-container", "surface-container-high", "inverse-surface" and "tertiary-container", but this one's \`bgColor\` is "primary-container".`,
  "base-overlay-transition": `BaseOverlay: its transitions are "fade", "fade-scale", "fade-down" and "container-transform", but this one's \`transition\` is "slide".`,
  "base-wrapper-as": `BaseWrapper: its elements are "article", "aside", "div", "figure", "footer", "header", "main" and "section", but this one's \`as\` is "span".`,
  "base-wrapper-bg-color":
    /^BaseWrapper: its backgrounds are "primary-container", .+ and "transparent", but this one's `bgColor` is "primary"\.$/,
  "base-button-as": `BaseButton: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "base-button-variant": `BaseButton: M3's button styles are "elevated", "filled", "tonal", "outlined" and "text", but this one's \`variant\` is "contained".`,
  "base-button-size": `BaseButton: M3's sizes are ${sizes}, but this one's \`size\` is "medium".`,
  "base-button-toggle-text": `BaseButton: M3's toggle buttons are "elevated", "filled", "tonal" and "outlined", but this one's \`variant\` is "text".`,
  "base-text-field-variant": `BaseTextField: M3's styles are "filled" and "outlined", but this one's \`variant\` is "standard".`,
  "base-text-field-layout": `BaseTextField: its layouts are "single-line", "multi-line" and "chips", but this one's \`layout\` is "multi-row".`,
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
  "card-as": `Card: its elements are "div", "article", "a" and "button", but this one's \`as\` is "section".`,
  "card-variant": `Card: M3's card styles are "elevated", "filled" and "outlined", but this one's \`variant\` is "tonal".`,
  "card-name":
    "Card: a link or button card is named through `aria-label` or `aria-labelledby`, but this one has neither.",
  "card-disabled-link": `Card: only a button card can be disabled, as a link can't be, but this one's \`as\` is "a" with \`disabled\`.`,
  // checked where it's used, in BaseChip (ADR-0021 §5)
  "checkbox-as": `Checkbox: its elements are "label" and "span", but this one's \`as\` is "div".`,
  "chip-assist-as": `ChipAssist: its elements are "button" and "a", but this one's \`as\` is "div".`,
  "chip-assist-variant": `ChipAssist: M3's chip styles are "flat" and "elevated", but this one's \`variant\` is "tonal".`,
  "chip-filter-menu-selected": `ChipFilter: a menu chip is selected by its menu's checked option, but this one, for "price", has \`isSelected\` too.`,
  "chip-filter-menu-single": `ChipFilter: a menu chip can't be one of a single-select set's radios, but this one, for "price", has \`selection="single"\`.`,
  "chip-filter-selection": `ChipFilter: its selections are "single" and "multi", but this one's \`selection\` is "one".`,
  "chip-filter-single-name": `ChipFilter: a single-select chip is a radio, grouped with the others by a shared \`name\`, but this one has none.`,
  "chip-filter-variant": `ChipFilter: M3's chip styles are "flat" and "elevated", but this one's \`variant\` is "outlined".`,
  "chip-group-name": `ChipGroup: a set of chips needs a name, from an \`aria-label\` or \`aria-labelledby\`, but this one has neither.`,
  "chip-group-overflow": `ChipGroup: its overflows are "wrap" and "scroll", but this one's \`overflow\` is "hidden".`,
  "chip-group-selection": `ChipGroup: its selections are "single" and "multi", but this one's \`selection\` is "one".`,
  "chip-input-edit-popover": `ChipInput: a tap on a chip either edits it or opens its popover, but this one, for "contact", has \`isEditable\` too.`,
  "chip-input-icon-avatar": `ChipInput: M3's input chip leads with an icon or an avatar, but this one has both, \`icon\` "person" and the \`avatar\` slot.`,
  "chip-input-selected-edit": `ChipInput: a tap selects a chip unless it edits it or opens its popover, but this one has \`isSelected\` with \`isEditable\`.`,
  "chip-input-selected-popover": `ChipInput: a tap selects a chip unless it edits it or opens its popover, but this one has \`isSelected\` with \`popoverId\`.`,
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
  "list-as": `List: its elements are "ul" and "ol", but this one's \`as\` is "menu".`,
  "list-divider": `List: M3's list dividers are "none", "full-width" and "inset", but this one's \`divider\` is "middle".`,
  "list-variant": `List: M3's list styles are "standard" and "segmented", but this one's \`variant\` is "contained".`,
  "list-segmented-divider": `List: M3 separates a segmented list's items with gaps, not dividers, but this one's \`divider\` is "inset".`,
  "list-item-as": `ListItem: its elements are "div", "a" and "button", but this one's \`as\` is "li".`,
  "list-item-video-size": `ListItem: M3's leading video sizes are "sm" and "lg", but this one's \`videoSize\` is "md".`,
  "list-item-leading": `ListItem: M3's list item leads with one icon, avatar, image, video or control, but this one has \`icon\` "person" and the \`avatar\` slot.`,
  "list-item-trailing": `ListItem: M3's list item ends with one icon, text or control, but this one has \`trailingIcon\` "chevron_right" and \`trailingText\` "100+".`,
  "list-item-checkbox-control-position": `ListItemCheckbox: M3 places its control at the "leading" or "trailing" end, but this one's \`controlPosition\` is "end".`,
  "list-item-checkbox-leading": `ListItemCheckbox: M3's list item leads with one icon, avatar, image, video or control, but this one has its checkbox and \`icon\` "person".`,
  "list-item-radio-control-position": `ListItemRadio: M3 places its control at the "leading" or "trailing" end, but this one's \`controlPosition\` is "start".`,
  "list-item-switch-control-position": `ListItemSwitch: M3 places its control at the "leading" or "trailing" end, but this one's \`controlPosition\` is "start".`,
  "list-item-switch-trailing": `ListItemSwitch: M3's list item ends with one icon, text or control, but this one has its switch and \`trailingText\` "On".`,
  "menu-color": `Menu: M3's colors are "standard" and "vibrant", but this one's \`color\` is "tonal".`,
  "menu-layout": `Menu: M3's layouts are "standard" and "grouped", but this one's \`layout\` is "list".`,
  "nav-drawer-width": `NavDrawer: its widths are "narrow" and "wide", but this one's \`width\` is "medium".`,
  "nav-rail-expanded-width": `NavRail: its expanded widths are "narrow" and "wide", but this one's \`expandedWidth\` is "medium".`,
  "nav-rail-align": `NavRail: M3's alignments are "top" and "center", but this one's \`align\` is "bottom".`,
  "popover-bg-color": `Popover: M3's popover surfaces are "surface-container", "surface-container-high" and "inverse-surface", but this one's \`bgColor\` is "surface-container-low".`,
  "radio-button-as": `RadioButton: its elements are "label" and "span", but this one's \`as\` is "div".`,
  "sheet-side-edge": `SheetSide: its edges are "start" and "end", but this one's \`edge\` is "left".`,
  "slider-size": `Slider: M3's sizes are "xs", "sm", "md", "lg" and "xl", but this one's \`size\` is "medium".`,
  "slider-orientation": `Slider: M3's orientations are "horizontal" and "vertical", but this one's \`orientation\` is "diagonal".`,
  "slider-icon-size": `Slider: M3 puts an inset icon only on "md", "lg" and "xl" sliders, but this one's \`size\` is "sm".`,
  "slider-min": `Slider: its \`min\` must be a number, but this one's \`min\` is "low".`,
  "slider-max":
    "Slider: its `max` must be a number more than its `min` (10), but this one's `max` is 5.",
  "slider-step": `Slider: its \`step\` must be a number more than 0, or "any", but this one's \`step\` is 0.`,
  "slider-stops-step":
    "Slider: stops divide the track evenly from `min` to `max` (0 to 100), but this one's `step` is 30.",
  "slider-stops-any": `Slider: stops divide the track evenly from \`min\` to \`max\` (0 to 100), but this one's \`step\` is "any".`,
  "slider-variant": `Slider: M3's sliders are "standard", "centered" and "range", but this one's \`variant\` is "stepped".`,
  "slider-icon-variant": `Slider: M3 puts an inset icon only on standard sliders, as it hides where a centered or range slider starts, but this one's \`variant\` is "centered".`,
  "slider-handles-variant": `Slider: only a range slider has \`handleStart\` and \`handleEnd\`, but this one's \`variant\` is "standard".`,
  "slider-range-attribute": `Slider: a range slider takes each handle's \`value\`, \`name\`, \`id\` and \`aria-*\` in \`handleStart\` and \`handleEnd\`, but this one's \`aria-label\` is "Price".`,
  "slider-range-shared": `Slider: a range slider's handles share its \`min\`, \`max\`, \`step\`, \`disabled\` and \`form\`, but this one's \`handleEnd.disabled\` is true.`,
  "slider-range-cross":
    "Slider: a range slider's handles can't cross, so its `handleStart.value` must be no more than its `handleEnd.value` (40), but this one's `handleStart.value` is 60.",
  "snackbar-duration": `Snackbar: its durations are "short", "long" and "indefinite", but this one's \`duration\` is "brief".`,
  "snackbar-action-duration": `Snackbar: M3 doesn't time out a snackbar with an action, but this one's \`duration\` is "short".`,
  "snackbar-indefinite": `Snackbar: an "indefinite" snackbar needs an action or a close button to hide it by, but this one's \`showCloseX\` is false.`,
  "snackbar-actions":
    "Snackbar: M3 gives a snackbar a single action, but this one's `action` slot holds 2.",
  "snackbar-new-line":
    "Snackbar: `isActionOnNewLine` moves the action below the text, but this one's `action` slot is empty.",
  "switch-as": `Switch: its elements are "label" and "span", but this one's \`as\` is "div".`,
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
  "text-field-counter-label-no-maxlength": `TextField: \`counterLabel\` words the character counter, which \`maxlength\` shows, but this one has \`counterLabel\` "Nombre de caractères" and no \`maxlength\`.`,
  "text-field-over-limit-message-no-maxlength": `TextField: \`overLimitMessage\` words the character counter, which \`maxlength\` shows, but this one has \`overLimitMessage\` "{limit} caractères au plus" and no \`maxlength\`.`,
  "text-field-chips-type": `TextFieldChips: M3 puts input chips inline with the cursor of a single-line field, whose types are "text", "email", "number", "password", "search", "tel" and "url", but this one's \`type\` is "textarea".`,
  "text-field-chips-variant": `TextFieldChips: M3's styles are "filled" and "outlined", but this one's \`variant\` is "standard".`,
  "text-field-chips-overflow": `TextFieldChips: its overflows are "wrap" and "scroll", but this one's \`overflow\` is "hidden".`,
  "text-field-chips-maxlength-negative": `TextFieldChips: a character limit is a whole number, from 0, but this one's \`maxlength\` is -1.`,
  "text-field-chips-maxlength-not-a-number": `TextFieldChips: a character limit is a whole number, from 0, but this one's \`maxlength\` is "long".`,
  "text-field-chips-counter-label-no-maxlength": `TextFieldChips: \`counterLabel\` words the character counter, which \`maxlength\` shows, but this one has \`counterLabel\` "Nombre de caractères" and no \`maxlength\`.`,
  "text-field-chips-over-limit-message-no-maxlength": `TextFieldChips: \`overLimitMessage\` words the character counter, which \`maxlength\` shows, but this one has \`overLimitMessage\` "{limit} caractères au plus" and no \`maxlength\`.`,
  "text-field-chips-name":
    "TextFieldChips: its chips are a group named by the field's label, but this one has no label, `aria-label` or `aria-labelledby`.",
  "toolbar-docked-name":
    "ToolbarDocked: a toolbar needs a name, from an `aria-label` or `aria-labelledby`, but this one has neither.",
  "toolbar-docked-color": `ToolbarDocked: M3's color styles are "standard" and "vibrant", but this one's \`color\` is "tonal".`,
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
