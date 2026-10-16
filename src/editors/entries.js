// What can be set on each kind of entry in a nice-controls list, as form fields.
import { TONE_NAMES } from "../core/tones.js";

export const KINDS = {
  entity: { label: "Entity", blank: { entity: "" } },
  adaptive: { label: "Adaptive lighting", blank: { adaptive: "", name: "Adaptive" } },
  bars: { label: "Power bars", blank: { name: "Circuits", shape: "F", bars: [] } },
  board: { label: "Vestaboard", blank: { board: "", shape: "W" } },
  strip: { label: "LED strip", blank: { strip: "" } },
};
export const kindOf = (e) => (typeof e === "string" ? "entity" : ["adaptive", "bars", "board", "strip"].find((k) => e[k] != null) || "entity");
export const entryId = (e) => (typeof e === "string" ? e : e.entity || e.strip || e.adaptive || e.board || null);

// An entry as an object for the form, and back to the shortest form for the YAML
export const toObject = (e) => (typeof e === "string" ? { entity: e } : e);
export const toEntry = (o) => (Object.keys(o).length === 1 && o.entity ? o.entity : o);

const opts = (list) => list.map(([value, label]) => ({ value, label }));
// A select whose first choice means "leave it to the card": stored as nothing at all
const auto = (name, label, options, help) => ({
  name, label, help, selector: { select: { mode: "dropdown", options: opts([["auto", "Automatic"], ...options]) } },
  from: (c) => c[name] ?? "auto", to: (v, c) => ({ ...c, [name]: v === "auto" ? null : v }),
});
const SHAPE = auto("shape", "Tile size", [["S", "Small"], ["W", "Wide"], ["T", "Tall"], ["L", "Large"], ["F", "Full row"], ["FL", "Full row, tall"]]);
export const TONE = auto("tone", "Colour", TONE_NAMES.map((t) => [t, t[0].toUpperCase() + t.slice(1)]));
const NAME = { name: "name", label: "Name", selector: { text: {} } };
const num = (name, label, min, max, step = 1, unit) => ({ name, label, selector: { number: { min, max, step, mode: "box", unit_of_measurement: unit } } });

export function fieldsFor(kind, entry, hass) {
  if (kind === "adaptive") return [
    { name: "adaptive", label: "Adaptive Lighting zone", selector: { entity: { filter: { domain: "switch" } } } },
    NAME, { name: "lights", label: "Its lights (to count which were set by hand)", selector: { entity: { multiple: true, filter: { domain: "light" } } } },
    num("min", "Warmest", 1500, 6500, 100, "K"), num("max", "Coolest", 1500, 6500, 100, "K"), SHAPE,
  ];
  if (kind === "bars") return [
    NAME, num("top", "Show this many before “Show all”", 1, 50), TONE, SHAPE,
    { name: "bars", label: "Circuits", add: "Add a circuit", title: (b, h) => b.name || h?.states?.[b.entity]?.attributes?.friendly_name || b.entity,
      list: [{ name: "entity", label: "Power sensor", selector: { entity: { filter: { domain: "sensor", device_class: "power" } } } }, NAME],
      from: (c) => (c.bars || []).map(toObject), to: (v, c) => ({ ...c, bars: v.map(toEntry) }) },
  ];
  if (kind === "board") return [{ name: "board", label: "Vestaboard sensor", selector: { entity: { filter: { domain: "sensor" } } } }, NAME, SHAPE];
  if (kind === "strip") return [
    { name: "strip", label: "LED strip light", selector: { entity: { filter: { domain: "light" } } } }, NAME,
    { name: "palette", label: "Palette (WLED)", selector: { entity: { filter: { domain: "select" } } } },
    { name: "speed", label: "Speed", selector: { entity: { filter: { domain: "number" } } } },
    { name: "intensity", label: "Intensity", selector: { entity: { filter: { domain: "number" } } } },
    { name: "reverse", label: "Reverse", selector: { entity: { filter: { domain: "switch" } } } },
    { name: "freeze", label: "Freeze", selector: { entity: { filter: { domain: "switch" } } } }, SHAPE,
  ];
  const id = toObject(entry).entity || "", sensor = id.startsWith("sensor.");
  return [
    { name: "entity", label: "Entity", selector: { entity: {} } }, NAME, SHAPE,
    ...(sensor ? [auto("chart", "Chart", [["spark", "Line"], ["bars", "Daily bars"], ["none", "None"]], "Automatic draws a line for power, temperature and humidity"),
      num("hours", "Line covers", 1, 720, 1, "hours"), num("days", "Bars cover", 2, 60, 1, "days")] : []),
  ];
}

// A word or two about what an entry is showing right now
export function stateWords(hass, e) {
  const id = entryId(e), s = id && hass?.states?.[id];
  if (kindOf(e) === "bars") return `${(e.bars || []).length} circuits`;
  if (!s) return id ? "not found" : "not set";
  if (s.state === "unavailable") return "offline";
  const a = s.attributes;
  if (id.startsWith("light.") && s.state === "on" && a.brightness != null) return `on · ${Math.round((a.brightness / 255) * 100)}%`;
  // Home Assistant's own formatting: rounding, units and translated states
  if (hass.formatEntityState) return hass.formatEntityState(s);
  const n = Number(s.state), unit = a.unit_of_measurement ? ` ${a.unit_of_measurement}` : "";
  return Number.isFinite(n) && s.state !== "" ? `${+n.toFixed(1)}${unit}` : s.state;
}
