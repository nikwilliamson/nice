// One-off: rewrite every nice-room-page's sections from the old map to the list.
import { readFileSync, writeFileSync } from "node:fs";
import { normalize } from "../../src/cards/room-sections.js";
const [inp, out] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(inp, "utf8"));
let n = 0;
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (!o || typeof o !== "object") return;
  if (o.type === "custom:nice-room-page" && o.sections && !Array.isArray(o.sections)) { o.sections = normalize(o.sections); n++; }
  Object.values(o).forEach(walk);
};
walk(cfg);
writeFileSync(out, JSON.stringify(cfg, null, 1) + "\n");
console.log(`converted ${n} room pages`);
