// nice-grid: the landing grid. Reads every sensor.nice_tiles_* (or the sensors listed in
// `entities`), merges their tiles, picks what fits and packs it. Every decision about WHAT
// to show is made by the rules (custom_templates/nice/); this card only decides WHERE.
//
//   type: custom:nice-grid
//   base_path: /house-nice
//   routes: { kitchen: room-kitchen, cats: tab:cats }   tile tap → view path or tab:<id>
//   todo: todo.house_alerts                              where chores are ticked and added
//   min_tiles: 11                                        never fewer tiles than this
//   alert_charts: false                                  hazard and act-now tiles (tier 0 and 1)
//                                                        show their words and buttons, no chart
import { html, css } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { go, moreInfo } from "../core/nav.js";
import { choose, bestPack, ordered, Columns } from "../layout/pack.js";
import { chart } from "../charts/index.js";
import { place } from "../tile/tile.js";
import { formEditor } from "../editors/form.js";
import { GRID } from "../editors/specs.js";

const PREFIX = "sensor.nice_tiles_";

export class NiceGrid extends NiceCard {
  static getConfigElement() { return formEditor(GRID); }
  static defaults = { entities: null, base_path: null, routes: null, todo: "todo.house_alerts", budget: 20, min_tiles: 11, alert_charts: false };
  static styles = [tokens, css`
    :host { container-type: inline-size; }
    .grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--n-row), auto); gap: var(--n-gap); }
  `];

  constructor() {
    super();
    this.columns = new Columns(this);
    this._data = new Map(); // chart data by its key: { at, value }
  }

  // The tile sensors: listed, or every sensor.nice_tiles_* (looked up again once a minute)
  sources() {
    if (this.config.entities) return [].concat(this.config.entities);
    if (!this._src || Date.now() - this._srcAt > 60000) {
      this._src = Object.keys(this._real?.states || {}).filter((id) => id.startsWith(PREFIX)).sort();
      this._srcAt = Date.now();
    }
    return this._src;
  }
  watch() { return this.sources(); }

  // Tiles as the rules sent them, merged and ordered
  tiles() {
    const all = this.sources().flatMap((id) => this.hass.states[id]?.attributes?.tiles || []);
    return ordered(all);
  }

  // What a tap, a button or a tick does, in the browser
  describe(t) {
    const c = this.config, call = (svc, entity, data) => this.callEntity(svc, entity, data);
    const d = { ...t, tap: t.tap ? () => go(this, c.routes, c.base_path, t.tap) : null, hold: t.entity ? () => moreInfo(this, t.entity) : null };
    // An alert says what's wrong and what to do; a chart only gets in the way. Buttons and
    // lists are things to do, so they stay.
    if (!c.alert_charts && (t.tier ?? 3) <= 1 && t.viz && !["list", "buttons"].includes(t.viz.type)) d.viz = null;
    if (t.act?.type === "navigate") d.act = { ...t.act, run: () => go(this, c.routes, c.base_path, t.act.path) };
    else if (t.act?.type === "service") d.act = { ...t.act, run: () => call(t.act.service, t.act.entity_id, t.act.data || {}) };
    else if (t.act?.type === "todo_add") d.act = { ...t.act, add: (text) => this.call("todo", "add_item", { item: text.toUpperCase() }, { entity_id: t.act.entity_id || c.todo }) };
    if (t.viz?.type === "list") d.viz = { ...t.viz, tick: (uid) => this.call("todo", "update_item", { item: uid, status: "completed" }, { entity_id: c.todo }) };
    if (t.viz?.type === "buttons" || t.viz?.type === "funky") d.viz = { ...t.viz, items: (t.viz.items || []).map((b) => ({ ...b, run: () => call(b.service, b.entity_id, b.data || {}) })) };
    return d;
  }

  // History for the charts that need it, refreshed every five minutes
  _load(tiles) {
    for (const t of tiles) {
      const spec = t.viz && chart(t.viz.type)?.data?.(t.viz);
      if (!spec) continue;
      const have = this._data.get(spec.key);
      if (have && (have.loading || Date.now() - have.at < 300000)) continue;
      this._data.set(spec.key, { ...have, loading: true, at: have?.at || 0 });
      spec.load(this._real).then((value) => { this._data.set(spec.key, { at: Date.now(), value }); this.requestUpdate(); });
    }
  }
  seriesOf(t) { const spec = t.viz && chart(t.viz.type)?.data?.(t.viz); return spec ? this._data.get(spec.key)?.value : undefined; }

  render() {
    const cols = this.columns.cols;
    const shown = bestPack(choose(this.tiles(), this.config.budget, this.config.min_tiles), cols);
    this._load(shown);
    return html`<div class="grid" style="--cols:${cols}">${repeat(shown, (t) => t.id, (t) => html`<nice-tile style=${place(t)} .tile=${this.describe(t)} .series=${this.seriesOf(t)} ?night=${this.night}></nice-tile>`)}</div>`;
  }

  getCardSize() { return 8; }
}
customElements.define("nice-grid", NiceGrid);
