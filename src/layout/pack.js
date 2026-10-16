// Packing tiles into the grid. Every Nice card lays out through here.
//
// Shapes are footprints in cells: S 1×1, W 2×1, T 1×2, L 2×2, F a full row, FL full and
// two rows. pack() places tiles first-fit on an explicit grid, then closes holes by
// widening the tile to their left (or lengthening the one above): CSS dense packing alone
// left ragged gaps once tall and wide tiles met. This always ends on clean rows.

export const SHAPES = { S: [1, 1], W: [2, 1], T: [1, 2], L: [2, 2], F: [4, 1], FL: [4, 2] };
export const cells = (s) => (SHAPES[s] || SHAPES.S)[0] * (SHAPES[s] || SHAPES.S)[1];

// Columns for a card's width: what most cards use
export const twoOrFour = (w) => (w && w < 560 ? 2 : 4);
export const twoThreeFour = (narrow = 420) => (w) => (w && w < narrow ? 2 : w && w < 760 ? 3 : 4);

// Full-row shapes fill whatever the row is
const footprint = (shape, cols) => {
  let [w, h] = SHAPES[shape] || SHAPES.S;
  if (shape === "F" || shape === "FL") w = cols;
  return [Math.min(w, cols), h];
};

// tiles: [{ shape, ... }] → { tiles: [{ ...tile, r, c, w, h }], holes, rows }
export function pack(tiles, cols, fill = true) {
  const occ = [];
  const free = (r, c, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (x >= cols || (occ[y] && occ[y][x])) return false; return true; };
  const take = (r, c, w, h, i) => { for (let y = r; y < r + h; y++) { occ[y] = occ[y] || []; for (let x = c; x < c + w; x++) occ[y][x] = i + 1; } };
  const out = tiles.map((t, i) => {
    const [w, h] = footprint(t.shape, cols);
    for (let r = 0; ; r++) for (let c = 0; c < cols; c++) if (free(r, c, w, h)) { take(r, c, w, h, i); return { ...t, r, c, w, h }; }
  });
  const rows = occ.length;
  let holes = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!(occ[r] && occ[r][c])) holes++;
  if (fill) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (occ[r] && occ[r][c]) continue;
      const left = c > 0 && occ[r]?.[c - 1] ? out[occ[r][c - 1] - 1] : null;
      const up = r > 0 && occ[r - 1]?.[c] ? out[occ[r - 1][c] - 1] : null;
      if (left && left.h === 1) { left.w += 1; take(r, c, 1, 1, occ[r][c - 1] - 1); }
      else if (up && up.w === 1) { up.h += 1; take(r, c, 1, 1, occ[r - 1][c] - 1); }
    }
  }
  return { tiles: out, holes, rows };
}

const strip = (tiles) => tiles.map(({ r, c, w, h, ...t }) => t);

// The landing grid's arrangement. Ambient tiles (tier 3) have no urgency order among
// themselves, so try a few orders of them and keep the one with fewest holes. Tiles whose
// id is in `last` (house health) always pack last. A filler goes in only if it closes a
// hole without adding a row.
export function bestPack(tiles, cols, { last = ["health"] } = {}) {
  const isLast = (t) => last.includes(t.id) || t.tier === 4;
  const fill = tiles.filter((t) => t.filler);
  const rest = tiles.filter((t) => !t.filler);
  const fixed = rest.filter((t) => t.tier !== 3 && !isLast(t)), amb = rest.filter((t) => t.tier === 3 && !isLast(t)), tail = rest.filter(isLast);
  const size = (t) => cells(t.shape);
  const orders = [amb, [...amb].sort((a, b) => size(b) - size(a)), [...amb].sort((a, b) => size(a) - size(b)),
    [...amb.filter((t) => t.shape === "W"), ...amb.filter((t) => t.shape !== "W")], [...amb.filter((t) => t.shape !== "L"), ...amb.filter((t) => t.shape === "L")]];
  let best = null;
  for (const o of orders) {
    const p = pack([...fixed, ...o, ...tail], cols, false);
    if (!best || p.holes < best.holes) best = p;
    if (best.holes === 0) break;
  }
  if (best.holes && fill.length) {
    const base = strip(best.tiles);
    const p = pack([...base.filter((t) => !isLast(t)), ...fill, ...base.filter(isLast)], cols, false);
    if (p.holes < best.holes && p.rows <= best.rows) best = p;
  }
  return pack(strip(best.tiles), cols, true).tiles;
}

