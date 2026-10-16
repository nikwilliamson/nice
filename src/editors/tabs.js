// The visual editor for nice-tabs: the tabs (add, rename, drag to reorder, remove), and each
// tab's cards, edited with Home Assistant's own card picker and card editors, the same ones
// the stack cards use. So every card in a tab, Nice or not, gets its proper editor.
import { LitElement, html, css, nothing } from "lit";
import { haReady, fire, editorStyles, History } from "./shared.js";

const slug = (s) => String(s || "tab").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "tab";
const cardName = (c) => (c?.type || "card").replace(/^custom:/, "").replace(/-/g, " ");

export class NiceTabsEditor extends LitElement {
  static properties = { hass: { attribute: false }, lovelace: { attribute: false }, _config: { state: true }, _tab: { state: true }, _card: { state: true }, _picking: { state: true }, _ready: { state: true }, _over: { state: true } };
  constructor() { super(); this.history = new History(this); this._tab = 0; this._card = 0; }
  connectedCallback() { super.connectedCallback(); haReady().then(() => { this._ready = true; }); }
  setConfig(config) { this._config = { ...config, tabs: config.tabs || [] }; }

  _change(tabs) {
    if (JSON.stringify(tabs) === JSON.stringify(this._config.tabs)) return;
    this.history.push(this._config); this._config = { ...this._config, tabs }; fire(this, "config-changed", { config: this._config }); }
  _undo() { this._config = this.history.pop(); fire(this, "config-changed", { config: this._config }); }
  _editTab(change) { this._change(this._config.tabs.map((t, i) => (i === this._tab ? change(t) : t))); }
  _cards(change) { this._editTab((t) => ({ ...t, cards: change([...(t.cards || [])]) })); }

  _moveTab(from, to) {
    if (from == null || from === to) return;
    const tabs = [...this._config.tabs], [t] = tabs.splice(from, 1);
    const at = from < to ? to - 1 : to;
    tabs.splice(at, 0, t);
    this._tab = at;
    this._change(tabs);
  }

  updated() {
    const id = this._config?.tabs?.[this._tab]?.id;
    if (id && id !== this._shown) { this._shown = id; window.dispatchEvent(new CustomEvent("nice-tab-preview", { detail: { tab: id } })); }
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const tabs = this._config.tabs, tab = tabs[this._tab], cards = tab?.cards || [];
    const card = cards[this._card];
    return html`
      <div class="row"><span class="grow"></span>${this.history.can ? html`<button @click=${() => this._undo()}>↶ Undo</button>` : nothing}</div>
      <div class="row chips">
        ${tabs.map((t, i) => html`<button class="chip ${i === this._tab ? "sel" : ""} ${this._over === i ? "drop-before-x" : ""}" draggable="true"
            @click=${() => { this._tab = i; this._card = 0; this._picking = false; }}
            @dragstart=${() => { this._from = i; }} @dragover=${(ev) => { ev.preventDefault(); this._over = i; }} @drop=${(ev) => { ev.preventDefault(); this._over = null; this._moveTab(this._from, i); }}>${t.label || t.id}</button>`)}
        <button class="chip add" @click=${() => { const n = tabs.length; this._change([...tabs, { id: `tab_${n + 1}`, label: "New tab", cards: [] }]); this._tab = n; this._card = 0; }}>+ Tab</button>
      </div>
      ${tab ? html`<div class="box">
        <div class="row">
          <label class="grow">Label <input class="plain" .value=${tab.label || ""} @change=${(ev) => this._editTab((t) => ({ ...t, label: ev.target.value, id: t.id || slug(ev.target.value) }))}></label>
          <label>Id <input class="plain short" .value=${tab.id || ""} title="Used by grid routes: tab:<id>" @change=${(ev) => this._editTab((t) => ({ ...t, id: slug(ev.target.value) }))}></label>
          <button class="text" title="Remove tab" @click=${() => { if (confirm(`Remove the “${tab.label || tab.id}” tab and its ${cards.length} cards?`)) { this._change(tabs.filter((_, i) => i !== this._tab)); this._tab = Math.max(0, this._tab - 1); } }}>✕</button>
        </div>
        <div class="row chips">
          ${cards.map((c, i) => html`<button class="chip ${i === this._card && !this._picking ? "sel" : ""}" @click=${() => { this._card = i; this._picking = false; }}>${i + 1}. ${cardName(c)}</button>`)}
          <button class="chip add" @click=${() => { this._picking = true; }}>+ Card</button>
        </div>
        ${this._picking && this._ready ? html`<hui-card-picker .hass=${this.hass} .lovelace=${this.lovelace}
            @config-changed=${(ev) => { ev.stopPropagation(); this._cards((l) => [...l, ev.detail.config]); this._card = cards.length; this._picking = false; }}></hui-card-picker>`
          : card && this._ready ? html`
            <div class="row"><b class="grow">${cardName(card)}</b>
              <button class="text" title="Move left" ?disabled=${this._card === 0} @click=${() => { this._cards((l) => { const i = this._card; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return l; }); this._card -= 1; }}>←</button>
              <button class="text" title="Move right" ?disabled=${this._card === cards.length - 1} @click=${() => { this._cards((l) => { const i = this._card; [l[i + 1], l[i]] = [l[i], l[i + 1]]; return l; }); this._card += 1; }}>→</button>
              <button class="text" title="Remove card" @click=${() => { this._cards((l) => l.filter((_, i) => i !== this._card)); this._card = Math.max(0, this._card - 1); }}>✕</button></div>
            <hui-card-element-editor .hass=${this.hass} .lovelace=${this.lovelace} .value=${card}
              @config-changed=${(ev) => { ev.stopPropagation(); if (ev.detail.config) this._cards((l) => l.map((x, i) => (i === this._card ? ev.detail.config : x))); }}></hui-card-element-editor>`
          : html`<p class="note">This tab has no cards yet. Add one with + Card.</p>`}
      </div>` : html`<p class="note">No tabs yet.</p>`}`;
  }

  static styles = [editorStyles, css`
    .chips { gap: 6px; }
    .chip { border-radius: 999px; padding: 6px 12px; font-weight: 700; }
    .chip.sel { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .chip.add { background: none; box-shadow: inset 0 0 0 1px var(--divider-color, rgba(0,0,0,.2)); }
    .drop-before-x { box-shadow: -3px 0 0 var(--primary-color); }
    label { display: inline-flex; gap: 6px; align-items: center; color: var(--secondary-text-color); }
    label .plain { flex: 1; } .short { width: 9em; }
  `];
}
customElements.define("nice-tabs-editor", NiceTabsEditor);
