// <nice-tile>: one tile, drawn from a descriptor. Every Nice card draws its tiles with it.
//
// The descriptor (the same shape the rules send in sensor.nice_tiles_*, plus what a card
// adds in the browser):
//   id, shape (S W T L F FL), tier (0 pulses), tone | color | colors, label, badge, say, big,
//   sub, viz ({ type, ... } — see charts/), layout (override), score (pulses when it rises)
//   act       { label, run(), confirm } or { type: "todo_add", add(text) }
//   controls  [control] on the bottom edge (see controls/)
//   picture   markup drawn between the eyebrow and the words (the car, the litter robot)
//   backdrop  markup drawn behind everything (an LED strip's effect)
//   tap(), hold()   the tile's main action and its details
//   cls       extra classes (on, off, media, …)
// The tile keeps its own state: a half-typed chore, ticked items, the board as it was,
// which button is armed, where you last tapped.
import { LitElement, html, nothing } from "lit";
import { tokens } from "../core/tokens.js";
import { colorsOf } from "../core/tones.js";
import { bindPress, pressable, Confirm } from "../core/interaction.js";
import { flood, countUp, arrive, wiggle, celebrate } from "../core/motion.js";
import { sentence } from "../core/format.js";
import { chart, layoutOf, chartStyles } from "../charts/index.js";
import { control, controlStyles } from "../controls/index.js";
import { tileStyles, textStyles } from "./styles.js";
import { extraStyles } from "./extra-styles.js";
import { illusStyles } from "../illus/styles.js";

export class NiceTile extends LitElement {
  static properties = { tile: { attribute: false }, night: { type: Boolean }, series: { attribute: false }, _adding: { state: true } };
  static styles = [tokens, controlStyles, textStyles, tileStyles, ...chartStyles, extraStyles, illusStyles];

  constructor() {
    super();
    this.confirm = new Confirm(this);
    this._ticked = {};
    this._tap = null;
    bindPress(this, () => ({ tap: this.tile?.tap, hold: this.tile?.hold }));
    this.addEventListener("pointerdown", (ev) => { const r = this.getBoundingClientRect(); this._tap = { x: ev.clientX - r.left, y: ev.clientY - r.top, t: performance.now() }; });
  }

  willUpdate(changed) {
    const t = this.tile || {};
    const c = colorsOf(t, this.night);
    this._from = this._colors?.bg;
    this._colors = c;
    this.style.setProperty("--bg", c.bg);
    this.style.setProperty("--ink", c.ink);
    this.style.setProperty("--accent", c.accent || c.ink);
    this.setAttribute("shape", t.shape || "S");
    this.className = [t.tier === 0 ? "p0" : "", this.night ? "night" : "", ...(t.cls || [])].filter(Boolean).join(" ");
    pressable(this, t.tap || t.hold);
    // A goal: our side's score went up since the last draw. The tile pulses for a minute
    if (typeof t.score === "number") {
      if (this._score != null && t.score > this._score) this._goalAt = Date.now();
      this._score = t.score;
    }
    this.classList.toggle("goal", !!this._goalAt && Date.now() - this._goalAt < 60000);
    // The board as it was, so changed flaps flip in (only on a change, never on a redraw)
    if (t.viz?.type === "board") {
      const key = JSON.stringify([t.viz.lines, t.viz.text]);
      if (this._board?.key !== key) this._board = { key, prev: this._board ? this._board.v : { lines: [] }, v: { lines: t.viz.lines, text: t.viz.text }, at: Date.now() };
    }
    this._say = changed.has("tile") ? changed.get("tile")?.say : undefined;
  }

  firstUpdated() { if (!this.tile?.still) arrive(this); }

  updated() {
    // The new colour spills out from the finger, if you just tapped this tile
    if (this._from && this._from !== this._colors.bg && this._tap && performance.now() - this._tap.t < 4000) {
      flood(this, this._from, this._colors.bg, this._tap.x, this._tap.y);
      this._tap = null;
    }
    // A number that changed counts to its new value, unless you changed it yourself
    if (this._say && this.tile?.say && this._say !== this.tile.say && !(this._tap && performance.now() - this._tap.t < 5000)) {
      const node = [...(this.renderRoot.querySelector(".say")?.childNodes || [])].find((n) => n.nodeType === 3 && n.data.trim());
      countUp(node, this._say, this.tile.say);
    }
    const armed = this.renderRoot.querySelector(".armed");
    if (armed && armed !== this._armedEl) wiggle(armed);
    this._armedEl = armed;
  }

