// nice-room-page: a whole room page. The header (nice-room), then one nice-controls section
// per entry in `sections`, in the order written, then any cards of your own and the footer.
// Curated by hand: nothing is added on its own. The visual editor (editors/room-page.js) can
// suggest what's in the area that isn't on the page yet; you choose.
//
//   type: custom:nice-room-page
//   area: race_room
//   base_path: /house-nice
//   sections:
//     - title: Lights
//       entities: [light.race_room_desk_light, { strip: light.dig2go, … }]
//     - title: Scenes
//       all: false
//       entities: [{ entity: script.room_race_room_bright, name: Bright }]
//   cards: [ any card ]        after the sections
//   room_lights: false         leave out the card that switches all the room's lights
import { html, css } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { roomList, roomName, readRoom } from "../data/entities.js";
import { normalize, withRoomLights } from "./room-sections.js";
import "./rooms.js";
import "./controls.js";
import "./footer.js";

export class NiceRoomPage extends NiceCard {
  static required = ["area"];
  static defaults = { base_path: null, back: "home", sections: [], cards: [], areas: null, footer: true, room_lights: true };
  static getConfigElement() { return document.createElement("nice-room-page-editor"); }
  static getStubConfig(hass) { return { area: Object.keys(hass?.areas || {})[0] || "", sections: [] }; }
  constructor() { super(); this._els = new Map(); this._helpers = window.loadCardHelpers?.(); }

  // The nice-controls configs for this room: the room's name off the front of every name,
  // and lit things in the room's colour
  sections(list) {
    const strip = [roomName(this.hass, this.config.area)];
    const tone = Math.max(0, (list?.areas || []).indexOf(this.config.area));
    return withRoomLights(normalize(this.config.sections), this.config, readRoom(this.hass, this.config.area).lights.length).map((s) => ({ strip, room_tone: tone, ...s }));
  }

  // Children are real cards, kept between renders and handed every hass update
  _child(key, make) {
    if (!this._els.has(key)) this._els.set(key, make());
    const el = this._els.get(key);
    el.hass = this._real;
    return el;
  }
  watch() { return []; }
  hassChanged(prev, h) { for (const el of this._els.values()) el.hass = h; }
  configChanged() { this._els.clear(); }

  render() {
    const c = this.config;
    if (!c.areas && this._shared === undefined && !this._asking) this._asking = roomList(this._real, c.base_path).then((l) => { this._shared = l; this.requestUpdate(); });
    const list = c.areas ? { areas: c.areas } : this._shared;
    const room = this._child("room", () => { const el = document.createElement("nice-room"); el.setConfig({ area: c.area, base_path: c.base_path, back: c.back, areas: c.areas }); return el; });
    const kids = this.sections(list).map((cfg) => this._child(JSON.stringify(cfg), () => { const x = document.createElement("nice-controls"); x.setConfig(cfg); return x; }));
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
