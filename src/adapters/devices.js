// Adapters for single entities: lights and switches, players, thermostats, locks,
// contacts and motion, vacuums, scenes and scripts, sensors, and settings.
import { registerTile, isOn, toneFor, TOGGLE, VALUE, offline } from "./registry.js";
import { nameOf, powerOf, domainOf } from "../data/entities.js";
import { sentence, words, power, ago, fromNow, duration, quiet } from "../core/format.js";

const d = (s) => domainOf(s.entity_id);
// The words every entity tile starts from
function base(e, s, ctx, extra = {}) {
  const on = isOn(s);
  return {
    id: s.entity_id, label: e.name || nameOf(ctx.hass, s, ctx.config.strip), colors: toneFor(s, on, ctx),
    say: offline(s) ? "Offline" : "", cls: [on ? "on" : "off"], hold: () => ctx.card.more(s.entity_id), ...extra,
  };
}

// Lights, switches, fans and input booleans: tap toggles
registerTile([...TOGGLE], {
  shape: () => "S",
  build(e, s, ctx) {
    const t = base(e, s, ctx, { tap: () => (offline(s) ? ctx.card.more(s.entity_id) : ctx.card.callEntity("homeassistant.toggle", s.entity_id)) });
    if (offline(s)) return t;
    const on = s.state === "on";
    if (d(s) === "light") {
      const pct = on ? Math.round(((s.attributes.brightness ?? 255) / 255) * 100) : 0;
      // A light with no dimmer just says On; its tile already wears the bulb's colour
      const dim = (s.attributes.supported_color_modes || []).some((m) => m !== "onoff");
      t.say = on ? (dim ? `${pct}%` : "On") : "Off";
      if (on && ctx.manual(s.entity_id)) t.sub = "Set by hand";
      if (dim) t.controls = [{ type: "slider", value: pct, min: 1, set: (v) => ctx.card.callEntity("light.turn_on", s.entity_id, { brightness_pct: v }) }];
      if (t.colors.dark) t.cls.push("dark");
      return t;
    }
    t.say = on ? "On" : "Off";
    const w = on ? powerOf(ctx.hass, s.entity_id) : null;
    if (w != null) t.sub = `Drawing ${power(w)}`;
    return t;
  },
});

// Players: what's on, play/pause and next, and the volume
registerTile("media_player", {
  shape: (s) => (isOn(s) ? "W" : "S"),
  build(e, s, ctx) {
    const a = s.attributes, on = isOn(s), playing = s.state === "playing", call = (svc) => ctx.card.callEntity(svc, s.entity_id);
    const t = base(e, s, ctx, { tap: () => call(on ? "media_player.media_play_pause" : "media_player.turn_on"), cls: [on ? "on" : "off", "media"] });
    if (offline(s)) return t;
    t.say = playing || s.state === "paused" ? a.media_title || (playing ? "Playing" : "Paused") : s.state === "off" || s.state === "standby" ? "Off" : "Idle";
    t.sub = [a.media_artist || a.media_series_title || a.app_name, s.state === "paused" ? "Paused" : ""].filter(Boolean).join(" · ");
    if (playing) { t.viz = { type: "eq" }; t.layout = "side"; }
    t.controls = [on ? { type: "pills", items: [{ label: playing ? "Pause" : "Play", run: () => call("media_player.media_play_pause") }, { label: "Next", run: () => call("media_player.media_next_track") }] }
      : { type: "pills", items: [{ label: "Turn on", run: () => call("media_player.turn_on") }] }];
    if (on && a.volume_level != null) {
      t.controls.push({ type: "slider", value: Math.round(a.volume_level * 100), label: "Volume {v}%", set: (v) => ctx.card.callEntity("media_player.volume_set", s.entity_id, { volume_level: v / 100 }) });
    }
    return t;
  },
});

