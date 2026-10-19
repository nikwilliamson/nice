// The library pages.
//   nice-design: every colour, type style, size and shape, drawn live from src/tokens.json
//   nice-viz:    every chart the grid can draw, on example tiles drawn by the real grid. History
//                charts read the real sensors; services are switched off.
import { html, css } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens, TOKENS as T } from "../core/tokens.js";
import { RAMPS, STEPS, color, chartColors } from "../core/palette.js";
import { TONE_NAMES, tone, offTone, roomTone, lightTone, kelvinRgb, rgbCss, status, CAT_TONES } from "../core/tones.js";
import { controlStyles } from "../controls/index.js";
import { SHAPES } from "../layout/pack.js";
import { CHARTS, layoutOf } from "../charts/index.js";
import { VIZ_GROUPS } from "./viz-examples.js";

// How a token names its colour, for the captions
const ref = (r) => (Array.isArray(r) ? `oklch(${(r[0] * 100).toFixed(1)}% ${r[1]} ${r[2]})` : r);
const swatch = (c, eyebrow, say, sub = "") => html`<div class="sw" style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent || c.ink}"><div class="lbl">${eyebrow}</div><div class="say">${say}</div>${sub ? html`<div class="sub">${sub}</div>` : ""}<i class="acc"></i></div>`;

