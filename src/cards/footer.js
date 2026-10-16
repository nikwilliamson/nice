// nice-footer: Menu and Edit at the bottom of the page. While it's on the page, Home
// Assistant's own top bar is hidden on this dashboard only (the style lives inside this
// dashboard's hui-root); the bar comes back in edit mode, where it carries Done and the
// view tabs. The sidebar is hidden too (Menu opens it over the page), and put back the way
// this device had it on leaving the dashboard. Put one nice-footer last on every view.
//
//   type: custom:nice-footer
//   hide_sidebar: true      false leaves the sidebar alone
//
// This reaches into Home Assistant's frontend (hui-root, hui-sections-view), so it's the
// piece most likely to need a fix after a frontend update. It polls edit mode every 500 ms.
import { html, css, nothing } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { controlStyles } from "../controls/index.js";
import { formEditor } from "../editors/form.js";
import { FOOTER } from "../editors/specs.js";

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
// Home Assistant keeps the sidebar's docking per device. What it was before Nice hid it is
// remembered in localStorage, so a reload on a Nice page doesn't lose it.
const BEFORE = "nice-sidebar-before";
const app = () => document.querySelector("home-assistant");
const dock = (mode) => app()?.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: mode }, bubbles: true, composed: true }));
function hideSidebar() {
  const now = app()?.hass?.dockedSidebar;
  if (!now || now === "always_hidden") return;
  try { if (localStorage.getItem(BEFORE) == null) localStorage.setItem(BEFORE, now); } catch (e) { /* storage blocked */ }
  dock("always_hidden");
}
function restoreSidebar() {
  let before = null;
  try { before = localStorage.getItem(BEFORE); localStorage.removeItem(BEFORE); } catch (e) { /* storage blocked */ }
  if (before && before !== "always_hidden") dock(before);
}

function styleIn(root, id, text, on) {
  if (!root) return;
  let s = root.getElementById(id);
  if (!on) { s?.remove(); return; }
  if (!s) { s = document.createElement("style"); s.id = id; s.textContent = text; root.appendChild(s); }
}

export class NiceFooter extends NiceCard {
  static getConfigElement() { return formEditor(FOOTER); }
  static defaults = { menu: true, edit: true, hide_sidebar: true };
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
    setTimeout(() => { if (!root.__niceFooters) { this._bar(root, true); if (this.config.hide_sidebar) restoreSidebar(); } }, 300);
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
    if (this.config.hide_sidebar && !editing) hideSidebar();
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
