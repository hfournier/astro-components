import type { CollectionEntry } from "astro:content";

export type ButtonPropsType = { id?: string; text: string; value: string };

export type LayoutPropsType = {
  classListBody?: string;
  classListHtml?: string;
  description: string;
  title: string;
};

export type OverlayTransitionType = "fade" | "fade-scale";

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

export type TabTransitionType = "fade" | "fade-up" | "slide-left";

export type ToCHeadingType = { id: string; text: string; level: number };
