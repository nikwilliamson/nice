// Hearth cards — custom Lovelace cards for the House dashboard.
// Cards: hearth-hero, hearth-stats, hearth-today, hearth-attention, hearth-moods, hearth-heading,
//        hearth-rooms, hearth-climate, hearth-cars, hearth-panels,
//        hearth-banner, hearth-group, hearth-chart, hearth-bars, hearth-nav, hearth-grid
// One type scale (40 / 28 / 15 / 13) and one spacing scale (4 / 8 / 12 / 16 / 24) for all of them.
// Look: mid-century modern — round "bubble" shapes, a mustard / tangerine / teal / avocado / rust palette,
// soft wonky Fraunces for headings and geometric Outfit for everything else.
const HEARTH_VERSION = "2.6.2";

// Fonts load once into the page; shadow roots can use document-level font faces
if (!document.getElementById("hearth-fonts")) {
  const link = document.createElement("link");
  link.id = "hearth-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..700,0..100,0..1&family=Outfit:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}
// The bubble colours, handed out in turn to rooms, panels and anything else that wants one
const MCM = { mustard: "#ffb81c", tangerine: "#ff6b2c", teal: "#00a19a", avocado: "#9cbf2b", rust: "#e8473b", turquoise: "#2ec4c6", plum: "#c2509a", cobalt: "#3f6fd8" };
const ACCENTS = [MCM.tangerine, MCM.teal, MCM.mustard, MCM.plum, MCM.avocado, MCM.cobalt, MCM.rust, MCM.turquoise];
const accent = (i) => ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];
// A four-pointed atomic sparkle, used as an ornament
const SPARKLE = '<svg class="sparkle" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z"/></svg>';

const BASE_CSS = `
:host {
  display: block;
  container-type: inline-size;
  --h-fg: var(--primary-text-color);
  --h-muted: var(--secondary-text-color);
  --h-card: var(--ha-card-background, var(--card-background-color));
  --h-radius: var(--ha-card-border-radius, 28px);
  --h-font: "Outfit", var(--ha-font-family-body, Roboto), sans-serif;
  --h-font-display: "Fraunces", Georgia, serif;
  --h-pad: 16px;
  --h-gap: 12px;
  --h-gap-sm: 8px;
  --h-fs-display: 40px;
  --h-fs-figure: 28px;
  --h-fs-title: 15px;
  --h-fs-body: 13px;
  --h-control: 40px;
  --h-good: #2e9c8f;
  --h-night: #4b5ba8;
  --h-chip: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
  --h-chip-hover: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
  --h-warm: #ffb81c;
  --h-warn: #e5832b;
  --h-alert: #c8492c;
  color: var(--h-fg);
  font-family: var(--h-font);
  font-size: var(--h-fs-body);
  line-height: 1.35;
}
@media (max-width: 600px) { :host { --h-fs-display: 32px; --h-fs-figure: 24px; --h-pad: 14px; --h-gap: 10px; } }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; text-align: inherit; }
ha-icon { --mdc-icon-size: 20px; display: inline-flex; }
.tile { width: var(--h-control); height: var(--h-control); flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--h-chip); color: var(--h-muted); }
/* a filled bubble in one of the palette colours */
.bubble { background: var(--accent, var(--h-warm)); color: #fff8ea; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .12); }
.display { font-family: var(--h-font-display); font-variation-settings: "SOFT" 100, "WONK" 1; font-weight: 600; letter-spacing: -0.01em; }
.sparkle { width: 12px; height: 12px; fill: currentColor; flex: none; }
.card { background: var(--h-card); border-radius: var(--h-radius); box-shadow: var(--ha-card-box-shadow, none); }
.card.clickable { cursor: pointer; }
.card.clickable:hover { background: color-mix(in srgb, var(--h-card) 92%, var(--primary-text-color)); }
.t-title { font-size: var(--h-fs-title); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-body { font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pressed { transform: scale(0.95); }
[data-act] { transition: transform 160ms cubic-bezier(.34, 1.56, .64, 1), background-color 160ms ease; -webkit-tap-highlight-color: transparent; }
.num { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
/* inside a hearth-grid every card fills its row, so neighbours end on the same line */
:host([in-grid]) { height: 100%; }
:host([in-grid]) .h-fill { height: 100%; }
`;

const WEATHER = {
  "clear-night": "Clear", cloudy: "Cloudy", exceptional: "Unusual weather", fog: "Fog", hail: "Hail",
  lightning: "Lightning", "lightning-rainy": "Storms", partlycloudy: "Partly cloudy", pouring: "Heavy rain",
  rainy: "Rain", snowy: "Snow", "snowy-rainy": "Sleet", sunny: "Sunny", windy: "Windy", "windy-variant": "Windy",
};
const HVAC = { cooling: "Cooling", heating: "Heating", idle: "Holding", off: "Off", fan: "Fan only", drying: "Drying", preheating: "Preheating", defrosting: "Defrosting" };
const HVAC_MODE = { cool: "Cooling", heat: "Heating", heat_cool: "Holding", auto: "Holding", dry: "Drying", fan_only: "Fan only", off: "Off" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v === null || v === undefined || v === "") return NaN; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const fmt = (v, p = 0) => {
  const n = num(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: p, maximumFractionDigits: p }) : "—";
};

function matches(hass, c) {
  const s = hass.states[c.entity];
  if (!s) return false;
  const st = s.state;
  if (c.is !== undefined && ![].concat(c.is).includes(st)) return false;
  if (c.not !== undefined && [].concat(c.not).includes(st)) return false;
  if (c.above !== undefined && !(num(st) > c.above)) return false;
  if (c.below !== undefined && !(num(st) < c.below)) return false;
  return true;
}
function active(hass, r) {
  if (r.any && !r.any.some((c) => matches(hass, c))) return false;
  return (r.when || (r.any ? [] : [r])).every((c) => matches(hass, c));
}
function stateText(hass, id) {
  const s = hass.states[id];
  if (!s) return "";
  return hass.formatEntityState ? hass.formatEntityState(s) : s.state;
}
function navigate(path) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}
// Back to wherever you came from inside Home Assistant; a page opened directly goes to the fallback instead
function goBack(fallback = "/") {
  if (history.length > 1) history.back();
  else navigate(fallback);
}
const RAINY = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"]);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// Times follow the user's Home Assistant setting: the device's zone, or the server's when they chose that
let TZ;
const syncTZ = (hass) => { TZ = hass?.locale?.time_zone === "server" ? hass.config?.time_zone : undefined; };
const clock = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: TZ });
const hourOnly = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", timeZone: TZ });

async function fetchHistory(hass, ids, hours) {
  const start = new Date(Date.now() - hours * 3600e3).toISOString();
  return hass.callWS({ type: "history/history_during_period", start_time: start, entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
}
// Average a state history into evenly spaced buckets, carrying the last value forward
function bucket(rows, hours, n = 48) {
  if (!rows || !rows.length) return [];
  const end = Date.now();
  const startMs = end - hours * 3600e3;
  const step = (end - startMs) / n;
  const pts = rows.map((r) => [(r.lu ?? r.lc ?? 0) * 1000, num(r.s)]).filter(([, v]) => Number.isFinite(v));
  if (pts.length < 2) return [];
  const out = [];
  let i = 0;
  let last = pts[0][1];
  for (let b = 0; b < n; b++) {
    const bEnd = startMs + (b + 1) * step;
    let sum = 0, cnt = 0;
    while (i < pts.length && pts[i][0] < bEnd) { sum += pts[i][1]; cnt++; last = pts[i][1]; i++; }
    out.push(cnt ? sum / cnt : last);
  }
  return out;
}
function sparkline(values, color) {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(26 - ((v - min) / span) * 22).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="0,28 ${pts.join(" ")} 100,28" style="fill:${color}; opacity:0.12"></polygon>
    <polyline points="${pts.join(" ")}" style="fill:none; stroke:${color}; stroke-width:1.6; stroke-linejoin:round; stroke-linecap:round" vector-effect="non-scaling-stroke"></polyline>
  </svg>`;
}

function lightMembers(hass, id, seen = new Set(), depth = 0) {
  const s = hass.states[id];
  if (!s || seen.has(id)) return seen;
  const kids = s.attributes.entity_id;
  if (Array.isArray(kids) && kids.length && depth < 3) {
    kids.forEach((k) => lightMembers(hass, k, seen, depth + 1));
  } else {
    seen.add(id);
  }
  return seen;
}

// Thermostat modes and a debounced target nudge shared by the rooms and climate cards
const MODE = {
  cool: ["Cooling", MCM.turquoise], heat: ["Heating", MCM.tangerine], heat_cool: ["Auto", MCM.plum], auto: ["Auto", MCM.plum],
  dry: ["Drying", MCM.avocado], fan_only: ["Fan only", MCM.avocado], off: ["Off", "var(--h-muted)"],
};
function nudgeClimate(card, entity, dir) {
  const a = card._hass.states[entity]?.attributes;
  if (!a) return;
  card._pending = card._pending || {};
  card._timers = card._timers || {};
  const step = dir * (a.target_temp_step || 1);
  const min = num(a.min_temp) || 40, max = num(a.max_temp) || 99;
  const next = Math.max(min, Math.min(max, Math.round(((card._pending[entity] ?? num(a.temperature)) + step) * 2) / 2));
  card._pending[entity] = next;
  card._update();
  clearTimeout(card._timers[entity]);
  card._timers[entity] = setTimeout(() => {
    card._hass.callService("climate", "set_temperature", { temperature: next }, { entity_id: entity });
    setTimeout(() => { delete card._pending[entity]; card._update(); }, 4000);
  }, 700);
}
function stepClick(card, e) {
  const btn = e.composedPath().find((n) => n.dataset && n.dataset.step !== undefined);
  if (!btn) return false;
  e.stopPropagation();
  const [entity, dir] = btn.dataset.step.split("|");
  nudgeClimate(card, entity, Number(dir));
  return true;
}

// Forecast subscription shared by every card that needs it; returns the unsubscribe promise
function subscribeForecast(hass, entity, type, cb) {
  return hass.connection.subscribeMessage((m) => cb(m.forecast || []), { type: "weather/subscribe_forecast", forecast_type: type, entity_id: entity });
}
const nextRain = (hourly, hours = 12) => {
  const soon = Date.now() + hours * 3600e3;
  return (hourly || []).find((h) => Date.parse(h.datetime) <= soon && (RAINY.has(h.condition) || num(h.precipitation) > 0 || num(h.precipitation_probability) >= 50));
};
const duration = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};

// ── Sky: the one place that turns sun.sun and the weather into colours and a mood ──
// Sky colours by sun elevation, [elevation, zenith, horizon]; evening and morning differ a little
const SKY_SETTING = [
  [-90, "#070b1c", "#121834"], [-12, "#0b1027", "#1b2046"], [-7, "#161b42", "#3b3468"], [-4, "#272c62", "#8c587e"],
  [-1, "#36437f", "#dd7a66"], [2, "#4d64a2", "#f3a06a"], [6, "#5a7fbd", "#f2c78f"], [15, "#3f7fc6", "#b9d8ef"], [90, "#2f74c4", "#a6cdee"],
];
const SKY_RISING = [
  [-90, "#070b1c", "#121834"], [-12, "#0b1027", "#1b2046"], [-7, "#1b2149", "#46406f"], [-4, "#353e78", "#b9839c"],
  [-1, "#4d5f9a", "#efae91"], [2, "#6584bd", "#f6c9a0"], [6, "#5d8cca", "#e3e0cc"], [15, "#3f7fc6", "#b9d8ef"], [90, "#2f74c4", "#a6cdee"],
];
// How each condition dims the sky: cloud (toward grey), dark (toward black), and the effect layer to draw
const WEATHER_MOOD = {
  sunny: { cloud: 0 }, "clear-night": { cloud: 0 }, partlycloudy: { cloud: 0.18, clouds: 3 }, cloudy: { cloud: 0.55, clouds: 6 },
  fog: { cloud: 0.6, fog: true }, windy: { cloud: 0.1, clouds: 2 }, "windy-variant": { cloud: 0.35, clouds: 4 },
  rainy: { cloud: 0.6, dark: 0.15, clouds: 5, fx: "rain" }, pouring: { cloud: 0.7, dark: 0.3, clouds: 6, fx: "rain", heavy: true },
  "lightning-rainy": { cloud: 0.7, dark: 0.35, clouds: 6, fx: "rain", flash: true }, lightning: { cloud: 0.6, dark: 0.3, clouds: 5, flash: true },
  hail: { cloud: 0.65, dark: 0.2, clouds: 5, fx: "rain" }, snowy: { cloud: 0.55, clouds: 5, fx: "snow" }, "snowy-rainy": { cloud: 0.6, dark: 0.1, clouds: 5, fx: "snow" },
  exceptional: { cloud: 0.3 },
};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const rgb = (a) => `rgb(${a.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")})`;
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const luminance = (a) => {
  const [r, g, b] = a.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function skyAt(hass, weatherEntity, now = Date.now()) {
  const sun = hass.states["sun.sun"];
  const a = sun?.attributes || {};
  const elev = Number.isFinite(num(a.elevation)) ? num(a.elevation) : (sun?.state === "above_horizon" ? 30 : -30);
  const rising = !!a.rising;
  const up = sun ? sun.state === "above_horizon" : elev > 0;
  const nextRise = Date.parse(a.next_rising), nextSet = Date.parse(a.next_setting);

  // colours: interpolate the table at this elevation
  const table = rising ? SKY_RISING : SKY_SETTING;
  let i = table.findIndex(([e]) => e >= elev);
  if (i <= 0) i = Math.max(1, i === -1 ? table.length - 1 : 1);
  const [e0, z0, h0] = table[i - 1], [e1, z1, h1] = table[i];
  const t = Math.max(0, Math.min(1, (elev - e0) / (e1 - e0)));
  let zenith = lerp(hex(z0), hex(z1), t), horizon = lerp(hex(h0), hex(h1), t);

  // weather: wash toward grey, then darken
  const w = hass.states[weatherEntity];
  const mood = WEATHER_MOOD[w?.state] || { cloud: 0 };
  const grey = (c) => { const y = 255 * Math.sqrt(luminance(c)); return [y * 0.96, y * 0.98, y * 1.03]; };
  zenith = lerp(zenith, grey(zenith), mood.cloud || 0);
  horizon = lerp(horizon, grey(horizon), (mood.cloud || 0) * 0.9);
  if (mood.dark) { zenith = lerp(zenith, [0, 0, 0], mood.dark); horizon = lerp(horizon, [0, 0, 0], mood.dark); }

  // phase and the sun's (or night's) progress across its arc
  const phase = elev >= 6 ? "day" : elev >= 0 ? "golden" : elev >= -6 ? (rising ? "dawn" : "dusk") : "night";
  let progress = null, from, to;
  if (up && Number.isFinite(nextSet)) {
    to = nextSet;
    from = nextRise - 864e5; // today's sunrise
    progress = (now - from) / (to - from);
  } else if (!up && Number.isFinite(nextRise)) {
    to = nextRise;
    from = Number.isFinite(nextSet) ? nextSet - 864e5 : nextRise - 12 * 3600e3;
    progress = (now - from) / (to - from);
  }
  if (progress != null) progress = Math.max(0, Math.min(1, progress));

  // text that stays readable: dark ink on pale skies, white on everything else
  const behindText = lerp(zenith, horizon, 0.3);
  const light = luminance(behindText) > 0.42;
  const glow = phase === "day" ? "#fff6d8" : phase === "golden" ? "#ffcf8a" : "#ff9f78";
  const stars = Math.max(0, Math.min(1, (-elev - 4) / 8)) * (1 - (mood.cloud || 0));
  return {
    phase, elev, rising, up, progress, from, to, nextRise, nextSet, mood, stars, glow, veil: 1 - (mood.cloud || 0) * 0.75,
    condition: w?.state, temperature: w?.attributes.temperature, unit: w?.attributes.temperature_unit || "°",
    zenith: rgb(zenith), horizon: rgb(horizon), ink: light ? "#17202c" : "#ffffff", inkMuted: light ? "rgba(23,32,44,.72)" : "rgba(255,255,255,.8)", light,
  };
}

class HearthBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._actions = [];
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
  }
  setConfig(config) {
    this._config = config || {};
    this._html = "";
    if (this._hass) this._update();
  }
  set hass(hass) {
    this._hass = hass;
    this._update();
  }
  _update() {
    if (!this._hass || !this._config) return;
    syncTZ(this._hass);
    this._actions = [];
    const html = `<style>${BASE_CSS}${this.constructor.styles || ""}</style>${this.render()}`;
    if (html !== this._html) {
      this._html = html;
      this.shadowRoot.innerHTML = html;
    }
  }
  act(a) {
    if (!a) return "";
    this._actions.push(a);
    return `data-act="${this._actions.length - 1}"`;
  }
  _onClick(e) {
    const el = e.composedPath().find((n) => n.dataset && n.dataset.act !== undefined);
    if (!el) return;
    e.stopPropagation();
    const a = this._actions[Number(el.dataset.act)];
    if (!a) return;
    el.classList.add("pressed");
    setTimeout(() => el.classList.remove("pressed"), 160);
    if (a.confirm && !window.confirm(a.confirm)) return;
    if (a.navigate) return navigate(a.navigate);
    if (a.back) return goBack(a.back);
    if (a.more_info) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: a.more_info }, bubbles: true, composed: true }));
      return;
    }
    if (a.service) {
      const [domain, service] = a.service.split(".");
      this._hass.callService(domain, service, a.data || {}, a.target);
    }
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
}

