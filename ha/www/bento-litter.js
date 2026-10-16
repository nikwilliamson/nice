// Bento litter - a Litter-Robot 4 (litterrobot integration) and the cats who use it, as bento tiles.
// Card: bento-litter
//
//   type: custom:bento-litter
//   robot: litter_robot      # entity prefix: vacuum.litter_robot_litter_box, sensor.litter_robot_waste_drawer, ...
//   place: Game room         # eyebrow on the first tile
//   cats:
//     - name: Zig
//       weight: sensor.zig_weight
//       visits: sensor.zig_visits_today
//   part: all                # optional: "cats" = only the cats' weight tiles (no heading),
//                            # "robot" = the heading and the robot's tiles, "all" (default) = both
//
// Palette, tile styles, night mode and the tap/hold model come from bento-core.js (fonts from
// bento-cards.js). Tap the panel tile to lock or unlock the robot's buttons; every other tile
// opens its details on tap; press and hold always opens the details. "I emptied it" still
// takes two taps.
//
// The drawing is the robot from the front, simplified from the manual: the litter fills toward the
// MAX line, the waste drawer toward its FULL line, curtains close while someone's inside, and the
// globe light shows as the two night lights. Controls always sit on a tile's bottom edge.
//
// Pink and purple belong to the cats (Zig and Donut, here and on bento-feeder), so the robot's own
// tiles use teal.
const BENTO_LITTER_VERSION = "1.5.0";

import { BENTO_TOKENS_CSS, BENTO_BASE_CSS, tone, offTone, CAT_TONES, esc, num, quiet, span, when, newestChange, statusTag, watchColumns, isNight, applyNight, bindTap, confirmTap, moreInfo, pageGutter } from "./bento-core.js?v=1.1.0";
import { pending } from "./bento-pending.js?v=1.0.0";

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

// Illustrative, not status: the colour of the litter bed in the drawing
const LITTER_BED = "#e2c48e";

// pylitterbot's LR4 status codes, in house words: [kind, headline, second line]
const LR_STATUS = {
  rdy: ["ok", "Clean and ready"], ccc: ["ok", "Just cleaned", "Cleaned a moment ago"],
  ccp: ["busy", "Cleaning", "Rotating the globe · about 2 min"], ec: ["busy", "Running an empty cycle", "Rotating the globe · about 2 min"],
  pwru: ["busy", "Starting up", "Back in a minute"], pwrd: ["busy", "Powering down", ""],
  cd: ["cat", "Someone's in there", "Cleaning waits until they leave"], cst: ["cat", "Waiting to clean", "Starts once they've been gone a while"],
  csi: ["warn", "Cat sensor interrupted", "Something's blocking the sensor"], p: ["warn", "Paused", "Press the panel button to resume"],
  df1: ["warn", "Drawer almost full", "Room for about 2 more cleans"], df2: ["warn", "Drawer almost full", "Room for 1 more clean"],
  dfs: ["warn", "Drawer's full", "Empty it, then let it know"], sdf: ["warn", "Drawer's full", "Empty it, then let it know"],
  pd: ["bad", "Pinch detected", "Check the globe, then press the panel button"], spf: ["bad", "Pinch detected", "Check the globe, then press the panel button"],
  otf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"], dhf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"],
  dpf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"], hpf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"],
  csf: ["bad", "Cat sensor fault", "Wipe the sensor, then press the panel button"], scf: ["bad", "Cat sensor fault", "Wipe the sensor, then press the panel button"],
  br: ["bad", "Bonnet's off", "Put the bonnet back on"],
  off: ["off", "Turned off", "Press the power button"], offline: ["off", "Can't reach it", "Is it plugged in?"],
};
const LR_DRAWER_SOON = ["df1", "df2", "dfs", "sdf"];

