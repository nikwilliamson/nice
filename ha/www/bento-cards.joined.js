// Bento cards - the landing-page bento and its sky header.
// Cards: bento-grid, bento-sky, bento-tabs, bento-rooms, bento-room, bento-controls
// Pairs with themes/bento.yaml, which carries the same palette into the rest of Home Assistant.
//
// bento-grid draws sensor.bento_tiles. Every decision about WHAT to show (tiers,
// wording, escalation, who owns which alert) is made in custom_templates/bento.jinja;
// this file only decides WHERE and HOW: packing shapes into the grid, colour by tone,
// the charts, and what a tap does.
//
// No imports from hearth-cards.js: its own fonts and element names, so either library can
// change without the other noticing. The palette, tokens, shared styles, night mode and the
// tap/hold model live in bento-core.js, shared with the car, litter, feeder and footer cards.
//
// Type is set in em off the card's host, so one number scales a whole card:
//   font_scale: 1.1   in either card's config makes everything 10% larger.
import {
  BENTO_TOKENS_CSS, BENTO_BUTTON_CSS, BENTO_BASE_CSS, BENTO_CBAR_CSS, TONES, tone, offTone, roomTone, kelvinRgb, rgbCss, lightTone,
  esc, watchColumns, isNight, applyNight, bindTap, confirmTap, moreInfo, roomList, pageGutter,
} from "./bento-core.js?v=1.1.0";
import { MOTION_CSS, motionBefore, motionAfter, arrive, celebrate } from "./bento-motion.js?v=1.0.1";
import { pending } from "./bento-pending.js?v=1.0.0";

const BENTO_VERSION = "1.18.0";

if (!document.getElementById("bento-fonts")) {
  const link = document.createElement("link");
  link.id = "bento-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@500;600;700;800&display=swap";
  document.head.appendChild(link);
}

// The palette (TONES, tone, offTone, roomTone, lightTone) is bento-core's; this file only adds
// what is its own.
// Grid footprint for each shape: [columns, rows] on the 4-column grid
// FL is a full-width L: a big chart on a screen too narrow for four columns
const SHAPES = { S: [1, 1], W: [2, 1], T: [1, 2], L: [2, 2], F: [4, 1], FL: [4, 2] };
const cells = (s) => SHAPES[s][0] * SHAPES[s][1];
const BUDGET = 20; // five rows of four

// A tile that carries its own colour (a team's): that colour as the background, with ink
// that reads on it
const teamTone = (hexColor) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16));
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  return { bg: hexColor, ink: light ? "#1c2233" : "#ffffff", accent: light ? "#1c2233" : "#ffffff" };
};
const kelvinWord = (k) => (k < 2700 ? "Warm" : k < 3600 ? "Soft white" : k < 4600 ? "Neutral" : "Daylight");
const sentence = (s) => { const t = String(s || "").trim().toLowerCase().replace(/[.!]+$/, ""); return t.charAt(0).toUpperCase() + t.slice(1); };

// iOS WebKit (seen on iOS 18) can throw the page back to the top when a card swaps out its
// whole shadow tree, even when nothing changed size. Every redraw that replaces a card's
// markup goes through here: if the page's scroll moved, it's put back before anything paints.
function keepScroll(redraw) {
  const page = document.scrollingElement;
  const y = page ? page.scrollTop : 0;
  redraw();
  if (page && page.scrollTop !== y) page.scrollTop = y;
}

// ── Shared styles
// Tokens and the shared pill shape come from bento-core; the colour-temperature track is this file's
const BASE_CSS = `
  ${BENTO_TOKENS_CSS}
  ${BENTO_BUTTON_CSS}
  ${MOTION_CSS}
  /* Colour-temperature track: warm on the left, cool on the right, a dot where the light is now */
  .kel { position: relative; height: 10px; border-radius: var(--b-r-full); margin: var(--b-s-sm) 0 var(--b-s-2xs); }
  .kel i { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 3px var(--bg, #fff), 0 1px 6px rgba(0,0,0,.25); }
`;

// ── History: one cache for every card on the page
// Charts ask for an entity's history over a window; results are kept for five
// minutes, so ten redraws a minute cost one websocket call.
const HISTORY = new Map();
async function history(hass, entity, startMs) {
  const key = `${entity}|${Math.floor(startMs / 300000)}`;
  const hit = HISTORY.get(key);
  if (hit && Date.now() - hit.at < 300000) return hit.data;
  if (hit && hit.pending) return hit.pending;
  const pending = hass.callWS({
    type: "history/history_during_period",
    start_time: new Date(startMs).toISOString(),
    entity_ids: [entity],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  }).then((r) => {
    const rows = (r[entity] || []).map((p) => ({ t: (p.lu ?? p.lc) * 1000, v: parseFloat(p.s) })).filter((p) => !Number.isNaN(p.v));
    HISTORY.set(key, { at: Date.now(), data: rows });
    return rows;
  }).catch(() => { HISTORY.delete(key); return []; });
  HISTORY.set(key, { at: 0, pending });
  return pending;
}
// Step-sample a history into evenly spaced points, carrying the last value forward
function bucket(rows, startMs, endMs, n) {
  const out = [];
  let i = 0, last = rows.length ? rows[0].v : 0;
  for (let k = 0; k < n; k++) {
    const t = startMs + ((endMs - startMs) * (k + 1)) / n;
    let sum = 0, cnt = 0;
    while (i < rows.length && rows[i].t <= t) { sum += rows[i].v; cnt++; last = rows[i].v; i++; }
    out.push(cnt ? sum / cnt : last);
  }
  return out;
}
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
// A three-point moving average: minute-level jitter (a compressor cycling) reads as
// noise in a 24-hour line; the shape of the day is what the chart is for
const smooth = (v) => v.map((x, i) => (v[Math.max(0, i - 1)] + x + v[Math.min(v.length - 1, i + 1)]) / 3);

// Lay a board out as one token per flap. Rows read back from the board are already
// placed; typed text is wrapped at word boundaries and centred, as the board does it.
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

// ── Charts
// One idea each. Every function returns markup for numbers it is handed; none of
// them decide whether a chart should exist (bento.jinja does).
const charts = {
  spark(vals, { color, ref = null, refLabel = "", peak = false, unit = "" }) {
    if (!vals || vals.length < 2) return `<div class="spark empty"></div>`;
    const lo = Math.min(...vals, ref ?? Infinity), hi = Math.max(...vals, ref ?? -Infinity);
    // The line stops just short of the edge so the "now" dot sits on its end; the
    // fill carries on flat to the edge so the tile has no dead strip
    const W = 100, H = 40, pad = 4, END = 97;
    const x = (i) => (i / (vals.length - 1)) * END;
    const y = (v) => pad + (1 - (v - lo) / (hi - lo || 1)) * (H - pad * 2);
    const pts = vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
    const pk = vals.indexOf(Math.max(...vals));
    const endY = (y(vals[vals.length - 1]) / H) * 100;
    return `<div class="spark"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,${H} L${pts.join(" L")} L${W},${y(vals[vals.length - 1]).toFixed(2)} L${W},${H} Z" fill="${color}" fill-opacity=".18"/>
        ${ref != null ? `<line x1="0" x2="${W}" y1="${y(ref)}" y2="${y(ref)}" stroke="${color}" stroke-opacity=".5" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>` : ""}
        <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
      ${ref != null ? `<span class="ref" style="top:${(y(ref) / H) * 100}%">${esc(refLabel)}</span>` : ""}
      ${peak ? `<span class="peak" style="left:clamp(24px, ${x(pk)}%, calc(100% - 24px));top:${(y(vals[pk]) / H) * 100}%">${vals[pk].toFixed(1)}${unit}</span>` : ""}
      <span class="end" style="left:${END}%;top:${endY}%;background:${color}"></span></div>`;
  },
  tbar(v) {
    return `<div class="tbar"><div class="track"><i style="width:${Math.min(100, v.value)}%"></i>
      <span class="line" style="left:${v.line}%"></span><span class="linelbl" style="left:${v.line}%">${esc(v.line_label || "")}</span></div><b>${Math.round(v.value)}%</b></div>`;
  },
  tube(v) {
    return `<div class="tube"><div class="t"><i class="${v.value < (v.line ?? 50) ? "low" : ""}" style="height:${v.value}%"></i>
      <span class="notch" style="bottom:${v.line ?? 50}%"></span></div></div>`;
  },
  ring(v) {
    const c = 2 * Math.PI * 20;
    return `<svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="20" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="6"/>
      <circle cx="26" cy="26" r="20" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * v.value) / 100} ${c}" transform="rotate(-90 26 26)"/>
      <text x="26" y="30" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" font-family="Figtree, sans-serif">${esc(v.label)}</text></svg>`;
  },
  // Rooms on a warm-to-cool track, with the thermostat's setting notched into it. Rooms
  // within a whisker of each other share one marker (it says how many), so a cluster
  // reads as "three rooms here" rather than a smudge; the coolest and warmest are named
  thermo(v) {
    const rooms = (v.rooms || []).filter((r) => typeof r[1] === "number");
    if (!rooms.length) return "";
    const temps = rooms.map((r) => r[1]).concat(v.set != null ? [v.set] : []);
    const lo = Math.floor(Math.min(...temps) - 1), hi = Math.ceil(Math.max(...temps) + 1);
    const pos = (t) => Math.max(3, Math.min(97, ((t - lo) / (hi - lo)) * 100));
    const groups = [];
    for (const r of [...rooms].sort((a, b) => a[1] - b[1])) {
      const g = groups[groups.length - 1];
      if (g && r[1] - g[g.length - 1][1] <= (hi - lo) * 0.07) g.push(r); else groups.push([r]);
    }
    const avg = (g) => g.reduce((n, r) => n + r[1], 0) / g.length;
    const short = (n) => String(n).replace(/\s+room$/i, "");
    const name = (g) => (g.length === 1 ? short(g[0][0]) : `${g.length} rooms`);
    const cool = groups[0], warm = groups[groups.length - 1];
    const anchor = (p) => (p < 18 ? "left" : p > 82 ? "right" : "mid");
    const label = (g, cls) => `<span class="nm ${cls} ${anchor(pos(avg(g)))}" style="left:${pos(avg(g))}%">${esc(name(g))} <b>${Math.round(avg(g))}°</b></span>`;
    return `<div class="thermo"><div class="track"></div>
      ${v.set != null ? `<span class="setp" style="left:${pos(v.set)}%">set <b>${Math.round(v.set)}°</b></span>` : ""}
      ${groups.map((g) => `<span class="room ${g === warm && groups.length > 1 ? "warm" : ""} ${g === cool && groups.length > 1 ? "cool" : ""} ${g.length > 1 ? "many" : ""}" style="left:${pos(avg(g))}%" title="${esc(g.map((r) => `${r[0]} ${Math.round(r[1])}°`).join(", "))}">${g.length > 1 ? g.length : ""}</span>`).join("")}
      ${label(cool, "cool")}${groups.length > 1 ? label(warm, "warm") : ""}</div>`;
  },
  dayline(marks) {
    const now = new Date(), nowH = now.getHours() + now.getMinutes() / 60;
    const pos = (h) => (h / 24) * 100;
    const COLORS = ["#ff9a3d", "#8f74f0", "#2fbf8f", "#5ab8ff"];
    const latest = marks.reduce((m, k) => (k.h > (m?.h ?? -1) ? k : m), null);
    return `<div class="dayline"><div class="past" style="width:${pos(nowH)}%"></div><div class="future" style="left:${pos(nowH)}%"></div>
      ${marks.map((m) => `<span class="mk ${m === latest ? "last" : ""}" style="left:calc(${pos(m.h)}% + ${m.dx || 0}px);background:${COLORS[m.series % COLORS.length]}" title="${esc(m.name)}"></span>`).join("")}
      <span class="tk" style="left:0">12a</span><span class="tk mid" style="left:50%">noon</span><span class="tk mid now" style="left:${pos(nowH)}%">now</span></div>`;
  },
  // Tonight's charge: where the battery is now, and how far plugging in gets it.
  // The ghost segment is the payoff of the one thing the tile asks you to do.
  charge(v) {
    const now = Math.max(0, Math.min(100, v.value)), lim = Math.max(now, Math.min(100, v.limit ?? 80));
    return `<div class="charge"><div class="cbar"><i class="now ${now < 50 ? "low" : ""}" style="width:${now}%"></i>
        <i class="gain" style="left:${now}%;width:${lim - now}%"></i><span class="lim" style="left:${lim}%"></span></div>
      <div class="cends"><span><b>${Math.round(now)}%</b> · ${esc(v.now_mi)} mi now</span><span class="to"><b>${Math.round(lim)}%</b> · ${esc(v.full_mi)} mi by morning</span></div></div>`;
  },
  battery(v) {
    return `<div class="batt"><div class="body"><i class="${v.value < 50 ? "low" : ""} ${v.charging ? "charging" : ""}" style="width:${v.value}%"></i><span>${esc(v.label)}</span></div><b class="nub"></b></div>`;
  },
  stack(v, night) {
    const segs = v.segments || [];
    return `<div class="stack"><div class="segs">${segs.map((s) => `<i style="flex:${Math.max(s.value, 0.01)};background:${tone(s.tone, night).accent}"></i>`).join("")}</div>
      <div class="seglbl">${segs.map((s) => `<span style="flex:${Math.max(s.value, 0.01)}">${s.show ? esc(s.name) : ""}</span>`).join("")}</div></div>`;
  },
  kelvin(v) {
    const lo = v.min || 2000, hi = v.max || 5500, k = Math.max(lo, Math.min(hi, v.value || lo));
    const stops = [0, 0.25, 0.5, 0.75, 1].map((f) => `${rgbCss(kelvinRgb(lo + (hi - lo) * f))} ${f * 100}%`).join(", ");
    return `<div class="kel" style="background:linear-gradient(90deg, ${stops})"><i style="left:${((k - lo) / (hi - lo || 1)) * 100}%;background:${rgbCss(kelvinRgb(k))}"></i></div>`;
  },
  // The Vestaboard as it is: a 15 x 3 grid of flaps. Text is centred and wrapped at
  // word boundaries the way the board does it; {63}-{71} are its colour tiles.
  // Flaps that differ from v.prev flip in, left to right, as the board does.
  board(v) {
    const rows = v.rows || 3, cols = v.cols || 15;
    const COLOR = { 63: "#e8423a", 64: "#f7882f", 65: "#f4c430", 66: "#36b37e", 67: "#2f7de1", 68: "#8e5bd8", 69: "#f4f1ea", 70: "#151517", 71: "#f4f1ea" };
    const now = boardCells(v, rows, cols), was = v.prev ? boardCells(v.prev, rows, cols) : null;
    const cellsOut = now.map((x, i) => {
      const m = x && /^\{(\d+)\}$/.exec(x);
      const flip = was && was[i] !== x ? ` class="flip" style="--d:${(i % cols) * 40 + Math.floor(i / cols) * 90}ms${m ? `;background:${COLOR[m[1]] || "#151517"}` : ""}"` : m ? ` style="background:${COLOR[m[1]] || "#151517"}"` : "";
      return `<b${flip}>${!x || x === " " || m ? "" : esc(x.toUpperCase())}</b>`;
    });
    return `<div class="vb" style="--vb-cols:${cols}" role="img" aria-label="${esc(String(v.text || (v.lines || []).join(" ")).replace(/\{\d+\}/g, "").replace(/\s+/g, " ").trim())}">${cellsOut.join("")}</div>`;
  },
  // One bar per day, scaled to the window's own range so a pound reads as a pound;
  // today is the solid one
  dbars(vals, labels) {
    if (!vals || vals.length < 2) return "";
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    return `<div class="dbars">${vals.map((v, i) => `<i class="${i === vals.length - 1 ? "now" : ""}" style="height:${18 + ((v - lo) / span) * 82}%" title="${esc(labels?.[i] || "")}"></i>`).join("")}</div>`;
  },
  // The next hours of the forecast, one bar per hour: tall for a wetter hour, a stub for
  // a dry one. Scaled to at least a tenth of an inch, so a drizzle stays a short bar
  rain(v) {
    const hrs = v.hours || [];
    if (!hrs.length) return "";
    const hi = Math.max(0.1, ...hrs.map((h) => h.in || 0));
    const lbl = (h, i) => (i === 0 ? "now" : `${h.h % 12 || 12}${h.h < 12 ? "a" : "p"}`);
    return `<div class="rain" aria-hidden="true">${hrs.map((h, i) => `<div class="hr ${h.wet ? "wet" : ""}"><i style="height:${h.wet ? Math.max(24, Math.min(100, (h.in / hi) * 100)) : 8}%"></i><span>${i % 2 ? "" : lbl(h, i)}</span></div>`).join("")}</div>`;
  },
  // A short checklist: a tick for each line that's fine, a ! for one that isn't
  checks(v) {
    return `<ul class="checks">${(v.items || []).map((c) => `<li class="${c.ok ? "ok" : "no"}"><i aria-hidden="true"></i><span>${esc(c.label)}</span></li>`).join("")}</ul>`;
  },
  // Label ...... value, one row each
  receipt(v) {
    return `<div class="rcpt">${(v.rows || []).map((r) => `<div><span>${esc(r[0])}</span><em></em><b>${esc(r[1])}</b></div>`).join("")}</div>`;
  },
  eq: () => `<div class="eq" aria-hidden="true"><b></b><b></b><b></b><b></b></div>`,
  flaps: (v) => `<div class="flaps">${[...String(v.text || "").slice(0, 22)].map((c) => `<b>${c === " " ? "&nbsp;" : esc(c)}</b>`).join("")}</div>`,
  garland: () => `<svg class="garl" viewBox="0 0 120 30" aria-hidden="true"><path d="M2 6 C 22 26, 44 26, 60 12 S 100 2, 118 18" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.5"/>
      ${[[14, 21, "#ff6b6b"], [38, 26, "#ffd65c"], [60, 16, "#4fd1a5"], [84, 11, "#5ab8ff"], [108, 17, "#ff8fb8"]].map(([x, y, c], i) => `<circle class="tw tw${i % 3}" cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`).join("")}</svg>`,
};

