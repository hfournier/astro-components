// Hand-authored so it can produce the `SvgIconNameTypes` literal union that gives
// Icon `name` its intellisense - Vite's import.meta.glob only yields `string`
// keys, so the union can't be derived from the filesystem at type-check time.
// Kept in sync with src/assets/svgs by the drift check in svgs.spec.ts.
export const svgIconNames = [
  "arrow-top-right-on-square",
  "check",
  "chevron-down",
  "chevron-up-down",
  "cloud-arrow-down",
  "code-bracket",
  "cog-8-tooth",
  "document",
  "document-arrow-down",
  "ellipsis-horizontal",
  "ellipsis-vertical",
  "envelope",
  "exclamation-circle",
  "exclamation-triangle",
  "globe-alt",
  "link",
  "phone",
  "photo",
  "user",
  "users",
  "x-mark",
] as const;

export type SvgIconNameTypes = (typeof svgIconNames)[number];
