import { test } from "node:test";
import assert from "node:assert/strict";
import { sentence, words, power, duration, num, quiet } from "../src/core/format.js";
import { bucket, smoothed } from "../src/data/history.js";

test("house words", () => {
  assert.equal(sentence("UNLOAD THE DISHWASHER."), "Unload the dishwasher");
  assert.equal(words("power_off"), "Power off");
  assert.equal(words("Party"), "Party");
  assert.equal(power(950), "950 W");
  assert.equal(power(4400), "4.4 kW");
  assert.equal(duration(90, "min"), "1 hr 30 min");
  assert.equal(duration(30, "s"), "30 s");
  assert.equal(num("3.5"), 3.5);
  assert.equal(num("unknown"), null);
  assert.ok(quiet("unavailable") && quiet(undefined) && !quiet("0"));
});

test("bucket carries the last value forward and averages within a bucket", () => {
  const rows = [{ t: 0, v: 10 }, { t: 5, v: 20 }, { t: 25, v: 40 }];
  // 0–10 averages 10 and 20; 10–20 has nothing new, so it carries 20 forward
  assert.deepEqual(bucket(rows, 0, 40, 4), [15, 20, 40, 40]);
  assert.deepEqual(smoothed([0, 3, 0]), [1, 1, 1]);
});

test("a room's lights count bulbs, hidden ones too, not the groups over them", async () => {
  const { readRoom } = await import("../src/data/entities.js");
  const st = (state, attributes = {}) => ({ state, attributes });
  const hass = {
    states: { "light.k1": st("on"), "light.k2": st("on"), "light.k3": st("off"), "light.lamp": st("on"),
      "light.k_group": st("on", { entity_id: ["light.k1", "light.k2", "light.k3"] }), "light.hue_room": st("on", { is_hue_group: true }),
      "light.gone": st("unavailable"), "light.elsewhere": st("on") },
    entities: { "light.k1": { area_id: "kitchen", hidden: true }, "light.k2": { area_id: "kitchen", hidden: true }, "light.k3": { area_id: "kitchen", hidden: true },
      "light.lamp": { area_id: "kitchen" }, "light.k_group": { area_id: "kitchen" }, "light.hue_room": { area_id: "kitchen" },
      "light.gone": { area_id: "kitchen" }, "light.elsewhere": { area_id: "bedroom" } },
  };
  const r = readRoom(hass, "kitchen");
  assert.deepEqual(r.lights.sort(), ["light.k1", "light.k2", "light.k3", "light.lamp"]);
  assert.equal(r.on.length, 3);
  assert.ok(!r.ids.includes("light.k1"), "hidden bulbs still stay off the room's other lists");
});
