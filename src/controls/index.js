// The controls a tile can carry on its bottom edge. A tile descriptor lists them:
//
//   { type: "pills", items: [pill], seg }    a row of pills; seg draws them as one segmented control
//   { type: "slider", value, min, label, set(v) }   drag along the bar; set() once the finger lifts
//   { type: "setpoint", value, unit, step(dir) }    − value +
//   { type: "select", label, value, options, word(o), pick(o) }  a pill with the phone's own picker
//   { type: "between", items: [control] }    two controls at either end of a row
//   { type: "row", items: [control] }        controls side by side
//   { type: "custom", render() }             anything else the card draws itself
//
//   pill = { label, run(), sel, go, disabled, confirm: "key", armed: "Tap again" }
//
// Each control owns its own interaction state, so nothing redraws under a finger.
import { LitElement, html, css, nothing } from "lit";

class NiceSlider extends LitElement {
  static properties = { value: { type: Number }, min: { type: Number }, label: { type: String }, _v: { state: true } };
  static styles = css`
    :host { display: block; position: relative; height: 12px; border-radius: var(--n-r-full); background: var(--slide-bg, rgba(28,34,51,.1)); cursor: ew-resize; touch-action: none; margin-top: var(--n-s-2xs); }
    :host::before { content: ""; position: absolute; inset: -12px 0; }
    :host([labelled]) { height: var(--n-c-sm); border-radius: var(--n-r-sm); }
    i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: var(--slide-fill, var(--accent)); min-width: 12px; }
    :host([labelled]) i { opacity: .55; }
    span { position: relative; display: block; line-height: var(--n-c-sm); padding-left: var(--n-s-md); font-size: 0.78em; font-weight: 800; pointer-events: none; }
  `;
  constructor() {
    super();
    this.min = 0;
    this._v = null;
    this.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); this.setPointerCapture(ev.pointerId); this._v = this._at(ev); this._emit("input"); });
    this.addEventListener("pointermove", (ev) => { if (this._v == null) return; this._v = this._at(ev); this._emit("input"); });
    const done = () => { if (this._v == null) return; const v = this._v; this._emit("change", v); this._v = null; };
    this.addEventListener("pointerup", done);
    this.addEventListener("pointercancel", done);
    this.addEventListener("click", (ev) => ev.stopPropagation());
  }
  _at(ev) { const r = this.getBoundingClientRect(); return Math.max(this.min, Math.min(100, Math.round(((ev.clientX - r.left) / r.width) * 100))); }
  _emit(type, v = this._v) { this.dispatchEvent(new CustomEvent(type === "change" ? "slide" : "sliding", { detail: { value: v }, bubbles: true, composed: true })); }
  render() {
    const v = this._v ?? this.value ?? 0;
    this.toggleAttribute("labelled", !!this.label);
    return html`<i style="width:${v}%;${v ? "" : "display:none"}"></i>${this.label ? html`<span>${this.label.replace("{v}", v)}</span>` : nothing}`;
  }
}
customElements.define("nice-slider", NiceSlider);

const pill = (p, confirm) => {
  const armed = p.confirm && confirm?.armed(p.confirm);
  const run = (ev) => { ev.stopPropagation(); if (p.disabled) return; p.confirm ? confirm.tap(p.confirm, p.run) : p.run?.(); };
  return html`<button class="pill ${p.sel ? "sel" : ""} ${p.go || armed ? "go" : ""} ${armed ? "armed" : ""}" ?disabled=${p.disabled} title=${p.title || ""} @click=${run}>${armed ? p.armed || "Tap again" : p.label}</button>`;
};

