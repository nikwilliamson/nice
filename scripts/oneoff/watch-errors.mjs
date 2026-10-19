// Open pages, leave them running, and print every error: catches what breaks after load.
//   docker … node scripts/oneoff/watch-errors.mjs <seconds> <path> [path …]
import { chromium } from "playwright";
const URL_ = (process.env.HA_URL || "http://localhost:8123").replace(/\/$/, ""), TOKEN = process.env.HA_TOKEN;
const [secs, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(({ token, url }) => localStorage.setItem("hassTokens", JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 315360000, hassUrl: url, clientId: `${url}/`, expires: Date.now() + 315360000000, refresh_token: "" })), { token: TOKEN, url: URL_ });
await Promise.all(paths.map(async (p) => {
  const page = await ctx.newPage(), t0 = Date.now();
  page.on("console", (m) => { if (m.type() === "error" && !/Custom state pseudo classes/.test(m.text())) console.log(`${p} +${((Date.now() - t0) / 1000).toFixed(0)}s console: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => console.log(`${p} +${((Date.now() - t0) / 1000).toFixed(0)}s pageerror: ${String(e).slice(0, 300)}`));
  await page.goto(URL_ + p, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(+secs * 1000);
  const count = await page.evaluate(() => { const q = (r, s) => [...r.querySelectorAll("*")].flatMap((el) => [el, ...(el.shadowRoot ? q(el.shadowRoot) : [])]); return q(document).filter((el) => el.tagName === "NICE-TILE").length; });
  console.log(`${p}: ${count} tiles after ${secs}s`);
}));
await browser.close();
