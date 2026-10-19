// The palette, read from tokens.json: primitive OKLCH ramps, and tones and chart colours that
// name them (tomato-400, white, or a literal [L, C, h]). Everything comes out as #rrggbb, so
// the build, the cards and the tests all share it. Pure maths, no DOM.
import T from "../tokens.json" with { type: "json" };

// OKLCH → sRGB (Björn Ottosson)
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklchRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export const oklch = (L, C, h) => "#" + oklchRgb(L, C, h).map((v) => Math.round(Math.max(0, Math.min(1, gam(v))) * 255).toString(16).padStart(2, "0")).join("");

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// A colour by name: ramp-step, white, black, a literal [L, C, h], or any CSS colour as is
const P = T.palette, STEP = Object.fromEntries(P.steps.map((s, i) => [s, i]));
export function color(ref) {
  if (Array.isArray(ref)) return oklch(...ref);
  if (ref === "white") return "#ffffff";
  if (ref === "black") return "#000000";
  const m = /^([a-z]+)-(\d+)$/.exec(ref);
  if (m && P[m[1]] && m[2] in STEP) return oklch(...P[m[1]][STEP[m[2]]]);
  return ref;
}

export const RAMPS = Object.keys(P).filter((k) => k !== "_" && k !== "steps");
export const STEPS = P.steps;
export const TONES = Object.keys(T.tones).filter((k) => k !== "_");

const cache = new Map();
export function paint(name, night) {
  const key = `${T.tones[name] ? name : "health"}/${night ? 1 : 0}`;
  if (!cache.has(key)) {
    const [bg, ink, accent] = (T.tones[name] || T.tones.health)[night ? "night" : "day"].map(color);
    cache.set(key, { bg, ink, accent });
  }
  return cache.get(key);
}

// A lit room: one warm neutral, the same for every room, so the tones stand out
export const roomPaint = (night) => { const [bg, ink] = T.room[night ? "night" : "day"].map(color); return { bg, ink }; };

// The chart colours for one time of day, resolved
export function chartColors(night) {
  const c = T.chart[night ? "night" : "day"];
  return { series: c.series.map(color), seq: c.seq.map(color), div: c.div.map(color),
    status: Object.fromEntries(Object.entries(c.status).map(([k, v]) => [k, color(v)])), grid: color(c.grid), axis: color(c.axis) };
}