// Thermostats: the room's temperature, the setpoint and the modes, in the same order on every one
const MODES = ["off", "heat", "cool", "heat_cool", "auto"], MODE_WORD = { off: "Off", heat: "Heat", cool: "Cool", heat_cool: "Auto", auto: "Auto" };
registerTile("climate", {
  shape: () => "L",
  build(e, s, ctx) {
    const a = s.attributes, t = base(e, s, ctx, { cls: [isOn(s) ? "on" : "off", "climate"] });
    if (offline(s)) return t;
    const set = a.temperature, goal = set != null ? Math.round(set) : null;
    t.say = a.current_temperature != null ? `${Math.round(a.current_temperature)}°` : "—";
    t.sub = s.state === "off" ? "Off" : goal == null ? sentence(s.state)
      : { cooling: `Cooling to ${goal}°`, heating: `Heating to ${goal}°`, drying: `Drying · set ${goal}°`, fan: `Fan running · set ${goal}°` }[a.hvac_action] || `Holding at ${goal}°`;
    // Setpoint taps add up on screen and go out as one call once they stop
    const step = (dir) => {
      const cur = ctx.card.hass.states[s.entity_id].attributes.temperature;
      const next = Math.max(a.min_temp ?? 40, Math.min(a.max_temp ?? 95, cur + dir * (a.target_temp_step || 1)));
      ctx.card.pending.set(s.entity_id, { attrs: { temperature: next } }, { ttl: 20000 });
      ctx.card.pending.later(s.entity_id, 700, () => ctx.card.callEntity("climate.set_temperature", s.entity_id, { temperature: next }));
    };
    t.controls = [
      set != null && s.state !== "off" ? { type: "setpoint", value: Math.round(set), step, less: "Cooler", more: "Warmer" } : null,
      { type: "pills", items: MODES.filter((m) => (a.hvac_modes || []).includes(m)).map((m) => ({ label: MODE_WORD[m], sel: s.state === m, run: () => ctx.card.callEntity("climate.set_hvac_mode", s.entity_id, { hvac_mode: m }) })) },
    ].filter(Boolean);
    return t;
  },
});

// Locks: unlocking takes two taps, so a brush past the tile can't open the door
registerTile("lock", {
  shape: () => "S",
  build(e, s, ctx) {
    const t = base(e, s, ctx);
    // "Front door" alone reads like the door sensor beside it
    if (!e.name && !/lock/i.test(t.label)) t.label = `${t.label} lock`;
    if (offline(s)) return t;
    const locked = s.state === "locked";
    t.say = locked ? "Locked" : s.state === "jammed" ? "Jammed" : sentence(s.state);
    t.controls = [{ type: "pills", items: [locked
      ? { label: "Unlock", confirm: "unlock", armed: "Tap again to unlock", run: () => ctx.card.callEntity("lock.unlock", s.entity_id) }
      : { label: "Lock", run: () => ctx.card.callEntity("lock.lock", s.entity_id) }] }];
    return t;
  },
});

// Contacts, motion and the rest: what they mean, and since when
const SENSE = { door: ["Closed", "Open"], window: ["Closed", "Open"], garage_door: ["Closed", "Open"], motion: ["Still", "Motion"], occupancy: ["Empty", "Someone's here"], moisture: ["Dry", "Wet!"], problem: ["OK", "Check it"] };
registerTile("binary_sensor", {
  shape: () => "S",
  build(e, s, ctx) {
    const t = base(e, s, ctx);
    if (offline(s)) return t;
    t.say = (SENSE[s.attributes.device_class] || ["Off", "On"])[s.state === "on" ? 1 : 0];
    t.sub = ago(s.last_changed);
    return t;
  },
});

registerTile("vacuum", {
  shape: () => "S",
  build(e, s, ctx) {
    const t = base(e, s, ctx);
    if (offline(s)) return t;
    const cleaning = s.state === "cleaning";
    t.say = { cleaning: "Cleaning", docked: "Docked", returning: "Heading home", idle: "Idle", paused: "Paused", error: "Stuck" }[s.state] || sentence(s.state);
    t.controls = [{ type: "pills", items: [{ label: cleaning ? "Send home" : "Start", run: () => ctx.card.callEntity(cleaning ? "vacuum.return_to_base" : "vacuum.start", s.entity_id) }] }];
    return t;
  },
});

