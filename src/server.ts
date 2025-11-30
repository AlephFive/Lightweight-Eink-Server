import express from "express";
import fs from "fs";
import path from "path";
import { startRenderer, renderApp } from "./renderer";

const app = express();
const PORT = 5000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SCREENSHOTS_DIR = path.join(__dirname, "..", "screenshots");
const FALLBACK = path.join(__dirname, "..", "static", "muse.bmp");

// Global request logger
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Discover all apps in public/ directory
function discoverApps(): string[] {
  if (!fs.existsSync(PUBLIC_DIR)) {
    return [];
  }

  return fs.readdirSync(PUBLIC_DIR)
    .filter(name => {
      const appPath = path.join(PUBLIC_DIR, name);
      return fs.statSync(appPath).isDirectory();
    });
}

// Setup routes for all discovered apps
const apps = discoverApps();

console.log(`Discovered apps: ${apps.join(", ") || "none"}`);

apps.forEach(appName => {
  // Create screenshot endpoint for the app BEFORE static middleware
  // This ensures the .png route takes precedence
  console.log(`Registering route: GET /${appName}.png`);
  app.get(`/${appName}.png`, async (req, res) => {
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${appName}.png`);

    // Log device information
    const deviceId = req.query.device_id || req.headers['x-device-id'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    console.log(`[${appName}.png] Device ID: ${deviceId}, IP: ${ipAddress}, User-Agent: ${userAgent}`);

    // Trigger on-demand render (with rate limiting)
    await renderApp(appName);

    // Check if screenshot exists after render attempt
    if (!fs.existsSync(screenshotPath)) {
      // Serve fallback image
      console.log(`[${appName}.png] Serving fallback: ${FALLBACK}`);
      const fallbackStats = fs.statSync(FALLBACK);
      res.set("Content-Type", "image/bmp");
      res.set("Content-Length", fallbackStats.size.toString());
      fs.createReadStream(FALLBACK).pipe(res);
      return;
    }

    console.log(`[${appName}.png] Serving screenshot`);
    const stats = fs.statSync(screenshotPath);
    res.set("Content-Type", "image/png");
    res.set("Content-Length", stats.size.toString());
    fs.createReadStream(screenshotPath).pipe(res);
  });

  // Serve static files for the app
  const appPath = path.join(PUBLIC_DIR, appName);
  app.use(`/${appName}`, express.static(appPath));
});

// Legacy endpoint for backwards compatibility
app.get("/render.png", (req, res) => {
  // Log device information
  const deviceId = req.query.device_id || req.headers['x-device-id'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  console.log(`[render.png] Device ID: ${deviceId}, IP: ${ipAddress}, User-Agent: ${userAgent}`);

  const OUTPUT = path.join(SCREENSHOTS_DIR, "screen.png");
  if (!fs.existsSync(OUTPUT)) {
    const fallbackStats = fs.statSync(FALLBACK);
    res.set("Content-Type", "image/bmp");
    res.set("Content-Length", fallbackStats.size.toString());
    fs.createReadStream(FALLBACK).pipe(res);
    return;
  }
  const stats = fs.statSync(OUTPUT);
  res.set("Content-Type", "image/png");
  res.set("Content-Length", stats.size.toString());
  fs.createReadStream(OUTPUT).pipe(res);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PNG server listening on all network interfaces`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://<your-ip>:${PORT}`);
  console.log(`\nAvailable apps:`);
  apps.forEach(appName => {
    console.log(`  - http://localhost:${PORT}/${appName}/ (app)`);
    console.log(`    http://localhost:${PORT}/${appName}.png (screenshot)`);
  });
});

// Start Playwright renderer with discovered apps
startRenderer(apps, PORT);
