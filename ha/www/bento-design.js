// Bento design - the design system page: every colour, type style, size and shape the bento
// cards use, drawn live from bento-core.js. Change the palette there and this page follows.
//
//   type: custom:bento-design
//
// Reads no entities and calls no services. Also defines custom:bento-viz (below).
import {
  BENTO_CORE_VERSION, BENTO_TOKENS_CSS, BENTO_BASE_CSS, STATUS, status, TONES, tone, offTone,
  CAT_TONES, ROOM_TONES, roomTone, kelvinRgb, rgbCss, lightTone, statusTag, esc, HOLD_MS, pageGutter,
} from "./bento-core.js?v=1.1.0";

const BENTO_DESIGN_VERSION = "1.2.0";

// What each tone is used for today (from the cards and custom_templates/bento.jinja)
const TONE_USE = {
  hazard: "Danger now: stove, oven or AC left on; a feeder fault; the litter box failing",
  act: "Needs you: open doors, unlocked locks, a full drawer, a car left open or low",
  today: "Today's chores; snack; fallback for switches, selects, numbers, vacuums",
  car: "The car hero; EV charging",
  plan: "What's next: arrivals, launches, sports, sentry mode",
  climate: "Thermostats, temperatures and most sensors; the 2nd cat",
  cats: "The cats tile; the 1st cat",
  media: "Anything playing",
  energy: "Power, energy and humidity; power bars; the 4th cat",
  scenes: "Scenes, scripts, away",
  money: "Cost sensors; the month's spend",
  night: "Lights summary, Vestaboard, recaps, teams you follow",
  water: "Rain, the pool",
  festive: "Seasonal garland",
  health: "Chores, health, batteries, lists; fallback for unknown tones",
  recycling: "Recycling day",
  trash: "Trash day",
  muted: "“Everything else” in the month's stack",
  litter: "The Litter-Robot when it's fine or a cat is inside",
};
const STATUS_USE = {
  ok: "Online, ready, done",
  busy: "Working: cycling, starting up",
  warn: "Offline, needs a hand, running low, armed button",
  alert: "Urgent: tier-0 glow, Live badge, faults",
  locked: "Asleep or locked",
  muted: "No status",
};
// [shape, columns, rows at 4 columns, name, at 3 columns, at 2 columns]
const SHAPES = [
  ["S", 1, 1, "Small", "1×1", "1×1"],
  ["W", 2, 1, "Wide", "2×1", "2×1"],
  ["T", 1, 2, "Tall", "1×2", "1×2"],
  ["L", 2, 2, "Large", "2×2", "2×2"],
  ["F", 4, 1, "Full row", "3×1", "2×1"],
  ["FL", 4, 2, "Full and tall", "3×2", "2×2"],
];
// The scales in bento-core: [token suffix, px, what it's for]
const SPACE = [["2xs", 2, "Text stacked inside a tile"], ["xs", 4, "Icon to label, dot to text"], ["sm", 8, "Pill padding, gaps inside a tile"],
  ["md", 12, "Between tiles, tile padding (top and bottom)"], ["lg", 16, "Tile padding (sides), hero and list padding"], ["xl", 24, "Big heroes, between sections"]];
const RADII = [["xs", "4px", "Chart bars, little marks"], ["sm", "8px", "Charge bars, chips inside a tile"], ["md", "12px", "Panels and fields inside a tile"],
  ["tile", "24px", "Tiles"], ["full", "999px", "Pills (circles use 50%)"]];
const CONTROLS = [["xs", 16, "Dots, ticks, small icons"], ["sm", 24, "Small buttons, checkboxes, bars, labelled sliders"],
  ["md", 32, "Compact controls, avatars"], ["lg", 44, "Anything you tap: steppers"]];
const TOKENS = [
  ["Row height", "--b-row", "132px"], ["Gap between tiles", "--b-gap", "md · 12px"],
  ["Tile padding", "--b-tile-pad", "md lg · 12px 16px"], ["Tile inner gap", "--b-tile-gap", "sm · 8px"],
  ["Pill padding", "--b-pill-pad", "sm md · 8px 12px"], ["Bar height", "--b-bar-h", "c-sm · 24px"],
  ["Focus ring", "--b-ring", "3px #5ab8ff"], ["Press and hold", "HOLD_MS", `${HOLD_MS} ms`],
  ["Two-tap window", "confirmTap", "4 s"],
  ["Motion", "--b-t-quick / tile / bar / fill", ".2s / .25s / .4s / 3s"],
];

