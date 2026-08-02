// Rasterises reference/pokemon_fire_red.ttf into a BMFont texture + XML pair
// that Phaser's load.bitmapFont() consumes directly.
//
// The font is built on a 64-unit grid with unitsPerEm 1024, so rendering at
// exactly 16px makes one design unit equal one pixel — every edge lands on a
// pixel boundary and the output is perfectly crisp with no anti-aliasing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { Bitmap } from '../pixel.mjs';
import { PAL } from './palette.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TTF_PATH = path.join(ROOT, 'reference', 'pokemon_fire_red.ttf');

const FONT_PX = 16; // 1024 unitsPerEm / 64 units-per-pixel
const ATLAS_COLS = 16;

/** Extra glyphs the TTF does not carry, drawn by hand on the same 5x8 grid. */
const EXTRA = {
  '▶': ['#....', '##...', '###..', '####.', '###..', '##...', '#....', '.....'],
  '▼': ['.....', '#####', '#####', '.###.', '.###.', '..#..', '.....', '.....'],
  '♪': ['...##', '...##', '..#..', '..#..', '.##..', '###..', '.##..', '.....'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#', '.....'],
};

function loadFont() {
  if (!fs.existsSync(TTF_PATH)) {
    throw new Error(
      `Missing ${TTF_PATH}.\nThe bitmap font is rasterised from the FireRed TTF in reference/.`
    );
  }
  const buf = fs.readFileSync(TTF_PATH);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

/** Flatten an opentype path into closed polygons in pixel space. */
function pathToPolygons(cmds) {
  const polys = [];
  let cur = [];
  let px = 0, py = 0;
  const steps = 8;
  for (const c of cmds) {
    if (c.type === 'M') {
      if (cur.length > 2) polys.push(cur);
      cur = [[c.x, c.y]];
      px = c.x; py = c.y;
    } else if (c.type === 'L') {
      cur.push([c.x, c.y]);
      px = c.x; py = c.y;
    } else if (c.type === 'Q') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, mt = 1 - t;
        cur.push([
          mt * mt * px + 2 * mt * t * c.x1 + t * t * c.x,
          mt * mt * py + 2 * mt * t * c.y1 + t * t * c.y,
        ]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, mt = 1 - t;
        cur.push([
          mt ** 3 * px + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t ** 3 * c.x,
          mt ** 3 * py + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t ** 3 * c.y,
        ]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') {
      if (cur.length > 2) polys.push(cur);
      cur = [];
    }
  }
  if (cur.length > 2) polys.push(cur);
  return polys;
}

/** Non-zero winding test at a point. */
function inside(polys, x, y) {
  let wind = 0;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if (y1 <= y) {
        if (y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) wind++;
      } else if (y2 <= y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) wind--;
    }
  }
  return wind !== 0;
}

/**
 * @returns {{bitmap: Bitmap, xml: string, glyphs: string[]}}
 */
export function buildFont(name, { shadow = true, color = PAL.uiText, shadowColor = PAL.uiTextShadow } = {}) {
  const font = loadFont();
  const u = FONT_PX / font.unitsPerEm; // units -> px

  // Collect every renderable ASCII glyph, then append the hand-drawn extras.
  const chars = [];
  for (let c = 32; c < 127; c++) {
    const ch = String.fromCharCode(c);
    if (font.charToGlyph(ch).index !== 0) chars.push(ch);
  }
  chars.push(...Object.keys(EXTRA));

  // Measure: ascent above baseline and descent below, in whole pixels.
  let ascent = 0, descent = 0, maxAdv = 0;
  for (const ch of chars) {
    if (EXTRA[ch]) { ascent = Math.max(ascent, 8); maxAdv = Math.max(maxAdv, 6); continue; }
    const g = font.charToGlyph(ch);
    const bb = g.getBoundingBox();
    if (Number.isFinite(bb.y2)) ascent = Math.max(ascent, Math.ceil(bb.y2 * u));
    if (Number.isFinite(bb.y1)) descent = Math.max(descent, Math.ceil(-bb.y1 * u));
    maxAdv = Math.max(maxAdv, Math.round(g.advanceWidth * u));
  }

  const sh = shadow ? 1 : 0;
  const cellW = maxAdv + sh + 1;
  const cellH = ascent + descent + sh + 1;
  const baseline = ascent;

  const rows = Math.ceil(chars.length / ATLAS_COLS);
  const bmp = new Bitmap(ATLAS_COLS * cellW, rows * cellH);
  const entries = [];

  chars.forEach((ch, i) => {
    const cx = (i % ATLAS_COLS) * cellW;
    const cy = Math.floor(i / ATLAS_COLS) * cellH;
    const stamp = [];

    if (EXTRA[ch]) {
      EXTRA[ch].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') stamp.push([x, y + baseline - 8]);
      });
    } else {
      const g = font.charToGlyph(ch);
      const polys = pathToPolygons(g.getPath(0, 0, FONT_PX).commands);
      if (polys.length) {
        for (let y = -ascent; y < descent; y++) {
          for (let x = 0; x < maxAdv + 1; x++) {
            // Sample at the pixel centre; every edge is on an integer boundary.
            if (inside(polys, x + 0.5, y + 0.5)) stamp.push([x, y + baseline]);
          }
        }
      }
    }

    if (shadow) for (const [x, y] of stamp) bmp.put(cx + x + 1, cy + y + 1, shadowColor);
    for (const [x, y] of stamp) bmp.put(cx + x, cy + y, color);

    const adv = EXTRA[ch] ? 6 : Math.round(font.charToGlyph(ch).advanceWidth * u);
    entries.push({ id: ch.codePointAt(0), x: cx, y: cy, w: cellW, h: cellH, xadvance: adv + sh });
  });

  const lineHeight = cellH + 2;
  const xml =
    `<?xml version="1.0"?>\n<font>\n` +
    `  <info face="${name}" size="${FONT_PX}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="0,0"/>\n` +
    `  <common lineHeight="${lineHeight}" base="${baseline}" scaleW="${bmp.width}" scaleH="${bmp.height}" pages="1" packed="0"/>\n` +
    `  <pages><page id="0" file="${name}.png"/></pages>\n` +
    `  <chars count="${entries.length}">\n` +
    entries
      .map(
        (e) =>
          `    <char id="${e.id}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" ` +
          `xoffset="0" yoffset="0" xadvance="${e.xadvance}" page="0" chnl="15"/>`
      )
      .join('\n') +
    `\n  </chars>\n</font>\n`;

  return { bitmap: bmp, xml, glyphs: chars, lineHeight };
}

