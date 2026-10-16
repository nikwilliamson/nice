// Bento car - one Tesla (tesla_fleet) as a block of bento tiles.
// Card: bento-car
//
//   type: custom:bento-car
//   car: nik          # entity prefix: lock.nik_s_car_lock, sensor.nik_s_car_battery_level, ...
//   name: "Nik's"     # shown as "Nik's car"
//
// Palette, tile styles, night mode and the tap/hold model come from bento-core.js (fonts from
// bento-cards.js). Tap a tile for its obvious action where it has a safe one (sentry on/off,
// play/pause), otherwise for its details; press and hold always opens the details. Unlocking
// still takes two taps.
//
// tesla_fleet reports missing body data (a sleeping car, or just after a restart) as
// frunk and trunk "open". The covers are only trusted while the lock knows its own
// state, the same rule the Home tiles use.
//
// Controls always sit on a tile's bottom edge. Where a picture goes is decided per tile:
// the car drawing sits above its title, the charge bar under it.
const BENTO_CAR_VERSION = "1.4.0";

import { BENTO_TOKENS_CSS, BENTO_BASE_CSS, tone, offTone, esc, num, span, newestChange, statusTag, watchColumns, isNight, applyNight, bindTap, confirmTap, moreInfo, pageGutter } from "./bento-core.js?v=1.1.0";
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

// Body parts on the top-down drawing (front of the car to the right, driver's side on top)
const DOORS = [
  ["front_driver", "Front driver"], ["rear_driver", "Rear driver"],
  ["front_passenger", "Front passenger"], ["rear_passenger", "Rear passenger"],
];

