import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "src/assets/remax-icon-transparent.png";
const OUT_DIR = "public/icons";
const THEME_COLOR = "#0b3aa6";

await mkdir(OUT_DIR, { recursive: true });

// Regular icons: transparent background, logo fills most of the canvas.
async function regularIcon(size, outPath) {
  await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(outPath);
}

// Maskable icon: opaque background + logo shrunk into the ~80% "safe zone" circle.
async function maskableIcon(size, outPath) {
  const logoSize = Math.round(size * 0.65);
  const logo = await sharp(SRC).resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: THEME_COLOR },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

// Apple touch icon: iOS ignores alpha, so give it an opaque background too.
async function appleTouchIcon(size, outPath) {
  const logoSize = Math.round(size * 0.78);
  const logo = await sharp(SRC).resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: THEME_COLOR },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

await regularIcon(192, `${OUT_DIR}/icon-192.png`);
await regularIcon(512, `${OUT_DIR}/icon-512.png`);
await maskableIcon(512, `${OUT_DIR}/maskable-icon-512.png`);
await appleTouchIcon(180, "public/apple-touch-icon.png");
await regularIcon(32, "public/favicon-32.png");
await regularIcon(16, "public/favicon-16.png");

console.log("PWA icons generated.");
