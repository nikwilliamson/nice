// Reading the registries: what an entity is called, which room it's in, what's in a room.
import { dashboardPath } from "../core/nav.js";

export const domainOf = (id) => id.split(".")[0];

// A device's main entity is often just "Light" or "Contact"; the real name is on the device
const GENERIC = /^(light|lights|lamp|switch|plug|outlet|contact|door|window|motion|occupancy|sensor|fan|lock|speaker)(\s+\d+)?$/i;
// "Living Room Floor Lights" reads "Floor lights" on the Living Room page, but "Kitchen
// Light" stays whole rather than shrinking to "Light"
export function nameOf(hass, s, strip) {
  let n = String(s.attributes.friendly_name || s.entity_id).replace(/^\[[^\]]*\]\s*/, "").trim();
  if (GENERIC.test(n)) {
    const dev = hass.devices?.[hass.entities?.[s.entity_id]?.device_id];
    const dn = dev && (dev.name_by_user || dev.name);
    if (dn) n = dn;
  }
  n = n.replace(/\s+(power minute average|current consumption|power)$/i, "");
  let short = n;
  for (const p of [].concat(strip || [])) {
    const low = String(p).toLowerCase();
    while (low && short.toLowerCase().startsWith(low + " ")) short = short.slice(low.length + 1);
  }
  if (short && !(GENERIC.test(short) && !/\d/.test(short))) n = short;
  return n.charAt(0).toUpperCase() + n.slice(1) || s.entity_id;
}

export function areaOf(hass, eid) {
  const e = hass.entities?.[eid];
  if (!e) return null;
  return e.area_id || hass.devices?.[e.device_id]?.area_id || null;
}
export const roomName = (hass, id) => hass.areas?.[id]?.name || id.replace(/_/g, " ");

// A plug's draw, when the plug has a power sensor beside it on the same device
export function powerOf(hass, eid) {
  const dev = hass.entities?.[eid]?.device_id;
  if (!dev) return null;
  const p = Object.keys(hass.states).find((id) => id.startsWith("sensor.") && hass.entities?.[id]?.device_id === dev && hass.states[id].attributes.device_class === "power");
  const v = p ? parseFloat(hass.states[p].state) : NaN;
  return Number.isNaN(v) ? null : v;
}

// The newest change across a device's own entities (object ids starting with prefix). The
// browser only sees when a value last changed, not when it was polled.
export function newestChange(hass, prefix) {
  return Object.keys(hass.states).filter((e) => {
    const [d, o] = e.split(".");
    const st = hass.states[e].state;
    return o.startsWith(prefix) && !["update", "button"].includes(d) && st !== "unknown" && st !== "unavailable";
  }).reduce((m, e) => (hass.states[e].last_updated > m ? hass.states[e].last_updated : m), "");
}

function isLightGroup(hass, eid) {
  const st = hass.states[eid], reg = hass.entities?.[eid];
  return !!(st?.attributes?.is_hue_group || Array.isArray(st?.attributes?.entity_id) || (reg?.labels || []).includes("lighting"));
}
const CAR_MEDIA = /_s_car_/;

// Everything a room card needs, read the same way everywhere so the grid and the page
// never disagree about how many lights are on
export function readRoom(hass, areaId) {
  const ids = Object.keys(hass.states).filter((eid) => {
    const reg = hass.entities?.[eid];
    return reg && !reg.hidden && !reg.entity_category && areaOf(hass, eid) === areaId;
  });
  const of = (d) => ids.filter((e) => e.startsWith(d + "."));
  const usable = (e) => hass.states[e].state !== "unavailable";
  let lights = of("light").filter((e) => !isLightGroup(hass, e) && usable(e));
  // Some rooms only expose their lights as a group; count the group rather than nothing
  if (!lights.length) lights = of("light").filter((e) => isLightGroup(hass, e) && usable(e));
  const on = lights.filter((e) => hass.states[e].state === "on");
  const temps = of("sensor").filter((e) => hass.states[e].attributes.device_class === "temperature" && !/inside|target/.test(e) && !Number.isNaN(parseFloat(hass.states[e].state)));
  temps.sort((a, b) => (/_temp_sensor_/.test(b) ? 1 : 0) - (/_temp_sensor_/.test(a) ? 1 : 0));
  const playing = of("media_player").filter((e) => !CAR_MEDIA.test(e) && hass.states[e].state === "playing");
  const locks = of("lock");
  const unlocked = locks.filter((e) => hass.states[e].state === "unlocked");
  const lockOffline = locks.filter((e) => hass.states[e].state === "unavailable");
  const open = of("binary_sensor").filter((e) => ["door", "window"].includes(hass.states[e].attributes.device_class) && hass.states[e].state === "on");
  const scenes = of("scene");
  const temp = temps.length ? Math.round(parseFloat(hass.states[temps[0]].state)) : null;
  return { ids, lights, on, temp, temps, playing, unlocked, lockOffline, open, scenes };
}

// The dashboard's room list: the first nice-rooms card on the dashboard that lists areas.
// Fetched once per dashboard; resolves to { areas, adaptive } or null.
const ROOM_LISTS = new Map();
function findRooms(node) {
  if (Array.isArray(node)) { for (const n of node) { const r = findRooms(n); if (r) return r; } return null; }
  if (!node || typeof node !== "object") return null;
  if (node.type === "custom:nice-rooms" && Array.isArray(node.areas) && node.areas.length) return { areas: node.areas, adaptive: node.adaptive || {} };
  for (const k of Object.keys(node)) { const r = findRooms(node[k]); if (r) return r; }
  return null;
}
export function roomList(hass, basePath) {
  const path = dashboardPath(basePath);
  if (!ROOM_LISTS.has(path)) {
    ROOM_LISTS.set(path, hass.callWS({ type: "lovelace/config", url_path: path === "lovelace" ? null : path })
      .then((cfg) => findRooms(cfg))
      .catch(() => { setTimeout(() => ROOM_LISTS.delete(path), 60000); return null; }));
  }
  return ROOM_LISTS.get(path);
}
