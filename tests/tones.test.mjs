import { test } from "node:test";
import assert from "node:assert/strict";
import { closePairs, weakInk, tileTones, contrast, distance } from "../scripts/tones-audit.mjs";
import { FAMILIES, paint, family, weightOf } from "../src/core/palette.js";
import T from "../src/tokens.json" with { type: "json" };

test("colour maths", () => {
  assert.equal(contrast("#ffffff", "#000000").toFixed(0), "21");
  assert.equal(distance("#123456", "#123456"), 0);
});

for (const night of [false, true]) {
  test(`no two fills of one weight look alike (${night ? "night" : "day"})`, () => assert.deepEqual(closePairs(night), []));
}

test("every ink reads on its fill at 4.5:1", () => assert.deepEqual(weakInk(), []));

test("tier picks the weight; hazard is always solid", () => {
  assert.equal(weightOf("chores", 0), "solid");
  assert.equal(weightOf("chores", 1), "strong");
  assert.equal(weightOf("chores", 3), "soft");
  assert.equal(weightOf("chores", undefined), "soft");
  assert.equal(weightOf("hazard", 3), "solid");
  assert.notEqual(paint("water", false, 3).bg, paint("water", false, 0).bg);
});

test("old names land on their family; unknown ones go neutral", () => {
  assert.equal(family("today"), "chores");
  assert.equal(family("plans"), "plans");
  assert.equal(family("nonsense"), "system");
  for (const [k, v] of Object.entries(T.aliases)) if (k !== "_") assert.ok(FAMILIES.includes(v), `${k} → ${v}`);
});

test("every tone a rule or card names is a family or an old name", () => {
  const tones = tileTones();
  assert.ok(Object.keys(tones).length > 30, "the rules parsed");
  for (const [tile, names] of Object.entries(tones)) for (const n of names) assert.ok(n in T.families || n in T.aliases, `${tile}: ${n}`);
});
