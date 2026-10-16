// nice-tabs: pill tabs that host any cards. Each tab is a list of ordinary card configs,
// built the first time the tab is opened. The chosen tab survives a trip into a room page
// and back (sessionStorage nice-tab), and a child can ask for a tab with a nice-tab event,
// which is how nice-grid's tab: routes work.
//
//   type: custom:nice-tabs
//   tabs: [{ id, label, cards: [...] }]
import { html, css } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { controlStyles } from "../controls/index.js";
import { EASE_OUT, calm } from "../core/motion.js";

export class NiceTabs extends NiceCard {
  static required = ["tabs"];
  constructor() { super(); this._cards = {}; this._helpers = window.loadCardHelpers?.(); }

  configChanged() {
    let saved = null;
    try { saved = sessionStorage.getItem("nice-tab"); } catch (e) { /* storage blocked */ }
    this._active = this.config.tabs.some((t) => t.id === saved) ? saved : this.config.tabs[0].id;
    this._cards = {};
  }

  // Children get every hass update; this card only redraws its own pills
  hassChanged(prev, h) { Object.values(this._cards).flat().forEach((c) => { c.hass = h; }); }

  async _fill(id) {
    if (this._cards[id]) return;
    this._cards[id] = [];
    const tab = this.config.tabs.find((t) => t.id === id), helpers = await this._helpers;
    const panel = this.renderRoot.querySelector(`[data-panel="${id}"]`);
    this._cards[id] = (tab.cards || []).map((conf) => {
      const el = helpers ? helpers.createCardElement(conf) : document.createElement(conf.type.replace("custom:", ""));
      if (!helpers) el.setConfig?.(conf);
      el.hass = this._real;
      panel.appendChild(el);
      return el;
    });
  }

  select(id) {
    if (!this.config.tabs.some((t) => t.id === id)) return;
    const ids = this.config.tabs.map((t) => t.id), from = ids.indexOf(this._active), to = ids.indexOf(id);
    this._active = id;
    try { sessionStorage.setItem("nice-tab", id); } catch (e) { /* storage blocked */ }
    this.requestUpdate();
    this.updateComplete.then(async () => {
      await this._fill(id);
      if (from !== to && !calm()) for (const c of this._cards[id] || []) c.animate([{ opacity: 0, transform: `translateX(${to > from ? 28 : -28}px)` }, { opacity: 1, transform: "none" }], { duration: 450, easing: EASE_OUT });
    });
  }

  firstUpdated() {
    this.renderRoot.addEventListener("nice-tab", (e) => { e.stopPropagation(); this.select(e.detail.tab); });
    new ResizeObserver(() => this._glide()).observe(this.renderRoot.querySelector(".bar"));
    document.fonts?.ready.then(() => this._glide());
    this._fill(this._active);
  }
  updated() { this._glide(); this._reveal(); }

  // The dark pill slides under whichever tab is chosen
  _glide() {
    const bar = this.renderRoot.querySelector(".bar"), ind = bar?.querySelector(".ind"), b = bar?.querySelector('[aria-selected="true"]');
    if (!ind || !b || !b.offsetWidth) return;
    Object.assign(ind.style, { width: `${b.offsetWidth}px`, height: `${b.offsetHeight}px`, transform: `translate(${b.offsetLeft}px, ${b.offsetTop}px)` });
    if (!bar.classList.contains("glide")) requestAnimationFrame(() => bar.classList.add("glide"));
  }
  // On a phone the row scrolls sideways: bring the chosen tab into view by scrolling the
  // row itself (never scrollIntoView, which would also move the page)
  _reveal() {
    const bar = this.renderRoot.querySelector(".bar"), b = bar?.querySelector('[aria-selected="true"]');
    if (!b) return;
    const left = b.offsetLeft - 8, right = b.offsetLeft + b.offsetWidth + 8;
    if (left < bar.scrollLeft) bar.scrollLeft = left;
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  }

  render() {
    return html`<div class="bar" role="tablist"><span class="ind" aria-hidden="true"></span>${this.config.tabs.map((t) => html`<button class="pill" role="tab" aria-selected=${t.id === this._active} @click=${() => this.select(t.id)}>${t.label}</button>`)}</div>
      <div class="panels">${this.config.tabs.map((t) => html`<div class="panel" data-panel=${t.id} role="tabpanel" ?hidden=${t.id !== this._active}></div>`)}</div>`;
  }

  getCardSize() { return 10; }
  static styles = [tokens, controlStyles, css`
    :host { container-type: inline-size; padding-top: var(--n-s-xl); font-family: var(--n-body); }
    .bar { position: relative; display: flex; gap: var(--n-s-sm); overflow-x: auto; scrollbar-width: none; padding: var(--n-s-2xs) 0 var(--n-s-md); }
    .bar::-webkit-scrollbar { display: none; }
    .bar .pill { position: relative; z-index: 1; background: var(--n-chrome-bg); color: var(--n-chrome-ink-strong); }
    .bar .pill[aria-selected="true"] { background: var(--n-chrome-sel-bg); color: var(--n-chrome-sel-ink); }
    .bar .ind { position: absolute; left: 0; top: 0; z-index: 0; border-radius: var(--n-r-full); background: var(--n-chrome-sel-bg); pointer-events: none; opacity: 0; }
    .bar.glide .ind { opacity: 1; transition: transform .5s var(--n-spring), width .5s var(--n-spring), background-color .3s ease; }
    .bar.glide .pill[aria-selected="true"] { background: transparent; }
    .panel { display: grid; gap: var(--n-gap); }
    .panel[hidden] { display: none; }
    @container (max-width: 520px) { .bar { margin: 0 calc(-1 * var(--n-s-sm)); padding-left: var(--n-s-sm); padding-right: var(--n-s-sm); } .bar .pill { flex: none; } }
  `];
}
customElements.define("nice-tabs", NiceTabs);
