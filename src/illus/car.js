// The car from above, as SVG markup: open doors swing out, open lids fill with the accent.
// Parts carry data-more="<entity>" so a tap on one opens its details.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Body parts on the top-down drawing (front of the car to the right, driver's side on top)
export const DOORS = [
  ["front_driver", "Front driver"], ["rear_driver", "Rear driver"],
  ["front_passenger", "Front passenger"], ["rear_passenger", "Rear passenger"],
];

// A Tesla from above, front to the right and the driver's side on top, in the proportions of
// a Model 3 / Y (about 2.5 : 1). Everything is drawn for the top half and mirrored for the
// passenger side. Open doors swing out on their front hinges; open lids fill with the accent.
export function carOverhead({ d, w, frunk, trunk, port, vent, sedan, title, label }) {
  const flip = (el) => `<g transform="translate(0 120) scale(1 -1)">${el}</g>`;
  const part = (p, el, kind = "lid") => `<g class="part ${kind} ${p.cls}" data-more="${esc(p.eid)}"><title>${esc(title(p))}</title>${el}</g>`;
  const door = (p, x, hinge, bottom) => {
    const panel = `<path d="M${x},14.6 L${hinge - 1},13.9 L${hinge - 1},20.5 L${x},21 Z"/>`;
    const swung = p.cls === "open" ? `<g transform="rotate(-27 ${hinge} 14)">${panel}</g>` : panel;
    return part(p, bottom ? flip(swung) : swung, "door");
  };
  const win = (p, x1, x2, bottom) => {
    const y1 = 25.4 + (178 - x1) * 0.05, y2 = 25.4 + (178 - x2) * 0.05;
    const el = `<path d="M${x1},${y1 + 0.6} L${x2},${y2 + 0.6} L${x2},${y2 + 4.2} L${x1},${y1 + 4.2} Z"/>`;
    return part(p, bottom ? flip(el) : el, "win");
  };
  const g0 = sedan ? 76 : 56; // where the glass ends at the back
  const body = "M12,60 C12,33 19,17 42,13.2 C72,9.6 110,14.8 140,14.6 C172,14.4 200,10.8 223,14.8 C241,18.4 249.5,36 249.5,60 C249.5,84 241,101.6 223,105.2 C200,109.2 172,105.6 140,105.4 C110,105.2 72,110.4 42,106.8 C19,103 12,87 12,60 Z";
  const glass = `M180,23.4 C195,38 195,82 180,96.6 L${g0 + 16},91.2 C${g0 + 3},89.6 ${g0 - 3},78 ${g0 - 3},60 C${g0 - 3},42 ${g0 + 3},30.4 ${g0 + 16},28.8 Z`;
  const lid = sedan
    ? "M74,25.4 C40,23.6 19,38 19,60 C19,82 40,96.4 74,94.6 C69.6,76 69.6,44 74,25.4 Z"
    : "M54,27.6 C31,27 19,40 19,60 C19,80 31,93 54,92.4 C50,76 50,44 54,27.6 Z";
  const hood = "M194,21.4 C224,19.6 241.6,37.6 242.4,60 C241.6,82.4 224,100.4 194,98.6 C198.6,80 198.6,40 194,21.4 Z";
  const tire = (x) => `<rect class="tire" x="${x}" y="8.6" width="31" height="8" rx="3.6"/>`;
  const mirror = `<path class="mirror" d="M171,14.6 C169.4,8.2 163.4,5.6 157.6,6.8 C156.4,9.6 157.6,12.6 160.6,15.2 Z"/>`;
  // Door shut lines: from above, a closed door is only its seams
  const cuts = `<path class="cut" d="M84,14.2 L84,21.4 M127,13.9 L127,21 M172,13.9 L172,20.6"/>`;
  const lights = `<path class="light" d="M234,22.6 C239.6,26.6 243.4,33 245,40.6"/><path class="light" d="M24.6,22.6 C19.6,26.6 16.8,32.4 15.8,39"/>`;
  return `<svg class="car" viewBox="0 0 260 120" role="img" aria-label="${esc(label)}">
    ${tire(42)}${tire(190)}${flip(tire(42) + tire(190))}
    <path class="shell" d="${body}"/>
    ${part(frunk, `<path d="${hood}"/>`)}
    ${part(trunk, `<path d="${lid}"/>`)}
    <path class="glass ${vent ? "vent" : ""}" d="${glass}"/>
    <path class="seam" d="M150,23.6 C154,40 154,80 150,96.4"/>
    <path class="seam" d="M${sedan ? 96 : 82},26.4 C${sedan ? 99 : 85},42 ${sedan ? 99 : 85},78 ${sedan ? 96 : 82},93.6"/>
    ${lights}${flip(lights)}${cuts}${flip(cuts)}${mirror}${flip(mirror)}
    ${win(w.front_driver, 170, 132)}${win(w.rear_driver, 128, sedan ? 100 : 88)}
    ${win(w.front_passenger, 170, 132, true)}${win(w.rear_passenger, 128, sedan ? 100 : 88, true)}
    ${door(d.front_driver, 128, 172)}${door(d.rear_driver, 84, 127)}
    ${door(d.front_passenger, 128, 172, true)}${door(d.rear_passenger, 84, 127, true)}
    ${part(port, `<rect x="23" y="17.4" width="11" height="6.4" rx="2.4"/>`, "port")}
  </svg>`;
}
