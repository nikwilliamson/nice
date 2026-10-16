// nice-lists: to-do lists side by side (stacked on a phone). Items come live from each list
// (todo/item/subscribe), so a change made anywhere shows at once. Tick an item to finish
// it; done items fold away under "Show done", with Clear done.
//
//   type: custom:nice-lists
//   lists:
//     - { entity: todo.house_alerts, label: To-do, tone: health, placeholder: Add a to-do, upper: true }
//     - { entity: todo.shopping_list, label: Shopping, tone: today, get: true }   # "things to get"
import { html, css, nothing } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { tone } from "../core/tones.js";
import { sentence } from "../core/format.js";
import { controlStyles } from "../controls/index.js";
import { textStyles } from "../tile/styles.js";
import { formEditor } from "../editors/form.js";
import { LISTS } from "../editors/specs.js";

export class NiceLists extends NiceCard {
  static getConfigElement() { return formEditor(LISTS); }
  static required = ["lists"];
  constructor() { super(); this._items = {}; this._open = {}; }
  watch() { return this.config.lists.map((l) => l.entity); }

  updated() { this._subscribe(); }
  disconnectedCallback() { super.disconnectedCallback(); (this._unsubs || []).forEach((p) => p.then((un) => un?.()).catch(() => {})); this._unsubs = null; }
  _subscribe() {
    if (this._unsubs || !this.isConnected || !this._real?.connection) return;
    this._unsubs = this.config.lists.map((l) => this._real.connection.subscribeMessage((msg) => { this._items[l.entity] = msg.items || []; this.requestUpdate(); }, { type: "todo/item/subscribe", entity_id: l.entity }));
  }

  _list(l) {
    const c = tone(l.tone || "health", this.night), items = this._items[l.entity];
    const open = (items || []).filter((i) => i.status !== "completed"), done = (items || []).filter((i) => i.status === "completed");
    const say = items == null ? "…" : open.length === 1 ? "Just one thing" : open.length ? `${open.length} things to ${l.get ? "get" : "do"}` : l.get ? "Nothing to get" : "All done";
    const tick = (i) => this._real.callService("todo", "update_item", { item: i.uid, status: i.status === "completed" ? "needs_action" : "completed" }, { entity_id: l.entity });
    const row = (i) => html`<li class=${i.status === "completed" ? "done" : ""}><button class="tick ${i.status === "completed" ? "done" : ""}" aria-label="${i.status === "completed" ? "Not done" : "Done"}: ${sentence(i.summary)}" @click=${() => tick(i)}></button><span>${sentence(i.summary)}</span></li>`;
    const add = (e) => {
      e.preventDefault();
      const input = e.target.querySelector("input"), item = input.value.trim();
      if (item) this._real.callService("todo", "add_item", { item: l.upper ? item.toUpperCase() : item }, { entity_id: l.entity });
      input.value = "";
    };
    const showing = this._open[l.entity];
    return html`<section class="tile" style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent}">
      <div class="lbl">${l.label || this.hass.states[l.entity]?.attributes?.friendly_name || l.entity}</div>
      <div class="say">${say}</div>
      <form @submit=${add}><input type="text" enterkeyhint="done" placeholder=${l.placeholder || "Add an item"} aria-label=${l.placeholder || "Add an item"}><button class="act" type="submit">Add</button></form>
      ${open.length ? html`<ul class="items">${open.map(row)}</ul>` : nothing}
      ${done.length ? html`<div class="row"><button class="pill" @click=${() => { this._open = { ...this._open, [l.entity]: !showing }; this.requestUpdate(); }}>${showing ? "Hide" : "Show"} done · ${done.length}</button>
        ${showing ? html`<button class="pill" @click=${() => this._real.callService("todo", "remove_completed_items", {}, { entity_id: l.entity })}>Clear done</button>` : nothing}</div>
        ${showing ? html`<ul class="items">${done.map(row)}</ul>` : nothing}` : nothing}
    </section>`;
  }

  render() { return html`<div class="lists">${this.config.lists.map((l) => this._list(l))}</div>`; }

  getCardSize() { return 6; }
  static styles = [tokens, controlStyles, textStyles, css`
    :host { container-type: inline-size; font-family: var(--n-body); }
    .lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--n-gap); align-items: start; }
    .tile { background: var(--bg); color: var(--ink); border-radius: var(--n-r-tile); display: grid; align-content: start; gap: var(--n-s-md); padding: var(--n-s-lg); min-height: calc(var(--n-row) * 2 + var(--n-gap)); }
    form { display: flex; gap: var(--n-s-sm); }
    input { flex: 1; min-width: 0; font: inherit; font-size: 1em; padding: var(--n-s-sm) var(--n-s-md); border: 0; border-radius: var(--n-r-md); background: var(--n-pill-bg); color: inherit; }
    input::placeholder { color: inherit; opacity: .5; }
    input:focus-visible { outline: var(--n-ring) solid var(--n-focus); outline-offset: 1px; }
    .act { margin: 0; flex: none; }
    .items { list-style: none; margin: 0; padding: 0; display: grid; }
    .items li { display: flex; gap: var(--n-s-md); align-items: center; padding: var(--n-s-sm) var(--n-s-2xs); font-weight: 700; font-size: 1.02em; border-top: 1px solid rgba(28,34,51,.07); }
    :host(.is-night) .items li { border-top-color: rgba(255,255,255,.08); }
    .items li:first-child { border-top: 0; }
    .items li span { min-width: 0; overflow-wrap: anywhere; }
    .items li.done span { text-decoration: line-through; opacity: .5; }
    @container (max-width: 520px) { .lists { grid-template-columns: minmax(0, 1fr); } .tile { min-height: 0; } }
  `];
}
customElements.define("nice-lists", NiceLists);