/**
 * Render a string to a tightly-cropped Bitmap. Used by the asset generator to
 * bake building signs, so signage uses the same typeface as in-game dialogue.
 */
export function renderText(text, color, { shadow = null } = {}) {
  const font = loadFont();
  const u = FONT_PX / font.unitsPerEm;
  const stamps = [];
  let pen = 0;
  let minY = 99, maxY = -99;

  for (const ch of text) {
    if (EXTRA[ch]) {
      EXTRA[ch].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') stamps.push([pen + x, y - 8]);
      });
      minY = Math.min(minY, -8); maxY = Math.max(maxY, -1);
      pen += 6;
      continue;
    }
    const g = font.charToGlyph(ch);
    const adv = Math.round(g.advanceWidth * u);
    const polys = pathToPolygons(g.getPath(0, 0, FONT_PX).commands);
    if (polys.length) {
      for (let y = -12; y < 4; y++) {
        for (let x = 0; x <= adv; x++) {
          if (inside(polys, x + 0.5, y + 0.5)) {
            stamps.push([pen + x, y]);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
    }
    pen += adv;
  }
  if (!stamps.length) return new Bitmap(1, 1);

  const maxX = Math.max(...stamps.map((s) => s[0]));
  const pad = shadow ? 1 : 0;
  const bmp = new Bitmap(maxX + 1 + pad, maxY - minY + 1 + pad);
  if (shadow) for (const [x, y] of stamps) bmp.put(x + 1, y - minY + 1, shadow);
  for (const [x, y] of stamps) bmp.put(x, y - minY, color);
  return bmp;
}

/** Every character the game may render. Content is validated against this set. */
export function glyphSet() {
  const font = loadFont();
  const chars = [];
  for (let c = 32; c < 127; c++) {
    const ch = String.fromCharCode(c);
    if (font.charToGlyph(ch).index !== 0) chars.push(ch);
  }
  return [...chars, ...Object.keys(EXTRA)];
}