// ── bento-grid
class BentoGrid extends HTMLElement {
  setConfig(config) {
    this._config = { entity: "sensor.bento_tiles", sun: "sun.sun", base_path: null, routes: null, font_scale: 1, ...(config || {}) };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
  }
  static getStubConfig() { return { entity: "sensor.bento_tiles" }; }
  getCardSize() { return 8; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() { if (!this._gutter) { this._gutter = true; pageGutter(true); } }
  disconnectedCallback() { this._ro?.disconnect(); this._ro = null; if (this._gutter) { this._gutter = false; pageGutter(false); } }

  set hass(hass) {
    this._hass = hass;
    const st = hass.states[this._config.entity];
    const tiles = st?.attributes?.tiles || [];
    const night = applyNight(this, isNight(hass, this._config.sun));
    // Redraw only when what is shown changes; the template re-renders every minute
    const sig = JSON.stringify([tiles, night, this._histSig || ""]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._tiles = tiles;
    this._night = night;
    keepScroll(() => this._render());
    this._loadHistory();
  }

  // Which tiles fit: hazards and act-now always; today folds into "N more"; ambient
  // fills what's left; house health takes the last slot. Health keeps its last slot
  // even when it escalates: the escalation changes its words, not where it sits.
  _choose(tiles) {
    // A tall list tile with one item is mostly empty space; give it a wide one instead
    tiles = tiles.map((t) => (t.shape === "T" && t.viz?.type === "list" && (t.viz.items || []).length <= 1 ? { ...t, shape: "W" } : t));
    const shown = [], folded = [];
    const health = tiles.find((x) => x.id === "health");
    let used = health ? 1 : 0;
    // Fillers sit out the budget: _bestPack drops them into a hole if one is left
    const fillers = tiles.filter((x) => x.filler);
    const by = (t) => tiles.filter((x) => x.tier === t && x !== health && !x.filler);
    for (const t of [...by(0), ...by(1)]) { shown.push(t); used += cells(t.shape); }
    const today = by(2);
    for (let i = 0; i < today.length; i++) {
      const t = today[i], need = cells(t.shape), left = today.length - i - 1;
      if (used + need + (left ? 1 : 0) <= BUDGET || (!left && used + need <= BUDGET)) { shown.push(t); used += need; }
      else { folded.push(...today.slice(i)); break; }
    }
    if (folded.length) { shown.push({ id: "more", tier: 2, shape: "S", label: "Also today", tone: "today", say: `${folded.length} more`, sub: folded.map((f) => f.label).join(", ") }); used += 1; }
    let large = shown.some((t) => t.shape === "L");
    for (const t of by(3)) {
      let shape = t.shape;
      if (shape === "L" && large) shape = "W"; // only one large tile at a time
      if (used + cells(shape) <= BUDGET) { shown.push(shape === t.shape ? t : { ...t, shape }); used += cells(shape); if (shape === "L") large = true; }
    }
    if (health) shown.push(health);
    return [...shown, ...fillers];
  }

  // Ambient tiles have no urgency order among themselves, so try a few arrangements of
  // them and keep the one that leaves the fewest holes before any stretching.
  // House health always packs last, whatever its tier.
  _bestPack(tiles, cols) {
    const fill = tiles.filter((t) => t.filler);
    tiles = tiles.filter((t) => !t.filler);
    const last = (t) => t.id === "health" || t.tier === 4;
    const fixed = tiles.filter((t) => t.tier !== 3 && !last(t)), amb = tiles.filter((t) => t.tier === 3 && !last(t)), tail = tiles.filter(last);
    const size = (t) => cells(t.shape);
    const orders = [amb, [...amb].sort((a, b) => size(b) - size(a)), [...amb].sort((a, b) => size(a) - size(b)),
      [...amb.filter((t) => t.shape === "W"), ...amb.filter((t) => t.shape !== "W")], [...amb.filter((t) => t.shape !== "L"), ...amb.filter((t) => t.shape === "L")]];
    let best = null;
    for (const o of orders) {
      const p = this._pack([...fixed, ...o, ...tail], cols, false);
      if (!best || p.holes < best.holes) best = p;
      if (best.holes === 0) break;
    }
    // A filler goes in only if it closes a hole without adding a row
    if (best.holes && fill.length) {
      const rows = (p) => Math.max(0, ...p.tiles.map((t) => t.r + t.h));
      const base = best.tiles.map(({ r, c, w, h, ...t }) => t);
      const p = this._pack([...base.filter((t) => !last(t)), ...fill, ...base.filter(last)], cols, false);
      if (p.holes < best.holes && rows(p) <= rows(best)) best = p;
    }
    return this._pack(best.tiles.map(({ r, c, w, h, ...t }) => t), cols, true).tiles;
  }

  // Place tiles first-fit on an explicit grid, then close any holes by widening the
  // tile to their left (or lengthening the one above). CSS dense packing alone left
  // ragged gaps once tall tiles and wide tiles met; this always ends on clean rows.
  _pack(tiles, cols, fill) {
    const occ = [];
    const free = (r, c, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (x >= cols || (occ[y] && occ[y][x])) return false; return true; };
    const take = (r, c, w, h, i) => { for (let y = r; y < r + h; y++) { occ[y] = occ[y] || []; for (let x = c; x < c + w; x++) occ[y][x] = i + 1; } };
    const out = tiles.map((t, i) => {
      let [w, h] = SHAPES[t.shape] || SHAPES.S;
      w = Math.min(w, cols);
      for (let r = 0; ; r++) for (let c = 0; c < cols; c++) if (free(r, c, w, h)) { take(r, c, w, h, i); return { ...t, r, c, w, h }; }
    });
    const rows = occ.length;
    let holes = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!(occ[r] && occ[r][c])) holes++;
    if (!fill) return { tiles: out, holes };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (occ[r] && occ[r][c]) continue;
      const left = c > 0 && occ[r] && occ[r][c - 1] ? out[occ[r][c - 1] - 1] : null;
      const up = r > 0 && occ[r - 1] && occ[r - 1][c] ? out[occ[r - 1][c] - 1] : null;
      if (left && left.h === 1) { left.w += 1; take(r, c, 1, 1, occ[r][c - 1] - 1); }
      else if (up && up.w === 1) { up.h += 1; take(r, c, 1, 1, occ[r - 1][c] - 1); }
    }
    return { tiles: out, holes };
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    // Column count follows the card's own width, not the window's
    watchColumns(this);
    // Keep a half-typed chore across redraws
    const typed = this.shadowRoot.querySelector(".addfield input");
    const keep = typed ? { value: typed.value, focus: this.shadowRoot.activeElement === typed } : null;
    const cols = this._cols || 4;
    const tiles = this._bestPack(this._choose(this._tiles || []), cols);
    const night = this._night;
    // A goal: a tile's score (our side's, on live game tiles) went up since the last draw.
    // The tile pulses for a minute
    this._goals ||= {};
    for (const t of tiles) {
      if (typeof t.score !== "number") continue;
      const g = this._goals[t.id] || { ts: t.score, at: 0 };
      if (t.score > g.ts) g.at = Date.now();
      g.ts = t.score;
      this._goals[t.id] = g;
    }
    const snap = motionBefore(this);
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${GRID_CSS}</style>
      <div class="wrap"><div class="bento ${night ? "is-night" : ""}" style="--cols:${cols}">${tiles.map((t) => this._tile(t, night)).join("")}</div></div>`;
    if (keep && this._adding) {
      const input = this.shadowRoot.querySelector(".addfield input");
      if (input) { input.value = keep.value; if (keep.focus) input.focus(); }
    }
    this.shadowRoot.querySelectorAll("[data-tap]").forEach((el) => el.addEventListener("click", () => this._navigate(el.dataset.tap)));
    this.shadowRoot.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); this._act(JSON.parse(el.dataset.act)); }));
    this.shadowRoot.querySelectorAll("[data-done]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); this._tick(el); }));
    const form = this.shadowRoot.querySelector(".addfield");
    if (form) form.addEventListener("submit", (e) => { e.preventDefault(); this._add(form.querySelector("input").value); });
    const cancel = this.shadowRoot.querySelector(".addfield .cancel");
    if (cancel) cancel.addEventListener("click", (e) => { e.stopPropagation(); this._adding = false; this._sig = null; this.hass = this._hass; });
    motionAfter(this, snap, { night });
  }

  _layout(t) {
    const type = t.viz?.type;
    if (!type) return "text";
    if (type === "spark") return "bleed";
    if (["tube", "ring", "battery", "eq"].includes(type)) return "side";
    if (["list", "kelvin", "checks", "receipt", "rain"].includes(type)) return "after";
    // Words at the top, the chart or the buttons on the bottom edge
    if (type === "charge" || type === "buttons") return "foot";
    return "stack";
  }

  _viz(t, night) {
    const v = t.viz, c = t.color ? teamTone(t.color) : tone(t.tone, night);
    switch (v?.type) {
      case "spark": return `<div class="spark-slot" data-spark="${esc(t.id)}">${charts.spark(this._series?.[t.id], { color: c.accent, ref: v.ref ?? null, refLabel: v.ref_label, peak: !!v.peak, unit: "" })}</div>`;
      case "dayline": return charts.dayline(this._series?.[t.id] || []);
      case "stack": return charts.stack(v, night);
      case "board": {
        // Flip only on a change (and everything on first sight), never on an unrelated redraw
        const key = JSON.stringify([v.lines, v.text]), b = (this._boards ||= {})[t.id];
        if (!b || b.key !== key) this._boards[t.id] = { key, prev: b ? { lines: b.v.lines, text: b.v.text } : { lines: [] }, v, at: Date.now() };
        const cur = this._boards[t.id];
        return charts.board({ ...v, prev: Date.now() - cur.at < 2500 ? cur.prev : null });
      }
      case "list": {
        // A ticked chore stays ticked through a redraw, and is gone once its row has folded away
        const ticked = (i) => this._ticked?.[i.uid];
        const items = (v.items || []).filter((i) => !ticked(i) || Date.now() - ticked(i) < 800);
        return `<ul class="list">${items.map((i) => `<li class="${ticked(i) ? "done" : ""}"><button class="tick ${ticked(i) ? "done" : ""}" data-done="${esc(i.uid)}" aria-label="Done: ${esc(sentence(i.summary))}"></button>${esc(sentence(i.summary))}</li>`).join("")}</ul>`;
      }
      case "buttons": return `<div class="btns">${(v.items || []).map((b) => `<button class="sbtn ${b.primary ? "pri" : ""}" data-act='${esc(JSON.stringify({ type: "service", service: b.service, entity_id: b.entity_id, data: b.data }))}'>${esc(b.label)}</button>`).join("")}</div>`;
      default: return charts[v?.type] ? charts[v.type](v, night) : "";
    }
  }

  _tile(t, night) {
    const c = t.color ? teamTone(t.color) : tone(t.tone, night);
    const lay = this._layout(t);
    const say = t.say ? `<div class="say ${t.big ? "big" : ""}">${esc(t.say)}</div>` : "";
    const sub = t.sub ? `<div class="sub">${esc(t.sub)}</div>` : "";
    let act = "";
    if (t.act?.type === "todo_add") {
      act = this._adding
        ? `<form class="addfield"><input type="text" placeholder="Add a chore" aria-label="New chore"><div class="addrow"><button type="submit" class="act">Done</button><button type="button" class="cancel" aria-label="Cancel">×</button></div></form>`
        : `<button class="act add" data-act='${esc(JSON.stringify(t.act))}'>${esc(t.act.label)}</button>`;
    } else if (t.act) {
      const armed = t.act.confirm && this._confirm === `act:${t.id}`;
      act = `<button class="act ${armed ? "armed" : ""}" data-act='${esc(JSON.stringify({ ...t.act, tile: t.id }))}'>${esc(armed ? "Tap again" : t.act.label)}</button>`;
    }
    const txt = `<div class="txt">${say}${sub}${lay === "after" ? "" : act}</div>`;
    const viz = this._viz(t, night);
    let body;
    if (lay === "side") body = `<div class="sidebody">${txt}<div class="vz">${viz}</div></div>`;
    else if (lay === "bleed") body = `${txt}<div class="bleed">${viz}</div>`;
    else if (lay === "after") body = `${txt}<div class="vz">${viz}</div>${act}`;
    else if (lay === "foot") body = `${txt}<div class="vz">${viz}</div>`;
    else if (lay === "stack") body = `<div class="vz">${viz}</div>${txt}`;
    else body = txt;
    const goal = this._goals?.[t.id] && Date.now() - this._goals[t.id].at < 60000;
    return `<div class="tile shape-${t.shape} lay-${lay} ${t.tier === 0 ? "p0" : ""} ${goal ? "goal" : ""}" data-k="${esc(t.id)}" ${t.tap ? `data-tap="${esc(t.tap)}" role="link" tabindex="0"` : ""}
        style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}">
      ${t.badge ? `<div class="lblrow"><div class="lbl">${esc(t.label)}</div><span class="badge"><i></i>${esc(t.badge)}</span></div>` : `<div class="lbl">${esc(t.label)}</div>`}${body}</div>`;
  }

  async _loadHistory() {
    const hass = this._hass;
    const series = this._series || {};
    const jobs = (this._tiles || []).map(async (t) => {
      const v = t.viz;
      if (v?.type === "spark" && v.entity) {
        const end = Date.now();
        const start = v.since === "midnight" ? midnight() : end - (v.hours || 2) * 3600000;
        const rows = await history(hass, v.entity, start);
        series[t.id] = smooth(bucket(rows, start, end, Math.max(12, Math.min(96, Math.round((end - start) / 900000)))));
        if (v.entity.includes("power") && v.since === "midnight") series[t.id] = series[t.id].map((w) => w / 1000);
      } else if (v?.type === "dayline") {
        const start = midnight();
        const marks = [];
        await Promise.all((v.series || []).map(async (s, si) => {
          const rows = await history(hass, s.entity, start);
          for (let i = 1; i < rows.length; i++) {
            if (rows[i].v > rows[i - 1].v && rows[i].t >= start) {
              const d = new Date(rows[i].t);
              marks.push({ h: d.getHours() + d.getMinutes() / 60, series: si, name: s.name });
            }
          }
        }));
        // Nudge marks that land on the same minute so both stay visible
        marks.sort((a, b) => a.h - b.h).forEach((m, i, a) => { if (i && Math.abs(m.h - a[i - 1].h) < 0.15) { a[i - 1].dx = -3; m.dx = 3; } });
        series[t.id] = marks;
      }
    });
    await Promise.all(jobs);
    this._series = series;
    const hs = JSON.stringify(series);
    if (hs !== this._histSig) { this._histSig = hs; this._sig = null; this.hass = this._hass; }
  }

  // Tiles name a place ("kitchen", "climate"); the card config's routes say where that
  // is on this dashboard. "tab:<id>" switches the surrounding bento-tabs; anything
  // unrouted stays put rather than opening a page that does not exist.
  _navigate(path) {
    if (!path) return;
    const routes = this._config.routes;
    const to = routes ? routes[path] : path;
    if (!to) return;
    if (to.startsWith("tab:")) {
      this.dispatchEvent(new CustomEvent("bento-tab", { detail: { tab: to.slice(4) }, bubbles: true, composed: true }));
      return;
    }
    bentoNavigate(this._config.base_path, to, "home");
  }

  _act(a) {
    if (a.type === "navigate") return this._navigate(a.path);
    if (a.type === "todo_add") { this._adding = true; this._sig = null; this.hass = this._hass; setTimeout(() => this.shadowRoot.querySelector(".addfield input")?.focus(), 0); return; }
    if (a.type === "service" && a.service) {
      const [domain, service] = a.service.split(".");
      const run = () => this._hass.callService(domain, service, a.data || {}, a.entity_id ? { entity_id: a.entity_id } : undefined);
      // confirm: the first tap arms the button for a few seconds, the second runs it
      if (a.confirm) return confirmTap(this, `act:${a.tile}`, { run, render: () => { this._sig = null; this.hass = this._hass; } });
      run();
    }
  }

  // Tick a chore off: the check draws and confetti flies, the row folds away, then Home Assistant hears about it
  _tick(btn) {
    const uid = btn.dataset.done, li = btn.closest("li"), list = btn.closest(".list");
    this._ticked ||= {};
    if (this._ticked[uid]) return;
    this._ticked[uid] = Date.now();
    const last = !!list && list.querySelectorAll(".tick:not(.done)").length <= 1;
    btn.classList.add("done");
    li?.classList.add("done");
    celebrate(btn, last);
    if (li && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      li.style.overflow = "hidden";
      li.animate([{ height: `${li.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0, marginTop: "-7px" }],
        { duration: 380, delay: 450, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" });
    }
    setTimeout(() => this._complete(uid), 800);
    setTimeout(() => { delete this._ticked[uid]; }, 15000);
  }

  _complete(uid) {
    this._hass.callService("todo", "update_item", { item: uid, status: "completed" }, { entity_id: "todo.house_alerts" });
  }

  _add(text) {
    const item = String(text || "").trim();
    if (item) this._hass.callService("todo", "add_item", { item: item.toUpperCase() }, { entity_id: "todo.house_alerts" });
    this._adding = false; this._sig = null; this.hass = this._hass;
  }
}

