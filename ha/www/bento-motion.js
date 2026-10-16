// Bento motion - how bento tiles move. Imported by bento-cards.js with its own ?v=.
//
// The cards redraw by replacing their markup, so nothing on a tile can transition on its own.
// Instead each card takes a snapshot before a redraw (motionBefore) and hands it back after
// (motionAfter). Tiles are matched by key (data-k, data-id, data-room, data-al-tile, else
// their position) and the difference is animated on the new elements:
//   - colour change: floods out from where you tapped (a tap on that tile in the last 4 s),
//     rolls across the page at sunset/sunrise, otherwise a short crossfade
//   - numbers in the words count from the old value to the new one
//   - an armed two-tap button wiggles and drains a 4 s bar
// An animation still running when the next redraw lands is replayed on the new element from
// the same point, so a redraw never restarts or cuts one short.
// Also here: the press squish and hold fill (CSS), arrivals, and chore confetti.
// Everything is skipped under prefers-reduced-motion.
export const BENTO_MOTION_VERSION = "1.0.1";

const SPRING_CURVE = "linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017 19.4%, 1.067, 1.099 24.3%, 1.108 26%, 1.104, 1.092 30.6%, 1.035 39.5%, 1.007 46.2%, 0.996 51%, 0.993 56%, 1.001 72.6%, 1)";
export const EASE_SPRING = window.CSS?.supports?.("transition-timing-function", SPRING_CURVE) ? SPRING_CURVE : "cubic-bezier(.34, 1.56, .64, 1)";
const EASE_OUT = "cubic-bezier(.2, .8, .2, 1)";
const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// iOS only fires :active when something listens for touches
document.addEventListener("touchstart", () => {}, { passive: true });

export const MOTION_CSS = `
  :host { --b-spring: ${EASE_SPRING}; }
  /* Press: the tile squishes under a finger, unless the finger is on one of its own controls */
  .tile[role="button"], .tile[data-tap], .room { transition: transform .5s var(--b-spring), background-color var(--b-t-tile, .25s) ease; }
  :is(.tile[role="button"], .tile[data-tap], .room):active:not(:has(button:active, select:active, input:active, label:active, .slide:active, [data-more]:active, [data-part]:active)) {
    transform: scale(.965); transition-duration: .14s, var(--b-t-tile, .25s); transition-timing-function: ease-out, ease; }
  :is(.pill, .act, .sbtn, .bulb, .b, .back, .all, .step, .btn-base, .tick) { transition: transform .4s var(--b-spring), background-color .2s ease, color .2s ease, opacity .2s ease; }
  :is(.pill, .act, .sbtn, .bulb, .b, .back, .all, .step, .btn-base, .tick):active:not(:disabled) { transform: scale(.9); transition-duration: .1s; }
  /* Hold: the tile fills from the bottom while it is held, and opens at the top */
  .tile[role="button"] { isolation: isolate; }
  .tile[role="button"]::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
    background: color-mix(in srgb, var(--ink, #1c2233) 13%, transparent); transform: scaleY(0); transform-origin: 50% 100%; transition: transform .18s ease; }
  .tile[role="button"].holding::before { transform: scaleY(1); transition: transform .4s linear .12s; }
  /* Armed two-tap buttons drain a bar over the four seconds they stay armed */
  .act.armed, [data-lock].sel { position: relative; overflow: hidden; }
  .act.armed::after, [data-lock].sel::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 3px; height: 2px; border-radius: 2px; background: currentColor; opacity: .85;
    transform-origin: 0 50%; animation: b-drain 4s linear var(--armed-ago, 0ms) forwards; }
  @keyframes b-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  /* A chore ticked off: the circle fills, the check draws, the words cross out */
  .list li { text-decoration: line-through transparent 2px; transition: text-decoration-color .25s ease .1s, opacity .3s ease .1s; }
  .list li.done { text-decoration-color: currentColor; opacity: .6; }
  .tick.done { position: relative; background: var(--b-ok); box-shadow: none; opacity: 1; transform: scale(1.15); }
  .tick.done::after { content: ""; position: absolute; left: 7px; top: 3.5px; width: 4.5px; height: 9px; border: solid #fff; border-width: 0 2.5px 2.5px 0; transform: rotate(45deg);
    animation: b-check .22s ease-out .06s backwards; }
  @keyframes b-check { from { clip-path: inset(0 0 100% 0); } }
  @media (prefers-reduced-motion: reduce) { .tile[role="button"]::before { display: none; } }
`;

