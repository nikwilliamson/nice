// Bento pending - optimistic state for bento cards. Imported by each card with its own ?v=.
//
// A tap shows its result straight away; Home Assistant catches up. Each card keeps one
// Pending store and draws from pending(card).view(hass): the real states with every change
// it is waiting on laid over them. A change is dropped once Home Assistant reports it
// (done(state), by default "state and attributes match"), or after ttl if it never does,
// so a refused change falls back to the truth instead of sticking.
//
// Steppers debounce: later() holds the change on screen and sends one call once taps stop,
// so five quick taps on + make one call for +5, not five calls racing each other.
//
// In a card:
//   set hass(hass) { hass = this._hass = pending(this).take(hass); ... }
//   tap: pending(this).set(eid, { state: "on" }); this._hass.callService(...)
//   step: pending(this).set(eid, { attrs: { temperature: next } }); pending(this).later(eid, 700, () => call(next))
export const BENTO_PENDING_VERSION = "1.0.0";

// Numbers match within rounding (brightness_pct 50 comes back as 128 of 255)
const same = (a, b) => {
  const x = typeof a === "string" ? parseFloat(a) : a, y = typeof b === "string" ? parseFloat(b) : b;
  if (typeof x === "number" && typeof y === "number" && !Number.isNaN(x) && !Number.isNaN(y)) return Math.abs(x - y) <= Math.max(0.51, Math.abs(y) * 0.01);
  return JSON.stringify(a) === JSON.stringify(b);
};

const VIEW = Symbol("bento-view");

class Pending {
  constructor(card) { this.card = card; this.items = new Map(); this.timers = new Map(); this.expiry = null; }

  // The card's hass setter calls this with whatever it was handed: Home Assistant's hass, or
  // (from a card's own "redraw now") a view this made earlier, which is swapped back for the
  // real one so a guess never gets mistaken for the truth
  take(hass) {
    if (hass && hass[VIEW]) hass = this.card._real;
    else this.card._real = hass;
    return this.view(hass);
  }
  // The states to draw: the real ones with every pending change laid over them
  view(hass) {
    this._settle(hass);
    if (!hass || !this.items.size) return hass;
    const states = { ...hass.states };
    for (const [eid, p] of this.items) {
      const s = states[eid];
      if (s) states[eid] = { ...s, state: p.state ?? s.state, attributes: { ...s.attributes, ...p.attrs } };
    }
    return { ...hass, states, [VIEW]: true };
  }

  // Show a change now. eid may be a list. opts.done(state) says when Home Assistant has caught
  // up (default: state and attributes match); opts.ttl how long to wait before giving up.
  set(eid, change, { ttl = 10000, done } = {}) {
    for (const id of [].concat(eid)) {
      const prev = this.items.get(id);
      const p = { state: change.state ?? prev?.state, attrs: { ...(prev?.attrs || {}), ...(change.attrs || {}) }, at: Date.now(), ttl, held: !!prev?.held };
      p.done = done || ((s) => (p.state == null || same(s.state, p.state)) && Object.entries(p.attrs).every(([k, v]) => same(s.attributes[k], v)));
      this.items.set(id, p);
    }
    this._arm();
    this.redraw();
  }
  get(eid) { return this.items.get(eid); }
  // What the card is showing for an entity right now
  state(eid) { return this.card._hass?.states?.[eid]; }

  // Hold eid's change on screen and send once taps stop for ms
  later(eid, ms, send) {
    const p = this.items.get(eid);
    if (p) p.held = true;
    clearTimeout(this.timers.get(eid));
    this.timers.set(eid, setTimeout(() => {
      this.timers.delete(eid);
      const q = this.items.get(eid);
      if (q) { q.held = false; q.at = Date.now(); }
      this._arm();
      send();
    }, ms));
  }

  // hass with a callService that shows its best guess first. Cards make their calls through this.
  wrap(hass) {
    return {
      ...hass,
      callService: (domain, service, data = {}, target) => {
        for (const id of [].concat(target?.entity_id ?? data?.entity_id ?? [])) {
          const g = guess(`${domain}.${service}`, this.state(id) || hass.states?.[id], data || {});
          if (g) this.set(id, g[0], g[1] || {});
        }
        return hass.callService(domain, service, data, target);
      },
    };
  }

  redraw() {
    const c = this.card;
    c._sig = null;
    if (c._real) c.hass = c._real;
  }

  _settle(hass) {
    const now = Date.now();
    for (const [eid, p] of this.items) {
      if (p.held) continue; // not sent yet
      const s = hass?.states?.[eid];
      if (!s || now - p.at > p.ttl || p.done(s)) this.items.delete(eid);
    }
  }
  // Redraw when the oldest change runs out, so a refused change doesn't sit there
  _arm() {
    clearTimeout(this.expiry);
    const next = Math.min(...[...this.items.values()].filter((p) => !p.held).map((p) => p.at + p.ttl));
    if (Number.isFinite(next)) this.expiry = setTimeout(() => this.redraw(), Math.max(0, next - Date.now()) + 50);
  }
}

export const pending = (card) => (card._pend ||= new Pending(card));
export const flip = (s) => (s?.state === "on" ? "off" : "on");

// What a service call will most likely leave an entity looking like: [change, opts] or null
// when there's no safe guess. Locks show "Locking"/"Unlocking" rather than claiming the result.
const ONOFF = new Set(["switch", "light", "fan", "input_boolean", "automation", "siren"]);
export function guess(svc, s, data = {}) {
  if (!s) return null;
  const [d, act] = svc.split(".");
  const kind = s.entity_id?.split(".")[0];
  if ((ONOFF.has(d) || (d === "homeassistant" && ONOFF.has(kind))) && ["toggle", "turn_on", "turn_off"].includes(act)) {
    if (act === "toggle" && s.state !== "on" && s.state !== "off") return null;
    const state = act === "toggle" ? flip(s) : act === "turn_on" ? "on" : "off";
    const attrs = {};
    if (state === "on" && data.brightness_pct != null) attrs.brightness = Math.round(data.brightness_pct * 2.55);
    return [{ state, attrs }];
  }
  const moved = (x) => x.state !== s.state;
  switch (svc) {
    case "lock.lock": return [{ state: "locking" }, { done: (x) => ["locked", "jammed"].includes(x.state) }];
    case "lock.unlock": return [{ state: "unlocking" }, { done: (x) => ["unlocked", "open", "jammed"].includes(x.state) }];
    case "media_player.media_play_pause": return s.state === "playing" || s.state === "paused" ? [{ state: s.state === "playing" ? "paused" : "playing" }] : null;
    case "media_player.media_play": return [{ state: "playing" }];
    case "media_player.media_pause": return [{ state: "paused" }];
    case "media_player.volume_set": return [{ attrs: { volume_level: data.volume_level } }];
    case "climate.set_hvac_mode": return [{ state: data.hvac_mode }];
    case "climate.turn_off": return [{ state: "off" }];
    case "climate.turn_on": return [{ state: (s.attributes?.hvac_modes || []).find((m) => m !== "off") || "on" }, { done: (x) => x.state !== "off" }];
    case "climate.set_temperature": return data.temperature != null ? [{ attrs: { temperature: data.temperature } }] : null;
    case "select.select_option": case "input_select.select_option": return [{ state: String(data.option) }];
    case "number.set_value": case "input_number.set_value": return [{ state: String(data.value) }];
    case "vacuum.start": return [{ state: "cleaning" }, { done: moved }];
    case "vacuum.return_to_base": return [{ state: "returning" }, { done: moved }];
    default: return null;
  }
}

console.info(`%c BENTO PENDING %c ${BENTO_PENDING_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
