// What some tiles carry beyond words and a chart: an LED strip's moving backdrop, ranked
// power bars, and the few per-kind type sizes.
import { css } from "lit";

export const extraStyles = css`
  :host([shape="L"].climate) .say, :host([shape="FL"].climate) .say { font-size: var(--n-say-big); line-height: var(--n-say-big-line); }
  :host(.climate[shape="W"]) .say { font-size: 2.2em; }
  :host(.run) .say { font-size: 1.25em; }
  :host(.media.on) .pill { background: rgba(255,255,255,.18); }
  :host(.media.on) nice-slider { --slide-bg: rgba(255,255,255,.18); --slide-fill: #fff; }
  :host(.media) [lay="side"] .eq, :host(.media) .vz .eq { height: 22px; }
  :host(.bars-tile) { grid-template-rows: auto auto 1fr; }
  /* A picture beside the words rather than above them (the feeder) */
  :host(.aside) { grid-template-columns: minmax(0, 1fr) 96px; grid-template-rows: auto 1fr; align-items: center; column-gap: var(--n-s-md); min-height: 150px; }
  :host(.aside) .lbl { grid-column: 1; grid-row: 1; align-self: start; }
  :host(.aside) .txt { grid-column: 1; grid-row: 2; gap: var(--n-s-xs); }
  :host(.aside) .picture { grid-column: 2; grid-row: 1 / span 2; }
  /* The snack: words on the left, the pill on the right at every width */
  :host(.snack) { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; column-gap: var(--n-s-lg); min-height: 0; }
  :host(.snack) .lbl { grid-column: 1; grid-row: 1; }
  :host(.snack) .txt { grid-column: 1; grid-row: 2; }
  :host(.snack) .foot { grid-column: 2; grid-row: 1 / span 2; }
  :host(.snack) .say { font-size: 2.1em; line-height: 1.02; }
  :host(.snack) .pill { font-size: 1em; padding: var(--n-s-md) var(--n-s-xl); }
  /* A cat's visits today, as dots */
  .dots { display: flex; gap: var(--n-s-xs); }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: currentColor; opacity: .2; }
  .dots i.on { background: var(--accent); opacity: 1; }
  :host(.night) .dots i.on { background: var(--ink); }

  /* Ranked bars: names as wide as the longest name, values as wide as the longest value,
     and the bars take everything between, at any width */
  .bars { display: grid; grid-template-columns: minmax(0, max-content) minmax(48px, 1fr) max-content; column-gap: var(--n-s-md); row-gap: var(--n-s-sm); align-items: center; font-size: 0.9em; font-weight: 700; }
  .bar { display: contents; cursor: pointer; }
  .bar .bn { max-width: 12em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar .bt { height: 14px; border-radius: var(--n-r-full); background: rgba(28,34,51,.07); overflow: hidden; }
  :host(.night) .bar .bt { background: rgba(255,255,255,.1); }
  .bar .bt i { display: block; height: 100%; border-radius: var(--n-r-full); background: var(--accent); }
  .bar b { text-align: right; font-family: var(--n-display); font-weight: 800; }
  .more-bars { grid-column: 1 / -1; justify-self: start; margin-top: var(--n-s-2xs); font-size: 0.96em; }

  /* LED strips: the bands run at an angle in a tilted frame big enough to cover any tile */
  :host(.strip-tile) { grid-template-rows: auto auto 1fr; }
  :host(.strip-tile.on) .say, :host(.strip-tile.on) .sub, :host(.strip-tile.on) .lbl { text-shadow: 0 1px 3px rgba(0,0,0,.35); }
  :host(.strip-tile) .lbl, :host(.strip-tile) .txt, :host(.strip-tile) .foot { position: relative; z-index: 1; }
  .fx { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; z-index: 0; pointer-events: none; }
  .fx .rot { position: absolute; left: 50%; top: 50%; width: 180%; height: 260%; transform: translate(-50%, -50%) rotate(-24deg); }
  .fx i { position: absolute; top: 0; bottom: 0; left: 0; width: 200%; filter: blur(16px) saturate(1.15); }
  /* A scrim so the words stay readable on any palette, plus the light's dimness */
  .fx::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.4), rgba(0,0,0,.04) 42%, rgba(0,0,0,.34)), linear-gradient(rgba(0,0,0,var(--dim)), rgba(0,0,0,var(--dim))); }
  .fx b { position: absolute; z-index: 2; width: 12px; height: 12px; margin: calc(-1 * var(--n-s-sm)); border-radius: 50%; background: var(--c); box-shadow: 0 0 14px 4px var(--c); animation: ledtw var(--t) ease-in-out var(--dl) infinite; }
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
`;