const TILE = ".tile, .room, .hero";
const OWN = "button,a,input,select,label,.slide,.dd,[data-more],[data-part],[data-no-tap]";
const keyOf = (el, i) => el.dataset.k || el.dataset.id || el.dataset.room || el.dataset.alTile || `#${i}`;
const tilesOf = (root) => (root ? [...root.querySelectorAll(TILE)] : []);
function textsOf(el) {
  const out = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("style,select,option,svg") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  while (w.nextNode()) out.push(w.currentNode);
  return out;
}

function state(card) {
  if (!card._mo) card._mo = { fx: new Map(), tweens: new Map(), els: new Map(), armed: {}, tap: null, seen: false, night: undefined, arriveNext: null, bound: null };
  return card._mo;
}

// Tap points and the hold fill, once per shadow root
function bind(card) {
  const mo = state(card), root = card.shadowRoot;
  if (!root || mo.bound === root) return;
  mo.bound = root;
  let holdT = null;
  const release = () => { clearTimeout(holdT); mo.holding?.classList.remove("holding"); mo.holding = null; };
  root.addEventListener("pointerdown", (ev) => {
    const tile = ev.target.closest?.(TILE);
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    const i = tilesOf(root).indexOf(tile);
    mo.tap = { key: keyOf(tile, i), x: ev.clientX - r.left, y: ev.clientY - r.top, t: performance.now() };
    mo.touched = { key: mo.tap.key, t: mo.tap.t };
    if (calm() || !tile.matches('.tile[role="button"]') || ev.target.closest(OWN)) return;
    release();
    tile.classList.add("holding");
    mo.holding = tile;
    holdT = setTimeout(() => {
      if (mo.holding !== tile) return;
      release();
      tile.animate([{ transform: "scale(.95)" }, { transform: "none" }], { duration: 450, easing: EASE_SPRING });
    }, 520);
  }, true);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  root.addEventListener("scroll", release, true);
}

// Run an effect on a tile and remember it, so a redraw can pick it up where it left off.
// An effect of the same kind on the same tile replaces the one before it.
function play(mo, key, el, fx) {
  let per = mo.fx.get(key);
  if (!per) mo.fx.set(key, (per = new Map()));
  per.get(fx.kind)?.anim?.cancel();
  per.set(fx.kind, fx);
  run(fx, el, performance.now());
}
function run(fx, el, now) {
  fx.setup?.(el);
  const a = el.animate(fx.kf, fx.opts);
  a.currentTime = Math.max(0, now - fx.start);
  a.onfinish = () => fx.cleanup?.(el);
  fx.anim = a;
}
const ends = (fx) => fx.start + (fx.opts.delay || 0) + fx.opts.duration;

export function motionBefore(card) {
  const root = card.shadowRoot, snap = new Map();
  tilesOf(root).forEach((el, i) => {
    const cs = getComputedStyle(el);
    snap.set(keyOf(el, i), { bg: cs.backgroundColor, ink: cs.color, texts: textsOf(el).map((n) => n.data) });
  });
  return snap;
}

