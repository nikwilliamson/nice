// How tiles are touched. Tap runs the tile's main action, press and hold opens its
// details, Enter and Space are a tap. Taps on a tile's own buttons, sliders, pickers and
// drawn parts belong to them, not the tile.
import { Directive, directive } from "lit/directive.js";
import { noChange } from "lit";
import { HOLD_MS, CONFIRM_MS } from "./tokens.js";

const OWN = "button,a,input,select,label,.slide,.dd,[data-own]";

// Bind tap and hold to an element once; get() returns the current { tap, hold }
export function bindPress(el, get) {
  let timer = null, held = false;
  const mine = (ev) => { const p = ev.composedPath(); return !p.slice(0, p.indexOf(el)).some((n) => n.matches?.(OWN)); };
  el.addEventListener("pointerdown", (ev) => {
    if (!mine(ev) || !get().hold) return;
    held = false;
    clearTimeout(timer);
    el.classList.add("holding");
    timer = setTimeout(() => { held = true; el.classList.remove("holding"); get().hold?.(); }, HOLD_MS);
  });
  const clear = () => { clearTimeout(timer); el.classList.remove("holding"); };
  for (const t of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(t, clear);
  el.addEventListener("click", (ev) => { if (held || !mine(ev)) { held = false; return; } const h = get(); (h.tap || h.hold)?.(ev); });
  el.addEventListener("keydown", (ev) => {
    if (ev.composedPath()[0] !== el || (ev.key !== "Enter" && ev.key !== " ")) return;
    ev.preventDefault(); const h = get(); (h.tap || h.hold)?.(ev);
  });
}
// Make an element act like a button when it does something, and not when it doesn't
export function pressable(el, any) {
  if (any) { el.tabIndex = 0; if (!el.hasAttribute("role")) el.setAttribute("role", "button"); }
  else { el.removeAttribute("tabindex"); if (el.getAttribute("role") === "button") el.removeAttribute("role"); }
}

// <div ${press({ tap, hold })}>: binds once per element; later renders only swap the handlers
class PressDirective extends Directive {
  update(part, [handlers]) {
    const el = part.element;
    if (!el.__press) bindPress(el, () => el.__press);
    el.__press = handlers;
    pressable(el, handlers.tap || handlers.hold);
    return noChange;
  }
  render() { return noChange; }
}
export const press = directive(PressDirective);

// Two taps for anything risky (unlocking, resetting a gauge, handing out treats): the first
// tap arms it for four seconds, the second runs it. One per host; host.requestUpdate redraws.
export class Confirm {
  constructor(host) { this.host = host; this.key = null; this.at = 0; this.t = null; }
  armed(key) { return this.key === key; }
  since() { return Date.now() - this.at; }
  tap(key, run) {
    if (this.key !== key) {
      this.key = key; this.at = Date.now();
      clearTimeout(this.t);
      this.t = setTimeout(() => { if (this.key === key) { this.key = null; this.host.requestUpdate(); } }, CONFIRM_MS);
      this.host.requestUpdate();
      return false;
    }
    clearTimeout(this.t);
    this.key = null;
    run();
    this.host.requestUpdate();
    return true;
  }
}
