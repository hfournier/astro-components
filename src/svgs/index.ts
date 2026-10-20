import { svgIconNames, type SvgIconNameTypes } from "./icon-names";

export { svgIconNames, type SvgIconNameTypes } from "./icon-names";

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

// The filled version of an icon, such as "bookmark-fill" for "bookmark", if there is one. M3 toggles
// switch to it while selected, so their state doesn't rely on color alone.
export const filledIconFor = (name: SvgIconNameTypes) =>
  svgIconNames.find((iconName) => iconName === `${name}-fill`);
