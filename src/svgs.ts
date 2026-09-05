export const svgIconNames = ["close"] as const;

export type SvgIconNameTypes = (typeof svgIconNames)[number];

const svgs = import.meta.glob<typeof import(".svg")>(
  "/src/assets/svgs/**/*.svg"
);

export const importSvg = async (name: SvgIconNameTypes) => {
  const path = `/src/assets/svgs/${name}.svg`;

  const svg = svgs[path];

  if (!svg) {
    throw new Error(`No SVG found for name: "${name}"`);
  }
  return await svg().then((mod: typeof import("*.svg")) => mod.default);
};