// Which landing tiles fit: see fit(). With min, never fewer than min tiles on the grid: the
// budget grows a cell at a time (unfolding "N more" and adding ambient tiles), and if that
// runs out, fillers count as tiles of their own.
export function choose(tiles, budget = 20, min = 0) {
  const real = (out) => out.filter((t) => !t.filler && t.id !== "more").length;
  let b = budget, out = fit(tiles, b);
  while (real(out) < min && b < budget + 60) { const next = fit(tiles, ++b); if (real(next) > real(out) || next.length !== out.length) out = next; }
  if (real(out) < min) out = fit(tiles.map((t) => (t.filler ? { ...t, filler: false } : t)), b);
  return out;
}

// Which landing tiles fit a cell budget: hazards and act-now always; today folds into
// "N more"; ambient fills what's left, one large tile at a time; house health takes the
// last slot even when it escalates. A tall list with one item gets a wide tile instead.
function fit(tiles, budget) {
  tiles = tiles.map((t) => (t.shape === "T" && t.viz?.type === "list" && (t.viz.items || []).length <= 1 ? { ...t, shape: "W" } : t));
  const shown = [], folded = [];
  const health = tiles.find((x) => x.id === "health");
  let used = health ? 1 : 0;
  const fillers = tiles.filter((x) => x.filler);
  const by = (t) => tiles.filter((x) => x.tier === t && x !== health && !x.filler);
  for (const t of [...by(0), ...by(1)]) { shown.push(t); used += cells(t.shape); }
  const today = by(2);
  for (let i = 0; i < today.length; i++) {
    const t = today[i], need = cells(t.shape), left = today.length - i - 1;
    if (used + need + (left ? 1 : 0) <= budget || (!left && used + need <= budget)) { shown.push(t); used += need; }
    else { folded.push(...today.slice(i)); break; }
  }
  if (folded.length) { shown.push({ id: "more", tier: 2, shape: "S", label: "Also today", tone: "today", say: `${folded.length} more`, sub: folded.map((f) => f.label).join(", ") }); used += 1; }
  let large = shown.some((t) => t.shape === "L");
  for (const t of by(3)) {
    let shape = t.shape;
    if (shape === "L" && large) shape = "W";
    if (used + cells(shape) <= budget) { shown.push(shape === t.shape ? t : { ...t, shape }); used += cells(shape); if (shape === "L") large = true; }
  }
  if (health) shown.push(health);
  return [...shown, ...fillers];
}

// Merge tiles from several sensors into one ordered list: tier, then order, then id
export const ordered = (tiles) => [...tiles].sort((a, b) => (a.tier ?? 3) - (b.tier ?? 3) || (a.order ?? 50) - (b.order ?? 50) || String(a.id).localeCompare(String(b.id)));

// Watch a card's own width and give it a column count; requestUpdate when it changes
export class Columns {
  constructor(host, pick = twoOrFour) {
    this.host = host; this.pick = pick; this.cols = 4;
    host.addController(this);
  }
  hostConnected() {
    this.ro = new ResizeObserver(() => { const c = this.pick(this.host.clientWidth); if (c !== this.cols) { this.cols = c; this.host.requestUpdate(); } });
    this.ro.observe(this.host);
  }
  hostDisconnected() { this.ro?.disconnect(); }
}
