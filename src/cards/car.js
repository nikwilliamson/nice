// nice-car: one Tesla (tesla_fleet) as six tiles: where it is and its battery, the car from
// above with whatever is open lit up, the cabin, charging and the limit, sentry, and music.
// Tap a tile for its one safe action (sentry on/off, play/pause), otherwise its details;
// press and hold always opens the details. Unlocking takes two taps.
//
// tesla_fleet reports missing body data (a sleeping car, or just after a restart) as frunk
// and trunk "open". The lids are only trusted while the lock knows its own state.
//
//   type: custom:nice-car
//   car: nik            entity prefix: lock.nik_s_car_lock, sensor.nik_s_car_battery_level, …
//   name: Nik's         title reads "Nik's car"
import { html, css, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { repeat } from "lit/directives/repeat.js";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { tone, offTone } from "../core/tones.js";
import { num, span } from "../core/format.js";
import { moreInfo } from "../core/nav.js";
import { newestChange } from "../data/entities.js";
import { pack, Columns } from "../layout/pack.js";
import { place } from "../tile/tile.js";
import { carOverhead, DOORS } from "../illus/car.js";
import { statusTag, headStyles } from "./head.js";
import { formEditor } from "../editors/form.js";
import { CAR } from "../editors/specs.js";

export class NiceCar extends NiceCard {
  static getConfigElement() { return formEditor(CAR); }
  static required = ["car"];
  static defaults = { name: null, model: null };
  constructor() { super(); this.columns = new Columns(this); }
  connectedCallback() { super.connectedCallback(); this.every(30000); }

  id(domain, key) { return `${domain}.${this.config.car}_s_car_${key}`; }
  s(domain, key) { return this.hass.states[this.id(domain, key)]; }
  st(domain, key) { return this.s(domain, key)?.state; }
  watch() {
    if (!this._mine || Date.now() - this._mineAt > 60000) {
      const p = `${this.config.car}_s_car_`;
      this._mine = Object.keys(this._real.states).filter((e) => e.split(".")[1].startsWith(p));
      this._mineAt = Date.now();
    }
    return this._mine;
  }
  more(id) { moreInfo(this, id); }
  act(domain, service, key, data = {}) { return this.callEntity(`${domain}.${service}`, this.id(domain, key), data); }

  // Steppers: taps add up on screen and go out as one call once they stop
  stepTo(id, change, send) { this.pending.set(id, change, { ttl: 30000 }); this.pending.later(id, 700, send); }

  tag() {
    const status = this.s("binary_sensor", "status"), newest = newestChange(this.hass, `${this.config.car}_s_car_`), heard = newest && span(newest);
    if (status?.state === "on") return statusTag("ok", `Online · ${heard ? `${heard} ago` : "just now"}`);
    if (status?.state === "off") { const since = span(status.last_changed); return statusTag("locked", since ? `Asleep for ${since}` : "Just fell asleep"); }
    return statusTag("warn", heard ? `Offline · last heard ${heard} ago` : "Offline");
  }

  hero() {
    const n = this.night, lock = this.st("lock", "lock"), where = this.st("device_tracker", "location");
    const pct = num(this.st("sensor", "battery_level")), range = num(this.st("sensor", "battery_range")), limit = num(this.st("number", "charge_limit")) ?? 80;
    const charging = this.st("sensor", "charging") === "charging", plugged = this.st("binary_sensor", "charge_cable") === "on";
    const home = where === "home", unlocked = lock === "unlocked", known = lock && !["unknown", "unavailable"].includes(lock);
    const place_ = where && !["home", "not_home", "unknown", "unavailable"].includes(where) ? this.hass.states[`zone.${where}`]?.attributes?.friendly_name || where : null;
    const say = charging ? `Charging to ${Math.round(limit)}%`
      : unlocked ? (home ? "Unlocked in the driveway" : "Left unlocked")
      : pct != null && pct < 20 ? (home && !plugged ? "Running low. Plug it in?" : "Running low")
      : home ? (plugged ? "Parked and plugged in" : known ? "Parked and locked" : "Parked at home") : "Out and about";
    const lim = pct != null ? Math.max(pct, Math.min(100, limit)) : null, full = range && pct > 0 ? Math.round((range / pct) * lim) : null;
    return {
      id: "hero", shape: "L", label: home ? "At home" : place_ || (where === "not_home" ? "Out" : "Somewhere"),
      colors: unlocked || (pct != null && pct < 20) ? tone("act", n) : tone("car", n), say, sub: known ? "" : "Details once it wakes",
      viz: pct != null ? { type: "charge", value: pct, limit: lim, gain: plugged || charging, live: charging, warn: 20,
        left: [`${Math.round(pct)}%`, range != null ? ` · ${Math.round(range)} mi` : ""], right: [`${Math.round(lim)}%`, ` limit${full ? ` · ${full} mi` : ""}`] } : null,
      layout: "foot", tap: () => this.more(this.id("lock", "lock")), hold: () => this.more(this.id("lock", "lock")),
      controls: [{ type: "pills", items: [
        lock === "locked" ? { label: "Unlock", confirm: "unlock", armed: "Tap again to unlock", run: () => this.act("lock", "unlock", "lock") } : unlocked ? { label: "Lock it", sel: true, run: () => this.act("lock", "lock", "lock") } : null,
        this.st("binary_sensor", "status") === "on" ? null : { label: "Wake", run: () => this._real.callService("button", "press", { entity_id: this.id("button", "wake") }) },
      ] }],
    };
  }

  body() {
    const n = this.night, lock = this.st("lock", "lock"), fresh = lock && !["unknown", "unavailable"].includes(lock), open = [];
    const part = (eid, isOpen, label, guarded) => {
      const s = this.hass.states[eid];
      if (!s) return { cls: "gone", eid };
      if (guarded && !fresh) return { cls: "unk", eid };
      if (isOpen(s.state)) { open.push(label); return { cls: "open", eid }; }
      return { cls: "", eid };
    };
    const on = (st) => st === "on", opened = (st) => st === "open" || st === "opening", d = {}, w = {};
    DOORS.forEach(([k, label]) => {
      d[k] = part(this.id("binary_sensor", `${k}_door`), on, `${label.toLowerCase()} door`);
      w[k] = part(this.id("binary_sensor", `${k}_window`), on, `${label.toLowerCase()} window`);
    });
    const frunk = part(this.id("cover", "frunk"), opened, "frunk", true), trunk = part(this.id("cover", "trunk"), opened, "trunk", true);
    const port = part(this.id("cover", "charge_port_door"), opened, "charge port"), vent = this.st("cover", "windows") === "open";
    const say = open.length === 0 ? "Everything's shut" : open.length === 1 ? `The ${open[0]} is open` : `${open.length} things are open`;
    const sub = !fresh ? "Frunk and trunk show up once it wakes" : open.length > 1 ? open.join(", ").replace(/^./, (c) => c.toUpperCase()) : vent ? "Windows are venting" : "Doors, windows, frunk and trunk";
    // Model 3 (and S) have a trunk deck behind the rear glass; Model Y (and X) a short liftgate
    const dev = this.hass.devices?.[this.hass.entities?.[this.id("lock", "lock")]?.device_id];
    const sedan = /^(3|s)$/i.test(String(this.config.model || dev?.model || "").replace(/^model\s*/i, "").trim());
    const svg = carOverhead({ d, w, frunk, trunk, port, vent, sedan, label: say, title: (p) => this.hass.states[p.eid]?.attributes?.friendly_name || p.eid });
    const tapPart = (ev) => { const p = ev.composedPath().find((x) => x.dataset?.more); if (p) { ev.stopPropagation(); this.more(p.dataset.more); } };
    return { id: "body", shape: "L", label: "Doors & trunks", colors: open.length ? tone("act", n) : tone("health", n), say, sub,
      picture: html`<div class="pic" @click=${tapPart}>${unsafeHTML(svg)}</div>`, tap: () => this.more(this.id("lock", "lock")), hold: () => this.more(this.id("lock", "lock")) };
  }

  cabin(shape) {
    const n = this.night, s = this.s("climate", "climate");
    if (!s) return { id: "clim", shape, label: "Cabin", colors: offTone(n), say: "Not here" };
    const a = s.attributes, quiet = ["unknown", "unavailable"].includes(s.state), on = !quiet && s.state !== "off";
    const inside = num(this.st("sensor", "inside_temperature")) ?? a.current_temperature, outside = num(this.st("sensor", "outside_temperature")), set = a.temperature;
    const step = (dir) => {
      const cur = this.hass.states[s.entity_id].attributes.temperature ?? 70;
      const next = Math.max(a.min_temp ?? 59, Math.min(a.max_temp ?? 82.5, Math.round(cur + dir)));
      this.stepTo(s.entity_id, { attrs: { temperature: next } }, () => this.act("climate", "set_temperature", "climate", { temperature: next }));
    };
    return { id: "clim", shape, label: "Cabin", colors: on ? tone("climate", n) : offTone(n), cls: ["climate"],
      say: inside != null ? `${Math.round(inside)}° inside` : "Cabin",
      sub: quiet ? "Asleep · last reading" : on ? `Getting it to ${Math.round(set)}°` : outside != null ? `${Math.round(outside)}° outside · off` : "Off",
      tap: () => this.more(s.entity_id), hold: () => this.more(s.entity_id),
      controls: [{ type: "between", items: [on && set != null ? { type: "setpoint", value: Math.round(set), step, less: "Cooler", more: "Warmer" } : null,
        { type: "pills", items: [{ label: on ? "Turn off" : "Cool or warm it", sel: !on, run: () => this.act("climate", on ? "turn_off" : "turn_on", "climate") }] }].filter(Boolean) }] };
  }

  charging(shape) {
    const n = this.night, st = this.st("sensor", "charging");
    const plugged = this.st("binary_sensor", "charge_cable") === "on" || ["charging", "starting", "stopped", "complete", "no_power"].includes(st);
    const kw = num(this.st("sensor", "charger_power")), limit = num(this.st("number", "charge_limit")), added = num(this.st("sensor", "charge_energy_added"));
    const full = this.st("sensor", "time_to_full_charge"), fullAt = full && !["unknown", "unavailable"].includes(full) ? new Date(full) : null;
    const say = { charging: kw ? `Charging at ${kw} kW` : "Charging", starting: "Starting to charge", complete: `Full to ${limit != null ? Math.round(limit) + "%" : "the limit"}`,
      stopped: "Plugged in, paused", no_power: "Plugged in, no power", disconnected: "Not plugged in" }[st] || "Charging";
    const sub = st === "charging" && fullAt && !Number.isNaN(fullAt.getTime()) ? `Done by ${fullAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : added ? `Last session added ${Math.round(added * 10) / 10} kWh` : "";
    const lim = this.s("number", "charge_limit")?.attributes || {}, limId = this.id("number", "charge_limit");
    // The limit moves in steps of five
    const step = (dir) => {
      const cur = num(this.hass.states[limId]?.state);
      if (cur == null) return;
      const next = Math.max(lim.min ?? 50, Math.min(lim.max ?? 100, Math.round(cur / 5) * 5 + dir * 5));
      this.stepTo(limId, { state: String(next) }, () => this._real.callService("number", "set_value", { entity_id: limId, value: next }));
    };
    const go = plugged && this.s("switch", "charge");
    return { id: "chg", shape, label: "Charging · limit", colors: st === "charging" || st === "starting" ? tone("energy", n) : offTone(n), say, sub,
      tap: () => this.more(this.id("sensor", "charging")), hold: () => this.more(this.id("sensor", "charging")),
      controls: [{ type: "between", items: [limit != null ? { type: "setpoint", value: Math.round(limit), unit: "%", step, less: "Lower limit", more: "Raise limit" } : null,
        go ? { type: "pills", items: [{ label: st === "charging" ? "Stop" : "Start charging", sel: st !== "charging", run: () => this.act("switch", st === "charging" ? "turn_off" : "turn_on", "charge") }] } : null].filter(Boolean) }] };
  }

  sentry(shape) {
    const st = this.st("switch", "sentry_mode"), on = st === "on", id = this.id("switch", "sentry_mode"), ok = st && st !== "unavailable";
    return { id: "sen", shape, label: "Sentry mode", colors: on ? tone("plan", this.night) : offTone(this.night),
      say: !ok ? "Offline" : on ? "Watching" : "Off", sub: on ? "Recording" : "Not recording",
      tap: () => (ok ? this.act("switch", "toggle", "sentry_mode") : this.more(id)), hold: () => this.more(id),
      controls: shape === "S" ? [] : [{ type: "pills", items: [{ label: on ? "Turn off" : "Turn on", run: () => this.act("switch", "toggle", "sentry_mode") }] }] };
  }

  music(shape) {
    const s = this.s("media_player", "media_player"), st = s?.state, a = s?.attributes || {}, id = this.id("media_player", "media_player");
    const playing = st === "playing", busy = playing || st === "paused";
    return { id: "mus", shape, label: "Music", colors: playing ? tone("media", this.night) : offTone(this.night), cls: ["media", playing ? "on" : "off"],
      say: busy ? a.media_title || (playing ? "Playing" : "Paused") : st === "idle" ? "Idle" : "Off",
      sub: busy ? [a.media_artist, a.source].filter(Boolean).join(" · ") || (playing ? "" : "Paused") : "",
      tap: () => (busy ? this.act("media_player", "media_play_pause", "media_player") : this.more(id)), hold: () => this.more(id),
      controls: busy && shape !== "S" ? [{ type: "pills", items: [{ label: playing ? "Pause" : "Play", run: () => this.act("media_player", "media_play_pause", "media_player") },
        { label: "Next", run: () => this.act("media_player", "media_next_track", "media_player") }] }] : [] };
  }

  render() {
    const cols = this.columns.cols, small = cols < 4 ? "S" : "W";
    const tiles = pack([this.hero(), this.body(), this.cabin("W"), this.charging("W"), this.sentry(small), this.music(small)].map((t) => ({ ...t, still: true })), cols).tiles;
    return html`<div class="head"><span class="title">${this.config.name || this.config.car} car</span>${this.tag()}</div>
      <div class="grid" style="--cols:${cols}">${repeat(tiles, (t) => t.id, (t) => html`<nice-tile style=${place(t)} .tile=${t} ?night=${this.night}></nice-tile>`)}</div>`;
  }

  getCardSize() { return 8; }
  static styles = [tokens, headStyles, css`.grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--n-row), auto); gap: var(--n-gap); }`];
}
customElements.define("nice-car", NiceCar);
