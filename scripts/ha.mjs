// A small Home Assistant WebSocket client for the deploy script.
//
//   node scripts/ha.mjs reload [rules|theme|all]   check config, then reload what changed
//   node scripts/ha.mjs resource <url>              point the nice resource at <url> (adds it if missing)
//   node scripts/ha.mjs dashboard <url_path> <file> save a dashboard config from a JSON file
//   node scripts/ha.mjs pull <url_path> <file>      write a dashboard's live config to a JSON file
//
// Needs HA_TOKEN (a long-lived access token) in .env; HA_URL defaults to http://localhost:8123.
import { readFileSync, writeFileSync } from "node:fs";

const URL_ = (process.env.HA_URL || "http://localhost:8123").replace(/\/$/, "");
const TOKEN = process.env.HA_TOKEN;
if (!TOKEN) { console.error("ha.mjs: set HA_TOKEN in .env (Profile → Security → Long-lived access tokens)"); process.exit(2); }

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL_.replace(/^http/, "ws") + "/api/websocket");
    let id = 0;
    const waiting = new Map();
    const call = (msg) => new Promise((ok, fail) => { const n = ++id; waiting.set(n, { ok, fail }); ws.send(JSON.stringify({ id: n, ...msg })); });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: TOKEN }));
      else if (m.type === "auth_ok") resolve({ call, close: () => ws.close() });
      else if (m.type === "auth_invalid") reject(new Error("HA rejected the token"));
      else if (m.type === "result" && waiting.has(m.id)) {
        const w = waiting.get(m.id); waiting.delete(m.id);
        m.success ? w.ok(m.result) : w.fail(new Error(`${m.error?.code}: ${m.error?.message}`));
      }
    };
    ws.onerror = () => reject(new Error(`can't reach ${URL_}`));
  });
}

const service = (ha, domain, svc, data = {}) => ha.call({ type: "call_service", domain, service: svc, service_data: data });

async function checkConfig() {
  const r = await fetch(`${URL_}/api/config/core/check_config`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  if (j.result !== "valid") throw new Error(`check_config: ${j.errors || j.result}`);
}

const [cmd, a, b] = process.argv.slice(2);
const ha = await connect();
try {
  if (cmd === "reload") {
    const what = a || "all";
    if (what === "rules" || what === "all") {
      await checkConfig();
      await service(ha, "homeassistant", "reload_custom_templates");
      for (const d of ["template", "automation", "script", "scene", "rest"]) await service(ha, d, "reload");
      console.log("reloaded templates, automations, scripts, scenes and rest");
    }
    if (what === "theme" || what === "all") { await service(ha, "frontend", "reload_themes"); console.log("reloaded themes"); }
  } else if (cmd === "resource") {
    const list = await ha.call({ type: "lovelace/resources" });
    const mine = list.find((r) => /\/local\/nice\/nice\.js/.test(r.url));
    if (mine) await ha.call({ type: "lovelace/resources/update", resource_id: mine.id, res_type: "module", url: a });
    else await ha.call({ type: "lovelace/resources/create", res_type: "module", url: a });
    console.log(`resource → ${a}`);
  } else if (cmd === "dashboard") {
    await ha.call({ type: "lovelace/config/save", url_path: a, config: JSON.parse(readFileSync(b, "utf8")) });
    console.log(`saved ${a} from ${b}`);
  } else if (cmd === "pull") {
    writeFileSync(b, JSON.stringify(await ha.call({ type: "lovelace/config", url_path: a }), null, 1) + "\n");
    console.log(`wrote ${b}`);
  } else {
    console.error("usage: ha.mjs reload|resource|dashboard|pull …"); process.exitCode = 2;
  }
} finally { ha.close(); }
