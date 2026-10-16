// The section editor: sections, each a title, options and a list of entries. Shared by the
// room page editor (many sections) and the controls editor (one).
//
// - Entries: drag to reorder, within a section or into another; expand one for its options
//   (name, tile size, chart, and the special kinds' own settings); a live state beside each.
// - Sections: drag by the handle to reorder, collapse, duplicate, remove; Options for colour,
//   room colour, name prefixes to strip and the All on/off button.
// - Hovering an entry outlines its tile in the preview.
//
// Fires `sections-changed` with { sections }.
import { LitElement, html, css, nothing } from "lit";
import { haReady, fire, editorStyles, highlight, tidy } from "./shared.js";
import { KINDS, kindOf, entryId, toObject, toEntry, fieldsFor, stateWords, TONE } from "./entries.js";
import "./form.js";

const SECTION_FIELDS = [
  { name: "all", label: "All on/off button", selector: { boolean: {} }, from: (c) => c.all !== false, to: (v, c) => ({ ...c, all: v ? null : false }) },
  TONE,
  { name: "room_tone", label: "Room colour (its place in the room list)", selector: { number: { min: 0, max: 20, mode: "box" } } },
  { name: "strip", label: "Take off the front of names (comma-separated)", selector: { text: {} },
    from: (c) => [].concat(c.strip || []).join(", "), to: (v, c) => ({ ...c, strip: v ? v.split(",").map((x) => x.trim()).filter(Boolean) : null }) },
  { name: "spark_hours", label: "Charts cover", selector: { number: { min: 1, max: 720, mode: "box", unit_of_measurement: "hours" } } },
];

export class NiceSectionsEditor extends LitElement {
  static properties = {
    hass: { attribute: false }, sections: { attribute: false }, single: { type: Boolean },
    _ready: { state: true }, _open: { state: true }, _shut: { state: true }, _opts: { state: true }, _over: { state: true },
  };
  constructor() { super(); this._open = {}; this._shut = {}; this._opts = {}; }
  connectedCallback() { super.connectedCallback(); haReady().then(() => { this._ready = true; }); }
  disconnectedCallback() { super.disconnectedCallback(); highlight(null); }

  _set(sections) { this.sections = sections; fire(this, "sections-changed", { sections }); }
  _edit(i, change) { this._set(this.sections.map((s, j) => (j === i ? change(s) : s))); }
  _entries(i, change) { this._edit(i, (s) => ({ ...s, entities: change([...(s.entities || [])]) })); }

