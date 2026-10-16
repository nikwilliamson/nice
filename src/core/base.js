// NiceCard: what every Nice card shares.
//
// - hass is a plain setter, not a Lit property. A card redraws only when one of the
//   entities it lists in watch() has a new state object (Home Assistant replaces the
//   object on every change, so this is a reference check), when night flips, or when it
//   asks to with refresh().
// - this.hass is the real hass with the card's pending changes laid over it.
// - Night is the sun, not the theme: .is-night on the host switches the night tokens.
// - call(domain, service, data, target) goes through the pending store, so taps show at once.
import { LitElement } from "lit";
import { Pending } from "./pending.js";
import { isNight } from "./nav.js";

let gutters = 0;
// While a Nice card is on the page, keep a stable scrollbar gutter so the layout doesn't
// shift as the scrollbar comes and goes
function gutter(on) {
  if (!document.getElementById("nice-gutter")) {
    const s = document.createElement("style");
    s.id = "nice-gutter";
    s.textContent = "html.nice-page { scrollbar-gutter: stable both-edges; }";
    document.head.appendChild(s);
  }
  gutters = Math.max(0, gutters + (on ? 1 : -1));
  document.documentElement.classList.toggle("nice-page", gutters > 0);
}

export class NiceCard extends LitElement {
  // Config keys every card takes
  static defaults = { sun: "sun.sun", font_scale: 1 };

  constructor() {
    super();
    this.pending = new Pending(this);
    this._real = null;
    this._view = null;
  }

  setConfig(config) {
    const missing = (this.constructor.required || []).find((k) => config?.[k] == null);
    if (missing) throw new Error(`${this.localName} needs ${missing}`);
    this.config = { ...NiceCard.defaults, ...this.constructor.defaults, ...(config || {}) };
    this.style.setProperty("--nice-scale", this.config.font_scale);
    this.configChanged?.();
    this.requestUpdate();
  }

  set hass(h) {
    const prev = this._real;
    this._real = h;
    const next = this.pending.view(h);
    const night = isNight(h, this.config?.sun);
    const changed = !prev || !this._view || night !== this.night || prev.user !== h.user || this.watch().some((id) => prev.states[id] !== h.states[id]) || this.pending.items.size;
    this._view = next;
    this.night = night;
    if (changed) this.requestUpdate();
    this.hassChanged?.(prev, h);
  }
  get hass() { return this._view; }

  // Entities whose changes redraw this card
  watch() { return []; }

  // Redraw now (after a local change, a timer, or a pending change running out)
  refresh() { if (this._real) { this._view = this.pending.view(this._real); this.requestUpdate(); } }

  call(domain, service, data = {}, target) { return this.pending.call(this._real, domain, service, data, target); }
  callEntity(svc, entityId, data = {}) { const [d, s] = svc.split("."); return this.call(d, s, data, entityId ? { entity_id: entityId } : undefined); }

  willUpdate() { this.classList.toggle("is-night", !!this.night); }
  shouldUpdate() { return !!(this.config && this._view); }

  connectedCallback() { super.connectedCallback(); gutter(true); }
  disconnectedCallback() { super.disconnectedCallback(); gutter(false); clearInterval(this._tick); }

  // A card whose words depend on the clock ("4 min ago") redraws every so often
  every(ms) { clearInterval(this._tick); this._tick = setInterval(() => this.refresh(), ms); }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
}
