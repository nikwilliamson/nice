// Bento feeder - Aqara C1 pet feeders (ZHA, aqara.feeder.acn001) as bento tiles. Two cards:
//
// bento-feeder: per cat, a tile with how many times they've been fed today, when they were last fed and the
// feeder drawn from the front; under it, the meal schedule with Pause, and the feeder's lock and light.
//
//   type: custom:bento-feeder
//   feeders:
//     - name: Zig
//       feeder: zigs_food     # entity prefix: sensor.zigs_food_portions_dispensed_today, button.zigs_food_feed, ...
//     - name: Donut
//       feeder: donuts_food
//       tone: climate         # optional; otherwise cats take tones in the same order as bento-litter
//   schedule: automation.cats_feeding_schedule   # Home Assistant runs the meals; adds a schedule tile under each cat
//   meals:                                       # what that automation does, for the schedule tile
//     - { at: "07:00", portions: 4 }
//     - { at: "17:30", portions: 3 }
//   heading: Food              # optional; a section heading above the tiles, styled like other bento titles
//
// bento-snack: one full-width tile with a button that gives every cat a portion.
//
//   type: custom:bento-snack
//   script: script.cats_feed  # takes a `portions` field
//   portions: 1
//   names: [Zig, Donut]
//   feeders: [zigs_food, donuts_food]   # for "offline" and the portion weight
//   heading: Food              # optional; a section heading above the tile, styled like other bento titles
//
// Palette, tile styles, night mode and the tap/hold model come from bento-core.js (fonts from
// bento-cards.js). Feeding is never a tile tap: a tap opens the details (the portions counter,
// the schedule automation, the snack script), as does press and hold; the snack button still
// takes two taps.
//
// The drawing: the bowl shows today's portions as kibble, the front button's ring is the LED indicator,
// a lock shows child lock. The feeder reports no hopper level, so the drawing doesn't pretend to know it.
const BENTO_FEEDER_VERSION = "3.5.0";

import { BENTO_TOKENS_CSS, BENTO_BASE_CSS, tone, offTone, CAT_TONES, esc, num, isToday, when, watchColumns, isNight, applyNight, bindTap, confirmTap, moreInfo, pageGutter } from "./bento-core.js?v=1.1.0";
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

// Illustrative, not status: the kibble in the bowl
const KIBBLE = "#c98a4b", KIBBLE_EDGE = "#8f5a26";

