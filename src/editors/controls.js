// The visual editor for nice-controls: its title, the All on/off switch and its entities.
import { LitElement, html, css, nothing } from "lit";
import "./sections.js";

export class NiceControlsEditor extends LitElement {
  static properties = { hass: { attribute: false }, _config: { state: true } };
  setConfig(config) { this._config = { ...config }; }
  _change(config) { this._config = config; this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })); }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const section = { title: c.title || "", entities: c.entities || [], ...(c.all === false ? { all: false } : {}) };
    return html`<input class="title" placeholder="Title (optional)" .value=${c.title || ""} @change=${(ev) => { const o = { ...c, title: ev.target.value }; if (!o.title) delete o.title; this._change(o); }}>
      <nice-sections-editor single .hass=${this.hass} .sections=${[section]} @sections-changed=${(ev) => {
        const s = ev.detail.sections[0], o = { ...c, entities: s.entities };
        if (s.all === false) o.all = false; else delete o.all;
        this._change(o);
      }}></nice-sections-editor>`;
  }
  static styles = css`
    :host { display: grid; gap: 12px; }
    .title { font: inherit; font-weight: 700; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(0,0,0,.2)); background: var(--card-background-color, #fff); color: var(--primary-text-color); }
  `;
}
customElements.define("nice-controls-editor", NiceControlsEditor);