// ── Hero: a window on the moment — the sky follows the sun and the weather ──
// Static layers (stars, clouds, rain) are rebuilt only when the scene changes, so their motion never restarts.
class HearthHero extends HearthBase {
  static styles = `
    .sky { position: relative; isolation: isolate; overflow: hidden; border-radius: var(--h-radius); color: var(--ink);
      background: linear-gradient(180deg, var(--zenith) 0%, color-mix(in srgb, var(--zenith) 55%, var(--horizon)) 55%, var(--horizon) 100%);
      display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 46%); min-height: clamp(232px, 26cqw, 340px);
      transition: color 600ms ease; }
    .sky::after { content: ""; position: absolute; inset: 0; z-index: 3; pointer-events: none;
      background: linear-gradient(90deg, color-mix(in srgb, var(--zenith) 55%, transparent) 0%, transparent 62%); }
    .layer { position: absolute; inset: 0; pointer-events: none; }
    .copy { position: relative; z-index: 4; padding: clamp(18px, 3cqw, 32px); display: flex; flex-direction: column; justify-content: space-between; gap: var(--h-pad); min-width: 0; }
    .dark .copy { text-shadow: 0 1px 2px rgba(0, 0, 0, .28); }
    .when { font-size: var(--h-fs-body); color: var(--ink-muted); }
    h1 { margin: 6px 0 0; font-size: clamp(32px, 4.8cqw, 58px); line-height: 1.04; }
    .lines { display: flex; flex-direction: column; gap: 4px; font-size: var(--h-fs-title); }
    .line { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .line ha-icon { --mdc-icon-size: 18px; flex: none; }
    .line .m { color: var(--ink-muted); }
    .line span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .people { display: flex; flex-wrap: wrap; gap: var(--h-gap-sm); }
    .person { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px 0 10px; font-weight: 500; border-radius: 999px; font-size: var(--h-fs-body);
      background: color-mix(in srgb, var(--ink) 14%, transparent); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); text-shadow: none; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-muted); opacity: .6; }
    .person.home .dot { background: #7fd08a; opacity: 1; box-shadow: 0 0 0 3px color-mix(in srgb, #7fd08a 28%, transparent); }
    .person.moving .dot { background: #f4b83f; opacity: 1; }
    .person.out { color: var(--ink-muted); }

    /* the arc: sunrise on the left, sunset on the right; at night it tracks toward sunrise */
    .arc { position: relative; z-index: 2; margin: clamp(18px, 3cqw, 32px) clamp(18px, 3cqw, 32px) 0 0; }
    .arc svg { position: absolute; inset: 0 0 34px 0; width: 100%; height: calc(100% - 34px); overflow: visible; }
    .arc .path { fill: none; stroke: var(--ink); stroke-opacity: .28; stroke-width: 1.5; stroke-dasharray: 3 5; }
    .arc .done { fill: none; stroke: var(--ink); stroke-opacity: .55; stroke-width: 1.5; }
    .arc .ground { stroke: var(--ink); stroke-opacity: .3; stroke-width: 1; }
    .orb { position: absolute; width: 0; height: 0; opacity: var(--orb, 1); }
    .orb::before { content: ""; position: absolute; left: -90px; top: -90px; width: 180px; height: 180px; border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--glow) 55%, transparent) 0%, transparent 65%); }
    .orb::after { content: ""; position: absolute; left: -15px; top: -15px; width: 30px; height: 30px; border-radius: 50%;
      background: radial-gradient(circle at 40% 38%, #fffef6, var(--glow) 70%); box-shadow: 0 0 24px 6px color-mix(in srgb, var(--glow) 60%, transparent); }
    .orb.retro::after { background: linear-gradient(180deg, #ffe08a 0%, #f6a33b 55%, #e0662a 100%);
      -webkit-mask: linear-gradient(180deg, #000 0 52%, transparent 52% 58%, #000 58% 68%, transparent 68% 73%, #000 73% 82%, transparent 82% 86%, #000 86%);
      mask: linear-gradient(180deg, #000 0 52%, transparent 52% 58%, #000 58% 68%, transparent 68% 73%, #000 73% 82%, transparent 82% 86%, #000 86%);
      width: 40px; height: 40px; left: -20px; top: -20px; box-shadow: none; }
    .orb.moon::before { background: radial-gradient(circle, rgba(220, 228, 255, .22) 0%, transparent 60%); }
    .orb.moon::after { left: -12px; top: -12px; width: 24px; height: 24px; background: transparent; box-shadow: inset -7px -3px 0 0 #eef1fb; transform: rotate(-20deg); }
    .ends { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; justify-content: space-between; font-size: var(--h-fs-body); color: var(--ink-muted); }
    .ends span { display: inline-flex; align-items: center; gap: 4px; }
    .ends ha-icon { --mdc-icon-size: 15px; }
    .dark .ends { text-shadow: 0 1px 2px rgba(0, 0, 0, .35); }

    /* weather and night layers */
    .star { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; }
    .star .sparkle { position: absolute; left: -5px; top: -5px; width: 12px; height: 12px; fill: #fff6dc; }
    .star.tw { animation: twinkle 4s ease-in-out infinite; }
    @keyframes twinkle { 50% { opacity: .25; } }
    .cloud { position: absolute; height: 26px; border-radius: 999px; background: var(--cloud); animation: drift 90s ease-in-out infinite alternate; }
    .cloud::before, .cloud::after { content: ""; position: absolute; bottom: 40%; border-radius: 50%; background: inherit; }
    .cloud::before { left: 16%; width: 38%; aspect-ratio: 1; }
    .cloud::after { left: 42%; width: 30%; aspect-ratio: 1; bottom: 30%; }
    @keyframes drift { to { transform: translateX(14%); } }
    .fog { background: linear-gradient(180deg, transparent 20%, color-mix(in srgb, var(--cloud) 80%, transparent) 75%); }
    .drop { position: absolute; top: -20%; width: 1.5px; height: 18px; border-radius: 1px; background: linear-gradient(transparent, rgba(255, 255, 255, .55)); animation: fall linear infinite; transform: rotate(12deg); }
    @keyframes fall { to { top: 110%; } }
    .flake { position: absolute; top: -8%; width: 5px; height: 5px; border-radius: 50%; background: rgba(255, 255, 255, .85); animation: snow linear infinite; }
    @keyframes snow { to { top: 108%; transform: translateX(24px); } }
    .flash { background: #fff; opacity: 0; animation: flash 9s infinite; }
    @keyframes flash { 0%, 91%, 95%, 100% { opacity: 0; } 92% { opacity: .35; } 93% { opacity: .05; } 94% { opacity: .25; } }

    @container (max-width: 720px) {
      .sky { grid-template-columns: 1fr; grid-template-rows: auto 150px; }
      .sky::after { background: linear-gradient(180deg, color-mix(in srgb, var(--zenith) 50%, transparent) 0%, transparent 55%); }
      .copy { padding-bottom: 0; }
      .arc { margin: 4px 18px 0; }
      .orb::before { left: -60px; top: -60px; width: 120px; height: 120px; }
    }
    @container (max-width: 420px) { .lines { font-size: var(--h-fs-body); } .person { height: 28px; } }
    @media (prefers-reduced-motion: reduce) { .star.tw, .cloud, .drop, .flake, .flash { animation: none; } .drop, .flake, .flash { display: none; } }`;

  connectedCallback() {
    this._timer = setInterval(() => this._update(), 60e3);
    if (this._hass) this._start();
  }
  disconnectedCallback() {
    clearInterval(this._timer);
    (this._unsubs || []).forEach((u) => u.then((f) => f()).catch(() => {}));
    this._unsubs = null;
  }
  set hass(hass) {
    this._hass = hass;
    if (this.isConnected) this._start();
    this._update();
  }
  _start() {
    if (this._unsubs || !this._config) return;
    const w = this._config.weather || "weather.forecast_home";
    this._unsubs = [
      subscribeForecast(this._hass, w, "daily", (f) => { this._daily = f; this._update(); }),
      subscribeForecast(this._hass, w, "hourly", (f) => { this._hourly = f; this._update(); }),
    ];
  }

  viewer() {
    const h = this._hass;
    const me = Object.values(h.states).find((s) => s.entity_id.startsWith("person.") && s.attributes.user_id === h.user?.id);
    return String(me?.attributes.friendly_name || h.user?.name || "").split(" ")[0];
  }
  people() {
    const h = this._hass;
    return (this._config.people || []).map((p) => {
      const s = h.states[p.entity];
      if (!s) return "";
      const name = esc(p.name || s.attributes.friendly_name);
      if (s.state === "home") return `<span class="person home"><span class="dot"></span>${name} is home</span>`;
      if (p.driving && p.eta && h.states[p.driving]?.state === "on") {
        const mins = Math.round((Date.parse(h.states[p.eta]?.state) - Date.now()) / 60000);
        return `<span class="person moving"><span class="dot"></span>${name} is ${Number.isFinite(mins) && mins > 0 ? `${mins} min away` : "on the way"}</span>`;
      }
      return `<span class="person out"><span class="dot"></span>${name} ${s.state === "not_home" ? "is out" : `is at ${esc(s.state)}`}</span>`;
    }).join("");
  }
  sunLine(sky) {
    const now = Date.now();
    if (sky.up) {
      const left = sky.nextSet - now;
      if (sky.phase === "golden" && !sky.rising) return ["mdi:weather-sunset", "Golden hour", `sunset in ${duration(left)}`];
      if (sky.phase === "golden") return ["mdi:weather-sunset-up", "Morning light", `sunset at ${clock(new Date(sky.nextSet))}`];
      return ["mdi:white-balance-sunny", `Sunset at ${clock(new Date(sky.nextSet))}`, `${duration(left)} of daylight left`];
    }
    const until = sky.nextRise - now;
    if (sky.phase === "dawn") return ["mdi:weather-sunset-up", "Dawn", `sunrise in ${duration(until)}`];
    if (sky.phase === "dusk") return ["mdi:weather-sunset-down", "Dusk", `sunrise at ${clock(new Date(sky.nextRise))}`];
    return ["mdi:weather-night", `Sunrise at ${clock(new Date(sky.nextRise))}`, until < 4 * 3600e3 ? `in ${duration(until)}` : ""];
  }
  weatherLine(sky) {
    const today = (this._daily || [])[0];
    const words = WEATHER[sky.condition] || (sky.condition ? esc(sky.condition) : "—");
    const temp = Number.isFinite(num(sky.temperature)) ? `${fmt(sky.temperature)}°` : "";
    const hilo = today && Number.isFinite(num(today.temperature)) ? `High ${fmt(today.temperature)}° · Low ${fmt(today.templow)}°` : "";
    const wet = RAINY.has(sky.condition) ? null : nextRain(this._hourly);
    const icon = { sunny: "mdi:weather-sunny", "clear-night": "mdi:weather-night", partlycloudy: sky.up ? "mdi:weather-partly-cloudy" : "mdi:weather-night-partly-cloudy", cloudy: "mdi:weather-cloudy", fog: "mdi:weather-fog", rainy: "mdi:weather-rainy", pouring: "mdi:weather-pouring", "lightning-rainy": "mdi:weather-lightning-rainy", lightning: "mdi:weather-lightning", snowy: "mdi:weather-snowy", "snowy-rainy": "mdi:weather-snowy-rainy", hail: "mdi:weather-hail", windy: "mdi:weather-windy", "windy-variant": "mdi:weather-windy-variant" }[sky.condition] || "mdi:weather-partly-cloudy";
    // a sunny condition at night reads as clear
    const label = sky.condition === "sunny" && !sky.up ? "Clear" : words;
    return { icon, main: [label, temp].filter(Boolean).join(", "), sub: wet ? `Rain around ${hourOnly(new Date(wet.datetime))}` : hilo };
  }

