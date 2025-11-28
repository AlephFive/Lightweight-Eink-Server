import { chromium } from "playwright";
import fs from "fs/promises";

const URL = process.env.RENDER_URL || "http://localhost:4173/";
const WIDTH = 800;
const HEIGHT = 480;
const OUTPUT = "/tmp/screen.png";
const INTERVAL = 60000;

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function startRenderer() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });

  while (true) {
    try {
      await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
      const buf = await page.screenshot();
      await fs.writeFile(OUTPUT, buf);
      console.log(`[renderer] Updated PNG at ${OUTPUT}`);
    } catch (err) {
      console.error("[renderer] Error:", err);
    }

    await sleep(INTERVAL);
  }
}
