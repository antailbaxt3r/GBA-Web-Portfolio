// Pixel-art drawing toolkit. Everything the generators need to place pixels,
// enforce the GBA colour constraint, and compose sheets.
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from './png.mjs';

/** GBA is 15-bit colour: 5 bits per channel. Snap every channel to a multiple of 8. */
export function snap15(hex) {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  const r = Math.round(((n >> 16) & 0xff) / 8) * 8;
  const g = Math.round(((n >> 8) & 0xff) / 8) * 8;
  const b = Math.round((n & 0xff) / 8) * 8;
  return [Math.min(248, r), Math.min(248, g), Math.min(248, b), 255];
}

export const TRANSPARENT = [0, 0, 0, 0];

export class Bitmap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  set(x, y, rgba) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (!rgba || rgba[3] === 0) return; // treat transparent as "skip", use clear() to erase
    const i = (y * this.width + x) * 4;
    this.data[i] = rgba[0];
    this.data[i + 1] = rgba[1];
    this.data[i + 2] = rgba[2];
    this.data[i + 3] = rgba[3];
  }

  /** Force-write including full transparency. */
  put(x, y, rgba) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = rgba[0];
    this.data[i + 1] = rgba[1];
    this.data[i + 2] = rgba[2];
    this.data[i + 3] = rgba[3];
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return TRANSPARENT;
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  fill(x, y, w, h, rgba) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, rgba);
    return this;
  }

  clearRect(x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.put(xx, yy, TRANSPARENT);
    return this;
  }

  rect(x, y, w, h, rgba) {
    for (let xx = x; xx < x + w; xx++) { this.set(xx, y, rgba); this.set(xx, y + h - 1, rgba); }
    for (let yy = y; yy < y + h; yy++) { this.set(x, yy, rgba); this.set(x + w - 1, yy, rgba); }
    return this;
  }

  hline(x, y, w, rgba) { for (let i = 0; i < w; i++) this.set(x + i, y, rgba); return this; }
  vline(x, y, h, rgba) { for (let i = 0; i < h; i++) this.set(x, y + i, rgba); return this; }

  /** Blit another bitmap, skipping its transparent pixels. */
  blit(src, dx, dy) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const c = src.get(x, y);
        if (c[3] !== 0) this.put(dx + x, dy + y, c);
      }
    }
    return this;
  }

  sub(x, y, w, h) {
    const out = new Bitmap(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.put(xx, yy, this.get(x + xx, y + yy));
    return out;
  }

  flipX() {
    const out = new Bitmap(this.width, this.height);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) out.put(this.width - 1 - x, y, this.get(x, y));
    return out;
  }

  /** Deterministic value noise — used for grass/water/path texture. */
  noiseAt(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePNG(this.width, this.height, this.data));
    return file;
  }
}

/**
 * Parse "string art": an array of equal-length strings where each character
 * indexes into a palette map. '.' and ' ' are transparent.
 */
export function art(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const bmp = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const c = palette[ch];
      if (!c) throw new Error(`Unmapped art character "${ch}" at ${x},${y}`);
      bmp.put(x, y, c);
    }
  }
  return bmp;
}

/** Vertically pad string-art rows to a target height, anchored to the bottom. */
export function padTop(rows, height) {
  const w = Math.max(...rows.map((r) => r.length));
  const pad = Array.from({ length: height - rows.length }, () => '.'.repeat(w));
  return [...pad, ...rows.map((r) => r.padEnd(w, '.'))];
}

/** Draw a 9-slice box: corners fixed, edges/centre tiled from a source bitmap. */
export function nineSlice(src, cw, ch, w, h) {
  const out = new Bitmap(w, h);
  const sw = src.width, sh = src.height;
  const mw = sw - cw * 2, mh = sh - ch * 2;
  const px = (sx, sy, dx, dy) => out.put(dx, dy, src.get(sx, sy));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx, sy;
      if (x < cw) sx = x;
      else if (x >= w - cw) sx = sw - (w - x);
      else sx = cw + ((x - cw) % mw);
      if (y < ch) sy = y;
      else if (y >= h - ch) sy = sh - (h - y);
      else sy = ch + ((y - ch) % mh);
      px(sx, sy, x, y);
    }
  }
  return out;
}