  // stars, clouds and precipitation: deterministic, so redraws place them identically
  fx(sky) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = [];
    if (sky.stars > 0.02) {
      const stars = Array.from({ length: 46 }, (_, i) => `<span class="star ${i % 5 ? "" : "tw"}" style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 70).toFixed(1)}%;opacity:${(0.35 + rnd() * 0.65).toFixed(2)};animation-delay:-${(rnd() * 4).toFixed(1)}s">${i % 7 ? "" : SPARKLE}</span>`);
      out.push(`<div class="layer" style="opacity:${sky.stars.toFixed(2)}">${stars.join("")}</div>`);
    }
    const m = sky.mood;
    if (m.clouds) {
      const clouds = Array.from({ length: m.clouds }, () => {
        const w = 70 + rnd() * 90;
        return `<span class="cloud" style="left:${(rnd() * 95 - 10).toFixed(1)}%;top:${(18 + rnd() * 60).toFixed(1)}%;width:${w.toFixed(0)}px;height:${(w * 0.22).toFixed(0)}px;animation-delay:-${(rnd() * 90).toFixed(0)}s;opacity:${(0.55 + rnd() * 0.35).toFixed(2)}"></span>`;
      });
      out.push(`<div class="layer">${clouds.join("")}</div>`);
    }
    if (m.fog) out.push('<div class="layer fog"></div>');
    if (m.fx === "rain") {
      const n = m.heavy ? 70 : 40;
      out.push(`<div class="layer">${Array.from({ length: n }, () => `<span class="drop" style="left:${(rnd() * 104 - 2).toFixed(1)}%;animation-duration:${(0.6 + rnd() * 0.5).toFixed(2)}s;animation-delay:-${(rnd() * 2).toFixed(2)}s;opacity:${(0.4 + rnd() * 0.6).toFixed(2)}"></span>`).join("")}</div>`);
    }
    if (m.fx === "snow") {
      out.push(`<div class="layer">${Array.from({ length: 36 }, () => `<span class="flake" style="left:${(rnd() * 100).toFixed(1)}%;animation-duration:${(6 + rnd() * 6).toFixed(1)}s;animation-delay:-${(rnd() * 12).toFixed(1)}s;transform:scale(${(0.5 + rnd() * 0.7).toFixed(2)})"></span>`).join("")}</div>`);
    }
    if (m.flash) out.push('<div class="layer flash"></div>');
    return out.join("");
  }

  arc(sky) {
    if (sky.progress == null) return "";
    const p = sky.progress;
    const x = 50 - 50 * Math.cos(Math.PI * p), y = 100 - 88 * Math.sin(Math.PI * p);
    const night = !sky.up;
    const left = night ? ["mdi:weather-sunset-down", clock(new Date(sky.from))] : ["mdi:weather-sunset-up", clock(new Date(sky.from))];
    const right = night ? ["mdi:weather-sunset-up", clock(new Date(sky.to))] : ["mdi:weather-sunset-down", clock(new Date(sky.to))];
    // the travelled part of the arc, drawn as a polyline so it can stop at any point
    const pts = Array.from({ length: 41 }, (_, i) => { const q = (i / 40) * p; return `${(50 - 50 * Math.cos(Math.PI * q)).toFixed(2)},${(100 - 88 * Math.sin(Math.PI * q)).toFixed(2)}`; });
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="path" d="M0 100 A50 88 0 0 1 100 100" vector-effect="non-scaling-stroke"></path>
        <polyline class="done" points="${pts.join(" ")}" vector-effect="non-scaling-stroke"></polyline>
        <line class="ground" x1="-4" y1="100" x2="104" y2="100" vector-effect="non-scaling-stroke"></line>
      </svg>
      <span class="orb ${night ? "moon" : sky.phase === "golden" && !sky.rising ? "retro" : ""}" style="left:${x.toFixed(2)}%;top:calc((100% - 34px) * ${(y / 100).toFixed(4)})"></span>
      <div class="ends"><span><ha-icon icon="${left[0]}"></ha-icon>${esc(left[1])}</span><span><ha-icon icon="${right[0]}"></ha-icon>${esc(right[1])}</span></div>`;
  }

  _update() {
    if (!this._hass || !this._config) return;
    syncTZ(this._hass);
    const sky = skyAt(this._hass, this._config.weather || "weather.forecast_home");
    const now = new Date();
    const hr = Number(now.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }));
    const greet = hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const name = this._config.greet_viewer === false ? "" : this.viewer();
    const when = `${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: TZ })} · ${clock(now)}`;
    const [sunIcon, sunMain, sunSub] = this.sunLine(sky);
    const wl = this.weatherLine(sky);
    const copy = `<div>
        <div class="when">${esc(when)}</div>
        <h1 class="display">${esc(this._config.greeting || greet)}${name ? `, ${esc(name)}` : ""}</h1>
      </div>
      <div class="lines">
        <div class="line"><ha-icon icon="${wl.icon}"></ha-icon><span>${esc(wl.main)}${wl.sub ? ` <span class="m">· ${esc(wl.sub)}</span>` : ""}</span></div>
        <div class="line"><ha-icon icon="${sunIcon}"></ha-icon><span>${esc(sunMain)}${sunSub ? ` <span class="m">· ${esc(sunSub)}</span>` : ""}</span></div>
      </div>
      <div class="people">${this.people()}</div>`;

    // build the frame once; afterwards only the parts that changed are touched
    if (!this.shadowRoot.querySelector(".sky")) {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${this.constructor.styles}</style>
        <div class="sky" role="img"><div class="layer fxs"></div><div class="copy"></div><div class="arc"></div></div>`;
      this._parts = {};
    }
    const root = this.shadowRoot.querySelector(".sky");
    const vars = { "--zenith": sky.zenith, "--horizon": sky.horizon, "--ink": sky.ink, "--ink-muted": sky.inkMuted, "--glow": sky.glow, "--orb": sky.veil.toFixed(2),
      "--cloud": sky.up ? "rgba(255,250,238,.82)" : "rgba(150,160,190,.3)" };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.classList.toggle("dark", !sky.light);
    root.setAttribute("aria-label", `${wl.main}. ${sunMain}${sunSub ? `, ${sunSub}` : ""}.`);
    const fxKey = `${sky.condition}|${sky.up}|${sky.stars.toFixed(1)}`;
    const set = (sel, key, html) => { if (this._parts[key] !== html) { this._parts[key] = html; this.shadowRoot.querySelector(sel).innerHTML = html; } };
    if (this._parts.fxKey !== fxKey) { this._parts.fxKey = fxKey; this.shadowRoot.querySelector(".fxs").innerHTML = this.fx(sky); }
    set(".copy", "copy", copy);
    set(".arc", "arc", this.arc(sky));
  }
}

// ── Stats: headline numbers with full-bleed sparklines ────────────────────
class HearthStats extends HearthBase {
  static styles = `
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--h-gap); }
    .stat { --px: var(--h-pad); --py: var(--h-pad); position: relative; overflow: hidden; padding: var(--py) var(--px); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .label { display: flex; align-items: center; gap: 6px; font-size: var(--h-fs-body); color: var(--h-muted); }
    .label ha-icon { --mdc-icon-size: 16px; color: var(--accent); }
    .stat { background: color-mix(in srgb, var(--accent) 12%, var(--h-card)); }
    .value { font-family: var(--h-font-display); font-variation-settings: "SOFT" 100, "WONK" 1; font-size: var(--h-fs-display); line-height: 1.1; font-weight: 600; margin: 4px 0 2px; white-space: nowrap; }
    .unit { font-size: var(--h-fs-title); font-weight: 400; color: var(--h-muted); margin-left: 4px; letter-spacing: 0; }
    .sub { font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rain { font-size: var(--h-fs-body); color: #6aa9f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; }
    .rain ha-icon { --mdc-icon-size: 14px; }
    .short { display: none; }
    .stat.has-spark { padding-bottom: 0; }
    .bleed { margin: auto calc(-1 * var(--px)) 0; padding-top: var(--h-gap); }
    .spark { display: block; width: 100%; height: 44px; }
    .spark-empty { display: block; height: 44px; }
    @container (max-width: 460px) {
      .stats { gap: var(--h-gap-sm); }
      .stat { --px: 12px; --py: 12px; }
      .long { display: none; }
      .short { display: inline; }
      .spark, .spark-empty { height: 36px; }
      .value { font-size: var(--h-fs-figure); }
      .unit { font-size: var(--h-fs-body); }
    }`;

  connectedCallback() {
    this._timer = setInterval(() => this._update(), 30000);
    this._sparkTimer = setInterval(() => this._loadSparks(), 10 * 60e3);
    if (this._hass) this._start();
  }
  disconnectedCallback() {
    clearInterval(this._timer);
    clearInterval(this._sparkTimer);
    (this._unsubs || []).forEach((u) => u.then((f) => f()).catch(() => {}));
    this._unsubs = null;
    this._started = false;
  }
  set hass(hass) {
    this._hass = hass;
    if (this.isConnected) this._start();
    this._update();
  }
  _start() {
    if (this._started || !this._config) return;
    this._started = true;
    this._loadSparks();
    const f = (this._config.stats || []).find((s) => s.forecast);
    if (f) {
      const sub = (type, key) => subscribeForecast(this._hass, f.forecast, type, (fc) => { this[key] = fc; this._update(); });
      this._unsubs = [sub("daily", "_daily"), sub("hourly", "_hourly")];
    }
  }
  async _loadSparks() {
    const stats = (this._config?.stats || []).filter((s) => s.spark);
    if (!stats.length || !this._hass) return;
    const hours = this._config.spark_hours || 24;
    try {
      const hist = await fetchHistory(this._hass, [...new Set(stats.map((s) => s.spark_entity || s.entity))], hours);
      this._sparks = Object.fromEntries(Object.entries(hist).map(([id, rows]) => [id, bucket(rows, hours)]));
      this._update();
    } catch (e) {
      console.warn("hearth-stats: history unavailable", e);
    }
  }
  forecastLines() {
    const today = (this._daily || [])[0];
    let hilo = "";
    if (today && today.temperature != null) hilo = `<span class="sub"><span class="long">High ${fmt(today.temperature)}° · Low ${fmt(today.templow)}°</span><span class="short">H ${fmt(today.temperature)}° · L ${fmt(today.templow)}°</span></span>`;
    const wet = nextRain(this._hourly);
    const rain = wet ? `<span class="rain"><ha-icon icon="mdi:umbrella-outline"></ha-icon>Rain around ${hourOnly(new Date(wet.datetime))}</span>` : "";
    return { hilo, rain };
  }

  sub(st) {
    const h = this._hass;
    const s = st.sub_entity && h.states[st.sub_entity];
    if (!s) return esc(st.sub || "");
    if (st.sub_kind === "weather") return WEATHER[s.state] || esc(s.state);
    if (st.sub_kind === "climate") {
      const action = HVAC[s.attributes.hvac_action] || HVAC_MODE[s.state] || esc(s.state);
      const target = s.attributes.temperature;
      return s.state === "off" || target == null ? action : `${action} to ${fmt(target)}°`;
    }
    if (st.sub_kind === "number") return `${esc(st.sub_prefix || "")}${fmt(s.state, st.sub_precision ?? 0)}${esc(st.sub_suffix || "")}`;
    return esc(stateText(h, st.sub_entity));
  }

  stat(st, i = 0) {
    const s = this._hass.states[st.entity];
    const n = s ? num(s.state) * (st.scale || 1) : NaN;
    const value = Number.isFinite(n) ? fmt(n, st.precision ?? 0) : "—";
    const spark = st.spark
      ? `<span class="bleed">${sparkline(this._sparks?.[st.spark_entity || st.entity] || [], st.spark_color || "var(--accent)") || '<span class="spark-empty"></span>'}</span>`
      : "";
    return `<button class="stat card clickable ${st.spark ? "has-spark" : ""}" style="--accent:${esc(st.color || accent(i))}" ${this.act(st.tap)}>
      <span class="label"><ha-icon icon="${esc(st.icon)}"></ha-icon>${esc(st.label)}</span>
      <span class="value num">${value}${(st.unit || "").trim() === "°" ? "°" : `<span class="unit">${esc(st.unit || "")}</span>`}</span>
      <span class="sub">${this.sub(st)}</span>
      ${st.forecast ? this.forecastLines().hilo + this.forecastLines().rain : ""}
      ${spark}
    </button>`;
  }

  render() {
    return `<div class="stats">${(this._config.stats || []).map((s, i) => this.stat(s, i)).join("")}</div>`;
  }
}

// ── Attention: only what needs you, as a row of pills ─────────────────────
class HearthAttention extends HearthBase {
  static styles = `
    .row { display: flex; flex-wrap: wrap; gap: var(--h-gap-sm); }
    .pill { display: inline-flex; align-items: center; gap: var(--h-gap-sm); min-height: var(--h-control); padding: 4px 4px 4px 14px; border-radius: 999px; background: var(--h-chip); font-size: var(--h-fs-title); max-width: 100%; }
    .pill:not(:has(.do)) { padding-right: 16px; }
    .pill ha-icon { --mdc-icon-size: 18px; color: var(--accent, var(--h-muted)); }
    .pill.info { background: color-mix(in srgb, var(--accent) 16%, var(--h-card)); }
    .pill .txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pill .detail { color: var(--h-muted); }
    .pill.warn { background: color-mix(in srgb, var(--h-warn) 16%, transparent); }
    .pill.warn ha-icon { color: var(--h-warn); }
    .pill.alert { background: color-mix(in srgb, var(--h-alert) 18%, transparent); }
    .pill.alert ha-icon { color: var(--h-alert); }
    .pill.calm ha-icon { color: var(--h-good); }
    .pill.calm { color: var(--h-muted); }
    .do { height: 32px; padding: 0 12px; border-radius: 999px; background: var(--h-card); font-size: var(--h-fs-body); font-weight: 500; }
    .do:hover { background: var(--h-chip-hover); }`;

  pill(r, i = 0) {
    const detail = r.detail_entity ? stateText(this._hass, r.detail_entity) : r.detail;
    const button = r.button ? `<button class="do" ${this.act(r.button.action)}>${esc(r.button.label)}</button>` : "";
    return `<div class="pill ${esc(r.tone || "info")}" style="--accent:${esc(r.color || accent(i + 2))}" ${this.act(r.tap)} role="${r.tap ? "button" : "status"}">
      <ha-icon icon="${esc(r.icon || "mdi:information-outline")}"></ha-icon>
      <span class="txt">${esc(r.label)}${detail ? ` <span class="detail">· ${esc(detail)}</span>` : ""}</span>
      ${button}
    </div>`;
  }

  render() {
    const c = this._config;
    const items = (c.items || []).filter((r) => active(this._hass, r));
    const order = { alert: 0, warn: 1, info: 2 };
    items.sort((a, b) => (order[a.tone || "info"] ?? 2) - (order[b.tone || "info"] ?? 2));
    if (!items.length) {
      return `<div class="row"><div class="pill calm"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span class="txt">${esc(c.calm || "All calm. Nothing needs you.")}</span></div></div>`;
    }
    return `<div class="row">${items.map((r, i) => this.pill(r, i)).join("")}</div>`;
  }
}

// ── Moods: a slim row of scene buttons ────────────────────────────────────
class HearthMoods extends HearthBase {
  static styles = `
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--h-gap-sm); padding-top: var(--h-gap); }
    .title { font-size: var(--h-fs-body); color: var(--h-muted); margin-right: 4px; }
    .mood { display: inline-flex; align-items: center; gap: var(--h-gap-sm); height: 44px; padding: 0 18px 0 6px; border-radius: 999px; font-size: var(--h-fs-title); font-weight: 500;
      background: color-mix(in srgb, var(--mood-color, var(--h-warm)) 14%, var(--h-card)); box-shadow: var(--ha-card-box-shadow, none); }
    .mood:hover { background: color-mix(in srgb, var(--mood-color, var(--h-warm)) 24%, var(--h-card)); }
    .mood ha-icon { --mdc-icon-size: 18px; width: 32px; height: 32px; border-radius: 50%; justify-content: center; align-items: center; background: var(--mood-color, var(--h-warm)); color: #fff8ea; }
    .mood.quiet { background: transparent; box-shadow: inset 0 0 0 1px var(--h-chip-hover); color: var(--h-muted); }
    .mood { flex: none; }
    @container (max-width: 560px) {
      .row { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
      .row::-webkit-scrollbar { display: none; }
      .title { display: none; }
    }`;

  render() {
    const c = this._config;
    const moods = (c.moods || []).map((m) => `<button class="mood ${m.quiet ? "quiet" : ""}" style="--mood-color:${esc(m.color || "")}" ${this.act(m.action)}>
      <ha-icon icon="${esc(m.icon || "mdi:palette")}"></ha-icon>${esc(m.name)}</button>`).join("");
    return `<div class="row">${c.title ? `<span class="title">${esc(c.title)}</span>` : ""}${moods}</div>`;
  }
}

