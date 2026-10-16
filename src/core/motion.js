// How tiles move. With stable elements a plain colour change is a CSS transition; what's
// here is what CSS can't do on its own:
//   flood(el, from, to, x, y)   the new colour spills out from where you tapped
//   countUp(node, from, to)     numbers in the words count from the old value to the new
//   arrive(el, mode)            tiles pop in, or slide in from the side a tab came from
//   wiggle(el)                  an armed two-tap button
//   celebrate(el, big)          confetti from a ticked-off chore
// Everything is skipped under prefers-reduced-motion.

// Also calm where the browser has no Web Animations
export const calm = () => !Element.prototype.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const EASE_OUT = "cubic-bezier(.2, .8, .2, 1)";
const SPRING = "cubic-bezier(.34, 1.56, .64, 1)";

// iOS only fires :active when something listens for touches
document.addEventListener("touchstart", () => {}, { passive: true });

export function flood(el, from, to, x, y) {
  if (calm()) return;
  const w = el.offsetWidth, h = el.offsetHeight;
  const r = Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))) + 2;
  el.style.backgroundImage = `radial-gradient(circle closest-side, ${to} 97%, transparent 100%)`;
  el.style.backgroundRepeat = "no-repeat";
  const a = el.animate([
    { backgroundColor: from, backgroundSize: "0px 0px", backgroundPosition: `${x}px ${y}px` },
    { backgroundColor: from, backgroundSize: `${r * 2}px ${r * 2}px`, backgroundPosition: `${x - r}px ${y - r}px` },
  ], { duration: 650, easing: "cubic-bezier(.3, .7, .2, 1)" });
  a.onfinish = a.oncancel = () => { el.style.backgroundImage = ""; el.style.backgroundRepeat = ""; };
}

// Count a text node's numbers from one string to another, when only the numbers changed
// (never clock times or dates)
const NUM = /\d+(?:\.\d+)?/g;
export function countUp(node, a, b) {
  if (calm() || !node || a === b || /[:/]/.test(b) || a.replace(NUM, "#") !== b.replace(NUM, "#")) return;
  const to = (b.match(NUM) || []).map(Number), from = (a.match(NUM) || []).map(Number);
  if (!to.length || to.length > 3 || to.length !== from.length) return;
  const dec = (b.match(NUM) || []).map((s) => (s.split(".")[1] || "").length);
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / 700), e = 1 - Math.pow(1 - p, 3);
    let i = 0;
    node.data = p >= 1 ? b : b.replace(NUM, () => { const s = (from[i] + (to[i] - from[i]) * e).toFixed(dec[i]); i++; return s; });
    if (p < 1 && node.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function arrive(el, mode = "pop") {
  if (calm() || !el) return;
  const r = el.getBoundingClientRect();
  // Delay by where the tile sits on screen, so every card on a page ripples as one
  const delay = Math.round(Math.min(480, Math.max(0, r.top) * 0.4 + Math.max(0, r.left) * 0.15));
  const kf = mode === "pop"
    ? [{ opacity: 0, transform: "scale(.84)" }, { opacity: 1, transform: "none" }]
    : [{ opacity: 0, transform: `translateX(${mode === "left" ? -28 : 28}px)` }, { opacity: 1, transform: "none" }];
  el.animate(kf, { duration: mode === "pop" ? 700 : 500, delay, easing: mode === "pop" ? SPRING : EASE_OUT, fill: "backwards" });
}

export function wiggle(el) {
  if (calm() || !el) return;
  el.animate([{ transform: "rotate(0)" }, { transform: "rotate(-6deg) scale(1.06)" }, { transform: "rotate(5deg) scale(1.06)" }, { transform: "rotate(-3deg)" }, { transform: "none" }], { duration: 450, easing: "ease" });
}

const CONFETTI = ["#ff6b4a", "#a78bfa", "#5ab8ff", "#ffc933", "#2fc98a", "#ff9cc4"];
// On the page body, so nothing in the card can cut it short
export function celebrate(fromEl, big = false) {
  if (calm() || !fromEl) return;
  const r = fromEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < (big ? 30 : 12); i++) {
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