// The robot straight on: a globe in a thick bezel on its base, the waste drawer the lower front of the base
function lrRobot({ litter, drawer, kind, cycling, lit, locked }) {
  const ox = 100, oy = 80, r = 52;                                    // the opening
  const maxY = oy + r * 0.62, floorY = oy + r;                        // fill line, bottom of the globe
  const bedTop = floorY - Math.max(3, (floorY - maxY) * Math.min(100, litter ?? 0) / 100);
  const dTop = 156, dBot = 202, fullY = dTop + 22;                    // drawer, and its full line under the handle
  const fillH = Math.round((dBot - fullY) * Math.min(100, drawer ?? 0) / 100);
  const drw = `M50,${dTop} L150,${dTop} C150,178 148,${dBot - 6} 140,${dBot} L60,${dBot} C52,${dBot - 6} 50,178 50,${dTop} Z`;
  // Occupied: the curtains are drawn. Two drapes, a few fold lines each, meet in the middle under a scalloped valance.
  const scallops = Array.from({ length: 6 }, (_, k) => { const x = ox - r + (k * 2 * r) / 6, w = (2 * r) / 6; return `Q${x + w / 2},${oy - r + 26} ${x + w},${oy - r + 16}`; }).join(" ");
  const fold = (x, s) => `<path class="fold" d="M${ox + x},${oy - r + 14} C${ox + x - 2 * s},${oy} ${ox + x + 2 * s},${oy + 24} ${ox + x},${oy + r}"/>`;
  const curtain = kind === "cat" ? `<g clip-path="url(#lr-mouth)">
      <g class="l"><path class="drape" d="M${ox - r},${oy - r} L${ox + 2},${oy - r} C${ox},${oy - 10} ${ox - 3},${oy + 30} ${ox + 1},${oy + r} L${ox - r},${oy + r} Z"/>${[-36, -24, -12].map((x) => fold(x, 1)).join("")}</g>
      <g class="r"><path class="drape" d="M${ox + r},${oy - r} L${ox - 2},${oy - r} C${ox},${oy - 10} ${ox + 3},${oy + 30} ${ox - 1},${oy + r} L${ox + r},${oy + r} Z"/>${[36, 24, 12].map((x) => fold(x, -1)).join("")}</g>
      <path class="valance" d="M${ox - r - 2},${oy - r - 2} L${ox - r - 2},${oy - r + 16} L${ox - r},${oy - r + 16} ${scallops} L${ox + r + 2},${oy - r + 16} L${ox + r + 2},${oy - r - 2} Z"/>
    </g>` : "";
  return `<svg class="lr ${cycling ? "cycling" : ""} ${kind === "off" ? "off" : ""}" viewBox="0 0 200 210" role="img" aria-label="Litter-Robot">
    <defs><clipPath id="lr-mouth"><circle cx="${ox}" cy="${oy}" r="${r}"/></clipPath><clipPath id="lr-drw"><path d="${drw}"/></clipPath></defs>
    <path class="shell" d="M46,104 L154,104 C156,140 156,170 154,192 C153,201 148,206 140,206 L60,206 C52,206 47,201 46,192 C44,170 44,140 46,104 Z"/>
    <circle class="shell" cx="${ox}" cy="${oy}" r="72"/>
    <circle class="rim" cx="${ox}" cy="${oy}" r="67"/>
    <path class="panel ${locked ? "locked" : ""}" d="M128,13.8 A72,72 0 0 1 146,24.6"/>
    <g class="hot" data-part="litter"><title>Litter level</title>
      <circle class="mouth" cx="${ox}" cy="${oy}" r="${r}"/>
      <g clip-path="url(#lr-mouth)">
        <rect class="bed spin ${litter != null && litter < 40 ? "low" : ""}" x="${ox - r}" y="${bedTop}" width="${r * 2}" height="${floorY - bedTop + 2}"/>
        <path class="max" d="M${ox - 40},${maxY} L${ox + 40},${maxY}"/>
      </g>
      <text class="maxt" x="${ox}" y="${maxY + 8}" text-anchor="middle">MAX</text>
      ${curtain}
      <circle class="sensor" cx="${ox}" cy="${oy - r - 5}" r="1.8"/>
      <circle class="nl ${lit ? "lit" : ""}" cx="${ox - 12}" cy="${oy - r + 4}" r="2.2"/>
      <circle class="nl ${lit ? "lit" : ""}" cx="${ox + 12}" cy="${oy - r + 4}" r="2.2"/>
    </g>
    <g class="hot" data-part="drawer"><title>Waste drawer</title>
      <path class="drawer" d="${drw}"/>
      <rect class="dfill ${drawer != null && drawer >= 80 ? "hi" : ""}" clip-path="url(#lr-drw)" x="50" y="${dBot - fillH}" width="100" height="${fillH}"/>
      <path class="max" d="M60,${fullY} L140,${fullY}"/>
      <text class="maxt" x="100" y="${fullY + 8}" text-anchor="middle">FULL</text>
      <path class="handle" d="M80,${dTop} L120,${dTop} L120,${dTop + 8} C120,${dTop + 12} 117,${dTop + 14} 113,${dTop + 14} L87,${dTop + 14} C83,${dTop + 14} 80,${dTop + 12} 80,${dTop + 8} Z"/>
    </g>
  </svg>`;
}

