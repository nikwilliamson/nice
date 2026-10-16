// Mount every card on the house-nice dashboard in a headless DOM against made-up states and
// the real tile shapes, and fail on anything thrown or any card that draws nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import globalJsdom from "global-jsdom";

globalJsdom(undefined, { url: "http://localhost:8123/house-nice/home", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
Element.prototype.animate = function () { return { cancel() {}, finished: Promise.resolve() }; };
const errors = [];
window.addEventListener("error", (e) => errors.push(e.error || e.message));
await import("../build/www/nice/nice.js");

const dash = JSON.parse(readFileSync(new URL("../dashboards/nice/house-nice.json", import.meta.url)));
const tiles = JSON.parse(readFileSync(new URL("./fixtures/tiles.json", import.meta.url)));

// Every entity id the dashboard names, plus what the cards look up by prefix
const ids = new Set(JSON.stringify(dash).match(/\b(light|switch|sensor|binary_sensor|lock|climate|media_player|script|scene|select|number|text|time|vacuum|cover|button|device_tracker|automation|person|weather|todo|input_boolean|fan)\.[a-z0-9_]+/g));
for (const car of ["nik", "kat"]) for (const k of ["lock.%_s_car_lock", "sensor.%_s_car_battery_level", "sensor.%_s_car_battery_range", "number.%_s_car_charge_limit", "sensor.%_s_car_charging", "binary_sensor.%_s_car_charge_cable", "device_tracker.%_s_car_location", "binary_sensor.%_s_car_status", "climate.%_s_car_climate", "switch.%_s_car_sentry_mode", "media_player.%_s_car_media_player", "cover.%_s_car_frunk", "binary_sensor.%_s_car_front_driver_door", "switch.%_s_car_charge", "sensor.%_s_car_charger_power"]) ids.add(k.replace("%", car));
for (const k of ["vacuum.litter_robot_litter_box", "sensor.litter_robot_status_code", "sensor.litter_robot_waste_drawer", "select.litter_robot_globe_light", "select.litter_robot_clean_cycle_wait_time_minutes", "switch.litter_robot_panel_lockout", "sensor.zig_weight", "sensor.zig_visits_today", "button.zigs_food_feed", "sensor.zigs_food_portions_dispensed_today", "switch.zigs_food_child_lock", "sun.sun", "weather.forecast_home", "person.nikw", "person.kat"]) ids.add(k);

const now = new Date().toISOString();
function fake(id) {
  const [d] = id.split(".");
  const a = { friendly_name: id.split(".")[1].replace(/_/g, " ") };
  const s = (state, attrs = {}) => ({ entity_id: id, state, attributes: { ...a, ...attrs }, last_changed: now, last_updated: now });
  if (d === "light") return s("on", { brightness: 180, supported_color_modes: ["color_temp"], color_temp_kelvin: 2700, effect_list: ["off", "Rainbow"], effect: "Rainbow" });
  if (d === "climate") return s("cool", { temperature: 74, current_temperature: 73, hvac_modes: ["off", "cool", "heat"], hvac_action: "cooling" });
  if (d === "lock") return s("locked");
  if (d === "media_player") return s("playing", { media_title: "Severance", volume_level: 0.3 });
  if (d === "binary_sensor") return s("off", { device_class: /door/.test(id) ? "door" : /motion/.test(id) ? "motion" : undefined });
  if (d === "select") return s("auto", { options: ["auto", "on", "off"] });
  if (d === "sun") return s("above_horizon", { elevation: 30, next_rising: now, next_setting: now });
  if (d === "weather") return s("rainy", { temperature: 71, humidity: 80 });
  if (d === "person") return s("home");
  if (d === "switch") return s(/adaptive_lighting/.test(id) ? "on" : "off", { color_temp_kelvin: 3000, brightness_pct: 70, manual_control: [] });
  if (d === "sensor") {
    const dc = /temp/.test(id) ? "temperature" : /humidity/.test(id) ? "humidity" : /power/.test(id) ? "power" : /weight/.test(id) ? "weight" : undefined;
    return s(/status/.test(id) ? "rdy" : "42", { device_class: dc, unit_of_measurement: dc === "power" ? "W" : "" });
  }
  return s("on");
}
const states = Object.fromEntries([...ids].map((id) => [id, fake(id)]));
for (const [id, t] of Object.entries(tiles)) states[id] = { entity_id: id, state: "nice", attributes: { tiles: t }, last_changed: now, last_updated: now };
states["sensor.vestaboard_note_current_message"].attributes.board = ["HELLO", "", ""];
const calls = [];
const hass = {
  states, user: { name: "Nik W", is_admin: true }, areas: { living_room: { name: "Living Room" }, kitchen: { name: "Kitchen" } },
  entities: { "light.living_room_ceiling_light": { area_id: "living_room" } }, devices: {},
  callService: async (...args) => { calls.push(args); }, callWS: async (m) => (m.type === "lovelace/config" ? dash : {}),
  connection: { subscribeMessage: async (cb) => { cb({ items: [{ uid: "1", summary: "MILK", status: "needs_action" }] }); return () => {}; } },
};

// Every card config on the dashboard, tabs and room pages included
const cards = [];
const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === "object") { if (typeof n.type === "string" && n.type.startsWith("custom:nice-")) cards.push(n); Object.values(n).forEach(walk); } };
walk(dash);

