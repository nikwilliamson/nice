// bento-cards.js, stored in pieces.
// The whole file is too large to write through the Home Assistant connection in one go, so its
// source lives in bento-cards.part1.txt … bento-cards.part8.txt. Joined in order they are
// bento-cards.js 1.18.0 exactly. This loader fetches them, points their relative imports at
// /local/, and runs them as one module. To go back to a single file, upload the joined source
// over this one (and the parts can be deleted).
const V = "1.18.0", N = 8, base = new URL("./", import.meta.url);
const parts = await Promise.all(Array.from({ length: N }, (_, i) =>
  fetch(new URL(`bento-cards.part${i + 1}.txt?v=${V}`, base)).then((r) => {
    if (!r.ok) throw new Error(`bento-cards: part ${i + 1} failed to load (${r.status})`);
    return r.text();
  })));
const src = parts.join("").replace(/from "\.\/(bento-[a-z-]+\.js\?v=[0-9.]+)"/g, (_, f) => `from "${new URL(f, base).href}"`);
const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
try { await import(url); } finally { URL.revokeObjectURL(url); }