class BentoLitter extends HTMLElement {
  setConfig(config) {
    this._config = { robot: "litter_robot", name: "Litter-Robot", place: null, cats: [], part: "all", sun: "sun.sun", font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
    this._hist = {};
  }
  getCardSize() { return 8; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  // "ready since" and "last heard" have to keep counting while nothing else changes
  connectedCallback() {
    clearInterval(this._tick); this._tick = setInterval(() => { if (this._hass) this.hass = this._hass; }, 30000);
    if (!this._gutter) { this._gutter = true; pageGutter(true); }
  }
  disconnectedCallback() {
    this._ro?.disconnect(); this._ro = null; clearTimeout(this._confirmT); clearInterval(this._tick);
    if (this._gutter) { this._gutter = false; pageGutter(false); }
  }

  _id(domain, key) { return `${domain}.${this._config.robot}_${key}`; }
  _s(domain, key) { return this._hass.states[this._id(domain, key)]; }
  _st(domain, key) { return this._s(domain, key)?.state; }

  set hass(hass) {
    hass = this._hass = pending(this).take(hass);
    const p = `${this._config.robot}_`;
    const mine = Object.keys(hass.states).filter((e) => e.split(".")[1].startsWith(p));
    const catIds = this._config.cats.flatMap((c) => [c.weight, c.visits]).filter(Boolean);
    const night = applyNight(this, isNight(hass, this._config.sun));
    const sig = JSON.stringify([night, this._cols, this._confirm, this._histV, Math.floor(Date.now() / 60000),
      [...mine, ...catIds].map((e) => { const s = hass.states[e]; return s && [e, s.state, s.last_changed]; })]);
    this._history();
    if (sig === this._sig) return;
    this._sig = sig;
    this._night = night;
    keepScroll(() => this._render());
  }

  // Two weeks of daily mean weight per cat, from long-term statistics, refreshed hourly
  async _history() {
    const ids = this._config.part === "robot" ? [] : this._config.cats.map((c) => c.weight).filter(Boolean);
    if (!ids.length || this._histBusy || (this._histAt && Date.now() - this._histAt < 3600000)) return;
    this._histBusy = true;
    try {
      const start = new Date(Date.now() - 14 * 86400000); start.setHours(0, 0, 0, 0);
      const res = await this._hass.callWS({ type: "recorder/statistics_during_period", start_time: start.toISOString(), period: "day", statistic_ids: ids, types: ["mean"] });
      ids.forEach((id) => { this._hist[id] = (res[id] || []).map((r) => r.mean).filter((v) => v != null); });
      this._histAt = Date.now();
      this._histV = (this._histV || 0) + 1;
      this._sig = null; this.hass = this._hass;
    } catch (e) {
      this._histAt = Date.now();
    } finally { this._histBusy = false; }
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    watchColumns(this);
    const st = this._state();
    const part = this._config.part, robot = part !== "cats", cats = part !== "robot";
    this.shadowRoot.innerHTML = `<style>${BENTO_TOKENS_CSS}${BENTO_BASE_CSS}${LITTER_CSS}</style>
      ${robot ? `<div class="head"><span class="title">${esc(this._config.name)}</span>${this._tag(st)}</div>` : ""}
      <div class="grid c${this._cols || 4} ${this._night ? "is-night" : ""}">
        ${robot ? this._hero(st) + this._bot(st) : ""}${cats ? this._config.cats.map((c, i) => this._cat(c, i)).join("") : ""}${robot ? this._globe() + this._panel(st) : ""}
      </div>`;
    this._wire();
  }

  // Everything the tiles share about the robot right now
  _state() {
    const vac = this._s("vacuum", "litter_box"), code = this._s("sensor", "status_code");
    const status = quiet(vac?.state) || code?.state === "offline" ? "offline" : code?.state;
    const [kind, say, sub] = LR_STATUS[status] || ["warn", status ? `Status: ${status}` : "Litter box", ""];
    const drawer = num(this._st("sensor", "waste_drawer")), litter = num(this._st("sensor", "litter_level"));
    const hopper = this._st("sensor", "hopper_status");
    return { vac, code, status, kind, say, sub, drawer, litter, hopper,
      drawerFull: (drawer != null && drawer >= 90) || LR_DRAWER_SOON.includes(status),
      lowLitter: (litter != null && litter < 40) || hopper === "empty" };
  }

  // Is it talking to us, and since when. "Ago" is the newest change across the robot's own entities.
  _tag(st) {
    const newest = newestChange(this._hass, `${this._config.robot}_`);
    const since = st.code?.last_changed;
    let cls = "ok", text;
    if (st.kind === "off") { const ago = newest && span(newest); cls = "warn"; text = ago ? `Offline · last heard ${ago} ago` : "Offline"; }
    else if (st.kind === "busy") { const ago = since && span(since); cls = "busy"; text = st.status === "pwru" ? "Starting up" : `Cycling · started ${ago ? `${ago} ago` : "just now"}`; }
    else if (st.kind === "bad") { cls = "warn"; text = since ? `Needs a hand since ${when(since)}` : "Needs a hand"; }
    else text = st.status === "rdy" && since ? `Online · ready since ${when(since)}` : "Online";
    return statusTag(cls, text);
  }

  _tile(t, cls, inner, i = "") {
    return `<div class="tile ${cls}"${i !== "" ? ` data-i="${i}"` : ""} style="--bg:${t.bg};--ink:${t.ink};--accent:${t.accent}">${inner}</div>`;
  }

  // What it's doing, with the waste drawer as a bar
  _hero(st) {
    const n = this._night, { kind, drawer, drawerFull } = st;
    const t = kind === "bad" ? tone("hazard", n) : kind === "off" ? offTone(n) : kind === "busy" ? tone("energy", n)
      : drawerFull || kind === "warn" ? tone("act", n) : tone("litter", n);
    const wait = num(this._st("select", "clean_cycle_wait_time_minutes"));
    const sub = st.sub || (wait != null ? `Cleans ${wait} min after a visit` : "Cleans itself after each visit");
    const bar = drawer == null || kind === "off" ? "" : `<div class="charge"><div class="cbar"><i class="${drawer >= 80 ? "hi" : ""}" style="width:${Math.max(0, Math.min(100, drawer))}%"></i><span class="lim"></span></div>
      <div class="cends"><span><b>${Math.round(drawer)}%</b> drawer</span><span class="to">${drawerFull ? "Full" : drawer < 60 ? "Plenty of room" : "Filling up"}</span></div></div>`;
    const clean = st.status === "ccp" || st.status === "ec" ? `<button class="pill" data-act="stop">Stop</button>`
      : kind === "cat" ? `<button class="pill" disabled>Clean now</button>`
      : kind === "ok" || kind === "warn" ? `<button class="pill ${drawerFull ? "" : "sel"}" data-act="clean">Clean now</button>` : "";
    const reset = drawerFull && kind !== "off" ? `<button class="pill sel" data-act="reset">${this._confirm === "reset" ? "Tap again: it's empty" : "I emptied it"}</button>` : "";
    const lbl = [this._config.place, "Litter box"].filter(Boolean).join(" · ");
    return this._tile(t, "hero", `<div class="lbl">${esc(lbl)}</div>
      <div class="txt"><div class="say">${esc(st.say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      <div class="foot">${bar}${clean || reset ? `<div class="row">${clean}${reset}</div>` : ""}</div>`);
  }

  // The robot from the front: litter and drawer levels are the readings
  _bot(st) {
    const n = this._night, { kind, litter, hopper, lowLitter } = st;
    const t = lowLitter ? tone("act", n) : kind === "cat" ? tone("litter", n) : tone("health", n);
    const say = hopper === "empty" ? "Hopper's empty" : lowLitter ? "Litter's running low" : litter != null ? `Litter's at ${Math.round(litter)}%` : "Litter";
    const sub = hopper === "enabled" ? "Hopper topping it up" : hopper === "empty" ? `Litter ${litter != null ? Math.round(litter) + "% · " : ""}refill the hopper`
      : hopper === "disabled" ? "Hopper off" : hopper && !quiet(hopper) ? "Hopper needs a look" : "";
    const svg = lrRobot({ litter, drawer: st.drawer, kind, cycling: st.status === "ccp" || st.status === "ec",
      lit: this._st("select", "globe_light") !== "off", locked: this._st("switch", "panel_lockout") === "on" });
    return this._tile(t, "bot has-viz", `<div class="lbl">Litter-Robot 4</div><div class="viz">${svg}</div>
      <div class="txt"><div class="say">${esc(say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`);
  }

  // One tile per cat: today's weight, two weeks of daily weights, today's visits
  _cat(c, i) {
    const n = this._night, h = this._hass;
    const ws = h.states[c.weight], vs = h.states[c.visits];
    const w = num(ws?.state), visits = Math.round(num(vs?.state) ?? 0);
    const unit = ws?.attributes?.unit_of_measurement || "lb";
    const hist = [...(this._hist[c.weight] || [])];
    if (w != null) { if (hist.length) hist[hist.length - 1] = w; else hist.push(w); }
    const lo = Math.min(...hist) - 0.3, hi = Math.max(...hist);
    const bars = hist.length > 1 ? `<div class="bars">${hist.map((v) => `<i style="height:${Math.max(6, Math.round(((v - lo) / (hi - lo || 1)) * 100))}%"></i>`).join("")}</div>` : "";
    const delta = hist.length > 1 && w != null ? Math.round((w - hist[0]) * 10) / 10 : null;
    const last = visits && vs?.last_changed && new Date(vs.last_changed).toDateString() === new Date().toDateString() ? ` · ${when(vs.last_changed)}` : "";
    const dots = Array.from({ length: Math.max(4, visits) }, (_, k) => `<i class="${k < visits ? "on" : ""}"></i>`).join("");
    const t = tone(c.tone || CAT_TONES[i % CAT_TONES.length], n);
    return this._tile(t, "cat", `<div class="lbl">${esc(c.name)}</div>
      <div class="txt"><div class="wt"><span class="say">${w != null ? w.toFixed(1) : "–"}</span><small>${esc(unit)}</small>${delta != null ? `<span class="sub d">${delta > 0 ? "+" : ""}${delta} ${esc(unit)} · 2 wk</span>` : ""}</div>${bars}</div>
      <div class="foot"><div class="row between"><span class="sub">${visits ? `${visits} visit${visits === 1 ? "" : "s"} today${last}` : "No visits yet today"}</span><span class="dots">${dots}</span></div></div>`, i);
  }

  _globe() {
    const n = this._night, g = this._st("select", "globe_light"), b = this._st("select", "globe_brightness");
    const t = g === "off" || quiet(g) ? offTone(n) : tone("today", n);
    const opt = (v, l) => `<button class="pill ${g === v ? "sel" : ""}" data-globe="${v}">${l}</button>`;
    return this._tile(t, "glb", `<div class="lbl">Globe light</div>
      <div class="txt"><div class="say">${{ auto: "Comes on in the dark", on: "Always on", off: "Off" }[g] || "Globe light"}</div>${b && !quiet(b) ? `<div class="sub">Brightness ${esc(b)}</div>` : ""}</div>
      <div class="foot"><div class="row"><span class="seg">${opt("auto", "Auto")}${opt("on", "On")}${opt("off", "Off")}</span></div></div>`);
  }

  // Panel lockout and how long it waits after a visit
  _panel() {
    const n = this._night, locked = this._st("switch", "panel_lockout") === "on";
    const ws = this._s("select", "clean_cycle_wait_time_minutes"), wait = ws?.state;
    const opts = ["3", "7", "15"];
    if (wait && !quiet(wait) && !opts.includes(wait)) opts.push(wait);
    const t = locked ? tone("litter", n) : offTone(n);
    return this._tile(t, "opt", `<div class="lbl">Panel & timing</div>
      <div class="txt"><div class="say">${locked ? "Buttons locked" : "Buttons unlocked"}</div><div class="sub">Wait before cleaning</div></div>
      <div class="foot"><div class="row between">${ws ? `<span class="seg">${opts.map((m) => `<button class="pill ${wait === m ? "sel" : ""}" data-wait="${m}">${m} min</button>`).join("")}</span>` : ""}<button class="pill" data-act="lock">${locked ? "Unlock" : "Lock"}</button></div></div>`);
  }

  _more(eid) { moreInfo(this, eid); }
  _redraw() { this._sig = null; if (this._hass) this.hass = this._hass; }

  _act(a) {
    const h = pending(this).wrap(this._hass);
    switch (a) {
      case "clean": return h.callService("vacuum", "start", { entity_id: this._id("vacuum", "litter_box") });
      case "stop": return h.callService("vacuum", "stop", { entity_id: this._id("vacuum", "litter_box") });
      case "lock": return h.callService("switch", "toggle", { entity_id: this._id("switch", "panel_lockout") });
      case "reset":
        // Resetting the drawer gauge takes two taps
        confirmTap(this, "reset", { run: () => h.callService("button", "press", { entity_id: this._id("button", "reset") }), render: () => this._redraw() });
        return;
    }
  }

  _wire() {
    const root = this.shadowRoot, h = pending(this).wrap(this._hass);
    root.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); this._act(el.dataset.act); }));
    root.querySelectorAll("[data-globe]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); h.callService("select", "select_option", { entity_id: this._id("select", "globe_light"), option: el.dataset.globe }); }));
    root.querySelectorAll("[data-wait]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); h.callService("select", "select_option", { entity_id: this._id("select", "clean_cycle_wait_time_minutes"), option: el.dataset.wait }); }));
    const parts = { litter: this._id("sensor", "litter_level"), drawer: this._id("sensor", "waste_drawer") };
    root.querySelectorAll("[data-part]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); this._more(parts[el.dataset.part]); }));
    // Every tile: hold opens its details. The panel tile's tap locks or unlocks the robot's buttons;
    // every other tile has no single safe action, so its tap opens the details too.
    const tiles = {
      hero: this._id("vacuum", "litter_box"), bot: this._id("sensor", "litter_level"),
      glb: this._id("select", "globe_light"), opt: this._id("switch", "panel_lockout"),
    };
    root.querySelectorAll(".tile").forEach((el) => {
      const k = Object.keys(tiles).find((c) => el.classList.contains(c));
      const more = k ? tiles[k] : el.classList.contains("cat") ? this._config.cats[+el.dataset.i]?.weight : null;
      if (!more) return;
      const tap = k === "opt" && this._s("switch", "panel_lockout") && !quiet(this._st("switch", "panel_lockout")) ? () => this._act("lock") : () => this._more(more);
      bindTap(el, { tap, hold: () => this._more(more) });
    });
  }
}

// Only what is the litter box's own; tiles, pills, the bar and the tag come from bento-core
const LITTER_CSS = `
  :host { font-family: var(--b-body); }
  .title { white-space: nowrap; }
  .grid { display: grid; gap: var(--b-gap); grid-auto-rows: minmax(var(--b-row), auto); grid-auto-flow: row dense; }
  .grid.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hero, .bot { grid-column: span 2; grid-row: span 2; }
  .c4 .cat, .c4 .glb, .c4 .opt { grid-column: span 2; }
  .tile.has-viz { grid-template-rows: auto 1fr auto; }
  .viz { align-self: center; min-width: 0; display: grid; place-items: center; }
  .has-viz .txt { align-self: end; }
  .hero .say { font-size: 2.1em; line-height: 1.02; }
  .seg { display: inline-flex; padding: var(--b-s-xs); gap: var(--b-s-2xs); border-radius: var(--b-pill-radius); background: var(--b-pill-bg); }
  :host(.is-night) .seg { background: rgba(255,255,255,.12); }
  .seg .pill, :host(.is-night) .seg .pill { background: transparent; }
  .seg .pill.sel, :host(.is-night) .seg .pill.sel { background: var(--ink); color: var(--bg); }
  /* Drawer: the bento-core bar, filling toward the full line */
  .cbar i { left: 0; background: var(--accent); border-radius: var(--b-bar-radius) 0 0 var(--b-bar-radius); transition: width var(--b-t-bar) ease; }
  .cbar i.hi { background: var(--b-warn); }
  .cbar .lim { right: 0; }
  .cends { display: flex; justify-content: space-between; gap: var(--b-s-sm); font-size: 0.86em; font-weight: 600; }
  .cends b { font-family: var(--b-display); font-weight: 800; }
  .cends .to { opacity: .75; text-align: right; }
  /* Cats: weight up top, two weeks of bars underneath */
  .wt { display: flex; align-items: baseline; gap: var(--b-s-sm); min-width: 0; }
  .wt .say { font-size: 1.9em; }
  .wt small { font-weight: 800; opacity: .7; }
  .wt .d { margin-left: auto; }
  .bars { display: flex; align-items: flex-end; gap: var(--b-s-xs); height: 34px; }
  .bars i { flex: 1; border-radius: var(--b-r-xs); background: var(--accent); opacity: .45; }
  .bars i:last-child { opacity: 1; }
  .dots { display: flex; gap: var(--b-s-xs); }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: currentColor; opacity: .2; }
  .dots i.on { background: var(--accent); opacity: 1; }
  :host(.is-night) .dots i.on { background: var(--ink); }
  /* The Litter-Robot 4 from the front */
  .lr { width: 100%; max-height: 220px; display: block; overflow: visible; }
  .lr .shell { fill: color-mix(in srgb, currentColor 7%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.6; }
  .lr .rim { fill: none; stroke: currentColor; stroke-opacity: .22; stroke-width: 1.1; }
  .lr .mouth { fill: color-mix(in srgb, currentColor 22%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; }
  .lr .bed { fill: ${LITTER_BED}; }
  .lr .bed.low { fill: var(--b-warn); }
  .lr .max { stroke: currentColor; stroke-opacity: .45; stroke-width: 1; stroke-dasharray: 3 3; }
  .lr .maxt { font: 800 6px var(--b-body); fill: currentColor; opacity: .55; letter-spacing: .06em; }
  .lr .spin { transform-origin: 100px 80px; }
  .lr.cycling .spin { animation: tilt 2.6s ease-in-out infinite; }
  .lr .nl { fill: currentColor; opacity: .3; }
  .lr .nl.lit { fill: var(--accent); opacity: 1; filter: drop-shadow(0 0 3px var(--accent)); }
  .lr .sensor { fill: currentColor; opacity: .45; }
  .lr .panel { fill: none; stroke: currentColor; stroke-opacity: .55; stroke-width: 3; stroke-linecap: round; }
  .lr .panel.locked { stroke: var(--b-ok); stroke-opacity: 1; }
  .lr .drawer { fill: color-mix(in srgb, currentColor 4%, var(--bg)); stroke: currentColor; stroke-opacity: .35; stroke-width: 1.2; }
  .lr .handle { fill: color-mix(in srgb, currentColor 14%, var(--bg)); stroke: currentColor; stroke-opacity: .3; stroke-width: 1; }
  .lr .dfill { fill: currentColor; fill-opacity: .22; }
  .lr .dfill.hi { fill: var(--b-warn); fill-opacity: 1; }
  /* Occupied: stage curtains, drawn in the same lines as the rest */
  .lr .drape { fill: color-mix(in srgb, currentColor 10%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; stroke-linejoin: round; }
  .lr .fold { fill: none; stroke: currentColor; stroke-opacity: .3; stroke-width: 1.1; stroke-linecap: round; }
  .lr .valance { fill: color-mix(in srgb, currentColor 14%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; stroke-linejoin: round; }
  .lr .l { animation: shutL .6s cubic-bezier(.2,.8,.2,1); }
  .lr .r { animation: shutR .6s cubic-bezier(.2,.8,.2,1); }
  .lr .hot { cursor: pointer; }
  .lr .hot:hover { opacity: .85; }
  .lr.off { opacity: .5; }
  @keyframes tilt { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-24deg); } }
  @keyframes shutL { from { transform: translateX(-56px); } }
  @keyframes shutR { from { transform: translateX(56px); } }
`;

customElements.define("bento-litter", BentoLitter);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bento-litter", name: "Bento litter", description: "A Litter-Robot 4 as bento tiles: status, drawer and litter on a drawing of the robot, each cat's weight and visits, globe light and panel." });
console.info(`%c BENTO LITTER %c ${BENTO_LITTER_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