// Scenes and scripts: tap runs it, and the tile says Done for a moment
registerTile(["scene", "script"], {
  shape: () => "S",
  build(e, s, ctx) {
    const name = e.name || nameOf(ctx.hass, s, ctx.config.strip);
    const ran = ctx.card.ran === s.entity_id;
    return { ...base(e, s, ctx), label: "Scene", say: name, sub: ran ? "Done" : "Tap to set", cls: ["on", "run"],
      tap: () => { ctx.card.callEntity(`${d(s)}.turn_on`, s.entity_id); ctx.card.flash(s.entity_id); } };
  },
});

// Sensors: the reading in house words, and a chart for the ones that move through the day
const CHARTED = ["power", "temperature", "humidity"];
registerTile("sensor", {
  shape: (s, ctx) => (CHARTED.includes(s.attributes.device_class) ? (ctx.cols < 3 ? "S" : "W") : "S"),
  build(e, s, ctx) {
    const a = s.attributes, dc = a.device_class, unit = a.unit_of_measurement || "", v = parseFloat(s.state);
    const measure = ["temperature", "humidity"].includes(dc);
    const t = base(e, s, ctx, { label: e.name || (measure ? sentence(dc) : nameOf(ctx.hass, s, ctx.config.strip)) });
    t.say = quiet(s.state) ? "—" : dc === "timestamp" ? fromNow(s.state) : Number.isNaN(v) ? words(s.state)
      : dc === "duration" ? duration(v, unit) : dc === "illuminance" ? `${Math.round(v)} lx` : dc === "power" ? power(v) : dc === "temperature" ? `${Math.round(v)}°`
      : dc === "monetary" ? `$${v.toFixed(2)}` : `${Math.round(v * 10) / 10}${unit === "%" ? "%" : unit ? " " + unit : ""}`;
    const chart = e.chart ? (e.chart === "none" ? null : e.chart) : CHARTED.includes(dc) ? "spark" : null;
    if (chart === "spark") {
      const viz = { type: "spark", entity: s.entity_id, hours: e.hours || ctx.config.spark_hours, points: 48 };
      const vals = ctx.series(viz) || [];
      // Power reads in kW once it passes a kilowatt
      const kw = dc === "power" && vals.length && Math.max(...vals) >= 1000;
      t.viz = { ...viz, scale: kw ? 0.001 : 1, unit: kw ? "kW" : dc === "power" ? "W" : "", peak: dc === "power" && (e.shape === "L" || e.shape === "FL") };
      t.layout = "bleed";
    } else if (chart === "bars") {
      t.viz = { type: "dbars", entity: s.entity_id, days: e.days || 14, today: Number.isNaN(v) ? null : v };
      const rows = ctx.series(t.viz) || [];
      if (rows.length > 1) {
        const diff = (Number.isNaN(v) ? rows[rows.length - 1].v : v) - rows[0].v, u = unit ? ` ${unit}` : "";
        t.sub = Math.abs(diff) < 0.1 ? `Steady over ${rows.length} days` : `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff).toFixed(1)}${u} in ${rows.length} days`;
      }
      t.layout = "foot";
    }
    return t;
  },
});

// Settings: selects, numbers, text and times show their value
registerTile([...VALUE], {
  shape: () => "S",
  build(e, s, ctx) {
    const t = base(e, s, ctx, { say: "" });
    const v = parseFloat(s.state), unit = s.attributes.unit_of_measurement || "", dom = d(s);
    t.say = quiet(s.state) ? "—"
      : /number$/.test(dom) && !Number.isNaN(v) ? `${Math.round(v * 100) / 100}${unit === "%" ? "%" : unit ? " " + unit : ""}`
      : /^\d{1,2}:\d{2}(:\d{2})?$/.test(s.state) ? new Date(`2000-01-01T${s.state.length === 5 ? s.state + ":00" : s.state}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : dom === "text" || dom === "input_text" ? String(s.state) : words(s.state);
    return t;
  },
});

// Anything else: its state in words; tap opens the details
registerTile("*", {
  shape: () => "S",
  build: (e, s, ctx) => ({ ...base(e, s, ctx), say: quiet(s.state) ? "—" : words(s.state), tap: () => ctx.card.more(s.entity_id) }),
});