export function control(c, ctx) {
  if (!c) return nothing;
  switch (c.type) {
    case "pills": return html`<span class="row ${c.seg ? "seg" : ""}">${c.items.filter(Boolean).map((p) => pill(p, ctx.confirm))}</span>`;
    case "between": return html`<div class="row between">${c.items.map((x) => control(x, ctx))}</div>`;
    case "row": return html`<div class="row">${c.items.map((x) => control(x, ctx))}</div>`;
    case "slider": return html`<nice-slider .value=${c.value} .min=${c.min ?? 0} .label=${c.label || ""}
        @sliding=${(e) => c.preview?.(e.detail.value)} @slide=${(e) => c.set(e.detail.value)}></nice-slider>`;
    case "setpoint": return html`<div class="setp"><button class="step" aria-label=${c.less || "Down"} @click=${(e) => { e.stopPropagation(); c.step(-1); }}>−</button>
        <b>${c.value}${c.unit ?? "°"}</b><button class="step" aria-label=${c.more || "Up"} @click=${(e) => { e.stopPropagation(); c.step(1); }}>+</button></div>`;
    case "select": return html`<label class="dd"><span>${c.label}</span><b>${(c.word || String)(c.value)}</b>
        <select aria-label=${c.label} @click=${(e) => e.stopPropagation()} @change=${(e) => c.pick(e.target.value)}>
          ${c.options.map((o) => html`<option value=${o} ?selected=${o === c.value}>${(c.word || String)(o)}</option>`)}</select></label>`;
    // Anything a card draws itself on the bottom edge (the power bars)
    case "custom": return c.render();
    default: return nothing;
  }
}

// Pills, setpoints, sliders and pickers, the same everywhere
export const controlStyles = css`
  .row { display: flex; flex-wrap: wrap; gap: var(--n-s-sm); align-items: center; }
  .row.between { justify-content: space-between; }
  .pill, .act, .step { font: inherit; border: 0; cursor: pointer; white-space: nowrap; transition: transform .4s var(--n-spring), background-color .2s ease, color .2s ease, opacity .2s ease; }
  .pill, .act { font-size: var(--n-pill-size); font-weight: var(--n-pill-weight); border-radius: var(--n-r-full); padding: var(--n-s-sm) var(--n-s-md); }
  .pill:active:not(:disabled), .act:active, .step:active { transform: scale(.9); transition-duration: .1s; }
  .pill { background: var(--n-pill-bg); color: inherit; }
  .pill:disabled { opacity: .5; cursor: default; }
  .pill.sel { background: var(--ink); color: var(--bg); }
  .pill.go { background: var(--n-warn); color: #fff; }
  .pill.big { font-size: 1em; padding: var(--n-s-md) var(--n-s-xl); box-shadow: 0 2px 0 rgba(28,34,51,.12); }
  .armed { position: relative; overflow: hidden; }
  .armed::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 3px; height: 2px; border-radius: 2px; background: currentColor; opacity: .85; transform-origin: 0 50%; animation: drain 4s linear forwards; }
  @keyframes drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .seg { display: inline-flex; padding: var(--n-s-xs); gap: var(--n-s-2xs); border-radius: var(--n-r-full); background: var(--n-pill-bg); }
  .seg .pill { background: transparent; }
  .seg .pill.sel { background: var(--ink); color: var(--bg); }
  .setp { display: flex; align-items: center; gap: var(--n-s-md); }
  .setp b { font-family: var(--n-display); font-weight: 800; font-size: 1.4em; min-width: 2.4em; text-align: center; }
  .step { font-size: 1.4em; font-weight: 800; width: var(--n-c-lg); height: var(--n-c-lg); border-radius: 50%; background: var(--n-pill-bg); color: inherit; line-height: 1; }
  .dd { position: relative; display: inline-flex; align-items: baseline; gap: var(--n-s-sm); min-width: 0; max-width: 100%; border-radius: var(--n-r-full); padding: var(--n-s-sm) var(--n-s-xl) var(--n-s-sm) var(--n-s-md);
    font-size: 0.86em; font-weight: 800; white-space: nowrap; cursor: pointer; background: rgba(255,255,255,.16); }
  .dd span { opacity: .7; }
  .dd b { font-weight: 800; overflow: hidden; text-overflow: ellipsis; }
  .dd select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; -webkit-appearance: none; appearance: none; }
  .dd select option { color: #1c2233; background: #fff; }
  .dd:focus-within { outline: var(--n-ring) solid var(--accent, var(--n-focus)); outline-offset: 2px; }
  .dd::after { content: ""; position: absolute; right: 12px; top: 50%; width: 5px; height: 5px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-70%) rotate(45deg); opacity: .8; pointer-events: none; }
  button:focus-visible { outline: var(--n-ring) solid var(--accent, var(--n-focus)); outline-offset: 2px; }
`;
