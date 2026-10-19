// A room page's sections: a list, curated by hand, shown in the order written.
//
//   sections:
//     - title: Lights
//       entities: [light.x, { entity: light.y, name: Lamp }, { adaptive: switch.z, … }]
//       all: false            optional; any nice-controls option (tone, room_tone, strip, …)
//
// Room pages first written as a map ({ Lights: { entities }, Motion: { hide: true }, Mine:
// { after: Lights } }) still load: normalize() turns that into the list, dropping hidden and
// empty sections. No Home Assistant or Lit here, so the converter can use it too.

const ORDER = ["Lights", "Scenes", "Climate", "Playing", "Doors & windows", "Motion", "Plugs & more", "Power"];

export function normalize(sections) {
  if (Array.isArray(sections)) return sections.filter((s) => s && (s.entities || []).length);
  if (!sections || typeof sections !== "object") return [];
  const strip = ({ hide, after, before, add, remove, ...rest }) => rest;
  const made = ORDER.filter((t) => sections[t] && !sections[t].hide && (sections[t].entities || []).length)
    .map((title) => ({ title, ...strip(sections[title]) }));
  for (const [key, o] of Object.entries(sections)) {
    if (ORDER.includes(key) || o.hide || !(o.entities || []).length) continue;
    const at = (t) => (t ? made.findIndex((m) => m.title === t) : -1);
    const before = at(o.before), after = at(o.after);
    made.splice(before >= 0 ? before : after >= 0 ? after + 1 : made.length, 0, { title: key, ...strip(o) });
  }
  return made;
}

// Every room page opens its Lights section with a card for all the room's lights (it takes
// over the section's All on/off pill); a page without a Lights section gets one
export function withRoomLights(sections, c, lights) {
  if (c.room_lights === false || !lights) return sections;
  const card = { room_lights: c.area };
  const i = sections.findIndex((s) => s.title === "Lights");
  if (i < 0) return [{ title: "Lights", all: false, entities: [card] }, ...sections];
  return sections.map((s, j) => (j === i ? { ...s, all: false, entities: [card, ...s.entities] } : s));
}

// Every entity id a section list names, for "what's already on this page"
export function entityIds(sections) {
  const out = new Set();
  for (const s of sections) for (const e of s.entities || []) {
    if (typeof e === "string") out.add(e);
    else for (const k of ["entity", "strip", "adaptive", "board"]) if (e[k]) out.add(e[k]);
    if (e?.bars) for (const b of e.bars) out.add(b.entity || b);
  }
  return out;
}
