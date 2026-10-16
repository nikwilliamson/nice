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
