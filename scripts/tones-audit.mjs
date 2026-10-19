// Colour audit: which family every tile wears, which fills of one weight are too close to tell apart,
// and which inks don't read on their fill. Run: scripts/node.sh scripts/tones-audit.mjs
// tests/tones.test.mjs holds the palette to these checks.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import T from "../src/tokens.json" with { type: "json" };
import { FAMILIES, paint, roomPaint, family } from "../src/core/palette.js";

// #rrggbb → OKLab (Björn Ottosson)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export function oklab(h) {
  const [r, g, b] = rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export const distance = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

// WCAG contrast ratio
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Two fills closer than this read as the same colour at a glance
export const TOO_CLOSE = 0.02;
export const MIN_CONTRAST = 4.5;

export const WEIGHTS = { soft: 3, strong: 1, solid: 0 };

// Every fill a tile can wear at one weight and time of day. Soft fills also sit next to rooms and off
export function fills(night, weight) {
  const out = {};
  for (const f of FAMILIES) if (weight === "solid" || !T.alwaysSolid.includes(f)) out[f] = paint(f, night, WEIGHTS[weight]).bg;
  if (weight === "soft") { out.room = roomPaint(night).bg; out.off = (night ? T.off.night : T.off.day)[0]; }
  return out;
}

export function closePairs(night) {
  const out = [];
  for (const w of Object.keys(WEIGHTS)) {
    const f = Object.entries(fills(night, w));
    for (let i = 0; i < f.length; i++)
      for (let j = i + 1; j < f.length; j++) {
        const d = distance(f[i][1], f[j][1]);
        if (d < TOO_CLOSE) out.push({ w, a: f[i][0], b: f[j][0], d: +d.toFixed(3) });
      }
  }
  return out.sort((p, q) => p.d - q.d);
}

export function weakInk() {
  const out = [];
  for (const f of FAMILIES)
    for (const [w, tier] of Object.entries(WEIGHTS))
      for (const night of [false, true]) {
        const { bg, ink } = paint(f, night, tier), c = contrast(bg, ink);
        if (c < MIN_CONTRAST) out.push({ tone: f, w, when: night ? "night" : "day", bg, ink, ratio: +c.toFixed(2) });
      }
  return out;
}

// Tile id → tones it can wear, read off the rules
export function tileTones(dir = fileURLToPath(new URL("../ha/custom_templates/nice/", import.meta.url))) {
  const out = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jinja"))) {
    for (const d of readFileSync(dir + f, "utf8").split("dict(id=").slice(1)) {
      const id = d.match(/^'([^']*)'|^([a-z_]+)[,)]/)?.slice(1).find(Boolean);
      const tone = d.match(/\btone=(\('[^)]*\)|'[^']*')/)?.[1];
      if (!id || !tone) continue;
      const names = [...tone.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
      const set = (out[`${f.replace(".jinja", "")}/${id}`] ??= new Set());
      names.forEach((n) => set.add(n));
    }
  }
  // Cards that pick a tone in code
  const src = fileURLToPath(new URL("../src/cards/", import.meta.url));
  for (const f of readdirSync(src)) {
    const names = [...readFileSync(src + f, "utf8").matchAll(/\btone(?:\(|: )"([a-z_]+)"/g)].map((m) => m[1]);
    if (names.length && f !== "viz-examples.js") out[`card:${f.replace(".js", "")}`] = new Set(names);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const byTone = {};
  for (const [tile, tones] of Object.entries(tileTones())) for (const t of tones) (byTone[t] ??= []).push(tile);
  console.log("Tiles by tone");
  for (const [k, v] of Object.entries(byTone)) if (family(k) !== k) console.log(`  (old name) ${k} → ${family(k)}: ${v.join(", ")}`);
  for (const k of FAMILIES) console.log(`  ${k.padEnd(10)} ${(byTone[k] || ["(unused)"]).join(", ")}`);
  for (const night of [false, true]) {
    console.log(`\nToo close (${night ? "night" : "day"}, OKLab < ${TOO_CLOSE})`);
    for (const p of closePairs(night)) console.log(`  ${p.w}: ${p.a} ~ ${p.b}  ${p.d}`);
  }
  console.log(`\nInk under ${MIN_CONTRAST}:1`);
  for (const w of weakInk()) console.log(`  ${w.tone} ${w.w} ${w.when}  ${w.ink} on ${w.bg}  ${w.ratio}`);
}
