// nice-litter: a Litter-Robot 4 (litterrobot) and the cats who use it: what it's doing with
// the drawer as a bar, the robot drawn from the front, each cat's weight over two weeks and
// visits today, the globe light, and the panel. "I emptied it" takes two taps.
//
//   type: custom:nice-litter
//   robot: litter_robot          entity prefix
//   place: Game room
//   cats: [{ name: Zig, weight: sensor.zig_weight, visits: sensor.zig_visits_today }]
//   part: all | cats | robot     split the card in two
import { html, css, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { repeat } from "lit/directives/repeat.js";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { tone, offTone, CAT_TONES } from "../core/tones.js";
import { num, quiet, span, when } from "../core/format.js";
import { moreInfo } from "../core/nav.js";
import { newestChange } from "../data/entities.js";
import { pack, Columns } from "../layout/pack.js";
import { place } from "../tile/tile.js";
import { ChartData } from "../tile/data.js";
import { lrRobot, LR_STATUS, LR_DRAWER_SOON } from "../illus/litter.js";
import { statusTag, headStyles } from "./head.js";

export class NiceLitter extends NiceCard {
  static defaults = { robot: "litter_robot", name: "Litter-Robot", place: null, cats: [], part: "all" };
  constructor() { super(); this.columns = new Columns(this); this.data = new ChartData(this); }
  connectedCallback() { super.connectedCallback(); this.every(30000); }

  id(domain, key) { return `${domain}.${this.config.robot}_${key}`; }
  s(domain, key) { return this.hass.states[this.id(domain, key)]; }
  st(domain, key) { return this.s(domain, key)?.state; }
  watch() {
    if (!this._mine || Date.now() - this._mineAt > 60000) {
      const p = `${this.config.robot}_`;
      this._mine = Object.keys(this._real.states).filter((e) => e.split(".")[1].startsWith(p)).concat(this.config.cats.flatMap((c) => [c.weight, c.visits]).filter(Boolean));
      this._mineAt = Date.now();
    }
    return this._mine;
  }
  more(id) { moreInfo(this, id); }
  svc(domain, service, key, data = {}) { return this.callEntity(`${domain}.${service}`, this.id(domain, key), data); }

  status() {
    const vac = this.s("vacuum", "litter_box"), code = this.s("sensor", "status_code");
    const status = quiet(vac?.state) || code?.state === "offline" ? "offline" : code?.state;
    const [kind, say, sub] = LR_STATUS[status] || ["warn", status ? `Status: ${status}` : "Litter box", ""];
    const drawer = num(this.st("sensor", "waste_drawer")), litter = num(this.st("sensor", "litter_level")), hopper = this.st("sensor", "hopper_status");
    return { code, status, kind, say, sub, drawer, litter, hopper,
      drawerFull: (drawer != null && drawer >= 90) || LR_DRAWER_SOON.includes(status), lowLitter: (litter != null && litter < 40) || hopper === "empty" };
  }

  tag(st) {
    const heard = newestChange(this.hass, `${this.config.robot}_`), since = st.code?.last_changed;
    if (st.kind === "off") return statusTag("warn", heard && span(heard) ? `Offline · last heard ${span(heard)} ago` : "Offline");
    if (st.kind === "busy") return statusTag("busy", st.status === "pwru" ? "Starting up" : `Cycling · started ${since && span(since) ? `${span(since)} ago` : "just now"}`);
    if (st.kind === "bad") return statusTag("warn", since ? `Needs a hand since ${when(since)}` : "Needs a hand");
    return statusTag("ok", st.status === "rdy" && since ? `Online · ready since ${when(since)}` : "Online");
  }

  hero(st) {
    const n = this.night, { kind, drawer, drawerFull } = st;
    const colors = kind === "bad" ? tone("hazard", n) : kind === "off" ? offTone(n) : kind === "busy" ? tone("energy", n) : drawerFull || kind === "warn" ? tone("act", n) : tone("litter", n);
    const wait = num(this.st("select", "clean_cycle_wait_time_minutes"));
    const cycling = st.status === "ccp" || st.status === "ec";
    return { id: "hero", shape: "L", label: [this.config.place, "Litter box"].filter(Boolean).join(" · "), colors, say: st.say,
      sub: st.sub || (wait != null ? `Cleans ${wait} min after a visit` : "Cleans itself after each visit"),
      viz: drawer == null || kind === "off" ? null : { type: "charge", value: drawer, high: 80, gain: false,
        left: [`${Math.round(drawer)}%`, " drawer"], right: drawerFull ? "Full" : drawer < 60 ? "Plenty of room" : "Filling up" },
      layout: "foot", tap: () => this.more(this.id("vacuum", "litter_box")), hold: () => this.more(this.id("vacuum", "litter_box")),
      controls: [{ type: "pills", items: [
        cycling ? { label: "Stop", run: () => this.svc("vacuum", "stop", "litter_box") }
          : kind === "cat" ? { label: "Clean now", disabled: true }
          : kind === "ok" || kind === "warn" ? { label: "Clean now", sel: !drawerFull, run: () => this.svc("vacuum", "start", "litter_box") } : null,
        drawerFull && kind !== "off" ? { label: "I emptied it", sel: true, confirm: "reset", armed: "Tap again: it's empty", run: () => this._real.callService("button", "press", { entity_id: this.id("button", "reset") }) } : null,
      ].filter(Boolean) }] };
  }

  bot(st) {
    const n = this.night, { kind, litter, hopper, lowLitter } = st;
    const say = hopper === "empty" ? "Hopper's empty" : lowLitter ? "Litter's running low" : litter != null ? `Litter's at ${Math.round(litter)}%` : "Litter";
    const sub = hopper === "enabled" ? "Hopper topping it up" : hopper === "empty" ? `Litter ${litter != null ? Math.round(litter) + "% · " : ""}refill the hopper`
      : hopper === "disabled" ? "Hopper off" : hopper && !quiet(hopper) ? "Hopper needs a look" : "";
    const svg = lrRobot({ litter, drawer: st.drawer, kind, cycling: st.status === "ccp" || st.status === "ec", lit: this.st("select", "globe_light") !== "off", locked: this.st("switch", "panel_lockout") === "on" });
    const parts = { litter: this.id("sensor", "litter_level"), drawer: this.id("sensor", "waste_drawer") };
    const tapPart = (ev) => { const p = ev.composedPath().find((x) => x.dataset?.part); if (p) { ev.stopPropagation(); this.more(parts[p.dataset.part]); } };
    return { id: "bot", shape: "L", label: "Litter-Robot 4", colors: lowLitter ? tone("act", n) : kind === "cat" ? tone("litter", n) : tone("health", n), say, sub,
      picture: html`<div class="pic" @click=${tapPart}>${unsafeHTML(svg)}</div>`, tap: () => this.more(parts.litter), hold: () => this.more(parts.litter) };
  }

  cat(c, i) {
    const h = this.hass, ws = h.states[c.weight], vs = h.states[c.visits];
    const w = num(ws?.state), visits = Math.round(num(vs?.state) ?? 0), unit = ws?.attributes?.unit_of_measurement || "lb";
    const viz = { type: "dbars", entity: c.weight, days: 14, today: w };
    const rows = this.data.of(viz) || [];
    const delta = rows.length > 1 && w != null ? Math.round((w - rows[0].v) * 10) / 10 : null;
    const last = visits && vs?.last_changed && new Date(vs.last_changed).toDateString() === new Date().toDateString() ? ` · ${when(vs.last_changed)}` : "";
    const dots = Array.from({ length: Math.max(4, visits) }, (_, k) => html`<i class=${k < visits ? "on" : ""}></i>`);
    return { id: `cat-${i}`, shape: "W", label: c.name, colors: tone(c.tone || CAT_TONES[i % CAT_TONES.length], this.night),
      say: w != null ? `${w.toFixed(1)} ${unit}` : "–", sub: delta != null ? `${delta > 0 ? "+" : ""}${delta} ${unit} · 2 wk` : "", viz, layout: "foot",
      tap: () => this.more(c.weight), hold: () => this.more(c.weight),
      controls: [{ type: "custom", render: () => html`<div class="row between"><span class="sub">${visits ? `${visits} visit${visits === 1 ? "" : "s"} today${last}` : "No visits yet today"}</span><span class="dots">${dots}</span></div>` }] };
  }

  globe() {
    const g = this.st("select", "globe_light"), b = this.st("select", "globe_brightness"), id = this.id("select", "globe_light");
    const opt = (v, l) => ({ label: l, sel: g === v, run: () => this.callEntity("select.select_option", id, { option: v }) });
    return { id: "glb", shape: "W", label: "Globe light", colors: g === "off" || quiet(g) ? offTone(this.night) : tone("today", this.night),
      say: { auto: "Comes on in the dark", on: "Always on", off: "Off" }[g] || "Globe light", sub: b && !quiet(b) ? `Brightness ${b}` : "",
      tap: () => this.more(id), hold: () => this.more(id), controls: [{ type: "pills", seg: true, items: [opt("auto", "Auto"), opt("on", "On"), opt("off", "Off")] }] };
  }

  panel() {
    const locked = this.st("switch", "panel_lockout") === "on", lockId = this.id("switch", "panel_lockout");
    const ws = this.s("select", "clean_cycle_wait_time_minutes"), wait = ws?.state, opts = ["3", "7", "15"];
    if (wait && !quiet(wait) && !opts.includes(wait)) opts.push(wait);
    const toggle = () => this.callEntity("switch.toggle", lockId);
    return { id: "opt", shape: "W", label: "Panel & timing", colors: locked ? tone("litter", this.night) : offTone(this.night),
      say: locked ? "Buttons locked" : "Buttons unlocked", sub: "Wait before cleaning",
      tap: () => (quiet(this.st("switch", "panel_lockout")) ? this.more(lockId) : toggle()), hold: () => this.more(lockId),
      controls: [{ type: "between", items: [ws ? { type: "pills", seg: true, items: opts.map((m) => ({ label: `${m} min`, sel: wait === m, run: () => this.callEntity("select.select_option", ws.entity_id, { option: m }) })) } : null,
        { type: "pills", items: [{ label: locked ? "Unlock" : "Lock", run: toggle }] }].filter(Boolean) }] };
  }

  render() {
    const st = this.status(), part = this.config.part, robot = part !== "cats", cats = part !== "robot";
    const list = [...(robot ? [this.hero(st), this.bot(st)] : []), ...(cats ? this.config.cats.map((c, i) => this.cat(c, i)) : []), ...(robot ? [this.globe(), this.panel()] : [])];
    this.data.want(list.map((t) => t.viz).filter(Boolean));
    const cols = this.columns.cols, tiles = pack(list.map((t) => ({ ...t, still: true })), cols).tiles;
    return html`${robot ? html`<div class="head"><span class="title">${this.config.name}</span>${this.tag(st)}</div>` : nothing}
      <div class="grid" style="--cols:${cols}">${repeat(tiles, (t) => t.id, (t) => html`<nice-tile style=${place(t)} .tile=${t} .series=${this.data.of(t.viz)} ?night=${this.night}></nice-tile>`)}</div>`;
  }

  getCardSize() { return 8; }
  static styles = [tokens, headStyles, css`.grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--n-row), auto); gap: var(--n-gap); }`];
}
customElements.define("nice-litter", NiceLitter);