// ── Rooms: zones of rooms; thermostat and rooms share one card shape, secondary rooms stack two to a slot ──
class HearthRooms extends HearthBase {
  static styles = `
    .zone + .zone { margin-top: var(--h-gap-sm); }
    .zh { display: flex; flex-wrap: wrap; align-items: center; gap: var(--h-gap-sm); padding: var(--h-pad) 0 var(--h-gap-sm); min-height: calc(var(--h-control) + var(--h-pad)); }
    .zh .ctl { margin-left: auto; display: flex; align-items: center; gap: var(--h-gap-sm); }
    .zh .name { display: flex; align-items: center; gap: 6px; font-size: 20px; }
    .zh .name .sparkle { color: var(--h-warm); width: 14px; height: 14px; }
    .zh .name.link { cursor: pointer; }
    .zh .name ha-icon { --mdc-icon-size: 18px; color: var(--h-muted); }
    .zh .aside { font-size: var(--h-fs-body); color: var(--h-muted); }
    .zh .all { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px 0 10px; border-radius: 999px; background: var(--h-chip); font-size: var(--h-fs-body); color: var(--h-muted); }
    .zh .all:hover { background: var(--h-chip-hover); }
    .zh .all ha-icon { --mdc-icon-size: 16px; }
    .zh .all.on ha-icon { color: var(--h-warm); }
    .grid { display: grid; grid-template-columns: repeat(var(--cols, auto-fill), minmax(min(150px, 100%), 1fr)); gap: var(--h-gap); }
    .grid.fixed { grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); }
    .tstat { background: color-mix(in srgb, var(--mode) 10%, var(--h-card)); }
    .tstat .label { color: var(--h-fg); }
    .tstat .label b { color: var(--mode); font-weight: 500; }
    .steps { position: absolute; top: var(--h-pad); right: var(--h-pad); display: flex; gap: 4px; }
    .step { width: var(--h-control); height: var(--h-control); border-radius: 50%; display: grid; place-items: center; background: var(--h-chip); color: var(--h-fg); }
    .step:hover { background: var(--h-chip-hover); }
    .step ha-icon { --mdc-icon-size: 16px; }
    .room { position: relative; display: flex; flex-direction: column; gap: 2px; min-height: 128px; padding: var(--h-pad); }
    .icon { margin-bottom: auto; }
    /* unlit rooms keep a pale bubble; lit rooms fill it and warm the whole card */
    .room:not(.lit):not(.tstat) .bubble, .mini:not(.lit) .bubble { background: color-mix(in srgb, var(--accent) 22%, var(--h-card)); color: var(--accent); box-shadow: none; }
    .card.lit { background: color-mix(in srgb, var(--accent, var(--h-warm)) 16%, var(--h-card)); }
    .bulb { position: absolute; top: var(--h-pad); right: var(--h-pad); width: var(--h-control); height: var(--h-control); border-radius: 50%; display: grid; place-items: center; color: var(--h-muted); }
    .bulb:hover { background: var(--h-chip); }
    .bulb ha-icon { --mdc-icon-size: 18px; }
    .lit .bulb { color: var(--accent, var(--h-warm)); background: color-mix(in srgb, var(--accent, var(--h-warm)) 18%, transparent); }
    .room .label { margin-top: var(--h-gap); }
    .alert { color: var(--h-warn); }
    .stack { display: grid; grid-template-rows: 1fr 1fr; gap: var(--h-gap); min-width: 0; }
    .mini { display: flex; align-items: center; gap: 10px; padding: 0 var(--h-gap); min-height: 58px; min-width: 0; }
    .mini .tile { width: 32px; height: 32px; }
    .mini .tile ha-icon { --mdc-icon-size: 18px; }
    .mini .copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .mini .bulb { position: static; width: 32px; height: 32px; flex: none; }
    .mini .bulb ha-icon { --mdc-icon-size: 16px; }
    @container (max-width: 400px) {
      .grid, .grid.fixed { gap: var(--h-gap-sm); }
      .stack { gap: var(--h-gap-sm); }
      .room { min-height: 120px; }
      .steps { gap: 2px; }
      .mini { padding: 0 8px 0 var(--h-gap); }
      .mini .tile { display: none; }
    }`;

  _onClick(e) {
    if (!stepClick(this, e)) super._onClick(e);
  }
  members(lights) {
    return lights ? [...lightMembers(this._hass, lights)] : [];
  }
  thermostat(entity, name) {
    const s = this._hass.states[entity];
    if (!s) return "";
    const a = s.attributes;
    const [label, color] = MODE[s.state] || [esc(s.state), "var(--h-muted)"];
    const pending = this._pending?.[entity];
    const target = pending ?? num(a.temperature);
    const cur = num(a.current_temperature);
    const ranged = Number.isFinite(num(a.target_temp_low)) && Number.isFinite(num(a.target_temp_high));
    let title = label;
    if (s.state !== "off") {
      if (ranged) title = `<b>${label}</b> ${fmt(a.target_temp_low)}–${fmt(a.target_temp_high)}°`;
      else if (Number.isFinite(target)) title = `<b>${label}</b> to ${fmt(target)}°${pending != null ? "…" : ""}`;
    }
    const humidity = num(a.current_humidity);
    const sub = [Number.isFinite(cur) ? `${fmt(cur)}° now` : "", humidity > 0 ? `${fmt(humidity)}% humidity` : "", esc(name || "")].filter(Boolean).join(" · ");
    const canStep = s.state !== "off" && Number.isFinite(target) && !ranged;
    return `<div class="room tstat card clickable" style="--mode:${color}" role="button" ${this.act({ more_info: entity })}>
      <span class="tile icon bubble" style="--accent:${color}"><ha-icon icon="mdi:thermostat"></ha-icon></span>
      ${canStep ? `<span class="steps"><button class="step" aria-label="Cooler" data-step="${esc(entity)}|-1"><ha-icon icon="mdi:minus"></ha-icon></button><button class="step" aria-label="Warmer" data-step="${esc(entity)}|1"><ha-icon icon="mdi:plus"></ha-icon></button></span>` : ""}
      <span class="label t-title">${title}</span>
      <span class="t-body">${sub || "&nbsp;"}</span>
    </div>`;
  }
  info(r) {
    const h = this._hass;
    const members = this.members(r.lights);
    const on = members.filter((id) => h.states[id]?.state === "on").length;
    const alerts = (r.alerts || []).filter((a) => active(h, a)).map((a) => esc(a.label));
    const parts = [];
    if (r.temp && Number.isFinite(num(h.states[r.temp]?.state))) parts.push(`${fmt(h.states[r.temp].state)}°`);
    if (r.power && Number.isFinite(num(h.states[r.power]?.state))) parts.push(`${fmt(h.states[r.power].state)} W`);
    if (members.length) parts.push(on ? `${on} light${on === 1 ? "" : "s"} on` : "Lights off");
    const toggle = r.lights
      ? `<button class="bulb" aria-label="Toggle ${esc(r.name)} lights" ${this.act({ service: on ? "light.turn_off" : "light.turn_on", target: { entity_id: r.lights } })}>
          <ha-icon icon="${on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}"></ha-icon></button>`
      : "";
    const tap = this.act(r.tap || (r.path ? { navigate: r.path } : null));
    return { on, alerts, parts, toggle, tap };
  }
  room(r, n = 0) {
    const { on, alerts, parts, toggle, tap } = this.info(r);
    return `<div class="room card clickable ${on ? "lit" : ""}" style="--accent:${esc(r.color || accent(n))}" role="button" ${tap}>
      <span class="tile icon bubble"><ha-icon icon="${esc(r.icon || "mdi:door")}"></ha-icon></span>
      ${toggle}
      <span class="label t-title">${esc(r.name)}</span>
      ${alerts.length ? `<span class="alert t-body">${alerts.join(" · ")}</span>` : ""}
      <span class="t-body">${parts.join(" · ") || "&nbsp;"}</span>
    </div>`;
  }
  // Secondary rooms: same card at half height, with the same bulb toggle and a shorter summary
  mini(r, n = 0) {
    const h = this._hass;
    const { on, alerts, toggle, tap } = this.info(r);
    const parts = [];
    if (r.temp && Number.isFinite(num(h.states[r.temp]?.state))) parts.push(`${fmt(h.states[r.temp].state)}°`);
    if (r.lights) parts.push(on ? `${on} on` : "Off");
    const line = alerts.length ? `<span class="alert t-body">${alerts.join(" · ")}</span>` : `<span class="t-body">${parts.join(" · ") || "&nbsp;"}</span>`;
    return `<div class="mini card clickable ${on ? "lit" : ""}" style="--accent:${esc(r.color || accent(n))}" role="button" ${tap}>
      <span class="tile bubble"><ha-icon icon="${esc(r.icon || "mdi:door")}"></ha-icon></span>
      <span class="copy"><span class="t-title">${esc(r.name)}</span>${line}</span>
      ${toggle}
    </div>`;
  }
  cells(z) {
    return (z.climate ? 1 : 0) + z.rooms.filter((r) => !r.secondary).length + Math.ceil(z.rooms.filter((r) => r.secondary).length / 2);
  }
  grid(rooms, lead = "") {
    const cells = lead ? [lead] : [];
    let pair = [];
    const n = this._accentStart || 0;
    rooms.forEach((r, i) => {
      if (!r.secondary) { cells.push(this.room(r, n + i)); return; }
      pair.push([r, n + i]);
      if (pair.length === 2) { cells.push(`<div class="stack">${pair.map(([x, k]) => this.mini(x, k)).join("")}</div>`); pair = []; }
    });
    if (pair.length) cells.push(`<div class="stack">${this.mini(...pair[0])}</div>`);
    return `<div class="grid ${this._cols ? "fixed" : ""}">${cells.join("")}</div>`;
  }
  zone(z) {
    const h = this._hass;
    const groups = z.rooms.map((r) => r.lights).filter(Boolean);
    const all = new Set(groups.flatMap((g) => this.members(g)));
    const on = [...all].filter((id) => h.states[id]?.state === "on").length;
    const nav = z.navigate ? { navigate: z.navigate } : null;
    const toggle = groups.length
      ? `<button class="all ${on ? "on" : ""}" ${this.act({ service: on ? "light.turn_off" : "light.turn_on", target: { entity_id: groups } })}>
          <ha-icon icon="${on ? "mdi:lightbulb-group" : "mdi:lightbulb-group-outline"}"></ha-icon>${on ? "All off" : "All on"}</button>`
      : "";
    return `<div class="zone">
      <div class="zh">
        <span class="name display ${nav ? "link" : ""}" ${this.act(nav)}>${SPARKLE}${esc(z.name)}${nav ? '<ha-icon icon="mdi:chevron-right"></ha-icon>' : ""}</span>
        <span class="aside">${on ? `${on} light${on === 1 ? "" : "s"} on` : "All lights off"}</span>
        <span class="ctl">${toggle}</span>
      </div>
      ${this.grid(z.rooms, z.climate ? this.thermostat(z.climate, z.climate_name) : "")}
    </div>`;
  }
  connectedCallback() {
    this._ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const gap = w < 400 ? 8 : 12;
      const maxCols = Math.max(2, Math.floor((w + gap) / (150 + gap)));
      const n = Math.max(1, ...(this._config?.zones || []).map((z) => this.cells(z)));
      const rows = Math.ceil(n / maxCols);
      const cols = Math.min(maxCols, Math.ceil(n / rows));
      if (cols !== this._cols) { this._cols = cols; this.style.setProperty("--cols", cols); this._html = ""; this._update(); }
    });
    this._ro.observe(this);
  }
  disconnectedCallback() { this._ro?.disconnect(); }
  render() {
    const c = this._config;
    if (c.zones) {
      this._accentStart = 0;
      return c.zones.map((z) => { const html = this.zone(z); this._accentStart += z.rooms.length; return html; }).join("");
    }
    return this.grid(c.rooms || []);
  }
}

// ── Today: next event, plus (with timeline: true) a 24-hour day/night ribbon ──
class HearthToday extends HearthBase {
  static styles = `
    .today { display: grid; grid-template-columns: minmax(200px, 320px) minmax(0, 1fr); gap: 24px; align-items: center; padding: var(--h-pad); }
    .today.solo { grid-template-columns: minmax(0, 1fr); }
    .next { min-width: 0; display: flex; align-items: center; gap: var(--h-gap); }
    .next .tile { --accent: ${MCM.teal}; }
    .next.soon .tile { --accent: ${MCM.tangerine}; }
    .copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .next.soon .eyebrow { color: var(--h-warm); }
    .title.none { color: var(--h-muted); font-weight: 400; }
    .ribbon { position: relative; height: 64px; min-width: 0; }
    .track { position: absolute; left: 0; right: 0; top: 22px; height: 16px; border-radius: 8px; overflow: hidden; background: var(--h-chip); }
    .seg { position: absolute; top: 0; bottom: 0; }
    .seg.day { background: color-mix(in srgb, var(--h-warm) 30%, transparent); }
    .seg.night { background: color-mix(in srgb, var(--h-night) 32%, transparent); }
    .ev { position: absolute; top: 22px; height: 16px; min-width: 16px; border-radius: 8px; background: var(--h-fg); box-shadow: 0 0 0 3px var(--h-card); opacity: .9; }
    .ev.first { background: var(--h-warm); opacity: 1; }
    .now { position: absolute; left: 0; top: 20px; width: 4px; height: 20px; border-radius: 2px; background: var(--h-fg); }
    .sun { position: absolute; top: 0; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; }
    .sun ha-icon { --mdc-icon-size: 15px; }
    .sun.set ha-icon { color: var(--h-warm); }
    .sun.rise ha-icon { color: var(--h-warm); }
    .tick { position: absolute; top: 44px; transform: translateX(-50%); font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; }
    .tick.edge-l { transform: none; }
    .tick.edge-r, .sun.edge-r { transform: translateX(-100%); }
    .sun.edge-l { transform: none; }
    @container (max-width: 640px) {
      .today { grid-template-columns: 1fr; gap: var(--h-pad); }
      .tick.minor { display: none; }
    }`;