export class NiceDesign extends NiceCard {
  watch() { return [this.config.sun]; }
  render() {
    const lights = [["2200K", { color_temp_kelvin: 2200 }], ["2700K", { color_temp_kelvin: 2700 }], ["4000K", { color_temp_kelvin: 4000 }], ["6000K", { color_temp_kelvin: 6000 }], ["Red", { rgb_color: [255, 40, 40] }], ["Blue", { rgb_color: [40, 90, 255] }]];
    const kstops = Array.from({ length: 19 }, (_, i) => rgbCss(kelvinRgb(2000 + i * 250))).join(",");
    return html`<div class="wrap">
      <header><h1>Nice design system</h1><p class="lead">Drawn live from src/tokens.json, the file the cards and the theme are both built from.</p></header>
      <section><h2>Tones</h2><p class="lead">A tile's colour says what kind of thing it is: a day and a night version, and an accent for charts. Each names a colour from the palette below.</p>
        <div class="tones">${TONE_NAMES.map((n) => html`<div class="item"><b>${n}</b><div class="pair">${swatch(tone(n, false), n, "Aa 21°", "Day")}${swatch(tone(n, true), n, "Aa 21°", "Night")}</div>
          <code>${["day", "night"].map((w) => T.tones[n][w].map(ref).join(" · ")).join(" / ")}</code></div>`)}</div></section>
      <section><h2>Palette</h2><p class="lead">The primitive ramps, OKLCH and sRGB-safe, from ${STEPS[0]} to ${STEPS[STEPS.length - 1]}.</p>
        <div class="ramps">${RAMPS.map((r) => html`<div class="ramp"><b>${r}</b>${STEPS.map((st) => html`<i title="${r}-${st}" style="background:${color(`${r}-${st}`)}"></i>`)}</div>`)}</div></section>
      <section><h2>Chart colours</h2><p class="lead">Series, sequential and diverging scales, and status, by day and by night.</p>
        ${[false, true].map((night) => { const c = chartColors(night); return html`<div class="chartrow"><b>${night ? "Night" : "Day"}</b>
          ${["series", "seq", "div"].map((k) => html`<div class="ramp"><span>${k}</span>${c[k].map((x) => html`<i style="background:${x}"></i>`)}</div>`)}
          <div class="ramp"><span>status</span>${Object.entries(c.status).map(([k, x]) => html`<i title=${k} style="background:${x}"></i>`)}<i title="grid" style="background:${c.grid}"></i><i title="axis" style="background:${c.axis}"></i></div></div>`; })}</section>
      <section><h2>Off and lights</h2><p class="lead">Anything off goes neutral. A light wears the colour it's showing.</p>
        <div class="pair">${swatch(offTone(false), "off", "Off", "Day")}${swatch(offTone(true), "off", "Off", "Night")}</div>
        <div class="six">${lights.map(([n, a]) => swatch(lightTone(a, false), "Light", n))}</div>
        <div class="six">${lights.map(([n, a]) => swatch(lightTone(a, true), "Light", n))}</div>
        <div class="kbar" style="background:linear-gradient(90deg,${kstops})"></div><div class="krow"><span>2000K</span><span>4250K</span><span>6500K</span></div></section>
      <section><h2>Status</h2>${Object.keys(T.status).map((k) => html`<div class="srow"><span class="dot" style="background:${status(k, false)}"></span><span class="dot" style="background:${status(k, true)}"></span><b>${k}</b><code>${T.status[k].join(" / ")}</code></div>`)}</section>
      <section><h2>Rooms and cats</h2><p class="lead">A lit room goes warm and a dark one grey, the same for every room; each cat keeps one tone on every card.</p>
        <div class="tones"><div class="pair">${swatch(roomTone(0, false), "Room", "Lit")}${swatch(roomTone(0, true), "Room", "Lit")}</div>
          ${CAT_TONES.map((n, i) => html`<div class="pair">${swatch(tone(n, false), `Cat ${i + 1}`, n)}${swatch(tone(n, true), `Cat ${i + 1}`, n)}</div>`)}</div></section>
      <section><h2>Type</h2>
        <div class="trow"><div class="lbl">Living room</div><code>Eyebrow · Figtree ${T.type.label.size} · ${T.type.label.weight} · caps</code></div>
        <div class="trow"><div class="say">Lights on in 3 rooms</div><code>Say · Bricolage Grotesque ${T.type.say.size} · 800</code></div>
        <div class="trow"><div class="say big">72°</div><code>Say, big · ${T.type.say.big}</code></div>
        <div class="trow"><div class="sub">Set to 70° · heating</div><code>Sub · Figtree ${T.type.sub.size} · ${T.type.sub.weight}</code></div>
        <div class="trow"><div><button class="pill">All off</button> <button class="pill sel">Selected</button> <button class="pill go">Tap again</button></div><code>Pill · ${T.type.pill.size} · ${T.type.pill.weight}</code></div></section>
      <section><h2>Shapes</h2><div class="shapes">${Object.entries(SHAPES).map(([s, [c, r]]) => html`<div class="shp" style="grid-column:span ${c};grid-row:span ${r}"><b>${s}</b> ${c}×${r}</div>`)}</div></section>
      <section><h2>Scales</h2><table>
        ${Object.entries(T.space).map(([k, v]) => html`<tr><td><code>--n-s-${k}</code></td><td>${v}px</td><td><i class="sp" style="width:${v * 2}px"></i></td></tr>`)}
        ${Object.entries(T.radius).map(([k, v]) => html`<tr><td><code>--n-r-${k}</code></td><td>${v}px</td><td>corner</td></tr>`)}
        ${Object.entries(T.control).map(([k, v]) => html`<tr><td><code>--n-c-${k}</code></td><td>${v}px</td><td>control</td></tr>`)}
        <tr><td><code>--n-row</code></td><td>${T.row}px</td><td>row height</td></tr>
        <tr><td>Hold</td><td>${T.motion.holdMs} ms</td><td>press and hold opens details</td></tr>
        <tr><td>Two taps</td><td>${T.motion.confirmMs} ms</td><td>how long a risky button stays armed</td></tr></table></section>
      <section><h2>Charts</h2><table>${Object.keys(CHARTS).map((k) => html`<tr><td><b>${k}</b></td><td>${layoutOf({ type: k })}</td></tr>`)}</table></section>
    </div>`;
  }
  getCardSize() { return 40; }
  static styles = [tokens, controlStyles, css`
    :host { color: var(--primary-text-color, #1c2233); font-family: var(--n-body); }
    .wrap { display: grid; gap: calc(var(--n-s-xl) + var(--n-s-sm)); }
    h1 { font-family: var(--n-display); font-weight: 800; font-size: 2.2em; letter-spacing: -0.02em; margin: 0; }
    h2 { font-family: var(--n-display); font-weight: 800; font-size: 1.45em; margin: 0 0 var(--n-s-xs); }
    .lead { opacity: .7; margin: 0 0 var(--n-s-md); font-weight: 600; font-size: .92em; }
    code { font-family: ui-monospace, Menlo, monospace; font-size: .75em; opacity: .7; }
    .tones { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--n-s-lg); }
    .ramps { display: grid; gap: 4px; }
    .ramp { display: grid; grid-template-columns: 96px repeat(13, 1fr); gap: 3px; align-items: center; font-size: .8em; }
    .ramp i { height: 22px; border-radius: 4px; }
    .chartrow { display: grid; gap: 4px; margin-bottom: var(--n-s-md); }
    .item { display: grid; gap: var(--n-s-sm); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--n-s-sm); }
    .six { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: var(--n-s-sm); margin-top: var(--n-s-sm); }
    .sw { background: var(--bg); color: var(--ink); border-radius: var(--n-r-tile); padding: var(--n-s-md) var(--n-s-lg); height: 112px; display: grid; grid-template-rows: auto 1fr auto auto; }
    .sw .lbl { font-size: .72em; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .72; }
    .sw .say { font-family: var(--n-display); font-weight: 800; font-size: 1.3em; align-self: end; }
    .sw .sub { font-size: .85em; font-weight: 600; opacity: .78; }
    .sw .acc { display: block; height: 6px; border-radius: var(--n-r-xs); background: var(--accent); margin-top: var(--n-s-xs); }
    .srow { display: grid; grid-template-columns: 18px 18px 70px 1fr; gap: var(--n-s-md); align-items: center; padding: var(--n-s-sm) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
    .dot { width: 14px; height: 14px; border-radius: 50%; }
    .kbar { height: 32px; border-radius: var(--n-r-sm); margin-top: var(--n-s-md); }
    .krow { display: flex; justify-content: space-between; font-size: .75em; opacity: .6; font-weight: 700; }
    .trow { display: grid; grid-template-columns: 1fr 1fr; gap: var(--n-s-lg); align-items: center; padding: var(--n-s-md) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
    .lbl { font-size: var(--n-lbl-size); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .72; }
    .say { font-family: var(--n-display); font-weight: 800; font-size: var(--n-say-size); } .say.big { font-size: var(--n-say-big); line-height: 1; }
    .sub { font-size: var(--n-sub-size); font-weight: 600; opacity: .78; }
    .shapes { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 72px; grid-auto-flow: dense; gap: var(--n-gap); }
    .shp { background: var(--secondary-background-color, #eef0f5); border-radius: var(--n-r-tile); padding: var(--n-s-md); font-weight: 700; }
    table { border-collapse: collapse; width: 100%; font-size: .9em; }
    td { padding: var(--n-s-xs) var(--n-s-md) var(--n-s-xs) 0; border-bottom: 1px solid rgba(127,127,127,.15); }
    .sp { display: block; height: 14px; background: #a78bfa; border-radius: var(--n-r-xs); }
  `];
}
customElements.define("nice-design", NiceDesign);

