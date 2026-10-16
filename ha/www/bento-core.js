// Bento core - the one source of truth every bento card imports.
// Not a card and not a dashboard resource: each bento file imports it with the SAME specifier,
//
//   import { ... } from "./bento-core.js?v=1.1.0";
//
// so the browser loads one module instance, and bumping this file means bumping that string
// in every card. Holds the design tokens, the shared tile/pill/bar styles, the palette (tones,
// room tones and the status colours), the small helpers the cards used to copy, night mode,
// the tap/hold interaction and the shared room list.
//
// Fonts are not loaded here: bento-cards.js injects them, as it always has.
export const BENTO_CORE_VERSION = "1.1.0";

// ── Status colours
// What a dot, a bar or a badge means, by name: [day, night]. Night is a touch lighter so it
// still reads against the deep night tiles.
export const STATUS = {
  ok:     ["#2fc98a", "#4fe0a0"],
  busy:   ["#5ab8ff", "#7cc6ff"],
  warn:   ["#ff8a3d", "#ff9a52"],
  alert:  ["#f04a42", "#ff5d5d"],
  locked: ["#8b7cf6", "#a78bfa"],
  muted:  ["#9aa3b8", "#b4bccd"],
};
export const status = (name, night) => (STATUS[name] || STATUS.muted)[night ? 1 : 0];

// ── Design tokens
// Set on each card's host. Type is in em off the host, so font_scale scales a whole card.
// The canonical scale is bento-controls': eyebrow 0.76em, say 1.45em (3em on a big tile),
// sub 0.9em, title 1.35em, pills 0.86em.
const statusVars = (night) => Object.keys(STATUS).map((k) => `--b-${k}: ${status(k, night)};`).join(" ");
export const BENTO_TOKENS_CSS = `
  :host { display: block; font-size: calc(16px * var(--bento-scale, 1));
    --b-display: "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif; --b-body: "Figtree", system-ui, -apple-system, sans-serif;
    /* Spacing: one 4px scale (2xs only for text stacked inside a tile) */
    --b-s-2xs: 2px; --b-s-xs: 4px; --b-s-sm: 8px; --b-s-md: 12px; --b-s-lg: 16px; --b-s-xl: 24px;
    /* Corners: marks, bars and chips, panels inside a tile, tiles, pills */
    --b-r-xs: 4px; --b-r-sm: 8px; --b-r-md: 12px; --b-r-tile: 24px; --b-r-full: 999px;
    /* Control sizes: dots and icons, small buttons, compact controls, anything you tap */
    --b-c-xs: 16px; --b-c-sm: 24px; --b-c-md: 32px; --b-c-lg: 44px;
    --b-radius: var(--b-r-tile); --b-row: 132px; --b-gap: var(--b-s-md);
    --b-tile-pad: var(--b-s-md) var(--b-s-lg); --b-tile-gap: var(--b-s-sm);
    --b-lbl-size: 0.76em; --b-lbl-weight: 800; --b-lbl-track: 0.08em; --b-lbl-opacity: .72;
    --b-say-size: 1.45em; --b-say-line: 1.1; --b-say-big: 3em; --b-say-big-line: 1;
    --b-sub-size: 0.9em; --b-sub-weight: 600; --b-sub-opacity: .78;
    --b-title-size: 1.35em; --b-title-weight: 800;
    --b-pill-size: 0.86em; --b-pill-weight: 800; --b-pill-pad: var(--b-s-sm) var(--b-s-md); --b-pill-pad-y: var(--b-s-sm); --b-pill-radius: var(--b-r-full);
    --b-pill-bg: rgba(28,34,51,.08); --b-pill-bg-night: rgba(255,255,255,.16);
    --b-bar-h: var(--b-c-sm); --b-bar-radius: var(--b-r-sm);
    --b-focus: #5ab8ff; --b-ring: 3px;
    --b-t-quick: .2s; --b-t-tile: .25s; --b-t-bar: .4s; --b-t-fill: 3s;
    ${statusVars(false)}
    /* Chrome that sits on the page rather than on a tile: tabs, footer buttons */
    --b-chrome-bg: #eef0f5; --b-chrome-ink: #6b7388; --b-chrome-ink-strong: #1c2233; --b-chrome-sel-bg: #1c2233; --b-chrome-sel-ink: #ffffff; }
  :host(.is-night) { ${statusVars(true)}
    --b-chrome-bg: #2b3244; --b-chrome-ink: #b4bccd; --b-chrome-ink-strong: #ffffff; --b-chrome-sel-bg: #e1e5ef; --b-chrome-sel-ink: #141a2c; }
  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

// One button shape for every card: small pills, neutral or ink-filled
export const BENTO_BUTTON_CSS = `
  .btn-base, .act, .sbtn, .pill, .bulb, .b, .back, .all { font: inherit; font-size: var(--b-pill-size); font-weight: var(--b-pill-weight); border: 0;
    border-radius: var(--b-pill-radius); padding: var(--b-pill-pad); cursor: pointer; white-space: nowrap; }