// A Tesla from above, front to the right and the driver's side on top, in the proportions of
// a Model 3 / Y (about 2.5 : 1). Everything is drawn for the top half and mirrored for the
// passenger side. Open doors swing out on their front hinges; open lids fill with the accent.
function carOverhead({ d, w, frunk, trunk, port, vent, sedan, title, label }) {
  const flip = (el) => `<g transform="translate(0 120) scale(1 -1)">${el}</g>`;
  const part = (p, el, kind = "lid") => `<g class="part ${kind} ${p.cls}" data-more="${esc(p.eid)}"><title>${esc(title(p))}</title>${el}</g>`;
  const door = (p, x, hinge, bottom) => {
    const panel = `<path d="M${x},14.6 L${hinge - 1},13.9 L${hinge - 1},20.5 L${x},21 Z"/>`;
    const swung = p.cls === "open" ? `<g transform="rotate(-27 ${hinge} 14)">${panel}</g>` : panel;
    return part(p, bottom ? flip(swung) : swung, "door");
  };
  const win = (p, x1, x2, bottom) => {
    const y1 = 25.4 + (178 - x1) * 0.05, y2 = 25.4 + (178 - x2) * 0.05;
    const el = `<path d="M${x1},${y1 + 0.6} L${x2},${y2 + 0.6} L${x2},${y2 + 4.2} L${x1},${y1 + 4.2} Z"/>`;
    return part(p, bottom ? flip(el) : el, "win");
  };
  const g0 = sedan ? 76 : 56; // where the glass ends at the back
  const body = "M12,60 C12,33 19,17 42,13.2 C72,9.6 110,14.8 140,14.6 C172,14.4 200,10.8 223,14.8 C241,18.4 249.5,36 249.5,60 C249.5,84 241,101.6 223,105.2 C200,109.2 172,105.6 140,105.4 C110,105.2 72,110.4 42,106.8 C19,103 12,87 12,60 Z";
  const glass = `M180,23.4 C195,38 195,82 180,96.6 L${g0 + 16},91.2 C${g0 + 3},89.6 ${g0 - 3},78 ${g0 - 3},60 C${g0 - 3},42 ${g0 + 3},30.4 ${g0 + 16},28.8 Z`;
  const lid = sedan
    ? "M74,25.4 C40,23.6 19,38 19,60 C19,82 40,96.4 74,94.6 C69.6,76 69.6,44 74,25.4 Z"
    : "M54,27.6 C31,27 19,40 19,60 C19,80 31,93 54,92.4 C50,76 50,44 54,27.6 Z";
  const hood = "M194,21.4 C224,19.6 241.6,37.6 242.4,60 C241.6,82.4 224,100.4 194,98.6 C198.6,80 198.6,40 194,21.4 Z";
  const tire = (x) => `<rect class="tire" x="${x}" y="8.6" width="31" height="8" rx="3.6"/>`;
  const mirror = `<path class="mirror" d="M171,14.6 C169.4,8.2 163.4,5.6 157.6,6.8 C156.4,9.6 157.6,12.6 160.6,15.2 Z"/>`;
  // Door shut lines: from above, a closed door is only its seams
  const cuts = `<path class="cut" d="M84,14.2 L84,21.4 M127,13.9 L127,21 M172,13.9 L172,20.6"/>`;
  const lights = `<path class="light" d="M234,22.6 C239.6,26.6 243.4,33 245,40.6"/><path class="light" d="M24.6,22.6 C19.6,26.6 16.8,32.4 15.8,39"/>`;
  return `<svg class="car" viewBox="0 0 260 120" role="img" aria-label="${esc(label)}">
    ${tire(42)}${tire(190)}${flip(tire(42) + tire(190))}
    <path class="shell" d="${body}"/>
    ${part(frunk, `<path d="${hood}"/>`)}
    ${part(trunk, `<path d="${lid}"/>`)}
    <path class="glass ${vent ? "vent" : ""}" d="${glass}"/>
    <path class="seam" d="M150,23.6 C154,40 154,80 150,96.4"/>
    <path class="seam" d="M${sedan ? 96 : 82},26.4 C${sedan ? 99 : 85},42 ${sedan ? 99 : 85},78 ${sedan ? 96 : 82},93.6"/>
    ${lights}${flip(lights)}${cuts}${flip(cuts)}${mirror}${flip(mirror)}
    ${win(w.front_driver, 170, 132)}${win(w.rear_driver, 128, sedan ? 100 : 88)}
    ${win(w.front_passenger, 170, 132, true)}${win(w.rear_passenger, 128, sedan ? 100 : 88, true)}
    ${door(d.front_driver, 128, 172)}${door(d.rear_driver, 84, 127)}
    ${door(d.front_passenger, 128, 172, true)}${door(d.rear_passenger, 84, 127, true)}
    ${part(port, `<rect x="23" y="17.4" width="11" height="6.4" rx="2.4"/>`, "port")}
  </svg>`;
}

