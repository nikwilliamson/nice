// One number, drawn: tbar, tube, ring, battery, charge, kelvin.
import { html, css, nothing } from "lit";
import { kelvinRgb, rgbCss } from "../core/tones.js";

// A bar with a threshold line: { value 0–100, line, line_label }
export const tbar = {
  render: (v) => html`<div class="tbar"><div class="track"><i style="width:${Math.min(100, v.value)}%"></i>
    <span class="line" style="left:${v.line}%"></span><span class="linelbl" style="left:${v.line}%">${v.line_label || ""}</span></div><b>${Math.round(v.value)}%</b></div>`,
  styles: css`
    .tbar { display: flex; align-items: center; gap: var(--n-s-md); padding-bottom: var(--n-s-lg); }
    .tbar .track { flex: 1; height: 10px; border-radius: var(--n-r-full); background: rgba(255,255,255,.85); position: relative; }
    .tbar .track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--n-r-full); background: var(--accent); }
    .tbar .line { position: absolute; top: -5px; bottom: -5px; width: 2px; background: currentColor; }
    .tbar .linelbl { position: absolute; top: 15px; transform: translateX(-50%); font-size: 0.72em; font-weight: 700; opacity: .6; }
    .tbar b { font-family: var(--n-display); font-weight: 800; font-size: 1.15em; }
  `,
};

// A level in a tube, warn below the line: { value, line (50) }
export const tube = {
  render: (v) => html`<div class="tube"><div class="t"><i class=${v.value < (v.line ?? 50) ? "low" : ""} style="height:${v.value}%"></i><span class="notch" style="bottom:${v.line ?? 50}%"></span></div></div>`,
  layout: "side",
  styles: css`
    .tube .t { width: 36px; height: 110px; border-radius: var(--n-r-sm); background: rgba(255,255,255,.9); position: relative; overflow: hidden; box-shadow: inset 0 0 0 2px rgba(28,34,51,.08); }
    :host([shape="S"]) .tube .t, :host([shape="W"]) .tube .t { height: 64px; width: 28px; }
    .tube .t i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--accent); }
    .tube .t i.low { background: var(--n-warn); animation: throb 3s ease-in-out infinite; }
    .tube .notch { position: absolute; left: 0; right: 0; height: 2px; background: rgba(28,34,51,.35); }
    @keyframes throb { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  `,
};

// Progress round a ring with a word in it: { value 0–100, label }
export const ring = {
  render(v) {
    const c = 2 * Math.PI * 20;
    return html`<svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="20" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="6"/>
      <circle cx="26" cy="26" r="20" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * v.value) / 100} ${c}" transform="rotate(-90 26 26)"/>
      <text x="26" y="30" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" font-family="Figtree, sans-serif">${v.label}</text></svg>`;
  },
  layout: "side",
  styles: css`.ring { width: 60px; height: 60px; display: block; }`,
};

// A battery: { value, label, charging }
export const battery = {
  render: (v) => html`<div class="batt"><div class="body"><i class="${v.value < 50 ? "low" : ""} ${v.charging ? "charging" : ""}" style="width:${v.value}%"></i><span>${v.label}</span></div><b class="nub"></b></div>`,
  layout: "side",
  styles: css`
    .batt { display: flex; align-items: center; gap: var(--n-s-xs); }
    .batt .body { position: relative; width: 150px; height: 44px; border-radius: var(--n-r-sm); background: rgba(255,255,255,.95); box-shadow: inset 0 0 0 2px rgba(28,34,51,.15); overflow: hidden; color: #1c2233; }
    .batt .body i { position: absolute; left: 4px; top: 4px; bottom: 4px; border-radius: var(--n-r-xs); background: var(--accent); max-width: calc(100% - 8px); }
    .batt .body i.low { background: var(--n-warn); }
    .batt .body i.charging { animation: throb 2.4s ease-in-out infinite; }
    .batt .body span { position: relative; display: grid; place-items: center; height: 100%; font-size: 0.86em; font-weight: 800; }
    .batt .nub { width: 5px; height: 16px; border-radius: 0 3px 3px 0; background: currentColor; opacity: .3; }
    @keyframes throb { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  `,
};

