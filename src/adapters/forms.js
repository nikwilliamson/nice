// Adapters for config entries that aren't one entity: power bars, Adaptive Lighting, the
// Vestaboard, and LED strips.
import { html, nothing } from "lit";
import { registerForm } from "./registry.js";
import { tone, offTone, kelvinRgb, rgbCss, kelvinWord, tint } from "../core/tones.js";
import { power } from "../core/format.js";
import { nameOf } from "../data/entities.js";
import { stripLook, ledAt, ledGradient } from "../data/led.js";

// Ranked bars: what is drawing power right now, biggest first. Rows under a sliver of the
// leader count as quiet, so the list stays a list of answers.
//   { name: Right now, bars: [entity | { entity, name }], top: 8, tone: energy }
registerForm("bars", {
  shape: () => "F",
  watch: (e) => e.bars.map((b) => b.entity || b),
  build(e, _s, ctx, i) {
    const h = ctx.hass;
    const rows = e.bars.map((b) => (typeof b === "string" ? { entity: b } : b)).map((b) => {
      const s = h.states[b.entity];
      return s ? { id: b.entity, name: b.name || nameOf(h, s, ctx.config.strip), v: parseFloat(s.state) || 0 } : null;
    }).filter(Boolean).sort((x, y) => y.v - x.v);
    const max = Math.max(1, ...rows.map((r) => r.v)), top = e.top || 8, all = ctx.card.barsAll;
    const big = rows.filter((r) => r.v >= max * 0.04), total = rows.reduce((n, r) => n + r.v, 0);
    const shown = all ? rows : rows.slice(0, top);
    return {
      id: `bars-${i}`, label: e.name || "Right now", colors: tone(e.tone || "energy", ctx.night), cls: ["on", "bars-tile"],
      say: big.length ? `${big[0].name} is the big one` : "All quiet", sub: `${power(total)} across these circuits`, layout: "foot",
      controls: [{ type: "custom", render: () => html`<div class="bars">${shown.map((r) => html`<div class="bar" data-own @click=${() => ctx.card.more(r.id)}>
          <span class="bn">${r.name}</span><span class="bt"><i style="width:${Math.max(2, (r.v / max) * 100)}%"></i></span><b>${r.v < 5 ? "—" : power(r.v)}</b></div>`)}
        ${rows.length > top ? html`<button class="pill more-bars" @click=${(ev) => { ev.stopPropagation(); ctx.card.barsAll = !all; ctx.card.requestUpdate(); }}>${all ? "Show fewer" : `Show all ${rows.length}`}</button>` : nothing}</div>` }],
    };
  },
});

// Adaptive Lighting: the tile is tinted the colour the lights are set to now, with the
// day's warm-to-cool range under it and the dot where it sits
//   { adaptive: switch.adaptive_lighting_x, name, lights: [...], min, max }
registerForm("adaptive", {
  shape: () => "W",
  watch: (e) => [e.adaptive, `${e.adaptive}_sleep_mode`, `${e.adaptive}_adapt_brightness`, `${e.adaptive}_adapt_color`],
  build(e, _s, ctx) {
    const h = ctx.hass, sw = h.states[e.adaptive], sleep = h.states[`${e.adaptive}_sleep_mode`]?.state === "on";
    if (!sw) return null;
    const on = sw.state === "on", a = sw.attributes, n = ctx.night;
    const k = a.color_temp_kelvin || e.min || 2700, pct = a.brightness_pct;
    const rgb = sleep && a.rgb_color ? a.rgb_color : kelvinRgb(k);
    const colors = !on ? offTone(n) : { bg: n ? tint("#141a2c", rgb, 0.32) : tint("#ffffff", rgb, 0.22), ink: n ? "#fff8f0" : "#1c2233", accent: rgbCss(rgb) };
    const manual = ctx.manualOf(e);
    const adaptsBri = h.states[`${e.adaptive}_adapt_brightness`]?.state !== "off";
    const level = adaptsBri && pct ? ` · ${Math.round(pct)}%` : "";
    const call = (svc, id, data) => ctx.card.callEntity(svc, id, data);
    const resume = () => h.callService("adaptive_lighting", "set_manual_control", { entity_id: e.adaptive, lights: manual, manual_control: false })
      // Hand the lights back, then adapt them now rather than at the next interval. apply adapts
      // both unless told otherwise, whatever the zone's own switches say.
      .then(() => h.callService("adaptive_lighting", "apply", { entity_id: e.adaptive, lights: manual, transition: 2, adapt_brightness: adaptsBri, adapt_color: h.states[`${e.adaptive}_adapt_color`]?.state !== "off" }));
    return {
      id: e.adaptive, label: e.name || "Adaptive lighting", colors, cls: [on ? "on" : "off"],
      say: !on ? "Paused" : sleep ? "Sleep mode" : `${kelvinWord(k)} · ${k.toLocaleString()}K`,
      sub: !on ? "Lights stay as you set them" : manual.length ? `${manual.length} light${manual.length === 1 ? "" : "s"} set by hand` : sleep ? `Dim and warm${level}` : `Following the sun${level}`,
      viz: on ? { type: "kelvin", value: k, min: e.min, max: e.max } : null, layout: "foot", hold: () => ctx.card.more(e.adaptive),
      controls: [{ type: "pills", items: [
        on && manual.length ? { label: `Resume ${manual.length}`, sel: true, run: resume } : null,
        { label: "Sleep", sel: sleep, run: () => call("switch.toggle", `${e.adaptive}_sleep_mode`) },
        { label: on ? "Pause" : "Resume", run: () => call("switch.toggle", e.adaptive) },
      ] }],
    };
  },
});

