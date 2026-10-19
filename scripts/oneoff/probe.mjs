// Open a page and print what each nice-tile was handed: id, viz type, and whether it drew a chart.
//   docker … node scripts/oneoff/probe.mjs <path>
import { chromium } from "playwright";
const URL_ = (process.env.HA_URL || "http://localhost:8123").replace(/\/$/, ""), TOKEN = process.env.HA_TOKEN;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(({ token, url }) => localStorage.setItem("hassTokens", JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 315360000, hassUrl: url, clientId: `${url}/`, expires: Date.now() + 315360000000, refresh_token: "" })), { token: TOKEN, url: URL_ });
const page = await ctx.newPage();
await page.goto(URL_ + process.argv[2], { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (r) => [...r.querySelectorAll("*")].flatMap((el) => [el, ...(el.shadowRoot ? q(el.shadowRoot) : [])]);
  return q(document).filter((el) => el.tagName === "NICE-TILE").map((el) => [el.tile?.id, el.tile?.viz?.type ?? null, !!el.shadowRoot?.querySelector(".vz, .bleed, .picture")]);
}), null, 0));
await browser.close();
