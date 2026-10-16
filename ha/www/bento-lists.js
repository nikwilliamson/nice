// Bento lists - to-do lists as bento tiles, side by side (stacked on a phone).
// Card: bento-lists
//
//   type: custom:bento-lists
//   lists:
//     - entity: todo.house_alerts
//       label: To-do
//       tone: health          # a bento-core tone
//       placeholder: Add a to-do
//       upper: true           # store new items in capitals, as the Home tile's + Add does
//     - entity: todo.shopping_list
//       label: Shopping
//       tone: today
//       placeholder: Add to the list
//       get: true             # "3 things to get" rather than "3 things to do"
//
// Items come live from each list (todo/item/subscribe), so a change made anywhere shows at
// once. Tick an item to finish it; done items fold away under "Show done", with Clear done.
// Palette, tile styles and night mode come from bento-core.js (fonts from bento-cards.js).
const BENTO_LISTS_VERSION = "1.1.0";

import { BENTO_TOKENS_CSS, BENTO_BASE_CSS, tone, esc, isNight, applyNight, pageGutter } from "./bento-core.js?v=1.1.0";

// iOS WebKit (the Home Assistant app) jumps the page back to the top when a card swaps out its
// whole shadow tree, even when nothing changed size. Every redraw that replaces this card's
// markup goes through here: if the page's scroll moved, it's put back before anything paints.
// The same helper as bento-cards.js.
function keepScroll(redraw) {
  const page = document.scrollingElement;
  const y = page ? page.scrollTop : 0;
  redraw();
  if (page && page.scrollTop !== y) page.scrollTop = y;
}

// House alerts are stored in capitals; every list reads as a sentence
const sentence = (s) => { const t = String(s || "").trim().toLowerCase().replace(/[.!]+$/, ""); return t.charAt(0).toUpperCase() + t.slice(1); };

class BentoLists extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.lists) || !config.lists.length) throw new Error("bento-lists needs lists");
    this._config = { sun: "sun.sun", font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._items = {};
    this._open = {};
    this._sig = null;
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() {
    if (!this._gutter) { this._gutter = true; pageGutter(true); }
    if (this._hass) this._subscribe();
  }
  disconnectedCallback() {
    if (this._gutter) { this._gutter = false; pageGutter(false); }
    (this._unsubs || []).forEach((p) => p.then((un) => un?.()).catch(() => {}));
    this._unsubs = null;
  }

  // One live subscription per list, opened once the card has both hass and a place on the page
  _subscribe() {
    if (this._unsubs || !this.isConnected || !this._hass?.connection) return;
    this._unsubs = this._config.lists.map((l) => this._hass.connection.subscribeMessage((msg) => {
      this._items[l.entity] = msg.items || [];
      this._sig = null;
      this.hass = this._hass;
    }, { type: "todo/item/subscribe", entity_id: l.entity }));
  }

  set hass(hass) {
    this._hass = hass;
    this._subscribe();
    const night = applyNight(this, isNight(hass, this._config.sun));
    const sig = JSON.stringify([night, this._open, this._config.lists.map((l) => this._items[l.entity] ?? null)]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._night = night;
    keepScroll(() => this._render());
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    // Keep anything half-typed, and the cursor, across a redraw
    const typed = [...this.shadowRoot.querySelectorAll("form input")].map((i) => i.value);
    const focus = this.shadowRoot.activeElement?.closest?.("form")?.dataset.list;
    this.shadowRoot.innerHTML = `<style>${BENTO_TOKENS_CSS}${BENTO_BASE_CSS}${LISTS_CSS}</style>
      <div class="lists ${this._night ? "is-night" : ""}">${this._config.lists.map((l, i) => this._list(l, i)).join("")}</div>`;
    this.shadowRoot.querySelectorAll("form input").forEach((input, i) => { if (typed[i]) input.value = typed[i]; });
    if (focus != null) this.shadowRoot.querySelector(`form[data-list="${focus}"] input`)?.focus();
    this._wire();
  }

  _list(l, li) {
    const c = tone(l.tone || "health", this._night);
    const items = this._items[l.entity];
    const open = (items || []).filter((i) => i.status !== "completed"), done = (items || []).filter((i) => i.status === "completed");
    const say = items == null ? "…"
      : open.length === 1 ? "Just one thing"
      : open.length ? `${open.length} things to ${l.get ? "get" : "do"}`
      : l.get ? "Nothing to get" : "All done";
    const row = (i) => `<li class="${i.status === "completed" ? "done" : ""}"><button class="tick" data-tick="${li}" data-uid="${esc(i.uid)}" data-done="${i.status === "completed"}" aria-label="${i.status === "completed" ? "Not done" : "Done"}: ${esc(sentence(i.summary))}"></button><span>${esc(sentence(i.summary))}</span></li>`;
    const showing = this._open[l.entity];
    return `<section class="tile" style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent}">
      <div class="lbl">${esc(l.label || this._hass.states[l.entity]?.attributes?.friendly_name || l.entity)}</div>
      <div class="say">${esc(say)}</div>
      <form data-list="${li}"><input type="text" enterkeyhint="done" placeholder="${esc(l.placeholder || "Add an item")}" aria-label="${esc(l.placeholder || "Add an item")}"><button class="act" type="submit">Add</button></form>
      ${open.length ? `<ul class="items">${open.map(row).join("")}</ul>` : ""}
      ${done.length ? `<div class="donebar"><button class="more" data-open="${li}">${showing ? "Hide" : "Show"} done · ${done.length}</button>${showing ? `<button class="more" data-clear="${li}">Clear done</button>` : ""}</div>
        ${showing ? `<ul class="items">${done.map(row).join("")}</ul>` : ""}` : ""}
    </section>`;
  }

  _wire() {
    const root = this.shadowRoot, lists = this._config.lists;
    root.querySelectorAll("[data-tick]").forEach((b) => b.addEventListener("click", () => {
      this._hass.callService("todo", "update_item", { item: b.dataset.uid, status: b.dataset.done === "true" ? "needs_action" : "completed" }, { entity_id: lists[b.dataset.tick].entity });
    }));
    root.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const l = lists[f.dataset.list], input = f.querySelector("input"), item = input.value.trim();
      if (!item) return;
      this._hass.callService("todo", "add_item", { item: l.upper ? item.toUpperCase() : item }, { entity_id: l.entity });
      input.value = "";
    }));
    root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => {
      const id = lists[b.dataset.open].entity;
      this._open = { ...this._open, [id]: !this._open[id] };
      this.hass = this._hass;
    }));
    root.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => {
      this._hass.callService("todo", "remove_completed_items", {}, { entity_id: lists[b.dataset.clear].entity });
    }));
  }
}

