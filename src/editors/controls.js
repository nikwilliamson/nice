// The visual editor for nice-controls: one section, its title, options and entries.
import { LitElement, html, nothing } from "lit";
import { fire, editorStyles, History } from "./shared.js";
import "./sections.js";

export class NiceControlsEditor extends LitElement {
  static properties = { hass: { attribute: false }, _config: { state: true } };
  constructor() { super(); this.history = new History(this); }
  setConfig(config) { this._config = { ...config }; }
  _change(config) {
    if (JSON.stringify(config) === JSON.stringify(this._config)) return;
    this.history.push(this._config); this._config = config; fire(this, "config-changed", { config }); }
  _undo() { this._config = this.history.pop(); fire(this, "config-changed", { config: this._config }); }

  render() {
    if (!this._config || !this.hass) return nothing;
    const { type, entities = [], ...rest } = this._config;
    return html`${this.history.can ? html`<div class="row"><span class="grow"></span><button @click=${() => this._undo()}>↶ Undo</button></div>` : nothing}
      <nice-sections-editor single .hass=${this.hass} .sections=${[{ ...rest, entities }]}
        @sections-changed=${(ev) => { const { entities: e, ...opts } = ev.detail.sections[0]; this._change({ type, ...opts, entities: e }); }}></nice-sections-editor>`;
  }
  static styles = editorStyles;
}
customElements.define("nice-controls-editor", NiceControlsEditor);
