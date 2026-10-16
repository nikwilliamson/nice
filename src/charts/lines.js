// Charts over time: spark, dayline, dbars, rain.
//
// Every chart is { render(viz, ctx), styles, data? }. render gets the tile's viz and
//   ctx = { night, colors: { bg, ink, accent }, series, shape }
// and returns markup. It never decides whether it should exist (the rules do). A chart
// that needs history says so with data(viz) → { load(hass) → Promise }, and the card
// fetches it and hands the result back as ctx.series.
import { html, svg, css, nothing } from "lit";
import { series, steps, daily } from "../data/history.js";

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

// A line with a filled area, a "now" dot at its end, and optionally a reference line
// (a setpoint) and the day's peak
export const spark = {
  data: (v) => ({ key: `spark|${v.entity}|${v.since || v.hours}|${v.points || ""}`, load: (hass) => series(hass, v.entity, { hours: v.hours || 2, since: v.since, points: v.points }) }),
  render(v, { colors, series: raw }) {
    const vals = (raw || []).map((x) => x * (v.scale ?? 1));
    if (vals.length < 2) return html`<div class="spark empty"></div>`;
    const ref = v.ref ?? null;
    const lo = Math.min(...vals, ref ?? Infinity), hi = Math.max(...vals, ref ?? -Infinity);
    // The line stops just short of the edge so the dot sits on its end; the fill carries on
    // flat to the edge so the tile has no dead strip
    const W = 100, H = 40, pad = 4, END = 97;
    const x = (i) => (i / (vals.length - 1)) * END;
    const y = (n) => pad + (1 - (n - lo) / (hi - lo || 1)) * (H - pad * 2);
    const pts = vals.map((n, i) => `${x(i).toFixed(2)},${y(n).toFixed(2)}`);
    const pk = vals.indexOf(Math.max(...vals));
    const c = colors.accent, unit = v.unit ? ` ${v.unit}` : "";
    return html`<div class="spark"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,${H} L${pts.join(" L")} L${W},${y(vals[vals.length - 1]).toFixed(2)} L${W},${H} Z" fill=${c} fill-opacity=".18"/>
        ${ref != null ? svg`<line x1="0" x2=${W} y1=${y(ref)} y2=${y(ref)} stroke=${c} stroke-opacity=".5" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>` : nothing}
        <polyline points=${pts.join(" ")} fill="none" stroke=${c} stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
      ${ref != null ? html`<span class="ref" style="top:${(y(ref) / H) * 100}%">${v.ref_label || ""}</span>` : nothing}
      ${v.peak ? html`<span class="peak" style="left:clamp(24px, ${x(pk)}%, calc(100% - 24px));top:${(y(vals[pk]) / H) * 100}%">${fmt(vals[pk])}${unit}</span>` : nothing}
      <span class="end" style="left:${END}%;top:${(y(vals[vals.length - 1]) / H) * 100}%;background:${c};color:${c}"></span></div>`;
  },
  layout: "bleed",
  styles: css`
    .spark { position: absolute; inset: 18px 0 0 0; }
    .spark svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    .spark .end { position: absolute; width: 9px; height: 9px; border-radius: 50%; transform: translate(-50%, -50%); animation: ping 2s ease-out infinite; }
    .spark .peak { position: absolute; transform: translate(-50%, -150%); font-size: 0.78em; font-weight: 800; white-space: nowrap; }
    .spark .ref { position: absolute; left: 14px; transform: translateY(-130%); font-size: 0.74em; font-weight: 700; opacity: .85; }
    @keyframes ping { 0% { box-shadow: 0 0 0 0 currentColor; } 100% { box-shadow: 0 0 0 9px transparent; } }
  `,
};

