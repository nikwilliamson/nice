import { test } from "node:test";
import assert from "node:assert/strict";
import { closePairs, weakInk, tileTones, contrast, distance } from "../scripts/tones-audit.mjs";
import { color, paint, TONES, RAMPS, STEPS } from "../src/core/palette.js";
import T from "../src/tokens.json" with { type: "json" };

// What the palette accepts today: these may stay; nothing new may join them.
const KNOWN_CLOSE = {
  day: ["health~muted", "car~litter", "health~off", "muted~off", "scenes~litter", "car~trash"],
  night: ["health~muted", "health~off", "muted~off"],
};
const KNOWN_WEAK = ["hazard day", "hazard night", "power night", "plan day", "media day", "water day", "timer day", "sentry day"];

test("colour maths", () => {
  assert.equal(contrast("#ffffff", "#000000").toFixed(0), "21");
  assert.equal(distance("#123456", "#123456"), 0);
  assert.equal(color("white"), "#ffffff");
  assert.equal(color([1, 0, 0]), "#ffffff");
  assert.equal(color("rgba(255,255,255,.22)"), "rgba(255,255,255,.22)");
});

test("every ramp has every step, and every colour a tone names exists", () => {
  for (const r of RAMPS) assert.equal(T.palette[r].length, STEPS.length, r);
  const named = (ref) => Array.isArray(ref) || ["white", "black"].includes(ref) || ref.startsWith("rgba(") || /^([a-z]+)-(\d+)$/.test(ref) && RAMPS.includes(ref.split("-")[0]) && STEPS.includes(+ref.split("-")[1]);
  for (const k of TONES) for (const w of ["day", "night"]) for (const ref of T.tones[k][w]) assert.ok(named(ref), `${k} ${w}: ${ref}`);
  for (const w of ["day", "night"]) for (const ref of T.room[w]) assert.ok(named(ref), `room ${w}: ${ref}`);
  assert.match(paint("hazard", false).bg, /^#[0-9a-f]{6}$/);
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

test("every tone a rule or card names exists", () => {
  const tones = tileTones();
  assert.ok(Object.keys(tones).length > 30, "the rules parsed");
  for (const [tile, names] of Object.entries(tones)) for (const n of names) assert.ok(n in T.tones || n === "off", `${tile}: ${n}`);
});
