// Every chart, by viz.type. A tile with an unknown type draws its words and no chart.
import { css } from "lit";
import { spark, dayline, dbars, rain } from "./lines.js";
import { tbar, tube, ring, countdown, battery, charge, kelvin } from "./gauges.js";
import { stack, thermo, checks, receipt } from "./parts.js";
import { board, flaps, eq, garland } from "./displays.js";

export const CHARTS = { spark, dayline, dbars, rain, tbar, tube, ring, countdown, battery, charge, kelvin, stack, thermo, checks, receipt, board, flaps, eq, garland };

// Where a chart sits on its tile: bleed (full width along the bottom), side (beside the
// words), after (below them), foot (on the bottom edge), stack (above them). Lists and
// buttons are the tile's own, not charts.
const OWN_LAYOUT = { list: "after", buttons: "foot", funky: "after" };
export const layoutOf = (viz) => (!viz?.type ? "text" : OWN_LAYOUT[viz.type] || CHARTS[viz.type]?.layout || "stack");

export const chartStyles = Object.values(CHARTS).map((c) => c.styles).filter(Boolean);
export const chart = (type) => CHARTS[type];
export { css };
