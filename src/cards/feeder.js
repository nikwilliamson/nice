// nice-feeder: Aqara C1 feeders (ZHA), one tile per cat: how many times they've been fed
// today and when last, with the feeder drawn beside it; under each, the meal schedule with
// Pause, and the feeder's lock and light. Feeding is never a tile tap.
//
//   type: custom:nice-feeder
//   feeders: [{ name: Zig, feeder: zigs_food }]   entity prefix: sensor.zigs_food_portions_dispensed_today, …
//   schedule: automation.cats_feeding_schedule   Home Assistant runs the meals
//   meals: [{ at: "07:00", portions: 4 }]        what that automation does, for the schedule tile
//   heading: Food
//
// nice-snack: one full-width "Snack time!" tile; Serve takes two taps.
//
//   type: custom:nice-snack
//   script: script.cats_feed     called with { portions }
//   portions: 1
//   names: [Donut, Zig]
//   feeders: [zigs_food, donuts_food]   for "offline"
import { html, css, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { repeat } from "lit/directives/repeat.js";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { tone, offTone, CAT_TONES } from "../core/tones.js";
import { num, isToday, when } from "../core/format.js";
import { moreInfo } from "../core/nav.js";
import { pack, Columns } from "../layout/pack.js";
import { place } from "../tile/tile.js";
import { fdFeeder, fdClock } from "../illus/feeder.js";
import { headStyles } from "./head.js";
import { formEditor } from "../editors/form.js";
import { FEEDER, SNACK } from "../editors/specs.js";

const gridStyles = css`.grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--n-row), auto); gap: var(--n-gap); }`;

export class NiceFeeder extends NiceCard {
  static getConfigElement() { return formEditor(FEEDER); }
  static required = ["feeders"];
  static defaults = { schedule: null, meals: [], heading: null };
  constructor() { super(); this.columns = new Columns(this, (w) => (w && w < 560 ? 2 : 4)); this._feeds = {}; }
  connectedCallback() { super.connectedCallback(); this.every(60000); } // the day's rollover resets "fed twice"

  id(f, domain, key) { return `${domain}.${f.feeder}_${key}`; }
  st(f, domain, key) { return this.hass.states[this.id(f, domain, key)]?.state; }
  watch() {
    return [this.config.schedule, ...this.config.feeders.flatMap((f) => ["button.feed", "sensor.portions_dispensed_today", "binary_sensor.problem", "switch.child_lock", "switch.led_indicator"]
      .map((k) => { const [d, key] = k.split("."); return this.id(f, d, key); }))].filter(Boolean);
  }

  // Feeds since yesterday morning from the portions counter's history: each rise is food
  // coming out, and rises within two minutes of each other are one feed. Fetched again
  // whenever a counter changes.
  async _history() {
    const ids = this.config.feeders.map((f) => this.id(f, "sensor", "portions_dispensed_today"));
    const key = ids.map((e) => this.hass.states[e]?.last_changed).join("|") + new Date().toDateString();
    if (this._busy || key === this._histKey) return;
    this._busy = true;
    try {
      const start = new Date(Date.now() - 86400000); start.setHours(0, 0, 0, 0);
      const res = await this._real.callWS({ type: "history/history_during_period", start_time: start.toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      for (const id of ids) {
        const feeds = [];
        let prev = null;
        for (const row of res[id] || []) {
          const v = parseFloat(row.s), at = (row.lu ?? row.lc) * 1000;
          if (!Number.isNaN(v) && prev != null && v > prev) { if (feeds.length && at - feeds[feeds.length - 1] < 120000) feeds[feeds.length - 1] = at; else feeds.push(at); }
          if (!Number.isNaN(v)) prev = v;
        }
        this._feeds[id] = feeds;
      }
      this._histKey = key;
      this.requestUpdate();
    } catch (e) { this._histKey = key; } finally { this._busy = false; }
  }

  feeder(f, i) {
    const h = this.hass, n = this.night, ptId = this.id(f, "sensor", "portions_dispensed_today"), pt = h.states[ptId], feed = h.states[this.id(f, "button", "feed")];
    const off = !feed || feed.state === "unavailable" || pt?.state === "unavailable", problem = this.st(f, "binary_sensor", "problem") === "on";
    const portions = pt && isToday(pt.last_changed) ? Math.round(num(pt.state) ?? 0) : 0;
    const feeds = this._feeds[ptId], today = feeds ? feeds.filter((at) => isToday(new Date(at).toISOString())).length : null;
    const lastAt = feeds?.length ? new Date(feeds[feeds.length - 1]).toISOString() : portions ? pt.last_changed : null;
    const times = (k) => ["Not fed yet", "Fed once today", "Fed twice today"][k] || `Fed ${k} times today`;
    const svg = fdFeeder({ portions, led: this.st(f, "switch", "led_indicator") === "on", locked: this.st(f, "switch", "child_lock") === "on", off, problem });
    return { id: `f-${i}`, shape: "W", label: f.name || "Feeder", cls: ["aside"],
      colors: problem ? tone("hazard", n) : off ? offTone(n) : tone(f.tone || CAT_TONES[i % CAT_TONES.length], n),
      say: off ? "Offline" : problem ? "Needs a look" : today != null ? times(today) : portions ? "Fed today" : "Not fed yet",
      sub: lastAt ? `Last fed at ${when(lastAt)}` : "", picture: html`<div class="pic">${unsafeHTML(svg)}</div>`,
      tap: () => moreInfo(this, ptId), hold: () => moreInfo(this, ptId) };
  }

  schedule(f, i) {
    const id = this.config.schedule, h = this.hass, n = this.night, on = h.states[id]?.state === "on";
    const off = !h.states[this.id(f, "button", "feed")] || this.st(f, "button", "feed") === "unavailable";
    const locked = this.st(f, "switch", "child_lock") === "on", led = this.st(f, "switch", "led_indicator") === "on";
    const meals = [...(this.config.meals || [])].sort((a, b) => a.at.localeCompare(b.at));
    const sw = (key) => () => this.callEntity("switch.toggle", this.id(f, "switch", key));
    return { id: `s-${i}`, shape: "W", label: [f.name, "Schedule"].filter(Boolean).join(" · "), colors: !off && on ? tone("chores", n) : offTone(n),
      say: on ? (meals.length ? meals.map((m) => fdClock(m.at)).join(" & ") : "On schedule") : "Schedule paused",
      sub: meals.length ? meals.map((m) => `${fdClock(m.at)} × ${m.portions}`).join(" · ") + (this.config.feeders.length > 1 ? " · both cats" : "") : `${locked ? "Buttons locked" : "Buttons unlocked"} · light ${led ? "on" : "off"}`,
      tap: () => moreInfo(this, id), hold: () => moreInfo(this, id),
      controls: [{ type: "between", items: [
        { type: "pills", items: [{ label: on ? "Pause" : "Resume", sel: !on, run: () => this.callEntity(on ? "automation.turn_off" : "automation.turn_on", id) }] },
        { type: "pills", items: [{ label: locked ? "Unlock" : "Lock", disabled: off, title: locked ? "Buttons locked" : "Buttons unlocked", run: sw("child_lock") }, { label: led ? "Light off" : "Light on", disabled: off, run: sw("led_indicator") }] },
      ] }] };
  }

  render() {
    this._history();
    const cols = this.columns.cols, F = this.config.feeders;
    // Side by side on a wide card: every cat's feeder, then every schedule. Stacked: each cat's pair together.
    const order = cols >= 4 ? [...F.map((f, i) => this.feeder(f, i)), ...(this.config.schedule ? F.map((f, i) => this.schedule(f, i)) : [])]
      : F.flatMap((f, i) => [this.feeder(f, i), this.config.schedule ? this.schedule(f, i) : null]).filter(Boolean);
    const tiles = pack(order.map((t) => ({ ...t, shape: cols >= 4 ? "W" : "F", still: true })), cols).tiles;
    return html`${this.config.heading ? html`<div class="head"><span class="title">${this.config.heading}</span></div>` : nothing}
      <div class="grid" style="--cols:${cols}">${repeat(tiles, (t) => t.id, (t) => html`<nice-tile style=${place(t)} .tile=${t} ?night=${this.night}></nice-tile>`)}</div>`;
  }

  getCardSize() { return 3; }
  static styles = [tokens, headStyles, gridStyles];
}
customElements.define("nice-feeder", NiceFeeder);

export class NiceSnack extends NiceCard {
  static getConfigElement() { return formEditor(SNACK); }
  static required = ["script"];
  static defaults = { title: "Snack time!", portions: 1, names: [], feeders: [], heading: null };
  watch() { return [this.config.script, ...this.config.feeders.map((p) => `button.${p}_feed`)]; }

  render() {
    const c = this.config, h = this.hass, s = h.states[c.script];
    const offline = c.feeders.filter((p) => { const b = h.states[`button.${p}_feed`]; return !b || b.state === "unavailable"; });
    const missing = !s || s.state === "unavailable", allOff = c.feeders.length > 0 && offline.length === c.feeders.length;
    const busy = this._sent || s?.state === "on"; // includes the script's minute of putting the feeders back
    const serve = () => {
      this._sent = true; this.refresh();
      const [domain, svc] = c.script.split(".");
      this._real.callService(domain, svc, { portions: c.portions });
      clearTimeout(this._doneT);
      this._doneT = setTimeout(() => { this._sent = false; this.refresh(); }, 5000);
    };
    const tile = { id: "snack", shape: "F", cls: ["snack"], label: c.names.length ? c.names.join(" & ") : "Snack", still: true,
      colors: missing || allOff ? offTone(this.night) : tone("chores", this.night), say: c.title,
      sub: missing ? "Can't find the feeding script" : offline.length ? `${allOff ? "The feeders are" : "A feeder is"} offline` : `Give ${c.names.length ? c.names.join(" and ") : "everyone"} a treat`,
      tap: () => moreInfo(this, c.script), hold: () => moreInfo(this, c.script),
      controls: [{ type: "pills", items: [{ label: busy ? "Serving…" : "Serve", sel: true, disabled: missing || allOff || busy, confirm: "snack", run: serve }] }] };
    return html`${c.heading ? html`<div class="head"><span class="title">${c.heading}</span></div>` : nothing}
      <div class="grid" style="--cols:1"><nice-tile style="grid-column:1" .tile=${tile} ?night=${this.night}></nice-tile></div>`;
  }

  getCardSize() { return 3; }
  static styles = [tokens, headStyles, gridStyles];
}
customElements.define("nice-snack", NiceSnack);
