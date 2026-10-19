// The design tokens as CSS custom properties, set on every card's host. Values come from
// src/tokens.json, the same file the theme is built from. Type is in em off the host, so
// font_scale scales a whole card.
import { css, unsafeCSS } from "lit";
import T from "../tokens.json" with { type: "json" };
import { chartColors } from "./palette.js";

export { T as TOKENS };

const px = (o, prefix) => Object.entries(o).map(([k, v]) => `--n-${prefix}-${k}: ${v}px;`).join(" ");
const status = (night) => Object.entries(T.status).map(([k, v]) => `--n-${k}: ${v[night ? 1 : 0]};`).join(" ");
const chrome = (c) => `--n-chrome-bg: ${c.bg}; --n-chrome-ink: ${c.ink}; --n-chrome-ink-strong: ${c.inkStrong}; --n-chrome-sel-bg: ${c.selBg}; --n-chrome-sel-ink: ${c.selInk}; --n-pill-bg: ${c.pill};`;
// Chart colours: --n-chart-series-1…8, -seq-1…8, -div-1…7, -good/-warning/-serious/-critical, -grid, -axis
const chart = (night) => {
  const c = chartColors(night), v = [];
  for (const k of ["series", "seq", "div"]) c[k].forEach((x, i) => v.push(`--n-chart-${k}-${i + 1}: ${x};`));
  for (const [k, x] of Object.entries(c.status)) v.push(`--n-chart-${k}: ${x};`);
  v.push(`--n-chart-grid: ${c.grid};`, `--n-chart-axis: ${c.axis};`);
  return v.join(" ");
};
const t = T.type;

export const tokens = css`
  :host {
    display: block;
    font-size: calc(16px * var(--nice-scale, 1));
    --n-display: ${unsafeCSS(T.font.display)};
    --n-body: ${unsafeCSS(T.font.body)};
    ${unsafeCSS(px(T.space, "s"))}
    ${unsafeCSS(px(T.radius, "r"))}
    ${unsafeCSS(px(T.control, "c"))}
    --n-row: ${T.row}px; --n-gap: var(--n-s-md);
    --n-lbl-size: ${unsafeCSS(t.label.size)}; --n-lbl-weight: ${t.label.weight}; --n-lbl-track: ${unsafeCSS(t.label.track)}; --n-lbl-opacity: ${t.label.opacity};
    --n-say-size: ${unsafeCSS(t.say.size)}; --n-say-line: ${t.say.line}; --n-say-big: ${unsafeCSS(t.say.big)}; --n-say-big-line: ${t.say.bigLine};
    --n-sub-size: ${unsafeCSS(t.sub.size)}; --n-sub-weight: ${t.sub.weight}; --n-sub-opacity: ${t.sub.opacity};
    --n-title-size: ${unsafeCSS(t.title.size)}; --n-title-weight: ${t.title.weight};
    --n-pill-size: ${unsafeCSS(t.pill.size)}; --n-pill-weight: ${t.pill.weight};
    --n-focus: ${unsafeCSS(T.focus)}; --n-ring: 3px;
    --n-t-quick: ${unsafeCSS(T.motion.quick)}; --n-t-tile: ${unsafeCSS(T.motion.tile)}; --n-t-bar: ${unsafeCSS(T.motion.bar)}; --n-t-fill: ${unsafeCSS(T.motion.fill)};
    --n-spring: cubic-bezier(.34, 1.56, .64, 1);
    ${unsafeCSS(status(false))}
    ${unsafeCSS(chart(false))}
    ${unsafeCSS(chrome(T.chrome.day))}
  }
  :host(.is-night) { ${unsafeCSS(status(true))} ${unsafeCSS(chart(true))} ${unsafeCSS(chrome(T.chrome.night))} }
  @supports (transition-timing-function: linear(0, 1)) {
    :host { --n-spring: linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017 19.4%, 1.067, 1.099 24.3%, 1.108 26%, 1.104, 1.092 30.6%, 1.035 39.5%, 1.007 46.2%, 0.996 51%, 0.993 56%, 1.001 72.6%, 1); }
  }
  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;

export const HOLD_MS = T.motion.holdMs;
export const CONFIRM_MS = T.motion.confirmMs;
