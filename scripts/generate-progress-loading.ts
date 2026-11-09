// Writes ProgressLoading's keyframes, computed from the shapes and the spring in src/shapes.ts,
// to src/components/ProgressLoading.css. Run it with `pnpm generate:progress-loading` after
// changing either; ProgressLoading.spec.ts fails while the file is out of date.
import { writeFileSync } from "node:fs";
import { loadingIndicatorKeyframes } from "../src/shapes.ts";

const out = new URL("../src/components/ProgressLoading.css", import.meta.url);
writeFileSync(out, loadingIndicatorKeyframes());
console.log(`Wrote ${out.pathname}`);
