// nice-controls: any entities as packed tiles. Each kind of device has an adapter
// (adapters/) that says what its tile shows and does; this card only packs them. Tap runs
// the obvious thing (toggle, play/pause, lock), press and hold opens the details. With more
// than one switchable thing, an All on/off button sits in the header.
//
//   type: custom:nice-controls
//   title: Lights
//   strip: [Living Room]          prefixes taken off names
//   room_tone: 0                  the room's colour for things that are on
//   all: false                    hide All on/off
//   entities:
//     - light.x | { entity, name, shape, chart: spark|bars|none, hours, days }
//     - { bars: [...], name, top }  { adaptive: switch.x, lights, min, max }
//     - { board: sensor.x }        { strip: light.x, palette, speed, intensity, reverse, freeze }
import { html, css, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { moreInfo } from "../core/nav.js";
import { controlStyles } from "../controls/index.js";
import { pack, twoThreeFour, SHAPES, Columns } from "../layout/pack.js";
import { place } from "../tile/tile.js";
import { ChartData } from "../tile/data.js";
import { adapterFor, isOn, TOGGLE } from "../adapters/registry.js";
import { domainOf } from "../data/entities.js";
import "../adapters/devices.js";
import "../adapters/forms.js";

export class NiceControls extends NiceCard {
  static required = ["entities"];
  static defaults = { title: "", tone: null, room_tone: null, strip: null, all: null, spark_hours: 24 };
  constructor() { super(); this.columns = new Columns(this, twoThreeFour(420)); this.data = new ChartData(this); }

  configChanged() {
    this.entries = this.config.entities.map((e) => (typeof e === "string" ? { entity: e } : e)).map((e) => ({ e, ...adapterFor(e) }));
  }
  watch() {
    const ctx = { config: this.config };
    return this.entries.flatMap(({ e, form, adapter }) => (adapter?.watch ? adapter.watch(e, ctx) : form === "entity" ? [e.entity] : []));
  }

  more(id) { moreInfo(this, id); }
  flash(id) { this.ran = id; this.refresh(); clearTimeout(this._ranT); this._ranT = setTimeout(() => { this.ran = null; this.refresh(); }, 2000); }

  // Which lights an Adaptive Lighting zone in this card has let go of (changed by hand), for
  // what the zone adapts: a zone with brightness off doesn't count a dimmed light
  manualOf(e) {
    const a = this.hass.states[e.adaptive]?.attributes || {};
    const bri = this.hass.states[`${e.adaptive}_adapt_brightness`]?.state !== "off", col = this.hass.states[`${e.adaptive}_adapt_color`]?.state !== "off";
    const held = a.manual_control_brightness || a.manual_control_color
      ? [...(bri ? a.manual_control_brightness || [] : []), ...(col ? a.manual_control_color || [] : [])] : a.manual_control || [];
    return [...new Set(held)].filter((l) => !(e.lights || []).length || e.lights.includes(l));
  }
  manual(eid) {
    const s = this.hass.states[eid], members = [eid, ...(Array.isArray(s?.attributes?.entity_id) ? s.attributes.entity_id : [])];
    return this.entries.some(({ e }) => e.adaptive && (this.hass.states[e.adaptive]?.attributes?.manual_control || []).some((m) => members.includes(m)));
  }

  render() {
    const h = this.hass, cols = this.columns.cols;
    const ctx = { hass: h, night: this.night, cols, config: this.config, card: this, series: (v) => this.data.of(v), manual: (id) => this.manual(id), manualOf: (e) => this.manualOf(e) };
    let tiles = this.entries.map(({ e, form, adapter }, i) => {
      const s = form === "entity" ? h.states[e.entity] : form === "strip" ? h.states[e.strip] : null;
      if ((form === "entity" || form === "strip") && !s) return null;
      let shape = e.shape || adapter.shape(s, ctx);
      // Under four columns a big chart takes the whole row; a big control shrinks to wide
      if (shape === "L" && cols < 4) shape = form === "entity" && domainOf(e.entity) === "sensor" ? "FL" : "W";
      return { e, form, adapter, s, i, shape };
    }).filter(Boolean);
    // Rather than stretch one lonely tile across the last row, widen a few small ones (busy
    // ones first) so the cells come out even
    const used = tiles.reduce((n, t) => n + Math.min(SHAPES[t.shape][0], cols) * SHAPES[t.shape][1], 0);
    let spare = (cols - (used % cols)) % cols;
    for (const t of tiles.filter((x) => x.s && x.form === "entity" && x.shape === "S").sort((a, b) => Number(isOn(b.s)) - Number(isOn(a.s)))) { if (!spare) break; t.shape = "W"; spare -= 1; }
    tiles = tiles.map((t) => {
      const d = t.adapter.build(t.e, t.s, ctx, t.i, t.shape);
      return d && { ...d, id: d.id || `${t.form}-${t.i}`, shape: t.shape, still: true };
    }).filter(Boolean);
    this.data.want(tiles.map((t) => t.viz).filter(Boolean));
    const packed = pack(tiles, cols).tiles;

    // One switch for everything switchable here
    const switchable = this.entries.map(({ e }) => e.strip || e.entity).filter((id) => id && (TOGGLE.has(domainOf(id))) && h.states[id] && h.states[id].state !== "unavailable");
    const any = switchable.some((id) => h.states[id].state === "on");
    const all = this.config.all !== false && switchable.length > 1
      ? html`<button class="pill all" @click=${() => this.callEntity(any ? "homeassistant.turn_off" : "homeassistant.turn_on", switchable)}>${any ? "All off" : "All on"}</button>` : nothing;
    return html`${this.config.title || all !== nothing ? html`<div class="head"><span class="title">${this.config.title}</span>${all}</div>` : nothing}
      <div class="grid" style="--cols:${cols}">${repeat(packed, (t) => t.id, (t) => html`<nice-tile style=${place(t)} .tile=${t} .series=${this.data.of(t.viz)} ?night=${this.night}></nice-tile>`)}</div>`;
  }

  getCardSize() { return Math.ceil((this.config?.entities?.length || 2) / 2) + 1; }
  static styles = [tokens, controlStyles, css`
    :host { font-family: var(--n-body); container-type: inline-size; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: var(--n-s-md); margin: var(--n-s-sm) var(--n-s-2xs) var(--n-s-md); }
    .title { font-family: var(--n-display); font-weight: var(--n-title-weight); font-size: var(--n-title-size); letter-spacing: -0.01em; color: var(--primary-text-color, #1c2233); }
    .all { background: var(--primary-text-color, #1c2233); color: var(--card-background-color, #fff); }
    .grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--n-row), auto); gap: var(--n-gap); }
  `];
}
customElements.define("nice-controls", NiceControls);