export function motionAfter(card, snap, { night } = {}) {
  const mo = state(card), root = card.shadowRoot;
  bind(card);
  const tiles = tilesOf(root), now = performance.now();
  const first = !mo.seen;
  const flipped = mo.night !== undefined && mo.night !== night;
  mo.seen = true;
  mo.night = night;
  mo.els = new Map(tiles.map((el, i) => [keyOf(el, i), el]));

  // Armed buttons: when they armed is remembered, so a redraw doesn't refill the bar
  const armedNow = new Set();
  tiles.forEach((el, i) => {
    const b = el.querySelector(".act.armed, [data-lock].sel");
    if (!b) return;
    const k = keyOf(el, i);
    armedNow.add(k);
    if (mo.armed[k] == null) {
      mo.armed[k] = now;
      if (!calm()) b.animate([{ transform: "rotate(0)" }, { transform: "rotate(-6deg) scale(1.06)" }, { transform: "rotate(5deg) scale(1.06)" }, { transform: "rotate(-3deg)" }, { transform: "none" }], { duration: 450, easing: "ease" });
    }
    b.style.setProperty("--armed-ago", `-${Math.round(now - mo.armed[k])}ms`);
  });
  for (const k of Object.keys(mo.armed)) if (!armedNow.has(k)) delete mo.armed[k];

  if (calm()) return;
  if (first) {
    arriveTiles(card, tiles, mo.arriveNext || "pop");
    mo.arriveNext = null;
    return;
  }

  // Pick up anything still running from before this redraw
  for (const [k, per] of mo.fx) {
    const el = mo.els.get(k);
    for (const [kind, fx] of per) {
      if (now >= ends(fx)) { per.delete(kind); continue; }
      if (el) run(fx, el, now);
    }
    if (!per.size) mo.fx.delete(k);
  }

  tiles.forEach((el, i) => {
    const k = keyOf(el, i), was = snap?.get(k);
    if (!was) return;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor, ink = cs.color;
    if (was.bg !== bg) {
      const tap = mo.tap && mo.tap.key === k && now - mo.tap.t < 4000 ? mo.tap : null;
      if (tap) {
        // The new colour spills out from the finger
        mo.tap = null;
        const w = el.offsetWidth, h = el.offsetHeight;
        const r = Math.ceil(Math.max(Math.hypot(tap.x, tap.y), Math.hypot(w - tap.x, tap.y), Math.hypot(tap.x, h - tap.y), Math.hypot(w - tap.x, h - tap.y))) + 2;
        // A disc of the new colour grows over the old one (held by the animation, so nothing
        // transitions when it ends)
        play(mo, k, el, {
          kind: "color", start: now,
          setup: (e) => { e.style.backgroundImage = `radial-gradient(circle closest-side, ${bg} 97%, transparent 100%)`; e.style.backgroundRepeat = "no-repeat"; },
          cleanup: (e) => { e.style.backgroundImage = ""; e.style.backgroundRepeat = ""; },
          kf: [
            { backgroundColor: was.bg, backgroundSize: "0px 0px", backgroundPosition: `${tap.x}px ${tap.y}px`, color: was.ink },
            { backgroundColor: was.bg, backgroundSize: `${r * 2}px ${r * 2}px`, backgroundPosition: `${tap.x - r}px ${tap.y - r}px`, color: ink },
          ],
          opts: { duration: 650, easing: "cubic-bezier(.3, .7, .2, 1)" },
        });
      } else {
        // Sunset rolls down and across the page; anything else just crossfades
        const pos = el.getBoundingClientRect();
        const delay = flipped ? Math.round(Math.max(0, Math.min(900, pos.top * 0.45 + pos.left * 0.25))) : 0;
        play(mo, k, el, {
          kind: "color", start: now,
          kf: [{ backgroundColor: was.bg, color: was.ink }, { backgroundColor: bg, color: ink }],
          opts: { duration: flipped ? 800 : 350, delay, easing: "ease", fill: "backwards" },
        });
      }
    }
    countTexts(card, k, was.texts, el, now);
  });
}

// Numbers that changed count from the old value to the new one. Only when the words around
// them stayed the same, and never in clock times or dates.
const NUM = /\d+(?:\.\d+)?/g;
function countTexts(card, k, oldTexts, el, now) {
  const mo = card._mo, nodes = textsOf(el);
  // A number you're changing yourself (a setpoint under your thumb) jumps straight there;
  // counting is for changes that come from the house
  if (mo.touched?.key === k && now - mo.touched.t < 5000) {
    for (const id of mo.tweens.keys()) if (id.startsWith(`${k}|`)) mo.tweens.delete(id);
    return;
  }
  if (!oldTexts || nodes.length !== oldTexts.length) return;
  nodes.forEach((n, j) => {
    const a = oldTexts[j], b = n.data;
    if (a === b || /[:/]/.test(b) || a.replace(NUM, "#") !== b.replace(NUM, "#")) return;
    const to = (b.match(NUM) || []).map(Number), from = (a.match(NUM) || []).map(Number);
    if (!to.length || to.length > 3 || to.length !== from.length) return;
    const dec = (b.match(NUM) || []).map((s) => (s.split(".")[1] || "").length);
    // The text keeps its new value; the first frame (which runs before paint) rewinds it. A page
    // that never gets a frame, like a background tab, just shows the right number.
    mo.tweens.set(`${k}|${j}`, { k, j, from, to, dec, tpl: b, start: now, dur: 700 });
  });
  if (mo.tweens.size && !mo.raf) mo.raf = requestAnimationFrame((t) => tick(card, t));
}
function tick(card, t) {
  const mo = card._mo;
  mo.raf = null;
  for (const [id, tw] of mo.tweens) {
    const p = Math.min(1, (t - tw.start) / tw.dur), e = 1 - Math.pow(1 - p, 3);
    const el = mo.els.get(tw.k), node = el && textsOf(el)[tw.j];
    if (node) {
      let i = 0;
      node.data = tw.tpl.replace(NUM, () => { const v = tw.from[i] + (tw.to[i] - tw.from[i]) * e; const s = v.toFixed(tw.dec[i]); i++; return s; });
    }
    if (p >= 1 || !node) mo.tweens.delete(id);
  }
  if (mo.tweens.size) mo.raf = requestAnimationFrame((t2) => tick(card, t2));
}

