import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "src/assets/estudo-mercado-max-logo.png";
const OUT_DIR = "public/icons";
// White, not the app's primary blue: the logo itself already uses blue for
// half its ring/text, so a blue backdrop makes those parts disappear.
const ICON_BG = "#ffffff";

await mkdir(OUT_DIR, { recursive: true });

// Regular icons: transparent background, logo fills most of the canvas.
async function regularIcon(size, outPath) {
  await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(outPath);
}

// Maskable icon: opaque background + logo shrunk into the ~80% "safe zone" circle.
async function maskableIcon(size, outPath) {
  const logoSize = Math.round(size * 0.74);
  const logo = await sharp(SRC).resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG },
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
    create: { width: size, height: size, channels: 4, background: ICON_BG },
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
