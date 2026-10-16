import { test } from "node:test";
import assert from "node:assert/strict";
import { pack, bestPack, choose, ordered, cells } from "../src/layout/pack.js";

const t = (id, shape, tier = 3, extra = {}) => ({ id, shape, tier, ...extra });
const area = (tiles) => tiles.reduce((n, x) => n + x.w * x.h, 0);

test("pack places first-fit and always ends on clean rows", () => {
  const { tiles } = pack([t("a", "L"), t("b", "S"), t("c", "W"), t("d", "S")], 4);
  const rows = Math.max(...tiles.map((x) => x.r + x.h));
  assert.equal(area(tiles), rows * 4, "no holes once filled");
  assert.deepEqual(tiles.find((x) => x.id === "a"), { ...t("a", "L"), r: 0, c: 0, w: 2, h: 2 });
});

test("full-row shapes fill whatever the row is", () => {
  for (const cols of [2, 3, 4]) {
    const { tiles } = pack([t("f", "F"), t("fl", "FL")], cols);
    assert.equal(tiles[0].w, cols);
    assert.equal(tiles[1].w, cols);
    assert.equal(tiles[1].h, 2);
  }
});

test("bestPack keeps health last and only adds a filler that closes a hole", () => {
  const tiles = [t("x", "W", 1), t("health", "S", 4), t("fill", "S", 3, { filler: true })];
  const out = bestPack(tiles, 4);
  const last = out.reduce((m, x) => (x.r * 10 + x.c > m.r * 10 + m.c ? x : m));
  assert.equal(last.id, "health");
  assert.ok(out.some((x) => x.id === "fill"), "the filler closes the row's hole");
  const full = bestPack([t("a", "W"), t("b", "W"), t("fill", "S", 3, { filler: true })], 4);
  assert.ok(!full.some((x) => x.id === "fill"), "no hole, no filler");
});

test("choose folds today into 'N more' past the budget, and keeps hazards", () => {
  const tiles = [t("haz", "F", 0), ...Array.from({ length: 10 }, (_, i) => t(`d${i}`, "W", 2)), t("health", "S", 4)];
  const out = choose(tiles, 20);
  assert.ok(out.some((x) => x.id === "haz"));
  assert.ok(out.some((x) => x.id === "more"));
  assert.ok(out.reduce((n, x) => n + cells(x.shape), 0) <= 20);
  assert.equal(out[out.length - 1].id, "health");
});

test("choose shows one large ambient tile at a time", () => {
  const out = choose([t("a", "L"), t("b", "L")], 20);
  assert.deepEqual(out.map((x) => x.shape), ["L", "W"]);
});

test("a tall list with one item goes wide", () => {
  const out = choose([t("chores", "T", 2, { viz: { type: "list", items: [{ uid: 1 }] } })]);
  assert.equal(out[0].shape, "W");
});

test("ordered sorts by tier, then order, then id", () => {
  const out = ordered([t("b", "S", 3, { order: 1 }), t("a", "S", 3, { order: 1 }), t("z", "S", 0, { order: 9 })]);
  assert.deepEqual(out.map((x) => x.id), ["z", "a", "b"]);
});

test("choose shows at least min tiles, growing past the budget", () => {
  const wide = Array.from({ length: 14 }, (_, i) => t(`w${i}`, "W"));   // 2 cells each: 10 fit in 20
  assert.equal(choose(wide, 20).length, 10);
  assert.equal(choose(wide, 20, 11).length, 11);
});

test("fillers become tiles when nothing else is left to reach min", () => {
  const out = choose([t("a", "S"), t("f1", "S", 3, { filler: true }), t("f2", "S", 3, { filler: true })], 20, 3);
  assert.equal(out.filter((x) => !x.filler).length, 3);
});