`;

// The charge/progress bar: now, an optional striped gain, and a limit line
export const BENTO_CBAR_CSS = `
  .charge { display: grid; gap: var(--b-s-sm); }
  .cbar { position: relative; height: var(--b-bar-h); border-radius: var(--b-bar-radius); background: rgba(255,255,255,.75); overflow: hidden; box-shadow: inset 0 0 0 2px rgba(28,34,51,.08); }
  :host(.is-night) .cbar, .is-night .cbar { background: rgba(255,255,255,.12); }
  .cbar i { position: absolute; top: 0; bottom: 0; }
  .cbar .now { left: 0; background: var(--accent); border-radius: var(--b-bar-radius) 0 0 var(--b-bar-radius); }
  .cbar .now.low { background: var(--b-warn); }
  .cbar .gain { background: repeating-linear-gradient(-45deg, var(--accent) 0 5px, transparent 5px 10px); opacity: .55; transform-origin: 0 50%; }
  .cbar .gain.live { animation: fillin var(--b-t-fill) ease-in-out infinite alternate; }
  .cbar .lim { position: absolute; top: -2px; bottom: -2px; width: 2px; background: currentColor; opacity: .6; }
  @keyframes fillin { from { transform: scaleX(.15); } to { transform: scaleX(1); } }
