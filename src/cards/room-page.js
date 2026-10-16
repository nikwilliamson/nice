// nice-room-page: a whole room page from what's in the area. The header (nice-room), then
// one nice-controls section per kind of thing found in the room, in this order:
//
//   Lights           lights (a light group stands in for its members), plus Adaptive Lighting
//   Scenes           the room's scenes and scripts
//   Climate          thermostats, temperature and humidity
//   Playing          media players
//   Doors & windows  locks, doors and windows
//   Motion           motion and occupancy, light levels
//   Plugs & more     switches and fans
//   Power            the circuits' power, as ranked bars
//
// Anything the area can't say is an override, by section title:
//
//   type: custom:nice-room-page
//   area: race_room
//   base_path: /house-nice
//   sections:
//     Scenes: { add: [script.lighting_race_mode], remove: [scene.x], all: false }
//     Lights: { entities: [...] }        replace the list outright
//     Motion: { hide: true }
//     Stream lights: { after: Lights, entities: [...] }    a section of your own (or before:)
//   cards: [ any card ]                  added after the sections
//
// Entities on the page come from the area at render time, so a device added to the room
// shows up without touching the dashboard.
import { html, css } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { areaOf, roomList, roomName, domainOf } from "../data/entities.js";
import "./rooms.js";
import "./controls.js";
import "./footer.js";

const ORDER = ["Lights", "Scenes", "Climate", "Playing", "Doors & windows", "Motion", "Plugs & more", "Power"];
const SENSING = { motion: "Motion", occupancy: "Motion", door: "Doors & windows", window: "Doors & windows", garage_door: "Doors & windows" };

export class NiceRoomPage extends NiceCard {
  static required = ["area"];
  static defaults = { base_path: null, back: "home", sections: {}, cards: [], areas: null, adaptive: null, footer: true };
  constructor() { super(); this._els = new Map(); this._helpers = window.loadCardHelpers?.(); }

  // What's in the room, sorted into sections
  found() {
    const h = this.hass, area = this.config.area;
    // What's usable in the room: not hidden, not a setting or diagnostic, not offline
    const ids = Object.keys(h.states).filter((id) => {
      const r = h.entities?.[id];
      return r && !r.hidden && !r.entity_category && h.states[id].state !== "unavailable" && areaOf(h, id) === area;
    });
    const devOf = (id) => h.entities?.[id]?.device_id;
    const onDevice = new Map();
    for (const id of ids) { const dv = devOf(id); if (dv) onDevice.set(dv, [...(onDevice.get(dv) || []), id]); }
    const siblings = (id) => onDevice.get(devOf(id)) || [];
    const isGroup = (id) => Array.isArray(h.states[id].attributes.entity_id);
    const lamps = ids.filter((id) => domainOf(id) === "light" && !isGroup(id));
    // A group stands in for its members, unless it's the whole room (the header already
    // switches the room); then the room's lights are listed one by one
    const groups = ids.filter((id) => domainOf(id) === "light" && isGroup(id)).filter((g) => {
      const members = h.states[g].attributes.entity_id.filter((m) => lamps.includes(m));
      return members.length && members.length < lamps.length * 0.8;
    });
    const grouped = new Set(groups.flatMap((g) => h.states[g].attributes.entity_id));
    const out = Object.fromEntries(ORDER.map((t) => [t, []]));
    for (const id of ids) {
      const s = h.states[id], d = domainOf(id), dc = s.attributes.device_class;
      const sib = siblings(id).map(domainOf);
      if (d === "light" && (groups.includes(id) || (!isGroup(id) && !grouped.has(id)))) out.Lights.push(id);
      else if (d === "scene" || d === "script") out.Scenes.push(id);
      else if (d === "climate") out.Climate.unshift(id);
      // A room thermometer, not the one inside a thermostat, motion sensor or light
      else if (d === "sensor" && (dc === "temperature" || dc === "humidity") && !sib.some((x) => ["climate", "light", "binary_sensor", "media_player"].includes(x))) out.Climate.push(id);
      else if (d === "media_player" && !/_s_car_/.test(id)) out.Playing.push(id);
      else if (d === "lock") out["Doors & windows"].unshift(id);
      else if (d === "binary_sensor" && SENSING[dc]) out[SENSING[dc]].push(id);
      else if (d === "sensor" && dc === "illuminance") out.Motion.push(id);
      else if ((d === "switch" && !/^switch\.adaptive_lighting_/.test(id)) || d === "fan") out["Plugs & more"].push(id);
      // A circuit's power, not a plug's (the plug's tile already says what it draws)
      else if (d === "sensor" && dc === "power" && !sib.includes("switch")) out.Power.push(id);
    }
    return { out, lights: lamps };
  }

