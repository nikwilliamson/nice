// Moving pictures: board (the Vestaboard), flaps, eq, garland.
import { html, svg, css } from "lit";

// Lay a board out as one token per flap. Rows read back from the board are already placed;
// typed text is wrapped at word boundaries and centred, as the board does it.
function boardCells(v, rows, cols) {
  const tok = (s) => s.match(/\{\d+\}|./gu) || [];
  const exact = Array.isArray(v.lines) && v.lines.length;
  const out = [];
  if (!exact) {
    for (const line of String(v.text || "").replace(/\|\|/g, "\n").split("\n")) {
      const t = tok(line);
      if (t.length <= cols || t.some((x) => x.startsWith("{"))) { out.push(t.slice(0, cols)); continue; }
      let cur = "";
      for (const w of line.trim().split(/\s+/)) {
        if (!cur) cur = w;
        else if ((cur + " " + w).length <= cols) cur += " " + w;
        else { out.push(tok(cur.slice(0, cols))); cur = w; }
      }
      if (cur) out.push(tok(cur.slice(0, cols)));
    }
  }
  const lines = exact ? v.lines.slice(0, rows).map((l) => tok(String(l)).slice(0, cols)) : out.slice(0, rows);
  const top = exact ? 0 : Math.floor((rows - lines.length) / 2);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const t = lines[r - top] || [];
    const pad = exact || t.some((x) => x.startsWith("{")) ? 0 : Math.floor((cols - t.length) / 2);
    for (let c = 0; c < cols; c++) cells.push(t[c - pad] || " ");
  }
  return cells;
}
const FLAP = { 63: "#e8423a", 64: "#f7882f", 65: "#f4c430", 66: "#36b37e", 67: "#2f7de1", 68: "#8e5bd8", 69: "#f4f1ea", 70: "#151517", 71: "#f4f1ea" };

// A 15 × 3 grid of flaps; {63}–{71} are colour tiles. Flaps that differ from v.prev
// (the board as it was, which the tile remembers) flip in, left to right.
export const board = {
  render(v) {
    const rows = v.rows || 3, cols = v.cols || 15;
    const now = boardCells(v, rows, cols), was = v.prev ? boardCells(v.prev, rows, cols) : null;
    const label = String(v.text || (v.lines || []).join(" ")).replace(/\{\d+\}/g, "").replace(/\s+/g, " ").trim();
    return html`<div class="vb" style="--vb-cols:${cols}" role="img" aria-label=${label}>${now.map((x, i) => {
      const m = x && /^\{(\d+)\}$/.exec(x);
      const flip = was && was[i] !== x;
      const st = `${flip ? `--d:${(i % cols) * 40 + Math.floor(i / cols) * 90}ms;` : ""}${m ? `background:${FLAP[m[1]] || "#151517"}` : ""}`;
      return html`<b class=${flip ? "flip" : ""} style=${st}>${!x || x === " " || m ? "" : x.toUpperCase()}</b>`;
    })}</div>`;
  },
  styles: css`
    .vb { display: grid; grid-template-columns: repeat(var(--vb-cols, 15), minmax(0, 1fr)); gap: var(--n-s-2xs); container-type: inline-size; perspective: 400px; }
    .vb b { aspect-ratio: 3 / 4; border-radius: var(--n-r-xs); background: rgba(255,255,255,.07); color: #f4f1ea; display: grid; place-items: center;
      font-family: var(--n-display); font-weight: 800; font-size: max(7px, 4.4cqi); line-height: 1; backface-visibility: hidden; }
    .vb b.flip { animation: vbflip .5s cubic-bezier(.3, .7, .4, 1) var(--d, 0ms) both; }
    @keyframes vbflip { 0% { transform: rotateX(90deg); opacity: .2; } 60% { transform: rotateX(-14deg); opacity: 1; } 100% { transform: rotateX(0); } }
  `,
};

// Split-flap text: { text } (first 22 characters)
export const flaps = {
  render: (v) => html`<div class="flaps">${[...String(v.text || "").slice(0, 22)].map((c) => html`<b>${c === " " ? " " : c}</b>`)}</div>`,
  styles: css`
    .flaps { display: flex; flex-wrap: wrap; gap: var(--n-s-xs); }
    .flaps b { width: 24px; height: 30px; border-radius: var(--n-r-xs); background: rgba(255,255,255,.12); color: #fff; font-family: ui-monospace, Menlo, monospace; font-size: 0.95em; display: grid; place-items: center; animation: flap 4s ease-in-out infinite; }
    .flaps b:nth-child(2n) { animation-delay: .2s; } .flaps b:nth-child(3n) { animation-delay: .4s; }
    @keyframes flap { 0%,85%,100% { transform: scaleY(1); } 92% { transform: scaleY(.1); } }
  `,
};

// Something's playing
export const eq = {
  render: () => html`<div class="eq" aria-hidden="true"><b></b><b></b><b></b><b></b></div>`,
  layout: "side",
  styles: css`
    .eq { display: flex; gap: var(--n-s-xs); align-items: flex-end; height: 32px; }
    .eq b { width: 6px; height: 100%; border-radius: var(--n-r-xs); background: currentColor; transform-origin: bottom; animation: eqb 1s ease-in-out infinite alternate; }
    .eq b:nth-child(2) { animation-delay: -.3s; } .eq b:nth-child(3) { animation-delay: -.6s; } .eq b:nth-child(4) { animation-delay: -.9s; }
    @keyframes eqb { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
  `,
};

// Twinkling lights
const BULBS = [[14, 21, "#ff6b6b"], [38, 26, "#ffd65c"], [60, 16, "#4fd1a5"], [84, 11, "#5ab8ff"], [108, 17, "#ff8fb8"]];
export const garland = {
  render: () => html`<svg class="garl" viewBox="0 0 120 30" aria-hidden="true"><path d="M2 6 C 22 26, 44 26, 60 12 S 100 2, 118 18" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.5"/>
    ${BULBS.map(([x, y, c], i) => svg`<circle class="tw tw${i % 3}" cx=${x} cy=${y} r="3.4" fill=${c}/>`)}</svg>`,
  styles: css`
    .garl { width: 100%; max-width: 200px; height: auto; }
    .tw { animation: tw 1.6s ease-in-out infinite; } .tw1 { animation-delay: .5s; } .tw2 { animation-delay: 1s; }
    @keyframes tw { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
  `,
};