  connectedCallback() {
    this._timer = setInterval(() => this._load(), 15 * 60e3);
    this._tick = setInterval(() => this._update(), 60e3);
    if (this._hass) this._load();
  }
  disconnectedCallback() { clearInterval(this._timer); clearInterval(this._tick); this._loaded = false; }
  set hass(hass) {
    this._hass = hass;
    if (!this._loaded && this.isConnected) this._load();
    this._update();
  }
  async _load() {
    if (!this._hass || !this._config) return;
    this._loaded = true;
    const start = new Date(Date.now() - 12 * 3600e3);
    const end = new Date(Date.now() + (this._config.lookahead_hours || 72) * 3600e3);
    const results = await Promise.all((this._config.calendars || []).map(async (c) => {
      try {
        const evs = await this._hass.callApi("GET", `calendars/${c.entity}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
        return evs.map((e) => ({ title: e.summary, icon: c.icon, start: e.start, end: e.end }));
      } catch (e) {
        console.warn("hearth-today: calendar unavailable", c.entity, e);
        return [];
      }
    }));
    this._events = results.flat().map((e) => {
      const allDay = !!e.start.date;
      return {
        ...e, allDay,
        at: allDay ? new Date(`${e.start.date}T00:00:00`) : new Date(e.start.dateTime),
        until: allDay ? new Date(`${e.end.date}T00:00:00`) : new Date(e.end.dateTime),
      };
    }).sort((a, b) => a.at - b.at);
    this._update();
  }
  when(e) {
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const day = sameDay(e.at, now) ? "Today" : sameDay(e.at, tomorrow) ? "Tomorrow" : e.at.toLocaleDateString(undefined, { weekday: "long" });
    return e.allDay ? `${day}, all day` : `${day} at ${clock(e.at)}`;
  }
  relative(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return `in ${m} min`;
    const h = Math.round(m / 60);
    return h < 24 ? `in ${h} hour${h === 1 ? "" : "s"}` : "";
  }
  render() {
    const now = Math.floor(Date.now() / 60000) * 60000;
    const span = (this._config.hours || 24) * 3600e3;
    const end = now + span;
    const pos = (t) => Math.round(Math.max(0, Math.min(100, ((t - now) / span) * 100)) * 100) / 100;
    const events = (this._events || []).filter((e) => e.until > now);
    const rightNow = Date.now();

    // left: the next thing on the calendar
    const next = events[0];
    let left;
    if (next) {
      const ongoing = next.at <= rightNow;
      const soon = ongoing || next.at - rightNow <= 60 * 60e3;
      const eyebrow = ongoing ? `Now · until ${clock(next.until)}` : "Next up";
      const rel = ongoing ? "" : this.relative(next.at - rightNow);
      const more = events.length - 1;
      const meta = [ongoing ? "" : this.when(next), rel, more > 0 ? `${more} more` : ""].filter(Boolean).join(" · ");
      left = `<div class="next ${soon ? "soon" : ""}">
        <span class="tile bubble"><ha-icon icon="${esc(next.icon || "mdi:calendar-blank-outline")}"></ha-icon></span>
        <span class="copy"><span class="eyebrow t-body">${esc(eyebrow)}</span><span class="title t-title">${esc(next.title)}</span>${meta ? `<span class="t-body">${esc(meta)}</span>` : ""}</span>
      </div>`;
    } else if (!this._events) {
      left = `<div class="next">
        <span class="tile"><ha-icon icon="mdi:calendar-blank-outline"></ha-icon></span>
        <span class="copy"><span class="eyebrow t-body">Next up</span><span class="title none t-title">Checking the calendar…</span></span>
      </div>`;
    } else {
      left = `<div class="next">
        <span class="tile"><ha-icon icon="mdi:calendar-check-outline"></ha-icon></span>
        <span class="copy"><span class="eyebrow t-body">Next ${Math.round(span / 3600e3)} hours</span><span class="title none t-title">${esc(this._config.empty || "Nothing on the calendar")}</span></span>
      </div>`;
    }

    if (!this._config.timeline) return `<div class="today solo card">${left}</div>`;

    // right: day and night across the window
    const sun = this._hass.states["sun.sun"];
    const bounds = [["next_setting", "set"], ["next_rising", "rise"]]
      .map(([k, type]) => ({ t: Date.parse(sun?.attributes[k]), type }))
      .filter((b) => Number.isFinite(b.t) && b.t > now && b.t < end)
      .sort((a, b) => a.t - b.t);
    let day = sun?.state === "above_horizon";
    let cur = now;
    const segs = [];
    for (const b of bounds) { segs.push([cur, b.t, day]); cur = b.t; day = b.type === "rise"; }
    segs.push([cur, end, day]);
    const edge = (p) => (p < 15 ? "edge-l" : p > 85 ? "edge-r" : "");
    const segHtml = segs.map(([a, b, d]) => `<span class="seg ${d ? "day" : "night"}" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%"></span>`).join("");
    const sunHtml = bounds.map((b) => {
      const p = pos(b.t);
      return `<span class="sun ${b.type} ${edge(p)}" style="left:${p}%"><ha-icon icon="${b.type === "set" ? "mdi:weather-sunset-down" : "mdi:weather-sunset-up"}"></ha-icon>${b.type === "set" ? "Sunset" : "Sunrise"} ${esc(clock(new Date(b.t)))}</span>`;
    }).join("");

    const ticks = ['<span class="tick edge-l" style="left:0%">Now</span>'];
    const t = new Date(now); t.setMinutes(0, 0, 0); t.setHours(t.getHours() + 1);
    while (t.getHours() % 3) t.setHours(t.getHours() + 1);
    for (; t.getTime() < end; t.setHours(t.getHours() + 3)) {
      const p = pos(t.getTime());
      if (p < 7 || p > 97) continue;
      ticks.push(`<span class="tick ${t.getHours() % 6 ? "minor" : ""}" style="left:${p}%">${esc(hourOnly(t))}</span>`);
    }

    const evHtml = events.filter((e) => e.at < end).map((e, i) => {
      const a = pos(Math.max(e.at.getTime(), now));
      const b = pos(Math.min(e.until.getTime(), end));
      return `<span class="ev ${i === 0 ? "first" : ""}" title="${esc(`${e.title} · ${this.when(e)}`)}" style="left:calc(${a}% - 2px);width:calc(${Math.max(0, b - a)}% + 4px)"></span>`;
    }).join("");

    return `<div class="today card">${left}
      <div class="ribbon" aria-hidden="true">
        ${sunHtml}
        <div class="track">${segHtml}</div>
        ${evHtml}
        <span class="now"></span>
        ${ticks.join("")}
      </div>
    </div>`;
  }
}

// ── Cars: battery ring, range, and what the car is doing ──────────────────
class HearthCars extends HearthBase {
  static styles = `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--h-gap); }
    .car { display: flex; align-items: center; gap: var(--h-pad); padding: var(--h-pad); min-width: 0; background: color-mix(in srgb, var(--accent) 14%, var(--h-card)); }
    .car .t-title { font-family: var(--h-font-display); font-variation-settings: "SOFT" 100, "WONK" 1; font-weight: 600; font-size: 19px; }
    .ring { position: relative; flex: none; width: 68px; height: 68px; display: grid; place-items: center; }
    .ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    .ring .track { fill: none; stroke: var(--h-chip-hover); stroke-width: 6; }
    .ring .prog { fill: none; stroke: var(--bar); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 600ms ease; }
    .car.charging .ring .prog { animation: glow 2s ease-in-out infinite; }
    @keyframes glow { 50% { opacity: .55; } }
    .pct { font-size: var(--h-fs-title); font-weight: 500; }
    .bolt { position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--h-good); color: #0e1a12; box-shadow: 0 0 0 3px var(--h-card); }
    .bolt ha-icon { --mdc-icon-size: 14px; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .head { display: flex; align-items: baseline; gap: var(--h-gap-sm); min-width: 0; }
    .where { font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; }
    .where.moving { color: var(--h-warm); }
    .range { font-size: var(--h-fs-figure); font-weight: 500; line-height: 1.15; }
    .range small { font-size: var(--h-fs-body); font-weight: 400; color: var(--h-muted); margin-left: 4px; letter-spacing: 0; }
    .car.charging .status { color: var(--h-good); }
    .chips { flex: none; display: flex; flex-direction: column; gap: var(--h-gap-sm); align-items: flex-end; }
    .chip { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--h-chip); font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; }
    .chip ha-icon { --mdc-icon-size: 15px; }
    .chip.warn { background: color-mix(in srgb, var(--h-warn) 16%, transparent); color: var(--h-fg); }
    .chip.warn ha-icon { color: var(--h-warn); }
    @container (max-width: 400px) {
      .car { gap: var(--h-gap); }
      .ring { width: 56px; height: 56px; }
      .chip { padding: 0 7px; }
      .chip .t { display: none; }
      .chip:not(.warn) + .chip, .chips .chip:nth-child(2) { display: none; }
    }
    @media (prefers-reduced-motion: reduce) { .car.charging .ring .prog { animation: none; } }`;

  car(c, i = 0) {
    const h = this._hass;
    const level = num(h.states[c.battery]?.state);
    const charging = ["charging", "starting"].includes(h.states[c.charging]?.state);
    const plugged = h.states[c.cable]?.state === "on";
    const tracker = h.states[c.tracker]?.state;
    const driving = c.driving && h.states[c.driving]?.state === "on" && tracker !== "home";
    const where = driving ? "Driving" : tracker === "home" ? "Home" : tracker === "not_home" || !tracker ? "Away" : tracker;
    const kw = num(h.states[c.power]?.state);
    const range = num(h.states[c.range]?.state);
    const rangeUnit = h.states[c.range]?.attributes.unit_of_measurement || "mi";
    const full = c.full && Date.parse(h.states[c.full]?.state);
    let status = plugged ? "Plugged in" : "Not plugged in";
    if (charging) {
      status = `Charging${Number.isFinite(kw) && kw > 0 ? ` at ${fmt(kw, 1)} kW` : ""}`;
      if (Number.isFinite(full) && full > Date.now()) status += ` · full by ${clock(new Date(full))}`;
    } else if (driving) {
      status = "On the road";
    }
    const pct = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
    const circ = 2 * Math.PI * 28;
    const bar = level < 20 ? "var(--h-alert)" : level < 40 ? "var(--h-warn)" : "var(--h-good)";
    const lock = h.states[c.lock]?.state;
    const cabin = num(h.states[c.cabin]?.state);
    const chips = [
      lock ? `<span class="chip ${lock === "unlocked" ? "warn" : ""}"><ha-icon icon="${lock === "unlocked" ? "mdi:lock-open-variant-outline" : "mdi:lock-outline"}"></ha-icon><span class="t">${lock === "unlocked" ? "Unlocked" : "Locked"}</span></span>` : "",
      Number.isFinite(cabin) ? `<span class="chip"><ha-icon icon="mdi:car-seat-heater"></ha-icon><span class="t">${fmt(cabin)}° inside</span></span>` : "",
    ].join("");
    return `<div class="car card clickable ${charging ? "charging" : ""}" role="button" style="--bar:${bar};--accent:${esc(c.color || accent(i + 1))}" ${this.act(c.tap || { navigate: c.path || "/house-hub/garage" })}>
      <div class="ring">
        <svg viewBox="0 0 68 68" aria-hidden="true"><circle class="track" cx="34" cy="34" r="28"></circle><circle class="prog" cx="34" cy="34" r="28" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - pct / 100)).toFixed(1)}"></circle></svg>
        <span class="pct num">${Number.isFinite(level) ? `${fmt(level)}%` : "—"}</span>
        ${charging ? '<span class="bolt"><ha-icon icon="mdi:lightning-bolt"></ha-icon></span>' : ""}
      </div>
      <div class="info">
        <div class="head"><span class="t-title">${esc(c.name)}</span><span class="where ${driving ? "moving" : ""}">${esc(where)}</span></div>
        <div class="range num">${Number.isFinite(range) ? fmt(range) : "—"}<small>${esc(rangeUnit)} range</small></div>
        <div class="status t-body">${esc(status)}</div>
      </div>
      ${chips ? `<div class="chips">${chips}</div>` : ""}
    </div>`;
  }
  render() {
    return `<div class="grid h-fill">${(this._config.cars || []).map((c, i) => this.car(c, i)).join("")}</div>`;
  }
}

// ── Heading: one section label style for the whole dashboard ──────────────
class HearthHeading extends HearthBase {
  static styles = `
    .h { display: flex; align-items: center; gap: 6px; padding-top: var(--h-pad); font-size: 20px; }
    .h .sparkle { color: var(--h-warm); width: 14px; height: 14px; }
    .h.link { cursor: pointer; width: fit-content; }
    .h ha-icon { --mdc-icon-size: 18px; color: var(--h-muted); }
    .h .aside { font-weight: 400; color: var(--h-muted); margin-left: 8px; font-size: var(--h-fs-body); }`;
  render() {
    const c = this._config;
    const tap = c.navigate ? { navigate: c.navigate } : null;
    let aside = c.aside;
    if (c.lights) {
      const ids = new Set([].concat(c.lights).flatMap((g) => [...lightMembers(this._hass, g)]));
      const on = [...ids].filter((id) => this._hass.states[id]?.state === "on").length;
      aside = on ? `${on} light${on === 1 ? "" : "s"} on` : "All lights off";
    }
    return `<div class="h display ${tap ? "link" : ""}" ${this.act(tap)}>${SPARKLE}${esc(c.title)}${tap ? '<ha-icon icon="mdi:chevron-right"></ha-icon>' : ""}${aside ? `<span class="aside">${esc(aside)}</span>` : ""}</div>`;
  }
}

// ── Climate: thermostats in the same shape as the cars ─────────────────────
class HearthClimate extends HearthBase {
  static styles = `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--h-gap); }
    .tstat { display: flex; align-items: center; gap: var(--h-pad); padding: var(--h-pad); min-width: 0; background: color-mix(in srgb, var(--mode) 10%, var(--h-card)); }
    .ring { position: relative; flex: none; width: 68px; height: 68px; display: grid; place-items: center; }
    .ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    .ring .track { fill: none; stroke: var(--h-chip-hover); stroke-width: 6; }
    .ring .prog { fill: none; stroke: var(--mode); stroke-width: 6; stroke-linecap: round; }
    .ring .target { fill: var(--h-card); stroke: var(--h-fg); stroke-width: 2.5; }
    .cur { font-size: var(--h-fs-title); font-weight: 500; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .head { display: flex; align-items: baseline; gap: var(--h-gap-sm); min-width: 0; }
    .mode { font-size: var(--h-fs-body); color: var(--mode); white-space: nowrap; }
    .set { font-size: var(--h-fs-figure); font-weight: 500; line-height: 1.15; }
    .set small { font-size: var(--h-fs-body); font-weight: 400; color: var(--h-muted); margin-left: 4px; letter-spacing: 0; }
    .steps { flex: none; display: flex; flex-direction: column; gap: var(--h-gap-sm); }
    .step { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--h-chip); color: var(--h-fg); }
    .step:hover { background: var(--h-chip-hover); }
    .step ha-icon { --mdc-icon-size: 18px; }
    .tstat.off .set { color: var(--h-muted); }
    @container (max-width: 400px) { .tstat { gap: var(--h-gap); } .ring { width: 56px; height: 56px; } }`;

  constructor() { super(); this._pending = {}; this._timers = {}; }
  _onClick(e) {
    if (!stepClick(this, e)) super._onClick(e);
  }
  tstat(t) {
    const s = this._hass.states[t.entity];
    if (!s) return "";
    const a = s.attributes;
    const [modeLabel, color] = MODE[s.state] || [esc(s.state), "var(--h-muted)"];
    const cur = num(a.current_temperature);
    const pending = this._pending?.[t.entity];
    const target = pending ?? num(a.temperature);
    const range = Number.isFinite(num(a.target_temp_low)) && Number.isFinite(num(a.target_temp_high));
    const lo = t.scale_min ?? 60, hi = t.scale_max ?? 85;
    const frac = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    const circ = 2 * Math.PI * 28;
    const angle = Number.isFinite(target) ? frac(target) * 2 * Math.PI : null;
    const dot = angle == null ? "" : `<circle class="target" cx="${(34 + 28 * Math.cos(angle)).toFixed(1)}" cy="${(34 + 28 * Math.sin(angle)).toFixed(1)}" r="5"></circle>`;
    const humidity = num(this._hass.states[t.humidity]?.state ?? a.current_humidity);
    let set, small;
    if (s.state === "off") { set = "Off"; small = ""; }
    else if (range) { set = `${fmt(a.target_temp_low)}–${fmt(a.target_temp_high)}°`; small = "range"; }
    else if (Number.isFinite(target)) { set = `${fmt(target)}°`; small = pending != null ? "setting…" : "target"; }
    else { set = "—"; small = ""; }
    const status = [humidity > 0 ? `${fmt(humidity)}% humidity` : "", a.fan_mode ? `Fan ${String(a.fan_mode).toLowerCase()}` : "", a.preset_mode && a.preset_mode !== "none" ? esc(a.preset_mode) : ""].filter(Boolean).join(" · ");
    const steps = s.state !== "off" && !range && Number.isFinite(target)
      ? `<div class="steps"><button class="step" aria-label="Warmer" data-step="${esc(t.entity)}|1"><ha-icon icon="mdi:plus"></ha-icon></button><button class="step" aria-label="Cooler" data-step="${esc(t.entity)}|-1"><ha-icon icon="mdi:minus"></ha-icon></button></div>`
      : "";
    return `<div class="tstat card clickable ${s.state === "off" ? "off" : ""}" style="--mode:${color}" role="button" ${this.act({ more_info: t.entity })}>
      <div class="ring">
        <svg viewBox="0 0 68 68" aria-hidden="true"><circle class="track" cx="34" cy="34" r="28"></circle><circle class="prog" cx="34" cy="34" r="28" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - (Number.isFinite(cur) ? frac(cur) : 0))).toFixed(1)}"></circle>${dot}</svg>
        <span class="cur num">${Number.isFinite(cur) ? `${fmt(cur)}°` : "—"}</span>
      </div>
      <div class="info">
        <div class="head"><span class="t-title">${esc(t.name || a.friendly_name)}</span><span class="mode">${modeLabel}</span></div>
        <div class="set num">${set}${small ? `<small>${small}</small>` : ""}</div>
        <div class="t-body">${status || "&nbsp;"}</div>
      </div>
      ${steps}
    </div>`;
  }
  render() {
    return `<div class="grid h-fill">${(this._config.thermostats || []).map((t) => this.tstat(t)).join("")}</div>`;
  }
}

// ── Panels: a row of compact panels (cars, cats, to-do) ───────────────────
const LITTER = {
  rdy: "Ready", ccp: "Cleaning", ccc: "Clean cycle done", ec: "Emptying", cd: "Cat detected", p: "Paused", off: "Off", offline: "Offline",
  pwru: "Powering up", pwrd: "Powering down", br: "Bonnet removed", df1: "Drawer almost full", df2: "Drawer almost full", dfs: "Drawer full",
  sdf: "Drawer full", csf: "Cat sensor fault", csi: "Cat sensor interrupted", cst: "Cat sensor timing", scf: "Cat sensor fault",
  dhf: "Dump position fault", dpf: "Dump position fault", hpf: "Home position fault", otf: "Motor overloaded", pd: "Pinch detected", spf: "Pinch detected",
};
class HearthPanels extends HearthBase {
  static styles = `
    .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--h-gap); padding-top: var(--h-pad); }
    :host([in-grid]) .panels { padding-top: 0; }
    .panel { display: flex; flex-direction: column; gap: var(--h-gap); padding: var(--h-pad); min-width: 0; }
    .ph { display: flex; align-items: center; gap: var(--h-gap); min-height: var(--h-control); }
    .ph .copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ph .go { color: var(--h-muted); }
    .ph.link { cursor: pointer; }
    .rows { display: flex; flex-direction: column; }
    .row { display: flex; align-items: center; gap: var(--h-gap); padding: 10px 0; min-width: 0; }
    .row + .row { border-top: 1px solid var(--h-chip); }
    .row.link { cursor: pointer; }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .head { display: flex; align-items: baseline; gap: var(--h-gap-sm); min-width: 0; }
    .muted { color: var(--h-muted); font-size: var(--h-fs-body); white-space: nowrap; }
    .moving { color: var(--h-warm); }
    .ring { position: relative; flex: none; width: 48px; height: 48px; display: grid; place-items: center; }
    .ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    .ring .track { fill: none; stroke: var(--h-chip-hover); stroke-width: 5; }
    .ring .prog { fill: none; stroke: var(--bar); stroke-width: 5; stroke-linecap: round; }
    .ring .pct { font-size: var(--h-fs-body); font-weight: 500; }
    .charging .ring .prog { animation: glow 2s ease-in-out infinite; }
    @keyframes glow { 50% { opacity: .55; } }
    .lock { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--h-chip); color: var(--h-muted); }
    .lock ha-icon { --mdc-icon-size: 16px; }
    .lock.open { color: var(--h-warn); background: color-mix(in srgb, var(--h-warn) 16%, transparent); }
    .meter { display: flex; flex-direction: column; gap: 6px; }
    .meter .top { display: flex; justify-content: space-between; font-size: var(--h-fs-body); }
    .meter .top span:first-child { color: var(--h-muted); }
    .bar { height: 10px; border-radius: 5px; background: var(--h-chip-hover); overflow: hidden; }
    .fill { height: 100%; border-radius: 5px; background: var(--bar); }
    .facts { display: flex; flex-wrap: wrap; gap: var(--h-gap-sm); margin-top: auto; }
    .fact { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--h-chip); font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; }
    .fact ha-icon { --mdc-icon-size: 15px; }
    .fact.good ha-icon { color: var(--h-good); }
    .fact.warn { color: var(--h-fg); background: color-mix(in srgb, var(--h-warn) 16%, transparent); }
    .fact.warn ha-icon { color: var(--h-warn); }
    .check { flex: none; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--h-chip-hover); display: grid; place-items: center; color: transparent; }
    .check:hover { box-shadow: inset 0 0 0 2px var(--h-good); color: var(--h-good); }
    .check ha-icon { --mdc-icon-size: 14px; }
    .item { font-size: var(--h-fs-title); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { font-size: var(--h-fs-body); color: var(--h-muted); padding: 10px 0; }
    .more { font-size: var(--h-fs-body); color: var(--h-muted); padding: 6px 0 0; cursor: pointer; width: fit-content; }
    .more:hover { color: var(--h-fg); }
    .add { display: flex; gap: var(--h-gap-sm); margin-top: auto; }
    .add input { flex: 1; min-width: 0; height: var(--h-control); padding: 0 14px; border: 0; border-radius: 999px; background: var(--h-chip); color: var(--h-fg); font: inherit; font-size: var(--h-fs-title); outline: none; }
    .add input::placeholder { color: var(--h-muted); }
    .add input:focus { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--h-warm) 60%, transparent); }
    .add .plus { flex: none; width: var(--h-control); height: var(--h-control); border-radius: 50%; display: grid; place-items: center; background: ${MCM.tangerine}; color: #fff8ea; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .12); }
    .add .plus:hover { filter: brightness(1.08); }
    .tile.cars { --accent: ${MCM.teal}; }
    .tile.cats { --accent: ${MCM.plum}; }
    .tile.todo { --accent: ${MCM.tangerine}; }
    .ph .t-title { font-size: 18px; }
    @media (prefers-reduced-motion: reduce) { .charging .ring .prog { animation: none; } }`;

  constructor() {
    super();
    this.shadowRoot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target?.classList?.contains("new")) { e.preventDefault(); this._addItem(e.target); }
    });
  }
  connectedCallback() { if (this._hass) this._subscribe(); }
  disconnectedCallback() { this._unsub?.then((f) => f()).catch(() => {}); this._unsub = null; }
  set hass(hass) {
    this._hass = hass;
    if (this.isConnected) this._subscribe();
    this._update();
  }
  _subscribe() {
    const t = (this._config?.panels || []).find((p) => p.type === "todo");
    if (!t || this._unsub || !this._hass) return;
    this._unsub = this._hass.connection.subscribeMessage((m) => { this._items = m.items || []; this._update(); },
      { type: "todo/item/subscribe", entity_id: t.entity });
  }
  // Keep whatever is being typed in the add field when the card redraws
  _update() {
    const input = this.shadowRoot.querySelector("input.new");
    const value = input?.value || "";
    const focused = input && this.shadowRoot.activeElement === input;
    super._update();
    const next = this.shadowRoot.querySelector("input.new");
    if (next && value) next.value = value;
    if (next && focused) next.focus();
  }
  _onClick(e) {
    const plus = e.composedPath().find((n) => n.classList?.contains?.("plus"));
    if (plus) { e.stopPropagation(); this._addItem(this.shadowRoot.querySelector("input.new")); return; }
    super._onClick(e);
  }
  _addItem(input) {
    const t = (this._config.panels || []).find((p) => p.type === "todo");
    const text = input?.value.trim();
    if (!t || !text) return;
    this._hass.callService("todo", "add_item", { item: text }, { entity_id: t.entity });
    input.value = "";
    input.focus();
  }

  header(icon, cls, title, aside, nav) {
    return `<div class="ph ${nav ? "link" : ""}" ${this.act(nav ? { navigate: nav } : null)}>
      <span class="tile bubble ${cls}"><ha-icon icon="${icon}"></ha-icon></span>
      <span class="copy"><span class="t-title display">${esc(title)}</span>${aside ? `<span class="t-body">${aside}</span>` : ""}</span>
      ${nav ? '<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>' : ""}
    </div>`;
  }

  cars(p) {
    const h = this._hass;
    const rows = (p.cars || []).map((c) => {
      const level = num(h.states[c.battery]?.state);
      const charging = ["charging", "starting"].includes(h.states[c.charging]?.state);
      const plugged = h.states[c.cable]?.state === "on";
      const tracker = h.states[c.tracker]?.state;
      const driving = c.driving && h.states[c.driving]?.state === "on" && tracker !== "home";
      const where = driving ? "Driving" : tracker === "home" ? "Home" : tracker === "not_home" || !tracker ? "Away" : tracker;
      const range = num(h.states[c.range]?.state);
      const unit = h.states[c.range]?.attributes.unit_of_measurement || "mi";
      const kw = num(h.states[c.power]?.state);
      const status = charging ? `Charging${Number.isFinite(kw) && kw > 0 ? ` at ${fmt(kw, 1)} kW` : ""}` : plugged ? "Plugged in" : "Not plugged in";
      const pct = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0;
      const circ = 2 * Math.PI * 20;
      const bar = level < 20 ? "var(--h-alert)" : level < 40 ? "var(--h-warn)" : "var(--h-good)";
      const lock = h.states[c.lock]?.state;
      return `<div class="row link ${charging ? "charging" : ""}" style="--bar:${bar}" ${this.act(c.tap || { more_info: c.battery })}>
        <span class="ring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="track" cx="24" cy="24" r="20"></circle><circle class="prog" cx="24" cy="24" r="20" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - pct / 100)).toFixed(1)}"></circle></svg><span class="pct num">${Number.isFinite(level) ? `${fmt(level)}%` : "—"}</span></span>
        <span class="grow">
          <span class="head"><span class="t-title">${esc(c.name)}</span><span class="muted ${driving ? "moving" : ""}">${esc(where)}</span></span>
          <span class="t-body">${Number.isFinite(range) ? `${fmt(range)} ${esc(unit)}` : "—"} · ${esc(status)}</span>
        </span>
        ${lock ? `<span class="lock ${lock === "unlocked" ? "open" : ""}" title="${lock === "unlocked" ? "Unlocked" : "Locked"}"><ha-icon icon="${lock === "unlocked" ? "mdi:lock-open-variant-outline" : "mdi:lock-outline"}"></ha-icon></span>` : ""}
      </div>`;
    }).join("");
    return `<div class="panel card">${this.header("mdi:car-electric-outline", "cars", p.title || "Cars", "", p.navigate)}<div class="rows">${rows}</div></div>`;
  }

  cats(p) {
    const h = this._hass;
    const code = h.states[p.status]?.state;
    const status = LITTER[code] || (code ? esc(code) : "—");
    const healthy = ["rdy", "ccc", "ccp", "ec", "cd"].includes(code);
    const meter = (label, id, warnAbove, warnBelow) => {
      const v = num(h.states[id]?.state);
      const bad = (warnAbove != null && v > warnAbove) || (warnBelow != null && v < warnBelow);
      return `<div class="meter" style="--bar:${bad ? "var(--h-warn)" : MCM.plum}">
        <div class="top"><span>${esc(label)}</span><span class="num">${Number.isFinite(v) ? `${fmt(v)}%` : "—"}</span></div>
        <div class="bar"><div class="fill" style="width:${Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0}%"></div></div>
      </div>`;
    };
    const hopper = h.states[p.hopper]?.state;
    const weight = num(h.states[p.weight]?.state);
    const wUnit = h.states[p.weight]?.attributes.unit_of_measurement || "lb";
    const facts = [
      `<span class="fact ${healthy ? "good" : "warn"}"><ha-icon icon="${healthy ? "mdi:check-circle-outline" : "mdi:alert-circle-outline"}"></ha-icon>${status}</span>`,
      hopper ? `<span class="fact ${hopper === "empty" ? "warn" : ""}"><ha-icon icon="mdi:archive-outline"></ha-icon>${hopper === "empty" ? "Hopper empty" : hopper === "enabled" ? "Hopper OK" : esc(hopper)}</span>` : "",
      Number.isFinite(weight) ? `<span class="fact"><ha-icon icon="mdi:scale"></ha-icon>${fmt(weight, 1)} ${esc(wUnit)}</span>` : "",
    ].join("");
    return `<div class="panel card">${this.header("mdi:cat", "cats", p.title || "Cats", esc(p.subtitle || "Litter-Robot"), p.navigate)}
      ${meter("Waste drawer", p.drawer, 79, null)}
      ${meter("Litter level", p.litter, null, 25)}
      <div class="facts">${facts}</div>
    </div>`;
  }

  todo(p) {
    const open = (this._items || []).filter((i) => i.status === "needs_action");
    const max = p.max || 5;
    const shown = open.slice(0, max);
    const aside = this._items ? (open.length ? `${open.length} to do` : "All done") : "Loading…";
    const rows = shown.map((i) => `<div class="row">
        <button class="check" aria-label="Mark ${esc(i.summary)} done" ${this.act({ service: "todo.update_item", data: { item: i.uid, status: "completed" }, target: { entity_id: p.entity } })}><ha-icon icon="mdi:check"></ha-icon></button>
        <span class="item">${esc(i.summary)}</span>
      </div>`).join("");
    const more = open.length > max ? `<span class="more" ${this.act({ navigate: `/todo?entity_id=${p.entity}` })}>${open.length - max} more</span>` : "";
    return `<div class="panel card">${this.header("mdi:format-list-checks", "todo", p.title || "To-do", aside, `/todo?entity_id=${p.entity}`)}
      <div class="rows">${rows || (this._items ? '<div class="empty">Nothing on the list</div>' : "")}</div>
      ${more}
      <div class="add"><input class="new" type="text" placeholder="${esc(p.placeholder || "Add an item")}" aria-label="Add an item" enterkeyhint="done"><button class="plus" aria-label="Add"><ha-icon icon="mdi:plus"></ha-icon></button></div>
    </div>`;
  }

  render() {
    const html = (this._config.panels || []).map((p) => (p.type === "cars" ? this.cars(p) : p.type === "cats" ? this.cats(p) : p.type === "todo" ? this.todo(p) : "")).join("");
    return `<div class="panels h-fill">${html}</div>`;
  }
}

// ── Entity tiles: one renderer for every kind of entity, shared by any card that lists devices ──
const DOMAIN_ICON = {
  light: "mdi:lightbulb", switch: "mdi:toggle-switch-variant", fan: "mdi:fan", input_boolean: "mdi:toggle-switch-variant",
  media_player: "mdi:television", scene: "mdi:palette", script: "mdi:script-text-play", button: "mdi:gesture-tap-button",
  input_button: "mdi:gesture-tap-button", lock: "mdi:lock", climate: "mdi:thermostat", vacuum: "mdi:robot-vacuum",
  schedule: "mdi:calendar-clock", input_select: "mdi:format-list-bulleted", cover: "mdi:window-shutter",
  device_tracker: "mdi:map-marker", person: "mdi:account", binary_sensor: "mdi:radiobox-marked", sensor: "mdi:eye",
};
const CLASS_ICON = {
  power: "mdi:flash", energy: "mdi:lightning-bolt", temperature: "mdi:thermometer", humidity: "mdi:water-percent",
  motion: "mdi:motion-sensor", occupancy: "mdi:home-account", door: "mdi:door", window: "mdi:window-closed-variant",
  duration: "mdi:timer-outline", monetary: "mdi:currency-usd", running: "mdi:play-circle-outline", timestamp: "mdi:clock-outline",
};
const TOGGLES = new Set(["light", "switch", "fan", "input_boolean"]);
const domainOf = (id) => id.split(".")[0];
// Strip the room or device name off the front, and measurement words off the end, so tiles read "Floor lights", not "Living Room Floor Lights"
function shortName(s, prefix) {
  let n = String(s.attributes.friendly_name || s.entity_id);
  if (prefix) {
    const p = prefix.toLowerCase();
    while (n.toLowerCase().startsWith(p + " ")) n = n.slice(p.length + 1);
  }
  n = n.replace(/\s+(power|energy)\b.*$/i, "");
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function entityIcon(s, cfg = {}) {
  if (cfg.icon) return cfg.icon;
  const d = domainOf(s.entity_id), dc = s.attributes.device_class;
  if (s.attributes.icon) return s.attributes.icon;
  if (dc === "battery") {
    const v = num(s.state);
    return !Number.isFinite(v) ? "mdi:battery-unknown" : v < 10 ? "mdi:battery-alert-variant-outline" : `mdi:battery-${Math.min(90, Math.max(10, Math.round(v / 10) * 10))}`;
  }
  if (d === "light") return s.state === "on" ? "mdi:lightbulb-on" : "mdi:lightbulb-outline";
  if (d === "lock") return s.state === "unlocked" ? "mdi:lock-open-variant" : "mdi:lock";
  return CLASS_ICON[dc] || DOMAIN_ICON[d] || "mdi:circle-medium";
}
function entityActive(s) {
  const d = domainOf(s.entity_id);
  if (d === "lock") return s.state === "unlocked";
  if (d === "media_player") return s.state === "playing";
  if (d === "climate") return s.state !== "off";
  if (d === "vacuum") return s.state === "cleaning";
  return s.state === "on";
}
function entityText(hass, s) {
  const d = domainOf(s.entity_id), a = s.attributes;
  if (d === "light" && s.state === "on" && a.brightness) return `On · ${Math.round((a.brightness / 255) * 100)}%`;
  if (d === "media_player" && s.state === "playing" && a.media_title) return a.media_title;
  if (d === "climate") {
    const action = HVAC[a.hvac_action] || HVAC_MODE[s.state] || stateText(hass, s.entity_id);
    return s.state === "off" || a.temperature == null ? action : `${action} to ${fmt(a.temperature)}°`;
  }
  return stateText(hass, s.entity_id);
}
function entityAction(s, cfg = {}) {
  if (cfg.tap) return cfg.tap;
  const d = domainOf(s.entity_id), target = { entity_id: s.entity_id };
  if (TOGGLES.has(d)) return { service: "homeassistant.toggle", target };
  if (d === "scene") return { service: "scene.turn_on", target };
  if (d === "script") return { service: "script.turn_on", target };
  if (d === "button" || d === "input_button") return { service: `${d}.press`, target };
  if (d === "lock") return s.state === "locked" ? { service: "lock.unlock", target, confirm: `Unlock ${s.attributes.friendly_name}?` } : { service: "lock.lock", target };
  return { more_info: s.entity_id };
}
const asEntity = (e) => (typeof e === "string" ? { entity: e } : e);
function entityTile(card, raw, prefix) {
  const cfg = asEntity(raw);
  const s = card._hass.states[cfg.entity];
  if (!s) return "";
  const on = entityActive(s);
  const warn = domainOf(s.entity_id) === "lock" && on;
  const run = ["scene", "script", "button", "input_button"].includes(domainOf(s.entity_id));
  return `<button class="et ${on ? "on" : ""} ${warn ? "warn" : ""} ${run ? "run" : ""}" ${cfg.color ? `style="--accent:${esc(cfg.color)}"` : ""} ${card.act(entityAction(s, cfg))}>
    <span class="tile bubble"><ha-icon icon="${esc(entityIcon(s, cfg))}"></ha-icon></span>
    <span class="copy"><span class="t-title">${esc(cfg.name || shortName(s, prefix))}</span><span class="t-body">${esc(run ? "Tap to run" : entityText(card._hass, s))}</span></span>
  </button>`;
}
const TILE_CSS = `
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(184px, 100%), 1fr)); gap: var(--h-gap-sm); }
  .et { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 8px 12px 8px 8px; border-radius: 22px; background: var(--h-chip); min-width: 0; }
  .et:hover { background: var(--h-chip-hover); }
  .et .tile { width: 38px; height: 38px; }
  .et .tile ha-icon { --mdc-icon-size: 19px; }
  .et:not(.on):not(.run) .bubble { background: color-mix(in srgb, var(--accent) 22%, var(--h-card)); color: var(--accent); box-shadow: none; }
  .et.on { background: color-mix(in srgb, var(--accent) 20%, var(--h-card)); }
  .et.warn .bubble { background: var(--h-warn); }
  .et .copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .et .t-title { font-size: 14px; }
  .et .t-body { font-size: 12px; }
  /* phones keep two tiles a row rather than one long column */
  @container (max-width: 460px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } .et { gap: 8px; padding-right: 8px; } .et .tile { width: 34px; height: 34px; } }
`;
// Card header shared by groups, charts and bar lists: a colour bubble, a display title, little badges, and an optional control.
// Badges sit in the header's top-right corner, or under the title with badges_position: below
const HEAD_CSS = `
  .gh { display: flex; align-items: center; gap: var(--h-gap); min-height: var(--h-control); flex-wrap: wrap; }
  .gh .copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .gh .t-title { font-size: 19px; }
  .gh.link { cursor: pointer; }
  .gh .go { color: var(--h-muted); }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .gh .badges { flex-wrap: nowrap; margin-left: auto; }
  .badge { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--h-chip); font-size: var(--h-fs-body); color: var(--h-muted); white-space: nowrap; }
  .badge ha-icon { --mdc-icon-size: 14px; color: var(--accent); }
  .all { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px 0 10px; border-radius: 999px; background: var(--h-chip); font-size: var(--h-fs-body); color: var(--h-muted); }
  .all:hover { background: var(--h-chip-hover); }
  .all ha-icon { --mdc-icon-size: 16px; }
  .all.on ha-icon { color: var(--accent); }
`;
function cardHeader(card, c, extra = "") {
  const h = card._hass;
  const badges = (c.badges || []).map((b) => {
    const s = h.states[b.entity];
    if (!s) return "";
    return `<span class="badge" ${card.act({ more_info: b.entity })}><ha-icon icon="${esc(entityIcon(s, b))}"></ha-icon>${esc(b.text || entityText(h, s))}</span>`;
  }).join("");
  const nav = c.navigate ? { navigate: c.navigate } : null;
  const top = c.badges_position !== "below";
  return `<div class="gh ${nav ? "link" : ""}" ${card.act(nav)}>
    <span class="tile bubble"><ha-icon icon="${esc(c.icon || "mdi:shape")}"></ha-icon></span>
    <span class="copy"><span class="t-title display">${esc(c.title || "")}</span>${c.subtitle ? `<span class="t-body">${esc(c.subtitle)}</span>` : ""}</span>
    ${top && badges ? `<div class="badges">${badges}</div>` : ""}
    ${extra}
    ${nav ? '<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>' : ""}
  </div>${!top && badges ? `<div class="badges">${badges}</div>` : ""}`;
}
// Text colour that reads best on a given palette colour
function inkOn(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || "")) return ["#fff8ea", "rgba(255,248,234,.82)"];
  const l = luminance(hex(color));
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.067) ? ["#fff8ea", "rgba(255,248,234,.82)"] : ["#2e2118", "rgba(46,33,24,.72)"];
}