// A level bar with an optional striped gain to a limit line, and two captions under it.
// The one bar for a battery, a charge plan and a litter drawer:
//   { value, limit, gain (show the stripe), live (animate it), warn (below this is warn),
//     high (at or above this is warn instead, for a drawer filling up),
//     left, right (captions; markup allowed via arrays of [bold, rest]) }
// The charge-plan shape { value, limit, now_mi, full_mi } still works.
export const charge = {
  render(v) {
    const now = Math.max(0, Math.min(100, v.value ?? 0));
    const lim = v.limit != null ? Math.max(now, Math.min(100, v.limit)) : null;
    const gain = v.gain ?? (v.now_mi != null);
    const warn = v.warn ?? 50;
    const left = v.left ?? (v.now_mi != null ? [`${Math.round(now)}%`, ` · ${v.now_mi} mi now`] : null);
    const right = v.right ?? (v.full_mi != null ? [`${Math.round(lim)}%`, ` · ${v.full_mi} mi by morning`] : null);
    const cap = (c) => (Array.isArray(c) ? html`<b>${c[0]}</b>${c[1]}` : c);
    const low = v.high != null ? now >= v.high : now < warn;
    return html`<div class="charge"><div class="cbar"><i class="now ${low ? "low" : ""}" style="width:${now}%"></i>
        ${gain && lim != null ? html`<i class="gain ${v.live ?? true ? "live" : ""}" style="left:${now}%;width:${lim - now}%"></i>` : nothing}
        ${lim != null ? html`<span class="lim" style="left:${lim}%"></span>` : nothing}</div>
      ${left || right ? html`<div class="cends"><span>${cap(left)}</span><span class="to">${cap(right)}</span></div>` : nothing}</div>`;
  },
  layout: "foot",
  styles: css`
    .charge { display: grid; gap: var(--n-s-sm); }
    .cbar { position: relative; height: var(--n-c-sm); border-radius: var(--n-r-sm); background: rgba(255,255,255,.75); overflow: hidden; box-shadow: inset 0 0 0 2px rgba(28,34,51,.08); }
    :host(.night) .cbar { background: rgba(255,255,255,.12); }
    .cbar i { position: absolute; top: 0; bottom: 0; }
    .cbar .now { left: 0; background: var(--accent); border-radius: var(--n-r-sm) 0 0 var(--n-r-sm); transition: width var(--n-t-bar) ease; }
    .cbar .now.low { background: var(--n-warn); }
    .cbar .gain { background: repeating-linear-gradient(-45deg, var(--accent) 0 5px, transparent 5px 10px); opacity: .55; transform-origin: 0 50%; }
    .cbar .gain.live { animation: fillin var(--n-t-fill) ease-in-out infinite alternate; }
    .cbar .lim { position: absolute; top: -2px; bottom: -2px; width: 2px; background: currentColor; opacity: .6; }
    @keyframes fillin { from { transform: scaleX(.15); } to { transform: scaleX(1); } }
    .cends { display: flex; justify-content: space-between; gap: var(--n-s-sm); flex-wrap: wrap; font-size: 0.82em; font-weight: 600; opacity: .9; }
    .cends b { font-family: var(--n-display); font-weight: 800; font-size: 1.1em; }
    .cends .to { text-align: right; opacity: .8; }
    :host([shape="T"]) .cends, :host([shape="S"]) .cends { flex-direction: column; gap: var(--n-s-2xs); }
    :host([shape="T"]) .cends .to, :host([shape="S"]) .cends .to { text-align: left; }
  `,
};

// Where a light sits between warm and cool: { value K, min, max }
export const kelvin = {
  render(v) {
    const lo = v.min || 2000, hi = v.max || 5500, k = Math.max(lo, Math.min(hi, v.value || lo));
    const stops = [0, 0.25, 0.5, 0.75, 1].map((f) => `${rgbCss(kelvinRgb(lo + (hi - lo) * f))} ${f * 100}%`).join(", ");
    return html`<div class="kel" style="background:linear-gradient(90deg, ${stops})"><i style="left:${((k - lo) / (hi - lo || 1)) * 100}%;background:${rgbCss(kelvinRgb(k))}"></i></div>`;
  },
  layout: "after",
  styles: css`
    .kel { position: relative; height: 10px; border-radius: var(--n-r-full); margin: var(--n-s-sm) 0 var(--n-s-2xs); }
    .kel i { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 3px var(--bg, #fff), 0 1px 6px rgba(0,0,0,.25); }
  `,
};
