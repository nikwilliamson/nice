// Nice: the house dashboard's cards. One resource, /local/nice/nice.js.
//
// Cards: nice-grid, nice-sky, nice-tabs, nice-rooms, nice-room, nice-room-page,
// nice-controls, nice-lists, nice-car, nice-litter, nice-feeder, nice-snack, nice-footer,
// and the library pages nice-design and nice-viz.
import { TOKENS } from "./core/tokens.js";
import "./tile/tile.js";
import "./cards/grid.js";
import "./cards/sky.js";
import "./cards/tabs.js";
import "./cards/rooms.js";
import "./cards/room-page.js";
import "./cards/controls.js";
import "./cards/lists.js";
import "./cards/car.js";
import "./cards/litter.js";
import "./cards/feeder.js";
import "./cards/footer.js";
import "./cards/library.js";
import "./editors/room-page.js";
import "./editors/controls.js";

// The fonts every card uses
if (!document.getElementById("nice-fonts")) {
  const link = document.createElement("link");
  link.id = "nice-fonts";
  link.rel = "stylesheet";
  link.href = TOKENS.font.url;
  document.head.appendChild(link);
}

const CARDS = [
  ["nice-grid", "Nice grid", "The landing grid, from the sensor.nice_tiles_* rules."],
  ["nice-sky", "Nice sky", "A sky header that follows the sun and the weather."],
  ["nice-tabs", "Nice tabs", "Pill tabs; each holds a list of cards."],
  ["nice-rooms", "Nice rooms", "A tile per room, coloured when its lights are on."],
  ["nice-room", "Nice room", "The header for a room's page."],
  ["nice-room-page", "Nice room page", "A whole room page, built from what's in the area."],
  ["nice-controls", "Nice controls", "Lights, media, climate, locks and sensors as tiles."],
  ["nice-lists", "Nice lists", "To-do lists side by side."],
  ["nice-car", "Nice car", "A Tesla as tiles."],
  ["nice-litter", "Nice litter", "A Litter-Robot 4 and its cats."],
  ["nice-feeder", "Nice feeder", "Aqara C1 feeders, one tile per cat."],
  ["nice-snack", "Nice snack", "Snack time, with a two-tap Serve."],
  ["nice-footer", "Nice footer", "Menu and Edit at the bottom; hides the top bar."],
  ["nice-design", "Nice design system", "Every colour, type style, size and shape."],
  ["nice-viz", "Nice visualizations", "Every chart the grid can draw."],
];
window.customCards = window.customCards || [];
window.customCards.push(...CARDS.map(([type, name, description]) => ({ type, name, description })));

// eslint-disable-next-line no-undef
console.info(`%c NICE %c ${__NICE_VERSION__} `, "background:#ff6b4a;color:#fff;font-weight:700", "background:#1c2233;color:#fff");