// "17:30" as the viewer's clock writes it: "5:30 PM"
const fdClock = (hm) => { const [h, m] = String(hm).split(":").map(Number), d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

// The C1 straight on: a tall rounded body with a lid, the button on the front, the chute and its bowl underneath
function fdFeeder({ portions, led, locked, off, problem }) {
  const kib = Math.min(9, portions || 0);
  // Kibble heaps up from the middle of the bowl, a piece per portion
  const spots = [[60, 151], [53, 152], [67, 152], [57, 148], [63, 148], [47, 153], [73, 153], [60, 145], [50, 149]];
  const pile = spots.slice(0, kib).map(([x, y]) => `<ellipse class="kib" cx="${x}" cy="${y}" rx="3.4" ry="2.4"/>`).join("");
  return `<svg class="fd ${off ? "off" : ""}" viewBox="0 0 120 170" role="img" aria-label="Pet feeder">
    <defs><clipPath id="fd-bowl"><ellipse cx="60" cy="150" rx="27" ry="9"/></clipPath></defs>
    <rect class="body" x="24" y="10" width="72" height="128" rx="18"/>
    <path class="lid" d="M24,34 L96,34"/>
    <rect class="window" x="38" y="44" width="44" height="34" rx="9"/>
    <circle class="btn ${led ? "lit" : ""}" cx="60" cy="96" r="8"/>
    <circle class="btnc" cx="60" cy="96" r="4.4"/>
    ${locked ? `<g class="lock"><rect x="73" y="98" width="9" height="7" rx="1.6"/><path d="M75,98 L75,95.5 A2.5,2.5 0 0 1 80,95.5 L80,98"/></g>` : ""}
    ${problem ? `<g class="alert"><circle cx="85" cy="20" r="7"/><path d="M85,16 L85,21 M85,23.6 L85,24"/></g>` : ""}
    <rect class="chute" x="48" y="118" width="24" height="9" rx="4"/>
    <path class="tray" d="M14,146 C14,138 20,135 30,135 L90,135 C100,135 106,138 106,146 L106,152 C106,160 98,165 86,165 L34,165 C22,165 14,160 14,152 Z"/>
    <ellipse class="bowl" cx="60" cy="150" rx="29" ry="10.5"/>
    <g clip-path="url(#fd-bowl)">${pile}</g>
  </svg>`;
}

class BentoFeeder extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.feeders) || !config.feeders.length) throw new Error("bento-feeder: add at least one feeder, e.g. feeders: [{name: Zig, feeder: zigs_food}]");
    this._config = { sun: "sun.sun", font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
    this._feeds = {};
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  // The day's rollover has to reset "fed twice" while nothing else changes
  connectedCallback() {
    clearInterval(this._tick); this._tick = setInterval(() => { if (this._hass) this.hass = this._hass; }, 60000);
    if (!this._gutter) { this._gutter = true; pageGutter(true); }
  }
  disconnectedCallback() {
    this._ro?.disconnect(); this._ro = null; clearInterval(this._tick);
    if (this._gutter) { this._gutter = false; pageGutter(false); }
  }

  _id(f, domain, key) { return `${domain}.${f.feeder}_${key}`; }
  _st(f, domain, key) { return this._hass.states[this._id(f, domain, key)]?.state; }

  set hass(hass) {
    hass = this._hass = pending(this).take(hass);
    const watch = this._config.feeders.flatMap((f) => ["button.feed", "sensor.portions_dispensed_today", "binary_sensor.problem", "switch.child_lock", "switch.led_indicator"]
      .map((k) => { const [d, key] = k.split("."); return this._id(f, d, key); }));
    const night = applyNight(this, isNight(hass, this._config.sun));
    const sig = JSON.stringify([night, this._cols, hass.states[this._config.schedule]?.state, this._feedsV, new Date().toDateString(), watch.map((e) => { const s = hass.states[e]; return s && [s.state, s.last_changed]; })]);
    this._history();
    if (sig === this._sig) return;
    this._sig = sig;
    this._night = night;
    keepScroll(() => this._render());
  }

  // Feeds since yesterday morning, from the portions counter's history: each rise in the count is food coming out,
  // and rises within a couple of minutes of each other are one feed dispensing its portions.
  // Fetched again whenever a counter changes.
  async _history() {
    const ids = this._config.feeders.map((f) => this._id(f, "sensor", "portions_dispensed_today"));
    const key = ids.map((e) => this._hass.states[e]?.last_changed).join("|") + new Date().toDateString();
    if (this._histBusy || key === this._histKey) return;
    this._histBusy = true;
    try {
      const start = new Date(Date.now() - 86400000); start.setHours(0, 0, 0, 0);
      const res = await this._hass.callWS({ type: "history/history_during_period", start_time: start.toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      ids.forEach((id) => {
        const feeds = [];
        let prev = null;
        for (const row of res[id] || []) {
          const v = parseFloat(row.s), at = (row.lu ?? row.lc) * 1000;
          if (!Number.isNaN(v) && prev != null && v > prev && !(feeds.length && at - feeds[feeds.length - 1] < 120000)) feeds.push(at);
          else if (!Number.isNaN(v) && prev != null && v > prev) feeds[feeds.length - 1] = at;
          if (!Number.isNaN(v)) prev = v;
        }
        this._feeds[id] = feeds;
      });
      this._histKey = key;
      this._feedsV = (this._feedsV || 0) + 1;
      this._sig = null; this.hass = this._hass;
    } catch (e) {
      this._histKey = key;
    } finally { this._histBusy = false; }
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    watchColumns(this, (w) => (w && w < 560 ? 1 : 2));
    this.shadowRoot.innerHTML = `<style>${BENTO_TOKENS_CSS}${BENTO_BASE_CSS}${FEEDER_CSS}</style>
      ${this._config.heading ? `<div class="head"><span class="title">${esc(this._config.heading)}</span></div>` : ""}
      <div class="grid c${this._cols || 2} ${this._night ? "is-night" : ""}">${this._config.feeders.map((f, i) => `<div class="cat">${this._tile(f, i)}${this._sched(f, i)}</div>`).join("")}</div>`;
    this._wire();
  }

  // Two lines and the drawing: how many times they've been fed today, and when they were last fed
  _tile(f, i) {
    const n = this._night, h = this._hass;
    const pt = h.states[this._id(f, "sensor", "portions_dispensed_today")], feed = h.states[this._id(f, "button", "feed")];
    const off = !feed || feed.state === "unavailable" || pt?.state === "unavailable";
    const problem = this._st(f, "binary_sensor", "problem") === "on";
    const portionsToday = pt && isToday(pt.last_changed) ? Math.round(num(pt.state) ?? 0) : 0;
    const feeds = this._feeds[this._id(f, "sensor", "portions_dispensed_today")];
    const today = feeds ? feeds.filter((at) => isToday(new Date(at).toISOString())).length : null;
    const lastAt = feeds?.length ? new Date(feeds[feeds.length - 1]).toISOString() : portionsToday ? pt.last_changed : null;
    const times = (k) => ["Not fed yet", "Fed once today", "Fed twice today"][k] || `Fed ${k} times today`;
    const say = off ? "Offline" : problem ? "Needs a look" : today != null ? times(today) : portionsToday ? "Fed today" : "Not fed yet";
    const t = problem ? tone("hazard", n) : off ? offTone(n) : tone(f.tone || CAT_TONES[i % CAT_TONES.length], n);
    return `<div class="tile feeder" data-i="${i}" style="--bg:${t.bg};--ink:${t.ink};--accent:${t.accent}">
      <div class="lbl">${esc(f.name || "Feeder")}</div>
      <div class="txt"><div class="say">${esc(say)}</div>${lastAt ? `<div class="sub">Last fed at ${esc(when(lastAt))}</div>` : ""}</div>
      <div class="viz">${fdFeeder({ portions: portionsToday, led: this._st(f, "switch", "led_indicator") === "on", locked: this._st(f, "switch", "child_lock") === "on", off, problem })}</div>
    </div>`;
  }

  // The meal plan Home Assistant runs, with Pause, and the feeder's own lock and light
  _sched(f, i) {
    const id = this._config.schedule;
    if (!id) return "";
    const n = this._night, h = this._hass, on = h.states[id]?.state === "on";
    const off = !h.states[this._id(f, "button", "feed")] || this._st(f, "button", "feed") === "unavailable";
    const locked = this._st(f, "switch", "child_lock") === "on", led = this._st(f, "switch", "led_indicator") === "on";
    const meals = [...(this._config.meals || [])].sort((a, b) => a.at.localeCompare(b.at));
    const t = off ? offTone(n) : on ? tone("today", n) : offTone(n);
    const say = on ? (meals.length ? meals.map((m) => fdClock(m.at)).join(" & ") : "On schedule") : "Schedule paused";
    const sub = meals.length ? meals.map((m) => `${fdClock(m.at)} × ${m.portions}`).join(" · ") + (this._config.feeders.length > 1 ? " · both cats" : "")
      : `${locked ? "Buttons locked" : "Buttons unlocked"} · light ${led ? "on" : "off"}`;
    const dis = off ? "disabled" : "";
    return `<div class="tile sched" data-i="${i}" style="--bg:${t.bg};--ink:${t.ink};--accent:${t.accent}">
      <div class="lbl">${esc([f.name, "Schedule"].filter(Boolean).join(" · "))}</div>
      <div class="txt"><div class="say">${esc(say)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="row between">
        <button class="pill ${on ? "" : "sel"}" data-plan="1">${on ? "Pause" : "Resume"}</button>
        <span class="row"><button class="pill" data-sw="child_lock" ${dis} title="${locked ? "Buttons locked" : "Buttons unlocked"}">${locked ? "Unlock" : "Lock"}</button><button class="pill" data-sw="led_indicator" ${dis}>${led ? "Light off" : "Light on"}</button></span>
      </div>
    </div>`;
  }

  _wire() {
    const F = this._config.feeders, h = pending(this).wrap(this._hass);
    this.shadowRoot.querySelectorAll(".tile.sched").forEach((tile) => {
      const f = F[+tile.dataset.i];
      tile.querySelector("[data-plan]")?.addEventListener("click", () => {
        const id = this._config.schedule;
        h.callService("automation", h.states[id]?.state === "on" ? "turn_off" : "turn_on", { entity_id: id });
      });
      tile.querySelectorAll("[data-sw]").forEach((el) => el.addEventListener("click", () => {
        if (!el.disabled) h.callService("switch", "toggle", { entity_id: this._id(f, "switch", el.dataset.sw) });
      }));
      // No single safe action (pause, lock, light): tap and hold both open the schedule automation
      const more = () => moreInfo(this, this._config.schedule);
      bindTap(tile, { tap: more, hold: more });
    });
    // A feeder tile never feeds on a tap: tap and hold open the portions counter, with its history
    this.shadowRoot.querySelectorAll(".tile.feeder").forEach((tile) => {
      const more = () => moreInfo(this, this._id(F[+tile.dataset.i], "sensor", "portions_dispensed_today"));
      bindTap(tile, { tap: more, hold: more });
    });
  }
}

// Only what is the feeder's own; tiles, pills and type come from bento-core
const FEEDER_CSS = `
  :host { font-family: var(--b-body); }
  .grid { display: grid; gap: var(--b-gap); }
  .grid.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.c1 { grid-template-columns: 1fr; }
  .cat { display: grid; gap: var(--b-gap); align-content: start; min-width: 0; }
  .sched { grid-template-rows: auto 1fr auto; min-height: var(--b-row); }
  /* Eyebrow and words on the left, the feeder drawn on the right */
  .feeder { grid-template-columns: minmax(0, 1fr) 96px; grid-template-rows: auto 1fr; align-items: center; column-gap: var(--b-s-md); min-height: 150px; }
  .feeder .lbl { grid-column: 1; grid-row: 1; align-self: start; }
  .feeder .txt { grid-column: 1; grid-row: 2; gap: var(--b-s-xs); }
  .feeder .viz { grid-column: 2; grid-row: 1 / span 2; display: grid; place-items: center; }
  /* The Aqara C1 from the front */
  .fd { width: 100%; max-height: 130px; display: block; overflow: visible; }
  .fd .body { fill: color-mix(in srgb, currentColor 5%, #ffffff); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.6; }
  :host(.is-night) .fd .body { fill: color-mix(in srgb, currentColor 10%, var(--bg)); }
  .fd .lid { stroke: currentColor; stroke-opacity: .3; stroke-width: 1.2; }
  .fd .window { fill: color-mix(in srgb, currentColor 9%, var(--bg)); stroke: currentColor; stroke-opacity: .22; stroke-width: 1; }
  .fd .btn { fill: none; stroke: currentColor; stroke-opacity: .35; stroke-width: 2; }
  .fd .btn.lit { stroke: var(--accent); stroke-opacity: 1; filter: drop-shadow(0 0 3px var(--accent)); }
  .fd .btnc { fill: color-mix(in srgb, currentColor 14%, var(--bg)); }
  .fd .lock rect { fill: var(--b-locked); }
  .fd .lock path { fill: none; stroke: var(--b-locked); stroke-width: 1.6; }
  .fd .alert circle { fill: #ffffff; }
  .fd .alert path { stroke: var(--b-alert); stroke-width: 2.2; stroke-linecap: round; }
  .fd .chute { fill: color-mix(in srgb, currentColor 30%, var(--bg)); }
  .fd .tray { fill: color-mix(in srgb, currentColor 7%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; }
  .fd .bowl { fill: color-mix(in srgb, currentColor 18%, var(--bg)); stroke: currentColor; stroke-opacity: .4; stroke-width: 1.3; }
  .fd .kib { fill: ${KIBBLE}; stroke: ${KIBBLE_EDGE}; stroke-width: .6; }
  .fd.off { opacity: .5; }
`;

// Snack time: one full-width tile and one button that gives every cat a portion, through the same script as meals
class BentoSnack extends HTMLElement {
  setConfig(config) {
    if (!config.script) throw new Error("bento-snack: set script, e.g. script: script.cats_feed");
    this._config = { title: "Snack time!", portions: 1, names: [], feeders: [], sun: "sun.sun", font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() { if (!this._gutter) { this._gutter = true; pageGutter(true); } }
  disconnectedCallback() {
    clearTimeout(this._confirmT); clearTimeout(this._doneT);
    if (this._gutter) { this._gutter = false; pageGutter(false); }
  }

  set hass(hass) {
    this._hass = hass;
    const c = this._config;
    const watch = [c.script, c.sun, ...c.feeders.map((p) => `button.${p}_feed`)];
    const night = applyNight(this, isNight(hass, c.sun));
    const sig = JSON.stringify([night, this._confirm, this._sent, watch.map((e) => hass.states[e]?.state)]);
    if (sig === this._sig) return;
    this._sig = sig;
    keepScroll(() => this._render(night));
  }

  _render(n) {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const c = this._config, h = this._hass, s = h.states[c.script];
    const offline = c.feeders.filter((p) => { const b = h.states[`button.${p}_feed`]; return !b || b.state === "unavailable"; });
    const missing = !s || s.state === "unavailable", allOff = c.feeders.length > 0 && offline.length === c.feeders.length;
    const t = missing || allOff ? offTone(n) : tone("today", n);
    const who = c.names.length ? c.names.join(" and ") : "everyone";
    const sub = missing ? "Can't find the feeding script" : offline.length ? `${allOff ? "The feeders are" : "A feeder is"} offline` : `Give ${who} a treat`;
    // Busy while the script runs, which includes its minute of putting the feeders' settings back
    const armed = this._confirm === "snack";
    const busy = this._sent || s?.state === "on";
    const label = armed ? "Tap again" : busy ? "Serving…" : "Serve";
    const lbl = c.names.length ? c.names.join(" & ") : "Snack";
    this.shadowRoot.innerHTML = `<style>${BENTO_TOKENS_CSS}${BENTO_BASE_CSS}${SNACK_CSS}</style>
      ${c.heading ? `<div class="head"><span class="title">${esc(c.heading)}</span></div>` : ""}
      <div class="tile snack" style="--bg:${t.bg};--ink:${t.ink};--accent:${t.accent}">
        <div class="lbl">${esc(lbl)}</div>
        <div class="txt"><div class="say">${esc(c.title)}</div><div class="sub">${esc(sub)}</div></div>
        <div class="foot"><button class="pill ${armed ? "go" : "sel"}" ${missing || allOff || busy ? "disabled" : ""}>${esc(label)}</button></div>
      </div>`;
    this.shadowRoot.querySelector("button").addEventListener("click", (ev) => { ev.stopPropagation(); this._tap(); });
    // The tile itself never serves: tap and hold open the feeding script
    const more = () => moreInfo(this, c.script);
    bindTap(this.shadowRoot.querySelector(".tile"), { tap: more, hold: more });
  }

  _rerender() { this._sig = null; if (this._hass) this.hass = this._hass; }

  // Two taps, so a brushed tablet doesn't hand out treats
  _tap() {
    confirmTap(this, "snack", {
      render: () => this._rerender(),
      run: () => {
        this._sent = true; this._rerender();
        const [domain, svc] = this._config.script.split(".");
        this._hass.callService(domain, svc, { portions: this._config.portions });
        // The script's own state takes over once it's running
        clearTimeout(this._doneT);
        this._doneT = setTimeout(() => { this._sent = false; this._rerender(); }, 5000);
      },
    });
  }
}

// Only the snack's own layout: words on the left, the standard pill on the right at every width;
// the pill and the type scale are bento-core's
const SNACK_CSS = `
  :host { font-family: var(--b-body); }
  .snack { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; column-gap: var(--b-s-lg); }
  .snack .lbl { grid-column: 1; grid-row: 1; }
  .snack .txt { grid-column: 1; grid-row: 2; gap: var(--b-s-2xs); }
  .snack .foot { grid-column: 2; grid-row: 1 / span 2; }
  .snack .sub { white-space: normal; }
  /* The same headline size as the Litter Box card's main tile */
  .snack .say { font-size: 2.1em; line-height: 1.02; }
`;

customElements.define("bento-feeder", BentoFeeder);
customElements.define("bento-snack", BentoSnack);
window.customCards = window.customCards || [];
window.customCards.push(
  { type: "bento-feeder", name: "Bento feeder", description: "Aqara C1 pet feeders, one bento tile per cat: fed how many times today, and when last." },
  { type: "bento-snack", name: "Bento snack", description: "A full-width Snack time tile with one button that gives every cat a portion." },
);
console.info(`%c BENTO FEEDER %c ${BENTO_FEEDER_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
