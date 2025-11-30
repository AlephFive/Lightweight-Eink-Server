# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A lightweight Node.js server that generates PNG screenshots of web UIs at regular intervals, optimized for E-ink displays. Uses Playwright to render web pages in a headless browser and serves the resulting screenshots via HTTP.

**Core functionality:**
- Periodic screenshot generation using Playwright (Chromium)
- Express HTTP server to serve the latest screenshot
- Configured for E-ink display dimensions (800x480 by default)

## Development Commands

```bash
# Start the server (runs both Express server and Playwright renderer)
npm start

# Run Playwright tests
npx playwright test

# Run specific test file
npx playwright test tests/example.spec.ts

# Run tests in headed mode (show browser)
npx playwright test --headed

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Show test report
npx playwright show-report
```

## Architecture

### Server Architecture (`src/server.ts`)
- Express server listening on port 5000
- Single endpoint: `GET /render.png` - serves the latest screenshot from `/tmp/screen.png`
- Returns 503 if no screenshot has been generated yet
- Starts the Playwright renderer on server initialization

### Renderer Architecture (`src/renderer.ts`)
- Runs in an infinite loop, updating screenshots at configured intervals
- Launches Chromium in headless mode with sandbox disabled
- Waits for network idle before taking screenshot
- Writes PNG buffer directly to filesystem (`/tmp/screen.png`)
- Error handling continues loop even if individual renders fail

### Configuration
All configuration is hardcoded in source files (not using .env variables despite .env file existence):

**Server (`src/server.ts`):**
- `PORT`: 5000
- `OUTPUT`: `/tmp/screen.png`

**Renderer (`src/renderer.ts`):**
- `URL`: Defaults to `http://localhost:4173/` (can be overridden by `RENDER_URL` env var)
- `WIDTH`: 800px
- `HEIGHT`: 480px
- `OUTPUT`: `/tmp/screen.png`
- `INTERVAL`: 60000ms (1 minute)

**Note:** The .env file contains extensive configuration options, but they are not currently used by the code. If you need to make the application more configurable, you should update `src/renderer.ts` and `src/server.ts` to read from environment variables.

## Key Implementation Details

**Playwright Browser Args:**
- Uses `--no-sandbox` and `--disable-setuid-sandbox` flags for running in containerized environments (e.g., Raspberry Pi)
- Sets viewport size to match E-ink display dimensions before navigation

**Screenshot Timing:**
- Waits for `networkidle` state before capturing (ensures all network requests complete)
- 30-second timeout on page navigation
- Continuous retry logic - errors are logged but don't stop the renderer

**File I/O:**
- Screenshots written synchronously to filesystem using `fs/promises`
- Single shared output file is overwritten on each update
- No cleanup or rotation of old screenshots

## TypeScript Setup

Project uses CommonJS modules (`"type": "commonjs"` in package.json) with TypeScript executed via `tsx`. No tsconfig.json exists - TypeScript compilation relies on tsx defaults.

## Testing

Playwright test framework is configured but no tests currently exist in `tests/` directory. The playwright.config.ts is set up for multi-browser testing (Chromium, Firefox, WebKit) with HTML reporter.
