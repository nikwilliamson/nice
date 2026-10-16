// The visual editor's working part: a list of sections, each a title, an All on/off switch and
// a list of entities. Shared by the room page editor (many sections) and the controls editor
// (one). Entities are added with Home Assistant's own picker; the special entries (Adaptive
// Lighting, power bars, the Vestaboard, LED strips) can be moved and removed here and edited
// in the code editor.
//
// Fires `sections-changed` with { sections } on every change.
import { LitElement, html, css, nothing } from "lit";

// ha-form (and the pickers it uses) load with Home Assistant's own card editors; borrow one
// so they're defined before we draw
let ready = null;
export function haFormReady() {
  if (!ready) ready = (async () => {
    if (customElements.get("ha-form")) return;
    const helpers = await window.loadCardHelpers?.();
    const card = helpers?.createCardElement({ type: "entities", entities: [] });
    await card?.constructor?.getConfigElement?.();
    await customElements.whenDefined("ha-form");
  })();
  return ready;
}

export const entryId = (e) => (typeof e === "string" ? e : e.entity || e.strip || e.adaptive || e.board || null);
const KIND = { adaptive: "Adaptive lighting", bars: "Power bars", board: "Vestaboard", strip: "LED strip" };
const kindOf = (e) => (typeof e === "string" ? null : Object.keys(KIND).find((k) => e[k] != null));

export class NiceSectionsEditor extends LitElement {
  static properties = { hass: { attribute: false }, sections: { attribute: false }, single: { type: Boolean }, _ready: { state: true } };

  connectedCallback() { super.connectedCallback(); haFormReady().then(() => { this._ready = true; }); }

  _set(sections) {
    this.sections = sections;
    this.dispatchEvent(new CustomEvent("sections-changed", { detail: { sections }, bubbles: true, composed: true }));
  }
  _edit(i, change) { this._set(this.sections.map((s, j) => (j === i ? change(s) : s))); }
  _move(list, i, by) { const out = [...list], j = i + by; if (j < 0 || j >= out.length) return out; [out[i], out[j]] = [out[j], out[i]]; return out; }

  _entityRow(s, si, e, ei) {
    const id = entryId(e), kind = kindOf(e), st = id && this.hass?.states?.[id];
    const name = typeof e === "string" ? "" : e.name || "";
    const setName = (v) => this._edit(si, (x) => ({ ...x, entities: x.entities.map((y, k) => {
      if (k !== ei) return y;
      const o = typeof y === "string" ? { entity: y } : { ...y };
      if (v) o.name = v; else delete o.name;
      return Object.keys(o).length === 1 && o.entity ? o.entity : o;
    }) }));
    return html`<li>
      <div class="who"><b>${kind ? KIND[kind] : st?.attributes?.friendly_name || id}</b><small>${kind === "bars" ? `${e.bars.length} circuits` : id}${st ? "" : kind === "bars" ? "" : " · not found"}</small></div>
      ${kind === "bars" ? nothing : html`<input class="name" placeholder="Name" .value=${name} @change=${(ev) => setName(ev.target.value.trim())}>`}
      <span class="btns">
        <button title="Move up" ?disabled=${ei === 0} @click=${() => this._edit(si, (x) => ({ ...x, entities: this._move(x.entities, ei, -1) }))}>↑</button>
        <button title="Move down" ?disabled=${ei === s.entities.length - 1} @click=${() => this._edit(si, (x) => ({ ...x, entities: this._move(x.entities, ei, 1) }))}>↓</button>
        <button title="Remove" @click=${() => this._edit(si, (x) => ({ ...x, entities: x.entities.filter((_, k) => k !== ei) }))}>✕</button>
      </span></li>`;
  }

  _section(s, si) {
    const add = (ev) => {
      const id = ev.detail.value?.entity;
      if (!id) return;
      this._edit(si, (x) => ({ ...x, entities: [...(x.entities || []), id] }));
      this.requestUpdate(); // the picker clears itself
    };
    return html`<section>
      <div class="head">
        ${this.single ? nothing : html`<input class="title" placeholder="Section title" .value=${s.title || ""} @change=${(ev) => this._edit(si, (x) => ({ ...x, title: ev.target.value }))}>`}
        <label class="check"><input type="checkbox" .checked=${s.all !== false} @change=${(ev) => this._edit(si, (x) => { const o = { ...x }; if (ev.target.checked) delete o.all; else o.all = false; return o; })}>All on/off</label>
        ${this.single ? nothing : html`<span class="btns">
          <button title="Move section up" ?disabled=${si === 0} @click=${() => this._set(this._move(this.sections, si, -1))}>↑</button>
          <button title="Move section down" ?disabled=${si === this.sections.length - 1} @click=${() => this._set(this._move(this.sections, si, 1))}>↓</button>
          <button title="Remove section" @click=${() => { if (confirm(`Remove “${s.title || "this section"}” and its ${(s.entities || []).length} entities?`)) this._set(this.sections.filter((_, j) => j !== si)); }}>✕</button></span>`}
      </div>
      <ul>${(s.entities || []).map((e, ei) => this._entityRow(s, si, e, ei))}</ul>
      ${this._ready ? html`<ha-form .hass=${this.hass} .data=${{}} .schema=${[{ name: "entity", selector: { entity: {} } }]}
          .computeLabel=${() => "Add an entity"} @value-changed=${add}></ha-form>` : nothing}
    </section>`;
  }

  render() {
    const list = this.sections || [];
    return html`${list.map((s, i) => this._section(s, i))}
      ${this.single ? nothing : html`<button class="add" @click=${() => this._set([...list, { title: "New section", entities: [] }])}>+ Add a section</button>`}`;
  }

  static styles = css`
    :host { display: grid; gap: 12px; }
    section { border: 1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius: 12px; padding: 12px; display: grid; gap: 8px; }
    .head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .title { flex: 1; min-width: 140px; font: inherit; font-weight: 700; font-size: 1.05em; }
    input[type="text"], input:not([type]), .name, .title { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(0,0,0,.2)); background: var(--card-background-color, #fff); color: var(--primary-text-color); }
    .check { display: inline-flex; gap: 6px; align-items: center; font-size: .9em; color: var(--secondary-text-color); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 10em) auto; gap: 8px; align-items: center; padding: 4px 0; border-top: 1px solid var(--divider-color, rgba(0,0,0,.08)); }
    li:first-child { border-top: 0; }
    .who { display: grid; min-width: 0; } .who b, .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who small { color: var(--secondary-text-color); font-size: .8em; }
    .name { min-width: 0; }
    .btns { display: inline-flex; gap: 2px; }
    button { font: inherit; border: 0; border-radius: 8px; padding: 4px 8px; cursor: pointer; background: var(--secondary-background-color, #eef0f5); color: var(--primary-text-color); }
    button:disabled { opacity: .35; cursor: default; }
    .add { justify-self: start; padding: 8px 14px; font-weight: 700; }
  `;
}
customElements.define("nice-sections-editor", NiceSectionsEditor);
