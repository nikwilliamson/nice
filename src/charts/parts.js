// Proportions and lists: stack, thermo, checks, receipt.
import { html, css, nothing } from "lit";
import { tone } from "../core/tones.js";

// The month's split: { segments: [{ name, value, tone, show }] }
export const stack = {
  render(v, { night }) {
    const segs = v.segments || [];
    return html`<div class="stack"><div class="segs">${segs.map((s) => html`<i style="flex:${Math.max(s.value, 0.01)};background:${tone(s.tone, night).accent}"></i>`)}</div>
      <div class="seglbl">${segs.map((s) => html`<span style="flex:${Math.max(s.value, 0.01)}">${s.show ? s.name : ""}</span>`)}</div></div>`;
  },
  styles: css`
    .stack { display: grid; gap: var(--n-s-xs); }
    .stack .segs { display: flex; gap: var(--n-s-xs); height: 14px; } .stack .segs i { border-radius: var(--n-r-xs); }
    .stack .seglbl { display: flex; gap: var(--n-s-xs); font-size: 0.74em; font-weight: 800; } .stack .seglbl span { white-space: nowrap; overflow: hidden; }
  `,
};

// Rooms on a warm-to-cool track with the thermostat's setting notched into it. Rooms
// within a whisker of each other share one marker that says how many; the coolest and
// warmest are named. { rooms: [[name, temp]], set }
export const thermo = {
  render(v) {
    const rooms = (v.rooms || []).filter((r) => typeof r[1] === "number");
    if (!rooms.length) return nothing;
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
    const label = (g, cls) => html`<span class="nm ${cls} ${anchor(pos(avg(g)))}" style="left:${pos(avg(g))}%">${name(g)} <b>${Math.round(avg(g))}°</b></span>`;
    return html`<div class="thermo"><div class="track"></div>
      ${v.set != null ? html`<span class="setp" style="left:${pos(v.set)}%">set <b>${Math.round(v.set)}°</b></span>` : nothing}
      ${groups.map((g) => html`<span class="room ${g === warm && groups.length > 1 ? "warm" : ""} ${g === cool && groups.length > 1 ? "cool" : ""} ${g.length > 1 ? "many" : ""}" style="left:${pos(avg(g))}%" title=${g.map((r) => `${r[0]} ${Math.round(r[1])}°`).join(", ")}>${g.length > 1 ? g.length : ""}</span>`)}
      ${label(cool, "cool")}${groups.length > 1 ? label(warm, "warm") : nothing}</div>`;
  },
  styles: css`
    .thermo { position: relative; height: 62px; }
    .thermo .track { position: absolute; left: 0; right: 0; top: 24px; height: 10px; border-radius: var(--n-r-full); background: linear-gradient(90deg, #7cc4f0, #bfe3d4 42%, #ffd59a 70%, #ff8f6b); }
    .thermo .room { position: absolute; top: 29px; width: 14px; height: 14px; border-radius: var(--n-r-full); background: #fff; box-shadow: 0 0 0 3px var(--bg), 0 2px 4px rgba(0,0,0,.18); transform: translate(-50%, -50%); }
    .thermo .room.many { width: auto; min-width: 22px; height: 20px; padding: 0 var(--n-s-sm); display: grid; place-items: center; font-size: 0.7em; font-weight: 800; color: #1c2233; line-height: 1; }
    .thermo .room.cool { background: #3a9fd6; color: #fff; } .thermo .room.warm { background: #ff6b4a; color: #fff; }
    .thermo .setp { position: absolute; top: 0; transform: translateX(-50%); font-size: 0.72em; font-weight: 600; opacity: .8; white-space: nowrap; }
    .thermo .setp b { font-weight: 800; }
    .thermo .setp::after { content: ""; position: absolute; left: 50%; top: 17px; width: 3px; height: 16px; border-radius: var(--n-r-xs); background: currentColor; transform: translateX(-50%); box-shadow: 0 0 0 2px var(--bg); }
    .thermo .nm { position: absolute; top: 44px; font-size: 0.76em; font-weight: 600; white-space: nowrap; opacity: .9; }
    .thermo .nm b { font-weight: 800; }
    .thermo .nm.left { transform: translateX(-7px); } .thermo .nm.right { transform: translateX(calc(-100% + 7px)); } .thermo .nm.mid { transform: translateX(-50%); }
  `,
};

// A short checklist, a tick or a ! per line: { items: [{ label, ok }] }
export const checks = {
  render: (v) => html`<ul class="checks">${(v.items || []).map((c) => html`<li class=${c.ok ? "ok" : "no"}><i aria-hidden="true"></i><span>${c.label}</span></li>`)}</ul>`,
  layout: "after",
  styles: css`
    .checks { list-style: none; margin: var(--n-s-xs) 0 0; padding: 0; display: grid; gap: var(--n-s-sm); font-weight: 700; }
    .checks li { display: flex; align-items: center; gap: var(--n-s-sm); min-width: 0; }
    .checks li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .checks i { flex: none; position: relative; width: var(--n-c-xs); height: var(--n-c-xs); border-radius: 50%; background: var(--n-ok); }
    .checks i::after { content: ""; position: absolute; left: 6px; top: 3px; width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
    .checks .no i { background: var(--n-warn); }
    .checks .no i::after { content: "!"; left: 0; right: 0; top: 0; width: auto; height: auto; border: 0; transform: none; color: #fff; font-size: 12px; font-weight: 900; line-height: 16px; text-align: center; }
    .checks .no span { font-weight: 800; }
  `,
};

// Label ...... value, one row each: { rows: [[label, value]] }
export const receipt = {
  render: (v) => html`<div class="rcpt">${(v.rows || []).map((r) => html`<div><span>${r[0]}</span><em></em><b>${r[1]}</b></div>`)}</div>`,
  layout: "after",
  styles: css`
    .rcpt { display: grid; gap: var(--n-s-sm); margin-top: var(--n-s-xs); }
    .rcpt div { display: flex; align-items: baseline; gap: var(--n-s-sm); min-width: 0; }
    .rcpt span { flex: none; font-weight: 600; opacity: .8; }
    .rcpt em { flex: 1; min-width: 12px; border-bottom: 2px dotted currentColor; opacity: .25; transform: translateY(-4px); }
    .rcpt b { flex: none; font-family: var(--n-display); font-weight: 800; }
  `,
};