class BentoCar extends HTMLElement {
  setConfig(config) {
    if (!config.car) throw new Error("bento-car needs car (the entity prefix, e.g. nik)");
    this._config = { name: null, sun: "sun.sun", font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
  }
  getCardSize() { return 8; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  // "4 min ago" has to keep counting while nothing else changes
  connectedCallback() {
    clearInterval(this._tick); this._tick = setInterval(() => { if (this._hass) this.hass = this._hass; }, 30000);
    if (!this._gutter) { this._gutter = true; pageGutter(true); }
  }
  disconnectedCallback() {
    this._ro?.disconnect(); this._ro = null; clearTimeout(this._confirmT); clearInterval(this._tick);
    if (this._gutter) { this._gutter = false; pageGutter(false); }
  }

  _id(domain, key) { return `${domain}.${this._config.car}_s_car_${key}`; }
  _s(domain, key) { return this._hass.states[this._id(domain, key)]; }
  _st(domain, key) { return this._s(domain, key)?.state; }

  set hass(hass) {
    hass = this._hass = pending(this).take(hass);
    const p = `${this._config.car}_s_car_`;
    const mine = Object.keys(hass.states).filter((e) => e.split(".")[1].startsWith(p));
    const night = applyNight(this, isNight(hass, this._config.sun));
    const sig = JSON.stringify([night, this._cols, this._confirm, Math.floor(Date.now() / 60000), mine.map((e) => { const s = hass.states[e]; return [e, s.state, s.attributes.temperature, s.attributes.current_temperature, s.attributes.media_title]; })]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._night = night;
    keepScroll(() => this._render());
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    watchColumns(this);
    const name = this._config.name || this._config.car;
    this.shadowRoot.innerHTML = `<style>${BENTO_TOKENS_CSS}${BENTO_BASE_CSS}${CAR_CSS}</style>
      <div class="head"><span class="title">${esc(name)} car</span>${this._tag()}</div>
      <div class="grid c${this._cols || 4} ${this._night ? "is-night" : ""}">
        ${this._hero()}${this._body()}${this._climate()}${this._charging()}${this._sentry()}${this._music()}
      </div>`;
    this._wire();
  }

  // Is the car talking to us, and how fresh is what we know. The browser only sees when
  // a value last changed (not when it was last polled), so "ago" is the newest change
  // across the car's own entities.
  _tag() {
    const h = this._hass;
    const status = h.states[this._id("binary_sensor", "status")];
    const newest = newestChange(h, `${this._config.car}_s_car_`);
    let cls, text;
    if (status?.state === "on") {
      const ago = newest && span(newest);
      cls = "ok"; text = `Online · ${ago ? `${ago} ago` : "just now"}`;
    } else if (status?.state === "off") {
      const since = span(status.last_changed);
      cls = "locked"; text = since ? `Asleep for ${since}` : "Just fell asleep";
    } else {
      const ago = newest && span(newest);
      cls = "warn"; text = ago ? `Offline · last heard ${ago} ago` : "Offline";
    }
    return statusTag(cls, text, status?.attributes?.friendly_name || "");
  }

  _tile(area, t, cls, inner) {
    return `<div class="tile ${cls}" data-tile="${area}" style="grid-area:${area};--bg:${t.bg};--ink:${t.ink};--accent:${t.accent}">${inner}</div>`;
  }

  // Where the car is and how much battery it has, with the bar the Home tile uses
  _hero() {
    const n = this._night, lock = this._st("lock", "lock"), where = this._st("device_tracker", "location");
    const awake = this._st("binary_sensor", "status") === "on";
    const pct = num(this._st("sensor", "battery_level")), range = num(this._st("sensor", "battery_range"));
    const limit = num(this._st("number", "charge_limit")) ?? 80;
    const charging = this._st("sensor", "charging") === "charging";
    const plugged = this._st("binary_sensor", "charge_cable") === "on";
    const home = where === "home";
    const unlocked = lock === "unlocked";
    const known = lock && !["unknown", "unavailable"].includes(lock);
    const placeName = where && !["home", "not_home", "unknown", "unavailable"].includes(where) ? this._hass.states[`zone.${where}`]?.attributes?.friendly_name || where : null;
    const lbl = home ? "At home" : placeName || (where === "not_home" ? "Out" : "Somewhere");
    const say = charging ? `Charging to ${Math.round(limit)}%`
      : unlocked ? (home ? "Unlocked in the driveway" : "Left unlocked")
      : pct != null && pct < 20 ? (home && !plugged ? "Running low. Plug it in?" : "Running low")
      : home ? (plugged ? "Parked and plugged in" : known ? "Parked and locked" : "Parked at home")
      : "Out and about";
    const sub = known ? "" : "Details once it wakes";
    const t = unlocked || (pct != null && pct < 20) ? tone("act", n) : tone("car", n);
    let bar = "";
    if (pct != null) {
      const now = Math.max(0, Math.min(100, pct)), lim = Math.max(now, Math.min(100, limit));
      const full = range && pct > 0 ? Math.round((range / pct) * lim) : null;
      bar = `<div class="charge"><div class="cbar"><i class="now ${now < 20 ? "low" : ""}" style="width:${now}%"></i>
          ${plugged || charging ? `<i class="gain ${charging ? "live" : ""}" style="left:${now}%;width:${lim - now}%"></i>` : ""}<span class="lim" style="left:${lim}%"></span></div>
        <div class="cends"><span><b>${Math.round(now)}%</b>${range != null ? ` · ${Math.round(range)} mi` : ""}</span><span class="to"><b>${Math.round(lim)}%</b> limit${full ? ` · ${full} mi` : ""}</span></div></div>`;
    }
    const lockBtn = lock === "locked" ? `<button class="pill ${this._confirm === "unlock" ? "sel" : ""}" data-act="unlock">${this._confirm === "unlock" ? "Tap again to unlock" : "Unlock"}</button>`
      : unlocked ? `<button class="pill sel" data-act="lock">Lock it</button>` : "";
    const wake = awake ? "" : `<button class="pill" data-act="wake">Wake</button>`;
    return this._tile("hero", t, "hero", `<div class="lbl">${esc(lbl)}</div>
      <div class="txt"><div class="say">${esc(say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      <div class="foot">${bar}${lockBtn || wake ? `<div class="row">${lockBtn}${wake}</div>` : ""}</div>`);
  }

  // The car from above: whatever is open lights up; tap a part for its controls
  _body() {
    const n = this._night, lock = this._st("lock", "lock");
    const fresh = lock && !["unknown", "unavailable"].includes(lock);
    const open = [];
    const part = (eid, isOpen, label, guarded) => {
      const s = this._hass.states[eid];
      if (!s) return { cls: "gone", eid };
      if (guarded && !fresh) return { cls: "unk", eid };
      if (isOpen(s.state)) { open.push(label); return { cls: "open", eid }; }
      return { cls: "", eid };
    };
    const on = (st) => st === "on", opened = (st) => st === "open" || st === "opening";
    const d = {}, w = {};
    DOORS.forEach(([k, label]) => {
      d[k] = part(this._id("binary_sensor", `${k}_door`), on, `${label.toLowerCase()} door`);
      w[k] = part(this._id("binary_sensor", `${k}_window`), on, `${label.toLowerCase()} window`);
    });
    const frunk = part(this._id("cover", "frunk"), opened, "frunk", true);
    const trunk = part(this._id("cover", "trunk"), opened, "trunk", true);
    const port = part(this._id("cover", "charge_port_door"), opened, "charge port");
    const vent = this._st("cover", "windows") === "open";
    const t = open.length ? tone("act", n) : tone("health", n);
    const say = open.length === 0 ? "Everything's shut" : open.length === 1 ? `The ${open[0]} is open` : `${open.length} things are open`;
    const sub = !fresh ? "Frunk and trunk show up once it wakes" : open.length > 1 ? open.join(", ").replace(/^./, (c) => c.toUpperCase()) : vent ? "Windows are venting" : "Doors, windows, frunk and trunk";
    // Model 3 (and S) have a trunk deck behind the rear glass; Model Y (and X) a short liftgate
    const dev = this._hass.devices?.[this._hass.entities?.[this._id("lock", "lock")]?.device_id];
    const sedan = /^(3|s)$/i.test(String(this._config.model || dev?.model || "").replace(/^model\s*/i, "").trim());
    const svg = carOverhead({ d, w, frunk, trunk, port, vent, sedan, label: say, title: (p) => this._hass.states[p.eid]?.attributes?.friendly_name || p.eid });
    return this._tile("body", t, "body has-viz", `<div class="lbl">Doors & trunks</div>
      <div class="viz">${svg}</div>
      <div class="txt"><div class="say">${esc(say)}</div><div class="sub">${esc(sub)}</div></div>`);
  }

  _climate() {
    const n = this._night, s = this._s("climate", "climate");
    if (!s) return this._tile("clim", offTone(n), "", `<div class="lbl">Cabin</div><div class="txt"><div class="say">Not here</div></div>`);
    const a = s.attributes, quiet = ["unknown", "unavailable"].includes(s.state), on = !quiet && s.state !== "off";
    const inside = num(this._st("sensor", "inside_temperature")) ?? a.current_temperature;
    const outside = num(this._st("sensor", "outside_temperature"));
    const set = a.temperature;
    const say = inside != null ? `${Math.round(inside)}° inside` : "Cabin";
    const sub = quiet ? "Asleep · last reading" : on ? `Getting it to ${Math.round(set)}°` : outside != null ? `${Math.round(outside)}° outside · off` : "Off";
    const t = on ? tone("climate", n) : offTone(n);
    const step = on && set != null ? `<div class="setp"><button class="step" data-act="cooler" aria-label="Cooler">−</button><b>${Math.round(set)}°</b><button class="step" data-act="warmer" aria-label="Warmer">+</button></div>` : "";
    return this._tile("clim", t, "clim", `<div class="lbl">Cabin</div>
      <div class="txt"><div class="say">${esc(say)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="foot"><div class="row between">${step}<button class="pill ${on ? "" : "sel"}" data-act="${on ? "climate_off" : "climate_on"}">${on ? "Turn off" : "Cool or warm it"}</button></div></div>`);
  }

  _charging() {
    const n = this._night, st = this._st("sensor", "charging");
    const plugged = this._st("binary_sensor", "charge_cable") === "on" || ["charging", "starting", "stopped", "complete", "no_power"].includes(st);
    const kw = num(this._st("sensor", "charger_power"));
    const limit = num(this._st("number", "charge_limit"));
    const added = num(this._st("sensor", "charge_energy_added"));
    const full = this._st("sensor", "time_to_full_charge");
    const fullAt = full && !["unknown", "unavailable"].includes(full) ? new Date(full) : null;
    const say = { charging: kw ? `Charging at ${kw} kW` : "Charging", starting: "Starting to charge", complete: `Full to ${limit != null ? Math.round(limit) + "%" : "the limit"}`,
      stopped: "Plugged in, paused", no_power: "Plugged in, no power", disconnected: "Not plugged in" }[st] || "Charging";
    const sub = st === "charging" && fullAt && !Number.isNaN(fullAt.getTime()) ? `Done by ${fullAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : added ? `Last session added ${Math.round(added * 10) / 10} kWh` : "";
    const t = st === "charging" || st === "starting" ? tone("energy", n) : offTone(n);
    const lim = limit != null ? `<div class="setp"><button class="step" data-act="limit_down" aria-label="Lower limit">−</button><b>${Math.round(limit)}%</b><button class="step" data-act="limit_up" aria-label="Raise limit">+</button></div>` : "";
    const go = plugged && this._s("switch", "charge") ? `<button class="pill ${st === "charging" ? "" : "sel"}" data-act="${st === "charging" ? "charge_stop" : "charge_start"}">${st === "charging" ? "Stop" : "Start charging"}</button>` : "";
    return this._tile("chg", t, "chg", `<div class="lbl">Charging · limit</div>
      <div class="txt"><div class="say">${esc(say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      <div class="foot"><div class="row between">${lim}${go}</div></div>`);
  }

  _sentry() {
    const n = this._night, st = this._st("switch", "sentry_mode"), on = st === "on";
    const t = on ? tone("plan", n) : offTone(n);
    return this._tile("sen", t, "sen", `<div class="lbl">Sentry mode</div>
      <div class="txt"><div class="say">${st === "unavailable" || !st ? "Offline" : on ? "Watching" : "Off"}</div><div class="sub">${on ? "Recording" : "Not recording"}</div></div>
      <div class="foot"><div class="row"><button class="pill" data-act="sentry">${on ? "Turn off" : "Turn on"}</button></div></div>`);
  }

  _music() {
    const n = this._night, s = this._s("media_player", "media_player");
    const st = s?.state, a = s?.attributes || {};
    const playing = st === "playing", busy = playing || st === "paused";
    const say = busy ? a.media_title || (playing ? "Playing" : "Paused") : st === "idle" ? "Idle" : "Off";
    const sub = busy ? [a.media_artist, a.source].filter(Boolean).join(" · ") || (playing ? "" : "Paused") : "";
    const t = playing ? tone("media", n) : offTone(n);
    const btns = busy ? `<button class="pill" data-act="play_pause">${playing ? "Pause" : "Play"}</button><button class="pill" data-act="next">Next</button>` : "";
    return this._tile("mus", t, `mus ${playing ? "on" : ""}`, `<div class="lbl">Music</div>
      <div class="txt"><div class="say">${esc(say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      ${btns ? `<div class="foot"><div class="row">${btns}</div></div>` : ""}`);
  }

  _call(domain, service, key, data = {}) {
    pending(this).wrap(this._hass).callService(domain, service, { entity_id: this._id(domain, key), ...data });
  }
  _more(eid) { moreInfo(this, eid); }
  _redraw() { this._sig = null; if (this._hass) this.hass = this._hass; }

  _act(a) {
    const clim = this._s("climate", "climate")?.attributes || {};
    const limit = num(this._st("number", "charge_limit"));
    const lim = this._s("number", "charge_limit")?.attributes || {};
    switch (a) {
      case "unlock":
        // Unlocking a car from a dashboard takes two taps
        confirmTap(this, "unlock", { run: () => this._call("lock", "unlock", "lock"), render: () => this._redraw() });
        return;
      case "lock": return this._call("lock", "lock", "lock");
      case "wake": return this._hass.callService("button", "press", { entity_id: this._id("button", "wake") });
      case "climate_on": return this._call("climate", "turn_on", "climate");
      case "climate_off": return this._call("climate", "turn_off", "climate");
      case "cooler": case "warmer": {
        const step = a === "cooler" ? -1 : 1;
        // Taps add up on screen and go out as one call once they stop
        const next = Math.max(clim.min_temp ?? 59, Math.min(clim.max_temp ?? 82.5, Math.round((clim.temperature ?? 70) + step)));
        const id = this._id("climate", "climate");
        pending(this).set(id, { attrs: { temperature: next } }, { ttl: 30000 });
        return pending(this).later(id, 700, () => this._call("climate", "set_temperature", "climate", { temperature: next }));
      }
      case "limit_down": case "limit_up": {
        if (limit == null) return;
        const next = Math.max(lim.min ?? 50, Math.min(lim.max ?? 100, Math.round(limit / 5) * 5 + (a === "limit_up" ? 5 : -5)));
        const id = this._id("number", "charge_limit");
        pending(this).set(id, { state: String(next) }, { ttl: 30000 });
        return pending(this).later(id, 700, () => this._hass.callService("number", "set_value", { entity_id: id, value: next }));
      }
      case "charge_start": return this._call("switch", "turn_on", "charge");
      case "charge_stop": return this._call("switch", "turn_off", "charge");
      case "sentry": return this._call("switch", "toggle", "sentry_mode");
      case "play_pause": return this._call("media_player", "media_play_pause", "media_player");
      case "next": return this._call("media_player", "media_next_track", "media_player");
    }
  }

  _wire() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); this._act(el.dataset.act); }));
    root.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", (ev) => { ev.stopPropagation(); this._more(el.dataset.more); }));
    // Every tile: hold opens its details. Tap does the tile's one safe, obvious thing where it has
    // one (sentry on/off, play/pause while music is on); otherwise tap opens the details too.
    const id = (d, k) => this._id(d, k);
    const tiles = {
      hero: { more: id("lock", "lock") },
      body: { more: id("lock", "lock") },
      clim: { more: id("climate", "climate") },
      chg: { more: id("sensor", "charging") },
      sen: { more: id("switch", "sentry_mode"), tap: () => this._s("switch", "sentry_mode") && this._st("switch", "sentry_mode") !== "unavailable" ? this._act("sentry") : this._more(id("switch", "sentry_mode")) },
      mus: { more: id("media_player", "media_player"), tap: () => ["playing", "paused"].includes(this._st("media_player", "media_player")) ? this._act("play_pause") : this._more(id("media_player", "media_player")) },
    };
    root.querySelectorAll(".tile[data-tile]").forEach((el) => {
      const t = tiles[el.dataset.tile];
      if (t) bindTap(el, { tap: t.tap || (() => this._more(t.more)), hold: () => this._more(t.more) });
    });
  }
}

// Only what is the car's own; tiles, pills, the bar and the tag come from bento-core
const CAR_CSS = `
  :host { font-family: var(--b-body); }
  .title { white-space: nowrap; }
  .grid { display: grid; gap: var(--b-gap); grid-auto-rows: minmax(var(--b-row), auto); }
  .grid.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-areas: "hero hero body body" "hero hero body body" "clim clim chg chg" "sen sen mus mus"; }
  .grid.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "hero hero" "hero hero" "body body" "body body" "clim clim" "chg chg" "sen mus"; }
  /* Eyebrow, then the picture, then the words (the car drawing) */
  .tile.has-viz { grid-template-rows: auto 1fr auto auto; }
  .viz { align-self: center; min-width: 0; }
  .has-viz .txt { align-self: start; }
  .hero .say { font-size: 2.1em; line-height: 1.02; }
  .clim .say { font-size: 1.9em; }
  :host(.is-night) .mus.on .pill, .mus.on .pill { background: var(--b-pill-bg-night); }
  /* Battery: now, the stripe it would fill to, and the limit line (the bar itself is bento-core's) */
  .cends { display: flex; justify-content: space-between; gap: var(--b-s-sm); font-size: 0.86em; font-weight: 600; }
  .cends b { font-family: var(--b-display); font-weight: 800; }
  .cends .to { opacity: .75; text-align: right; }
  /* The car from above */
  .car { width: 100%; max-height: 160px; display: block; overflow: visible; }
  .car .shell { fill: currentColor; fill-opacity: .07; stroke: currentColor; stroke-opacity: .42; stroke-width: 1.6; }
  .car .tire { fill: currentColor; opacity: .3; }
  .car .glass { fill: currentColor; fill-opacity: .2; }
  .car .glass.vent { fill-opacity: .3; }
  .car .seam { fill: none; stroke: var(--bg); stroke-width: 2.4; }
  .car .mirror { fill: currentColor; opacity: .35; }
  .car .light { fill: none; stroke: currentColor; stroke-opacity: .4; stroke-width: 2.2; stroke-linecap: round; }
  .car .part { cursor: pointer; }
  .car .cut { fill: none; stroke: currentColor; stroke-opacity: .32; stroke-width: 1.1; }
  .car .part path, .car .part rect { fill: currentColor; fill-opacity: .03; stroke: currentColor; stroke-opacity: .24; stroke-width: 1; transition: fill var(--b-t-quick) ease; }
  /* Closed doors and windows stay invisible (but tappable); only what's open shows */
  .car .part.door:not(.open) path, .car .part.win:not(.open) path { fill-opacity: 0; stroke-opacity: 0; }
  .car .part.open path, .car .part.open rect { fill: var(--accent); fill-opacity: 1; stroke: var(--accent); stroke-opacity: 1; }
  .car .part.unk path, .car .part.unk rect { fill: none; stroke-opacity: .55; stroke-dasharray: 3 3; }
  .car .part.gone { display: none; }
`;

customElements.define("bento-car", BentoCar);
window.customCards = window.customCards || [];
window.customCards.push({ type: "bento-car", name: "Bento car", description: "A Tesla as bento tiles: battery, doors and trunks from above, cabin, charging, sentry and music." });
console.info(`%c BENTO CAR %c ${BENTO_CAR_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
