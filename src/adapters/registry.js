// Turning an entity into a tile. Each kind of device has an adapter:
//
//   registerTile(domains, {
//     shape(s, ctx) → "S" | "W" | …     its tile when the config doesn't say
//     isOn(s) → bool                    on things wear colour, off things go neutral
//     tone(s, on, ctx) → colours        optional; default by kind (see toneFor)
//     build(e, s, ctx) → descriptor     what the tile says and carries (see tile/tile.js)
//     watch(e, ctx) → [ids]             optional; entities beyond e.entity it reads
//   })
//
// ctx = { hass, night, cols, config, card, series(viz), manual(eid) }. card.call() and
// card.callEntity() go through the card's pending store; card.more(id) opens details.
// Config entries that aren't one entity (bars, adaptive, board, strip) have their own
// adapters, picked by key.
import { tone, offTone, roomTone, lightTone } from "../core/tones.js";
import { domainOf } from "../data/entities.js";

const BY_DOMAIN = new Map();
const BY_KEY = new Map();

export function registerTile(domains, adapter) { for (const d of [].concat(domains)) BY_DOMAIN.set(d, adapter); }
export function registerForm(key, adapter) { BY_KEY.set(key, adapter); }

// The adapter for a config entry: a form by its key, else the entity's domain
export function adapterFor(e) {
  for (const [k, a] of BY_KEY) if (e[k] != null) return { form: k, adapter: a };
  return { form: "entity", adapter: BY_DOMAIN.get(domainOf(e.entity)) || BY_DOMAIN.get("*") };
}

export const TOGGLE = new Set(["light", "switch", "fan", "input_boolean"]);
export const VALUE = new Set(["select", "input_select", "number", "input_number", "text", "input_text", "time", "date", "datetime", "input_datetime"]);
export const offline = (s) => s.state === "unavailable";

export function isOn(s) {
  const d = domainOf(s.entity_id), st = s.state;
  if (st === "unavailable" || st === "unknown") return false;
  if (d === "media_player") return ["playing", "paused", "on", "buffering"].includes(st);
  if (d === "climate") return st !== "off";
  if (d === "lock") return ["unlocked", "open", "jammed"].includes(st);
  if (d === "vacuum") return st === "cleaning" || st === "returning";
  if (d === "sensor" || d === "scene" || d === "script" || VALUE.has(d)) return true;
  return st === "on";
}

// Colours by kind: a light wears its own colour, a switch in a room wears the room's,
// everything else its tone; anything off goes neutral
export function toneFor(s, on, ctx) {
  const d = domainOf(s.entity_id), dc = s.attributes.device_class, n = ctx.night, c = ctx.config;
  if (!on) return offTone(n);
  if (d === "light") return lightTone(s.attributes, n);
  if (c.room_tone != null && TOGGLE.has(d)) return { ...roomTone(c.room_tone, n, true), accent: tone("act", n).accent };
  if (c.tone) return tone(c.tone, n);
  if (d === "media_player") return tone("media", n);
  if (d === "climate") return tone("climate", n);
  if (d === "lock" || d === "binary_sensor") return tone("act", n);
  if (d === "scene" || d === "script") return tone("scenes", n);
  if (d === "sensor") return tone(dc === "power" || dc === "energy" || dc === "humidity" ? "energy" : dc === "monetary" ? "money" : dc === "battery" ? "health" : "climate", n);
  return tone("today", n);
}
