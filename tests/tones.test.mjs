import { test } from "node:test";
import assert from "node:assert/strict";
import { closePairs, weakInk, tileTones, contrast, distance } from "../scripts/tones-audit.mjs";
import T from "../src/tokens.json" with { type: "json" };

// What the palette gets wrong today. The retone empties these lists; nothing new may join them.
const KNOWN_CLOSE = {
  day: ["act~room0", "today~room1", "car~room6", "climate~room2", "cats~room5", "energy~room4", "scenes~room7", "health~muted",
    "car~litter", "litter~room6", "health~off", "muted~off", "scenes~litter", "litter~room7", "car~trash", "trash~room6", "trash~litter",
    "car~scenes", "car~room7", "scenes~room6", "room6~room7", "energy~recycling", "recycling~room4", "cats~room3", "energy~health",
    "energy~muted", "health~room4", "muted~room4", "room3~room5", "climate~recycling", "recycling~room2", "today~money", "energy~off",
    "money~room1", "room4~off", "scenes~trash", "recycling~off", "trash~room7", "act~room3", "room0~room3"],
  night: ["act~room0", "today~room1", "car~room6", "climate~room2", "cats~room5", "energy~room4", "scenes~room7", "health~muted",
    "health~off", "muted~off", "festive~trash"],
};
const KNOWN_WEAK = ["hazard day", "hazard night", "today night", "plan day", "media day", "water day", "timer day", "timer night"];

test("colour maths", () => {
  assert.equal(contrast("#ffffff", "#000000").toFixed(0), "21");
  assert.equal(distance("#123456", "#123456"), 0);
});

for (const when of ["day", "night"]) {
  test(`no new look-alike fills (${when})`, () => {
    const fresh = closePairs(when === "night").map((p) => `${p.a}~${p.b}`).filter((k) => !KNOWN_CLOSE[when].includes(k));
    assert.deepEqual(fresh, []);
  });
}

test("no new ink that fails 4.5:1", () => {
  assert.deepEqual(weakInk().map((w) => `${w.tone} ${w.when}`).filter((k) => !KNOWN_WEAK.includes(k)), []);
});

test("every tone a rule names exists", () => {
  const tones = tileTones();
  assert.ok(Object.keys(tones).length > 30, "the rules parsed");
  for (const [tile, names] of Object.entries(tones)) for (const n of names) assert.ok(n in T.tones, `${tile}: ${n}`);
});
