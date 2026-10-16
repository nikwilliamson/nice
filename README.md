# Nice

The house dashboard for Home Assistant: the rules that decide what the Home tab says, the
cards that draw it, and the theme the rest of Home Assistant wears. Formerly "bento".

```
ha/custom_templates/nice/*.jinja   the rules, one file per domain (safety, security, cats, chores,
                                   cars, weather, energy, home, away, plan, health, sports)
ha/packages/nice.yaml              turns each rules file into sensor.nice_tiles_<domain>, and works
                                   out the moment once in sensor.nice_context
src/                               the cards (Lit), bundled to one resource
src/tokens.json                    every colour, size and timing; the cards and the theme both read it
dashboards/nice/*.json             the dashboards, as saved in Home Assistant
scripts/                           build, deploy, and a small Home Assistant client
tests/                             the packer, formatting, and every card rendered in jsdom
ha/www, ha/themes, dashboards/*.json at the top level: bento as it was (tag v0-bento), until cutover
```

## How it fits together

The **rules** decide *what* to show. Each `sensor.nice_tiles_<domain>` has a `tiles` attribute: a
list of tiles, each `{ id, tier, order, shape, label, say, sub, tone, viz, act, tap }` (see the top
of `src/tile/tile.js`). A door opening re-renders the security rules, not all of them. None of these
sensors are recorded.

The **cards** decide *where* and *how*. `nice-grid` merges every `sensor.nice_tiles_*`, picks what
fits (`layout/pack.js: choose`) and packs it (`bestPack`). Every card draws its tiles with
`<nice-tile>`, which keeps its own state, so nothing redraws under a finger.

- `core/` tokens, tones, words, tap/hold and two-tap confirm, optimistic state, motion, and
  `NiceCard`, which redraws only when an entity it watches changes
- `charts/` one `{ render(viz, ctx), styles, data? }` per chart; each carries its own CSS
- `controls/` pills, slider, setpoint, picker
- `adapters/` what an entity's tile shows and does, one module per kind of device
- `layout/pack.js` the one packer every card uses
- `data/` history and statistics (one cache), rooms and names, LED palettes
- `illus/` the car, the litter robot and the feeder, drawn
- `cards/` the cards

## Working on it

```sh
scripts/node.sh --test tests/*.test.mjs   # tests (node runs in Docker; the Pi has none)
scripts/deploy.sh                         # build and deploy everything
scripts/deploy.sh web | rules | theme | dashboards
```

Files go into the `homeassistant` container with `docker cp`. Put a long-lived access token in
`.env` as `HA_TOKEN=…` and the deploy also checks the config, reloads, points the dashboard
resource at the new build, and can push `dashboards/nice/*.json`. Without it, it says what's left.

Every Nice card has a visual editor (Edit dashboard → the card). Room pages and nice-controls:
sections and entries, dragged to reorder, each expanding to its options (size, chart, name; the
Adaptive Lighting, power bars, Vestaboard and LED strip settings). nice-tabs: tabs, and each tab's
cards through Home Assistant's own card editors. The rest are forms (src/editors/specs.js). Room pages
are curated: nothing appears on its own; "Suggest from this room" lists what's in the area and not
on the page, and you tick what you want.

Phone pushes come from the same rules as the tiles: a tier-0 tile pushes, and any other tile pushes
if its rule gives it `push=dict(…)` (level, repeat, hours, key, clear; see
`custom_templates/nice/attention.jinja`). `input_boolean.nice_push_enabled` mutes them all. The
house alert automations still raise and clear House alerts; they no longer push.

`scripts/shots.sh` screenshots every page in a real browser; `scripts/shot-editor.mjs` opens a
card's editor.

To add a rule: put it in the domain's `.jinja` file and redeploy `rules`. To add a kind of device to
nice-controls: `registerTile(domain, { shape, build })` in `src/adapters/`. To add a chart: one
object in `src/charts/`, registered in `charts/index.js`.

## Cutover from bento

Still to do, once house-nice has been looked over:

1. ~~Make house-nice the default dashboard~~ (done 2026-10-16; titled House). ~~Remove hearth~~ (done: dashboards, resources, files, theme).
2. `Theme - Follow the sun`: Bento Day/Night → Nice Day/Night.
3. `Sports - Ask on phone`: import `at_clock` and `day_word` from `nice/format.jinja`.
4. Move the shared sensors and automations in `packages/bento.yaml` (house chores, next event, rain
   outlook, last door opened, away since, dishwasher, launch) into `packages/nice_house.yaml`, same
   unique_ids; drop `sensor.bento_tiles`.
5. Remove the bento resources and files, `custom_templates/bento*.jinja`, the bento
   themes, and the house-bento and bento-library dashboards.