// ── Banner: a bold colour block that opens each tab, with a few stat bubbles ──
const SPARKLE_D = "M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z";
class HearthBanner extends HearthBase {
  static styles = `
    .banner { position: relative; isolation: isolate; overflow: hidden; border-radius: var(--h-radius); background: var(--accent); color: var(--ink);
      padding: clamp(20px, 3cqw, 32px); display: flex; flex-direction: column; gap: var(--h-pad); min-height: 172px; }
    .deco { position: absolute; right: -30px; top: 50%; transform: translateY(-50%); height: 150%; width: auto; z-index: -1; color: var(--ink); pointer-events: none; }
    .eyebrow { display: flex; align-items: center; gap: 6px; font-size: var(--h-fs-body); color: var(--ink-muted); }
    .eyebrow ha-icon { --mdc-icon-size: 16px; }
    .top { display: flex; align-items: center; gap: 12px; }
    .back { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--ink) 16%, transparent); color: var(--ink); }
    .back:hover { background: color-mix(in srgb, var(--ink) 24%, transparent); }
    .back ha-icon { --mdc-icon-size: 22px; }
    h1 { margin: 2px 0 0; font-size: clamp(32px, 4.6cqw, 54px); line-height: 1.04; }
    .sub { font-size: var(--h-fs-title); color: var(--ink-muted); max-width: 52ch; }
    .stats { display: flex; flex-wrap: wrap; gap: var(--h-gap-sm); margin-top: auto; }
    .st { display: flex; flex-direction: column; justify-content: center; min-width: 104px; padding: 10px 16px; border-radius: 22px; background: color-mix(in srgb, var(--ink) 13%, transparent); }
    .st.link { cursor: pointer; }
    .st .v { font-size: 24px; line-height: 1.15; white-space: nowrap; }
    .st .v small { font-family: var(--h-font); font-size: 13px; font-weight: 400; margin-left: 3px; color: var(--ink-muted); }
    .st .l { font-size: 12px; color: var(--ink-muted); white-space: nowrap; }
    @container (max-width: 460px) { .st { min-width: 0; flex: 1 1 40%; padding: 8px 12px; } .st .v { font-size: 20px; } .deco { opacity: .7; } }`;

