// Bento footer - moves the dashboard's menu and edit buttons to the bottom of the page.
// Card: bento-footer
//
// While a bento-footer is on the page, Home Assistant's own top bar is hidden on this
// dashboard only (the style lives inside this dashboard's hui-root, so other dashboards
// keep theirs). The bar comes back in edit mode, where it carries Done and the view tabs.
// Put one bento-footer last on every view of the dashboard.
//
// Its buttons are bento pills and follow the sun like every bento card (sun: sun.sun by default),
// not the Home Assistant theme.
import { BENTO_TOKENS_CSS, BENTO_BUTTON_CSS, isNight, applyNight, pageGutter } from "./bento-core.js?v=1.1.0";

const BENTO_FOOTER_VERSION = "1.3.0";

// Walk out of nested shadow roots to the nearest ancestor with this tag
function bentoAncestor(el, tag) {
  let n = el;
  while (n) {
    if (n.tagName === tag) return n;
    n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode || n.host;
  }
  return null;
}
const bentoHuiRoot = (el) => bentoAncestor(el, "HUI-ROOT");

const CHROME_CSS = `
  .header, .toolbar { display: none !important; }
  #view { padding-top: env(safe-area-inset-top) !important; }
`;
// With the bar gone, the sections view's own 24px top padding reads as a gap; bring it
// in line with the side gutter (8px on a phone, a little more on a wide screen)
const TOP_CSS = `.container { padding-top: clamp(8px, 2vw, 16px) !important; }`;

class BentoFooter extends HTMLElement {
  setConfig(config) {
    this._config = { menu: true, edit: true, sun: "sun.sun", font_scale: 1, ...(config || {}) };
    this.style.setProperty("--bento-scale", this._config.font_scale);
  }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  connectedCallback() {
    // hui-root may not be reachable until the view has finished attaching
    requestAnimationFrame(() => this._claim());
    this._tick = setInterval(() => this._sync(), 500);
    if (!this._gutter) { this._gutter = true; pageGutter(true); }
  }
  disconnectedCallback() {
    clearInterval(this._tick);
    if (this._gutter) { this._gutter = false; pageGutter(false); }
    const root = this._root;
    this._root = null;
    if (!root) return;
    root.__bentoFooters = Math.max(0, (root.__bentoFooters || 1) - 1);
    // Moving between views swaps one footer for the next; only restore the bar if none came back
    setTimeout(() => { if (!root.__bentoFooters) this._show(root, true); }, 300);
  }

  _claim() {
    if (this._root || !this.isConnected) return;
    const root = bentoHuiRoot(this);
    if (!root) return;
    this._root = root;
    root.__bentoFooters = (root.__bentoFooters || 0) + 1;
    this._sync();
  }

  // Hide the bar except in edit mode
  _sync() {
    if (!this._root) return this._claim();
    const editing = !!this._root.lovelace?.editMode;
    this._show(this._root, editing);
    this._top(editing);
  }
  _top(editing) {
    const sr = bentoAncestor(this, "HUI-SECTIONS-VIEW")?.shadowRoot;
    if (!sr) return;
    let style = sr.getElementById("bento-top");
    if (editing) { style?.remove(); return; }
    if (!style) {
      style = document.createElement("style");
      style.id = "bento-top";
      style.textContent = TOP_CSS;
      sr.appendChild(style);
    }
  }
  _show(root, visible) {
    const sr = root.shadowRoot;
    if (!sr) return;
    let style = sr.getElementById("bento-chrome");
    if (visible) { style?.remove(); root.style.removeProperty("--header-height"); return; }
    if (!style) {
      style = document.createElement("style");
      style.id = "bento-chrome";
      style.textContent = CHROME_CSS;
      sr.appendChild(style);
    }
    root.style.setProperty("--header-height", "0px");
  }

  set hass(hass) {
    applyNight(this, isNight(hass, this._config?.sun));
    const admin = !!hass.user?.is_admin;
    if (this.shadowRoot && this._admin === admin) return;
    this._admin = admin;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const c = this._config;
    const edit = c.edit && this._admin;
    this.shadowRoot.innerHTML = `<style>${BENTO_TOKENS_CSS}${BENTO_BUTTON_CSS}${FOOTER_CSS}</style>
      <div class="foot">
        ${c.menu ? `<button class="btn-base" data-do="menu">Menu</button>` : ""}
        ${edit ? `<button class="btn-base" data-do="edit">Edit dashboard</button>` : ""}
      </div>`;
    this.shadowRoot.querySelector('[data-do="menu"]')?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("hass-toggle-menu", { detail: { open: true }, bubbles: true, composed: true }));
    });
    this.shadowRoot.querySelector('[data-do="edit"]')?.addEventListener("click", () => {
      const root = this._root || bentoHuiRoot(this);
      if (root?.lovelace?.setEditMode) root.lovelace.setEditMode(true);
      else root?._enableEditMode?.();
      this._sync();
    });
  }
}
// The pill shape is bento-core's; the colours are its page-chrome tokens, which switch at sunset
const FOOTER_CSS = `
  .foot { display: flex; justify-content: center; gap: var(--b-s-sm); padding: var(--b-s-lg) 0 calc(var(--b-s-md) + env(safe-area-inset-bottom)); font-family: var(--b-body); }
  button { background: var(--b-chrome-bg); color: var(--b-chrome-ink); }
  button:hover { color: var(--b-chrome-ink-strong); }
  button:focus-visible { outline: var(--b-ring) solid var(--b-focus); outline-offset: 2px; }
`;

customElements.define("bento-footer", BentoFooter);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bento-footer", name: "Bento footer", description: "Menu and edit buttons at the bottom of the page; hides the top bar on this dashboard." });
console.info(`%c BENTO FOOTER %c ${BENTO_FOOTER_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