// Today, midnight to midnight, with a mark each time a counter stepped up
const MARKS = ["#ff9a3d", "#8f74f0", "#2fbf8f", "#5ab8ff"];
export const dayline = {
  data: (v) => ({ key: `dayline|${(v.series || []).map((s) => s.entity).join(",")}`, load: async (hass) => {
    const all = await Promise.all((v.series || []).map(async (s, si) => (await steps(hass, s.entity)).map((m) => ({ ...m, series: si, name: s.name }))));
    const marks = all.flat().sort((a, b) => a.h - b.h);
    // Nudge marks that land on the same minute so both stay visible
    marks.forEach((m, i, a) => { if (i && Math.abs(m.h - a[i - 1].h) < 0.15) { a[i - 1].dx = -3; m.dx = 3; } });
    return marks;
  } }),
  render(v, { series: marks = [] }) {
    marks = marks || [];
    const now = new Date(), nowH = now.getHours() + now.getMinutes() / 60, pos = (h) => (h / 24) * 100;
    const latest = marks.reduce((m, k) => (k.h > (m?.h ?? -1) ? k : m), null);
    return html`<div class="dayline"><div class="past" style="width:${pos(nowH)}%"></div><div class="future" style="left:${pos(nowH)}%"></div>
      ${marks.map((m) => html`<span class="mk ${m === latest ? "last" : ""}" style="left:calc(${pos(m.h)}% + ${m.dx || 0}px);background:${MARKS[m.series % MARKS.length]}" title=${m.name}></span>`)}
      <span class="tk" style="left:0">12a</span><span class="tk mid" style="left:50%">noon</span><span class="tk mid now" style="left:${pos(nowH)}%">now</span></div>`;
  },
  styles: css`
    .dayline { position: relative; height: 46px; }
    .dayline .past { position: absolute; top: 12px; left: 0; height: 2px; background: currentColor; opacity: .28; }
    .dayline .future { position: absolute; top: 12px; right: 0; border-top: 2px dotted currentColor; opacity: .2; }
    .dayline .mk { position: absolute; top: 3px; width: 5px; height: 20px; border-radius: var(--n-r-xs); transform: translateX(-50%); }
    .dayline .mk.last { animation: pop 3s ease-out infinite; }
    .dayline .tk { position: absolute; top: 26px; font-size: 0.72em; font-weight: 700; opacity: .55; white-space: nowrap; }
    .dayline .tk.mid { transform: translateX(-50%); } .dayline .tk.now { opacity: .9; }
    @keyframes pop { 0%,60%,100% { transform: translateX(-50%) scaleY(1); } 70% { transform: translateX(-50%) scaleY(1.35); } }
  `,
};

// One bar per day, scaled to the window's own range so a pound reads as a pound; today is
// the solid one. Takes { entity, days } (from statistics) or { values, labels }.
export const dbars = {
  data: (v) => (v.entity ? { key: `daily|${v.entity}|${v.days || 14}`, load: (hass) => daily(hass, v.entity, v.days || 14) } : null),
  values(v, raw) {
    const rows = v.values ? v.values.map((x, i) => ({ v: x, t: v.labels?.[i] })) : raw || [];
    // Today's bar is the live value, if the tile has one
    if (v.today != null && rows.length) rows[rows.length - 1] = { ...rows[rows.length - 1], v: v.today };
    return rows;
  },
  render(v, { series: raw }) {
    const rows = dbars.values(v, raw);
    if (rows.length < 2) return nothing;
    const vals = rows.map((r) => r.v), lo = Math.min(...vals), span = Math.max(...vals) - lo || 1;
    return html`<div class="dbars">${rows.map((r, i) => html`<i class=${i === rows.length - 1 ? "now" : ""} style="height:${18 + ((r.v - lo) / span) * 82}%" title=${r.t ? `${new Date(r.t).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} · ${fmt(r.v)}` : ""}></i>`)}</div>`;
  },
  styles: css`
    .dbars { display: flex; align-items: flex-end; gap: var(--n-s-xs); height: 40px; }
    .dbars i { flex: 1; min-width: 0; border-radius: 3px 3px 1px 1px; background: var(--accent); opacity: .45; }
    .dbars i.now { opacity: 1; }
  `,
};

// The next hours of the forecast, one bar per hour: tall for a wetter hour, a stub for a
// dry one. Scaled to at least a tenth of an inch, so a drizzle stays a short bar.
export const rain = {
  render(v) {
    const hrs = v.hours || [];
    if (!hrs.length) return nothing;
    const hi = Math.max(0.1, ...hrs.map((h) => h.in || 0));
    const lbl = (h, i) => (i === 0 ? "now" : `${h.h % 12 || 12}${h.h < 12 ? "a" : "p"}`);
    return html`<div class="rain" aria-hidden="true">${hrs.map((h, i) => html`<div class="hr ${h.wet ? "wet" : ""}"><i style="height:${h.wet ? Math.max(24, Math.min(100, (h.in / hi) * 100)) : 8}%"></i><span>${i % 2 ? "" : lbl(h, i)}</span></div>`)}</div>`;
  },
  layout: "after",
  styles: css`
    .rain { display: flex; gap: var(--n-s-xs); height: 40px; }
    .rain .hr { flex: 1; display: grid; grid-template-rows: 1fr auto; gap: var(--n-s-xs); min-width: 0; }
    .rain .hr i { display: block; align-self: end; border-radius: 4px 4px 2px 2px; background: currentColor; opacity: .25; }
    .rain .hr.wet i { opacity: 1; background: var(--accent); }
    .rain .hr span { height: 1.1em; font-size: 0.68em; font-weight: 800; opacity: .75; text-align: center; white-space: nowrap; }
  `,
};