  stat(st) {
    const h = this._hass;
    let value = "—", unit = st.unit || "";
    if (st.count) {
      const ids = st.expand ? [...new Set(st.count.flatMap((id) => [...lightMembers(h, id)]))] : st.count;
      value = String(ids.filter((id) => (st.below !== undefined ? num(h.states[id]?.state) < st.below : h.states[id]?.state === (st.is || "on"))).length);
    } else if (st.entity) {
      const s = h.states[st.entity];
      const n = s ? num(s.state) * (st.scale || 1) : NaN;
      if (Number.isFinite(n) && !st.text) {
        value = fmt(n, st.precision ?? 0);
        if (st.unit === undefined) unit = s.attributes.unit_of_measurement || "";
      } else if (s) {
        value = entityText(h, s);
        unit = "";
      }
    }
    const prefix = st.prefix || "";
    const tap = st.entity ? { more_info: st.entity } : null;
    return `<span class="st ${tap ? "link" : ""}" ${this.act(tap)}><span class="v display num">${esc(prefix + value)}${unit ? `<small>${esc(unit)}</small>` : ""}</span><span class="l">${esc(st.label || "")}</span></span>`;
  }
  render() {
    const c = this._config;
    const color = c.color || MCM.tangerine;
    const [ink, inkMuted] = inkOn(color);
    const deco = `<svg class="deco" viewBox="0 0 320 320" aria-hidden="true">
      <circle cx="210" cy="160" r="118" fill="currentColor" opacity=".09"></circle>
      <circle cx="96" cy="250" r="44" fill="none" stroke="currentColor" stroke-width="12" opacity=".13"></circle>
      <path d="M40 92 Q160 8 290 70 Q160 44 40 92Z" fill="currentColor" opacity=".14"></path>
      <path d="${SPARKLE_D}" fill="currentColor" opacity=".5" transform="translate(250 214) scale(1.3)"></path>
      <path d="${SPARKLE_D}" fill="currentColor" opacity=".35" transform="translate(150 130) scale(.8)"></path>
      <path d="${SPARKLE_D}" fill="currentColor" opacity=".25" transform="translate(286 120) scale(.6)"></path>
    </svg>`;
    return `<div class="banner" style="--accent:${esc(color)};--ink:${ink};--ink-muted:${inkMuted}">
      ${deco}
      <div>
        <div class="top">
          ${c.back ? `<button class="back" aria-label="Back" ${this.act({ back: c.back })}><ha-icon icon="mdi:arrow-left"></ha-icon></button>` : ""}
          ${c.eyebrow ? `<div class="eyebrow">${c.icon ? `<ha-icon icon="${esc(c.icon)}"></ha-icon>` : ""}${esc(c.eyebrow)}</div>` : ""}
        </div>
        <h1 class="display">${esc(c.title || "")}</h1>
        ${c.subtitle ? `<div class="sub">${esc(c.subtitle)}</div>` : ""}
      </div>
      ${(c.stats || []).length ? `<div class="stats">${c.stats.map((s) => this.stat(s)).join("")}</div>` : ""}
    </div>`;
  }
}

// ── Group: a titled card of entity tiles, with badges, an all on/off control and an optional filter ──
class HearthGroup extends HearthBase {
  static styles = HEAD_CSS + TILE_CSS + `
    .group { padding: var(--h-pad); display: flex; flex-direction: column; gap: var(--h-gap); height: 100%; }
    .empty { display: flex; align-items: center; gap: 8px; color: var(--h-muted); font-size: var(--h-fs-title); padding: 6px 2px; }
    .empty ha-icon { color: var(--h-good); }`;
  render() {
    const c = this._config, h = this._hass;
    let list = (c.entities || []).map(asEntity).filter((e) => h.states[e.entity]);
    if (c.filter) list = list.filter((e) => matches(h, { entity: e.entity, ...c.filter }));
    let control = "";
    if (c.toggle && h.states[c.toggle]) {
      const on = h.states[c.toggle].state === "on";
      control = `<button class="all ${on ? "on" : ""}" ${this.act({ service: on ? "homeassistant.turn_off" : "homeassistant.turn_on", target: { entity_id: c.toggle } })}>
        <ha-icon icon="${on ? "mdi:lightbulb-group" : "mdi:lightbulb-group-outline"}"></ha-icon>${on ? "All off" : "All on"}</button>`;
    }
    const tiles = list.length
      ? `<div class="tiles">${list.map((e) => entityTile(this, e, c.strip ?? c.title)).join("")}</div>`
      : `<div class="empty"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${esc(c.empty || "Nothing to show")}</div>`;
    return `<div class="group card h-fill" style="--accent:${esc(c.color || MCM.tangerine)}">${cardHeader(this, c, control)}${tiles}</div>`;
  }
}

// ── Chart: the last day as soft lines, or daily totals as rounded columns ──
class HearthChart extends HearthBase {
  static styles = HEAD_CSS + `
    .chart { padding: var(--h-pad); display: flex; flex-direction: column; gap: var(--h-gap); }
    .plot { position: relative; flex: 1; min-height: var(--plot-h, 200px); margin-top: 14px; }
    .plot svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
    .plot .rule { stroke: var(--h-chip-hover); stroke-width: 1; stroke-dasharray: 2 4; }
    .ylab { position: absolute; left: 0; font-size: 11px; color: var(--h-muted); transform: translateY(-120%); }
    .ylab.low { top: auto; bottom: 0; transform: translateY(120%); }
    .axis { display: flex; justify-content: space-between; font-size: 12px; color: var(--h-muted); }
    .legend { display: flex; flex-wrap: wrap; gap: 6px; }
    .key { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 8px; border-radius: 999px; background: color-mix(in srgb, var(--c) 14%, var(--h-card)); font-size: 13px; cursor: pointer; }
    .key i { width: 12px; height: 12px; border-radius: 50%; background: var(--c); }
    .key b { font-weight: 600; }
    .cols { flex: 1; display: flex; align-items: stretch; gap: 6px; min-height: var(--plot-h, 180px); }
    .col { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; }
    .col .b { width: 100%; max-width: 34px; min-height: 8px; border-radius: 999px 999px 10px 10px; background: color-mix(in srgb, var(--accent) 72%, var(--h-card)); }
    .col.today .b { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); }
    .col .d { font-size: 11px; color: var(--h-muted); }
    .col.today .d { color: var(--h-fg); font-weight: 600; }
    .loading { height: var(--plot-h, 180px); display: grid; place-items: center; color: var(--h-muted); }`;

