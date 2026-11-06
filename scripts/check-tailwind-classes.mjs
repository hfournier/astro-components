// Fails when a source file uses a Tailwind class that has a canonical spelling, such as `end-2`
// for `inset-e-2`: the check behind Tailwind IntelliSense's "can be written as" hint, so the
// suggestions the editor squiggles also fail `pnpm lint:tailwind` and CI.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const root = process.cwd();
const cssPath = path.join(root, "src/styles/global.css");
const css = await readFile(cssPath, "utf8");
const designSystem = await __unstable__loadDesignSystem(css, {
  base: path.dirname(cssPath),
});

const scanner = new Scanner({
  sources: [{ base: path.join(root, "src"), pattern: "**/*", negated: false }],
});
scanner.scan();

// The editor's hint uses a 16px root, so px and rem spellings of a value count as one
const options = { rem: 16 };
let count = 0;
for (const file of scanner.files.sort()) {
  const content = await readFile(file, "utf8");
  const extension = path.extname(file).slice(1);
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++)
    if (content[i] === "\n") lineStarts.push(i + 1);
  for (const { candidate, position } of scanner.getCandidatesWithPositions({
    content,
    extension,
  })) {
    // Only candidates Tailwind compiles to CSS are classes; the scanner also returns plain words
    if (designSystem.candidatesToCss([candidate])[0] === null) continue;
    const [canonical] = designSystem.canonicalizeCandidates(
      [candidate],
      options
    );
    if (canonical === candidate) continue;
    // position is a byte offset; this repo's class strings are ASCII, so it equals the char index
    let line = lineStarts.findLastIndex((start) => start <= position);
    count++;
    console.log(
      `${path.relative(root, file)}:${line + 1}:${position - lineStarts[line] + 1}  \`${candidate}\` can be written as \`${canonical}\``
    );
  }
}

if (count > 0) {
  console.error(
    `\n${count} Tailwind class${count === 1 ? "" : "es"} not in canonical form`
  );
  process.exit(1);
}
console.log("All Tailwind classes are in canonical form");