`;

// The shared tile: eyebrow, words, foot. Card CSS adds layout and drawings on top, using the tokens.
export const BENTO_BASE_CSS = `
  ${BENTO_BUTTON_CSS}
  .head { display: flex; justify-content: space-between; align-items: center; gap: var(--b-s-md); margin: var(--b-s-sm) var(--b-s-2xs) var(--b-s-md); }
  .title { font-family: var(--b-display); font-weight: var(--b-title-weight); font-size: var(--b-title-size); letter-spacing: -0.01em; color: var(--primary-text-color, #1c2233); }
  .tile { background: var(--bg); color: var(--ink); border-radius: var(--b-radius); padding: var(--b-tile-pad); position: relative; overflow: hidden; min-width: 0;
    display: grid; grid-template-rows: auto 1fr auto; gap: var(--b-tile-gap); cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: manipulation;
    transition: background var(--b-t-tile) ease; }
  .tile:focus-visible, button:focus-visible { outline: var(--b-ring) solid var(--accent, var(--b-focus)); outline-offset: 2px; }
  .lbl { font-size: var(--b-lbl-size); font-weight: var(--b-lbl-weight); letter-spacing: var(--b-lbl-track); text-transform: uppercase; opacity: var(--b-lbl-opacity);
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .txt { align-self: end; display: grid; gap: var(--b-s-2xs); min-width: 0; position: relative; z-index: 1; }
  .say { font-family: var(--b-display); font-weight: 800; font-size: var(--b-say-size); line-height: var(--b-say-line); letter-spacing: -0.01em; text-wrap: balance;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .say.big { font-size: var(--b-say-big); line-height: var(--b-say-big-line); }
  .sub { font-size: var(--b-sub-size); font-weight: var(--b-sub-weight); opacity: var(--b-sub-opacity); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot { display: grid; gap: var(--b-s-sm); position: relative; z-index: 1; }
  .row { display: flex; flex-wrap: wrap; gap: var(--b-s-sm); align-items: center; }
  .row.between { justify-content: space-between; }
  .pill { background: var(--b-pill-bg); color: inherit; }
  .pill:disabled { opacity: .5; cursor: default; }
  :host(.is-night) .pill, .is-night .pill { background: var(--b-pill-bg-night); }
  .pill.sel, :host(.is-night) .pill.sel, .is-night .pill.sel { background: var(--ink); color: var(--bg); }
  .pill.go, :host(.is-night) .pill.go, .is-night .pill.go { background: var(--b-warn); color: #fff; }
  .pill.big { font-size: 1em; padding: var(--b-s-md) var(--b-s-xl); box-shadow: 0 2px 0 rgba(28,34,51,.12); }
  /* A setpoint: − value + */
  .setp { display: flex; align-items: center; gap: var(--b-s-md); }
  .setp b { font-family: var(--b-display); font-weight: 800; font-size: 1.4em; min-width: 2.4em; text-align: center; }
  .step { font: inherit; font-size: 1.4em; font-weight: 800; width: var(--b-c-lg); height: var(--b-c-lg); border-radius: 50%; border: 0; cursor: pointer; background: var(--b-pill-bg); color: inherit; line-height: 1; }
  :host(.is-night) .step, .is-night .step { background: var(--b-pill-bg-night); }
  /* Status tag beside a card's title: a coloured dot and a few words */
  .tag { display: inline-flex; align-items: center; gap: var(--b-s-sm); min-width: 0; padding: var(--b-s-xs) var(--b-s-md) var(--b-s-xs) var(--b-s-sm); border-radius: var(--b-r-full); font-size: 0.8em; font-weight: 800;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--secondary-background-color, #eef0f5); color: var(--secondary-text-color, #6b7388); }
  .tag i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--b-muted); }
  .tag.ok i { background: var(--b-ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--b-ok) 22%, transparent); }
  .tag.busy i { background: var(--b-busy); box-shadow: 0 0 0 3px color-mix(in srgb, var(--b-busy) 22%, transparent); }
  .tag.warn i { background: var(--b-warn); }
  .tag.alert i { background: var(--b-alert); }
  .tag.locked i { background: var(--b-locked); }
  ${BENTO_CBAR_CSS}
`;

// ── Palette
// Each tone: [day background, day ink, night background, night ink, chart accent].
// Night keeps each tone's hue at full saturation, just deeper: jewel tones, not mud.
// Hazard stays bright after dark on purpose: that contrast is the point.
export const TONES = {
  hazard:    ["#ff5d5d", "#ffffff", "#f04a42", "#ffffff", "#ffffff"],
  act:       ["#fff0e4", "#1c2233", "#9a4a17", "#fff1e6", "#ff9a52"],
  today:     ["#fff7d9", "#1c2233", "#a26a0a", "#fff6e0", "#ffc933"],
  car:       ["#e3f8f0", "#1c2233", "#0e7556", "#e2fbf2", "#4fe0ad"],
  plan:      ["#a78bfa", "#ffffff", "#6a4be0", "#ffffff", "#ffffff"],
  climate:   ["#f1ecff", "#1c2233", "#4433a8", "#f0ecff", "#7cc6ff"],
  cats:      ["#ffeef5", "#1c2233", "#9e2a64", "#ffeaf3", "#ff9cc4"],
  media:     ["#ff6b6b", "#ffffff", "#d4384c", "#ffffff", "#ffffff"],
  energy:    ["#e6f3ff", "#1c2233", "#1d5aa6", "#e6f3ff", "#7cc0ff"],
  scenes:    ["#dcf5f2", "#1c2233", "#0f6e6a", "#e0fbf8", "#3fd0c4"],
  money:     ["#f1f8dc", "#1c2233", "#4e6b10", "#f3fbdf", "#9fd33a"],
  night:     ["#1c2233", "#ffffff", "#141a2c", "#ffffff", "#ffd65c"],
  water:     ["#5ab8ff", "#ffffff", "#1f78c4", "#ffffff", "#ffffff"],
  festive:   ["#1f6f4a", "#ffffff", "#17774a", "#ffffff", "#ffd65c"],
  health:    ["#eef0f5", "#1c2233", "#2b3244", "#e1e5ef", "#9aa3b8"],
  recycling: ["#e4eeff", "#1c2233", "#2552b0", "#e4eeff", "#7ea8ff"],
  trash:     ["#e3f8e8", "#1c2233", "#1c7a40", "#e3f8e8", "#5fd88a"],
  muted:     ["#eef0f5", "#1c2233", "#2b3244", "#e1e5ef", "rgba(255,255,255,.22)"],
  // The Litter-Robot's own teal (pink and purple belong to the cats)
  litter:    ["#e2f6ef", "#1c2233", "#1e6b55", "#e4f7ef", "#5fd3a8"],
};
export const tone = (name, night) => {
  const t = TONES[name] || TONES.health;
  return { bg: night ? t[2] : t[0], ink: night ? t[3] : t[1], accent: t[4] };
};
// Anything switched off, everywhere: rooms, room pages, controls, the car, the litter box, the feeders
export const offTone = (night) => ({ bg: night ? "#2b3244" : "#eceef3", ink: night ? "#b4bccd" : "#6b7388", accent: night ? "#b4bccd" : "#8b93a7" });
// Each cat gets its own tone, in this order, on every card that shows cats
export const CAT_TONES = ["cats", "climate", "today", "energy"];

// Rooms: a lit room wears its colour; a dark room goes neutral, so "where are the lights on"
// reads from across the room without any decoration.
export const ROOM_TONES = [
  ["#fff0e4", "#9a4a17"], ["#fff7d9", "#a26a0a"], ["#f1ecff", "#4433a8"], ["#ffeaea", "#a3303a"],
  ["#e6f3ff", "#1d5aa6"], ["#ffeef5", "#9e2a64"], ["#e3f8f0", "#0e7556"], ["#dcf5f2", "#0f6e6a"],
];
export const roomTone = (i, night, lit = true) => {
  if (!lit) return offTone(night);
  const t = ROOM_TONES[i % ROOM_TONES.length];
  return { bg: night ? t[1] : t[0], ink: night ? "#fff8f0" : "#1c2233" };
};

// The colour a white light actually is at a colour temperature (Tanner Helland's fit),
// so Adaptive Lighting's "2200K" can be shown as the amber it is rather than a number
export function kelvinRgb(k) {
  const t = k / 100, c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}
export const rgbCss = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
// A light's tile wears the colour the light is showing: its rgb, else its white point,
// else (a light that reports no colour) a warm white. Ink flips for contrast.
export function lightTone(a, night) {
  const rgb = a.rgb_color || (a.color_temp_kelvin ? kelvinRgb(a.color_temp_kelvin) : kelvinRgb(2700));
  const base = night ? [20, 26, 44] : [255, 255, 255], f = night ? 0.8 : 0.72;
  const bg = base.map((v, i) => Math.round(v + (rgb[i] - v) * f));
  const light = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] > 150;
  const accent = bg.map((v) => Math.round(light ? v * 0.45 : v + (255 - v) * 0.6));
  return { bg: rgbCss(bg), ink: light ? "#1c2233" : "#ffffff", accent: rgbCss(accent), dark: !light };
}

// ── Helpers
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// A number, or null when the state isn't one
export const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? null : n; };
// No reading: missing, unknown or unavailable
export const quiet = (st) => !st || st === "unknown" || st === "unavailable";
// How long ago, roughly: "4 min", "3 hr", "2 d"; null under a minute
export const span = (iso) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? null : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} hr` : `${Math.floor(m / 1440)} d`;
};
export const isToday = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
// "7:24 AM" today, "Tue 7:24 AM" before that
export const when = (iso) => {
  const d = new Date(iso), t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return isToday(iso) ? t : `${d.toLocaleDateString([], { weekday: "short" })} ${t}`;
};
// The newest change across a device's own entities (object ids starting with prefix), ignoring
// buttons, updates and states with no reading. The browser only sees when a value last changed,
// not when it was last polled, so this is the best "last heard" there is.
export function newestChange(hass, prefix) {
  return Object.keys(hass.states).filter((e) => { const [d, o] = e.split("."); return o.startsWith(prefix) && !["update", "button"].includes(d) && !quiet(hass.states[e].state); })
    .reduce((m, e) => (hass.states[e].last_updated > m ? hass.states[e].last_updated : m), "");
}
// The status tag beside a card's title. kind: ok | busy | warn | alert | locked | muted
export const statusTag = (kind, text, title = "") =>
  `<span class="tag ${esc(kind)}"${title ? ` title="${esc(title)}"` : ""}><i></i>${esc(text)}</span>`;

// Column count follows the card's own width, not the window's. pick(width) returns the count;
// when it changes the card is redrawn through its own hass setter.
export const twoOrFour = (w) => (w && w < 560 ? 2 : 4);
export function watchColumns(card, pick = twoOrFour) {
  if (card._ro) return;
  card._ro = new ResizeObserver(() => {
    const cols = pick(card.clientWidth);
    if (cols !== card._cols) { card._cols = cols; card._sig = null; if (card._hass) card.hass = card._hass; }
  });
  card._ro.observe(card);
}

// ── Night
// Night is the sun, not the theme: every bento card goes dark when the sun is down.
export const isNight = (hass, sunEntity = "sun.sun") => hass?.states?.[sunEntity || "sun.sun"]?.state === "below_horizon";
// Marks the host, so :host(.is-night) switches the night tokens
export function applyNight(host, night) { host.classList.toggle("is-night", !!night); return !!night; }

// ── Page gutter
// HA's view scrolls the document, outside every card's shadow root. While any bento card is on the
// page, the page keeps a stable scrollbar gutter on both edges, so the layout doesn't shift when the
// scrollbar comes and goes and stays centred. Counted, so other dashboards are untouched once the
// last bento card leaves. Call pageGutter(true) on connect and pageGutter(false) on disconnect.
let gutterCount = 0;
export function pageGutter(on) {
  if (!document.getElementById("bento-gutter")) {
    const style = document.createElement("style");
    style.id = "bento-gutter";
    style.textContent = "html.bento-page { scrollbar-gutter: stable both-edges; }";
    document.head.appendChild(style);
  }
  gutterCount = Math.max(0, gutterCount + (on ? 1 : -1));
  document.documentElement.classList.toggle("bento-page", gutterCount > 0);
}

// ── Interaction
// The controls model: tap runs the tile's primary action, press and hold opens the details,
// Enter (and Space) is a tap. Taps on a tile's own buttons, sliders, pickers and drawn parts
// belong to them, not the tile.
export const HOLD_MS = 520;
const OWN = "button,a,input,select,label,.slide,.dd,[data-more],[data-part],[data-no-tap]";
export function bindTap(el, { tap, hold } = {}) {
  let timer = null, held = false;
  const mine = (ev) => !ev.target.closest(OWN);
  el.addEventListener("pointerdown", (ev) => {
    if (!mine(ev)) return;
    held = false;
    clearTimeout(timer);
    timer = setTimeout(() => { held = true; hold?.(); }, HOLD_MS);
  });
  const clear = () => clearTimeout(timer);
  el.addEventListener("pointerup", clear); el.addEventListener("pointerleave", clear); el.addEventListener("pointercancel", clear);
  el.addEventListener("click", (ev) => { if (held || !mine(ev)) { held = false; return; } (tap || hold)?.(); });
  el.addEventListener("keydown", (ev) => {
    if (ev.target !== el || (ev.key !== "Enter" && ev.key !== " ")) return;
    ev.preventDefault(); (tap || hold)?.();
  });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  if (!el.hasAttribute("role")) el.setAttribute("role", "button");
}
// Two taps for anything risky (unlocking, resetting a gauge, handing out treats): the first tap
// arms it for four seconds, the second runs it. State lives on the card as _confirm, so a card's
// redraw signature can include it. render() redraws the card.
export function confirmTap(card, key, { run, render, ms = 4000 }) {
  if (card._confirm !== key) {
    card._confirm = key;
    clearTimeout(card._confirmT);
    card._confirmT = setTimeout(() => { if (card._confirm === key) { card._confirm = null; render?.(); } }, ms);
    render?.();
    return false;
  }
  clearTimeout(card._confirmT);
  card._confirm = null;
  run?.();
  return true;
}
export const moreInfo = (el, entityId) => {
  if (entityId) el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
};

// ── Rooms: one list per dashboard
// bento-rooms and bento-room can leave out areas (and adaptive): they then use the first
// bento-rooms card on the same dashboard that lists its areas. Fetched once per dashboard.
// Resolves to { areas, adaptive } or null when no such card exists (or the config can't be read).
const ROOM_LISTS = new Map();
export const dashboardPath = (basePath) => {
  const p = String(basePath || window.location.pathname).replace(/^\/+/, "").split("/")[0] || "lovelace";
  return p;
};
function findRooms(node) {
  if (Array.isArray(node)) { for (const n of node) { const r = findRooms(n); if (r) return r; } return null; }
  if (!node || typeof node !== "object") return null;
  if (node.type === "custom:bento-rooms" && Array.isArray(node.areas) && node.areas.length) return { areas: node.areas, adaptive: node.adaptive || {} };
  for (const k of Object.keys(node)) { const r = findRooms(node[k]); if (r) return r; }
  return null;
}
export function roomList(hass, basePath) {
  const path = dashboardPath(basePath);
  if (!ROOM_LISTS.has(path)) {
    const p = hass.callWS({ type: "lovelace/config", url_path: path === "lovelace" ? null : path })
      .then((cfg) => findRooms(cfg))
      .catch(() => { setTimeout(() => ROOM_LISTS.delete(path), 60000); return null; }); // try again in a minute
    ROOM_LISTS.set(path, p);
  }
  return ROOM_LISTS.get(path);
}

console.info(`%c BENTO CORE %c ${BENTO_CORE_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