const GRID_CSS = `
  .wrap { container-type: inline-size; }
  .bento { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--b-row), auto); gap: var(--b-gap); font-family: var(--b-body); }
  .tile { background: var(--bg); color: var(--ink); border-radius: var(--b-radius); padding: var(--b-s-md) var(--b-s-lg);
    display: grid; grid-template-rows: auto 1fr; gap: var(--b-s-sm); align-content: start; overflow: hidden; min-width: 0; position: relative; }
  .tile[data-tap] { cursor: pointer; }
  .tile[data-tap]:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .tile > .txt, .tile > .vz, .tile > .sidebody { align-self: end; min-width: 0; }
  .lbl { font-size: 0.76em; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; opacity: .72; }
  .say { font-family: var(--b-display); font-weight: 800; font-size: 1.3em; line-height: 1.12; letter-spacing: -0.01em; text-wrap: balance; }
  .say.big { font-size: 2.1em; line-height: 1; }
  .shape-L .say { font-size: 1.95em; } .shape-F .say { font-size: 1.6em; }
  .sub { font-size: 0.94em; font-weight: 600; opacity: .78; margin-top: var(--b-s-2xs); }
  .shape-S .sub { font-size: 0.9em; }
  .txt { display: grid; gap: var(--b-s-2xs); }
  .shape-W .txt, .shape-F .txt { grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--b-s-lg); }
  .shape-W .txt .say, .shape-W .txt .sub, .shape-F .txt .say, .shape-F .txt .sub { grid-column: 1; }
  .shape-W .txt .act, .shape-F .txt .act { grid-column: 2; grid-row: 1 / span 2; align-self: center; margin: 0; }
  button { font: inherit; border: 0; cursor: pointer; }
  .act { justify-self: start; margin-top: var(--b-s-sm); background: var(--ink); color: var(--bg); }
  .act.armed { background: var(--b-warn); color: #fff; }
  .act.add { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px currentColor; opacity: .7; align-self: end; }
  .lay-stack { grid-template-rows: auto auto 1fr; } .lay-stack > .vz { align-self: start; }
  .lay-after { grid-template-rows: auto auto 1fr auto; } .lay-after > .vz { align-self: start; }
  .lay-foot { grid-template-rows: auto auto 1fr; } .lay-foot > .txt { align-self: start; } .lay-foot > .vz { align-self: end; }
  .lay-bleed { grid-template-rows: auto auto 1fr; padding-bottom: 0; } .lay-bleed > .txt { align-self: start; }
  .bleed { margin: 0 calc(-1 * var(--b-s-lg)); min-height: 56px; position: relative; }
  .shape-L .bleed { min-height: 110px; } .shape-F.lay-bleed { min-height: 170px; }
  .sidebody { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--b-s-md); align-items: end; }
  .p0 { animation: alarm 1.6s ease-out infinite; }
  @keyframes alarm { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--b-alert) 55%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }

  /* spark */
  .spark-slot { position: absolute; inset: 0; } .spark { position: absolute; inset: 18px 0 0 0; }
  .spark svg { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; height: 100%; }
  .spark .end { position: absolute; width: 9px; height: 9px; border-radius: 50%; transform: translate(-50%, -50%); animation: ping 2s ease-out infinite; }
  .spark .peak { position: absolute; transform: translate(-50%, -150%); font-size: 0.78em; font-weight: 800; }
  .spark .ref { position: absolute; left: 14px; transform: translateY(-130%); font-size: 0.74em; font-weight: 700; opacity: .85; }
  @keyframes ping { 0% { box-shadow: 0 0 0 0 currentColor; } 100% { box-shadow: 0 0 0 9px transparent; } }
  /* threshold bar */
  .tbar { display: flex; align-items: center; gap: var(--b-s-md); padding-bottom: var(--b-s-lg); }
  .tbar .track { flex: 1; height: 10px; border-radius: var(--b-r-full); background: rgba(255,255,255,.85); position: relative; }
  .tbar .track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--b-r-full); background: var(--accent); }
  .tbar .line { position: absolute; top: -5px; bottom: -5px; width: 2px; background: currentColor; }
  .tbar .linelbl { position: absolute; top: 15px; transform: translateX(-50%); font-size: 0.72em; font-weight: 700; opacity: .6; }
  .tbar b { font-family: var(--b-display); font-weight: 800; font-size: 1.15em; }
  /* tube */
  .tube .t { width: 36px; height: 110px; border-radius: var(--b-r-sm); background: rgba(255,255,255,.9); position: relative; overflow: hidden; box-shadow: inset 0 0 0 2px rgba(28,34,51,.08); }
  .shape-S .tube .t, .shape-W .tube .t { height: 64px; width: 28px; }
  .tube .t i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--accent); }
  .tube .t i.low { background: var(--b-warn); animation: throb 3s ease-in-out infinite; }
  .tube .notch { position: absolute; left: 0; right: 0; height: 2px; background: rgba(28,34,51,.35); }
  @keyframes throb { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  .ring { width: 60px; height: 60px; display: block; }
  /* thermo */
  .thermo { position: relative; height: 62px; }
  .thermo .track { position: absolute; left: 0; right: 0; top: 24px; height: 10px; border-radius: var(--b-r-full); background: linear-gradient(90deg, #7cc4f0, #bfe3d4 42%, #ffd59a 70%, #ff8f6b); }
  .thermo .room { position: absolute; top: 29px; width: 14px; height: 14px; border-radius: var(--b-r-full); background: #fff; box-shadow: 0 0 0 3px var(--bg), 0 2px 4px rgba(0,0,0,.18); transform: translate(-50%, -50%); box-sizing: border-box; }
  .thermo .room.many { width: auto; min-width: 22px; height: 20px; padding: 0 var(--b-s-sm); display: grid; place-items: center; font-size: 0.7em; font-weight: 800; color: #1c2233; line-height: 1; }
  .thermo .room.cool { background: #3a9fd6; color: #fff; } .thermo .room.warm { background: #ff6b4a; color: #fff; }
  .thermo .setp { position: absolute; top: 0; transform: translateX(-50%); font-size: 0.72em; font-weight: 600; opacity: .8; white-space: nowrap; }
  .thermo .setp b { font-weight: 800; }
  .thermo .setp::after { content: ""; position: absolute; left: 50%; top: 17px; width: 3px; height: 16px; border-radius: var(--b-r-xs); background: currentColor; transform: translateX(-50%); box-shadow: 0 0 0 2px var(--bg); }
  .thermo .nm { position: absolute; top: 44px; font-size: 0.76em; font-weight: 600; white-space: nowrap; opacity: .9; }
  .thermo .nm b { font-weight: 800; }
  .thermo .nm.left { transform: translateX(-7px); } .thermo .nm.right { transform: translateX(calc(-100% + 7px)); } .thermo .nm.mid { transform: translateX(-50%); }
  /* day line */
  .dayline { position: relative; height: 46px; }
  .dayline .past { position: absolute; top: 12px; left: 0; height: 2px; background: currentColor; opacity: .28; }
  .dayline .future { position: absolute; top: 12px; right: 0; border-top: 2px dotted currentColor; opacity: .2; }
  .dayline .mk { position: absolute; top: 3px; width: 5px; height: 20px; border-radius: var(--b-r-xs); transform: translateX(-50%); }
  .dayline .mk.last { animation: pop 3s ease-out infinite; }
  .dayline .tk { position: absolute; top: 26px; font-size: 0.72em; font-weight: 700; opacity: .55; white-space: nowrap; }
  .dayline .tk.mid { transform: translateX(-50%); } .dayline .tk.now { opacity: .9; }
  @keyframes pop { 0%,60%,100% { transform: translateX(-50%) scaleY(1); } 70% { transform: translateX(-50%) scaleY(1.35); } }
  /* charge plan: the bento-core bar, its gain always filling in */
  ${BENTO_CBAR_CSS}
  .cbar .gain { animation: fillin var(--b-t-fill) ease-in-out infinite alternate; }
  .cends { display: flex; justify-content: space-between; gap: var(--b-s-sm); flex-wrap: wrap; font-size: 0.78em; font-weight: 600; opacity: .85; }
  .cends b { font-family: var(--b-display); font-weight: 800; font-size: 1.15em; }
  .cends .to { text-align: right; }
  .shape-T .cends, .shape-S .cends { flex-direction: column; gap: var(--b-s-2xs); } .shape-T .cends .to, .shape-S .cends .to { text-align: left; }
  /* battery */
  .batt { display: flex; align-items: center; gap: var(--b-s-xs); }
  .batt .body { position: relative; width: 150px; height: 44px; border-radius: var(--b-r-sm); background: rgba(255,255,255,.95); box-shadow: inset 0 0 0 2px rgba(28,34,51,.15); overflow: hidden; color: #1c2233; }
  .batt .body i { position: absolute; left: 4px; top: 4px; bottom: 4px; border-radius: var(--b-r-xs); background: var(--accent); max-width: calc(100% - 8px); }
  .batt .body i.low { background: var(--b-warn); }
  .batt .body i.charging { animation: throb 2.4s ease-in-out infinite; }
  .batt .body span { position: relative; display: grid; place-items: center; height: 100%; font-size: 0.86em; font-weight: 800; }
  .batt .nub { width: 5px; height: 16px; border-radius: 0 3px 3px 0; background: currentColor; opacity: .3; }
  /* month split */
  .stack { display: grid; gap: var(--b-s-xs); }
  .stack .segs { display: flex; gap: var(--b-s-xs); height: 14px; } .stack .segs i { border-radius: var(--b-r-xs); }
  .stack .seglbl { display: flex; gap: var(--b-s-xs); font-size: 0.74em; font-weight: 800; } .stack .seglbl span { white-space: nowrap; overflow: hidden; }
  /* badge: a word pinned top-right, beside the eyebrow; the dot pulses */
  .lblrow { display: flex; justify-content: space-between; align-items: center; gap: var(--b-s-sm); min-width: 0; }
  .badge { flex: none; display: inline-flex; align-items: center; gap: var(--b-s-xs); padding: var(--b-s-xs) var(--b-s-sm); border-radius: var(--b-r-full); background: var(--ink); color: var(--bg);
    font-size: 0.7em; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
  .badge i { width: 7px; height: 7px; border-radius: 50%; background: var(--b-alert); animation: throb 1.6s ease-in-out infinite; }
  /* a goal: the tile pulses for a minute */
  .goal { animation: goal 1s ease-out 6; }
  @keyframes goal { 0% { box-shadow: 0 0 0 0 var(--accent); filter: brightness(1.3); } 100% { box-shadow: 0 0 0 18px transparent; filter: none; } }
  /* rain: one bar per hour */
  .rain { display: flex; gap: var(--b-s-xs); height: 40px; }
  .rain .hr { flex: 1; display: grid; grid-template-rows: 1fr auto; gap: var(--b-s-xs); min-width: 0; }
  .rain .hr i { display: block; align-self: end; border-radius: 4px 4px 2px 2px; background: currentColor; opacity: .25; }
  .rain .hr.wet i { opacity: 1; background: var(--accent); }
  .rain .hr span { height: 1.1em; font-size: 0.68em; font-weight: 800; opacity: .75; text-align: center; white-space: nowrap; }
  /* checklist */
  .checks { list-style: none; margin: var(--b-s-xs) 0 0; padding: 0; display: grid; gap: var(--b-s-sm); font-weight: 700; }
  .checks li { display: flex; align-items: center; gap: var(--b-s-sm); min-width: 0; }
  .checks li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .checks i { flex: none; position: relative; width: var(--b-c-xs); height: var(--b-c-xs); border-radius: 50%; background: var(--b-ok); }
  .checks i::after { content: ""; position: absolute; left: 6px; top: 3px; width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
  .checks .no i { background: var(--b-warn); }
  .checks .no i::after { content: "!"; left: 0; right: 0; top: 0; width: auto; height: auto; border: 0; transform: none; color: #fff; font-size: 12px; font-weight: 900; line-height: 18px; text-align: center; }
  .checks .no span { font-weight: 800; }
  /* receipt */
  .rcpt { display: grid; gap: var(--b-s-sm); margin-top: var(--b-s-xs); }
  .rcpt div { display: flex; align-items: baseline; gap: var(--b-s-sm); min-width: 0; }
  .rcpt span { flex: none; font-weight: 600; opacity: .8; }
  .rcpt em { flex: 1; min-width: 12px; border-bottom: 2px dotted currentColor; opacity: .25; transform: translateY(-4px); }
  .rcpt b { flex: none; font-family: var(--b-display); font-weight: 800; }
  /* equalizer */
  .eq { display: flex; gap: var(--b-s-xs); align-items: flex-end; height: 32px; }
  .eq b { width: 6px; height: 100%; border-radius: var(--b-r-xs); background: currentColor; transform-origin: bottom; animation: eqb 1s ease-in-out infinite alternate; }
  .eq b:nth-child(2) { animation-delay: -.3s; } .eq b:nth-child(3) { animation-delay: -.6s; } .eq b:nth-child(4) { animation-delay: -.9s; }
  @keyframes eqb { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
  /* vestaboard: the flaps sit straight on the tile, no frame */
  .vb { display: grid; grid-template-columns: repeat(var(--vb-cols, 15), minmax(0, 1fr)); gap: var(--b-s-2xs); container-type: inline-size; perspective: 400px; }
  .vb b { aspect-ratio: 3 / 4; border-radius: var(--b-r-xs); background: rgba(255,255,255,.07); color: #f4f1ea; display: grid; place-items: center;
    font-family: var(--b-display); font-weight: 800; font-size: max(7px, 4.4cqi); line-height: 1; backface-visibility: hidden; }
  .vb b.flip { animation: vbflip .5s cubic-bezier(.3, .7, .4, 1) var(--d, 0ms) both; transform-origin: 50% 50%; }
  @keyframes vbflip { 0% { transform: rotateX(90deg); opacity: .2; } 60% { transform: rotateX(-14deg); opacity: 1; } 100% { transform: rotateX(0); } }
  /* flaps, garland */
  .flaps { display: flex; flex-wrap: wrap; gap: var(--b-s-xs); }
  .flaps b { width: 24px; height: 30px; border-radius: var(--b-r-xs); background: rgba(255,255,255,.12); color: #fff; font-family: ui-monospace, Menlo, monospace; font-size: 0.95em; display: grid; place-items: center; animation: flap 4s ease-in-out infinite; }
  .flaps b:nth-child(2n) { animation-delay: .2s; } .flaps b:nth-child(3n) { animation-delay: .4s; }
  @keyframes flap { 0%,85%,100% { transform: scaleY(1); } 92% { transform: scaleY(.1); } }
  .garl { width: 100%; max-width: 200px; height: auto; }
  .tw { animation: tw 1.6s ease-in-out infinite; } .tw1 { animation-delay: .5s; } .tw2 { animation-delay: 1s; }
  @keyframes tw { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
  /* chores and scenes */
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--b-s-sm); font-weight: 700; font-size: 1.02em; }
  .list li { display: flex; gap: var(--b-s-sm); align-items: center; }
  .tick { width: var(--b-c-sm); height: var(--b-c-sm); border-radius: 50%; color: inherit; background: transparent; box-shadow: inset 0 0 0 2px currentColor; opacity: .45; flex: none; padding: 0; }
  .tick:hover { opacity: 1; background: var(--accent); }
  .btns { display: flex; flex-wrap: wrap; gap: var(--b-s-sm); }
  .sbtn { background: rgba(28,34,51,.08); color: inherit; }
  .is-night .sbtn { background: rgba(255,255,255,.16); }
  .sbtn.pri { background: var(--ink); color: var(--bg); }
  /* Typing a chore: the field on its own line, Done and × under it where + Add was,
     so it fits a phone-width tile */
  .addfield { display: grid; gap: var(--b-s-sm); align-self: end; min-width: 0; }
  .addfield input { width: 100%; min-width: 0; font: inherit; font-size: 1em; padding: var(--b-s-sm) var(--b-s-md); border-radius: var(--b-r-sm); border: 0; background: rgba(255,255,255,.9); color: #1c2233; }
  .addrow { display: flex; gap: var(--b-s-sm); align-items: center; }
  .addfield .act { margin: 0; }
  .addfield .cancel { width: 30px; height: 30px; flex: none; display: grid; place-items: center; padding: 0; border-radius: 50%; font-size: 1.1em; font-weight: 800; line-height: 1;
    background: rgba(28,34,51,.08); color: inherit; }
  .is-night .addfield .cancel { background: rgba(255,255,255,.16); }

  @container (max-width: 560px) {
    .shape-T .sidebody { grid-template-columns: 1fr; }
    .shape-T .tube .t { height: 64px; width: 28px; }
  }
`;

