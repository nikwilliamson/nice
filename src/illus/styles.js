// The drawings' styles: the car from above, the Litter-Robot, the feeder.
import { css } from "lit";

export const illusStyles = css`
  .pic svg { max-width: 100%; }
  /* The car from above */
  .car { width: 100%; max-height: 160px; display: block; overflow: visible; }
  .car .shell { fill: currentColor; fill-opacity: .07; stroke: currentColor; stroke-opacity: .42; stroke-width: 1.6; }
  .car .tire { fill: currentColor; opacity: .3; }
  .car .glass { fill: currentColor; fill-opacity: .2; }
  .car .glass.vent { fill-opacity: .3; }
  .car .seam { fill: none; stroke: var(--bg); stroke-width: 2.4; }
  .car .mirror { fill: currentColor; opacity: .35; }
  .car .light { fill: none; stroke: currentColor; stroke-opacity: .4; stroke-width: 2.2; stroke-linecap: round; }
  .car .part { cursor: pointer; }
  .car .cut { fill: none; stroke: currentColor; stroke-opacity: .32; stroke-width: 1.1; }
  .car .part path, .car .part rect { fill: currentColor; fill-opacity: .03; stroke: currentColor; stroke-opacity: .24; stroke-width: 1; transition: fill var(--n-t-quick) ease; }
  /* Closed doors and windows stay invisible (but tappable); only what's open shows */
  .car .part.door:not(.open) path, .car .part.win:not(.open) path { fill-opacity: 0; stroke-opacity: 0; }
  .car .part.open path, .car .part.open rect { fill: var(--accent); fill-opacity: 1; stroke: var(--accent); stroke-opacity: 1; }
  .car .part.unk path, .car .part.unk rect { fill: none; stroke-opacity: .55; stroke-dasharray: 3 3; }
  .car .part.gone { display: none; }
  /* The Litter-Robot 4 from the front */
  .lr { width: 100%; max-height: 220px; display: block; overflow: visible; }
  .lr .shell { fill: color-mix(in srgb, currentColor 7%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.6; }
  .lr .rim { fill: none; stroke: currentColor; stroke-opacity: .22; stroke-width: 1.1; }
  .lr .mouth { fill: color-mix(in srgb, currentColor 22%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; }
  .lr .bed { fill: #e2c48e; }
  .lr .bed.low { fill: var(--n-warn); }
  .lr .max { stroke: currentColor; stroke-opacity: .45; stroke-width: 1; stroke-dasharray: 3 3; }
  .lr .maxt { font: 800 6px var(--n-body); fill: currentColor; opacity: .55; letter-spacing: .06em; }
  .lr .spin { transform-origin: 100px 80px; }
  .lr.cycling .spin { animation: tilt 2.6s ease-in-out infinite; }
  .lr .nl { fill: currentColor; opacity: .3; }
  .lr .nl.lit { fill: var(--accent); opacity: 1; filter: drop-shadow(0 0 3px var(--accent)); }
  .lr .sensor { fill: currentColor; opacity: .45; }
  .lr .panel { fill: none; stroke: currentColor; stroke-opacity: .55; stroke-width: 3; stroke-linecap: round; }
  .lr .panel.locked { stroke: var(--n-ok); stroke-opacity: 1; }
  .lr .drawer { fill: color-mix(in srgb, currentColor 4%, var(--bg)); stroke: currentColor; stroke-opacity: .35; stroke-width: 1.2; }
  .lr .handle { fill: color-mix(in srgb, currentColor 14%, var(--bg)); stroke: currentColor; stroke-opacity: .3; stroke-width: 1; }
  .lr .dfill { fill: currentColor; fill-opacity: .22; }
  .lr .dfill.hi { fill: var(--n-warn); fill-opacity: 1; }
  /* Occupied: stage curtains, drawn in the same lines as the rest */
  .lr .drape { fill: color-mix(in srgb, currentColor 10%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; stroke-linejoin: round; }
  .lr .fold { fill: none; stroke: currentColor; stroke-opacity: .3; stroke-width: 1.1; stroke-linecap: round; }
  .lr .valance { fill: color-mix(in srgb, currentColor 14%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; stroke-linejoin: round; }
  .lr .l { animation: shutL .6s cubic-bezier(.2,.8,.2,1); }
  .lr .r { animation: shutR .6s cubic-bezier(.2,.8,.2,1); }
  .lr .hot { cursor: pointer; }
  .lr .hot:hover { opacity: .85; }
  .lr.off { opacity: .5; }
  @keyframes tilt { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-24deg); } }
  @keyframes shutL { from { transform: translateX(-56px); } }
  @keyframes shutR { from { transform: translateX(56px); } }
  /* The Aqara C1 from the front */
  .fd { width: 100%; max-height: 130px; display: block; overflow: visible; }
  .fd .body { fill: color-mix(in srgb, currentColor 5%, #ffffff); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.6; }
  :host(.night) .fd .body { fill: color-mix(in srgb, currentColor 10%, var(--bg)); }
  .fd .lid { stroke: currentColor; stroke-opacity: .3; stroke-width: 1.2; }
  .fd .window { fill: color-mix(in srgb, currentColor 9%, var(--bg)); stroke: currentColor; stroke-opacity: .22; stroke-width: 1; }
  .fd .btn { fill: none; stroke: currentColor; stroke-opacity: .35; stroke-width: 2; }
  .fd .btn.lit { stroke: var(--accent); stroke-opacity: 1; filter: drop-shadow(0 0 3px var(--accent)); }
  .fd .btnc { fill: color-mix(in srgb, currentColor 14%, var(--bg)); }
  .fd .lock rect { fill: var(--n-locked); }
  .fd .lock path { fill: none; stroke: var(--n-locked); stroke-width: 1.6; }
  .fd .alert circle { fill: #ffffff; }
  .fd .alert path { stroke: var(--n-alert); stroke-width: 2.2; stroke-linecap: round; }
  .fd .chute { fill: color-mix(in srgb, currentColor 30%, var(--bg)); }
  .fd .tray { fill: color-mix(in srgb, currentColor 7%, var(--bg)); stroke: currentColor; stroke-opacity: .42; stroke-width: 1.4; }
  .fd .bowl { fill: color-mix(in srgb, currentColor 18%, var(--bg)); stroke: currentColor; stroke-opacity: .4; stroke-width: 1.3; }
  .fd .kib { fill: #c98a4b; stroke: #8f5a26; stroke-width: .6; }
  .fd.off { opacity: .5; }
`;
