// nice-rooms: one tile per area. A room with lights on wears its colour; a dark room goes
// neutral, so "where are the lights on" reads from across the room. Chips show what's
// playing, the temperature, sleep mode, and anything unlocked, open or offline. The tile
// opens {base_path}/room-<area>; its button switches the room's lights.
//
// nice-room: the header at the top of a room's page: back, the room, what's on, lights and scenes.
//
//   type: custom:nice-rooms
//   areas: [living_room, kitchen, …]          order and colour (nice-room pages read it from here)
//   adaptive: { bedroom: [switch.adaptive_lighting_bedroom_suite] }   sleep chips
//   base_path: /house-nice
import { html, css, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { roomTone, offTone } from "../core/tones.js";
import { navigate } from "../core/nav.js";
import { readRoom, roomName, roomList, nameOf } from "../data/entities.js";
import { pack, twoThreeFour, Columns } from "../layout/pack.js";
import { place } from "../tile/tile.js";
import { formEditor } from "../editors/form.js";
import { ROOMS, ROOM } from "../editors/specs.js";

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const lightsWord = (r, of = "") => (r.lights.length ? (r.on.length ? (r.on.length === r.lights.length ? `${r.lights.length} light${r.lights.length === 1 ? "" : "s"} on` : `${r.on.length} of ${r.lights.length}${of} on`) : "Lights off") : "");

// The shared room list: config if given, else the first nice-rooms on the dashboard
class RoomsMixin extends NiceCard {
  _list() {
    if (this.config.areas) return { areas: this.config.areas, adaptive: this.config.adaptive || {} };
    if (this._shared === undefined && !this._asking) {
      this._asking = roomList(this._real, this.config.base_path).then((l) => { this._shared = l; this.requestUpdate(); });
    }
    return this._shared === undefined ? null : this._shared || { areas: Object.keys(this.hass.areas || {}), adaptive: {} };
  }
  // A room's lights show the change at once; the lights catch up
  _switch(area, on) {
    this.pending.set(readRoom(this.hass, area).lights, { state: on ? "off" : "on" });
    this._real.callService("light", on ? "turn_off" : "turn_on", {}, { area_id: area });
  }
  watch() { return this._ids || []; }
}

export class NiceRooms extends RoomsMixin {
  static getConfigElement() { return formEditor(ROOMS); }
  static defaults = { areas: null, adaptive: null, base_path: null };
  constructor() { super(); this.columns = new Columns(this, twoThreeFour(520)); }

  render() {
    const list = this._list(), h = this.hass;
    if (!list) return html`<div class="grid loading"></div>`;
    const asleep = (id) => [].concat(list.adaptive[id] || []).some((sw) => h.states[`${sw}_sleep_mode`]?.state === "on");
    const rooms = list.areas.map((id, i) => ({ id, i, name: roomName(h, id), sleep: asleep(id), ...readRoom(h, id) }));
    this._ids = rooms.flatMap((r) => r.ids).concat(Object.values(list.adaptive).flat().map((s) => `${s}_sleep_mode`));
    const cols = this.columns.cols;
    const tiles = pack(rooms.map((r) => ({ ...r, shape: "S" })), cols).tiles.map((r) => {
      const lit = r.on.length > 0, open = r.open.length;
      const chips = [
        r.playing.length ? ["play", "▶ " + (h.states[r.playing[0]].attributes.media_title || "Playing")] : null,
        r.temp != null ? ["", `${r.temp}°`] : null,
        r.sleep ? ["sleep", "Sleep mode"] : null,
        r.unlocked.length ? ["warn", r.unlocked.length > 1 ? `${r.unlocked.length} unlocked` : "Unlocked"] : null,
        open ? ["warn", open > 1 ? `${open} open` : `${titleCase(h.states[r.open[0]].attributes.device_class)} open`] : null,
        r.lockOffline.length ? ["off", "Lock offline"] : null,
      ].filter(Boolean);
      return { ...r, lit, chips, colors: roomTone(r.i, this.night, lit) };
    });
    return html`<div class="grid" style="--cols:${cols}">${repeat(tiles, (r) => r.id, (r) => html`
      <div class="room ${r.lit ? "lit" : ""}" style="${place(r)};--bg:${r.colors.bg};--ink:${r.colors.ink}" role="link" tabindex="0"
        @click=${() => navigate(this.config.base_path, `room-${r.id}`, "rooms")} @keydown=${(e) => e.key === "Enter" && navigate(this.config.base_path, `room-${r.id}`, "rooms")}>
        <div class="name">${r.name}</div>
        ${lightsWord(r) ? html`<div class="count">${lightsWord(r)}</div>` : nothing}
        <div class="meta">${r.chips.map(([cls, t]) => html`<span class="chip ${cls}">${t}</span>`)}
          ${r.lights.length ? html`<button class="bulb ${r.lit ? "on" : ""}" aria-label="${r.lit ? "Turn off" : "Turn on"} ${r.name} lights" @click=${(e) => { e.stopPropagation(); this._switch(r.id, r.lit); }}>${r.lit ? "Off" : "On"}</button>` : nothing}</div>
      </div>`)}</div>`;
  }

  static styles = [tokens, css`
    :host { container-type: inline-size; font-family: var(--n-body); }
    .grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); gap: var(--n-gap); }
    .grid.loading { min-height: var(--n-row); }
    .room { position: relative; overflow: hidden; border-radius: var(--n-r-tile); padding: var(--n-s-md) var(--n-s-lg); min-height: var(--n-row); background: var(--bg); color: var(--ink);
      display: flex; flex-direction: column; cursor: pointer; transition: background-color .35s ease, color .35s ease, transform .5s var(--n-spring); }
    .room:active { transform: scale(.965); }
    .room:focus-visible { outline: var(--n-ring) solid var(--n-focus); outline-offset: 2px; }
    .name { font-family: var(--n-display); font-weight: 800; font-size: 1.3em; letter-spacing: -0.01em; }
    .count { font-size: 0.9em; font-weight: 700; opacity: .75; margin-top: var(--n-s-xs); }
    .meta { margin-top: auto; padding-top: var(--n-s-md); display: flex; flex-wrap: wrap; gap: var(--n-s-sm); align-items: flex-end; min-width: 0; }
    .chip { font-size: 0.8em; font-weight: 700; background: rgba(28,34,51,.07); border-radius: var(--n-r-full); padding: var(--n-s-xs) var(--n-s-md); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .chip.play { background: #1c2233; color: #fff; } .chip.warn { background: #ffd65c; color: #1c2233; } .chip.off { background: rgba(28,34,51,.12); }
    :host(.is-night) .chip { background: rgba(255,255,255,.14); } :host(.is-night) .chip.warn { background: #ffd65c; } :host(.is-night) .chip.play { background: #fff8f0; color: #1c2233; }
    .chip.sleep { background: #6a4be0 !important; color: #fff; }
    .bulb { margin-left: auto; flex: none; font: inherit; font-size: 0.8em; font-weight: 700; padding: var(--n-s-xs) var(--n-s-md); border: 0; border-radius: var(--n-r-full); cursor: pointer; background: rgba(28,34,51,.08); color: inherit; }
    :host(.is-night) .bulb { background: rgba(255,255,255,.16); }
    .bulb.on { background: var(--ink); color: var(--bg); }
  `];
}
customElements.define("nice-rooms", NiceRooms);

export class NiceRoom extends RoomsMixin {
  static getConfigElement() { return formEditor(ROOM); }
  static required = ["area"];
  static defaults = { areas: null, base_path: null, back: "home" };

  render() {
    const h = this.hass, id = this.config.area, list = this._list(), r = readRoom(h, id);
    this._ids = r.ids;
    const lit = r.on.length > 0;
    const c = !list ? offTone(this.night) : roomTone(Math.max(0, list.areas.indexOf(id)), this.night, lit);
    const strip = [roomName(h, id)];
    const bits = [
      lightsWord(r, " lights"),
      r.temp != null ? `${r.temp}°` : "",
      r.playing.length ? `${h.states[r.playing[0]].attributes.media_title || "Something"} on ${h.states[r.playing[0]].attributes.friendly_name}` : "",
      r.unlocked.length ? `${r.unlocked.map((e) => nameOf(h, h.states[e], strip)).join(", ")} unlocked` : "",
      r.open.length ? `${r.open.map((e) => nameOf(h, h.states[e], strip)).join(", ")} open` : "",
    ].filter(Boolean);
    return html`<div class="hero ${lit ? "lit" : ""}" style="--bg:${c.bg};--ink:${c.ink}">
      <button class="pill back" aria-label="Back to rooms" @click=${() => navigate(this.config.base_path, this.config.back, "rooms")}>‹ Rooms</button>
      <div class="name">${roomName(h, id)}</div>
      <div class="sub">${bits.join(" · ") || "Nothing on in here"}</div>
      <div class="btns">
        ${r.lights.length ? html`<button class="pill pri" @click=${() => this._switch(id, lit)}>${lit ? "All off" : "Lights on"}</button>` : nothing}
        ${r.scenes.map((s) => html`<button class="pill" @click=${() => this._real.callService("scene", "turn_on", {}, { entity_id: s })}>${(h.states[s].attributes.friendly_name || s).replace(/^(Home|Suite) /, "")}</button>`)}
      </div></div>`;
  }

  getCardSize() { return 3; }
  static styles = [tokens, css`
    .hero { position: relative; overflow: hidden; border-radius: var(--n-r-tile); padding: var(--n-s-lg) var(--n-s-xl) var(--n-s-xl); background: var(--bg); color: var(--ink); display: grid; gap: var(--n-s-sm); font-family: var(--n-body); transition: background-color .35s ease; }
    .name { font-family: var(--n-display); font-weight: 800; font-size: clamp(2em, 4.4vw, 2.8em); line-height: 1.05; letter-spacing: -0.02em; margin-top: var(--n-s-xs); }
    .sub { font-weight: 600; font-size: 1.02em; opacity: .8; }
    .btns { display: flex; flex-wrap: wrap; gap: var(--n-s-sm); margin-top: var(--n-s-sm); }
    .pill { font: inherit; font-size: var(--n-pill-size); font-weight: var(--n-pill-weight); border: 0; border-radius: var(--n-r-full); padding: var(--n-s-sm) var(--n-s-md); cursor: pointer; white-space: nowrap; background: rgba(28,34,51,.08); color: inherit; }
    :host(.is-night) .pill { background: rgba(255,255,255,.16); }
    .pill.pri { background: var(--ink); color: var(--bg); }
    .back { justify-self: start; }
    button:focus-visible { outline: var(--n-ring) solid var(--n-focus); outline-offset: 2px; }
  `];
}
customElements.define("nice-room", NiceRoom);
