// nice-footer: Menu and Edit at the bottom of the page. While it's on the page, Home
// Assistant's own top bar is hidden on this dashboard only (the style lives inside this
// dashboard's hui-root); the bar comes back in edit mode, where it carries Done and the
// view tabs. Put one nice-footer last on every view of the dashboard.
//
// This reaches into Home Assistant's frontend (hui-root, hui-sections-view), so it's the
// piece most likely to need a fix after a frontend update. It polls edit mode every 500 ms.
import { html, css, nothing } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { controlStyles } from "../controls/index.js";

function ancestor(el, tag) {
  let n = el;
  while (n) {
    if (n.tagName === tag) return n;
    n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode || n.host;
  }
  return null;
}
const CHROME = `.header, .toolbar { display: none !important; } #view { padding-top: env(safe-area-inset-top) !important; }`;
// With the bar gone, the sections view's own top padding reads as a gap
const TOP = `.container { padding-top: clamp(8px, 2vw, 16px) !important; }`;
function styleIn(root, id, text, on) {
  if (!root) return;
  let s = root.getElementById(id);
  if (!on) { s?.remove(); return; }
  if (!s) { s = document.createElement("style"); s.id = id; s.textContent = text; root.appendChild(s); }
}

export class NiceFooter extends NiceCard {
  static defaults = { menu: true, edit: true };
  watch() { return []; }

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => this._claim());
    this._poll = setInterval(() => this._sync(), 500);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._poll);
    const root = this._root;
    this._root = null;
    if (!root) return;
    root.__niceFooters = Math.max(0, (root.__niceFooters || 1) - 1);
    // Moving between views swaps one footer for the next; only bring the bar back if none came back
    setTimeout(() => { if (!root.__niceFooters) this._bar(root, true); }, 300);
  }
  _claim() {
    if (this._root || !this.isConnected) return;
    const root = ancestor(this, "HUI-ROOT");
    if (!root) return;
    this._root = root;
    root.__niceFooters = (root.__niceFooters || 0) + 1;
    this._sync();
  }
  _sync() {
    if (!this._root) return this._claim();
    const editing = !!this._root.lovelace?.editMode;
    this._bar(this._root, editing);
    styleIn(ancestor(this, "HUI-SECTIONS-VIEW")?.shadowRoot, "nice-top", TOP, !editing);
  }
  _bar(root, visible) {
    styleIn(root.shadowRoot, "nice-chrome", CHROME, !visible);
    if (visible) root.style.removeProperty("--header-height"); else root.style.setProperty("--header-height", "0px");
  }
  _edit() {
    const root = this._root || ancestor(this, "HUI-ROOT");
    if (root?.lovelace?.setEditMode) root.lovelace.setEditMode(true); else root?._enableEditMode?.();
    this._sync();
  }

  render() {
    const edit = this.config.edit && this.hass.user?.is_admin;
    return html`<div class="foot">
      ${this.config.menu ? html`<button class="pill" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { detail: { open: true }, bubbles: true, composed: true }))}>Menu</button>` : nothing}
      ${edit ? html`<button class="pill" @click=${() => this._edit()}>Edit dashboard</button>` : nothing}</div>`;
  }
  getCardSize() { return 1; }
  static styles = [tokens, controlStyles, css`
    .foot { display: flex; justify-content: center; gap: var(--n-s-sm); padding: var(--n-s-lg) 0 calc(var(--n-s-md) + env(safe-area-inset-bottom)); font-family: var(--n-body); }
    .pill { background: var(--n-chrome-bg); color: var(--n-chrome-ink); }
    .pill:hover { color: var(--n-chrome-ink-strong); }
  `];
}
customElements.define("nice-footer", NiceFooter);
