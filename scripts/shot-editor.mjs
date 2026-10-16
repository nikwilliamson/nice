// Screenshot a card's visual editor: open a view in edit mode and open the first card's editor.
//   docker … node scripts/shot-editor.mjs <path> <out.png> [suggest]
import { chromium } from "playwright";
const [path, out, suggest, index = "0"] = process.argv.slice(2);
const URL_ = "http://localhost:8123", TOKEN = process.env.HA_TOKEN;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, timezoneId: "America/New_York" });
await ctx.addInitScript(({ token, url }) => localStorage.setItem("hassTokens", JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 315360000, hassUrl: url, clientId: `${url}/`, expires: Date.now() + 315360000000, refresh_token: "" })), { token: TOKEN, url: URL_ });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Custom state pseudo/.test(m.text())) errors.push(m.text()); });
await page.goto(`${URL_}${path}?edit=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.locator("hui-card-edit-mode").nth(Number(index)).click();
await page.waitForTimeout(3000);
if (suggest === "suggest") { await page.getByText("Suggest from this room").click(); await page.waitForTimeout(800); }
await page.screenshot({ path: out });
console.log(errors.length ? errors.join("\n") : "no errors");
await browser.close();
