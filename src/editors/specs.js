// Every card's options, as form fields (see form.js). A function of hass where the choices
// come from what's in Home Assistant: the cars, the litter robot, the feeders.
import { prefixes } from "./shared.js";
import { TONE } from "./entries.js";

const text = (name, label, help) => ({ name, label, help, selector: { text: {} } });
const ent = (name, label, domain, extra = {}) => ({ name, label, selector: { entity: { ...(domain ? { filter: { domain } } : {}), ...extra } } });
const num = (name, label, min, max, unit) => ({ name, label, selector: { number: { min, max, mode: "box", unit_of_measurement: unit } } });
const pick = (name, label, options, custom = false, multiple = false) => ({ name, label, selector: { select: { options, custom_value: custom, multiple, mode: "dropdown" } } });
// A switch whose default is on: stored only when you turn it off
const on = (name, label) => ({ name, label, selector: { boolean: {} }, from: (c) => c[name] !== false, to: (v, c) => ({ ...c, [name]: v ? null : false }) });
const BASE = text("base_path", "Dashboard path", "Where links point, like /house-nice");
// A map shown as a list of pairs
const mapList = (name, key, val) => ({ from: (c) => Object.entries(c[name] || {}).map(([k, v]) => ({ [key]: k, [val]: v })),
  to: (v, c) => ({ ...c, [name]: Object.fromEntries(v.filter((x) => x[key]).map((x) => [x[key], x[val]])) }) });

export const SKY = [ent("weather", "Weather", "weather"), ent("persons", "People", "person", { multiple: true }), num("font_scale", "Text size", 0.5, 2)];

export const ROOMS = [
  BASE,
  { name: "areas", label: "Rooms, in order (sets each room's colour)", strings: { area: {} }, add: "Add a room" },
  { name: "adaptive", label: "Sleep chips: Adaptive Lighting per room", add: "Add a room", title: (x, h) => h?.areas?.[x.area]?.name || x.area,
    list: [{ name: "area", label: "Room", selector: { area: {} } }, ent("switches", "Adaptive Lighting zones", "switch", { multiple: true })],
    ...mapList("adaptive", "area", "switches") },
];

export const ROOM = [{ name: "area", label: "Room", selector: { area: {} } }, BASE, text("back", "Back goes to (view path)")];

const PLACES = ["kitchen", "laundry", "cats", "doors", "climate", "energy", "garage", "health"].map((p) => ({ value: p, label: p }));
export const GRID = [
  BASE, ent("todo", "Chores list", "todo"), num("min_tiles", "At least this many tiles", 1, 40), num("budget", "Room for (cells, before growing)", 4, 80),
  { name: "alert_charts", label: "Charts on alert tiles", selector: { boolean: {} } },
  { name: "routes", label: "Where a tile goes when tapped", add: "Add a place", title: (x) => (x.place ? `${x.place} → ${x.to || "?"}` : "New place"),
    list: [pick("place", "Place (what the rules call it)", PLACES, true), text("to", "Goes to", "A view path like room-kitchen, or tab:<id> for a tab")],
    ...mapList("routes", "place", "to") },
];

export const LISTS = [{ name: "lists", label: "Lists", add: "Add a list", title: (x, h) => x.label || h?.states?.[x.entity]?.attributes?.friendly_name || x.entity,
  list: [ent("entity", "To-do list", "todo"), text("label", "Label"), TONE, text("placeholder", "Add field says"),
    { name: "upper", label: "Store new items in capitals", selector: { boolean: {} } }, { name: "get", label: "Say “to get” rather than “to do”", selector: { boolean: {} } }] }];

export const CAR = (h) => [pick("car", "Car", prefixes(h, /^lock\.(.+)_s_car_lock$/).map((p) => ({ value: p, label: p })), true), text("name", "Name", "Shown as “<name> car”"),
  pick("model", "Drawing", [{ value: "3", label: "Model 3" }, { value: "S", label: "Model S" }, { value: "Y", label: "Model Y" }, { value: "X", label: "Model X" }])];

export const LITTER = (h) => [pick("robot", "Litter-Robot", prefixes(h, /^vacuum\.(.+)_litter_box$/).map((p) => ({ value: p, label: p })), true),
  text("name", "Name"), text("place", "Where it is"), pick("part", "Show", [{ value: "all", label: "Everything" }, { value: "robot", label: "The robot" }, { value: "cats", label: "The cats" }]),
  { name: "cats", label: "Cats", add: "Add a cat", list: [text("name", "Name"), ent("weight", "Weight sensor", "sensor"), ent("visits", "Visits today sensor", "sensor"), TONE] }];

const feeders = (h) => prefixes(h, /^button\.(.+)_feed$/).map((p) => ({ value: p, label: p }));
export const FEEDER = (h) => [text("heading", "Heading"), ent("schedule", "Meal schedule automation", "automation"),
  { name: "feeders", label: "Feeders", add: "Add a feeder", list: [text("name", "Cat"), pick("feeder", "Feeder", feeders(h), true), TONE] },
  { name: "meals", label: "Meals (for the schedule tile)", add: "Add a meal", title: (x) => (x.at ? `${x.at.slice(0, 5)} × ${x.portions || "?"}` : "New meal"),
    list: [{ name: "at", label: "At", selector: { time: {} } }, num("portions", "Portions", 1, 20)] }];

export const SNACK = (h) => [ent("script", "Feeding script", "script"), num("portions", "Portions each", 1, 10), text("title", "Says"), text("heading", "Heading"),
  { name: "names", label: "Cats' names", strings: { text: {} }, add: "Add a name" }, pick("feeders", "Feeders (to know when they're offline)", feeders(h), true, true)];

export const FOOTER = [on("menu", "Menu button"), on("edit", "Edit dashboard button (admins)"), on("hide_sidebar", "Hide the sidebar on this dashboard")];