  // The nice-controls configs for this room, overrides applied
  sections(list) {
    const { out, lights } = this.found(), ov = this.config.sections || {}, strip = [roomName(this.hass, this.config.area)];
    const tone = Math.max(0, (list?.areas || []).indexOf(this.config.area));
    const adaptive = [].concat(list?.adaptive?.[this.config.area] || []);
    const made = ORDER.map((title) => {
      const o = ov[title] || {};
      if (o.hide) return null;
      let entities = o.entities || [...out[title].filter((e) => !(o.remove || []).includes(e)), ...(o.add || [])];
      if (title === "Lights" && !o.entities) entities = [...entities, ...adaptive.map((sw) => ({ adaptive: sw, name: "Adaptive", lights }))];
      if (title === "Power" && !o.entities && entities.length) entities = [{ name: "Circuits", shape: "F", bars: entities }];
      if (!entities.length) return null;
      return { title, strip, room_tone: tone, all: ["Scenes", "Doors & windows", "Climate"].includes(title) ? false : undefined, ...o, entities };
    }).filter(Boolean);
    // Sections of your own go before or after the one they name, or at the end
    for (const [title, o] of Object.entries(ov)) {
      if (ORDER.includes(title) || o.hide) continue;
      const before = o.before ? made.findIndex((m) => m.title === o.before) : -1, after = o.after ? made.findIndex((m) => m.title === o.after) : -1;
      made.splice(before >= 0 ? before : after >= 0 ? after + 1 : made.length, 0, { title, strip, room_tone: tone, ...o });
    }
    return made.map(({ add, remove, after, before, hide, ...cfg }) => cfg);
  }

  // Children are real cards, kept between renders and handed every hass update
  _child(key, make) {
    if (!this._els.has(key)) this._els.set(key, make());
    const el = this._els.get(key);
    el.hass = this._real;
    return el;
  }
  // The children handle their own states; this page only redraws when something joins or
  // leaves the house (and so maybe the room)
  watch() { return []; }
  hassChanged(prev, h) {
    for (const el of this._els.values()) el.hass = h;
    const n = Object.keys(h.states).length;
    if (n !== this._n) { this._n = n; this.requestUpdate(); }
  }

  render() {
    const c = this.config;
    if (!c.areas && this._shared === undefined && !this._asking) this._asking = roomList(this._real, c.base_path).then((l) => { this._shared = l; this.requestUpdate(); });
    const list = c.areas ? { areas: c.areas, adaptive: c.adaptive || {} } : this._shared;
    const room = this._child("room", () => { const el = document.createElement("nice-room"); el.setConfig({ area: c.area, base_path: c.base_path, back: c.back, areas: c.areas }); return el; });
    const kids = this.sections(list).map((cfg) => {
      const key = JSON.stringify(cfg), el = this._child(key, () => { const x = document.createElement("nice-controls"); x.setConfig(cfg); return x; });
      return el;
    });
    const extra = (c.cards || []).map((cfg, i) => this._child(`card-${i}-${JSON.stringify(cfg)}`, () => {
      const holder = document.createElement("div");
      this._helpers?.then((h) => { const el = h.createCardElement(cfg); el.hass = this._real; holder.appendChild(el); this._els.set(`card-${i}-el`, el); });
      return holder;
    }));
    const foot = c.footer ? this._child("footer", () => { const el = document.createElement("nice-footer"); el.setConfig({}); return el; }) : null;
    return html`<div class="page">${room}${kids}${extra}${foot}</div>`;
  }

  getCardSize() { return 20; }
  static styles = [tokens, css`.page { display: grid; gap: calc(var(--n-s-xl) + var(--n-s-sm)); }`];
}
customElements.define("nice-room-page", NiceRoomPage);