// Arrivals: tiles pop in one after another, or slide in from the side a tab change came from
function arriveTiles(card, tiles, mode) {
  if (calm() || !tiles.length) return;
  const mo = state(card), now = performance.now();
  // Delay by where the tile sits on screen, not its order in this card, so every card on a page
  // ripples down as one
  tiles.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const delay = Math.round(Math.min(480, Math.max(0, r.top) * 0.4 + Math.max(0, r.left) * 0.15));
    const kf = mode === "pop"
      ? [{ opacity: 0, transform: "scale(.84)" }, { opacity: 1, transform: "none" }]
      : [{ opacity: 0, transform: `translateX(${mode === "left" ? -28 : 28}px)` }, { opacity: 1, transform: "none" }];
    play(mo, keyOf(el, i), el, {
      kind: "arrive", start: now, kf,
      opts: { duration: mode === "pop" ? 700 : 500, delay, easing: mode === "pop" ? EASE_SPRING : EASE_OUT, fill: "backwards" },
    });
  });
}
const MOTION_TAGS = new Set(["BENTO-GRID", "BENTO-ROOMS", "BENTO-ROOM", "BENTO-CONTROLS"]);
// mode: pop | left | right. A card that hasn't drawn yet arrives that way when it first does;
// a card that isn't a bento tile card slides in whole.
export function arrive(card, mode = "pop") {
  if (calm() || !card) return;
  if (!MOTION_TAGS.has(card.tagName)) {
    const kf = mode === "pop" ? [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }]
      : [{ opacity: 0, transform: `translateX(${mode === "left" ? -28 : 28}px)` }, { opacity: 1, transform: "none" }];
    card.animate(kf, { duration: 450, easing: EASE_OUT });
    return;
  }
  const mo = state(card);
  if (!mo.seen) { mo.arriveNext = mode; return; }
  arriveTiles(card, tilesOf(card.shadowRoot), mode);
}

// Confetti from a ticked-off chore. On the page body, so a redraw of the card can't cut it short.
const CONFETTI = ["#ff6b4a", "#a78bfa", "#5ab8ff", "#ffc933", "#2fc98a", "#ff9cc4"];
export function celebrate(fromEl, big = false) {
  if (calm() || !fromEl) return;
  const r = fromEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const n = big ? 30 : 12;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.setAttribute("aria-hidden", "true");
    p.style.cssText = `position:fixed;left:0;top:0;z-index:9999;width:7px;height:10px;border-radius:2px;pointer-events:none;background:${CONFETTI[i % CONFETTI.length]}`;
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 36 + Math.random() * (big ? 120 : 56);
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 30, rot = (Math.random() - 0.5) * 720;
    p.animate([
      { transform: `translate(${cx}px, ${cy}px) rotate(0)`, opacity: 1 },
      { transform: `translate(${cx + dx * 0.8}px, ${cy + dy}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${cx + dx}px, ${cy + dy + 60}px) rotate(${rot}deg) scale(.6)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2, .7, .4, 1)" }).onfinish = () => p.remove();
  }
}

console.info(`%c BENTO MOTION %c ${BENTO_MOTION_VERSION} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
