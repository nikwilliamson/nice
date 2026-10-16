// A form from a description, so each card's editor is just a list of its options.
//
// A field is one of:
//   { name, label, selector }                     one value, drawn by Home Assistant's ha-form
//   { name, label, list: [fields], add, title }   a list of objects: each item a form of its own,
//                                                 dragged to reorder, removed, added
//   { name, label, strings: selector, add }       a list of single values (names, areas)
//   { …, from(config) → value, to(value, config) → config }   when the config keeps it differently
//                                                             (a map shown as a list)
// <nice-form> fires `form-changed` with { value }.
import { LitElement, html, nothing } from "lit";
import { haReady, fire, editorStyles, tidy, History } from "./shared.js";

const simple = (f) => f.selector && !f.list && !f.strings;

export class NiceForm extends LitElement {
  static properties = { hass: { attribute: false }, value: { attribute: false }, fields: { attribute: false }, _ready: { state: true } };
  connectedCallback() { super.connectedCallback(); haReady().then(() => { this._ready = true; }); }

  _get(f) { return f.from ? f.from(this.value || {}) : (this.value || {})[f.name]; }
  _put(f, v) {
    const base = { ...(this.value || {}) };
    const next = f.to ? f.to(v, base) : { ...base, [f.name]: v };
    this.value = tidy(next);
    fire(this, "form-changed", { value: this.value });
  }

  _group(fields) {
    const data = Object.fromEntries(fields.map((f) => [f.name, this._get(f)]));
    const labels = Object.fromEntries(fields.map((f) => [f.name, f.label || f.name]));
    const helpers = Object.fromEntries(fields.filter((f) => f.help).map((f) => [f.name, f.help]));
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${fields.map((f) => ({ name: f.name, selector: f.selector }))}
      .computeLabel=${(s) => labels[s.name]} .computeHelper=${(s) => helpers[s.name]}
      @value-changed=${(ev) => { ev.stopPropagation(); const v = ev.detail.value; for (const f of fields) if (JSON.stringify(v[f.name]) !== JSON.stringify(data[f.name])) this._put(f, v[f.name]); }}></ha-form>`;
  }

  render() {
    if (!this._ready) return nothing;
    const out = [], fields = this.fields || [];
    for (let i = 0; i < fields.length;) {
      if (simple(fields[i])) { const run = []; while (i < fields.length && simple(fields[i])) run.push(fields[i++]); out.push(this._group(run)); }
      else { const f = fields[i++]; out.push(html`<nice-list .hass=${this.hass} .field=${f} .items=${this._get(f) || []} @list-changed=${(ev) => { ev.stopPropagation(); this._put(f, ev.detail.items); }}></nice-list>`); }
    }
    return out;
  }
  static styles = editorStyles;
}
customElements.define("nice-form", NiceForm);

// A list of items: objects (each a form) or single values (one picker each)
export class NiceList extends LitElement {
  static properties = { hass: { attribute: false }, field: { attribute: false }, items: { attribute: false }, _open: { state: true }, _over: { state: true } };
  constructor() { super(); this._open = {}; }

  _set(items) { this.items = items; fire(this, "list-changed", { items }); }
  _move(from, to) {
    if (from === to || from == null) return;
    const out = [...this.items], [it] = out.splice(from, 1);
    out.splice(to > from ? to - 1 : to, 0, it);
    this._set(out);
  }
  _title(it, i) {
    const f = this.field;
    if (f.strings) return nothing;
    return f.title ? f.title(it, this.hass) || `Item ${i + 1}` : it.name || it.label || it.entity || `Item ${i + 1}`;
  }

  _item(it, i) {
    const f = this.field, open = f.strings || this._open[i];
    const drag = {
      start: (ev) => { this._from = i; ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", String(i)); },
      over: (ev) => { ev.preventDefault(); this._over = i; },
      drop: (ev) => { ev.preventDefault(); this._over = null; this._move(this._from, i); },
    };
    return html`<div class="item ${this._over === i ? "drop-before" : ""}" @dragover=${drag.over} @drop=${drag.drop} @dragleave=${() => { this._over = null; }}>
      <div class="row">
        <span class="handle" draggable="true" title="Drag to reorder" @dragstart=${drag.start}>⠿</span>
        ${f.strings
          ? html`<div class="grow"><ha-form .hass=${this.hass} .data=${{ v: it }} .schema=${[{ name: "v", selector: f.strings }]} .computeLabel=${() => ""}
              @value-changed=${(ev) => { ev.stopPropagation(); this._set(this.items.map((x, j) => (j === i ? ev.detail.value.v : x))); }}></ha-form></div>`
          : html`<button class="text grow left" @click=${() => { this._open = { ...this._open, [i]: !open }; }}>${open ? "▾" : "▸"} ${this._title(it, i)}</button>`}
        <button class="text" title="Remove" @click=${() => this._set(this.items.filter((_, j) => j !== i))}>✕</button>
      </div>
      ${!f.strings && open ? html`<nice-form .hass=${this.hass} .value=${it} .fields=${f.list}
          @form-changed=${(ev) => { ev.stopPropagation(); this._set(this.items.map((x, j) => (j === i ? ev.detail.value : x))); }}></nice-form>` : nothing}
    </div>`;
  }

  render() {
    const f = this.field, items = this.items || [];
    return html`<div class="box">
      <div class="row"><b class="grow">${f.label}</b><small>${items.length || ""}</small></div>
      ${items.map((it, i) => this._item(it, i))}
      <div class="end" @dragover=${(ev) => { ev.preventDefault(); this._over = items.length; }} @drop=${(ev) => { ev.preventDefault(); this._over = null; this._move(this._from, items.length); }}></div>
      <div class="row"><button @click=${() => { const n = items.length; this._set([...items, f.strings ? "" : { ...(f.blank || {}) }]); if (!f.strings) this._open = { ...this._open, [n]: true }; }}>+ ${f.add || "Add"}</button></div>
    </div>`;
  }
  static styles = [editorStyles];
}
customElements.define("nice-list", NiceList);

// The editor for any card that describes its options: Cls.editor = [fields]
export class NiceCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, lovelace: { attribute: false }, _config: { state: true } };
  constructor() { super(); this.history = new History(this); }
  setConfig(config) { this._config = config; }
  _change(value) {
    if (JSON.stringify({ type: this._config.type, ...value }) === JSON.stringify(this._config)) return;
    this.history.push(this._config);
    this._config = { type: this._config.type, ...value };
    fire(this, "config-changed", { config: this._config });
  }
  _undo() { this._config = this.history.pop(); fire(this, "config-changed", { config: this._config }); this.requestUpdate(); }
  render() {
    if (!this._config || !this.hass) return nothing;
    return html`${this.history.can ? html`<div class="row"><span class="grow"></span><button @click=${() => this._undo()}>↶ Undo</button></div>` : nothing}
      <nice-form .hass=${this.hass} .value=${this._config} .fields=${typeof this.fields === "function" ? this.fields(this.hass) : this.fields || []} @form-changed=${(ev) => { ev.stopPropagation(); this._change(ev.detail.value); }}></nice-form>
      ${this.note ? html`<p class="note">${this.note}</p>` : nothing}`;
  }
  static styles = editorStyles;
}
customElements.define("nice-card-editor", NiceCardEditor);

// For a card's static getConfigElement()
export function formEditor(fields, note) {
  const el = document.createElement("nice-card-editor");
  el.fields = fields;
  el.note = note;
  return el;
}
