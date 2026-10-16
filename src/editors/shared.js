// What every Nice editor shares.
import { css } from "lit";

// ha-form, and Home Assistant's own card picker and card editor, load with HA's built-in card
// editors. Borrow the stack card's editor so they're all defined before we draw.
let ready = null;
export function haReady() {
  if (!ready) ready = (async () => {
    const helpers = await window.loadCardHelpers?.();
    for (const type of ["entities", "vertical-stack"]) {
      const card = helpers?.createCardElement({ type, entities: [], cards: [] });
      await card?.constructor?.getConfigElement?.();
    }
    await customElements.whenDefined("ha-form");
  })();
  return ready;
}

export const fire = (el, type, detail) => el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

// Tell the preview which tile the pointer is over (nice-tile outlines itself)
export const highlight = (id) => window.dispatchEvent(new CustomEvent("nice-highlight", { detail: { id: id || null } }));

// Drop empty values so the YAML stays as short as what you chose. Keys that say what an entry
// is (an empty `bars: []` is still power bars) and lists you're filling in stay.
const KEEP = new Set(["entity", "adaptive", "bars", "board", "strip", "entities", "sections", "tabs", "cards", "lists", "cats", "feeders", "meals", "areas"]);
export function tidy(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null) continue;
    if (!KEEP.has(k) && (v === "" || (Array.isArray(v) && !v.length))) continue;
    out[k] = v;
  }
  return out;
}

// Entity prefixes the cards key on: nik for lock.nik_s_car_lock, litter_robot for vacuum.litter_robot_litter_box, …
export function prefixes(hass, re) {
  return [...new Set(Object.keys(hass?.states || {}).map((id) => id.match(re)?.[1]).filter(Boolean))].sort();
}

// Undo for an editor: remember each config before a change
export class History {
  constructor(host) { this.host = host; this.stack = []; }
  push(config) { this.stack.push(config); if (this.stack.length > 50) this.stack.shift(); }
  get can() { return this.stack.length > 0; }
  pop() { return this.stack.pop(); }
}

export const editorStyles = css`
  :host { display: grid; gap: 12px; }
  button { font: inherit; border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; background: var(--secondary-background-color, #eef0f5); color: var(--primary-text-color); }
  button.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); font-weight: 700; }
  button.text { background: none; padding: 4px 6px; color: var(--secondary-text-color); }
  button:disabled { opacity: .35; cursor: default; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1; }
  .note { margin: 0; color: var(--secondary-text-color); font-size: .9em; }
  .box { border: 1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius: 12px; padding: 12px; display: grid; gap: 8px; }
  .left { text-align: left; }
  .item { display: grid; gap: 6px; padding: 4px 0; }
  .handle { cursor: grab; color: var(--secondary-text-color); padding: 0 4px; user-select: none; }
  .drop-before { box-shadow: 0 -3px 0 var(--primary-color); }
  input.plain { font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(0,0,0,.2)); background: var(--card-background-color, #fff); color: var(--primary-text-color); min-width: 0; }
  small { color: var(--secondary-text-color); }
`;
