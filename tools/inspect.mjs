#!/usr/bin/env node
// Reference inspector: crop a region of a sheet and scale it up so pixel
// detail is readable. Also reports the palette of the cropped region.
// Usage: node tools/inspect.mjs <file> <x> <y> <w> <h> <zoom> <out.png>
import fs from 'node:fs';
import { decodePNG, encodePNG } from './png.mjs';

const [file, xs, ys, ws, hs, zs, out] = process.argv.slice(2);
const x0 = +xs, y0 = +ys, w = +ws, h = +hs, z = +zs;

const img = decodePNG(fs.readFileSync(file));
const dst = new Uint8Array(w * z * h * z * 4);
const counts = new Map();

for (let y = 0; y < h * z; y++) {
  for (let x = 0; x < w * z; x++) {
    const sx = x0 + Math.floor(x / z);
    const sy = y0 + Math.floor(y / z);
    const s = (sy * img.width + sx) * 4;
    const d = (y * w * z + x) * 4;
    const inside = sx >= 0 && sy >= 0 && sx < img.width && sy < img.height;
    dst[d] = inside ? img.data[s] : 255;
    dst[d + 1] = inside ? img.data[s + 1] : 0;
    dst[d + 2] = inside ? img.data[s + 2] : 255;
    dst[d + 3] = 255;
    if (inside) {
      const key = `${img.data[s]},${img.data[s + 1]},${img.data[s + 2]},${img.data[s + 3]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
}

fs.writeFileSync(out, encodePNG(w * z, h * z, dst));

const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
console.log(`${file}\n  source ${img.width}x${img.height}, crop ${x0},${y0} ${w}x${h} @${z}x -> ${out}\n`);
console.log('  top colours (r,g,b,a  count  hex  15bit-aligned?)');
for (const [k, n] of top) {
  const [r, g, b, a] = k.split(',').map(Number);
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const aligned = [r, g, b].every((v) => v % 8 === 0) ? 'yes' : 'no';
  console.log(`    ${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)},${String(a).padStart(3)}  ${String(n).padStart(6)}  ${hex}  ${aligned}`);
}
