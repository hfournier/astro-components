import type { CollectionEntry } from "astro:content";
import type { SvgIconNameTypes } from "./svgs";

export type BgColorType =
  | "primary-container"
  | "primary-fixed"
  | "primary-fixed-dim"
  | "secondary-container"
  | "secondary-fixed"
  | "secondary-fixed-dim"
  | "tertiary-container"
  | "tertiary-fixed"
  | "tertiary-fixed-dim"
  | "surface-dim"
  | "surface-bright"
  | "inverse-surface"
  | "surface-container-lowest"
  | "surface-container-low"
  | "surface-container"
  | "surface-container-high"
  | "surface-container-highest"
  | "transparent";

// M3 overlay surfaces: sheets/drawers (Low), menus and rich tooltips (Container), dialogs (High),
// plain tooltips and snackbars (Inverse). Tinted backgrounds have no overlay use in M3.
export type OverlayBgColorType = Extract<
  BgColorType,
  | "surface-container-low"
  | "surface-container"
  | "surface-container-high"
  | "inverse-surface"
>;

// A popover is menu-, dialog- or tooltip-like, so sheets' Low surface is left out.
export type PopoverBgColorType = Extract<
  OverlayBgColorType,
  "surface-container" | "surface-container-high" | "inverse-surface"
>;

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

export type HeadingLevelType = 1 | 2 | 3 | 4 | 5 | 6;

export type LayoutPropsType = {
  classListBody?: string;
  classListHtml?: string;
  description: string;
  title: string;
};

export type OverlayTransitionType = "fade" | "fade-scale" | "fade-down";

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

export type TabType = {
  badgeLabel?: string;
  icon?: SvgIconNameTypes;
  label: string;
};

export type TabTransitionType = "fade" | "fade-up" | "slide-left";

export type TabVariantType = "primary" | "secondary";

export type DetailsVariantType = "outlined" | "plain";

export type ToCHeadingType = {
  id: string;
  text: string;
  level: HeadingLevelType;
};
