import {
  argbFromHex,
  Blend,
  DynamicScheme,
  Hct,
  hexFromArgb,
  SchemeCmf,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  TonalPalette,
  type CustomColor,
} from "@poupe/material-color-utilities";

/** The DynamicScheme variants a theme can be generated with, keyed by kebab-case name. */
export const variants = {
  "tonal-spot": SchemeTonalSpot,
  content: SchemeContent,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  "fruit-salad": SchemeFruitSalad,
  monochrome: SchemeMonochrome,
  neutral: SchemeNeutral,
  rainbow: SchemeRainbow,
  vibrant: SchemeVibrant,
  cmf: SchemeCmf,
} as const;

export type Variant = keyof typeof variants;

export const defaultVariant: Variant = "fidelity";

// The DynamicScheme getters emitted as scheme roles.
const roles = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "primaryFixed",
  "primaryFixedDim",
  "onPrimaryFixed",
  "onPrimaryFixedVariant",
  "inversePrimary",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "secondaryFixed",
  "secondaryFixedDim",
  "onSecondaryFixed",
  "onSecondaryFixedVariant",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "tertiaryFixed",
  "tertiaryFixedDim",
  "onTertiaryFixed",
  "onTertiaryFixedVariant",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "surfaceDim",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "inverseSurface",
  "inverseOnSurface",
  "surfaceTint",
  "outline",
  "outlineVariant",
  "shadow",
  "scrim",
] as const satisfies readonly (keyof DynamicScheme)[];

// Custom color role → [light tone, dark tone], as Material's `customColor()` picks them.
const customRoles = {
  color: [40, 80],
  onColor: [100, 20],
  colorContainer: [90, 30],
  onColorContainer: [10, 90],
} as const;

// Light to dark, so steps run 10 → 950.
const tones = [99, 98, 95, 90, 80, 70, 60, 50, 40, 35, 30, 25, 20, 15, 10, 5];

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const capitalize = (name: string) => name[0].toUpperCase() + name.slice(1);

const hex = (argb: number) => hexFromArgb(argb).toUpperCase();

const lightDark = (light: number, dark: number) =>
  `light-dark(${hex(light)}, ${hex(dark)})`;

interface ThemeColors {
  /** Scheme role (`on-primary`) → `light-dark()` value. */
  scheme: Record<string, string>;
  /** Custom color role (`on-success-container`) → `light-dark()` value. */
  custom: Record<string, string>;
  /** Palette name (`neutral-variant`) → step (`100`) → hex. */
  palettes: Record<string, Record<string, string>>;
}

/** The theme's scheme roles, custom colors and tonal palettes, keyed by kebab-case name. */
export function themeColors(
  sourceColor: string,
  customColors: CustomColor[] = [],
  variant: Variant = defaultVariant
): ThemeColors {
  const source = argbFromHex(sourceColor);
  const Scheme = variants[variant];
  const light = new Scheme(Hct.fromInt(source), false, 0);
  const dark = new Scheme(Hct.fromInt(source), true, 0);

  const scheme = Object.fromEntries(
    roles.map((role) => [kebab(role), lightDark(light[role], dark[role])])
  );

  // A custom color's roles are named after it: `color` → `success`,
  // `onColorContainer` → `on-success-container`.
  const custom = Object.fromEntries(
    customColors.flatMap((color) => {
      const value = color.blend
        ? Blend.harmonize(color.value, source)
        : color.value;
      const hct = Hct.fromInt(value);
      const palette = TonalPalette.fromHueAndChroma(
        hct.hue,
        Math.max(48, hct.chroma)
      );
      return Object.entries(customRoles).map(
        ([role, [lightTone, darkTone]]) => [
          kebab(
            role
              .replace("color", color.name)
              .replace("Color", capitalize(color.name))
          ),
          lightDark(palette.tone(lightTone), palette.tone(darkTone)),
        ]
      );
    })
  );

  const palettes = Object.fromEntries(
    Object.entries({
      primary: light.primaryPalette,
      secondary: light.secondaryPalette,
      tertiary: light.tertiaryPalette,
      neutral: light.neutralPalette,
      neutralVariant: light.neutralVariantPalette,
      error: light.errorPalette,
    }).map(([name, palette]) => [
      kebab(name),
      Object.fromEntries(
        tones.map((tone) => [1000 - tone * 10, hex(palette.tone(tone))])
      ),
    ])
  );

  return { scheme, custom, palettes };
}

type PropertyGroup = [string, string][];

/**
 * The theme's custom properties as [name, value] groups. Roles (`--theme-color-*`, scheme then
 * custom colors) go in `:root`. Palette steps (`--color-theme-*`) go in `@theme static`, where Tailwind
 * turns each into a color utility (`bg-theme-primary-500`).
 */
function propertyGroups(
  sourceColor: string,
  customColors: CustomColor[],
  variant: Variant
): { roles: PropertyGroup[]; palettes: PropertyGroup[] } {
  const { scheme, custom, palettes } = themeColors(
    sourceColor,
    customColors,
    variant
  );
  return {
    roles: [scheme, custom]
      .map((group) =>
        Object.entries(group).map(([role, value]): [string, string] => [
          `--theme-color-${role}`,
          value,
        ])
      )
      .filter((group) => group.length > 0),
    palettes: Object.entries(palettes).map(([name, steps]) =>
      Object.entries(steps).map(([step, value]): [string, string] => [
        `--color-theme-${name}-${step}`,
        value,
      ])
    ),
  };
}

/** Maps each `--theme-color-*` role and `--color-theme-*` palette step to its value for a source color. */
export function themeProperties(
  sourceColor: string,
  customColors: CustomColor[] = [],
  variant: Variant = defaultVariant
): Record<string, string> {
  const { roles, palettes } = propertyGroups(
    sourceColor,
    customColors,
    variant
  );
  return Object.fromEntries([...roles, ...palettes].flat());
}

const declarations = (groups: PropertyGroup[]) =>
  groups
    .map((group) =>
      group.map(([property, value]) => `  ${property}: ${value};`).join("\n")
    )
    .join("\n\n");

/**
 * The roles as a `:root` rule and the palette steps as an `@theme static` block (static, so every
 * step is emitted even when no utility uses it, e.g. for `var()` in inline styles), with a blank
 * line between groups.
 */
export function themeCss(
  sourceColor: string,
  customColors: CustomColor[] = [],
  variant: Variant = defaultVariant
): string {
  const { roles, palettes } = propertyGroups(
    sourceColor,
    customColors,
    variant
  );
  return [
    `:root {\n  color-scheme: light dark;\n\n${declarations(roles)}\n}`,
    `@theme static {\n${declarations(palettes)}\n}`,
  ].join("\n\n");
}
