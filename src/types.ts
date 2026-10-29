import type { CollectionEntry } from "astro:content";
import type { SvgIconNameTypes } from "./svgs";

// Each `as const` list here is what a component checks that prop against, and its type comes from
// the list (ADR-0021)

// M3 background roles, and transparent
export const bgColors = [
  "primary-container",
  "primary-fixed",
  "primary-fixed-dim",
  "secondary-container",
  "secondary-fixed",
  "secondary-fixed-dim",
  "tertiary-container",
  "tertiary-fixed",
  "tertiary-fixed-dim",
  "surface",
  "surface-dim",
  "surface-bright",
  "inverse-surface",
  "surface-container-lowest",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
  "transparent",
] as const;
export type BgColorType = (typeof bgColors)[number];

// M3 overlay surfaces: full-screen dialogs (Surface), sheets/drawers and vertical menus (Low),
// vibrant vertical menus (Tertiary container), baseline menus and rich tooltips (Container), dialogs
// (High), plain tooltips and snackbars (Inverse). Other tinted backgrounds have no overlay use in M3.
export const overlayBgColors = [
  "surface",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "inverse-surface",
  "tertiary-container",
] as const satisfies readonly BgColorType[];
export type OverlayBgColorType = (typeof overlayBgColors)[number];

// A popover is menu-, dialog- or tooltip-like, so sheets' Low surface is left out.
export const popoverBgColors = [
  "surface-container",
  "surface-container-high",
  "inverse-surface",
] as const satisfies readonly OverlayBgColorType[];
export type PopoverBgColorType = (typeof popoverBgColors)[number];

export type ButtonPropsType = { id?: string; text: string; value: string };

export const componentCategories = [
  "Base",
  "Content sectioning",
  "Custom",
  "Demarcating edits",
  "Document metadata",
  "Embedded content",
  "Forms",
  "Image and multimedia",
  "Inline text semantics",
  "Interactive elements",
  "Main root",
  "Scripting",
  "Sectioning root",
  "SVG and MathML",
  "Table content",
  "Text content",
  "Web Components",
] as const;
export type ComponentCategoryType = (typeof componentCategories)[number];

export const headingLevels = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevelType = (typeof headingLevels)[number];

export type LayoutPropsType = {
  classListBody?: string;
  classListHtml?: string;
  description: string;
  title: string;
};

// One link in a NavRailSubItems section, rendered as a NavDrawerItem
export type NavSubItemType = {
  href: string | URL;
  icon?: SvgIconNameTypes;
  activeIcon?: SvgIconNameTypes;
  label: string;
  badgeLabel?: string | number;
};

export const overlayTransitions = ["fade", "fade-scale", "fade-down"] as const;
export type OverlayTransitionType = (typeof overlayTransitions)[number];

// A prop/slot paired with the heading id already assigned to it in the table
// of contents, so consumers don't have to re-derive the id by matching on
// display text (fragile: collides on repeated/duplicate names).
export type PropWithHeadingType = NonNullable<
  CollectionEntry<"components">["data"]["props"]
>[number] & { headingId: string };

export type SlotWithHeadingType = {
  slot: NonNullable<CollectionEntry<"components">["data"]["slots"]>[number];
  headingId: string;
};

// One choice in a ButtonGroupConnected
export type ButtonGroupConnectedOptionType = {
  // The option's text, or, with showLabel false, its accessible name and tooltip
  label: string;
  // What the form submits for it. Defaults to the label.
  value?: string;
  // A leading icon, or the option's only content with showLabel false
  icon?: SvgIconNameTypes;
  // Shown in place of `icon` while selected. Defaults to the icon's -fill version, when there is one
  selectedIcon?: SvgIconNameTypes;
  showLabel?: boolean;
  // Its initial state
  isSelected?: boolean;
  disabled?: boolean;
};

export type TabType = {
  badgeDescription?: string;
  badgeLabel?: string;
  icon?: SvgIconNameTypes;
  label: string;
};

export const tabAligns = ["start", "center"] as const;
export type TabAlignType = (typeof tabAligns)[number];

export const tabTransitions = ["fade", "fade-up", "slide-left"] as const;
export type TabTransitionType = (typeof tabTransitions)[number];

export const tabVariants = ["primary", "secondary"] as const;
export type TabVariantType = (typeof tabVariants)[number];

export type DetailsVariantType = "outlined" | "plain";

export type ToCHeadingType = {
  id: string;
  text: string;
  level: HeadingLevelType;
};