// The Vestaboard, from Vestassistant's read-back of the wall: { board: sensor.x, name }
registerForm("board", {
  shape: () => "W",
  watch: (e) => [e.board],
  build(e, _s, ctx) {
    const lines = ctx.hass.states[e.board]?.attributes?.board;
    if (!Array.isArray(lines)) return null;
    return { id: e.board, label: e.name || "Vestaboard", colors: tone("night", ctx.night), cls: ["on"], viz: { type: "board", lines }, layout: "foot", hold: () => ctx.card.more(e.board) };
  },
});

// An LED light whose whole tile is its effect: the palette it's really showing, moving the way
// the effect moves, at the light's speed. Pickers choose the effect and palette.
//   { strip: light.x, palette: select.x, speed: number.x, intensity: number.x, reverse: switch.x, freeze: switch.x }
registerForm("strip", {
  shape: (s, ctx) => (s?.state !== "on" ? "W" : ctx.cols < 4 ? "FL" : "L"),
  watch: (e) => [e.strip, e.palette, e.speed, e.intensity, e.reverse, e.freeze].filter(Boolean),
  build(e, s, ctx, _i, shape) {
    const h = ctx.hass, a = s.attributes, on = s.state === "on";
    const palS = e.palette && h.states[e.palette];
    const fx = a.effect, pal = palS ? palS.state : null;
    const num = (id, dflt) => { const v = id ? parseFloat(h.states[id]?.state) : NaN; return Number.isFinite(v) ? v : dflt; };
    const speed = num(e.speed, palS ? 128 : 70), frozen = e.freeze && h.states[e.freeze]?.state === "on";
    const c1 = a.rgb_color || (a.color_temp_kelvin ? kelvinRgb(a.color_temp_kelvin) : [255, 190, 120]);
    const look = stripLook({ wled: !!palS, fx, pal, c1 });
    const pct = on ? Math.round(((a.brightness ?? 255) / 255) * 100) : 0;
    const fxWord = (v) => (!v || /^(off|none)$/i.test(v) ? (palS ? "Solid" : "No effect") : v.charAt(0).toUpperCase() + v.slice(1));
    const dur = (0.9 + (1 - speed / 255) * 9).toFixed(2);
    let backdrop = nothing;
    if (on) {
      const n = shape === "F" || shape === "FL" ? 26 : 16;
      const sparks = look.motion === "twinkle" ? Array.from({ length: n }, (_, i) => {
        const col = rgbCss(ledAt(look.stops, i / n)), tt = (Number(dur) * (0.5 + ((i * 13) % 7) / 8)).toFixed(2), dl = (-((i * 37) % 23) / 23 * Number(dur) * 1.5).toFixed(2);
        return html`<b style="left:${(i * 61 + 7) % 100}%;top:${(i * 37 + 17) % 100}%;--c:${col};--t:${tt}s;--dl:${dl}s"></b>`;
      }) : nothing;
      backdrop = html`<div class="fx ${look.motion}" style="--dur:${dur}s;--dir:${e.reverse && h.states[e.reverse]?.state === "on" ? "reverse" : "normal"};--play:${frozen ? "paused" : "running"};--dim:${((1 - pct / 100) * 0.55).toFixed(2)}"><span class="rot"><i style="background:${ledGradient(look.stops)}"></i></span>${sparks}</div>`;
    }
    const effects = a.effect_list || [];
    const pick = (what) => (v) => (what === "palette"
      ? ctx.card.callEntity("select.select_option", e.palette, { option: v })
      : ctx.card.callEntity("light.turn_on", e.strip, { effect: v }));
    return {
      id: e.strip, label: e.name || nameOf(h, s, ctx.config.strip), colors: on ? { bg: "#141824", ink: "#ffffff", accent: "#ffffff" } : offTone(ctx.night),
      cls: ["strip-tile", on ? "on" : "off", "dark"], backdrop, layout: "foot",
      say: on ? fxWord(fx) : s.state === "unavailable" ? "Offline" : "Off", sub: on ? `${look.usesPal ? `${pal} · ` : ""}${pct}%` : "",
      tap: () => ctx.card.callEntity("homeassistant.toggle", e.strip), hold: () => ctx.card.more(e.strip),
      controls: on ? [
        { type: "row", items: [
          effects.length ? { type: "select", label: "Effect", value: fx ?? (effects.includes("off") ? "off" : effects[0]), options: effects, word: fxWord, pick: pick("effect") } : null,
          palS && look.usesPal ? { type: "select", label: "Palette", value: pal, options: palS.attributes.options || [], pick: pick("palette") } : null,
        ].filter(Boolean) },
        { type: "slider", value: pct, min: 1, set: (v) => ctx.card.callEntity("light.turn_on", e.strip, { brightness_pct: v }) },
      ] : [],
    };
  },
});
