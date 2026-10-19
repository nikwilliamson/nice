// The tile: eyebrow, words, foot, and where a chart sits. The host is the tile.
import { css } from "lit";

export const tileStyles = css`
  :host { background: var(--bg); color: var(--ink); border-radius: var(--n-r-tile); padding: var(--n-s-md) var(--n-s-lg); position: relative; overflow: hidden; min-width: 0;
    display: grid; grid-template-rows: auto 1fr; gap: var(--n-s-sm); align-content: start; font-family: var(--n-body); isolation: isolate;
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
    transition: background-color .35s ease, color .35s ease, transform .5s var(--n-spring); }
  :host([role="button"]) { cursor: pointer; }
  :host([role="button"]:active) { transform: scale(.965); transition-duration: .35s, .35s, .14s; }
  :host(:focus-visible) { outline: var(--n-ring) solid var(--accent, var(--n-focus)); outline-offset: 2px; }
  /* Hold: the tile fills from the bottom while it's held */
  :host([role="button"])::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
    background: color-mix(in srgb, var(--ink) 13%, transparent); transform: scaleY(0); transform-origin: 50% 100%; transition: transform .18s ease; }
  :host(.holding)::before { transform: scaleY(1); transition: transform .4s linear .12s; }

  .lblrow { display: flex; justify-content: space-between; align-items: center; gap: var(--n-s-sm); min-width: 0; }
  .badge { flex: none; display: inline-flex; align-items: center; gap: var(--n-s-xs); padding: var(--n-s-xs) var(--n-s-sm); border-radius: var(--n-r-full); background: var(--ink); color: var(--bg);
    font-size: 0.7em; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
  .badge i { width: 7px; height: 7px; border-radius: 50%; background: var(--n-alert); animation: throb 1.6s ease-in-out infinite; }
  .txt { display: grid; gap: var(--n-s-2xs); align-self: end; min-width: 0; position: relative; z-index: 1; }
  :host([shape="L"]) .say, :host([shape="FL"]) .say { font-size: 1.95em; } :host([shape="F"]) .say { font-size: 1.6em; }
  :host([shape="S"]) .sub { font-size: 0.9em; }
  :host([shape="W"]) .txt, :host([shape="F"]) .txt { grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--n-s-lg); }
  :host([shape="W"]) .txt .say, :host([shape="W"]) .txt .sub, :host([shape="F"]) .txt .say, :host([shape="F"]) .txt .sub { grid-column: 1; }
  :host([shape="W"]) .txt .act, :host([shape="F"]) .txt .act { grid-column: 2; grid-row: 1 / span 2; align-self: center; margin: 0; }
  .vz, .sidebody { align-self: end; min-width: 0; position: relative; z-index: 1; }
  .foot { display: grid; gap: var(--n-s-sm); position: relative; z-index: 1; align-self: end; }


  /* Where the chart sits */
  :host([lay="stack"]) { grid-template-rows: auto auto 1fr; } :host([lay="stack"]) > .vz { align-self: start; }
  :host([lay="after"]) { grid-template-rows: auto auto 1fr auto; } :host([lay="after"]) > .vz { align-self: start; }
  :host([lay="foot"]) { grid-template-rows: auto auto 1fr; } :host([lay="foot"]) > .txt { align-self: start; } :host([lay="foot"]) > .vz { align-self: end; }
  :host([lay="bleed"]) { grid-template-rows: auto auto 1fr; padding-bottom: 0; } :host([lay="bleed"]) > .txt { align-self: start; }
  :host([lay="picture"]) { grid-template-rows: auto 1fr auto auto; } :host([lay="picture"]) > .txt { align-self: start; }
  .picture { align-self: center; min-width: 0; display: grid; place-items: center; }
  .bleed { margin: 0 calc(-1 * var(--n-s-lg)); min-height: 56px; position: relative; align-self: stretch; }
  :host([shape="L"]) .bleed, :host([shape="FL"]) .bleed { min-height: 110px; } :host([shape="F"][lay="bleed"]) { min-height: 170px; }
  .sidebody { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--n-s-md); align-items: end; }
  @container (max-width: 560px) { :host([shape="T"]) .sidebody { grid-template-columns: 1fr; } }

  /* The tile your pointer is over in the editor */
  :host(.highlight) { outline: 3px solid var(--primary-color, #ff6b4a); outline-offset: 3px; }
  /* Alarm and goal */
  :host(.p0) { animation: alarm 1.6s ease-out infinite; }
  @keyframes alarm { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--n-alert) 55%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }
  :host(.goal) { animation: goal 1s ease-out 6; }
  @keyframes goal { 0% { box-shadow: 0 0 0 0 var(--accent); filter: brightness(1.3); } 100% { box-shadow: 0 0 0 18px transparent; filter: none; } }
  @keyframes throb { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

  /* Chores: tick one off and it crosses out and folds away */
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--n-s-sm); font-weight: 700; font-size: 1.02em; }
  .list li { display: flex; gap: var(--n-s-sm); align-items: center; overflow: hidden; text-decoration: line-through transparent 2px; transition: text-decoration-color .25s ease .1s, opacity .3s ease .1s; }
  .list li.done { text-decoration-color: currentColor; opacity: .6; }
  /* Typing a chore: the field on its own line, Done and × under it */
  .addfield { display: grid; gap: var(--n-s-sm); align-self: end; min-width: 0; }
  .addfield input { width: 100%; min-width: 0; font: inherit; font-size: 1em; padding: var(--n-s-sm) var(--n-s-md); border-radius: var(--n-r-sm); border: 0; background: rgba(255,255,255,.9); color: #1c2233; }
  .addfield input:focus-visible { outline: var(--n-ring) solid var(--accent); outline-offset: 2px; }
  .addrow { display: flex; gap: var(--n-s-sm); align-items: center; }
  .addfield .act { margin: 0; }
  .cancel { width: 30px; height: 30px; flex: none; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; font: inherit; font-size: 1.1em; font-weight: 800; line-height: 1; cursor: pointer; background: var(--n-pill-bg); color: inherit; }

  /* Things that are switched on wear their colour; on a dark tile the pills go light */
  :host(.dark) .pill, :host(.dark) nice-slider { --slide-bg: rgba(255,255,255,.2); }
  :host(.dark) .pill { background: rgba(255,255,255,.2); }
  :host(.night) nice-slider { --slide-bg: rgba(255,255,255,.18); }
`;