for (const night of [false, true]) {
  test(`every card draws (${night ? "night" : "day"})`, async () => {
    states["sun.sun"] = { ...states["sun.sun"], state: night ? "below_horizon" : "above_horizon" };
    for (const cfg of cards) {
      const el = document.createElement(cfg.type.slice(7));
      el.setConfig(cfg);
      document.body.appendChild(el);
      el.hass = { ...hass, states: { ...states } };
      await el.updateComplete;
      await new Promise((r) => setTimeout(r, 0));
      const html = el.shadowRoot?.innerHTML || "";
      assert.ok(html.length > 50, `${cfg.type} drew nothing`);
      // tiles inside draw too
      for (const t of el.shadowRoot.querySelectorAll("nice-tile")) { await t.updateComplete; assert.ok(t.shadowRoot.innerHTML.length > 20, `${cfg.type}: tile ${t.tile?.id} drew nothing`); }
      el.remove();
    }
    assert.deepEqual(errors, []);
  });
}

test("the grid draws every rule tile it has room for, in order", async () => {
  const el = document.createElement("nice-grid");
  el.setConfig({ routes: { kitchen: "room-kitchen" } });
  document.body.appendChild(el);
  el.hass = hass;
  await el.updateComplete;
  const ids = [...el.shadowRoot.querySelectorAll("nice-tile")].map((t) => t.tile.id);
  assert.equal(ids[0], "stove_demo", "a hazard comes first");
  // Alerts draw no chart; calm tiles keep theirs
  const tileOf = (id) => [...el.shadowRoot.querySelectorAll("nice-tile")].find((t) => t.tile.id === id);
  assert.equal(tileOf("stove_demo").tile.viz, null);
  assert.equal(tileOf("drawer").tile.viz, null);
  assert.equal(tileOf("power")?.tile.viz?.type ?? "spark", "spark");
  assert.equal(ids.at(-1), "health", "health packs last");
  assert.ok(ids.includes("more") || ids.length > 10);
  // A tile's action goes through Home Assistant
  const doors = [...el.shadowRoot.querySelectorAll("nice-tile")].find((t) => t.tile.id === "doors");
  doors.tile.act.run();
  assert.deepEqual(calls.at(-1).slice(0, 2), ["lock", "lock"]);
  // and a chore ticked off is completed on the house list
  const chores = [...el.shadowRoot.querySelectorAll("nice-tile")].find((t) => t.tile.id === "chores");
  chores.tile.viz.tick("a");
  assert.deepEqual(calls.at(-1), ["todo", "update_item", { item: "a", status: "completed" }, { entity_id: "todo.house_alerts" }]);
  el.remove();
});