export class NiceViz extends NiceCard {
  watch() { return [this.config.sun]; }
  // A copy of hass with each group's made-up tiles sensor, and services switched off
  _fake(i) {
    const id = `sensor.nice_viz_${i}`, h = this._real;
    return { ...h, states: { ...h.states, [id]: { entity_id: id, state: "ok", attributes: { tiles: VIZ_GROUPS[i].tiles } } }, callService: () => Promise.resolve() };
  }
  hassChanged() {
    // The examples never change, so only pass hass on every five minutes or when night flips
    if (this._fed && Date.now() - this._fed < 300000 && this._night === this.night) return;
    this._fed = Date.now(); this._night = this.night;
    this.renderRoot?.querySelectorAll?.("nice-grid").forEach((g) => { g.hass = this._fake(Number(g.dataset.i)); });
  }
  firstUpdated() { this._fed = 0; this.hassChanged(); }
  // The examples are tier 1 so they always show; alert_charts keeps their charts, which the
  // house grid leaves off alerts
  render() {
    return html`<div class="wrap"><header><h1>Visualizations</h1><p class="lead">Every chart the grid can draw, on example tiles drawn by the real grid. History charts read the real sensors; the buttons here do nothing.</p></header>
      ${VIZ_GROUPS.map((g, i) => html`<section><h2>${g.name}</h2><p class="lead">${g.note}</p>
        <nice-grid data-i=${i} .config=${{ ...NiceCard.defaults, entities: [`sensor.nice_viz_${i}`], routes: {}, budget: 99, todo: "todo.none", alert_charts: true }}></nice-grid>
        <table>${g.rows.map(([t, f]) => html`<tr><td><b>${t}</b></td><td>${layoutOf({ type: t })}</td><td>${f}</td></tr>`)}</table></section>`)}</div>`;
  }
  getCardSize() { return 40; }
  static styles = [tokens, css`
    :host { color: var(--primary-text-color, #1c2233); font-family: var(--n-body); }
    .wrap { display: grid; gap: calc(var(--n-s-xl) + var(--n-s-sm)); }
    h1 { font-family: var(--n-display); font-weight: 800; font-size: 2.2em; margin: 0; } h2 { font-family: var(--n-display); font-weight: 800; font-size: 1.45em; margin: 0; }
    .lead { opacity: .7; margin: 0 0 var(--n-s-md); font-weight: 600; font-size: .92em; }
    table { border-collapse: collapse; width: 100%; font-size: .85em; margin-top: var(--n-s-md); }
    td { padding: var(--n-s-xs) var(--n-s-md) var(--n-s-xs) 0; border-bottom: 1px solid rgba(127,127,127,.15); vertical-align: top; }
  `];
}
customElements.define("nice-viz", NiceViz);
