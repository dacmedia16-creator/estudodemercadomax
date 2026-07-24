// One-off utility: the source logo was exported with a baked-in checkerboard
// "transparency" pattern instead of a real alpha channel. This trims the
// checker padding down to the circular badge, then converts every
// near-white pixel (the checker squares) to real transparency, keeping the
// colored ring/bars/pin/text opaque.
import sharp from "sharp";

const SRC = process.argv[2];
const OUT = process.argv[3];
const SIZE = Number(process.argv[4] ?? 512);

if (!SRC || !OUT) {
  console.error("Usage: node make-logo-transparent.mjs <src.png> <out.png> [size]");
  process.exit(1);
}

const trimmed = sharp(SRC).trim({ threshold: 20 });
const { data, info } = await trimmed.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const LOW = 200; // below this (any channel), fully opaque
const HIGH = 235; // above this (all channels), fully transparent
const out = Buffer.alloc(width * height * 4);

for (let i = 0; i < width * height; i++) {
  const r = data[i * channels];
  const g = data[i * channels + 1];
  const b = data[i * channels + 2];
  const minC = Math.min(r, g, b);
  let alpha;
  if (minC <= LOW) alpha = 255;
  else if (minC >= HIGH) alpha = 0;
  else alpha = Math.round(255 * (1 - (minC - LOW) / (HIGH - LOW)));
  out[i * 4] = r;
  out[i * 4 + 1] = g;
  out[i * 4 + 2] = b;
  out[i * 4 + 3] = alpha;
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT} (${SIZE}x${SIZE}, trimmed from ${width}x${height})`);
