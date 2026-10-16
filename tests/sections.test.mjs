import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, entityIds } from "../src/cards/room-sections.js";

test("a room page's old map becomes the list, in the page's order", () => {
  const out = normalize({
    _0: { title: "", before: "Lights", entities: [{ board: "sensor.vb" }] },
    Lights: { entities: ["light.a"] },
    Scenes: { entities: ["script.b"], all: false },
    Climate: { hide: true },
    Vestaboard: { after: "Scenes", entities: ["switch.v"] },
    Power: { entities: [{ bars: ["sensor.p"] }], room_tone: null },
  });
  assert.deepEqual(out.map((s) => s.title), ["", "Lights", "Scenes", "Vestaboard", "Power"]);
  assert.equal(out[2].all, false);
  assert.equal(out[4].room_tone, null);
  assert.ok(out.every((s) => !("after" in s) && !("before" in s) && !("hide" in s)));
});

test("the list is kept as written; empty sections drop out", () => {
  const list = [{ title: "B", entities: ["x.1"] }, { title: "A", entities: [] }];
  assert.deepEqual(normalize(list).map((s) => s.title), ["B"]);
});

test("entityIds sees every kind of entry", () => {
  const ids = entityIds([{ entities: ["light.a", { entity: "light.b" }, { strip: "light.c" }, { adaptive: "switch.d" }, { board: "sensor.e" }, { bars: ["sensor.f", { entity: "sensor.g" }] }] }]);
  assert.deepEqual([...ids].sort(), ["light.a", "light.b", "light.c", "sensor.e", "sensor.f", "sensor.g", "switch.d"]);
});
