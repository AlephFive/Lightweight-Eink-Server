import { chromium, Browser, Page } from "playwright";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const WIDTH = 800;
const HEIGHT = 480;
const INTERVAL = 60000;
const SCREENSHOTS_DIR = path.join(__dirname, "..", "screenshots");

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

interface AppRenderer {
  name: string;
  page: Page;
  url: string;
  outputPath: string;
  lastRenderTime: number;
  isRendering: boolean;
}

let renderers: AppRenderer[] = [];
let browser: Browser | null = null;

export async function startRenderer(apps: string[], port: number) {
  if (apps.length === 0) {
    console.log("[renderer] No apps to render");
    return;
  }

  // Ensure screenshots directory exists
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Create a page for each app
  for (const appName of apps) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });

    renderers.push({
      name: appName,
      page,
      url: `http://localhost:${port}/${appName}/`,
      outputPath: path.join(SCREENSHOTS_DIR, `${appName}.png`),
      lastRenderTime: 0, // Never rendered yet
      isRendering: false,
    });
  }

  console.log(`[renderer] Initialized on-demand renderers for: ${apps.join(", ")}`);
  console.log(`[renderer] Screenshots will be generated on request (max once per minute)`);
}

export async function renderApp(appName: string): Promise<boolean> {
  const renderer = renderers.find(r => r.name === appName);

  if (!renderer) {
    console.error(`[renderer] App "${appName}" not found`);
    return false;
  }

  const now = Date.now();
  const timeSinceLastRender = now - renderer.lastRenderTime;

  // Check if we need to render (more than 1 minute since last render)
  if (timeSinceLastRender < INTERVAL) {
    const remainingTime = Math.ceil((INTERVAL - timeSinceLastRender) / 1000);
    console.log(`[renderer] ${appName}: Using cached screenshot (${remainingTime}s until next render allowed)`);
    return true; // Serve cached version
  }

  // Check if already rendering
  if (renderer.isRendering) {
    console.log(`[renderer] ${appName}: Render already in progress, waiting...`);
    // Wait for ongoing render to complete (with timeout)
    const maxWait = 35000; // 35 seconds
    const startWait = Date.now();
    while (renderer.isRendering && (Date.now() - startWait) < maxWait) {
      await sleep(500);
    }
    return !renderer.isRendering; // Return true if render completed
  }

  // Start rendering
  renderer.isRendering = true;
  console.log(`[renderer] ${appName}: Starting render...`);

  try {
    await renderer.page.goto(renderer.url, {
      waitUntil: "networkidle",
      timeout: 30000
    });
    const buf = await renderer.page.screenshot();

    // Save temporary screenshot
    const tempPath = renderer.outputPath.replace('.png', '-temp.png');
    await fs.writeFile(tempPath, buf);

    // Convert to 1-bit grayscale using ImageMagick (matches e-ink display requirements)
    await execAsync(
      `magick "${tempPath}" -monochrome -colors 2 -depth 1 -strip png:"${renderer.outputPath}"`
    );

    // Clean up temp file
    await fs.unlink(tempPath);

    renderer.lastRenderTime = Date.now();
    console.log(`[renderer] ${appName}: Render complete`);
    return true;
  } catch (err) {
    console.error(`[renderer] Error rendering ${appName}:`, err);
    return false;
  } finally {
    renderer.isRendering = false;
  }
}
