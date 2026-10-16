#!/usr/bin/env bash
# Deploy Nice into Home Assistant.
#
#   scripts/deploy.sh            build and deploy everything
#   scripts/deploy.sh web        just the cards (www/nice/)
#   scripts/deploy.sh rules      just the templates and package (custom_templates/, packages/)
#   scripts/deploy.sh theme      just the theme
#   scripts/deploy.sh dashboards push dashboards/nice/*.json to their dashboards
#
# Files go in through `docker cp`, so they land in the container as root, the same as
# files HA writes itself. With HA_TOKEN in .env the script also checks the config,
# reloads, and points the dashboard resource at the new build. Without it, it says
# what still needs doing.
set -euo pipefail
cd "$(dirname "$0")/.."
HA=${HA_CONTAINER:-homeassistant}
WHAT=${1:-all}
token() { grep -q '^HA_TOKEN=.' .env 2>/dev/null; }
put() { docker exec "$HA" mkdir -p "/config/$2"; docker cp "$1" "$HA:/config/$2"; }

if [[ $WHAT == all || $WHAT == web || $WHAT == theme ]]; then
  scripts/node.sh scripts/build.mjs
fi

if [[ $WHAT == all || $WHAT == web ]]; then
  put build/www/nice/. www/nice/
  url="/local/nice/nice.js?v=$(cat build/VERSION)"
  if token; then scripts/node.sh scripts/ha.mjs resource "$url"; else echo "→ point the nice resource at $url"; fi
fi

if [[ $WHAT == all || $WHAT == rules ]]; then
  put ha/custom_templates/nice/. custom_templates/nice/
  for f in ha/packages/nice*.yaml; do [[ -e $f ]] && put "$f" packages/; done
  if token; then scripts/node.sh scripts/ha.mjs reload rules; else echo "→ check config, then reload custom templates, templates, automations, scripts, rest"; fi
fi

if [[ $WHAT == all || $WHAT == theme ]]; then
  [[ -e build/themes/nice.yaml ]] && put build/themes/nice.yaml themes/
  if token; then scripts/node.sh scripts/ha.mjs reload theme; else echo "→ reload themes"; fi
fi

if [[ $WHAT == dashboards ]]; then
  token || { echo "dashboards needs HA_TOKEN in .env"; exit 2; }
  for f in dashboards/nice/*.json; do scripts/node.sh scripts/ha.mjs dashboard "$(basename "$f" .json)" "$f"; done
fi
