// nice-sky: a window on the moment. The sky follows the sun's elevation, the weather takes
// the edge off it and draws itself (clouds, rain, snow, fog, wind, lightning), and the words
// say hello. Deliberately nothing the grid already covers.
//
//   type: custom:nice-sky
//   weather: weather.forecast_home
//   persons: [person.nikw, person.kat]
import { html, svg, css, nothing } from "lit";
import { NiceCard } from "../core/base.js";
import { tokens } from "../core/tokens.js";
import { mix } from "../core/tones.js";
import { sentence } from "../core/format.js";
import { formEditor } from "../editors/form.js";
import { SKY as SKY_FIELDS } from "../editors/specs.js";

// [elevation, top, middle, bottom]
const SKY = [
  [-18, "#0f1430", "#1a2150", "#2a2f66"], [-6, "#1d2a66", "#4a4f9c", "#8a6fb0"], [0, "#2b3a7a", "#6b5fb5", "#e28aa0"],
  [6, "#4a7fe0", "#8f8de8", "#ff9a7a"], [12, "#3d8fe6", "#6fb6f2", "#ffc98a"], [30, "#3d8fe6", "#6fb6f2", "#bfe3ff"],
];
function skyAt(elev) {
  if (elev <= SKY[0][0]) return SKY[0].slice(1);
  for (let i = 1; i < SKY.length; i++) if (elev <= SKY[i][0]) {
    const t = (elev - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
    return [1, 2, 3].map((k) => mix(SKY[i - 1][k], SKY[i][k], t));
  }
  return SKY[SKY.length - 1].slice(1);
}
// The sun sets the sky; weather only takes the edge off it, so dusk still looks like dusk in the rain
const WASH = { cloudy: ["#8f9bad", 0.14], partlycloudy: ["#8f9bad", 0.06], rainy: ["#5d6b7d", 0.18], pouring: ["#4b5868", 0.24], lightning: ["#4b5868", 0.22], "lightning-rainy": ["#4b5868", 0.24], fog: ["#c9d1db", 0.2], snowy: ["#dfe6ee", 0.16], "snowy-rainy": ["#9aa6b6", 0.16], hail: ["#6d7888", 0.18] };
const CONDITION = { "clear-night": "Clear", cloudy: "Cloudy", exceptional: "Unusual weather", fog: "Foggy", hail: "Hail", lightning: "Thunderstorms", "lightning-rainy": "Stormy", partlycloudy: "Partly cloudy", pouring: "Pouring", rainy: "Rainy", snowy: "Snowy", "snowy-rainy": "Sleet", sunny: "Sunny", windy: "Windy", "windy-variant": "Windy" };
const WEATHER = {
  partlycloudy: { clouds: 2 }, cloudy: { clouds: 4, grey: 0.15 }, fog: { clouds: 1, fog: 4 },
  rainy: { clouds: 4, grey: 0.35, rain: 26 }, pouring: { clouds: 5, grey: 0.5, rain: 54, fast: true },
  lightning: { clouds: 5, grey: 0.5, rain: 34, bolt: true }, "lightning-rainy": { clouds: 5, grey: 0.5, rain: 48, bolt: true },
  snowy: { clouds: 3, grey: 0.1, snow: 34 }, "snowy-rainy": { clouds: 4, grey: 0.3, rain: 16, snow: 16 },
  hail: { clouds: 4, grey: 0.4, hail: 30 }, windy: { clouds: 1, wind: 5 }, "windy-variant": { clouds: 3, wind: 5 },
};
const AVATAR = ["#ff8a5c", "#5ab8ff", "#9fd33a", "#a78bfa", "#ffc933"];
const ARC = "M0 100 A100 100 0 0 1 200 100";
const range = (n) => Array.from({ length: n || 0 }, (_, i) => i);

// What the weather looks like in the sky itself. Positions come from the index, never
// Math.random, so a redraw doesn't reshuffle the sky.
function weather(state, up) {
  const w = WEATHER[state];
  if (!w) return nothing;
  const cloudFill = (g) => (up ? mix("#ffffff", "#7d8798", g) : mix("#c9d2e6", "#4a5266", g));
  return html`<div class="wx" aria-hidden="true">
    ${range(w.clouds).map((i) => {
      const size = 100 + ((i * 47) % 3) * 40, top = 6 + ((i * 29) % 4) * 13, at = i === 0 && w.clouds > 2 ? 0.04 : 0.45 + ((i * 23) % 50) / 100;
      return html`<i class="cloud" style="left:calc((100% - ${size}px - 48px) * ${at.toFixed(2)} + 24px);top:${top}%;width:${size}px;color:${cloudFill((w.grey || 0) + (i % 2) * 0.08)};opacity:${(up ? 0.85 : 0.45) * (i === 0 && w.clouds > 2 ? 0.55 : 1)};animation-duration:${60 + i * 17}s;animation-delay:-${i * 13}s">
        <svg viewBox="0 0 120 58"><circle cx="34" cy="38" r="16"/><circle cx="58" cy="28" r="22"/><circle cx="84" cy="36" r="17"/><rect x="18" y="36" width="84" height="20" rx="10"/></svg></i>`;
    })}
    ${range(w.fog).map((i) => html`<i class="fog" style="top:${30 + i * 16}%;animation-delay:-${i * 5}s"></i>`)}
    ${range(w.wind).map((i) => html`<i class="gust" style="top:${22 + ((i * 37) % 60)}%;width:${18 + (i % 3) * 10}%;animation-delay:-${(i * 0.7).toFixed(1)}s"></i>`)}
    ${range(w.rain).map((i) => html`<i class="drop ${w.fast ? "fast" : ""}" style="left:${(i * 37) % 100}%;animation-delay:-${((i * 0.13) % 1).toFixed(2)}s"></i>`)}
    ${range(w.snow).map((i) => html`<i class="flake" style="left:${(i * 41) % 100}%;width:${3 + (i % 3)}px;height:${3 + (i % 3)}px;animation-duration:${5 + (i % 4)}s;animation-delay:-${((i * 0.9) % 8).toFixed(1)}s"></i>`)}
    ${range(w.hail).map((i) => html`<i class="hail" style="left:${(i * 43) % 100}%;animation-delay:-${((i * 0.17) % 1.2).toFixed(2)}s"></i>`)}
    ${w.bolt ? html`<i class="flash"></i><svg class="bolt" viewBox="0 0 40 90"><path d="M24 0 6 50h14L10 90 36 36H21z"/></svg>` : nothing}</div>`;
}

export class NiceSky extends NiceCard {
  static getConfigElement() { return formEditor(SKY_FIELDS); }
  static defaults = { weather: "weather.forecast_home", persons: [] };
  watch() { return [this.config.sun, this.config.weather, ...this.config.persons]; }
  connectedCallback() { super.connectedCallback(); this.every(60000); }

  render() {
    const h = this.hass, c = this.config, sun = h.states[c.sun], wx = h.states[c.weather];
    const now = new Date(), elev = sun?.attributes?.elevation ?? 20, up = sun?.state === "above_horizon";
    let [top, mid, bot] = skyAt(elev);
    const wash = WASH[wx?.state];
    if (wash) [top, mid, bot] = [top, mid, bot].map((col) => mix(col, wash[0], wash[1]));
    const hr = now.getHours();
    const greet = hr >= 5 && hr < 12 ? "Good morning" : hr >= 12 && hr < 17 ? "Good afternoon" : hr >= 17 && hr < 22 ? "Good evening" : "Good night";
    const first = (h.user?.name || "").split(" ")[0];
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
    // A point on a half circle of radius 100 in a 200 × 100 frame that keeps its 2:1 shape
    const ang = Math.PI * (1 - progress), ax = 100 + 100 * Math.cos(ang), ay = 100 - 100 * Math.sin(ang);
    const temp = wx?.attributes?.temperature, feels = wx?.attributes?.apparent_temperature;
    const hidden = (WEATHER[wx?.state]?.grey || 0) >= 0.3; // the sun goes behind proper cloud
    const bits = [];
    if (feels != null && temp != null && Math.abs(feels - temp) >= 2) bits.push(`Feels ${Math.round(feels)}°`);
    if (wx?.attributes?.humidity != null) bits.push(`${Math.round(wx.attributes.humidity)}% humidity`);
    const people = c.persons.map((p) => h.states[p]).filter(Boolean);
    const glow = up ? "#fff1b8" : "#dfe6ff";
    return html`<div class="sky ${up ? "day" : "night"}" style="background:linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${bot} 100%)">
      ${!up && !hidden ? html`<div class="stars" aria-hidden="true">${range(30).map((i) => html`<i style="left:${(i * 53) % 97}%;top:${(i * 37) % 70}%;width:${1 + (i % 3)}px;height:${1 + (i % 3)}px;animation-delay:${(i % 7) * 0.5}s"></i>`)}</div>` : nothing}
      <svg class="arc" viewBox="0 0 200 100" aria-hidden="true">
        <defs><radialGradient id="glow"><stop offset="0" stop-color=${glow} stop-opacity=${up ? 0.6 : 0.35}/><stop offset="1" stop-color=${glow} stop-opacity="0"/></radialGradient>
          <mask id="crescent"><circle cx=${ax} cy=${ay} r="6.5" fill="#fff"/><circle cx=${ax + 3} cy=${ay - 2.5} r="5.5" fill="#000"/></mask></defs>
        <path d=${ARC} fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>
        <path d=${ARC} pathLength="100" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="${(progress * 100).toFixed(2)} 101"/>
        <g opacity=${hidden ? 0.5 : 1}><circle cx=${ax} cy=${ay} r=${up ? 20 : 15} fill="url(#glow)"/>
          ${up ? svg`<circle cx=${ax} cy=${ay} r="7.5" fill="#fff4c2"/>` : svg`<circle cx=${ax} cy=${ay} r="6.5" fill="#eef2ff" mask="url(#crescent)"/>`}</g>
      </svg>
      ${weather(wx?.state, up)}
      <div class="words">
        <span class="date">${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
        <span class="hello">${greet}${first ? `, ${first}` : ""}</span>
        <span class="sub">${[CONDITION[wx?.state] || "", sunLine].filter(Boolean).join(" · ")}</span>
        ${people.length ? html`<div class="pills">${people.map((p, i) => {
          const name = p.attributes.friendly_name || p.entity_id, home = p.state === "home";
          const where = home ? "" : p.state === "not_home" ? "Out" : p.state, pic = p.attributes.entity_picture;
          return html`<span class="pill ${home ? "" : "away"}"><span class="av" style="background:${pic ? `center/cover url('${pic}')` : AVATAR[i % AVATAR.length]}">${pic ? "" : name.charAt(0)}</span>${name}${where ? html`<em>${sentence(where)}</em>` : nothing}</span>`;
        })}</div>` : nothing}
      </div>
      ${temp != null ? html`<div class="temp"><b>${Math.round(temp)}°</b><span>${bits.join(" · ")}</span></div>` : nothing}
    </div>`;
  }

  static styles = [tokens, css`
    :host { container-type: inline-size; }
    .sky { position: relative; overflow: hidden; isolation: isolate; border-radius: var(--n-r-tile); padding: var(--n-s-xl); min-height: 216px; color: #fff;
      display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--n-s-lg); align-items: start;
      font-family: var(--n-body); text-shadow: 0 1px 14px rgba(0,0,0,.16); transition: background 2s ease; }
    .words { display: grid; gap: var(--n-s-xs); position: relative; z-index: 2; min-width: 0; }
    .words > span { display: block; }
    .date { font-size: 0.78em; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: .82; }
    .hello { font-family: var(--n-display); font-weight: 800; font-size: clamp(1.9em, 6.4cqi, 3.1em); line-height: 1.04; text-wrap: balance; letter-spacing: -0.025em; margin-top: var(--n-s-2xs); }
    .sub { font-weight: 600; font-size: 1.05em; opacity: .9; }
    .temp { position: relative; z-index: 2; text-align: right; display: grid; gap: var(--n-s-2xs); margin-top: calc(-1 * var(--n-s-xs)); }
    .temp b { font-family: var(--n-display); font-weight: 800; font-size: clamp(2.8em, 9cqi, 4.6em); line-height: .95; letter-spacing: -0.03em; }
    .temp span { font-size: 0.88em; font-weight: 700; opacity: .85; }
    .arc { position: absolute; right: calc(24px + 7.5em); bottom: 0; height: calc(100% - 30px); width: auto; aspect-ratio: 2 / 1; z-index: 0; overflow: visible; }
    .arc circle { transition: cx 2s ease, cy 2s ease; }
    @container (max-width: 760px) { .arc { right: 12px; opacity: .7; } }
    .stars { position: absolute; inset: 0; z-index: 0; }
    .stars i { position: absolute; border-radius: 50%; background: #fff; animation: star 3.4s ease-in-out infinite; }
    @keyframes star { 0%,100% { opacity: .15; } 50% { opacity: .95; } }
    .wx { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
    .wx .cloud { position: absolute; display: block; animation: drift linear infinite alternate; }
    .wx .cloud svg { display: block; width: 100%; height: auto; fill: currentColor; overflow: visible; }
    @keyframes drift { from { transform: translateX(-24px); } to { transform: translateX(24px); } }
    .wx .fog { position: absolute; left: -10%; width: 120%; height: 22px; border-radius: var(--n-r-full); background: rgba(255,255,255,.28); filter: blur(6px); animation: fog 14s ease-in-out infinite alternate; }
    @keyframes fog { from { transform: translateX(-6%); } to { transform: translateX(6%); } }
    .wx .gust { position: absolute; left: -30%; height: 2px; border-radius: var(--n-r-xs); background: rgba(255,255,255,.55); animation: gust 2.6s linear infinite; }
    @keyframes gust { from { transform: translateX(0); opacity: 0; } 20% { opacity: 1; } to { transform: translateX(560%); opacity: 0; } }
    .wx .drop { position: absolute; top: -12%; width: 1.5px; height: 16px; border-radius: var(--n-r-xs); background: rgba(220,235,255,.7); transform: rotate(12deg); animation: fall 0.9s linear infinite; }
    .wx .drop.fast { height: 22px; animation-duration: 0.55s; }
    @keyframes fall { to { top: 108%; } }
    .wx .flake { position: absolute; top: -6%; border-radius: 50%; background: #fff; opacity: .9; animation: snow linear infinite; }
    @keyframes snow { 0% { top: -6%; transform: translateX(0); } 50% { transform: translateX(14px); } 100% { top: 106%; transform: translateX(-6px); } }
    .wx .hail { position: absolute; top: -6%; width: 5px; height: 5px; border-radius: 50%; background: #f2f6ff; animation: fall 0.7s linear infinite; }
    .wx .flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flash 7s infinite; }
    @keyframes flash { 0%, 90%, 94%, 100% { opacity: 0; } 91% { opacity: .45; } 92% { opacity: .1; } 93% { opacity: .35; } }
    .wx .bolt { position: absolute; left: 62%; top: 18%; width: 26px; fill: #ffe680; opacity: 0; animation: flash 7s infinite; }
    @media (prefers-reduced-motion: reduce) { .wx .flash, .wx .bolt { display: none; } }
    .pills { display: flex; flex-wrap: wrap; gap: var(--n-s-sm); margin-top: var(--n-s-lg); }
    .pill { display: inline-flex; align-items: center; gap: var(--n-s-sm); border-radius: var(--n-r-full); padding: var(--n-s-xs) var(--n-s-lg) var(--n-s-xs) var(--n-s-xs); font-weight: 700; font-size: 0.96em; background: rgba(255,255,255,.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); text-shadow: none; }
    .pill em { font-style: normal; font-weight: 600; opacity: .75; }
    .pill.away { background: rgba(255,255,255,.1); }
    .pill.away .av { filter: grayscale(.6); opacity: .8; }
    .av { width: var(--n-c-md); height: var(--n-c-md); border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 0.82em; color: #1c2233; }
    @container (max-width: 520px) { .sky { grid-template-columns: minmax(0, 1fr); } .temp { grid-row: 1; text-align: left; margin: 0 0 var(--n-s-sm); display: flex; align-items: baseline; gap: var(--n-s-md); } .arc { right: 12px; height: auto; width: 46%; opacity: .6; } }
  `];
}
customElements.define("nice-sky", NiceSky);
