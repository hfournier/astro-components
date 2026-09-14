// Final consolidated sweep for issue #53 findings doc.
// Node >=18, no deps. Run: node final-sweep.mjs

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1, g1, b1;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [r1 + m, g1 + m, b1 + m];
}
function hwbToRgb(h, w, b) {
  if (w + b >= 1) {
    const g = w / (w + b);
    return [g, g, g];
  }
  const rgb = hslToRgb(h, 1, 0.5);
  return rgb.map((c) => c * (1 - w - b) + w);
}
function rgbToHwb(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
  let hue;
  if (chroma === 0) hue = 0;
  else if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return [hue, min, 1 - max];
}
function relLum(r, g, b) {
  const ch = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function contrast(l1, l2) {
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function mix(h, w0, b0, x, target) {
  const w1 = target === "white" ? 1 : 0, b1 = target === "white" ? 0 : 1;
  const f = x / 100;
  const w = Math.min(1, Math.max(0, w0 * f + w1 * (1 - f)));
  const b = Math.min(1, Math.max(0, b0 * f + b1 * (1 - f)));
  return hwbToRgb(h, w, b);
}
function evalMix(h, w0, b0, x, target) {
  const [r, g, b] = mix(h, w0, b0, x, target);
  const L = relLum(r, g, b);
  const cw = contrast(L, 1), cb = contrast(L, 0);
  const winner = cw >= cb ? "white" : "black";
  return { r, g, b, L, cw, cb, winner, win: Math.max(cw, cb) };
}
function fmt(r) {
  return `${r.winner[0]}${r.win.toFixed(2)}`;
}

const XGRID = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
const SWEEP_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

console.log("## Table A - pure full-saturation hues, hwb(h,0%,0%)\n");
function printTable(hues, w0, b0, target, extraLabel) {
  console.log(`### ${target.toUpperCase()} direction${extraLabel ? " " + extraLabel : ""}`);
  console.log("| hue | " + XGRID.map((x) => `X=${x}`).join(" | ") + " |");
  console.log("|---|" + XGRID.map(() => "---").join("|") + "|");
  for (const h of hues) {
    const row = XGRID.map((x) => fmt(evalMix(h, w0(h), b0(h), x, target)));
    console.log(`| ${typeof h === "object" ? h.label : h + "deg"} | ` + row.join(" | ") + " |");
  }
  console.log();
}
printTable(SWEEP_HUES, () => 0, () => 0, "black");
printTable(SWEEP_HUES, () => 0, () => 0, "white");

const CC5500 = [0xcc / 255, 0x55 / 255, 0x00 / 255];
const [h0, w0cc, b0cc] = rgbToHwb(...CC5500);
console.log(`#cc5500 -> hwb(${h0.toFixed(1)}deg, ${(w0cc * 100).toFixed(1)}%, ${(b0cc * 100).toFixed(1)}%)\n`);

console.log("## Table B - cc5500-comparable hues, hwb(h,0%,20%) + cc5500 itself\n");
const hueLabelsB = [{ label: "cc5500(H25)", h: h0 }, ...SWEEP_HUES.map((h) => ({ label: `${h}deg`, h }))];
function printTableB(target) {
  console.log(`### ${target.toUpperCase()} direction`);
  console.log("| hue | " + XGRID.map((x) => `X=${x}`).join(" | ") + " |");
  console.log("|---|" + XGRID.map(() => "---").join("|") + "|");
  for (const { label, h } of hueLabelsB) {
    const row = XGRID.map((x) => fmt(evalMix(h, 0, b0cc, x, target)));
    console.log(`| ${label} | ` + row.join(" | ") + " |");
  }
  console.log();
}
printTableB("black");
printTableB("white");

console.log("## Global worst-case winning contrast at each X, across ALL 360 hues (step 0.25deg), w=0/b=0\n");
console.log("| X | worst SHADE contrast | worst hue | worst TINT contrast | worst hue |");
console.log("|---|---|---|---|---|");
for (const x of [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20]) {
  let worstS = Infinity, worstSH = null, worstT = Infinity, worstTH = null;
  for (let h = 0; h < 360; h += 0.25) {
    const s = evalMix(h, 0, 0, x, "black").win;
    const t = evalMix(h, 0, 0, x, "white").win;
    if (s < worstS) { worstS = s; worstSH = h; }
    if (t < worstT) { worstT = t; worstTH = h; }
  }
  console.log(`| ${x} | ${worstS.toFixed(3)} | ${worstSH.toFixed(2)}deg | ${worstT.toFixed(3)} | ${worstTH.toFixed(2)}deg |`);
}

console.log("\n## Absolute global minimum across the whole family (all hues x all X, both directions), w=0/b=0\n");
let worst = Infinity, worstInfo = null;
for (let h = 0; h < 360; h += 0.25) {
  for (let x = 0; x <= 100; x += 0.25) {
    for (const target of ["white", "black"]) {
      const r = evalMix(h, 0, 0, x, target);
      if (r.win < worst) { worst = r.win; worstInfo = { h, x, target, ...r }; }
    }
  }
}
console.log(`Minimum winning contrast = ${worst.toFixed(4)} at hue=${worstInfo.h.toFixed(2)}deg, X=${worstInfo.x}, direction=${worstInfo.target} (cw=${worstInfo.cw.toFixed(3)}, cb=${worstInfo.cb.toFixed(3)})`);

console.log("\n## Universal safe-X boundary (max X keeping win-contrast >= threshold for ALL hues), w=0/b=0\n");
function boundaryForHue(h, target, threshold) {
  let maxSafeX = 0;
  for (let x = 0; x <= 100; x += 0.1) {
    if (evalMix(h, 0, 0, x, target).win >= threshold) maxSafeX = x;
    else break;
  }
  return maxSafeX;
}
console.log("| threshold | SHADE safe X<= | worst hue | TINT safe X<= | worst hue |");
console.log("|---|---|---|---|---|");
for (const threshold of [4.5, 4.75, 5.0]) {
  let worstShade = 100, worstShadeHue = null, worstTint = 100, worstTintHue = null;
  for (let h = 0; h < 360; h += 0.5) {
    const sX = boundaryForHue(h, "black", threshold);
    const tX = boundaryForHue(h, "white", threshold);
    if (sX < worstShade) { worstShade = sX; worstShadeHue = h; }
    if (tX < worstTint) { worstTint = tX; worstTintHue = h; }
  }
  console.log(`| ${threshold} | ${worstShade.toFixed(1)} | ${worstShadeHue}deg | ${worstTint.toFixed(1)} | ${worstTintHue}deg |`);
}

console.log("\n## #cc5500 sanity check (actual --color-primary today), SHADE direction fine sweep\n");
console.log("| X | rgb | winner | contrast |");
console.log("|---|---|---|---|");
for (const x of [100, 90, 80, 70, 60, 55, 50, 45, 40, 35, 30, 20, 10, 0]) {
  const r = evalMix(h0, w0cc, b0cc, x, "black");
  console.log(`| ${x} | rgb(${(r.r*255).toFixed(0)},${(r.g*255).toFixed(0)},${(r.b*255).toFixed(0)}) | ${r.winner} | ${r.win.toFixed(2)} |`);
}
console.log("\nADR-0007 reference (oklch mechanism, not color-mix): L=0.45 -> 7.95:1 vs white; L=0.35 -> 11.59:1 vs white (primary hue, H 45.5deg OKLCH).");