  // ── pieces
  _act(t) {
    const a = t.act;
    if (!a) return nothing;
    if (a.type === "todo_add") {
      if (!this._adding) return html`<button class="act add" @click=${(e) => { e.stopPropagation(); this._adding = true; this.updateComplete.then(() => this.renderRoot.querySelector(".addfield input")?.focus()); }}>${a.label}</button>`;
      const submit = (e) => { e.preventDefault(); const v = e.target.querySelector("input").value.trim(); if (v) a.add(v); this._adding = false; };
      return html`<form class="addfield" @submit=${submit} @click=${(e) => e.stopPropagation()}><input type="text" placeholder=${a.placeholder || "Add a chore"} aria-label="New chore">
        <div class="addrow"><button type="submit" class="act">Done</button><button type="button" class="cancel" aria-label="Cancel" @click=${() => { this._adding = false; }}>×</button></div></form>`;
    }
    const key = `act:${t.id}`, armed = a.confirm && this.confirm.armed(key);
    const run = (e) => { e.stopPropagation(); a.confirm ? this.confirm.tap(key, a.run) : a.run?.(); };
    return html`<button class="act ${armed ? "armed" : ""}" @click=${run}>${armed ? "Tap again" : a.label}</button>`;
  }

  _list(v) {
    const fresh = (i) => !this._ticked[i.uid] || Date.now() - this._ticked[i.uid] < 800;
    const tick = (e, i) => {
      e.stopPropagation();
      if (this._ticked[i.uid]) return;
      this._ticked[i.uid] = Date.now();
      const btn = e.currentTarget, li = btn.closest("li");
      celebrate(btn, this.renderRoot.querySelectorAll(".list .tick:not(.done)").length <= 1);
      li?.animate([{ height: `${li.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 380, delay: 450, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" });
      this.requestUpdate();
      setTimeout(() => v.tick?.(i.uid), 800);
      setTimeout(() => { delete this._ticked[i.uid]; }, 15000);
    };
    return html`<ul class="list">${(v.items || []).filter(fresh).map((i) => html`<li class=${this._ticked[i.uid] ? "done" : ""}>
      <button class="tick ${this._ticked[i.uid] ? "done" : ""}" aria-label="Done: ${sentence(i.summary)}" @click=${(e) => tick(e, i)}></button>${sentence(i.summary)}</li>`)}</ul>`;
  }

  _viz(t) {
    const v = t.viz;
    if (!v?.type) return nothing;
    if (v.type === "list") return this._list(v);
    if (v.type === "buttons") return html`<div class="row">${(v.items || []).map((b) => html`<button class="pill ${b.primary ? "sel" : ""}" @click=${(e) => { e.stopPropagation(); b.run?.(); }}>${b.label}</button>`)}</div>`;
    const c = chart(v.type);
    if (!c) return nothing;
    const vv = v.type === "board" ? { ...v, prev: Date.now() - (this._board?.at || 0) < 2500 ? this._board.prev : null } : v;
    return c.render(vv, { night: this.night, colors: this._colors, series: this.series, shape: t.shape });
  }

  render() {
    const t = this.tile;
    if (!t) return nothing;
    const lay = t.layout || (t.picture ? "picture" : layoutOf(t.viz));
    this.setAttribute("lay", lay);
    const label = t.badge ? html`<div class="lblrow"><div class="lbl">${t.label}</div><span class="badge"><i></i>${t.badge}</span></div>` : t.label ? html`<div class="lbl">${t.label}</div>` : nothing;
    const act = this._act(t);
    const words = html`<div class="txt">${t.say ? html`<div class="say ${t.big ? "big" : ""}">${t.say}</div>` : nothing}${t.sub ? html`<div class="sub">${t.sub}</div>` : nothing}${lay === "after" || lay === "picture" ? nothing : act}</div>`;
    const viz = this._viz(t);
    const controls = t.controls?.length ? html`<div class="foot">${t.controls.map((c) => control(c, { confirm: this.confirm }))}</div>` : nothing;
    let body;
    switch (lay) {
      case "side": body = html`<div class="sidebody">${words}<div class="vz">${viz}</div></div>`; break;
      case "bleed": body = html`${words}<div class="bleed">${viz}</div>`; break;
      case "after": body = html`${words}<div class="vz">${viz}</div>${act}`; break;
      case "foot": body = html`${words}<div class="vz">${viz}</div>`; break;
      case "stack": body = html`<div class="vz">${viz}</div>${words}`; break;
      case "picture": body = html`<div class="picture">${t.picture}</div>${words}${act}`; break;
      default: body = words;
    }
    return html`${t.backdrop || nothing}${label}${body}${controls}`;
  }
}
customElements.define("nice-tile", NiceTile);

// Place a packed tile on its card's grid
export const place = (t) => `grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}`;
