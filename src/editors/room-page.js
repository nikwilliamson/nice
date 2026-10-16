// The visual editor for nice-room-page: the room, then its sections. "Suggest from this room"
// lists what's in the area and not on the page yet; nothing is added unless you tick it.
import { LitElement, html, css, nothing } from "lit";
import { normalize, entityIds } from "../cards/room-sections.js";
import { areaOf, domainOf } from "../data/entities.js";
import { haFormReady } from "./sections.js";
import "./sections.js";

// Where a suggestion goes by default, by what it is
const HOME = { light: "Lights", scene: "Scenes", script: "Scenes", climate: "Climate", media_player: "Playing", lock: "Doors & windows", fan: "Plugs & more", switch: "Plugs & more" };
function sectionFor(st) {
  const d = domainOf(st.entity_id), dc = st.attributes.device_class;
  if (d === "binary_sensor") return ["door", "window", "garage_door"].includes(dc) ? "Doors & windows" : ["motion", "occupancy"].includes(dc) ? "Motion" : null;
  if (d === "sensor") return ["temperature", "humidity"].includes(dc) ? "Climate" : dc === "illuminance" ? "Motion" : dc === "power" ? "Power" : null;
  return HOME[d] || null;
}
const fire = (el, config) => el.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));

export class NiceRoomPageEditor extends LitElement {
  static properties = { hass: { attribute: false }, _config: { state: true }, _suggest: { state: true }, _picked: { state: true }, _ready: { state: true } };

  setConfig(config) {
    // Older room pages wrote sections as a map; the editor always writes the list
    this._config = { ...config, sections: normalize(config.sections) };
  }
  connectedCallback() { super.connectedCallback(); haFormReady().then(() => { this._ready = true; }); }
  _change(patch) { this._config = { ...this._config, ...patch }; fire(this, this._config); }

  // What's in the room that isn't on the page: not hidden, not a setting, not offline
  _candidates() {
    const h = this.hass, area = this._config.area, have = entityIds(this._config.sections || []);
    return Object.keys(h.states).filter((id) => {
      const r = h.entities?.[id];
      return r && !r.hidden && !r.entity_category && !have.has(id) && h.states[id].state !== "unavailable" && areaOf(h, id) === area && sectionFor(h.states[id]);
    }).map((id) => ({ id, name: h.states[id].attributes.friendly_name || id, section: sectionFor(h.states[id]) }));
  }
  _addPicked() {
    const sections = (this._config.sections || []).map((s) => ({ ...s, entities: [...(s.entities || [])] }));
    for (const c of this._candidates().filter((x) => this._picked?.[x.id])) {
      let s = sections.find((x) => x.title === c.section);
      if (!s) { s = { title: c.section, entities: [] }; sections.push(s); }
      s.entities.push(c.id);
    }
    this._picked = {};
    this._suggest = false;
    this._change({ sections });
  }

  _suggestions() {
    const list = this._candidates();
    if (!list.length) return html`<p class="note">Everything in this room is already on the page.</p>`;
    const by = {};
    for (const c of list) (by[c.section] ||= []).push(c);
    const n = Object.values(this._picked || {}).filter(Boolean).length;
    return html`<div class="suggest"><p class="note">In this room but not on the page. Tick what you want; it goes into the section named.</p>
      ${Object.entries(by).map(([sec, items]) => html`<h4>${sec}</h4>${items.map((c) => html`<label class="pick"><input type="checkbox" .checked=${!!this._picked?.[c.id]}
          @change=${(ev) => { this._picked = { ...this._picked, [c.id]: ev.target.checked }; }}><span>${c.name}</span><small>${c.id}</small></label>`)}`)}
      <div class="row"><button class="primary" ?disabled=${!n} @click=${() => this._addPicked()}>Add ${n || ""}</button><button @click=${() => { this._suggest = false; }}>Close</button></div></div>`;
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    return html`
      ${this._ready ? html`<ha-form .hass=${this.hass} .data=${{ area: this._config.area }} .schema=${[{ name: "area", selector: { area: {} } }]}
        .computeLabel=${() => "Room"} @value-changed=${(ev) => this._change({ area: ev.detail.value.area })}></ha-form>` : nothing}
      <div class="row"><button @click=${() => { this._suggest = !this._suggest; }}>${this._suggest ? "Hide suggestions" : "Suggest from this room"}</button></div>
      ${this._suggest ? this._suggestions() : nothing}
      <nice-sections-editor .hass=${this.hass} .sections=${this._config.sections || []} @sections-changed=${(ev) => this._change({ sections: ev.detail.sections })}></nice-sections-editor>
      <p class="note">Adaptive Lighting, power bars, the Vestaboard and LED strips can be moved and removed here; edit their details in the code editor.</p>`;
  }

  static styles = css`
    :host { display: grid; gap: 12px; }
    .row { display: flex; gap: 8px; }
    button { font: inherit; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; background: var(--secondary-background-color, #eef0f5); color: var(--primary-text-color); font-weight: 700; }
    button.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    button:disabled { opacity: .4; cursor: default; }
    .note { margin: 0; color: var(--secondary-text-color); font-size: .9em; }
    .suggest { border: 1px dashed var(--primary-color); border-radius: 12px; padding: 12px; display: grid; gap: 6px; }
    h4 { margin: 8px 0 0; font-size: .85em; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); }
    .pick { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .pick small { color: var(--secondary-text-color); font-size: .8em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 16em; }
  `;
}
customElements.define("nice-room-page-editor", NiceRoomPageEditor);
