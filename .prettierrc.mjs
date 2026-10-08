/** @type {import("prettier").Config} */
export default {
  trailingComma: "es5",
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  // The project's theme, so classes sort by its own breakpoints and tokens, not Tailwind's defaults
  tailwindStylesheet: "./src/styles/global.css",
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
