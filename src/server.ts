import express from "express";
import fs from "fs";
import { startRenderer } from "./renderer";

const app = express();
const PORT = 5000;
const OUTPUT = "/tmp/screen.png";

app.get("/render.png", (req, res) => {
  if (!fs.existsSync(OUTPUT)) return res.status(503).send("No image yet");
  res.set("Content-Type", "image/png");
  fs.createReadStream(OUTPUT).pipe(res);
});

app.listen(PORT, () => {
  console.log(`PNG server on http://localhost:${PORT}/render.png`);
});

// Start Playwright
startRenderer();