const sw = (t, eyebrow, say, sub = "") =>
  `<div class="tile sw" style="--bg:${t.bg};--ink:${t.ink};--accent:${t.accent || t.ink}">
    <div class="lbl">${esc(eyebrow)}</div>
    <div class="txt"><div class="say">${esc(say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
    <div class="foot"><i class="acc"></i></div></div>`;

const panel = (night, body) => {
  const vars = Object.keys(STATUS).map((k) => `--b-${k}:${status(k, night)}`).join(";");
  const page = night ? "--bg:#141a2c;--ink:#e1e5ef;background:#141a2c;color:#e1e5ef" : "--bg:#ffffff;--ink:#1c2233;background:#ffffff;color:#1c2233";
  return `<div class="panel ${night ? "is-night" : ""}" style="${vars};${page}"><div class="ptag">${night ? "Night" : "Day"}</div>${body}</div>`;
};

class BentoDesign extends HTMLElement {
  static getStubConfig() { return {}; }
  setConfig(config) {
    this._config = { font_scale: 1, ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._render();
  }
  set hass(hass) { this._hass = hass; }
  connectedCallback() { pageGutter(true); }
  disconnectedCallback() { pageGutter(false); }
  getCardSize() { return 40; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  _tones() {
    return Object.entries(TONES).map(([name, t]) => `
      <div class="item">
        <div class="name"><b>${esc(name)}</b><span>${esc(TONE_USE[name] || "")}</span></div>
        <div class="pair">${sw(tone(name, false), name, "Aa 21°", "Day")}${sw(tone(name, true), name, "Aa 21°", "Night")}</div>
        <div class="hex">day ${t[0]} / ${t[1]} · night ${t[2]} / ${t[3]} · accent ${t[4]}</div>
      </div>`).join("");
  }

  _status() {
    return Object.keys(STATUS).map((k) => `
      <div class="srow">
        <span class="dot" style="background:${status(k, false)}"></span>
        <span class="dot" style="background:${status(k, true)};box-shadow:0 0 0 4px #141a2c"></span>
        <b>${k}</b><span class="muted">${esc(STATUS_USE[k])}</span>
        <code>${STATUS[k][0]} / ${STATUS[k][1]}</code>
      </div>`).join("");
  }

  _rooms() {
    return ROOM_TONES.map((_, i) => `<div class="pair">${sw(roomTone(i, false), `Room ${i}`, "Lit")}${sw(roomTone(i, true), `Room ${i}`, "Lit")}</div>`).join("");
  }

  _kelvin() {
    const stops = [];
    for (let k = 2000; k <= 6500; k += 250) stops.push(rgbCss(kelvinRgb(k)));
    return `<div class="kbar" style="background:linear-gradient(90deg,${stops.join(",")})"></div>
      <div class="krow"><span>2000K</span><span>3000K</span><span>4000K</span><span>5000K</span><span>6500K</span></div>`;
  }

  _lights(night) {
    const L = [["2200K", { color_temp_kelvin: 2200 }], ["2700K", { color_temp_kelvin: 2700 }], ["4000K", { color_temp_kelvin: 4000 }],
      ["6000K", { color_temp_kelvin: 6000 }], ["Red", { rgb_color: [255, 40, 40] }], ["Blue", { rgb_color: [40, 90, 255] }]];
    return `<div class="six">${L.map(([n, a]) => sw(lightTone(a, night), "Light", n)).join("")}</div>`;
  }

  _type() {
    return `
      <div class="trow"><div class="lbl">Living room</div><code>Eyebrow · Figtree 0.76em · 800 · caps · 0.08em · 72%</code></div>
      <div class="trow"><div class="say">Lights on in 3 rooms</div><code>Say · Bricolage Grotesque 1.45em · 800 · 1.1</code></div>
      <div class="trow"><div class="say big">72°</div><code>Say, big · Bricolage 3em · 800 · 1</code></div>
      <div class="trow"><div class="sub">Set to 70° · heating</div><code>Sub · Figtree 0.9em · 600 · 78%</code></div>
      <div class="trow"><div class="title">Living Room</div><code>Card title · Bricolage 1.35em · 800</code></div>
      <div class="trow"><div><button class="pill">All off</button></div><code>Pill · Figtree 0.86em · 800</code></div>
      <p class="muted">Sizes are in em off the card, so <code>font_scale</code> scales a whole card. Base is 16px.</p>`;
  }

  _shapes() {
    const demo = SHAPES.map(([s, c, r, n]) =>
      `<div class="tile shp" style="grid-column:span ${c};grid-row:span ${r};--bg:#eef0f5;--ink:#1c2233"><div class="lbl">${s}</div><div class="txt"><div class="say">${esc(n)}</div><div class="sub">${c}×${r}</div></div></div>`).join("");
    const rows = SHAPES.map(([s, c, r, n, three, two]) => `<tr><td><b>${s}</b></td><td>${esc(n)}</td><td>${c}×${r}</td><td>${three}</td><td>${two}</td></tr>`).join("");
    return `<div class="shapes">${demo}</div>
      <table><tr><th>Shape</th><th></th><th>4 cols</th><th>3 cols</th><th>2 cols</th></tr>${rows}</table>
      <p class="muted">Width × height in cells. bento-grid uses 4 columns (2 under 560px, 20-cell budget); bento-controls uses 4, 3 under 760px, 2 under 420px. Holes are filled by widening the tile on the left or lengthening the one above.</p>`;
  }

  _scales() {
    const space = SPACE.map(([k, px, use]) => `<div class="srow2"><code>--b-s-${k}</code><b>${px}</b><i class="sp" style="width:var(--b-s-${k})"></i><span class="muted">${esc(use)}</span></div>`).join("");
    const radii = RADII.map(([k, v, use]) => `<div class="rcell"><i style="border-radius:var(--b-r-${k})"></i><code>--b-r-${k}</code><b>${v}</b><span class="muted">${esc(use)}</span></div>`).join("");
    const ctl = CONTROLS.map(([k, px, use]) => `<div class="rcell"><i class="ctl" style="width:var(--b-c-${k});height:var(--b-c-${k})"></i><code>--b-c-${k}</code><b>${px}</b><span class="muted">${esc(use)}</span></div>`).join("");
    return `<p class="lead">Spacing: every padding, margin and gap is one of these.</p>${space}
      <p class="lead" style="margin-top:var(--b-s-xl)">Corners</p><div class="rgrid">${radii}</div>
      <p class="lead" style="margin-top:var(--b-s-xl)">Control sizes</p><div class="rgrid">${ctl}</div>`;
  }

  _tokens() {
    return `<table>${TOKENS.map(([n, v, d]) => `<tr><td>${esc(n)}</td><td><code>${esc(v)}</code></td><td>${esc(d)}</td></tr>`).join("")}</table>`;
  }

  _components(night) {
    const tags = Object.keys(STATUS).map((k) => statusTag(k, k)).join(" ");
    return panel(night, `
      <div class="row"><button class="pill">Pill</button><button class="pill sel">Selected</button><button class="pill go">Tap again</button><button class="pill" disabled>Disabled</button></div>
      <div class="row"><button class="pill big">Serve</button><div class="setp"><button class="step">−</button><b>70°</b><button class="step">+</button></div></div>
      <div class="row">${tags}</div>
      <div class="charge" style="--accent:${tone("car", night).accent}">
        <div class="cbar"><i class="now" style="width:58%"></i><i class="gain live" style="left:58%;width:22%"></i><i class="lim" style="left:80%"></i></div>
      </div>
      <div class="charge" style="--accent:${tone("car", night).accent}"><div class="cbar"><i class="now low" style="width:14%"></i></div></div>
      <p class="muted">Charge bar: now, striped gain, limit line; low turns warn.</p>`);
  }

  _render() {
    const off = [offTone(false), offTone(true)];
    this.shadowRoot.innerHTML = `
      <style>${BENTO_TOKENS_CSS}${BENTO_BASE_CSS}
        :host { color: var(--primary-text-color, #1c2233); font-family: var(--b-body); }
        .wrap { display: grid; gap: calc(var(--b-s-xl) + var(--b-s-sm)); }
        h1 { font-family: var(--b-display); font-weight: 800; font-size: 2.2em; letter-spacing: -0.02em; margin: 0; }
        h2 { font-family: var(--b-display); font-weight: 800; font-size: 1.45em; margin: 0 0 var(--b-s-xs); letter-spacing: -0.01em; }
        .intro { opacity: .75; font-weight: 600; margin: var(--b-s-xs) 0 0; }
        .lead { opacity: .7; margin: 0 0 var(--b-s-lg); font-weight: 600; font-size: .92em; }
        .muted { opacity: .65; font-size: .85em; font-weight: 600; }
        code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8em; opacity: .75; }
        .tones { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--b-s-lg); }
        .item { display: grid; gap: var(--b-s-sm); align-content: start; }
        .name { display: grid; gap: var(--b-s-2xs); } .name b { font-size: 1.05em; } .name span { font-size: .82em; opacity: .7; font-weight: 600; min-height: 2.4em; }
        .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--b-s-sm); }
        .sw { height: 112px; cursor: default; }
        .sw .acc { display: block; height: 6px; border-radius: var(--b-r-xs); background: var(--accent); }
        .hex { font-family: ui-monospace, Menlo, monospace; font-size: .7em; opacity: .6; }
        .rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--b-s-md); }
        .six { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--b-s-sm); }
        .srow { display: grid; grid-template-columns: 18px 18px 70px 1fr auto; gap: var(--b-s-md); align-items: center; padding: var(--b-s-sm) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
        .dot { width: 14px; height: 14px; border-radius: 50%; }
        .kbar { height: 40px; border-radius: var(--b-bar-radius); }
        .krow { display: flex; justify-content: space-between; font-size: .75em; opacity: .6; font-weight: 700; margin-top: var(--b-s-xs); }
        .trow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--b-s-lg); align-items: center; padding: var(--b-s-md) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
        .trow .lbl, .trow .say, .trow .sub, .trow .title { opacity: 1; }
        .shapes { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 80px; grid-auto-flow: dense; gap: var(--b-gap); margin-bottom: var(--b-s-lg); }
        .shp { cursor: default; } .shp .say { font-size: 1.1em; }
        table { border-collapse: collapse; width: 100%; font-size: .9em; }
        td, th { text-align: left; padding: var(--b-s-sm) var(--b-s-md) var(--b-s-sm) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
        th { font-size: .78em; text-transform: uppercase; letter-spacing: .06em; opacity: .6; }
        .srow2 { display: grid; grid-template-columns: 90px 32px 32px 1fr; gap: var(--b-s-md); align-items: center; padding: var(--b-s-sm) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
        .sp { display: block; height: 20px; background: #a78bfa; border-radius: var(--b-r-xs); }
        .rgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--b-s-md); }
        .rcell { display: grid; gap: var(--b-s-xs); justify-items: start; }
        .rcell i { display: block; width: 72px; height: 72px; background: #eef0f5; box-shadow: inset 0 0 0 2px #a78bfa; }
        .rcell i.ctl { border-radius: 50%; background: #a78bfa; box-shadow: none; }
        .rcell b { font-size: .85em; }
        .scale { display: flex; gap: var(--b-s-xl); align-items: end; flex-wrap: wrap; margin-top: var(--b-s-lg); }
        .scale div { display: grid; gap: var(--b-s-sm); justify-items: start; font-size: .75em; font-weight: 700; opacity: .8; }
        .scale i { display: block; background: #a78bfa; opacity: .7; }
        .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--b-s-lg); }
        .panel { border-radius: var(--b-radius); padding: var(--b-s-lg); display: grid; gap: var(--b-s-lg); box-shadow: inset 0 0 0 1px rgba(127,127,127,.2); }
        .ptag { font-size: .72em; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .6; }
        .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--b-s-lg); }
      </style>
      <div class="wrap">
        <header>
          <h1>Bento design system</h1>
          <p class="intro">bento-core ${BENTO_CORE_VERSION} · drawn live from bento-core.js, so this page changes when the palette does.</p>
        </header>

        <section><h2>Tones</h2><p class="lead">A tile's colour says what kind of thing it is. Each tone has a day and a night version and an accent for charts.</p>
          <div class="tones">${this._tones()}</div></section>

        <section><h2>Off, lights and strips</h2><p class="lead">Anything switched off goes neutral. A light wears the colour it's showing. An LED strip is always dark.</p>
          <div class="two">
            <div class="item"><div class="name"><b>off</b><span>Anything switched off, everywhere</span></div><div class="pair">${sw(off[0], "off", "Off", "Day")}${sw(off[1], "off", "Off", "Night")}</div></div>
            <div class="item"><div class="name"><b>strip</b><span>LED strip when on</span></div><div class="pair">${sw({ bg: "#141824", ink: "#ffffff", accent: "#ffd65c" }, "strip", "Rainbow")}${sw({ bg: "#141824", ink: "#ffffff", accent: "#ffd65c" }, "strip", "Rainbow")}</div></div>
          </div>
          <p class="lead" style="margin-top:var(--b-s-lg)">Light tiles, day then night</p>${this._lights(false)}<div style="height:8px"></div>${this._lights(true)}
          <p class="lead" style="margin-top:var(--b-s-lg)">Colour temperature, as Adaptive Lighting shows it</p>${this._kelvin()}</section>

        <section><h2>Status</h2><p class="lead">Dots, bars and tags: what state something is in, independent of its tone. Day dot, then night dot.</p>${this._status()}</section>

        <section><h2>Room colours</h2><p class="lead">A lit room wears its colour, in the order of bento-rooms' <code>areas</code>; a dark room goes neutral. Day, then night.</p>
          <div class="rooms">${this._rooms()}</div></section>

        <section><h2>Cat colours</h2><p class="lead">Each cat keeps one tone across every card, in this order.</p>
          <div class="rooms">${CAT_TONES.map((n, i) => `<div class="pair">${sw(tone(n, false), `Cat ${i + 1}`, n)}${sw(tone(n, true), `Cat ${i + 1}`, n)}</div>`).join("")}</div></section>

        <section><h2>Type</h2><p class="lead">Bricolage Grotesque for things you read at a glance, Figtree for everything else.</p>${this._type()}</section>

        <section><h2>Tile shapes</h2><p class="lead">Every tile is one of six shapes on the bento grid.</p>${this._shapes()}</section>

        <section><h2>Spacing, corners and sizes</h2>${this._scales()}</section>

        <section><h2>Layout and timing</h2>${this._tokens()}</section>

        <section><h2>Components</h2><p class="lead">Buttons, steppers, status tags and the charge bar.</p>
          <div class="panels">${this._components(false)}${this._components(true)}</div></section>
      </div>`;
  }
}

if (!customElements.get("bento-design")) customElements.define("bento-design", BentoDesign);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bento-design", name: "Bento design system", description: "Every bento colour, type style, size and shape" });
// ── Visualizations: every chart bento-grid can draw, on example tiles drawn by the real grid.
//
//   type: custom:bento-viz
//
// Each group is a <bento-grid> handed a copy of hass with one extra, made-up entity whose
// tiles attribute holds the examples. History charts read the real sensors. Services are
// switched off, so nothing on this page can change the house. dbars is left out: it only
// works in bento-controls (passing it to bento-grid breaks the grid).
const VIZ_GROUPS = [
  { name: "Charts", note: "History and proportions. Spark and dayline read the real sensors' history.", rows: [
    ["spark", "bleed", "entity, hours (2) or since: midnight, ref, ref_label, peak"],
    ["dayline", "stack", "series[{entity, name}]: a mark each time a counter steps up"],
    ["stack", "stack", "segments[{name, value, tone, show}]"],
    ["tbar", "stack", "value 0–100, line, line_label"],
    ["thermo", "stack", "rooms[[name, temp]], set"],
    ["rain", "after", "hours[{h, in, wet}]"],
  ], tiles: [
    { id: "v_power", tier: 1, shape: "L", label: "Power · spark", tone: "energy", say: "1.8 kW now", sub: "Since midnight, peak marked",
      viz: { type: "spark", entity: "sensor.main_breaker_power_minute_average", since: "midnight", peak: true } },
    { id: "v_ac", tier: 1, shape: "W", label: "AC · spark with ref", tone: "climate", say: "Cooling to 74°", sub: "Last 2 hours",
      viz: { type: "spark", entity: "sensor.living_room_temp_sensor_temperature", hours: 2, ref: 74, ref_label: "set 74°" } },
    { id: "v_cats", tier: 1, shape: "W", label: "Cats · dayline", tone: "cats", say: "Litter visits today", sub: "",
      viz: { type: "dayline", series: [{ entity: "sensor.zig_visits_today", name: "Zig" }, { entity: "sensor.donut_visits_today", name: "Donut" }] } },
    { id: "v_month", tier: 1, shape: "W", label: "This month · stack", tone: "money", say: "About $142 so far", sub: "On pace for about $280",
      viz: { type: "stack", segments: [{ name: "EV 31%", value: 290, tone: "car", show: true }, { name: "AC 38%", value: 356, tone: "climate", show: true },
        { name: "Pool", value: 88, tone: "plan", show: false }, { name: "Everything else", value: 202, tone: "muted", show: true }] } },
    { id: "v_drawer", tier: 1, shape: "W", label: "Litter drawer · tbar", tone: "act", say: "Nearly full", sub: "About a day left",
      viz: { type: "tbar", value: 86, line: 80, line_label: "alert" } },
    { id: "v_climate", tier: 1, shape: "W", label: "Climate · thermo", tone: "climate", say: "Cool and comfy", sub: "",
      viz: { type: "thermo", rooms: [["Living Room", 74.2], ["Pantry", 76.8], ["Bedroom", 72.9], ["Bathroom", 73.5], ["Game Room", 75.1], ["Race Room", 77.4], ["Guest Room", 73]], set: 74 } },
    { id: "v_rain", tier: 1, shape: "W", label: "Rain · rain", tone: "water", say: "Rain around 4 pm", sub: "About 0.4 in",
      viz: { type: "rain", hours: [{ h: 14, in: 0, wet: false }, { h: 15, in: 0.02, wet: false }, { h: 16, in: 0.18, wet: true }, { h: 17, in: 0.12, wet: true },
        { h: 18, in: 0.06, wet: true }, { h: 19, in: 0, wet: false }, { h: 20, in: 0, wet: false }, { h: 21, in: 0, wet: false }] } },
  ] },
  { name: "Gauges", note: "One number, drawn.", rows: [
    ["ring", "side", "value 0–100, label"],
    ["tube", "side", "value 0–100, line (50): below the line it turns warn and throbs"],
    ["battery", "side", "value 0–100 (under 50 is warn), label, charging"],
    ["charge", "foot", "value, limit (80), now_mi, full_mi"],
    ["kelvin", "after", "value K, min (2000), max (5500)"],
  ], tiles: [
    { id: "v_laundry", tier: 1, shape: "S", label: "Laundry · ring", tone: "today", say: "Washer's going", sub: "", viz: { type: "ring", value: 62, label: "34m" } },
    { id: "v_tube", tier: 1, shape: "S", label: "Softener · tube", tone: "water", say: "Salt's low", sub: "35% left", viz: { type: "tube", value: 35, line: 50 } },
    { id: "v_cars", tier: 1, shape: "W", label: "Cars · battery", tone: "car", say: "Nik's car is home", sub: "Kat's is at work", viz: { type: "battery", value: 72, label: "72% · 214 mi", charging: true } },
    { id: "v_charge", tier: 1, shape: "T", label: "Charge tonight · charge", tone: "car", say: "Kat's car is at 34%", sub: "Plug in tonight?",
      viz: { type: "charge", value: 34, limit: 80, now_mi: 98, full_mi: 231 } },
    { id: "v_lights", tier: 1, shape: "W", label: "Lights · kelvin", tone: "night", say: "12 lights on", sub: "Warm, following the sun",
      viz: { type: "kelvin", value: 2600, min: 2200, max: 5000 } },
  ] },
  { name: "Lists and actions", note: "Things to read or tap. Buttons here are switched off.", rows: [
    ["list", "after", "items[{uid, summary}]: tick marks done (a tall list with one item goes wide)"],
    ["checks", "after", "items[{label, ok}]"],
    ["receipt", "after", "rows[[label, value]]"],
    ["buttons", "foot", "items[{label, service, entity_id, data, primary}]"],
  ], tiles: [
    { id: "v_chores", tier: 1, shape: "T", label: "Chores · list", tone: "health", say: "3 little things", sub: "",
      viz: { type: "list", items: [{ uid: "a1", summary: "WATER THE PLANTS" }, { uid: "a2", summary: "CHANGE HVAC FILTER" }, { uid: "a3", summary: "BOOK VET VISIT" }] },
      act: { label: "+ Add", type: "todo_add", entity_id: "todo.house_alerts" } },
    { id: "v_away", tier: 1, shape: "L", label: "While you're out · checks", tone: "scenes", say: "One thing to look at", sub: "Since you left at 9:15 am",
      viz: { type: "checks", items: [{ label: "Front door is unlocked", ok: false }, { label: "Doors and windows shut", ok: true },
        { label: "Stove and oven off", ok: true }, { label: "Cats fed, 4 litter visits", ok: true }] } },
    { id: "v_recap", tier: 1, shape: "W", label: "Today · receipt", tone: "night", say: "A regular day", sub: "",
      viz: { type: "receipt", rows: [["Power", "38 kWh · $5.12"], ["Front door", "14 opens"], ["Litter visits", "7"]] } },
    { id: "v_scenes", tier: 1, shape: "W", label: "Scenes · buttons", tone: "scenes", say: "Settling in for the evening?", sub: "",
      viz: { type: "buttons", items: [{ label: "Evening", service: "script.turn_on", entity_id: "script.lighting_evening", primary: true },
        { label: "Relax", service: "script.turn_on", entity_id: "script.whole_house_relax", primary: false },
        { label: "All off", service: "light.turn_off", entity_id: "light.zone_home", primary: false }] } },
  ] },
  { name: "Displays", note: "Moving pictures.", rows: [
    ["board", "stack", "lines[] or text (|| breaks), rows (3), cols (15); {63}–{71} are colour flaps"],
    ["flaps", "stack", "text (first 22 characters)"],
    ["eq", "side", "no fields: a playing equaliser"],
    ["garland", "stack", "no fields: twinkling lights"],
  ], tiles: [
    { id: "v_board", tier: 1, shape: "W", label: "Vestaboard · board", tone: "night", say: "", sub: "",
      viz: { type: "board", lines: ["{63}{64}{65}{66}{67}{68}{63}{64}{65}{66}{67}{68}{63}{64}{65}", "  HAPPY FRIDAY ", "{68}{67}{66}{65}{64}{63}{68}{67}{66}{65}{64}{63}{68}{67}{66}"] } },
    { id: "v_flaps", tier: 1, shape: "W", label: "Departures · flaps", tone: "night", say: "", sub: "", viz: { type: "flaps", text: "MCO 4:05 ON TIME" } },
    { id: "v_playing", tier: 1, shape: "S", label: "Now playing · eq", tone: "media", say: "Severance", sub: "Apple TV", viz: { type: "eq" } },
    { id: "v_garland", tier: 1, shape: "S", label: "Seasonal · garland", tone: "festive", say: "Twinkling", sub: "", viz: { type: "garland" } },
  ] },
  { name: "Words only", note: "No chart: a big number, a live badge, an alarm (tier 0 pulses) and a team colour.", rows: [
    ["(none)", "text", "say, big, sub, badge, act; tier 0 pulses; color overrides tone"],
  ], tiles: [
    { id: "v_stove", tier: 0, shape: "W", label: "Stove left on · tier 0", tone: "hazard", say: "On for 1 h 40 m. Go check it.", sub: "1840 W",
      act: { label: "Kitchen", type: "navigate", path: "kitchen" } },
    { id: "v_next", tier: 1, shape: "S", label: "Next up · big", tone: "plan", say: "4:30", big: true, sub: "Dentist" },
    { id: "v_sport", tier: 1, shape: "W", label: "Lightning · badge", badge: "Live", tone: "plan", color: "#002868", say: "Bolts up 3–2", sub: "Kucherov goal" },
    { id: "v_snack", tier: 1, shape: "S", label: "Zig & Donut · confirm", tone: "cats", say: "Snack time?", sub: "Fed 4 h ago",
      act: { label: "Give a snack", type: "service", service: "script.cats_feed", data: { portions: 1 }, confirm: true } },
  ] },
];

class BentoViz extends HTMLElement {
  static getStubConfig() { return {}; }
  setConfig(config) {
    this._config = { ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._built = false;
  }
  connectedCallback() { pageGutter(true); }
  disconnectedCallback() { pageGutter(false); }
  getCardSize() { return 40; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  // A copy of hass with the made-up tiles entity added and services switched off
  _fake(hass, i) {
    const id = `sensor.bento_viz_${i}`;
    const states = { ...hass.states, [id]: { entity_id: id, state: "ok", attributes: { tiles: VIZ_GROUPS[i].tiles }, last_changed: "", last_updated: "" } };
    return { ...hass, states, callService: () => Promise.resolve() };
  }

  _build() {
    const rows = (g) => g.rows.map(([t, layout, fields]) => `<tr><td><b>${esc(t)}</b></td><td>${esc(layout)}</td><td>${esc(fields)}</td></tr>`).join("");
    this.shadowRoot.innerHTML = `
      <style>${BENTO_TOKENS_CSS}
        :host { color: var(--primary-text-color, #1c2233); font-family: var(--b-body); }
        .wrap { display: grid; gap: calc(var(--b-s-xl) + var(--b-s-sm)); }
        h1 { font-family: var(--b-display); font-weight: 800; font-size: 2.2em; letter-spacing: -0.02em; margin: 0; }
        h2 { font-family: var(--b-display); font-weight: 800; font-size: 1.45em; margin: 0 0 var(--b-s-xs); }
        .lead { opacity: .7; margin: 0 0 var(--b-s-md); font-weight: 600; font-size: .92em; }
        table { border-collapse: collapse; width: 100%; font-size: .85em; margin-top: var(--b-s-md); }
        td, th { text-align: left; padding: var(--b-s-xs) var(--b-s-md) var(--b-s-xs) 0; border-bottom: 1px solid rgba(127,127,127,.15); vertical-align: top; }
        th { font-size: .78em; text-transform: uppercase; letter-spacing: .06em; opacity: .6; }
        td:nth-child(2) { opacity: .7; white-space: nowrap; }
      </style>
      <div class="wrap">
        <header><h1>Visualizations</h1>
          <p class="lead">Every chart bento-grid can draw, on example tiles drawn by the real grid. History charts use the real sensors. Buttons on this page do nothing.
          Layout says where the chart sits: bleed (full width along the bottom), stack (above the words), side (beside them), after (below them), foot (at the bottom).</p></header>
        ${VIZ_GROUPS.map((g, i) => `<section><h2>${esc(g.name)}</h2><p class="lead">${esc(g.note)}</p><div data-g="${i}"></div>
          <table><tr><th>viz.type</th><th>Layout</th><th>Fields</th></tr>${rows(g)}</table></section>`).join("")}
        <section><h2>In bento-controls</h2><p class="lead">Sensor tiles take <code>chart: spark</code> (with <code>hours</code>) or <code>chart: bars</code> (daily bars, <code>days</code>, default 14). These are real.</p><div data-c></div></section>
      </div>`;
    this._grids = VIZ_GROUPS.map((g, i) => {
      const el = document.createElement("bento-grid");
      el.setConfig({ entity: `sensor.bento_viz_${i}`, routes: {} });
      this.shadowRoot.querySelector(`[data-g="${i}"]`).appendChild(el);
      return el;
    });
    const ctl = document.createElement("bento-controls");
    ctl.setConfig({ all: false, entities: [
      { entity: "sensor.litter_robot_litter_level", name: "Litter level · spark", chart: "spark", hours: 168, shape: "W" },
      { entity: "sensor.zig_weight", name: "Zig's weight · bars", chart: "bars", days: 14, shape: "W" },
    ] });
    this.shadowRoot.querySelector("[data-c]").appendChild(ctl);
    this._ctl = ctl;
    this._built = true;
  }

  set hass(hass) {
    if (!this._config) return;
    if (!this._built) {
      if (!customElements.get("bento-grid") || !customElements.get("bento-controls")) {
        if (!this._waiting) { this._waiting = true; Promise.all([customElements.whenDefined("bento-grid"), customElements.whenDefined("bento-controls")]).then(() => { this._waiting = false; if (this._hass) this.hass = this._hass; }); }
        this._hass = hass;
        return;
      }
      this._build();
    }
    this._hass = hass;
    // The tiles never change, so only pass hass on when night flips or every five minutes
    const night = hass.states["sun.sun"]?.state;
    if (night === this._night && Date.now() - (this._fed || 0) < 300000) return;
    this._night = night; this._fed = Date.now();
    this._grids.forEach((g, i) => { g.hass = this._fake(hass, i); });
    this._ctl.hass = { ...hass, callService: () => Promise.resolve() };
  }
}

if (!customElements.get("bento-viz")) customElements.define("bento-viz", BentoViz);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bento-viz", name: "Bento visualizations", description: "Every chart bento-grid can draw" });

console.info(`%c BENTO DESIGN %c ${BENTO_DESIGN_VERSION} `, "background:#a78bfa;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
