// Build Nice.
//   build/www/nice/nice.js   the cards, one bundle (Lit included), with a source map
//   build/themes/nice.yaml   Nice, Nice Day and Nice Night, from src/tokens.json
//   build/VERSION            the build's stamp, used as the resource's ?v=
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

mkdirSync("build/www/nice", { recursive: true });
mkdirSync("build/themes", { recursive: true });

const result = await build({
  entryPoints: ["src/nice.js"], bundle: true, format: "esm", target: "es2022", minify: true, sourcemap: true,
  outfile: "build/www/nice/nice.js", legalComments: "none", write: false,
  define: { __NICE_VERSION__: '"__STAMP__"' },
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const version = createHash("sha256").update(js).digest("hex").slice(0, 10);
for (const f of result.outputFiles) writeFileSync(f.path, f.path.endsWith(".js") ? js.replace("__STAMP__", version) : f.text);
writeFileSync("build/VERSION", version);

// ── The theme: what the rest of Home Assistant wears, from the same tokens as the cards
const T = JSON.parse(readFileSync("src/tokens.json", "utf8"));
const th = T.theme, r = T.radius;
const scale = (name, list) => list.map((c, i) => `  ha-color-${name}-${["05", "10", "20", "30", "40", "50", "60", "70", "80", "90", "95"][i]}: "${c}"`).join("\n");
const shared = `  # Type
  ha-font-family-body: "Figtree, system-ui, -apple-system, Roboto, sans-serif"
  ha-font-family-heading: "'Bricolage Grotesque', Figtree, system-ui, sans-serif"
  ha-font-family-longform: "Figtree, system-ui, -apple-system, sans-serif"
  primary-font-family: "Figtree, system-ui, -apple-system, Roboto, sans-serif"
  paper-font-common-base_-_font-family: "Figtree, system-ui, -apple-system, Roboto, sans-serif"
  # Shape: the tiles' ${r.tile}px corner on every card
  ha-border-radius-sm: "${r.xs + 2}px"
  ha-border-radius-md: "${r.md}px"
  ha-border-radius-lg: "${r.lg ?? 16}px"
  ha-border-radius-xl: "18px"
  ha-border-radius-2xl: "${r.tile}px"
  ha-border-radius-3xl: "${r.tile + 4}px"
  ha-border-radius-4xl: "${r.tile + 8}px"
  ha-border-radius-5xl: "${r.tile + 12}px"
  ha-border-radius-6xl: "${r.tile + 16}px"
  wa-border-radius-s: "${r.sm}px"
  wa-border-radius-m: "14px"
  wa-border-radius-l: "${r.tile}px"
  wa-panel-border-radius: "${r.tile}px"
  wa-form-control-border-radius: "14px"
  ha-card-border-radius: "${r.tile}px"
  ha-card-border-width: "0px"
  ha-dialog-border-radius: "${r.tile + 4}px"
  ha-tile-border-radius: "18px"
  ha-badge-border-radius: "999px"
  ha-dialog-scrim-backdrop-filter: "blur(6px)"
  # Primary: coral. Neutral: slate, the tiles' "off" grey
${scale("primary", th.primary)}
${scale("neutral", th.neutral)}
  # Status
  success-color: "${T.status.ok[0]}"
  warning-color: "${T.status.warn[1]}"
  error-color: "${T.status.alert[0]}"
  info-color: "${T.status.busy[0]}"
  label-badge-red: "${T.status.alert[0]}"
  label-badge-blue: "${T.status.busy[0]}"
  label-badge-green: "${T.status.ok[0]}"
  label-badge-yellow: "${T.tones.today[4]}"
  # Device states: the tiles' hue for each kind of thing
  state-active-color: "${th.primary[5]}"
  state-light-active-color: "${T.tones.today[4]}"
  state-switch-active-color: "${th.primary[5]}"
  state-input_boolean-active-color: "${th.primary[5]}"
  state-fan-active-color: "${T.tones.scenes[4]}"
  state-media_player-active-color: "${T.tones.media[0]}"
  state-cover-active-color: "${T.status.busy[0]}"
  state-valve-active-color: "${T.status.busy[0]}"
  state-vacuum-active-color: "${T.tones.scenes[4]}"
  state-lawn_mower-active-color: "${T.tones.money[4]}"
  state-siren-active-color: "${T.status.alert[0]}"
  state-update-active-color: "${th.primary[5]}"
  state-plant-active-color: "${T.tones.money[4]}"
  state-humidifier-on-color: "${T.status.busy[0]}"
  state-binary_sensor-active-color: "${T.status.warn[1]}"
  state-device_tracker-home-color: "${T.status.ok[0]}"
  state-person-home-color: "${T.status.ok[0]}"
  state-climate-cool-color: "${T.status.busy[0]}"
  state-climate-heat-color: "${T.status.warn[1]}"
  state-climate-auto-color: "${T.tones.plan[0]}"
  state-climate-heat-cool-color: "${T.tones.plan[0]}"
  state-climate-dry-color: "${T.tones.money[4]}"
  state-climate-fan_only-color: "${T.tones.scenes[4]}"
  state-lock-locked-color: "${T.status.ok[0]}"
  state-lock-unlocked-color: "${T.status.alert[0]}"
  state-lock-open-color: "${T.status.alert[0]}"
  state-lock-jammed-color: "${T.status.alert[0]}"
  state-lock-locking-color: "${T.tones.today[4]}"
  state-lock-unlocking-color: "${T.tones.today[4]}"
  state-sensor-battery-high-color: "${T.status.ok[0]}"
  state-sensor-battery-medium-color: "${T.tones.today[4]}"
  state-sensor-battery-low-color: "${T.status.alert[0]}"
  state-sun-above_horizon-color: "${T.tones.today[4]}"
  state-sun-below_horizon-color: "${T.tones.plan[2]}"
  state-alarm_control_panel-armed_home-color: "${T.status.ok[0]}"
  state-alarm_control_panel-armed_away-color: "${T.status.ok[0]}"
  state-alarm_control_panel-armed_night-color: "${T.tones.plan[2]}"
  state-alarm_control_panel-triggered-color: "${T.status.alert[0]}"
  # Energy dashboard
  energy-grid-consumption-color: "${T.status.busy[0]}"
  energy-grid-return-color: "${T.tones.plan[0]}"
  energy-solar-color: "${T.tones.today[4]}"
  energy-non-fossil-color: "${T.tones.money[4]}"
  energy-battery-out-color: "${T.status.ok[0]}"
  energy-battery-in-color: "${T.tones.scenes[4]}"
  energy-gas-color: "${T.status.warn[1]}"
  energy-water-color: "${T.status.busy[0]}"`;
const mode = (m) => {
  const day = m === "light", k = day ? "day" : "night", text = th.text[k], p = th.primary;
  return `      primary-color: "${p[5]}"
      dark-primary-color: "${p[4]}"
      light-primary-color: "${day ? p[8] : p[7]}"
      accent-color: "${th.accent[k]}"
      text-primary-color: "#ffffff"
      lovelace-background: "${th.page[k]}"
      primary-background-color: "${th.page[k]}"
      secondary-background-color: "${day ? T.off.day[0] : th.neutral[2]}"
      card-background-color: "${th.card[k]}"
      ha-card-background: "${th.card[k]}"
      ha-card-box-shadow: "none"
      primary-text-color: "${text[0]}"
      secondary-text-color: "${text[1]}"
      disabled-text-color: "${text[2]}"
      divider-color: "${day ? "rgba(28, 34, 51, 0.08)" : "rgba(238, 240, 246, 0.08)"}"
      outline-color: "${day ? "rgba(28, 34, 51, 0.14)" : "rgba(238, 240, 246, 0.14)"}"
      ha-color-surface-default: "${th.card[k]}"
      ha-color-surface-low: "${th.page[k]}"
      ha-color-surface-lower: "${day ? T.off.day[0] : th.neutral[0]}"
      ha-color-form-background: "${day ? th.neutral[10] : "#1e2331"}"
      ha-color-form-background-hover: "${day ? "#e8eaf0" : "#262c3c"}"
      state-icon-color: "${day ? th.neutral[5] : th.neutral[8]}"
      state-inactive-color: "${day ? text[2] : th.neutral[5]}"
      app-header-background-color: "${th.page[k]}"
      app-header-text-color: "${text[0]}"
      app-header-border-bottom: "none"
      app-header-selection-bar-color: "${p[5]}"
      sidebar-background-color: "${day ? "#eef0f4" : th.neutral[0]}"
      sidebar-text-color: "${day ? th.neutral[4] : th.neutral[8]}"
      sidebar-icon-color: "${th.neutral[6]}"
      sidebar-selected-text-color: "${day ? p[4] : p[6]}"
      sidebar-selected-icon-color: "${p[5]}"
      sidebar-menu-button-text-color: "${text[0]}"
      input-fill-color: "${day ? th.neutral[10] : "#1e2331"}"
      mdc-text-field-fill-color: "${day ? th.neutral[10] : "#1e2331"}"
      input-idle-line-color: "${day ? "rgba(28, 34, 51, 0.2)" : "rgba(238, 240, 246, 0.2)"}"
      chip-background-color: "${day ? T.off.day[0] : th.neutral[3]}"
      table-header-background-color: "${day ? th.neutral[10] : "#1e2331"}"
      table-row-background-color: "${th.card[k]}"
      table-row-alternative-background-color: "${day ? "#f9fafc" : "#1a1f2a"}"
      data-table-background-color: "${th.card[k]}"
      markdown-code-background-color: "${day ? T.off.day[0] : th.neutral[3]}"
      scrollbar-thumb-color: "${day ? "rgba(28, 34, 51, 0.2)" : "rgba(238, 240, 246, 0.18)"}"
      slider-color: "${p[5]}"
      slider-track-color: "${day ? "rgba(255, 107, 74, 0.25)" : "rgba(255, 107, 74, 0.3)"}"
      switch-checked-color: "${p[5]}"
      switch-checked-button-color: "${p[5]}"
      switch-checked-track-color: "${day ? p[8] : p[3]}"
      switch-unchecked-button-color: "${day ? "#ffffff" : th.neutral[7]}"
      switch-unchecked-track-color: "${day ? th.neutral[8] : th.neutral[4]}"
      ha-color-text-link: "${day ? p[4] : p[6]}"`;
};
writeFileSync("build/themes/nice.yaml", `# Generated by scripts/build.mjs from src/tokens.json. Edit the tokens, not this file.
#
# Nice follows the device's light/dark setting. Nice Day and Nice Night are pinned to one
# mode each; "Theme - Follow the sun" switches every device between them at sunrise and
# sunset, the way the cards do.
Nice:
${shared}
  modes:
    light:
${mode("light")}
    dark:
${mode("dark")}

Nice Day:
${shared}
  modes:
    light:
${mode("light")}

Nice Night:
${shared}
  modes:
    dark:
${mode("dark")}
`);
console.log(`built nice ${version} (${(js.length / 1024).toFixed(0)} KB)`);