  // Drag: an entry (s, e) or a whole section (s)
  _dragStart(ev, what) { this._drag = what; ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", JSON.stringify(what)); ev.stopPropagation(); }
  _dropEntry(si, ei) {
    const d = this._drag;
    this._drag = null; this._over = null;
    if (!d || d.e == null) return;
    const secs = this.sections.map((s) => ({ ...s, entities: [...(s.entities || [])] }));
    const [it] = secs[d.s].entities.splice(d.e, 1);
    const at = d.s === si && d.e < ei ? ei - 1 : ei;
    secs[si].entities.splice(at, 0, it);
    this._set(secs);
  }
  _dropSection(si) {
    const d = this._drag;
    this._drag = null; this._over = null;
    if (!d || d.e != null || d.s === si) return;
    const secs = [...this.sections], [it] = secs.splice(d.s, 1);
    secs.splice(d.s < si ? si - 1 : si, 0, it);
    this._set(secs);
  }

  _entry(s, si, e, ei) {
    const kind = kindOf(e), id = entryId(e), key = `${si}:${ei}`, open = this._open[key];
    const st = id && this.hass?.states?.[id];
    const title = (typeof e === "object" && e.name) || (kind === "entity" ? st?.attributes?.friendly_name || id || "Pick an entity" : KINDS[kind].label);
    const over = this._over === `e${key}`;
    return html`<li class="${over ? "drop-before" : ""}" @mouseenter=${() => highlight(id)} @mouseleave=${() => highlight(null)}
        @dragover=${(ev) => { if (this._drag?.e != null) { ev.preventDefault(); this._over = `e${key}`; } }} @drop=${(ev) => { ev.preventDefault(); this._dropEntry(si, ei); }}>
      <div class="row">
        <span class="handle" draggable="true" title="Drag to move" @dragstart=${(ev) => this._dragStart(ev, { s: si, e: ei })}>⠿</span>
        <button class="text grow left" @click=${() => { this._open = { ...this._open, [key]: !open }; }}>
          <span class="who"><b>${open ? "▾" : "▸"} ${title}</b><small>${kind === "entity" ? id || "" : KINDS[kind].label + (id ? ` · ${id}` : "")}</small></span></button>
        <small class="state">${stateWords(this.hass, e)}</small>
        <button class="text" title="Remove" @click=${() => this._entries(si, (l) => l.filter((_, k) => k !== ei))}>✕</button>
      </div>
      ${open ? html`<nice-form .hass=${this.hass} .value=${toObject(e)} .fields=${fieldsFor(kind, e, this.hass)}
          @form-changed=${(ev) => { ev.stopPropagation(); this._entries(si, (l) => l.map((x, k) => (k === ei ? toEntry(ev.detail.value) : x))); }}></nice-form>` : nothing}
    </li>`;
  }

  _section(s, si) {
    const shut = this._shut[si], opts = this._opts[si], n = (s.entities || []).length;
    const add = (entry, expand = false) => {
      const ei = n;
      this._entries(si, (l) => [...l, entry]);
      if (expand) this._open = { ...this._open, [`${si}:${ei}`]: true };
    };
    return html`<section class="${this._over === `s${si}` ? "drop-before" : ""}"
        @dragover=${(ev) => { if (this._drag && this._drag.e == null) { ev.preventDefault(); this._over = `s${si}`; } }} @drop=${(ev) => { if (this._drag?.e == null) { ev.preventDefault(); this._dropSection(si); } }}>
      <div class="row head">
        ${this.single ? nothing : html`<span class="handle" draggable="true" title="Drag to move the section" @dragstart=${(ev) => this._dragStart(ev, { s: si })}>⠿</span>
          <button class="text" title=${shut ? "Expand" : "Collapse"} @click=${() => { this._shut = { ...this._shut, [si]: !shut }; }}>${shut ? "▸" : "▾"}</button>`}
        <input class="plain grow title" placeholder=${this.single ? "Title (optional)" : "Section title"} .value=${s.title || ""}
          @change=${(ev) => this._edit(si, (x) => tidy({ ...x, title: ev.target.value }))}>
        <small>${n}</small>
        <button class="text" title="Options" @click=${() => { this._opts = { ...this._opts, [si]: !opts }; }}>⚙</button>
        ${this.single ? nothing : html`
          <button class="text" title="Duplicate" @click=${() => { const secs = [...this.sections]; secs.splice(si + 1, 0, { ...structuredClone(s), title: `${s.title || "Section"} copy` }); this._set(secs); }}>⧉</button>
          <button class="text" title="Remove section" @click=${() => { if (confirm(`Remove “${s.title || "this section"}” and its ${n} entries?`)) this._set(this.sections.filter((_, j) => j !== si)); }}>✕</button>`}
      </div>
      ${opts ? html`<div class="opts"><nice-form .hass=${this.hass} .value=${s} .fields=${SECTION_FIELDS}
          @form-changed=${(ev) => { ev.stopPropagation(); this._edit(si, () => ({ ...ev.detail.value, title: s.title, entities: s.entities })); }}></nice-form></div>` : nothing}
      ${shut ? nothing : html`
        <ul>${(s.entities || []).map((e, ei) => this._entry(s, si, e, ei))}
          <li class="end ${this._over === `e${si}:${n}` ? "drop-before" : ""}" @dragover=${(ev) => { if (this._drag?.e != null) { ev.preventDefault(); this._over = `e${si}:${n}`; } }}
            @drop=${(ev) => { ev.preventDefault(); this._dropEntry(si, n); }}></li></ul>
        ${this._ready ? html`<ha-form .hass=${this.hass} .data=${{}} .schema=${[{ name: "entity", selector: { entity: {} } }]} .computeLabel=${() => "Add an entity"}
            @value-changed=${(ev) => { ev.stopPropagation(); const id = ev.detail.value?.entity; if (id) { add(id); this.requestUpdate(); } }}></ha-form>` : nothing}
        <div class="row specials"><small>Add</small>${["adaptive", "bars", "board", "strip"].map((k) => html`<button @click=${() => add(structuredClone(KINDS[k].blank), true)}>${KINDS[k].label}</button>`)}</div>`}
    </section>`;
  }

  render() {
    const list = this.sections || [];
    return html`${list.map((s, i) => this._section(s, i))}
      ${this.single ? nothing : html`<div class="row"><button class="primary" @click=${() => this._set([...list, { title: "New section", entities: [] }])}>+ Add a section</button></div>`}`;
  }

  static styles = [editorStyles, css`
    section { border: 1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; }
    .title { font-weight: 700; font-size: 1.05em; }
    .opts { border-left: 3px solid var(--primary-color); padding-left: 10px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; }
    li { padding: 4px 0; border-top: 1px solid var(--divider-color, rgba(0,0,0,.08)); display: grid; gap: 6px; }
    li:first-child { border-top: 0; }
    li.end { min-height: 10px; border-top: 0; padding: 0; }
    li > nice-form { padding: 4px 0 8px 28px; }
    .left { text-align: left; }
    .who { display: grid; min-width: 0; } .who b, .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .who small { font-weight: 400; font-size: .8em; }
    .state { white-space: nowrap; max-width: 9em; overflow: hidden; text-overflow: ellipsis; }
    .specials button { font-size: .85em; }
  `];
}
customElements.define("nice-sections-editor", NiceSectionsEditor);

export { entryId };