// ── bento-sky
// A window on the moment: the sky follows sun.sun, weather dims it, and the text
// says hello. Deliberately nothing the bento already covers.
const SKY = [
  // [elevation, top, middle, bottom]
  [-18, "#0f1430", "#1a2150", "#2a2f66"],
  [-6, "#1d2a66", "#4a4f9c", "#8a6fb0"],
  [0, "#2b3a7a", "#6b5fb5", "#e28aa0"],
  [6, "#4a7fe0", "#8f8de8", "#ff9a7a"],
  [12, "#3d8fe6", "#6fb6f2", "#ffc98a"],
  [30, "#3d8fe6", "#6fb6f2", "#bfe3ff"],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
function skyAt(elev) {
  if (elev <= SKY[0][0]) return SKY[0].slice(1);
  for (let i = 1; i < SKY.length; i++) {
    if (elev <= SKY[i][0]) {
      const t = (elev - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return [1, 2, 3].map((k) => mix(SKY[i - 1][k], SKY[i][k], t));
    }
  }
  return SKY[SKY.length - 1].slice(1);
}
// The sun sets the sky; weather only takes the edge off it, so dusk still looks like dusk in the rain
const WEATHER_WASH = { cloudy: ["#8f9bad", 0.14], partlycloudy: ["#8f9bad", 0.06], rainy: ["#5d6b7d", 0.18], pouring: ["#4b5868", 0.24], lightning: ["#4b5868", 0.22], "lightning-rainy": ["#4b5868", 0.24], fog: ["#c9d1db", 0.2], snowy: ["#dfe6ee", 0.16], "snowy-rainy": ["#9aa6b6", 0.16], hail: ["#6d7888", 0.18] };
const CONDITION = { "clear-night": "Clear", cloudy: "Cloudy", exceptional: "Unusual weather", fog: "Foggy", hail: "Hail", lightning: "Thunderstorms", "lightning-rainy": "Stormy", partlycloudy: "Partly cloudy", pouring: "Pouring", rainy: "Rainy", snowy: "Snowy", "snowy-rainy": "Sleet", sunny: "Sunny", windy: "Windy", "windy-variant": "Windy" };

// What the weather looks like in the sky itself: clouds, rain, snow, fog, wind and
// lightning, drawn behind the words. Positions come from the index, never Math.random,
// so a redraw every minute does not reshuffle the sky.
const SKY_WEATHER = {
  partlycloudy: { clouds: 2 }, cloudy: { clouds: 4, grey: 0.15 }, fog: { clouds: 1, fog: 4 },
  rainy: { clouds: 4, grey: 0.35, rain: 26 }, pouring: { clouds: 5, grey: 0.5, rain: 54, fast: true },
  lightning: { clouds: 5, grey: 0.5, rain: 34, bolt: true }, "lightning-rainy": { clouds: 5, grey: 0.5, rain: 48, bolt: true },
  snowy: { clouds: 3, grey: 0.1, snow: 34 }, "snowy-rainy": { clouds: 4, grey: 0.3, rain: 16, snow: 16 },
  hail: { clouds: 4, grey: 0.4, hail: 30 }, windy: { clouds: 1, wind: 5 }, "windy-variant": { clouds: 3, wind: 5 },
};
const CLOUD = '<svg viewBox="0 0 120 58"><circle cx="34" cy="38" r="16"/><circle cx="58" cy="28" r="22"/><circle cx="84" cy="36" r="17"/><rect x="18" y="36" width="84" height="20" rx="10"/></svg>';
function skyWeather(state, up) {
  const w = SKY_WEATHER[state];
  if (!w) return "";
  const cloudFill = (g) => (up ? mix("#ffffff", "#7d8798", g) : mix("#c9d2e6", "#4a5266", g));
  let out = "";
  for (let i = 0; i < (w.clouds || 0); i++) {
    // Placed as a share of the room left beside the cloud, so a cloud never runs off the card
    const size = 100 + ((i * 47) % 3) * 40, top = 6 + ((i * 29) % 4) * 13, at = i === 0 && w.clouds > 2 ? 0.04 : 0.45 + ((i * 23) % 50) / 100;
    out += `<i class="cloud" style="left:calc((100% - ${size}px - 48px) * ${at.toFixed(2)} + 24px);top:${top}%;width:${size}px;color:${cloudFill((w.grey || 0) + (i % 2) * 0.08)};opacity:${(up ? 0.85 : 0.45) * (i === 0 && w.clouds > 2 ? 0.55 : 1)};animation-duration:${60 + i * 17}s;animation-delay:-${i * 13}s">${CLOUD}</i>`;
  }
  for (let i = 0; i < (w.fog || 0); i++) out += `<i class="fog" style="top:${30 + i * 16}%;animation-delay:-${i * 5}s"></i>`;
  for (let i = 0; i < (w.wind || 0); i++) out += `<i class="gust" style="top:${22 + ((i * 37) % 60)}%;width:${18 + (i % 3) * 10}%;animation-delay:-${(i * 0.7).toFixed(1)}s"></i>`;
  for (let i = 0; i < (w.rain || 0); i++) out += `<i class="drop ${w.fast ? "fast" : ""}" style="left:${(i * 37) % 100}%;animation-delay:-${((i * 0.13) % 1).toFixed(2)}s"></i>`;
  for (let i = 0; i < (w.snow || 0); i++) out += `<i class="flake" style="left:${(i * 41) % 100}%;width:${3 + (i % 3)}px;height:${3 + (i % 3)}px;animation-duration:${5 + (i % 4)}s;animation-delay:-${((i * 0.9) % 8).toFixed(1)}s"></i>`;
  for (let i = 0; i < (w.hail || 0); i++) out += `<i class="hail" style="left:${(i * 43) % 100}%;animation-delay:-${((i * 0.17) % 1.2).toFixed(2)}s"></i>`;
  if (w.bolt) out += `<i class="flash"></i><svg class="bolt" viewBox="0 0 40 90"><path d="M24 0 6 50h14L10 90 36 36H21z"/></svg>`;
  return `<div class="wx" aria-hidden="true">${out}</div>`;
}
const AVATAR = ["#ff8a5c", "#5ab8ff", "#9fd33a", "#a78bfa", "#ffc933"];

class BentoSky extends HTMLElement {
  setConfig(config) {
    this._config = { weather: "weather.forecast_home", sun: "sun.sun", persons: [], font_scale: 1, ...(config || {}) };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
  }
  static getStubConfig() { return { weather: "weather.forecast_home", persons: [] }; }
  getCardSize() { return 4; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() { clearInterval(this._tick); this._tick = setInterval(() => { this._sig = null; if (this._hass) this.hass = this._hass; }, 60000); if (!this._gutter) { this._gutter = true; pageGutter(true); } }
  disconnectedCallback() { clearInterval(this._tick); if (this._gutter) { this._gutter = false; pageGutter(false); } }

  set hass(hass) {
    this._hass = hass;
    const c = this._config;
    const sun = hass.states[c.sun], wx = hass.states[c.weather];
    applyNight(this, isNight(hass, c.sun));
    const people = c.persons.map((p) => hass.states[p]).filter(Boolean);
    const sig = JSON.stringify([sun?.attributes?.elevation, sun?.state, wx?.state, wx?.attributes?.temperature, people.map((p) => p.state), new Date().getMinutes()]);
    if (sig === this._sig) return;
    this._sig = sig;
    keepScroll(() => this._render(hass, sun, wx, people));
  }

  _render(hass, sun, wx, people) {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const now = new Date();
    const elev = sun?.attributes?.elevation ?? 20;
    const up = sun?.state === "above_horizon";
    let [top, mid, bot] = skyAt(elev);
    const wash = WEATHER_WASH[wx?.state];
    if (wash) [top, mid, bot] = [top, mid, bot].map((col) => mix(col, wash[0], wash[1]));
    const h = now.getHours();
    const greet = h >= 5 && h < 12 ? "Good morning" : h < 17 && h >= 12 ? "Good afternoon" : h >= 17 && h < 22 ? "Good evening" : "Good night";
    const first = (hass.user?.name || "").split(" ")[0];
    const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const fmt = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const rising = sun?.attributes?.next_rising, setting = sun?.attributes?.next_setting;
    let sunLine = "", progress = 0.5;
    if (up && setting) {
      const mins = Math.round((new Date(setting) - now) / 60000);
      sunLine = `Sunset ${fmt(setting)}${mins > 0 && mins < 90 ? ` · in ${mins} min` : ""}`;
      const lastRise = new Date(rising).getTime() - 86400000;
      progress = (now - lastRise) / (new Date(setting) - lastRise);
    } else if (rising) {
      sunLine = `Sunrise ${fmt(rising)}`;
      const lastSet = new Date(setting).getTime() - 86400000;
      progress = (now - lastSet) / (new Date(rising) - lastSet);
    }
    progress = Math.max(0.02, Math.min(0.98, progress));
    // Point on the arc: half a circle of radius 100, its diameter the bottom of a 200 x 100
    // frame. The frame keeps that 2:1 shape at any size, so the arc is always round
    const ang = Math.PI * (1 - progress);
    const ax = 100 + 100 * Math.cos(ang), ay = 100 - 100 * Math.sin(ang);
    const temp = wx?.attributes?.temperature, feels = wx?.attributes?.apparent_temperature;
    const cond = CONDITION[wx?.state] || "";
    const w = SKY_WEATHER[wx?.state] || {};
    const hidden = (w.grey || 0) >= 0.3; // the sun goes behind proper cloud
    const pills = people.map((p, i) => {
      const name = p.attributes.friendly_name || p.entity_id;
      const home = p.state === "home";
      const where = home ? "" : p.state === "not_home" ? "Out" : p.state;
      const pic = p.attributes.entity_picture;
      return `<span class="pill ${home ? "" : "away"}"><span class="av" style="background:${pic ? `center/cover url('${esc(pic)}')` : AVATAR[i % AVATAR.length]}">${pic ? "" : esc(name.charAt(0))}</span>${esc(name)}${where ? `<em>${esc(sentence(where))}</em>` : ""}</span>`;
    }).join("");
    const bits = [];
    if (feels != null && temp != null && Math.abs(feels - temp) >= 2) bits.push(`Feels ${Math.round(feels)}°`);
    if (wx?.attributes?.humidity != null) bits.push(`${Math.round(wx.attributes.humidity)}% humidity`);
    const ARC = "M0 100 A100 100 0 0 1 200 100";
    // The frame, the stars, the arc's shapes and the weather are built only when what they show
    // changes (the weather, day or night, the sun going behind cloud). Every other redraw moves
    // the sun and rewrites the words in place, so the clouds and stars keep animating instead of
    // starting over every minute.
    const layer = JSON.stringify([wx?.state, up, hidden]);
    if (layer !== this._layer || !this.shadowRoot.querySelector(".sky")) {
      this._layer = layer;
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${SKY_CSS}</style>
        <div class="sky ${up ? "day" : "night"}">
          ${!up && !hidden ? `<div class="stars" aria-hidden="true">${Array.from({ length: 30 }, (_, i) => `<i style="left:${(i * 53) % 97}%;top:${(i * 37) % 70}%;width:${1 + (i % 3)}px;height:${1 + (i % 3)}px;animation-delay:${(i % 7) * 0.5}s"></i>`).join("")}</div>` : ""}
          <svg class="arc" viewBox="0 0 200 100" aria-hidden="true">
            <defs>
              <radialGradient id="glow"><stop offset="0" stop-color="${up ? "#fff1b8" : "#dfe6ff"}" stop-opacity="${up ? 0.6 : 0.35}"/><stop offset="1" stop-color="${up ? "#fff1b8" : "#dfe6ff"}" stop-opacity="0"/></radialGradient>
              <mask id="crescent"><circle class="m1" r="6.5" fill="#fff"/><circle class="m2" r="5.5" fill="#000"/></mask>
            </defs>
            <path d="${ARC}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>
            <path class="done" d="${ARC}" pathLength="100" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.3" stroke-linecap="round"/>
            <g opacity="${hidden ? 0.5 : 1}"><circle class="body" r="${up ? 20 : 15}" fill="url(#glow)"/>
              ${up ? `<circle class="body" r="7.5" fill="#fff4c2"/>` : `<circle class="body" r="6.5" fill="#eef2ff" mask="url(#crescent)"/>`}</g>
          </svg>
          ${skyWeather(wx?.state, up)}
          <div class="words"></div>
          <div class="temp"></div>
        </div>`;
    }
    const sky = this.shadowRoot.querySelector(".sky");
    sky.style.background = `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${bot} 100%)`;
    sky.querySelector(".done").setAttribute("stroke-dasharray", `${(progress * 100).toFixed(2)} 101`);
    sky.querySelectorAll(".body, .m1").forEach((c) => { c.setAttribute("cx", ax); c.setAttribute("cy", ay); });
    sky.querySelector(".m2").setAttribute("cx", ax + 3);
    sky.querySelector(".m2").setAttribute("cy", ay - 2.5);
    const words = `<span class="date">${esc(date)}</span>
      <span class="hello">${esc(greet)}${first ? `, ${esc(first)}` : ""}</span>
      <span class="sub">${esc([cond, sunLine].filter(Boolean).join(" · "))}</span>
      ${pills ? `<div class="pills">${pills}</div>` : ""}`;
    const wordsEl = sky.querySelector(".words");
    if (wordsEl.innerHTML !== words) wordsEl.innerHTML = words;
    const tempEl = sky.querySelector(".temp");
    tempEl.hidden = temp == null;
    const tempHtml = temp != null ? `<b>${Math.round(temp)}°</b><span>${esc(bits.join(" · "))}</span>` : "";
    if (tempEl.innerHTML !== tempHtml) tempEl.innerHTML = tempHtml;
  }
}

const SKY_CSS = `
  :host { container-type: inline-size; }
  .sky { position: relative; overflow: hidden; isolation: isolate; border-radius: var(--b-radius); padding: var(--b-s-xl); min-height: 216px; color: #fff;
    display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--b-s-lg); align-items: start;
    font-family: var(--b-body); text-shadow: 0 1px 14px rgba(0,0,0,.16); transition: background 2s ease; }
  .words { display: grid; gap: var(--b-s-xs); position: relative; z-index: 2; min-width: 0; }
  .words > span { display: block; }
  .date { font-size: 0.78em; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: .82; }
  .hello { font-family: var(--b-display); font-weight: 800; font-size: clamp(1.9em, 6.4cqi, 3.1em); line-height: 1.04; text-wrap: balance; letter-spacing: -0.025em; margin-top: var(--b-s-2xs); }
  .sub { font-weight: 600; font-size: 1.05em; opacity: .9; }
  .temp { position: relative; z-index: 2; text-align: right; display: grid; gap: var(--b-s-2xs); margin-top: calc(-1 * var(--b-s-xs)); }
  .temp[hidden] { display: none; }
  .temp b { font-family: var(--b-display); font-weight: 800; font-size: clamp(2.8em, 9cqi, 4.6em); line-height: .95; letter-spacing: -0.03em; }
  .temp span { font-size: 0.88em; font-weight: 700; opacity: .85; }
  .arc { position: absolute; right: calc(24px + 7.5em); bottom: 0; height: calc(100% - 30px); width: auto; aspect-ratio: 2 / 1; z-index: 0; overflow: visible; }
  /* The arc sits in the open sky between the words and the temperature; on a narrower
     card there is no gap to sit in, so it moves to the corner and fades back */
  @container (max-width: 760px) { .arc { right: 12px; opacity: .7; } }
  .stars { position: absolute; inset: 0; z-index: 0; }
  .stars i { position: absolute; border-radius: 50%; background: #fff; animation: star 3.4s ease-in-out infinite; }
  @keyframes star { 0%,100% { opacity: .15; } 50% { opacity: .95; } }
  .wx { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
  .wx .cloud { position: absolute; display: block; animation: drift linear infinite alternate; }
  .wx .cloud svg { display: block; width: 100%; height: auto; fill: currentColor; overflow: visible; }
  @keyframes drift { from { transform: translateX(-24px); } to { transform: translateX(24px); } }
  .wx .fog { position: absolute; left: -10%; width: 120%; height: 22px; border-radius: var(--b-r-full); background: rgba(255,255,255,.28); filter: blur(6px); animation: fog 14s ease-in-out infinite alternate; }
  @keyframes fog { from { transform: translateX(-6%); } to { transform: translateX(6%); } }
  .wx .gust { position: absolute; left: -30%; height: 2px; border-radius: var(--b-r-xs); background: rgba(255,255,255,.55); animation: gust 2.6s linear infinite; }
  @keyframes gust { from { transform: translateX(0); opacity: 0; } 20% { opacity: 1; } to { transform: translateX(560%); opacity: 0; } }
  .wx .drop { position: absolute; top: -12%; width: 1.5px; height: 16px; border-radius: var(--b-r-xs); background: rgba(220,235,255,.7); transform: rotate(12deg); animation: fall 0.9s linear infinite; }
  .wx .drop.fast { height: 22px; animation-duration: 0.55s; }
  @keyframes fall { to { top: 108%; } }
  .wx .flake { position: absolute; top: -6%; border-radius: 50%; background: #fff; opacity: .9; animation: snow linear infinite; }
  @keyframes snow { 0% { top: -6%; transform: translateX(0); } 50% { transform: translateX(14px); } 100% { top: 106%; transform: translateX(-6px); } }
  .wx .hail { position: absolute; top: -6%; width: 5px; height: 5px; border-radius: 50%; background: #f2f6ff; animation: fall 0.7s linear infinite; }
  .wx .flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flash 7s infinite; }
  @keyframes flash { 0%, 90%, 94%, 100% { opacity: 0; } 91% { opacity: .45; } 92% { opacity: .1; } 93% { opacity: .35; } }
  .wx .bolt { position: absolute; left: 62%; top: 18%; width: 26px; fill: #ffe680; opacity: 0; animation: flash 7s infinite; }
  @media (prefers-reduced-motion: reduce) { .wx *, .stars i { animation: none !important; } .wx .flash, .wx .bolt { display: none; } }
  .pills { display: flex; flex-wrap: wrap; gap: var(--b-s-sm); margin-top: var(--b-s-lg); }
  .pill { display: inline-flex; align-items: center; gap: var(--b-s-sm); border-radius: var(--b-r-full); padding: var(--b-s-xs) var(--b-s-lg) var(--b-s-xs) var(--b-s-xs); font-weight: 700; font-size: 0.96em; background: rgba(255,255,255,.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); text-shadow: none; }
  .pill em { font-style: normal; font-weight: 600; opacity: .75; }
  .pill.away { background: rgba(255,255,255,.1); }
  .pill.away .av { filter: grayscale(.6); opacity: .8; }
  .av { width: var(--b-c-md); height: var(--b-c-md); border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 0.82em; color: #1c2233; }
  @container (max-width: 520px) { .sky { grid-template-columns: minmax(0, 1fr); } .temp { grid-row: 1; text-align: left; margin: 0 0 var(--b-s-sm); display: flex; align-items: baseline; gap: var(--b-s-md); } .arc { right: 12px; height: auto; width: 46%; opacity: .6; } }
`;

// ── Rooms: one shared read of the registries
// Every room card and room page reads a room the same way, so the grid and the
// page can never disagree about how many lights are on.
// (ROOM_TONES and roomTone live in bento-core.)
const CAR_MEDIA = /_s_car_/;

function entityArea(hass, eid) {
  const e = hass.entities?.[eid];
  if (!e) return null;
  return e.area_id || hass.devices?.[e.device_id]?.area_id || null;
}
function isLightGroup(hass, eid) {
  const st = hass.states[eid];
  const reg = hass.entities?.[eid];
  return !!(st?.attributes?.is_hue_group || Array.isArray(st?.attributes?.entity_id) || (reg?.labels || []).includes("lighting"));
}
function readRoom(hass, areaId) {
  const ids = Object.keys(hass.states).filter((eid) => {
    const reg = hass.entities?.[eid];
    return reg && !reg.hidden && !reg.entity_category && entityArea(hass, eid) === areaId;
  });
  const of = (d) => ids.filter((e) => e.startsWith(d + "."));
  const usable = (e) => hass.states[e].state !== "unavailable";
  let lights = of("light").filter((e) => !isLightGroup(hass, e) && usable(e));
  // Some rooms only expose their lights as a group; count the group rather than nothing
  if (!lights.length) lights = of("light").filter((e) => isLightGroup(hass, e) && usable(e));
  const on = lights.filter((e) => hass.states[e].state === "on");
  const temps = of("sensor").filter((e) => hass.states[e].attributes.device_class === "temperature" && !/inside|target/.test(e) && !Number.isNaN(parseFloat(hass.states[e].state)));
  temps.sort((a, b) => (/_temp_sensor_/.test(b) ? 1 : 0) - (/_temp_sensor_/.test(a) ? 1 : 0));
  const playing = of("media_player").filter((e) => !CAR_MEDIA.test(e) && hass.states[e].state === "playing");
  const locks = of("lock");
  const unlocked = locks.filter((e) => hass.states[e].state === "unlocked");
  const lockOffline = locks.filter((e) => hass.states[e].state === "unavailable");
  const open = of("binary_sensor").filter((e) => ["door", "window"].includes(hass.states[e].attributes.device_class) && hass.states[e].state === "on");
  const scenes = of("scene");
  const temp = temps.length ? Math.round(parseFloat(hass.states[temps[0]].state)) : null;
  return { ids, lights, on, temp, playing, unlocked, lockOffline, open, scenes };
}
const roomName = (hass, id) => hass.areas?.[id]?.name || id.replace(/_/g, " ");
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// ── bento-rooms: the Lit Rooms grid
// A card per room; rooms with lights on wear their colour, dark rooms go neutral. The card opens the room's
// page; the small button switches the room's lights.
// areas and adaptive are optional: left out, they come from the first bento-rooms card on this
// dashboard that lists them (bento-core's roomList), so the list lives in one place. With none
// anywhere, every area Home Assistant knows is shown, as before.
class BentoRooms extends HTMLElement {
  setConfig(config) {
    this._config = { areas: null, base_path: null, sun: "sun.sun", adaptive: null, font_scale: 1, ...(config || {}) };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
    this._list = undefined;
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() { if (!this._gutter) { this._gutter = true; pageGutter(true); } }
  disconnectedCallback() { this._ro?.disconnect(); this._ro = null; if (this._gutter) { this._gutter = false; pageGutter(false); } }
  set hass(hass) {
    hass = this._hass = pending(this).take(hass);
    const c = this._config;
    // Explicit config wins; otherwise the dashboard's shared list, once it has loaded
    if (!c.areas && this._list === undefined && !this._listing) {
      this._listing = roomList(hass, c.base_path).then((l) => { this._list = l; this._sig = null; if (this._hass) this.hass = this._hass; });
    }
    const loading = !c.areas && this._list === undefined;
    const areas = c.areas || this._list?.areas || (loading ? [] : Object.keys(hass.areas || {}));
    const adaptive = c.adaptive || (c.areas ? {} : this._list?.adaptive) || {};
    const night = applyNight(this, isNight(hass, c.sun));
    // A room whose Adaptive Lighting is in sleep mode says so
    const asleep = (id) => [].concat(adaptive[id] || []).some((sw) => hass.states[`${sw}_sleep_mode`]?.state === "on");
    const rooms = areas.map((id, i) => ({ id, i, name: roomName(hass, id), sleep: asleep(id), ...readRoom(hass, id) }));
    const sig = JSON.stringify([night, loading, areas, rooms.map((r) => [r.on.length, r.lights.length, r.temp, r.playing, r.unlocked, r.lockOffline, r.open, r.sleep])]);
    if (sig === this._sig) return;
    this._sig = sig;
    keepScroll(() => this._render(rooms, night));
  }
  _render(rooms, night) {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const chip = (t, cls = "") => `<span class="chip ${cls}">${esc(t)}</span>`;
    watchColumns(this, (w) => (w && w < 520 ? 2 : w && w < 760 ? 3 : 4));
    const cols = this._cols || 4, tail = rooms.length % cols;
    const snap = motionBefore(this);
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${ROOMS_CSS}</style><div class="wrap"><div class="rooms ${night ? "is-night" : ""}" style="--cols:${cols}">${rooms.map((r, n) => {
      const lit = r.on.length > 0;
      const c = roomTone(r.i, night, lit);
      const meta = [
        r.playing.length ? chip("▶ " + (this._hass.states[r.playing[0]].attributes.media_title || "Playing"), "play") : "",
        r.temp != null ? chip(`${r.temp}°`) : "",
        r.sleep ? chip("Sleep mode", "sleep") : "",
        r.unlocked.length ? chip(r.unlocked.length > 1 ? `${r.unlocked.length} unlocked` : "Unlocked", "warn") : "",
        r.open.length ? chip(r.open.length > 1 ? `${r.open.length} open` : `${titleCase((this._hass.states[r.open[0]].attributes.device_class))} open`, "warn") : "",
        r.lockOffline.length ? chip("Lock offline", "off") : "",
      ].join("");
      const lights = r.lights.length ? (lit ? (r.on.length === r.lights.length ? `${r.lights.length} light${r.lights.length === 1 ? "" : "s"} on` : `${r.on.length} of ${r.lights.length} on`) : "Lights off") : "";
      // The last card stretches across whatever its row has left, so the grid ends square
      const span = tail && n === rooms.length - 1 ? `grid-column:span ${cols - tail + 1};` : "";
      return `<div class="room ${lit ? "lit" : ""}" data-room="${esc(r.id)}" role="link" tabindex="0" style="${span}--bg:${c.bg};--ink:${c.ink}">
        <div class="name">${esc(r.name)}</div>
        ${lights ? `<div class="count">${esc(lights)}</div>` : ""}
        <div class="meta">${meta}${r.lights.length ? `<button class="bulb ${lit ? "on" : ""}" data-toggle="${esc(r.id)}" aria-label="${lit ? "Turn off" : "Turn on"} ${esc(r.name)} lights">${lit ? "Off" : "On"}</button>` : ""}</div>
      </div>`;
    }).join("")}</div></div>`;
    this.shadowRoot.querySelectorAll("[data-room]").forEach((el) => {
      const go = () => bentoNavigate(this._config.base_path, `room-${el.dataset.room}`, "rooms");
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
    this.shadowRoot.querySelectorAll("[data-toggle]").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      const on = el.classList.contains("on");
      // The room shows lit (or dark) straight away; its lights catch up
      pending(this).set(readRoom(this._hass, el.dataset.toggle).lights, { state: on ? "off" : "on" });
      this._hass.callService("light", on ? "turn_off" : "turn_on", {}, { area_id: el.dataset.toggle });
    }));
    motionAfter(this, snap, { night });
  }
}
const ROOMS_CSS = `
  .wrap { container-type: inline-size; }
  .rooms { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); gap: var(--b-gap); font-family: var(--b-body); }
  .room { position: relative; overflow: hidden; border-radius: var(--b-radius); padding: var(--b-s-md) var(--b-s-lg); min-height: var(--b-row); background: var(--bg); color: var(--ink);
    display: flex; flex-direction: column; cursor: pointer; }
  .room:focus-visible { outline: var(--b-ring) solid var(--accent, var(--b-focus)); outline-offset: 2px; }
  .rooms:empty { min-height: var(--b-row); } /* the shared room list is still loading */
  .name { font-family: var(--b-display); font-weight: 800; font-size: 1.3em; letter-spacing: -0.01em; position: relative; }
  /* Name, then how many lights; the tags sit together on the bottom edge, and the
     light switch rides at the end of the last row, in the bottom-right corner */
  .meta { margin-top: auto; padding-top: var(--b-s-md); display: flex; flex-wrap: wrap; gap: var(--b-s-sm); align-items: flex-end; min-width: 0; }
  .meta .bulb { margin-left: auto; flex: none; font-size: 0.8em; font-weight: 700; padding: var(--b-s-xs) var(--b-s-md); } /* sized like the tags beside it */
  .chip { font-size: 0.8em; font-weight: 700; background: rgba(28,34,51,.07); border-radius: var(--b-r-full); padding: var(--b-s-xs) var(--b-s-md); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .chip.play { background: #1c2233; color: #fff; } .chip.warn { background: #ffd65c; color: #1c2233; } .chip.off { background: rgba(28,34,51,.12); }
  .count { font-size: 0.9em; font-weight: 700; opacity: .75; margin-top: var(--b-s-xs); }
  .bulb { background: rgba(28,34,51,.08); color: inherit; } .is-night .bulb { background: rgba(255,255,255,.16); }
  .bulb.on { background: var(--ink); color: var(--bg); }
  .is-night .chip { background: rgba(255,255,255,.14); } .is-night .chip.warn { background: #ffd65c; } .is-night .chip.play { background: #fff8f0; color: #1c2233; }
  .chip.sleep, .is-night .chip.sleep { background: #6a4be0; color: #ffffff; }
`;

// ── bento-room: the hero at the top of a room's page
// The room's colour comes from its place in the room list: areas in the config if given,
// otherwise the dashboard's shared list (see bento-rooms), otherwise every area Home Assistant
// knows. While the shared list loads, the hero shows neutral rather than guessing a colour.
class BentoRoom extends HTMLElement {
  setConfig(config) {
    if (!config.area) throw new Error("bento-room needs an area");
    this._config = { sun: "sun.sun", areas: null, font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
    this._list = undefined;
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() { if (!this._gutter) { this._gutter = true; pageGutter(true); } }
  disconnectedCallback() { if (this._gutter) { this._gutter = false; pageGutter(false); } }
  set hass(hass) {
    hass = this._hass = pending(this).take(hass);
    const id = this._config.area;
    if (!this._config.areas && this._list === undefined && !this._listing) {
      this._listing = roomList(hass, this._config.base_path).then((l) => { this._list = l; this._sig = null; if (this._hass) this.hass = this._hass; });
    }
    const loading = !this._config.areas && this._list === undefined;
    const r = readRoom(hass, id);
    const night = applyNight(this, isNight(hass, this._config.sun));
    const sig = JSON.stringify([night, loading, r.on, r.lights.length, r.temp, r.playing, r.unlocked, r.open, r.scenes]);
    if (sig === this._sig) return;
    this._sig = sig;
    const order = this._config.areas || this._list?.areas || Object.keys(hass.areas || {});
    const lit = r.on.length > 0;
    const c = loading ? offTone(night) : roomTone(Math.max(0, order.indexOf(id)), night, lit);
    const bits = [
      r.lights.length ? (lit ? (r.on.length === r.lights.length ? `${r.lights.length} light${r.lights.length === 1 ? "" : "s"} on` : `${r.on.length} of ${r.lights.length} lights on`) : "Lights off") : "",
      r.temp != null ? `${r.temp}°` : "",
      r.playing.length ? `${hass.states[r.playing[0]].attributes.media_title || "Something"} on ${hass.states[r.playing[0]].attributes.friendly_name}` : "",
      r.unlocked.length ? `${r.unlocked.map((e) => cName(hass.states[e], [roomName(hass, id)], hass)).join(", ")} unlocked` : "",
      r.open.length ? `${r.open.map((e) => cName(hass.states[e], [roomName(hass, id)], hass)).join(", ")} open` : "",
    ].filter(Boolean);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const snap = motionBefore(this);
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${ROOM_CSS}</style>
      <div class="hero ${lit ? "lit" : ""} ${night ? "is-night" : ""}" style="--bg:${c.bg};--ink:${c.ink}">
        <button class="back" aria-label="Back to rooms">‹ Rooms</button>
        <div class="name">${esc(roomName(hass, id))}</div>
        <div class="sub">${esc(bits.join(" · ") || "Nothing on in here")}</div>
        <div class="btns">
          ${r.lights.length ? `<button class="b pri" data-svc="light.${lit ? "turn_off" : "turn_on"}">${lit ? "All off" : "Lights on"}</button>` : ""}
          ${r.scenes.map((s) => `<button class="b" data-scene="${esc(s)}">${esc((hass.states[s].attributes.friendly_name || s).replace(/^(Home|Suite) /, ""))}</button>`).join("")}
        </div>
      </div>`;
    this.shadowRoot.querySelector(".back").addEventListener("click", () => bentoNavigate(this._config.base_path, this._config.back || "home", "rooms"));
    this.shadowRoot.querySelectorAll("[data-svc]").forEach((el) => el.addEventListener("click", () => {
      const [d, s] = el.dataset.svc.split(".");
      pending(this).set(readRoom(this._hass, id).lights, { state: s === "turn_off" ? "off" : "on" });
      hass.callService(d, s, {}, { area_id: id });
    }));
    this.shadowRoot.querySelectorAll("[data-scene]").forEach((el) => el.addEventListener("click", () => hass.callService("scene", "turn_on", {}, { entity_id: el.dataset.scene })));
    motionAfter(this, snap, { night });
  }
}
const ROOM_CSS = `
  .hero { position: relative; overflow: hidden; border-radius: var(--b-radius); padding: var(--b-s-lg) var(--b-s-xl) var(--b-s-xl); background: var(--bg); color: var(--ink); display: grid; gap: var(--b-s-sm); font-family: var(--b-body); }
  .back { justify-self: start; padding-left: var(--b-s-md); background: rgba(28,34,51,.08); color: inherit; }
  .name { font-family: var(--b-display); font-weight: 800; font-size: clamp(2em, 4.4vw, 2.8em); line-height: 1.05; letter-spacing: -0.02em; position: relative; margin-top: var(--b-s-xs); }
  .sub { font-weight: 600; font-size: 1.02em; opacity: .8; position: relative; }
  .btns { display: flex; flex-wrap: wrap; gap: var(--b-s-sm); margin-top: var(--b-s-sm); position: relative; }
  .b { background: rgba(28,34,51,.08); color: inherit; }
  .is-night .b, .is-night .back { background: rgba(255,255,255,.16); }
  .b.pri { background: var(--ink); color: var(--bg); }
  button:focus-visible { outline: var(--b-ring) solid var(--accent, var(--b-focus)); outline-offset: 2px; }
`;

// ── bento-tabs: the row of tabs under the header
// Each tab is a list of ordinary card configs, so a tab can hold the bento, the
// rooms grid or plain Home Assistant cards. The chosen tab survives a trip into a
// room page and back, so Back lands on Rooms, not on the bento.
// The tab pills are bento pills in bento colours, and follow the sun (sun: sun.sun), not the theme.
class BentoTabs extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.tabs) || !config.tabs.length) throw new Error("bento-tabs needs tabs");
    this._config = { sun: "sun.sun", font_scale: 1, ...config };
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._cards = {};
    let saved = null;
    try { saved = sessionStorage.getItem("bento-tab"); } catch (e) { /* storage blocked */ }
    this._active = config.tabs.some((t) => t.id === saved) ? saved : config.tabs[0].id;
  }
  getCardSize() { return 10; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() {
    if (this._config && !this.shadowRoot) this._build();
    if (!this._gutter) { this._gutter = true; pageGutter(true); }
  }
  disconnectedCallback() { if (this._gutter) { this._gutter = false; pageGutter(false); } }
  set hass(hass) {
    this._hass = hass;
    applyNight(this, isNight(hass, this._config?.sun));
    if (!this.shadowRoot) this._build();
    Object.values(this._cards).flat().forEach((c) => { c.hass = hass; });
  }
  async _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const tabs = this._config.tabs;
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${TABS_CSS}</style>
      <div class="bar" role="tablist"><span class="ind" aria-hidden="true"></span>${tabs.map((t) => `<button class="btn-base" role="tab" data-tab="${esc(t.id)}" aria-selected="${t.id === this._active}">${esc(t.label)}</button>`).join("")}</div>
      <div class="panels">${tabs.map((t) => `<div class="panel" data-panel="${esc(t.id)}" role="tabpanel" ${t.id === this._active ? "" : "hidden"}></div>`).join("")}</div>`;
    this.shadowRoot.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => this._select(b.dataset.tab)));
    // A tile inside a tab can ask for another tab (Power from the power tile, and so on)
    this.shadowRoot.addEventListener("bento-tab", (e) => { e.stopPropagation(); if (this._config.tabs.some((t) => t.id === e.detail.tab)) this._select(e.detail.tab); });
    requestAnimationFrame(() => { this._reveal(); this._glide(); });
    document.fonts?.ready.then(() => this._glide());
    new ResizeObserver(() => this._glide()).observe(this.shadowRoot.querySelector(".bar"));
    await this._fill(this._active);
  }
  async _fill(id) {
    if (this._cards[id]) return;
    const tab = this._config.tabs.find((t) => t.id === id);
    const panel = this.shadowRoot.querySelector(`[data-panel="${id}"]`);
    const helpers = await window.loadCardHelpers?.();
    this._cards[id] = (tab.cards || []).map((conf) => {
      const el = helpers ? helpers.createCardElement(conf) : document.createElement(conf.type.replace("custom:", ""));
      if (!helpers && el.setConfig) el.setConfig(conf);
      if (this._hass) el.hass = this._hass;
      panel.appendChild(el);
      return el;
    });
  }
  async _select(id) {
    const ids = this._config.tabs.map((t) => t.id), from = ids.indexOf(this._active), to = ids.indexOf(id);
    this._active = id;
    try { sessionStorage.setItem("bento-tab", id); } catch (e) { /* storage blocked */ }
    this.shadowRoot.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
    this.shadowRoot.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== id; });
    this._reveal();
    this._glide();
    await this._fill(id);
    if (from !== to) (this._cards[id] || []).forEach((c) => arrive(c, to > from ? "right" : "left"));
  }
  // The selected tab's dark pill slides under whichever tab is chosen
  _glide() {
    const bar = this.shadowRoot?.querySelector(".bar"), ind = bar?.querySelector(".ind"), b = bar?.querySelector('[aria-selected="true"]');
    if (!ind || !b || !b.offsetWidth) return;
    ind.style.width = `${b.offsetWidth}px`;
    ind.style.height = `${b.offsetHeight}px`;
    ind.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
    if (!bar.classList.contains("glide")) requestAnimationFrame(() => bar.classList.add("glide"));
  }
  // On a phone the row scrolls sideways: bring the chosen tab into view by scrolling the row
  // itself (never scrollIntoView, which would also move the page)
  _reveal() {
    const bar = this.shadowRoot?.querySelector(".bar"), b = bar?.querySelector('[aria-selected="true"]');
    if (!b) return;
    const left = b.offsetLeft - 8, right = b.offsetLeft + b.offsetWidth + 8;
    if (left < bar.scrollLeft) bar.scrollLeft = left;
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  }
}
// Pill shape from bento-core's tokens; colours from its page-chrome tokens, which switch at sunset.
// The strip scrolls sideways only, so it needs no scrollbar gutter (that applies to block scrolling).
const TABS_CSS = `
  .bar { position: relative; display: flex; gap: var(--b-s-sm); overflow-x: auto; scrollbar-width: none; padding: var(--b-s-2xs) 0 var(--b-s-md); font-family: var(--b-body); }
  .bar::-webkit-scrollbar { display: none; }
  .bar button { background: var(--b-chrome-bg); color: var(--b-chrome-ink-strong); }
  .bar button[aria-selected="true"] { background: var(--b-chrome-sel-bg); color: var(--b-chrome-sel-ink); }
  .bar button { position: relative; z-index: 1; }
  .bar .ind { position: absolute; left: 0; top: 0; z-index: 0; border-radius: var(--b-pill-radius); background: var(--b-chrome-sel-bg); pointer-events: none; opacity: 0; }
  .bar.glide .ind { opacity: 1; transition: transform .5s var(--b-spring), width .5s var(--b-spring), background-color .3s ease; }
  .bar.glide button[aria-selected="true"] { background: transparent; }
  .bar button:focus-visible { outline: var(--b-ring) solid var(--b-focus); outline-offset: 2px; }
  .panel { display: grid; gap: var(--b-gap); }
  .panel[hidden] { display: none; }
  /* The same gap under the sky header that a room page leaves under its own header
     (the sections view's 30px between sections; the card already sits 8px down) */
  :host { container-type: inline-size; padding-top: var(--b-s-xl); }
  /* On a phone the pills keep their size and the row scrolls sideways */
  @container (max-width: 520px) { .bar { margin: 0 calc(-1 * var(--b-s-sm)); padding-left: var(--b-s-sm); padding-right: var(--b-s-sm); scroll-padding: 0 var(--b-s-sm); } .bar button { flex: none; } }
`;

// ── bento-controls: every control on the inner pages, as bento tiles
// One renderer per kind of device, packed with the same grid as the landing bento.
// A thing that is on wears colour; a thing that is off goes neutral, as in the rooms.
// Tap does the obvious thing (toggle, play/pause, lock); press and hold opens the
// standard Home Assistant details. Sliders are drag bars along the tile's foot.
const C_DOMAIN_SHAPE = { light: "S", switch: "S", fan: "S", input_boolean: "S", media_player: "W", climate: "L", lock: "S", binary_sensor: "S", vacuum: "S", scene: "S", script: "S", sensor: "S" };
const C_TOGGLE = new Set(["light", "switch", "fan", "input_boolean"]);
const cDomain = (id) => id.split(".")[0];
const cNum = (v) => parseFloat(v);
// A device's main entity is often just "Light" or "Contact"; the real name is on the device
const C_GENERIC = /^(light|lights|lamp|switch|plug|outlet|contact|door|window|motion|occupancy|sensor|fan|lock|speaker)(\s+\d+)?$/i;
// "Living Room Floor Lights" reads "Floor lights" on the Living Room page, but
// "Kitchen Light" stays whole rather than shrinking to "Light"
function cName(s, strip, hass) {
  let n = String(s.attributes.friendly_name || s.entity_id).replace(/^\[[^\]]*\]\s*/, "").trim();
  if (C_GENERIC.test(n) && hass) {
    const dev = hass.devices?.[hass.entities?.[s.entity_id]?.device_id];
    const dn = dev && (dev.name_by_user || dev.name);
    if (dn) n = dn;
  }
  n = n.replace(/\s+(power minute average|current consumption|power)$/i, "");
  let short = n;
  for (const p of [].concat(strip || [])) {
    const low = String(p).toLowerCase();
    while (low && short.toLowerCase().startsWith(low + " ")) short = short.slice(low.length + 1);
  }
  if (short && !(C_GENERIC.test(short) && !/\d/.test(short))) n = short;
  return n.charAt(0).toUpperCase() + n.slice(1) || s.entity_id;
}
function cPower(w) { return w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`; }
// A state with no value yet reads as a dash, not "Unknown"
const cBlank = (st) => st == null || st === "" || st === "unknown" || st === "unavailable";
// "power_off" reads "Power off"; a state that is already cased ("Party") is left alone
const cWords = (st) => { const t = String(st); return /_/.test(t) || t === t.toLowerCase() ? sentence(t.replace(/_/g, " ")) : t; };
// A timestamp as time from now: "In 42 min", "3 hr ago"
function cWhen(iso) {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "—";
  const mins = Math.round((at - Date.now()) / 60000), m = Math.abs(mins), ahead = mins > 0;
  if (m < 1) return "Now";
  const span = m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} hr` : m < 10080 ? `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? "" : "s"}` : null;
  if (!span) return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return ahead ? `In ${span}` : `${span} ago`;
}
// A duration in whatever unit the sensor uses, as minutes or hours
function cDuration(v, unit) {
  const mins = v * ({ ms: 1 / 60000, s: 1 / 60, min: 1, h: 60, d: 1440 }[unit] ?? 1);
  if (mins < 1) return `${Math.round(mins * 60)} s`;
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60), rest = Math.round(mins % 60);
  if (h < 24) return rest ? `${h} hr ${rest} min` : `${h} hr`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} hr` : `${d} d`;
}
// (lightTone, the tile colour of a light, is bento-core's.)
// Settings entities show their value; a number drops a trailing ".0"
const C_VALUE = new Set(["select", "input_select", "number", "input_number", "text", "input_text", "time", "date", "datetime", "input_datetime"]);

// ── LED strips (WLED and Hue gradient)
// WLED's own palettes, read from the controller's /json/palx: stop position and
// colour as PPRRGGBB, or c1/c2/c3/r for the ones built from the light's colours
const WLED_PAL = {"Default":["009b00d5","10bd00b8","20da0092","30f3005c","40f45500","50dc8f00","60d5b400","70d5d500","80d59b00","90ef6600","a0f90044","b0e10086","c0c400b0","d0a300cf","e07600e8","f00032fc"],"* Random Cycle":["r","r","r","r"],"* Color 1":["c1"],"* Colors 1&2":["c1","c1","c2","c2"],"* Color Gradient":["c3","c2","c1"],"* Colors Only":["c1","c1","c1","c1","c1","c2","c2","c2","c2","c2","c3","c3","c3","c3","c3","c1"],"Party":["009b00d5","10bd00b8","20da0092","30f3005c","40f45500","50dc8f00","60d5b400","70d5d500","80d59b00","90ef6600","a0f90044","b0e10086","c0c400b0","d0a300cf","e07600e8","f00032fc"],"Cloud":["000000ff","1000008b","2000008b","3000008b","4000008b","5000008b","6000008b","7000008b","800000ff","9000008b","a087ceeb","b087ceeb","c0add8e6","d0ffffff","e0add8e6","f087ceeb"],"Lava":["00000000","10800000","20000000","30800000","408b0000","508b0000","60800000","708b0000","808b0000","908b0000","a0ff0000","b0ffa500","c0ffffff","d0ffa500","e0ff0000","f08b0000"],"Ocean":["00191970","1000008b","20191970","30000080","4000008b","500000cd","602e8b57","70008080","805f9ea0","900000ff","a0008b8b","b06495ed","c07fffd4","d02e8b57","e000ffff","f087cefa"],"Forest":["00006400","10006400","20556b2f","30006400","40008000","50228b22","606b8e23","70008000","802e8b57","9066cdaa","a032cd32","b09acd32","c090ee90","d07cfc00","e066cdaa","f0228b22"],"Rainbow":["00ff0000","10eb7000","20d59b00","30d5ba00","40d5d500","509ceb00","6000ff00","7000eb70","8000d59b","90009cd4","a00000ff","b07000eb","c09b00d5","d0ba00bb","e0d5009b","f0eb0072"],"Rainbow Bands":["00ff0000","10000000","20d59b00","30000000","40d5d500","50000000","6000ff00","70000000","8000d59b","90000000","a00000ff","b0000000","c09b00d5","d0000000","e0d5009b","f0000000"],"Sunset":["00b50000","16da5500","33ffaa00","55d3554d","87a700a9","c64900bc","ff0000cf"],"Rivendell":["0018452c","65496946","a5818c61","f2c8cca6","ffc8cca6"],"Breeze":["00103033","591ba6af","99c5e9ff","ff009198"],"Red & Blue":["00290e63","1f80184a","3fe32232","5f841f4c","7f2f1d66","9f6d2f65","bfb04264","df813968","ff54306c"],"Yellowout":["00debf08","ff753401"],"Analogous":["002600ff","3f5600ff","7f8b00ff","bfc40075","ffff0000"],"Splash":["00ba3fff","7fe30955","afeacdd5","ddcd26b0","ffcd26b0"],"Pastel":["003d87b8","2481bca9","57cbf19b","64e4ed8d","6bffe87f","73fbca82","78f8ac85","80fbca82","b4ffe87f","dffff278","fffffc71"],"Sunset 2":["00af793e","1d80673c","4454543a","44f8b837","61efcc5d","7ce6e185","b2667d81","ff001a7d"],"Beach":["00fffeec","0cfffeec","16fffeec","1adfe0b2","1cc0c37c","1cb0ffe7","327bfbec","474af6f1","5d21e1e4","7800ccd7","8504a8b2","880a848f","8833bdd4","d0179fc9","ff0081be"],"Vintage":["00291218","33490016","4ca5aa26","65ffbd50","7f8b3828","99490016","e5291218","ff291218"],"Departure":["00352200","2a563300","3f936c31","54d4a66c","6aebd4b4","74ffffff","8abfffc1","9454ff58","aa00ff00","bf00c000","d4008000","ff008000"],"Landscape":["00000000","251f5913","4c48b22b","7f96eb05","80baea77","82dee9fc","99c5dbe7","cc84b3fd","ff1c6be1"],"Beech":["000c2d00","13655602","26cf8004","3ff3c512","426dc492","ff052707"],"Sherbet":["00ff6629","2bff8c5a","56ff335a","7fff99a9","aafffff9","d171ff55","ff9dff89"],"Hult":["00fbd8fc","30ffc0ff","59ef5ff1","a03399d9","d818b8ae","ff18b8ae"],"Hult 64":["0018b8ae","4208a296","687c8907","82b2ba16","967c8907","c9069c90","ef008075","ff008075"],"Drywet":["00776121","2aebc758","54a9ee7c","7f25eee8","aa0778ec","d41b01af","ff043365"],"Jul":["00e2060c","5e1a604e","8482bd5e","ffb10309"],"Grintage":["001d0803","354c0100","688e601c","99d3bf3d","ff75812a"],"Rewhi":["00b1a0c7","48cd9e95","59e99b65","6bff5f3f","8dc0626d","ff84659f"],"Tertiary":["000019ff","3f268c75","7f56ff00","bfa78c13","ffff1929"],"Fire":["00000000","2e4d0000","60b10000","6cc42609","77d74c13","92eb731d","aeff9929","bcffb229","caffcc29","daffe629","eaffff29","f4ffff8f","ffffffff"],"Icefire":["00000000","3b003375","770066ff","952699ff","b456ccff","d9a7e6ff","ffffffff"],"Cyane":["003d9b2c","195fae4d","3c84c171","5d9aa67d","6aaf8a88","6db77989","71c2688a","74e1b3a5","7cffffc0","a8a7dacb","ff54b6d7"],"Light Pink":["004f206d","195a2875","3366307c","4c8d87b9","66b4def8","6dd0ecfc","72edfaff","7acec8ef","95b195de","b7bb82cb","ffc66fb8"],"Autumn":["005a0e05","338b290d","54b44611","68c0ca7d","70b18903","7abec883","7cc0ca7c","87b18903","8ec2cb76","a3b14411","cc80230c","f94a0502","ff4a0502"],"Magenta":["00000000","2a000075","540000ff","7f7100ff","aaff00ff","d4ff80ff","ffffffff"],"Magred":["00000000","3f710075","7fff00ff","bfff0075","ffff0000"],"Yelmag":["00000000","2a710000","54ff0000","7fff0075","aaff00ff","d4ff8075","ffffff00"],"Yelblu":["000000ff","3f0080ff","7f00ffff","bf71ff75","ffffff00"],"Orange & Teal":["0000965c","3700965c","c8ff4800","ffff4800"],"Tiamat":["0001020e","21020523","640d875c","782bffc1","8cf707f9","a0c111d0","b427ff9a","c804d5ec","dc27fc87","f0c1d5fd","fffff9ff"],"April Night":["0001052d","0a01052d","1905a9af","2801052d","3d01052d","4c2daf1f","5b01052d","7001052d","7ff99605","8f01052d","a201052d","b2ff5c00","c101052d","d601052d","e5df2d48","f401052d","ff01052d"],"Orangery":["00ff5f17","1eff5200","3cdf0d08","5a902c02","78ff6e11","96ff4500","b49e0d0b","d2f15211","ffd52504"],"C9":["00b80400","3cb80400","41902c02","7d902c02","82046002","be046002","c3070758","ff070758"],"Sakura":["00c4130a","41ff452d","82df2d48","c3ff5267","ffdf0d11"],"Aurora":["0001052d","4000c817","8000ff00","aa00f32d","c8008707","ff01052d"],"Atlantica":["00001c70","322060ff","6400f32d","960c5f52","c819be5f","ff28aa50"],"C9 2":["00067e02","2d067e02","2e041e72","5a041e72","5bff0500","87ff0500","88c43902","b4c43902","b5895502","ff895502"],"C9 New":["00ff0500","3cff0500","3dc43902","78c43902","79067e02","b4067e02","b5041e72","ff041e72"],"Temperature":["00145cab","0e0f6fba","1c068ed3","2a02a1e3","3810b5ef","4626bcc9","5456ccc8","638bdbb0","71b6e57d","7fc4e63f","8df1f016","9bfede1e","aafbc704","b8f79d09","c6f3720f","e2d51e1d","f0972623","ff972623"],"Aurora 2":["0011b10d","4079f205","8019ad79","c0fa4d7f","ffab65dd"],"Retro Clown":["00f2a826","75e24e50","ffa136e1"],"Candy":["00f3f217","0ff2a826","8e6f1597","c64a1696","ff000075"],"Toxy Reaf":["0002ef7e","ff9123d9"],"Fairy Reaf":["00dc13bb","a00ce1db","dbcbf2df","ffffffff"],"Semi Blue":["00000000","0c180426","35370854","502b309f","771f59ed","91323ba6","ba471e62","e91f0f2d","ff000000"],"Pink Candy":["00ffffff","2d3240ff","70f210ba","8cffffff","9bf210ba","c4740da6","ffffffff"],"Red Reaf":["00244472","6895c3f8","bcff0000","ff5e0e09"],"Aqua Flash":["00000000","4282f2f5","60ffff35","7cffffff","99ffff35","bc82f2f5","ff000000"],"Yelblu Hot":["002b1e39","3a490077","7a57004a","9ec53916","b7da751b","dbefb120","fff6f71b"],"Lite Light":["00000000","09141516","282e2b31","422e2b31","653d1041","ff000000"],"Red Flash":["00000000","63f20c08","82fde4a3","9bf20c08","ff000000"],"Blink Red":["00040704","2b28193e","4c3d0f24","6dcf2760","7fff9cb8","a5b949cf","cc6942f0","ff4d1d4e"],"Red Shift":["0062165d","2d671649","63c02d38","84ebbb3b","afe4551a","c9e43830","ff020002"],"Red Tide":["00fb2e00","1cff8b19","2bf69e3f","3af6d87b","54f35e0a","72b1410b","8cfff173","a8b1410b","c4fae99e","d8ff5e06","ff7e0804"],"Candy2":["006d6666","192a3147","30796054","49f1d61a","59d8682c","822a3147","a3ffb12f","baf1d61a","d36d6666","ff14130d"],"Traffic Light":["00000000","5500ff00","aaffff00","ffff0000"]};
// Effects that paint with the light's colours rather than the palette, and the
// ones that move to sound (from WLED's /json/fxdata)
const WLED_NOPAL = new Set(["Solid", "Image", "Stream 2", "Oscillate", "Pride 2015", "Copy Segment", "Solid Pattern Tri", "Solid Glitter", "Freqwave", "Freqmatrix", "Noisefire", "Matrix", "DJ Light", "Funky Plank", "Sun Radiation"]);
const WLED_AUDIO = new Set(["Pixels", "Pixelwave", "Juggles", "Matripix", "Gravimeter", "Plasmoid", "Puddles", "Midnoise", "Noisemeter", "Freqwave", "Freqmatrix", "GEQ", "Waterfall", "Freqpixels", "Noisefire", "Puddlepeak", "Noisemove", "Ripple Peak", "Freqmap", "Gravcenter", "Gravcentric", "Gravfreq", "DJ Light", "Funky Plank", "Blurz", "Waverly", "Swirl", "Rocktaves", "Akemi", "PS Spray", "PS GEQ 2D", "PS GEQ Nova", "PS Blobs", "PS GEQ 1D", "PS Sonic Stream", "PS Sonic Boom", "PS Springy"]);
// Hue's effects have no palette to read, so each gets the colours it is known for
const HUE_FX = {
  candle: ["fire", ["ff8a1c", "ffb35c", "ff7012", "ffc074"]], fire: ["fire", ["ff2a00", "ff6a00", "ffb000", "ff4500"]],
  prism: ["scroll", "r"], sparkle: ["twinkle", ["c1", "c1", "ffffff"]], glisten: ["twinkle", ["c1", "c3", "c1"]],
  opal: ["drift", ["ffd6e8", "c9f0ff", "fff3c4", "d8ffd6"]], underwater: ["drift", ["0040ff", "00a6c8", "00e0c0", "1a6bff"]],
  cosmos: ["drift", ["2a0a6b", "6a2bd9", "ff4fd8", "1a1a8c"]], sunbeam: ["breathe", ["ffd27a", "fff1c9", "ffb84d"]],
  enchant: ["drift", ["ff5fa2", "b45cff", "ffc0e0", "8a4dff"]], sunrise: ["still", ["2b1055", "d4386b", "ff9a3c", "ffe29a"]],
  sunset: ["still", ["ffe29a", "ff7b39", "c8305c", "2b1055"]],
};
const RAINBOW = [0, 51, 102, 153, 204, 255].map((p, i) => [p, ...hslRgb(i * 60)]);
function hslRgb(h) { const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; }
// Palette tokens to [pos, r, g, b] stops, spread evenly when they carry no position
function ledStops(list, c1) {
  if (list === "r" || list?.[0] === "r") return RAINBOW;
  const c2 = c1.map((v) => Math.round(v * 0.35)), c3 = c1.map((v) => Math.round(v + (255 - v) * 0.55));
  const cs = list.map((x) => (x === "c1" ? [null, ...c1] : x === "c2" ? [null, ...c2] : x === "c3" ? [null, ...c3]
    : x.length === 8 ? [parseInt(x.slice(0, 2), 16), ...[2, 4, 6].map((i) => parseInt(x.slice(i, i + 2), 16))] : [null, ...[0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16))]));
  if (cs.length === 1) cs.push([...cs[0]]);
  return cs.map((s, i) => (s[0] == null ? [Math.round((i / (cs.length - 1)) * 255), s[1], s[2], s[3]] : s));
}
function ledAt(stops, t) {
  const p = t * 255;
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1][0] <= p) i++;
  const a = stops[i], b = stops[i + 1] || [256, ...stops[0].slice(1)], f = b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map((k) => Math.round(a[k] + (b[k] - a[k]) * Math.max(0, Math.min(1, f))));
}
// Two periods side by side, so sliding it half its width loops without a seam
function ledGradient(stops) {
  const one = (off) => stops.map((s) => `rgb(${s[1]},${s[2]},${s[3]}) ${(off + (s[0] / 255) * 50).toFixed(1)}%`);
  const first = `rgb(${stops[0][1]},${stops[0][2]},${stops[0][3]})`;
  return `linear-gradient(90deg, ${[...one(0), `${first} 50%`, ...one(50), `${first} 100%`].join(", ")})`;
}
// How a WLED effect moves, by its name
function wledMotion(fx) {
  if (!fx || /^(solid|static|image|copy segment|solid pattern( tri)?)$/i.test(fx)) return "still";
  if (WLED_AUDIO.has(fx)) return "audio";
  if (/fire|candle|flame|lava|torch/i.test(fx)) return "fire";
  if (/breath|fade|heartbeat|pulse/i.test(fx)) return "breathe";
  if (/blink|strobe|lightning|flash|police/i.test(fx)) return "blink";
  if (/twink|sparkle|glitter|star|dissolve|popcorn|ripple|drip|rain|firework|pixel|juggle|danc|bounc|fairy|halloween|flicker|confetti|random/i.test(fx)) return "twinkle";
  if (/noise|plasma|lake|pacifica|aurora|flow|ocean|wave|cloud|perlin|blend|pride|drift/i.test(fx)) return "drift";
  return "scroll";
}
// What a strip shows: its colours and how they move
function stripLook({ wled, fx, pal, c1 }) {
  if (wled) {
    const usePal = !WLED_NOPAL.has(fx) && pal && WLED_PAL[pal];
    const motion = wledMotion(fx);
    return { stops: usePal ? ledStops(WLED_PAL[pal], c1) : ledStops(["c1", "c1"], c1), motion, usesPal: !!usePal };
  }
  const h = HUE_FX[String(fx || "").toLowerCase()];
  if (h) return { stops: ledStops(h[1], c1), motion: h[0], usesPal: false };
  const dim = c1.map((v) => Math.round(v * 0.72)), lift = c1.map((v) => Math.round(v + (255 - v) * 0.25));
  return { stops: [[0, ...dim], [96, ...c1], [160, ...lift], [224, ...c1]], motion: "still", usesPal: false };
}

class BentoControls extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.entities)) throw new Error("bento-controls needs entities");
    this._config = { title: "", tone: null, room_tone: null, strip: null, all: null, sun: "sun.sun", spark_hours: 24, font_scale: 1, ...config };
    this._config.entities = config.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
    this.style.setProperty("--bento-scale", this._config.font_scale);
    this._sig = null;
    this._series = {};
    this._daily = {};
    this._pending = {};
  }
  getCardSize() { return Math.ceil(this._config.entities.length / 2) + 1; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  connectedCallback() { if (!this._gutter) { this._gutter = true; pageGutter(true); } }
  disconnectedCallback() { this._ro?.disconnect(); this._ro = null; if (this._gutter) { this._gutter = false; pageGutter(false); } }

  set hass(hass) {
    hass = this._hass = pending(this).take(hass);
    if (this._drag) return; // never redraw under a finger
    if (this._picking && Date.now() - this._picking < 30000) return; // nor under an open dropdown
    const ids = this._config.entities.flatMap((e) => e.bars ? e.bars.map((b) => b.entity || b) : e.adaptive ? [e.adaptive, `${e.adaptive}_sleep_mode`] : e.strip ? [e.strip, e.palette, e.speed, e.intensity, e.reverse, e.freeze].filter(Boolean) : [e.board || e.entity]);
    const night = applyNight(this, isNight(hass, this._config.sun));
    const sig = JSON.stringify([night, this._cols, this._confirm, ids.map((id) => { const s = hass.states[id]; return s ? [s.state, s.attributes.brightness, s.attributes.rgb_color, s.attributes.media_title, s.attributes.volume_level, s.attributes.temperature, s.attributes.current_temperature, s.attributes.hvac_action, s.attributes.color_temp_kelvin, (s.attributes.manual_control || []).length, s.attributes.board, s.attributes.effect] : null; }), this._histSig || "", this._pending]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._night = night;
    keepScroll(() => this._render());
    if (!this._histAt || Date.now() - this._histAt > 300000) this._loadHistory();
  }

  // Tone for a tile: the room's own colour for lights in a room, otherwise by kind
  _tone(s, on) {
    const night = this._night, d = cDomain(s.entity_id), dc = s.attributes.device_class;
    if (!on) return offTone(night);
    if (d === "light") return lightTone(s.attributes, night);
    if (this._config.room_tone != null && C_TOGGLE.has(d)) { const t = roomTone(this._config.room_tone, night, true); return { ...t, accent: tone("act", night).accent }; }
    if (this._config.tone) return tone(this._config.tone, night);
    if (d === "media_player") return tone("media", night);
    if (d === "climate") return tone("climate", night);
    if (d === "lock" || d === "binary_sensor") return tone("act", night);
    if (d === "scene" || d === "script") return tone("scenes", night);
    if (d === "sensor") return tone(dc === "power" || dc === "energy" || dc === "humidity" ? "energy" : dc === "monetary" ? "money" : dc === "battery" ? "health" : "climate", night);
    return tone("today", night);
  }

  _isOn(s) {
    const d = cDomain(s.entity_id), st = s.state;
    if (st === "unavailable" || st === "unknown") return false;
    if (d === "media_player") return st === "playing" || st === "paused" || st === "on" || st === "buffering";
    if (d === "climate") return st !== "off";
    if (d === "lock") return st === "unlocked" || st === "open" || st === "jammed";
    if (d === "vacuum") return st === "cleaning" || st === "returning";
    if (d === "sensor" || d === "scene" || d === "script" || C_VALUE.has(d)) return true;
    return st === "on";
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    watchColumns(this, (w) => (w && w < 420 ? 2 : w && w < 760 ? 3 : 4));
    const h = this._hass, c = this._config, cols = this._cols || 4;
    const list = c.entities.filter((e) => e.bars || (e.adaptive && h.states[e.adaptive]) || (e.board && h.states[e.board]?.attributes?.board) || (e.strip && h.states[e.strip]) || h.states[e.entity]);
    const tiles = list.map((e, i) => {
      if (e.bars) return { id: `bars-${i}`, shape: e.shape || "F", e, s: null };
      if (e.adaptive) return { id: `al-${i}`, shape: e.shape || "W", e, s: null };
      if (e.board) return { id: `board-${i}`, shape: e.shape || "W", e, s: null };
      if (e.strip) return { id: e.strip, shape: e.shape || (h.states[e.strip].state !== "on" ? "W" : cols < 4 ? "FL" : "L"), e, s: null };
      const s = h.states[e.entity];
      const d = cDomain(e.entity), dc = s.attributes.device_class;
      let shape = e.shape || C_DOMAIN_SHAPE[d] || "S";
      // Charts want width on a wide screen; on a phone two small ones sit side by side
      if (!e.shape && d === "sensor" && ["power", "temperature", "humidity"].includes(dc)) shape = cols < 3 ? "S" : "W";
      // A player that is off is just a switch; only a busy one earns the wide tile
      if (!e.shape && d === "media_player" && !this._isOn(s)) shape = "S";
      // Under four columns a big chart takes the whole row (never two-thirds of it);
      // a big control shrinks to wide instead
      if (shape === "L" && cols < 4) shape = d === "sensor" ? "FL" : "W";
      return { id: e.entity, shape, e, s };
    });
    // Rather than stretch one lonely tile across the last row, widen a few small ones
    // (busy ones first) so the cells come out even
    const used = tiles.reduce((n, t) => n + Math.min(SHAPES[t.shape][0], cols) * SHAPES[t.shape][1], 0);
    let spare = (cols - (used % cols)) % cols;
    const small = tiles.filter((t) => t.s && t.shape === "S").sort((a, b) => Number(this._isOn(b.s)) - Number(this._isOn(a.s)));
    for (const t of small) { if (!spare) break; t.shape = "W"; spare -= 1; }
    const packed = BentoGrid.prototype._pack(tiles, cols, true).tiles;
    // Section header: a title, and one switch for everything switchable in it
    const switchable = list.filter((e) => e.strip || (e.entity && C_TOGGLE.has(cDomain(e.entity)))).map((e) => (e.strip ? { ...e, entity: e.strip } : e)).filter((e) => h.states[e.entity].state !== "unavailable");
    let all = "";
    if (c.all !== false && switchable.length > 1) {
      const any = switchable.some((e) => h.states[e.entity].state === "on");
      all = `<button class="all" data-all="${any ? "off" : "on"}">${any ? "All off" : "All on"}</button>`;
    }
    const snap = motionBefore(this);
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${BENTO_BASE_CSS}${CONTROLS_CSS}</style>
      ${c.title || all ? `<div class="head">${c.title ? `<span class="title">${esc(c.title)}</span>` : "<span></span>"}${all}</div>` : ""}
      <div class="grid ${this._night ? "is-night" : ""}" style="--cols:${cols}">${packed.map((t) => this._tile(t)).join("")}</div>`;
    this._wire(switchable);
    motionAfter(this, snap, { night: this._night });
  }

  // Which Adaptive Lighting tiles in this card have let go of a light (it was changed by hand)
  _manual(eid) {
    const s = this._hass.states[eid];
    const members = [eid, ...(Array.isArray(s?.attributes?.entity_id) ? s.attributes.entity_id : [])];
    return this._config.entities.some((e) => e.adaptive && (this._hass.states[e.adaptive]?.attributes?.manual_control || []).some((m) => members.includes(m)));
  }

  // The Vestaboard, from Vestassistant's read-back of the wall; changed flaps flip in
  _board(t) {
    const lines = this._hass.states[t.e.board].attributes.board, c = tone("night", this._night);
    const key = JSON.stringify(lines), b = this._boardSeen;
    if (!b || b.key !== key) this._boardSeen = { key, prev: b ? { lines: b.lines } : { lines: [] }, lines, at: Date.now() };
    const cur = this._boardSeen;
    return `<div class="tile board-tile on shape-${t.shape}" style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}">
      <div class="lbl">${esc(t.e.name || "Vestaboard")}</div>
      <div class="foot">${charts.board({ lines, prev: Date.now() - cur.at < 2500 ? cur.prev : null })}</div></div>`;
  }

  // An LED light whose whole tile is its effect: the palette it is really showing, moving
  // the way the effect moves, at the light's speed. Dropdowns pick the effect and palette.
  _strip(t) {
    const h = this._hass, e = t.e, eid = e.strip, s = h.states[eid], a = s.attributes, night = this._night;
    const on = s.state === "on", pend = this._pending[eid] || {};
    const palS = e.palette && h.states[e.palette];
    const fx = pend.effect ?? a.effect, pal = palS ? this._pending[e.palette]?.palette ?? palS.state : null;
    const num = (id, d) => { const v = id ? cNum(h.states[id]?.state) : NaN; return Number.isFinite(v) ? v : d; };
    const speed = num(e.speed, palS ? 128 : 70), frozen = e.freeze && h.states[e.freeze]?.state === "on";
    const c1 = a.rgb_color || (a.color_temp_kelvin ? kelvinRgb(a.color_temp_kelvin) : [255, 190, 120]);
    const look = stripLook({ wled: !!palS, fx, pal, c1 });
    const pct = on ? Math.round(((pend.brightness ?? a.brightness ?? 255) / 255) * 100) : 0;
    const fxWord = (v) => (!v || /^(off|none)$/i.test(v) ? (palS ? "Solid" : "No effect") : v.charAt(0).toUpperCase() + v.slice(1));
    const dur = (0.9 + (1 - speed / 255) * 9).toFixed(2);
    let layer = "";
    if (on) {
      let sparks = "";
      if (look.motion === "twinkle") {
        const n = t.w >= 4 ? 26 : 16;
        sparks = Array.from({ length: n }, (_, i) => {
          const col = rgbCss(ledAt(look.stops, i / n)), tt = (Number(dur) * (0.5 + ((i * 13) % 7) / 8)).toFixed(2), dl = (-((i * 37) % 23) / 23 * Number(dur) * 1.5).toFixed(2);
          return `<b style="left:${(i * 61 + 7) % 100}%;top:${(i * 37 + 17) % 100}%;--c:${col};--t:${tt}s;--dl:${dl}s"></b>`;
        }).join("");
      }
      layer = `<div class="fx ${look.motion}" style="--dur:${dur}s;--dir:${e.reverse && h.states[e.reverse]?.state === "on" ? "reverse" : "normal"};--play:${frozen ? "paused" : "running"};--dim:${((1 - pct / 100) * 0.55).toFixed(2)}"><span class="rot"><i style="background:${ledGradient(look.stops)}"></i></span>${sparks}</div>`;
    }
    const dd = (what, label, list, cur, word) => `<label class="dd"><span>${label}</span><b>${esc(word(cur))}</b><select data-sel="${what}" aria-label="${label}">${list.map((o) => `<option value="${esc(o)}"${o === cur ? " selected" : ""}>${esc(word(o))}</option>`).join("")}</select></label>`;
    const effects = a.effect_list || [];
    const controls = on ? `<div class="dds">${effects.length ? dd("effect", "Effect", effects, fx ?? (effects.includes("off") ? "off" : effects[0]), fxWord) : ""}${palS && look.usesPal ? dd("palette", "Palette", palS.attributes.options || [], pal, (o) => o) : ""}</div>
        <div class="slide" data-slide="brightness" data-v="${pct}"><i style="width:${pct}%"></i></div>` : "";
    const sub = on ? `${look.usesPal ? `${esc(pal)} · ` : ""}<span class="bri">${pct}%</span>` : "";
    const c = on ? { bg: "#141824", ink: "#ffffff" } : offTone(night);
    return `<div class="tile strip-tile shape-${t.shape} ${on ? "on" : "off"}" data-id="${esc(eid)}" data-pal="${esc(e.palette || "")}" role="button" tabindex="0"
        style="--bg:${c.bg};--ink:${c.ink};--accent:#ffffff;grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}">
      ${layer}<div class="lbl">${esc(e.name || cName(s, this._config.strip, h))}</div>
      <div class="txt"><div class="say">${esc(on ? fxWord(fx) : s.state === "unavailable" ? "Offline" : "Off")}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
      ${controls ? `<div class="foot">${controls}</div>` : ""}</div>`;
  }

  // An effect or palette picked from a dropdown goes straight to the light
  _choose(eid, pal, what, value) {
    const isPal = what === "palette", target = isPal ? pal : eid;
    this._picking = 0;
    if (isPal) this._call("select.select_option", { option: value }, target);
    else { pending(this).set(target, { attrs: { effect: value } }); this._call("light.turn_on", { effect: value }, target); }
  }

  // Adaptive Lighting: the tile is tinted the colour the lights are set to right now, with
  // the day's warm-to-cool range underneath and the dot where it sits
  _adaptive(t) {
    const h = this._hass, e = t.e, sw = h.states[e.adaptive], sleep = h.states[`${e.adaptive}_sleep_mode`]?.state === "on";
    const on = sw.state === "on", a = sw.attributes, night = this._night;
    const k = a.color_temp_kelvin || e.min || 2700, pct = a.brightness_pct;
    const rgb = sleep && a.rgb_color ? a.rgb_color : kelvinRgb(k);
    const tint = (base, f) => { const b = hex(base); return `rgb(${b.map((v, i) => Math.round(v + (rgb[i] - v) * f)).join(",")})`; };
    const c = !on ? offTone(night) : { bg: night ? tint("#141a2c", 0.32) : tint("#ffffff", 0.22), ink: night ? "#fff8f0" : "#1c2233" };
    const mine = (e.lights || []);
    // A zone can have its brightness or colour switch off (the Race Room key lights keep the
    // brightness they're given), so only count a light as "set by hand" for what the zone adapts
    const adaptsBri = h.states[`${e.adaptive}_adapt_brightness`]?.state !== "off";
    const adaptsCol = h.states[`${e.adaptive}_adapt_color`]?.state !== "off";
    const held = a.manual_control_brightness || a.manual_control_color
      ? [...(adaptsBri ? a.manual_control_brightness || [] : []), ...(adaptsCol ? a.manual_control_color || [] : [])]
      : a.manual_control || [];
    const manual = [...new Set(held)].filter((l) => !mine.length || mine.includes(l));
    const level = adaptsBri && pct ? ` · ${Math.round(pct)}%` : "";
    const say = !on ? "Paused" : sleep ? "Sleep mode" : `${kelvinWord(k)} · ${k.toLocaleString()}K`;
    const sub = !on ? "Lights stay as you set them" : manual.length ? `${manual.length} light${manual.length === 1 ? "" : "s"} set by hand` : sleep ? `Dim and warm${level}` : `Following the sun${level}`;
    const btns = [
      on && manual.length ? `<button class="pill sel" data-al="resume">Resume ${manual.length}</button>` : "",
      `<button class="pill ${sleep ? "sel" : ""}" data-al="sleep">Sleep</button>`,
      `<button class="pill" data-al="power">${on ? "Pause" : "Resume"}</button>`,
    ].join("");
    return `<div class="tile al shape-${t.shape} ${on ? "on" : "off"}" data-al-tile="${esc(e.adaptive)}" data-lights="${esc(manual.join(","))}"
        style="--bg:${c.bg};--ink:${c.ink};--accent:${rgbCss(rgb)};grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}">
      <div class="lbl">${esc(e.name || "Adaptive lighting")}</div>
      <div class="txt"><div class="say">${esc(say)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="foot">${on ? charts.kelvin({ value: k, min: e.min, max: e.max }) : ""}<div class="row">${btns}</div></div></div>`;
  }

  _tile(t) {
    if (t.e.bars) return this._bars(t);
    if (t.e.adaptive) return this._adaptive(t);
    if (t.e.board) return this._board(t);
    if (t.e.strip) return this._strip(t);
    const s = t.s, e = t.e, d = cDomain(s.entity_id), a = s.attributes;
    const on = this._isOn(s), off = s.state === "unavailable";
    const c = this._tone(s, on);
    // A room's temperature sensor reads "Temperature", not "Temp sensor temperature"
    const measure = d === "sensor" && ["temperature", "humidity"].includes(a.device_class);
    let name = e.name || (measure ? sentence(a.device_class) : cName(s, this._config.strip, this._hass));
    // "Front door" alone reads like the door sensor beside it
    if (!e.name && d === "lock" && !/lock/i.test(name)) name = `${name} lock`;
    let say = "", sub = "", body = "", foot = "", cls = "";
    const pending = this._pending[s.entity_id];
    if (off && d !== "sensor" && !C_VALUE.has(d)) { say = "Offline"; }
    else if (d === "light") {
      const pct = s.state === "on" ? Math.round(((pending?.brightness ?? a.brightness ?? 255) / 255) * 100) : 0;
      // A light with no dimmer just says On; its tile already wears the bulb's colour
      const dim = (a.supported_color_modes || []).some((m) => m !== "onoff");
      say = s.state === "on" ? (dim ? `${pct}%` : "On") : "Off";
      if (s.state === "on" && this._config.entities.some((x) => x.adaptive) && this._manual(s.entity_id)) sub = "Set by hand";
      if (dim) foot = `<div class="slide" data-slide="brightness" data-v="${pct}"><i style="width:${pct}%;${pct ? "" : "display:none"}"></i></div>`;
    } else if (C_TOGGLE.has(d)) {
      say = s.state === "on" ? "On" : "Off";
      const w = this._powerOf(s.entity_id);
      if (w != null && s.state === "on") sub = `Drawing ${cPower(w)}`;
    } else if (d === "media_player") {
      const playing = s.state === "playing";
      say = playing || s.state === "paused" ? a.media_title || (playing ? "Playing" : "Paused") : s.state === "off" || s.state === "standby" ? "Off" : "Idle";
      sub = [a.media_artist || a.media_series_title || a.app_name, s.state === "paused" ? "Paused" : ""].filter(Boolean).join(" · ");
      if (playing) body = charts.eq();
      const vol = Math.round((pending?.volume ?? a.volume_level ?? 0) * 100);
      const btns = on ? `<button class="pill" data-svc="media_player.media_play_pause">${playing ? "Pause" : "Play"}</button><button class="pill" data-svc="media_player.media_next_track">Next</button>`
                      : `<button class="pill" data-svc="media_player.turn_on">Turn on</button>`;
      foot = `<div class="row">${btns}</div>${on && a.volume_level != null ? `<div class="slide labelled" data-slide="volume" data-v="${vol}"><i style="width:${vol}%"></i><span>Volume ${vol}%</span></div>` : ""}`;
      cls = "media";
    } else if (d === "climate") {
      const cur = a.current_temperature, set = pending?.temperature ?? a.temperature;
      say = cur != null ? `${Math.round(cur)}°` : "—";
      const goal = set != null ? Math.round(set) : null;
      sub = s.state === "off" ? "Off" : goal == null ? sentence(s.state)
        : { cooling: `Cooling to ${goal}°`, heating: `Heating to ${goal}°`, drying: `Drying · set ${goal}°`, fan: `Fan running · set ${goal}°` }[a.hvac_action] || `Holding at ${goal}°`;
      // Same order on every thermostat, whatever order the integration reports
      const ORDER = ["off", "heat", "cool", "heat_cool", "auto"];
      const modes = ORDER.filter((m) => (a.hvac_modes || []).includes(m));
      const label = { off: "Off", heat: "Heat", cool: "Cool", heat_cool: "Auto", auto: "Auto" };
      foot = `${set != null && s.state !== "off" ? `<div class="setp"><button class="step" data-step="-1" aria-label="Cooler">−</button><b>${Math.round(set)}°</b><button class="step" data-step="1" aria-label="Warmer">+</button></div>` : ""}
        <div class="row">${modes.map((m) => `<button class="pill ${s.state === m ? "sel" : ""}" data-mode="${m}">${label[m]}</button>`).join("")}</div>`;
      cls = "climate";
    } else if (d === "lock") {
      const locked = s.state === "locked";
      say = locked ? "Locked" : s.state === "jammed" ? "Jammed" : sentence(s.state);
      foot = `<div class="row"><button class="pill ${this._confirm === s.entity_id ? "sel" : ""}" data-lock="${locked ? "unlock" : "lock"}">${locked ? (this._confirm === s.entity_id ? "Tap again to unlock" : "Unlock") : "Lock"}</button></div>`;
    } else if (d === "binary_sensor") {
      const dc = a.device_class;
      const words = { door: ["Closed", "Open"], window: ["Closed", "Open"], garage_door: ["Closed", "Open"], motion: ["Still", "Motion"], occupancy: ["Empty", "Someone's here"], moisture: ["Dry", "Wet!"], problem: ["OK", "Check it"] }[dc] || ["Off", "On"];
      say = words[s.state === "on" ? 1 : 0];
      sub = this._ago(s);
    } else if (d === "vacuum") {
      say = { cleaning: "Cleaning", docked: "Docked", returning: "Heading home", idle: "Idle", paused: "Paused", error: "Stuck" }[s.state] || sentence(s.state);
      foot = `<div class="row"><button class="pill" data-svc="${s.state === "cleaning" ? "vacuum.return_to_base" : "vacuum.start"}">${s.state === "cleaning" ? "Send home" : "Start"}</button></div>`;
    } else if (d === "scene" || d === "script") {
      say = name;
      sub = this._ran === s.entity_id ? "Done" : "Tap to set";
      cls = "run";
    } else if (d === "sensor") {
      const v = cNum(s.state), unit = a.unit_of_measurement || "", dc = a.device_class;
      say = cBlank(s.state) ? "—" : dc === "timestamp" ? cWhen(s.state) : Number.isNaN(v) ? cWords(s.state)
        : dc === "duration" ? cDuration(v, unit) : dc === "illuminance" ? `${Math.round(v)} lx` : dc === "power" ? cPower(v) : dc === "temperature" ? `${Math.round(v)}°` : dc === "monetary" ? `$${v.toFixed(2)}` : `${Math.round(v * 10) / 10}${unit === "%" ? "%" : unit ? " " + unit : ""}`;
      const chart = this._chart(e, s);
      if (chart === "spark" && this._series[s.entity_id]) {
        const vals = this._series[s.entity_id], kw = dc === "power" && Math.max(...vals) >= 1000;
        body = `<div class="bleed">${charts.spark(kw ? vals.map((w) => w / 1000) : vals, { color: c.accent, peak: dc === "power" && (t.shape === "L" || t.shape === "FL"), unit: kw ? " kW" : " W" })}</div>`;
        cls = "has-spark";
      } else if (chart === "bars" && this._daily[s.entity_id]) {
        const { vals, labels } = this._daily[s.entity_id], diff = vals[vals.length - 1] - vals[0];
        const u = unit ? ` ${unit}` : "";
        sub = Math.abs(diff) < 0.1 ? `Steady over ${vals.length} days` : `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff).toFixed(1)}${u} in ${vals.length} days`;
        foot = charts.dbars(vals, labels);
      }
    } else if (C_VALUE.has(d)) {
      const v = cNum(s.state), unit = a.unit_of_measurement || "";
      say = cBlank(s.state) ? "—"
        : /number$/.test(d) && !Number.isNaN(v) ? `${String(Math.round(v * 100) / 100)}${unit === "%" ? "%" : unit ? " " + unit : ""}`
        : /^\d{1,2}:\d{2}(:\d{2})?$/.test(s.state) ? new Date(`2000-01-01T${s.state.length === 5 ? s.state + ":00" : s.state}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : d === "text" || d === "input_text" ? String(s.state) : cWords(s.state);
    } else {
      say = cBlank(s.state) ? "—" : cWords(s.state);
    }
    const label = d === "scene" || d === "script" ? "Scene" : name;
    return `<div class="tile shape-${t.shape} ${on ? "on" : "off"} ${cls} ${c.dark ? "inkl" : ""}" data-id="${esc(s.entity_id)}" role="button" tabindex="0"
        style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}">
      <div class="lbl">${esc(label)}</div>
      <div class="txt"><div class="say">${esc(say)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      ${body}${foot ? `<div class="foot">${foot}</div>` : ""}</div>`;
  }

  // Ranked bars: what is drawing power right now, biggest first. Rows under a sliver
  // of the leader fold into "Everything else", so the list stays a list of answers.
  _bars(t) {
    const h = this._hass, night = this._night, c = tone(t.e.tone || "energy", night);
    const rows = t.e.bars.map((b) => (typeof b === "string" ? { entity: b } : b)).map((b) => {
      const s = h.states[b.entity];
      return s ? { id: b.entity, name: b.name || cName(s, this._config.strip, h), v: cNum(s.state) || 0 } : null;
    }).filter(Boolean).sort((x, y) => y.v - x.v);
    const max = Math.max(1, ...rows.map((r) => r.v)), top = t.e.top || 8;
    const big = rows.filter((r) => r.v >= max * 0.04);
    const shown = this._barsAll ? rows : rows.slice(0, top);
    const total = rows.reduce((n, r) => n + r.v, 0);
    const line = (r) => `<div class="bar" ${r.id ? `data-more="${esc(r.id)}"` : ""}><span class="bn">${esc(r.name)}</span><span class="bt"><i style="width:${Math.max(2, (r.v / max) * 100)}%"></i></span><b>${r.v < 5 ? "—" : cPower(r.v)}</b></div>`;
    return `<div class="tile bars-tile on shape-${t.shape}" style="--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};grid-column:${t.c + 1} / span ${t.w};grid-row:${t.r + 1} / span ${t.h}">
      <div class="lbl">${esc(t.e.name || "Right now")}</div>
      <div class="txt"><div class="say">${big.length ? `${esc(big[0].name)} is the big one` : "All quiet"}</div><div class="sub">${cPower(total)} across these circuits</div></div>
      <div class="foot bars">${shown.map(line).join("")}
        ${rows.length > top ? `<button class="pill more-bars" data-bars-all>${this._barsAll ? "Show fewer" : `Show all ${rows.length}`}</button>` : ""}</div></div>`;
  }

  // A plug's draw, when the plug has a power sensor beside it on the same device
  _powerOf(eid) {
    const h = this._hass, dev = h.entities?.[eid]?.device_id;
    if (!dev) return null;
    const p = Object.keys(h.states).find((id) => id.startsWith("sensor.") && h.entities?.[id]?.device_id === dev && h.states[id].attributes.device_class === "power");
    const v = p ? cNum(h.states[p].state) : NaN;
    return Number.isNaN(v) ? null : v;
  }
  _ago(s) {
    const mins = Math.round((Date.now() - new Date(s.last_changed).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} hr ago`;
    return `Since ${new Date(s.last_changed).toLocaleDateString(undefined, { weekday: "short" })}`;
  }

  _call(svc, data, eid) {
    const [d, s] = svc.split(".");
    pending(this).wrap(this._hass).callService(d, s, data || {}, eid ? { entity_id: eid } : undefined);
  }
  _more(eid) { moreInfo(this, eid); }

  _primary(eid) {
    const s = this._hass.states[eid], d = cDomain(eid);
    if (!s || s.state === "unavailable") return this._more(eid);
    if (C_TOGGLE.has(d)) return this._call("homeassistant.toggle", {}, eid);
    if (d === "media_player") return this._call(this._isOn(s) ? "media_player.media_play_pause" : "media_player.turn_on", {}, eid);
    if (d === "scene" || d === "script") { this._call(`${d}.turn_on`, {}, eid); this._ran = eid; this._sig = null; this.hass = this._hass; setTimeout(() => { this._ran = null; this._sig = null; this.hass = this._hass; }, 2000); return; }
    return this._more(eid);
  }

  _wire(switchable) {
    const root = this.shadowRoot;
    root.querySelector("[data-all]")?.addEventListener("click", (ev) => {
      const ids = switchable.map((e) => e.entity);
      this._call(ev.currentTarget.dataset.all === "off" ? "homeassistant.turn_off" : "homeassistant.turn_on", {}, ids);
    });
    root.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", () => this._more(el.dataset.more)));
    root.querySelectorAll("[data-bars-all]").forEach((el) => el.addEventListener("click", () => { this._barsAll = !this._barsAll; this._sig = null; this.hass = this._hass; }));
    root.querySelectorAll("[data-al-tile]").forEach((tile) => {
      const sw = tile.dataset.alTile, manual = tile.dataset.lights ? tile.dataset.lights.split(",") : [];
      tile.querySelectorAll("[data-al]").forEach((b) => b.addEventListener("click", () => {
        const what = b.dataset.al;
        if (what === "sleep") this._call("switch.toggle", {}, `${sw}_sleep_mode`);
        else if (what === "power") this._call("switch.toggle", {}, sw);
        else if (what === "resume" && manual.length) {
          // Hand the lights back, then adapt them now rather than at the next interval
          this._hass.callService("adaptive_lighting", "set_manual_control", { entity_id: sw, lights: manual, manual_control: false })
            .then(() => this._hass.callService("adaptive_lighting", "apply", {
              entity_id: sw, lights: manual, transition: 2,
              // apply adapts both unless told otherwise, whatever the zone's own switches say
              adapt_brightness: this._hass.states[`${sw}_adapt_brightness`]?.state !== "off",
              adapt_color: this._hass.states[`${sw}_adapt_color`]?.state !== "off",
            }));
        }
      }));
    });
    root.querySelectorAll(".tile[data-id]").forEach((el) => {
      const eid = el.dataset.id;
      bindTap(el, { tap: () => this._primary(eid), hold: () => this._more(eid) });
      el.querySelectorAll("[data-svc]").forEach((b) => b.addEventListener("click", () => this._call(b.dataset.svc, {}, eid)));
      el.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => this._call("climate.set_hvac_mode", { hvac_mode: b.dataset.mode }, eid)));
      el.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => this._step(eid, Number(b.dataset.step))));
      el.querySelectorAll("[data-lock]").forEach((b) => b.addEventListener("click", () => {
        if (b.dataset.lock === "lock") return this._call("lock.lock", {}, eid);
        // Unlocking takes two taps, so a brush past the tile cannot open the door
        const redraw = () => { this._sig = null; this.hass = this._hass; };
        confirmTap(this, eid, { run: () => { this._call("lock.unlock", {}, eid); redraw(); }, render: redraw });
      }));
      el.querySelectorAll("select[data-sel]").forEach((sel) => {
        sel.addEventListener("focus", () => { this._picking = Date.now(); });
        sel.addEventListener("blur", () => { if (!this._picking) return; this._picking = 0; this._sig = null; this.hass = this._hass; });
        sel.addEventListener("change", () => this._choose(eid, el.dataset.pal, sel.dataset.sel, sel.value));
      });
      el.querySelectorAll(".slide").forEach((bar) => this._slider(bar, eid));
    });
  }

  // Drag along the foot of a tile; the value is sent once, when the finger lifts
  _slider(bar, eid) {
    const kind = bar.dataset.slide, fill = bar.querySelector("i"), lbl = bar.querySelector("span");
    let v = Number(bar.dataset.v);
    const at = (ev) => { const r = bar.getBoundingClientRect(); return Math.max(kind === "brightness" ? 1 : 0, Math.min(100, Math.round(((ev.clientX - r.left) / r.width) * 100))); };
    const show = () => { fill.style.width = `${v}%`; fill.style.display = ""; if (lbl) lbl.textContent = `Volume ${v}%`; const say = bar.closest(".tile").querySelector(".bri, .say"); if (kind === "brightness" && say) say.textContent = `${v}%`; };
    bar.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); this._drag = true; bar.setPointerCapture(ev.pointerId); v = at(ev); show(); });
    bar.addEventListener("pointermove", (ev) => { if (!this._drag) return; v = at(ev); show(); });
    const done = () => {
      if (!this._drag) return;
      this._drag = false;
      if (kind === "brightness") this._call("light.turn_on", { brightness_pct: v }, eid);
      else this._call("media_player.volume_set", { volume_level: v / 100 }, eid);
    };
    bar.addEventListener("pointerup", done); bar.addEventListener("pointercancel", done);
    bar.addEventListener("click", (ev) => ev.stopPropagation());
  }

  // Setpoint taps collect for a moment, then go as one call
  _step(eid, dir) {
    // The setpoint on screen already includes earlier taps that haven't gone out yet
    const s = this._hass.states[eid], a = s.attributes, stepBy = a.target_temp_step || 1;
    const next = Math.max(a.min_temp ?? 40, Math.min(a.max_temp ?? 95, a.temperature + dir * stepBy));
    pending(this).set(eid, { attrs: { temperature: next } }, { ttl: 20000 });
    pending(this).later(eid, 700, () => this._call("climate.set_temperature", { temperature: next }, eid));
  }

  // A sensor's chart: what its config asks for (chart: spark | bars | none), else a
  // line for the readings that move through the day
  _chart(e, s) {
    if (e.chart) return e.chart === "none" ? null : e.chart;
    return cDomain(s.entity_id) === "sensor" && ["power", "temperature", "humidity"].includes(s.attributes.device_class) ? "spark" : null;
  }

  async _loadHistory() {
    this._histAt = Date.now();
    const h = this._hass, end = Date.now();
    const want = this._config.entities.filter((e) => e.entity && h.states[e.entity] && this._chart(e, h.states[e.entity]));
    await Promise.all(want.map(async (e) => {
      const id = e.entity;
      if (this._chart(e, h.states[id]) === "bars") {
        // Daily averages, midnight to midnight, today last
        const days = e.days || 14, start = midnight() - (days - 1) * 86400000;
        const vals = bucket(await history(h, id, start), start, start + days * 86400000, days).slice(0, days);
        const labels = vals.map((v, i) => `${new Date(start + i * 86400000).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} · ${v.toFixed(1)}`);
        this._daily[id] = { vals, labels };
      } else {
        const start = end - (e.hours || this._config.spark_hours) * 3600000;
        this._series[id] = smooth(bucket(await history(h, id, start), start, end, 48));
      }
    }));
    const hs = JSON.stringify([this._series, this._daily]);
    if (hs !== this._histSig) { this._histSig = hs; this._sig = null; this.hass = this._hass; }
  }
}
// Tiles, eyebrow, words, pills, setpoints and the focus ring are bento-core's (the canonical
// scale is this card's); what follows is only the controls' own.
const CONTROLS_CSS = `
  :host { font-family: var(--b-body); }
  .all { background: var(--primary-text-color, #1c2233); color: var(--card-background-color, #fff); }
  .grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(var(--b-row), auto); gap: var(--b-gap); }
  .row { align-items: normal; }
  .shape-L .say, .shape-FL .say { font-size: var(--b-say-big); line-height: var(--b-say-big-line); } .climate.shape-W .say { font-size: 2.2em; }
  .run .say { font-size: 1.25em; }
  .media.on .pill { background: var(--b-pill-bg-night); }
  .slide { position: relative; height: 12px; border-radius: var(--b-r-full); background: rgba(28,34,51,.1); cursor: ew-resize; touch-action: none; margin-top: var(--b-s-2xs); }
  .slide::before { content: ""; position: absolute; inset: -12px 0; }
  .is-night .slide, .media.on .slide { background: rgba(255,255,255,.18); }
  .slide i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--b-r-full); background: var(--accent); min-width: 12px; }
  .media.on .slide i { background: #fff; }
  .slide.labelled { height: var(--b-c-sm); border-radius: var(--b-r-sm); } .slide.labelled i { border-radius: var(--b-r-sm); opacity: .55; }
  .slide.labelled span { position: relative; display: block; line-height: var(--b-c-sm); padding-left: var(--b-s-md); font-size: 0.78em; font-weight: 800; pointer-events: none; }
  .media .eq { position: absolute; right: 14px; top: 12px; height: 22px; }
  .has-spark { grid-template-rows: auto auto 1fr; padding-bottom: 0; } .has-spark .txt { align-self: start; }
  .bleed { position: relative; margin: 0 calc(-1 * var(--b-s-lg)); min-height: 48px; }
  .bleed .spark { inset: 14px 0 0 0; }
  .bleed .spark svg { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; height: 100%; }
  .bleed .spark .end { position: absolute; width: 8px; height: 8px; border-radius: 50%; transform: translate(-50%, -50%); }
  .bleed .spark .peak { position: absolute; transform: translate(-50%, -150%); font-size: 0.74em; font-weight: 800; }
  .bars-tile, .al { cursor: default; grid-template-rows: auto auto 1fr; }
  .al .txt { align-self: start; }
  .al .foot { align-self: end; }
  .al .sub { white-space: normal; }
  /* All rows share one grid: names as wide as the longest name, values as wide as the
     longest value, and the bars take everything between, at any width */
  .bars { display: grid; grid-template-columns: minmax(0, max-content) minmax(48px, 1fr) max-content; column-gap: var(--b-s-md); row-gap: var(--b-s-sm); align-items: center; align-self: end; font-size: 0.9em; font-weight: 700; }
  .bar { display: contents; }
  .bar[data-more] > * { cursor: pointer; }
  .bar .bn { max-width: 12em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar .bt { height: 14px; border-radius: var(--b-r-full); background: rgba(28,34,51,.07); overflow: hidden; }
  .is-night .bar .bt { background: rgba(255,255,255,.1); }
  .bar .bt i { display: block; height: 100%; border-radius: var(--b-r-full); background: var(--accent); }
  .bar b { text-align: right; font-family: var(--b-display); font-weight: 800; }
  .more-bars { grid-column: 1 / -1; justify-self: start; margin-top: var(--b-s-2xs); font-size: 0.96em; }
  .tile.inkl .slide, .tile.inkl .pill { background: rgba(255,255,255,.2); }
  .strip-tile { grid-template-rows: auto auto 1fr; isolation: isolate; }
  .strip-tile > :not(.fx) { position: relative; z-index: 1; }
  .strip-tile .txt { align-self: start; }
  .strip-tile .foot { align-self: end; }
  .strip-tile.shape-L .say, .strip-tile.shape-FL .say { font-size: 2em; }
  .strip-tile.on .say, .strip-tile.on .sub, .strip-tile.on .lbl { text-shadow: 0 1px 3px rgba(0,0,0,.35); }
  .strip-tile.on .slide { background: rgba(255,255,255,.22); }
  .fx { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; z-index: 0; pointer-events: none; }
  /* The bands run at an angle: the scrolling layer sits in a tilted frame big enough to cover any tile */
  .fx .rot { position: absolute; left: 50%; top: 50%; width: 180%; height: 260%; transform: translate(-50%, -50%) rotate(-24deg); }
  .fx i { position: absolute; top: 0; bottom: 0; left: 0; width: 200%; filter: blur(16px) saturate(1.15); }
  /* A scrim so the words stay readable on any palette, plus the light's dimness */
  .fx::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.4), rgba(0,0,0,.04) 42%, rgba(0,0,0,.34)), linear-gradient(rgba(0,0,0,var(--dim)), rgba(0,0,0,var(--dim))); }
  .fx b { position: absolute; z-index: 2; width: 12px; height: 12px; margin: calc(-1 * var(--b-s-sm)); border-radius: 50%; background: var(--c); box-shadow: 0 0 14px 4px var(--c); animation: ledtw var(--t) ease-in-out var(--dl) infinite; }
  .fx, .fx * { animation-play-state: var(--play) !important; }
  .fx.scroll i { animation: ledscroll var(--dur) linear infinite var(--dir); }
  .fx.drift i { animation: ledscroll calc(var(--dur) * 3) ease-in-out infinite alternate; }
  .fx.breathe i { animation: fxbreathe var(--dur) ease-in-out infinite; }
  .fx.fire i { animation: ledscroll calc(var(--dur) * 4) linear infinite var(--dir), fxflicker calc(var(--dur) * .4) steps(1) infinite; }
  .fx.blink i { animation: fxblink calc(var(--dur) * .3) steps(1) infinite; }
  .fx.audio i { animation: ledscroll var(--dur) linear infinite var(--dir), fxbeat calc(var(--dur) * .35) ease-in-out infinite; }
  .fx.twinkle i { opacity: .45; }
  @keyframes ledscroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes ledtw { 0%, 100% { opacity: .1; transform: scale(.6); } 50% { opacity: 1; transform: scale(1); } }
  @keyframes fxbreathe { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
  @keyframes fxblink { 50% { opacity: .1; } }
  @keyframes fxflicker { 0% { opacity: 1; } 14% { opacity: .8; } 29% { opacity: .96; } 47% { opacity: .72; } 63% { opacity: 1; } 81% { opacity: .86; } }
  @keyframes fxbeat { 0%, 100% { opacity: .62; } 20% { opacity: 1; } 45% { opacity: .78; } 60% { opacity: .98; } 80% { opacity: .7; } }
  @media (prefers-reduced-motion: reduce) { .fx, .fx * { animation: none !important; } }
  /* Effect and palette: the same pill as every other control, with a native select laid
     invisibly over it so the phone's own picker opens */
  .dds { display: flex; flex-wrap: wrap; gap: var(--b-s-sm); }
  .dd { position: relative; display: inline-flex; align-items: baseline; gap: var(--b-s-sm); min-width: 0; max-width: 100%; border-radius: var(--b-r-full); padding: var(--b-s-sm) var(--b-s-xl) var(--b-s-sm) var(--b-s-md);
    font-size: 0.86em; font-weight: 800; white-space: nowrap; cursor: pointer; background: rgba(255,255,255,.16); }
  .dd span { opacity: .7; }
  .dd b { font-weight: 800; overflow: hidden; text-overflow: ellipsis; }
  .dd select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; -webkit-appearance: none; appearance: none; }
  .dd select option { color: #1c2233; background: #fff; }
  .dd:focus-within { outline: var(--b-ring) solid var(--accent, var(--b-focus)); outline-offset: 2px; }
  .dd::after { content: ""; position: absolute; right: 12px; top: 50%; width: 5px; height: 5px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
    transform: translateY(-70%) rotate(45deg); opacity: .8; pointer-events: none; }
  .board-tile { cursor: default; grid-template-rows: auto 1fr; }
  .board-tile .foot { align-self: end; }
  .vb { display: grid; grid-template-columns: repeat(var(--vb-cols, 15), minmax(0, 1fr)); gap: var(--b-s-2xs); container-type: inline-size; perspective: 400px; }
  .vb b { aspect-ratio: 3 / 4; border-radius: var(--b-r-xs); background: rgba(255,255,255,.07); color: #f4f1ea; display: grid; place-items: center;
    font-family: var(--b-display); font-weight: 800; font-size: max(7px, 4.4cqi); line-height: 1; backface-visibility: hidden; }
  .vb b.flip { animation: vbflip .5s cubic-bezier(.3, .7, .4, 1) var(--d, 0ms) both; transform-origin: 50% 50%; }
  @keyframes vbflip { 0% { transform: rotateX(90deg); opacity: .2; } 60% { transform: rotateX(-14deg); opacity: 1; } 100% { transform: rotateX(0); } }
  .dbars { display: flex; align-items: flex-end; gap: var(--b-s-xs); height: 46px; }
  .dbars i { flex: 1; min-width: 0; border-radius: 3px 3px 1px 1px; background: var(--accent); opacity: .45; }
  .dbars i.now { opacity: 1; }
  .eq { display: flex; gap: var(--b-s-xs); align-items: flex-end; }
  .eq b { width: 5px; height: 100%; border-radius: var(--b-r-xs); background: currentColor; transform-origin: bottom; animation: eqb 1s ease-in-out infinite alternate; }
  .eq b:nth-child(2) { animation-delay: -.3s; } .eq b:nth-child(3) { animation-delay: -.6s; } .eq b:nth-child(4) { animation-delay: -.9s; }
  @keyframes eqb { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
`;