// Eyebrow, words, the action button and ticks: shared with cards that draw tile-like boxes of their own
export const textStyles = css`
  .lbl { font-size: var(--n-lbl-size); font-weight: var(--n-lbl-weight); letter-spacing: var(--n-lbl-track); text-transform: uppercase; opacity: var(--n-lbl-opacity);
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .say { font-family: var(--n-display); font-weight: 800; font-size: 1.3em; line-height: 1.12; letter-spacing: -0.01em; text-wrap: balance;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .say.big { font-size: 2.1em; line-height: 1; }
  .sub { font-size: 0.94em; font-weight: 600; opacity: .78; margin-top: var(--n-s-2xs); }
  .act { justify-self: start; margin-top: var(--n-s-sm); background: var(--ink); color: var(--bg); }
  .act.armed { background: var(--n-warn); color: #fff; }
  .act.add { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px currentColor; opacity: .7; align-self: end; }
  .tick { position: relative; width: var(--n-c-sm); height: var(--n-c-sm); border-radius: 50%; border: 0; cursor: pointer; color: inherit; background: transparent; box-shadow: inset 0 0 0 2px currentColor; opacity: .45; flex: none; padding: 0; transition: transform .4s var(--n-spring); }
  .tick:hover { opacity: 1; background: var(--accent); }
  .tick.done { background: var(--n-ok); box-shadow: none; opacity: 1; transform: scale(1.15); }
  .tick.done::after { content: ""; position: absolute; left: 7px; top: 3.5px; width: 4.5px; height: 9px; border: solid #fff; border-width: 0 2.5px 2.5px 0; transform: rotate(45deg); animation: check .22s ease-out .06s backwards; }
  @keyframes check { from { clip-path: inset(0 0 100% 0); } }
`;
