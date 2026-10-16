// Screenshots of every Nice page, at phone and desktop sizes, in a real browser.
//
//   scripts/shots.sh [label]        → shots/<label>/<page>-<size>.png, plus console errors
//
// Logs in with HA_TOKEN from .env (the frontend accepts a long-lived token as its access
// token). Runs in the Playwright image; see scripts/shots.sh.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const URL_ = (process.env.HA_URL || "http://localhost:8123").replace(/\/$/, "");
const TOKEN = process.env.HA_TOKEN;
if (!TOKEN) { console.error("set HA_TOKEN in .env"); process.exit(2); }
const label = process.argv[2] || new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const out = `shots/${label}`;
mkdirSync(out, { recursive: true });

const TABS = ["home", "rooms", "lists", "cats", "cars", "climate", "power", "playing"];
const ROOMS = ["living_room", "kitchen", "bedroom", "game_room", "guest_room", "race_room", "bathroom", "laundry_room", "outside", "guest_bathroom", "pantry"];
const pages = [
  ...TABS.map((tab) => ({ name: `tab-${tab}`, path: "/house-nice/home", tab })),
  ...ROOMS.map((r) => ({ name: `room-${r}`, path: `/house-nice/room-${r}` })),
  { name: "library-design", path: "/nice-library/design" },
  { name: "library-viz", path: "/nice-library/viz" },
];
const SIZES = { phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { width: 1280, height: 900 } };
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const browser = await chromium.launch();
const report = [];
for (const [size, vp] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ timezoneId: process.env.TZ_ID || "America/New_York", locale: "en-US", viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  await ctx.addInitScript(({ token, url }) => {
    localStorage.setItem("hassTokens", JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 315360000, hassUrl: url, clientId: `${url}/`, expires: Date.now() + 315360000000, refresh_token: "" }));
  }, { token: TOKEN, url: URL_ });
  for (const p of pages) {
    if (only && !only.test(p.name)) continue;
    const page = await ctx.newPage();
    const errors = [];
    // Home Assistant's own frontend logs a deprecation notice about custom state pseudo-classes; not ours
    page.on("console", (m) => { if (m.type() === "error" && !/Custom state pseudo classes/.test(m.text())) errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    if (p.tab) await page.addInitScript((tab) => sessionStorage.setItem("nice-tab", tab), p.tab);
    await page.goto(URL_ + p.path, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => errors.push(`goto: ${e.message}`));
    await page.waitForTimeout(3500); // fonts, history charts, arrivals
    await page.screenshot({ path: `${out}/${p.name}-${size}.png`, fullPage: true });
    report.push({ page: p.name, size, errors });
    if (errors.length) console.log(`${p.name} ${size}: ${errors.length} error(s): ${errors[0].slice(0, 200)}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(`${report.length} shots in ${out}, ${report.filter((r) => r.errors.length).length} with errors`);
