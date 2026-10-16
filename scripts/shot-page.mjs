// Screenshot one page: docker … node scripts/shot-page.mjs <path> <out.png> [extra wait ms]
import { chromium } from "playwright";
const URL_ = "http://localhost:8123", TOKEN = process.env.HA_TOKEN, [path, out, wait = "0"] = process.argv.slice(2);
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/New_York" });
await ctx.addInitScript(({ token, url }) => localStorage.setItem("hassTokens", JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 315360000, hassUrl: url, clientId: `${url}/`, expires: Date.now() + 315360000000, refresh_token: "" })), { token: TOKEN, url: URL_ });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(URL_ + path, { waitUntil: "networkidle" }); await p.waitForTimeout(3000 + Number(wait));
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 640 } });
console.log(errs.join("\n") || "no errors", new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York" }));
await b.close();