// Only what is the lists' own; tiles, pills and night mode come from bento-core
const LISTS_CSS = `
  :host { display: block; container-type: inline-size; font-family: var(--b-body); }
  .lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--b-gap); align-items: start; }
  .tile { grid-template-rows: none; align-content: start; gap: var(--b-s-md); padding: var(--b-s-lg); min-height: calc(var(--b-row) * 2 + var(--b-gap)); cursor: default; }
  .say { margin-top: calc(-1 * var(--b-s-xs)); }
  form { display: flex; gap: var(--b-s-sm); }
  input { flex: 1; min-width: 0; width: 100%; font: inherit; font-size: 1em; padding: var(--b-s-sm) var(--b-s-md); border: 0; border-radius: var(--b-r-md); background: var(--b-pill-bg); color: inherit; }
  .is-night input { background: var(--b-pill-bg-night); }
  input::placeholder { color: inherit; opacity: .5; }
  input:focus-visible { outline: var(--b-ring) solid var(--b-focus); outline-offset: 1px; }
  .act { flex: none; font: inherit; font-size: var(--b-pill-size); font-weight: var(--b-pill-weight); border: 0; border-radius: var(--b-pill-radius); padding: var(--b-pill-pad); cursor: pointer; background: var(--ink); color: var(--bg); }
  .items { list-style: none; margin: 0; padding: 0; display: grid; }
  .items li { display: flex; gap: var(--b-s-md); align-items: center; padding: var(--b-s-sm) var(--b-s-2xs); font-weight: 700; font-size: 1.02em; border-top: 1px solid rgba(28,34,51,.07); }
  .is-night .items li { border-top-color: rgba(255,255,255,.08); }
  .items li:first-child { border-top: 0; }
  .items li span { min-width: 0; overflow-wrap: anywhere; }
  .tick { flex: none; position: relative; width: var(--b-c-sm); height: var(--b-c-sm); padding: 0; border: 0; border-radius: 50%; cursor: pointer; color: inherit; background: transparent; box-shadow: inset 0 0 0 2px currentColor; opacity: .5; }
  .tick:hover { opacity: 1; }
  .done span { text-decoration: line-through; opacity: .5; }
  .done .tick { background: currentColor; opacity: .35; }
  .done .tick::after { content: ""; position: absolute; left: 7px; top: 4px; width: 5px; height: 9px; border: solid var(--bg); border-width: 0 2px 2px 0; transform: rotate(45deg); }
  .donebar { display: flex; gap: var(--b-s-sm); }
  .more { font: inherit; font-size: 0.82em; font-weight: 800; border: 0; border-radius: var(--b-r-full); padding: var(--b-s-xs) var(--b-s-md); cursor: pointer; background: var(--b-pill-bg); color: inherit; }
  .is-night .more { background: var(--b-pill-bg-night); }
  button:focus-visible { outline: var(--b-ring) solid var(--b-focus); outline-offset: 2px; }
  /* On a phone the lists stack, each the full width */
  @container (max-width: 520px) { .lists { grid-template-columns: minmax(0, 1fr); } .tile { min-height: 0; } }
`;

customElements.define("bento-lists", BentoLists);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bento-lists", name: "Bento lists", description: "To-do lists as bento tiles: tick, add, and fold away what's done." });
console.info(`%c BENTO LISTS %c ${BENTO_LISTS_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