// Navigate inside the dashboard, remembering which tab to come back to
function bentoNavigate(basePath, path, tab) {
  if (tab) { try { sessionStorage.setItem("bento-tab", tab); } catch (e) { /* storage blocked */ } }
  const base = basePath || window.location.pathname.split("/").slice(0, 2).join("/");
  window.history.pushState(null, "", path.startsWith("/") ? path : `${base}/${path}`);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

customElements.define("bento-grid", BentoGrid);
customElements.define("bento-sky", BentoSky);
customElements.define("bento-tabs", BentoTabs);
customElements.define("bento-rooms", BentoRooms);
customElements.define("bento-room", BentoRoom);
customElements.define("bento-controls", BentoControls);
window.customCards = window.customCards || [];
window.customCards.push(
  { type: "bento-grid", name: "Bento grid", description: "The landing-page bento, drawn from sensor.bento_tiles." },
  { type: "bento-sky", name: "Bento sky", description: "A sky header that follows the sun and the weather." },
  { type: "bento-tabs", name: "Bento tabs", description: "Tabs under the header; each tab holds a list of cards." },
  { type: "bento-rooms", name: "Bento rooms", description: "A card per room, coloured when its lights are on, that opens the room's page." },
  { type: "bento-room", name: "Bento room", description: "The header for a room's page." },
  { type: "bento-controls", name: "Bento controls", description: "Lights, media, climate, locks and sensors as bento tiles." },
);
console.info(`%c BENTO %c ${BENTO_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
