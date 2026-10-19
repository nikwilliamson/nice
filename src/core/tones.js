// Colour roles. A tile's tone names its family (what it's about); its tier picks the weight
// (how loud). Every weight has a day and a night version and an accent for charts. Night is the
// sun, not the theme. The maths is in palette.js.
import { TOKENS as T } from "./tokens.js";
import { FAMILIES, paint, roomPaint } from "./palette.js";

export const TONE_NAMES = FAMILIES;
export const CAT_TONES = T.cats;
export const status = (name, night) => (T.status[name] || T.status.muted)[night ? 1 : 0];

export const tone = (name, night, tier) => ({ ...paint(name, night, tier) });

// Anything switched off, everywhere
export function offTone(night) {
  const o = night ? T.off.night : T.off.day;
  return { bg: o[0], ink: o[1], accent: o[2] };
}

// A lit room goes warm, a dark one goes grey. Every room the same, so topic colours stand out
export function roomTone(i, night, lit = true) {
  return lit ? roomPaint(night) : offTone(night);
}

// A team's own colour, with ink that reads on it
export function colorTone(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  return { bg: hex, ink: light ? "#1c2233" : "#ffffff", accent: light ? "#1c2233" : "#ffffff" };
}

// The colour a white light actually is at a colour temperature (Tanner Helland's fit)
export function kelvinRgb(k) {
  const t = k / 100, c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}
export const rgbCss = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
export const kelvinWord = (k) => (k < 2700 ? "Warm" : k < 3600 ? "Soft white" : k < 4600 ? "Neutral" : "Daylight");

// A light's tile wears the colour the light is showing; ink flips for contrast
export function lightTone(a, night) {
  const rgb = a.rgb_color || (a.color_temp_kelvin ? kelvinRgb(a.color_temp_kelvin) : kelvinRgb(2700));
  const base = night ? [20, 26, 44] : [255, 255, 255], f = night ? 0.8 : 0.72;
  const bg = base.map((v, i) => Math.round(v + (rgb[i] - v) * f));
  const light = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] > 150;
  const accent = bg.map((v) => Math.round(light ? v * 0.45 : v + (255 - v) * 0.6));
  return { bg: rgbCss(bg), ink: light ? "#1c2233" : "#ffffff", accent: rgbCss(accent), dark: !light };
}

// Mix two #rrggbb colours
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
export const tint = (base, rgb, f) => { const b = hex(base); return `rgb(${b.map((v, i) => Math.round(v + (rgb[i] - v) * f)).join(",")})`; };

// A tile's colours from whatever it carries: its own colours, a team colour, or a tone
export const colorsOf = (t, night) => t.colors || (t.color ? colorTone(t.color) : t.tone === "off" ? offTone(night) : tone(t.tone, night, t.tier));
