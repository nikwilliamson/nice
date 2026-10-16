// The Aqara C1 feeder from the front, as SVG markup: kibble in the bowl per portion, the
// button's ring is the LED, a lock for child lock.
// Illustrative, not status: the kibble in the bowl
export const KIBBLE = "#c98a4b", KIBBLE_EDGE = "#8f5a26";

// "17:30" as the viewer's clock writes it: "5:30 PM"
export const fdClock = (hm) => { const [h, m] = String(hm).split(":").map(Number), d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

// The C1 straight on: a tall rounded body with a lid, the button on the front, the chute and its bowl underneath
export function fdFeeder({ portions, led, locked, off, problem }) {
  const kib = Math.min(9, portions || 0);
  // Kibble heaps up from the middle of the bowl, a piece per portion
  const spots = [[60, 151], [53, 152], [67, 152], [57, 148], [63, 148], [47, 153], [73, 153], [60, 145], [50, 149]];
  const pile = spots.slice(0, kib).map(([x, y]) => `<ellipse class="kib" cx="${x}" cy="${y}" rx="3.4" ry="2.4"/>`).join("");
  return `<svg class="fd ${off ? "off" : ""}" viewBox="0 0 120 170" role="img" aria-label="Pet feeder">
    <defs><clipPath id="fd-bowl"><ellipse cx="60" cy="150" rx="27" ry="9"/></clipPath></defs>
    <rect class="body" x="24" y="10" width="72" height="128" rx="18"/>
    <path class="lid" d="M24,34 L96,34"/>
    <rect class="window" x="38" y="44" width="44" height="34" rx="9"/>
    <circle class="btn ${led ? "lit" : ""}" cx="60" cy="96" r="8"/>
    <circle class="btnc" cx="60" cy="96" r="4.4"/>
    ${locked ? `<g class="lock"><rect x="73" y="98" width="9" height="7" rx="1.6"/><path d="M75,98 L75,95.5 A2.5,2.5 0 0 1 80,95.5 L80,98"/></g>` : ""}
    ${problem ? `<g class="alert"><circle cx="85" cy="20" r="7"/><path d="M85,16 L85,21 M85,23.6 L85,24"/></g>` : ""}
    <rect class="chute" x="48" y="118" width="24" height="9" rx="4"/>
    <path class="tray" d="M14,146 C14,138 20,135 30,135 L90,135 C100,135 106,138 106,146 L106,152 C106,160 98,165 86,165 L34,165 C22,165 14,160 14,152 Z"/>
    <ellipse class="bowl" cx="60" cy="150" rx="29" ry="10.5"/>
    <g clip-path="url(#fd-bowl)">${pile}</g>
  </svg>`;
}
