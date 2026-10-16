// The Litter-Robot 4 from the front, as SVG markup, and its status codes in house words.
// The litter fills toward MAX, the drawer toward FULL, curtains close while someone is inside.
// Illustrative, not status: the colour of the litter bed in the drawing
export const LITTER_BED = "#e2c48e";

// pylitterbot's LR4 status codes, in house words: [kind, headline, second line]
export const LR_STATUS = {
  rdy: ["ok", "Clean and ready"], ccc: ["ok", "Just cleaned", "Cleaned a moment ago"],
  ccp: ["busy", "Cleaning", "Rotating the globe · about 2 min"], ec: ["busy", "Running an empty cycle", "Rotating the globe · about 2 min"],
  pwru: ["busy", "Starting up", "Back in a minute"], pwrd: ["busy", "Powering down", ""],
  cd: ["cat", "Someone's in there", "Cleaning waits until they leave"], cst: ["cat", "Waiting to clean", "Starts once they've been gone a while"],
  csi: ["warn", "Cat sensor interrupted", "Something's blocking the sensor"], p: ["warn", "Paused", "Press the panel button to resume"],
  df1: ["warn", "Drawer almost full", "Room for about 2 more cleans"], df2: ["warn", "Drawer almost full", "Room for 1 more clean"],
  dfs: ["warn", "Drawer's full", "Empty it, then let it know"], sdf: ["warn", "Drawer's full", "Empty it, then let it know"],
  pd: ["bad", "Pinch detected", "Check the globe, then press the panel button"], spf: ["bad", "Pinch detected", "Check the globe, then press the panel button"],
  otf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"], dhf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"],
  dpf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"], hpf: ["bad", "Globe got stuck", "Check for clumps, then press the panel button"],
  csf: ["bad", "Cat sensor fault", "Wipe the sensor, then press the panel button"], scf: ["bad", "Cat sensor fault", "Wipe the sensor, then press the panel button"],
  br: ["bad", "Bonnet's off", "Put the bonnet back on"],
  off: ["off", "Turned off", "Press the power button"], offline: ["off", "Can't reach it", "Is it plugged in?"],
};
export const LR_DRAWER_SOON = ["df1", "df2", "dfs", "sdf"];

// The robot straight on: a globe in a thick bezel on its base, the waste drawer the lower front of the base
export function lrRobot({ litter, drawer, kind, cycling, lit, locked }) {
  const ox = 100, oy = 80, r = 52;                                    // the opening
  const maxY = oy + r * 0.62, floorY = oy + r;                        // fill line, bottom of the globe
  const bedTop = floorY - Math.max(3, (floorY - maxY) * Math.min(100, litter ?? 0) / 100);
  const dTop = 156, dBot = 202, fullY = dTop + 22;                    // drawer, and its full line under the handle
  const fillH = Math.round((dBot - fullY) * Math.min(100, drawer ?? 0) / 100);
  const drw = `M50,${dTop} L150,${dTop} C150,178 148,${dBot - 6} 140,${dBot} L60,${dBot} C52,${dBot - 6} 50,178 50,${dTop} Z`;
  // Occupied: the curtains are drawn. Two drapes, a few fold lines each, meet in the middle under a scalloped valance.
  const scallops = Array.from({ length: 6 }, (_, k) => { const x = ox - r + (k * 2 * r) / 6, w = (2 * r) / 6; return `Q${x + w / 2},${oy - r + 26} ${x + w},${oy - r + 16}`; }).join(" ");
  const fold = (x, s) => `<path class="fold" d="M${ox + x},${oy - r + 14} C${ox + x - 2 * s},${oy} ${ox + x + 2 * s},${oy + 24} ${ox + x},${oy + r}"/>`;
  const curtain = kind === "cat" ? `<g clip-path="url(#lr-mouth)">
      <g class="l"><path class="drape" d="M${ox - r},${oy - r} L${ox + 2},${oy - r} C${ox},${oy - 10} ${ox - 3},${oy + 30} ${ox + 1},${oy + r} L${ox - r},${oy + r} Z"/>${[-36, -24, -12].map((x) => fold(x, 1)).join("")}</g>
      <g class="r"><path class="drape" d="M${ox + r},${oy - r} L${ox - 2},${oy - r} C${ox},${oy - 10} ${ox + 3},${oy + 30} ${ox - 1},${oy + r} L${ox + r},${oy + r} Z"/>${[36, 24, 12].map((x) => fold(x, -1)).join("")}</g>
      <path class="valance" d="M${ox - r - 2},${oy - r - 2} L${ox - r - 2},${oy - r + 16} L${ox - r},${oy - r + 16} ${scallops} L${ox + r + 2},${oy - r + 16} L${ox + r + 2},${oy - r - 2} Z"/>
    </g>` : "";
  return `<svg class="lr ${cycling ? "cycling" : ""} ${kind === "off" ? "off" : ""}" viewBox="0 0 200 210" role="img" aria-label="Litter-Robot">
    <defs><clipPath id="lr-mouth"><circle cx="${ox}" cy="${oy}" r="${r}"/></clipPath><clipPath id="lr-drw"><path d="${drw}"/></clipPath></defs>
    <path class="shell" d="M46,104 L154,104 C156,140 156,170 154,192 C153,201 148,206 140,206 L60,206 C52,206 47,201 46,192 C44,170 44,140 46,104 Z"/>
    <circle class="shell" cx="${ox}" cy="${oy}" r="72"/>
    <circle class="rim" cx="${ox}" cy="${oy}" r="67"/>
    <path class="panel ${locked ? "locked" : ""}" d="M128,13.8 A72,72 0 0 1 146,24.6"/>
    <g class="hot" data-part="litter"><title>Litter level</title>
      <circle class="mouth" cx="${ox}" cy="${oy}" r="${r}"/>
      <g clip-path="url(#lr-mouth)">
        <rect class="bed spin ${litter != null && litter < 40 ? "low" : ""}" x="${ox - r}" y="${bedTop}" width="${r * 2}" height="${floorY - bedTop + 2}"/>
        <path class="max" d="M${ox - 40},${maxY} L${ox + 40},${maxY}"/>
      </g>
      <text class="maxt" x="${ox}" y="${maxY + 8}" text-anchor="middle">MAX</text>
      ${curtain}
      <circle class="sensor" cx="${ox}" cy="${oy - r - 5}" r="1.8"/>
      <circle class="nl ${lit ? "lit" : ""}" cx="${ox - 12}" cy="${oy - r + 4}" r="2.2"/>
      <circle class="nl ${lit ? "lit" : ""}" cx="${ox + 12}" cy="${oy - r + 4}" r="2.2"/>
    </g>
    <g class="hot" data-part="drawer"><title>Waste drawer</title>
      <path class="drawer" d="${drw}"/>
      <rect class="dfill ${drawer != null && drawer >= 80 ? "hi" : ""}" clip-path="url(#lr-drw)" x="50" y="${dBot - fillH}" width="100" height="${fillH}"/>
      <path class="max" d="M60,${fullY} L140,${fullY}"/>
      <text class="maxt" x="100" y="${fullY + 8}" text-anchor="middle">FULL</text>
      <path class="handle" d="M80,${dTop} L120,${dTop} L120,${dTop + 8} C120,${dTop + 12} 117,${dTop + 14} 113,${dTop + 14} L87,${dTop + 14} C83,${dTop + 14} 80,${dTop + 12} 80,${dTop + 8} Z"/>
    </g>
  </svg>`;
}
