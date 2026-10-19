// The palette, worked out from tokens.json: every family is a hue and a chroma, and comes in
// three weights. Loudness follows urgency (tier), never the family: soft for most tiles,
// strong for "soon" (tier 1), solid for "now" (tier 0). Pure maths, so the build, the cards and
// the tests all share it.
import T from "../tokens.json" with { type: "json" };

// OKLCH → sRGB (Björn Ottosson), and back far enough to measure
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklchRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
// The most chroma up to C that sRGB can show at this lightness and hue
export function oklch(L, C, h) {
  let lo = 0, hi = C, rgb = oklchRgb(L, C, h);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; inGamut(oklchRgb(L, mid, h)) ? (lo = mid) : (hi = mid); }
    rgb = oklchRgb(L, lo, h);
  }
  return "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(1, gam(v))) * 255).toString(16).padStart(2, "0")).join("");
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const W = T.weights, INK = T.ink;

// One family at one weight: fill, ink that reads on it, and a chart accent
function swatch([h, c, dL = 0], weight, night) {
  const [L0, cs, aL, aC] = W[night ? "night" : "day"][weight], L = L0 + (weight === "solid" ? 0 : night ? -dL : dL);
  let bg = oklch(L, c * cs, h);
  const light = night ? INK.nightLight : INK.light;
  // Solid fills take light ink: darken until it reads
  if (weight === "solid") for (let l = L; contrast(bg, light) < T.minContrast && l > 0.2; l -= 0.01) bg = oklch(l, c * cs, h);
  const ink = contrast(bg, INK.dark) >= contrast(bg, light) ? INK.dark : light;
  return { bg, ink, accent: weight === "solid" ? ink : oklch(aL, c * aC, h) };
}

export const FAMILIES = Object.keys(T.families).filter((k) => k !== "_");
export const family = (name) => (T.families[name] ? name : T.aliases[name] in T.families ? T.aliases[name] : "system");
export const weightOf = (fam, tier) => (T.alwaysSolid.includes(fam) || tier === 0 ? "solid" : tier === 1 ? "strong" : "soft");

const cache = new Map();
export function paint(name, night, tier) {
  const fam = family(name), w = weightOf(fam, tier), key = `${fam}/${w}/${night ? 1 : 0}`;
  if (!cache.has(key)) cache.set(key, swatch(T.families[fam], w, !!night));
  return cache.get(key);
}

// A lit room: a warm neutral, the same for every room, so topic colours stand out
export function roomPaint(night) {
  const [L, c, h] = T.room[night ? "night" : "day"];
  const bg = oklch(L, c, h);
  return { bg, ink: night ? INK.nightLight : INK.dark };
}