  connectedCallback() { this._timer = setInterval(() => this._load(), 10 * 60e3); if (this._hass) this._load(); }
  disconnectedCallback() { clearInterval(this._timer); this._loaded = false; }
  set hass(hass) { this._hass = hass; if (!this._loaded && this.isConnected) this._load(); this._update(); }
  async _load() {
    if (!this._hass || !this._config) return;
    this._loaded = true;
    const c = this._config;
    try {
      if (c.kind === "daily") {
        const id = c.statistic || asEntity(c.entities[0]).entity;
        const days = c.days || 14;
        const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
        const r = await this._hass.callWS({ type: "recorder/statistics_during_period", start_time: start.toISOString(), statistic_ids: [id], period: "day", types: ["change"] });
        this._daily = (r[id] || []).map((row) => ({ at: new Date(row.start), v: num(row.change) })).filter((d) => Number.isFinite(d.v));
      } else {
        const hours = c.hours || 24;
        const ids = c.entities.map((e) => asEntity(e).entity);
        const hist = await fetchHistory(this._hass, ids, hours);
        this._series = Object.fromEntries(ids.map((id) => [id, bucket(hist[id] || [], hours, 96)]));
      }
      this._update();
    } catch (e) {
      console.warn("hearth-chart: data unavailable", e);
    }
  }
  lines() {
    const c = this._config, h = this._hass;
    const list = c.entities.map(asEntity);
    if (!this._series) return `<div class="loading">Drawing the chart…</div>`;
    const all = list.flatMap((e) => this._series[e.entity] || []);
    const max = c.fit ? Math.max(...all) : Math.max(1, ...all);
    const min = c.fit ? Math.min(...all) : 0;
    const span = max - min || 1;
    const y = (v) => (100 - ((v - min) / span) * (c.fit ? 88 : 94) - (c.fit ? 4 : 0)).toFixed(2);
    const paths = list.map((e, i) => {
      const vals = this._series[e.entity] || [];
      if (vals.length < 2) return "";
      const color = e.color || accent(i);
      const pts = vals.map((v, k) => `${((k / (vals.length - 1)) * 100).toFixed(2)},${y(v)}`).join(" ");
      return `<polygon points="0,100 ${pts} 100,100" style="fill:${color};opacity:${i ? 0.08 : 0.16}"></polygon>
        <polyline points="${pts}" style="fill:none;stroke:${color};stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round" vector-effect="non-scaling-stroke"></polyline>`;
    }).join("");
    const unit = h.states[list[0].entity]?.attributes.unit_of_measurement || "";
    const top = unit === "W" && max >= 1000 ? `${fmt(max / 1000, 1)} kW` : `${fmt(max)} ${unit}`;
    const bottom = c.fit ? `<span class="ylab low">${esc(`${fmt(min)} ${unit}`)}</span>` : "";
    const legend = list.map((e, i) => {
      const s = h.states[e.entity];
      if (!s) return "";
      const n = num(s.state);
      const now = unit === "W" && Number.isFinite(n) ? (n >= 1000 ? `${fmt(n / 1000, 1)} kW` : `${fmt(n)} W`) : entityText(h, s);
      return `<span class="key" style="--c:${esc(e.color || accent(i))}" ${this.act({ more_info: e.entity })}><i></i>${esc(e.name || shortName(s))} <b>${esc(now)}</b></span>`;
    }).join("");
    const hours = c.hours || 24;
    return `<div class="plot"><span class="ylab">${esc(top)}</span>${bottom}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line class="rule" x1="0" y1="6" x2="100" y2="6" vector-effect="non-scaling-stroke"></line>
          <line class="rule" x1="0" y1="53" x2="100" y2="53" vector-effect="non-scaling-stroke"></line>
          ${paths}
        </svg></div>
      <div class="axis"><span>${hours} hours ago</span><span>${Math.round(hours / 2)} hours ago</span><span>Now</span></div>
      <div class="legend">${legend}</div>`;
  }
  columns() {
    if (!this._daily) return `<div class="loading">Adding up the days…</div>`;
    const days = this._daily;
    const max = Math.max(1, ...days.map((d) => d.v));
    const unit = this._config.unit || "kWh";
    const today = new Date();
    const cols = days.map((d) => {
      const isToday = sameDay(d.at, today);
      const label = d.at.toLocaleDateString(undefined, { weekday: "narrow" });
      return `<span class="col ${isToday ? "today" : ""}" title="${esc(`${d.at.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${fmt(d.v, 1)} ${unit}`)}">
        <span class="b" style="height:${Math.max(4, (d.v / max) * 100).toFixed(1)}%"></span><span class="d">${esc(label)}</span></span>`;
    }).join("");
    return `<div class="cols">${cols}</div>`;
  }
  render() {
    const c = this._config;
    let sub = c.subtitle;
    if (c.kind === "daily" && this._daily?.length) {
      const past = this._daily.filter((d) => !sameDay(d.at, new Date()));
      const avg = past.length ? past.reduce((a, d) => a + d.v, 0) / past.length : NaN;
      if (Number.isFinite(avg)) sub = `About ${fmt(avg)} ${c.unit || "kWh"} a day`;
    }
    return `<div class="chart card h-fill" style="--accent:${esc(c.color || MCM.mustard)};${c.height ? `--plot-h:${Number(c.height)}px` : ""}">
      ${cardHeader(this, { ...c, subtitle: sub })}
      ${c.kind === "daily" ? this.columns() : this.lines()}
    </div>`;
  }
}

// ── Bars: a ranked list, each row a fat rounded bar in its own colour ──
class HearthBars extends HearthBase {
  static styles = HEAD_CSS + `
    .bars { padding: var(--h-pad); display: flex; flex-direction: column; gap: var(--h-gap); }
    .rows { display: flex; flex-direction: column; gap: 10px; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; cursor: pointer; }
    .row .n { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row .v { font-size: 14px; font-weight: 600; text-align: right; }
    .track { grid-column: 1 / -1; height: 14px; border-radius: 999px; background: var(--h-chip); overflow: hidden; }
    .fill { height: 100%; border-radius: 999px; background: var(--c); min-width: 14px; }`;
  render() {
    const c = this._config, h = this._hass;
    const rows = (c.entities || []).map(asEntity).map((e) => ({ e, s: h.states[e.entity] })).filter((r) => r.s)
      .map((r) => ({ ...r, v: num(r.s.state) })).filter((r) => Number.isFinite(r.v));
    rows.sort((a, b) => b.v - a.v);
    const max = Math.max(1e-9, ...rows.map((r) => r.v));
    const list = rows.map((r, i) => {
      const unit = r.s.attributes.unit_of_measurement || "";
      const value = unit === "W" && r.v >= 1000 ? `${fmt(r.v / 1000, 1)} kW` : `${fmt(r.v, c.precision ?? 0)} ${unit}`;
      return `<div class="row" style="--c:${esc(r.e.color || accent(i))}" ${this.act({ more_info: r.e.entity })}>
        <span class="n">${esc(r.e.name || shortName(r.s))}</span><span class="v num">${esc(value)}</span>
        <span class="track"><span class="fill" style="display:block;width:${((r.v / max) * 100).toFixed(1)}%"></span></span>
      </div>`;
    }).join("");
    return `<div class="bars card h-fill" style="--accent:${esc(c.color || MCM.teal)}">${cardHeader(this, c)}<div class="rows">${list}</div></div>`;
  }
}

// ── Nav: the page's own tab bar, standing in for Home Assistant's top bar ──
// ☰ opens the sidebar, an optional back bubble returns from a sub-page, pill tabs move between pages,
// and admins get a pencil into edit mode (where Home Assistant's own top bar comes back).
class HearthNav extends HearthBase {
  static styles = `
    .nav { display: flex; align-items: center; gap: var(--h-gap-sm); padding-top: max(var(--h-gap-sm), env(safe-area-inset-top, 0px)); min-width: 0; }
    .round { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--h-card); color: var(--h-fg); box-shadow: var(--ha-card-box-shadow, none); }
    .round:hover { background: color-mix(in srgb, var(--h-card) 88%, var(--primary-text-color)); }
    .round ha-icon { --mdc-icon-size: 22px; }
    .tabs { flex: 1; min-width: 0; display: flex; gap: var(--h-gap-sm); overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px; }
    .tabs::-webkit-scrollbar { display: none; }
    .tab { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px 0 6px; border-radius: 999px; background: var(--h-card); box-shadow: var(--ha-card-box-shadow, none); font-size: var(--h-fs-title); font-weight: 500; white-space: nowrap; }
    .tab:hover { background: color-mix(in srgb, var(--accent) 14%, var(--h-card)); }
    .tab .tile { width: 32px; height: 32px; }
    .tab .tile ha-icon { --mdc-icon-size: 18px; }
    .tab:not(.on) .bubble { background: color-mix(in srgb, var(--accent) 22%, var(--h-card)); color: var(--accent); box-shadow: none; }
    .tab.on { background: var(--accent); color: var(--ink); }
    .tab.on .bubble { background: color-mix(in srgb, var(--ink) 16%, transparent); color: var(--ink); box-shadow: none; }
    .title { flex: 1; min-width: 0; font-size: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @container (max-width: 520px) { .tab { padding: 0 14px 0 6px; } }`;

  connectedCallback() {
    this._onLoc = () => this._update();
    window.addEventListener("location-changed", this._onLoc);
    window.addEventListener("popstate", this._onLoc);
  }
  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onLoc);
    window.removeEventListener("popstate", this._onLoc);
  }
  _onClick(e) {
    const el = e.composedPath().find((n) => n.dataset && n.dataset.nav !== undefined);
    if (!el) return super._onClick(e);
    e.stopPropagation();
    const what = el.dataset.nav;
    if (what === "menu") this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
    if (what === "back") goBack(this._config.back || "/");
    if (what === "edit") navigate(`${location.pathname}?edit=1`);
  }
  render() {
    const c = this._config, h = this._hass;
    const here = location.pathname.replace(/\/$/, "");
    const tabs = (c.tabs || []).map((t, i) => {
      const color = t.color || accent(i);
      const on = here === t.path || (t.match && here.startsWith(t.match));
      const [ink] = inkOn(color);
      return `<button class="tab ${on ? "on" : ""}" style="--accent:${esc(color)};--ink:${ink}" ${on ? 'aria-current="page"' : ""} ${this.act({ navigate: t.path })}>
        <span class="tile bubble"><ha-icon icon="${esc(t.icon || "mdi:circle")}"></ha-icon></span>${esc(t.label)}</button>`;
    }).join("");
    return `<nav class="nav" aria-label="${esc(c.label || "Pages")}">
      <button class="round" data-nav="menu" aria-label="Open the sidebar"><ha-icon icon="mdi:menu"></ha-icon></button>
      ${c.back ? '<button class="round" data-nav="back" aria-label="Back"><ha-icon icon="mdi:arrow-left"></ha-icon></button>' : ""}
      ${tabs ? `<div class="tabs">${tabs}</div>` : `<span class="title display">${esc(c.title || "")}</span>`}
      ${h.user?.is_admin && c.edit !== false ? '<button class="round" data-nav="edit" aria-label="Edit this page"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>' : ""}
    </nav>`;
  }
}

// ── Grid: lays other cards out in even rows; each child takes span 1–3 (or "full"), and every row ends on one line ──
class HearthGrid extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = config || {};
    this._cards = null;
    if (this._hass) this._build();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._cards) this._build();
    else this._cards.forEach((el) => { el.hass = hass; });
  }
  async _build() {
    const token = (this._token = {});
    const c = this._config;
    const cols = Math.max(1, Math.min(4, Number(c.columns) || 3));
    const make = async (cfg) => {
      const tag = String(cfg.type || "").replace(/^custom:/, "");
      if (tag.startsWith("hearth-") && customElements.get(tag)) {
        const el = document.createElement(tag);
        el.setConfig(cfg);
        return el;
      }
      const helpers = await window.loadCardHelpers();
      return helpers.createCardElement(cfg);
    };
    const els = await Promise.all((c.cards || []).map(async (cfg) => {
      const el = await make(cfg);
      const span = cfg.span === "full" || /heading$/.test(cfg.type || "") ? "full" : Math.max(1, Math.min(cols, Number(cfg.span) || 1));
      el.setAttribute("in-grid", "");
      el.className = span === "full" || span >= cols ? "full" : `s${span}`;
      return el;
    }));
    if (token !== this._token) return;
    this._cards = els;
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; container-type: inline-size; }
      .g { display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 12px; grid-auto-flow: row dense; }
      .g > * { min-width: 0; }
      .s2 { grid-column: span 2; }
      .s3 { grid-column: span 3; }
      .full { grid-column: 1 / -1; }
      @container (max-width: 900px) { .g { grid-template-columns: repeat(${Math.min(cols, 2)}, minmax(0, 1fr)); } .s2, .s3 { grid-column: 1 / -1; } }
      @container (max-width: 600px) { .g { grid-template-columns: minmax(0, 1fr); gap: 10px; } }
    </style><div class="g"></div>`;
    const g = this.shadowRoot.querySelector(".g");
    els.forEach((el) => { el.hass = this._hass; g.appendChild(el); });
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
}

const CARDS = [
  ["hearth-hero", HearthHero, "Hearth hero", "A live sky: greeting, weather, the sun and who is home"],
  ["hearth-stats", HearthStats, "Hearth stats", "Headline numbers with sparklines and forecast"],
  ["hearth-attention", HearthAttention, "Hearth attention", "Pills for anything that needs you"],
  ["hearth-moods", HearthMoods, "Hearth moods", "A row of scene buttons"],
  ["hearth-rooms", HearthRooms, "Hearth rooms", "Zones of rooms and thermostats in one card shape; secondary rooms stack two to a slot"],
  ["hearth-today", HearthToday, "Hearth today", "Next event, with an optional 24-hour day and night ribbon"],
  ["hearth-cars", HearthCars, "Hearth cars", "Battery ring, range and status for each car"],
  ["hearth-climate", HearthClimate, "Hearth climate", "Thermostats with current temperature, target and quick steps"],
  ["hearth-heading", HearthHeading, "Hearth heading", "Section heading that matches the Hearth cards"],
  ["hearth-panels", HearthPanels, "Hearth panels", "A row of compact panels: cars, cats and a to-do list"],
  ["hearth-banner", HearthBanner, "Hearth banner", "A bold colour header for a tab, with stat bubbles"],
  ["hearth-group", HearthGroup, "Hearth group", "A titled card of entity tiles with badges and an all on/off control"],
  ["hearth-chart", HearthChart, "Hearth chart", "The last day as lines, or daily totals as columns"],
  ["hearth-bars", HearthBars, "Hearth bars", "A ranked list of values as colourful bars"],
  ["hearth-nav", HearthNav, "Hearth nav", "The page's own tab bar: sidebar button, tabs, back and edit"],
  ["hearth-grid", HearthGrid, "Hearth grid", "Lays cards out in even rows, each spanning one to three columns"],
];
window.customCards = window.customCards || [];
for (const [tag, cls, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  window.customCards.push({ type: tag, name, description });
}
console.info(`%c HEARTH CARDS %c ${HEARTH_VERSION} `, "background:#c2560c;color:#fff;border-radius:3px 0 0 3px", "background:#2a241d;color:#fff;border-radius:0 3px 3px 0");
