#!/usr/bin/env node
// Builds a visual contact sheet of every generated asset, plus a mock 240x160
// scene that shows how the pieces actually compose in-game.
// Run: npm run assets:preview
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from './png.mjs';
import { Bitmap } from './pixel.mjs';
import { PAL } from './art/palette.mjs';
import { TOWN_TILE } from './art/tiles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = path.join(ROOT, 'public', 'assets');
const OUT = process.argv[2] || path.join(ROOT, 'preview');
fs.mkdirSync(OUT, { recursive: true });

function load(rel) {
  const { width, height, data } = decodePNG(fs.readFileSync(path.join(A, rel)));
  const b = new Bitmap(width, height);
  b.data.set(data);
  return b;
}

const atlas = load('atlas/atlas-game.png');
const atlasJson = JSON.parse(fs.readFileSync(path.join(A, 'atlas/atlas-game.json'), 'utf8'));
const frame = (name) => {
  const f = atlasJson.frames[name].frame;
  return atlas.sub(f.x, f.y, f.w, f.h);
};

const town = load('tilesets/town-exterior.png');
const tile = (id) => town.sub((id % 16) * 16, Math.floor(id / 16) * 16, 16, 16);
const player = load('characters/player.png');
const playerFrame = (col, row) => player.sub(col * 16, row * 24, 16, 24);

function scale(bmp, z) {
  const out = new Bitmap(bmp.width * z, bmp.height * z);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) out.put(x, y, bmp.get(Math.floor(x / z), Math.floor(y / z)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bitmap-font text renderer, so the preview can show real in-game type
// ---------------------------------------------------------------------------
function loadFont(pngRel, xmlRel) {
  const page = load(pngRel);
  const xml = fs.readFileSync(path.join(A, xmlRel), 'utf8');
  const chars = new Map();
  for (const m of xml.matchAll(/<char id="(\d+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"[^>]*xadvance="(\d+)"/g)) {
    chars.set(+m[1], { x: +m[2], y: +m[3], w: +m[4], h: +m[5], adv: +m[6] });
  }
  const lh = +(xml.match(/lineHeight="(\d+)"/)?.[1] ?? 12);
  return { page, chars, lh };
}
function drawText(dst, font, text, dx, dy) {
  let x = dx;
  for (const ch of text) {
    const g = font.chars.get(ch.codePointAt(0));
    if (!g) continue;
    dst.blit(font.page.sub(g.x, g.y, g.w, g.h), x, dy);
    x += g.adv;
  }
  return x - dx;
}
const fontMain = loadFont('fonts/font-main.png', 'fonts/font-main.xml');

// ---------------------------------------------------------------------------
// Mock scene: one authentic 240x160 GBA screen
// ---------------------------------------------------------------------------
function mockScene() {
  const W = 240, H = 160;
  const s = new Bitmap(W, H);
  const N = 1, S = 2, Wm = 4, E = 8;

  // ground: grass field with a vertical path down the middle and a horizontal one
  for (let ty = 0; ty < 10; ty++) {
    for (let tx = 0; tx < 15; tx++) {
      const onV = tx >= 6 && tx <= 8;
      const onH = ty >= 6 && ty <= 7;
      let id;
      if (onV || onH) {
        let mask = 0;
        if (onV && !onH) {
          if (tx === 6) mask |= Wm;
          if (tx === 8) mask |= E;
          if (ty === 5 && false) mask |= N;
        } else if (onH && !onV) {
          if (ty === 6) mask |= N;
          if (ty === 7) mask |= S;
        } else {
          if (ty === 7) mask |= S;
        }
        // outer corners of the T-junction
        if (onH && !onV && ty === 6 && (tx === 5 || tx === 9)) mask |= N;
        id = mask ? TOWN_TILE.PATH_EDGE + mask : TOWN_TILE.PATH;
      } else {
        const r = (tx * 7 + ty * 13) % 5;
        id = r === 0 ? TOWN_TILE.GRASS_A : r === 3 ? TOWN_TILE.FLOWER_RED : TOWN_TILE.GRASS;
      }
      s.blit(tile(id), tx * 16, ty * 16);
    }
  }
  // tall grass patch
  for (let tx = 11; tx < 14; tx++) for (let ty = 8; ty < 10; ty++) {
    s.blit(tile(TOWN_TILE.TALL_GRASS), tx * 16, ty * 16);
  }

  // props, drawn back to front
  s.blit(frame('building-about'), 16, 8);
  s.blit(frame('building-projects'), 128, 8);
  s.blit(frame('tree'), 0, 96);
  s.blit(frame('tree'), 208, 88);
  s.blit(frame('tree'), 176, 104);
  s.blit(frame('sign'), 148, 104);
  s.blit(frame('fence'), 32, 112);
  s.blit(frame('fence'), 48, 112);
  s.blit(frame('mailbox'), 96, 96);

  // NPCs + player
  const npc = load('characters/npc-professor.png');
  s.blit(npc.sub(0, 0, 16, 24), 168, 64);
  const tf = load('characters/npc-townsfolk-a.png');
  s.blit(tf.sub(0, 48, 16, 24), 56, 72);
  s.blit(playerFrame(1, 0), 112, 88);

  // dialogue box across the bottom, built from the 9-slice like the game does
  const box = nine(frame('window-frame'), 6, 232, 46);
  s.blit(box, 4, 108);
  drawText(s, fontMain, 'ARJUN: This town is my portfolio.', 12, 116);
  drawText(s, fontMain, 'Press Z to talk, arrows to walk.', 12, 130);
  s.blit(frame('advance-arrow'), 220, 142);
  return s;
}

function nine(src, c, w, h) {
  const out = new Bitmap(w, h);
  const sw = src.width, sh = src.height;
  const mw = sw - c * 2, mh = sh - c * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx, sy;
      if (x < c) sx = x; else if (x >= w - c) sx = sw - (w - x); else sx = c + ((x - c) % mw);
      if (y < c) sy = y; else if (y >= h - c) sy = sh - (h - y); else sy = c + ((y - c) % mh);
      out.put(x, y, src.get(sx, sy));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contact sheet
// ---------------------------------------------------------------------------
function contactSheet() {
  const W = 1120;
  const sheet = new Bitmap(W, 1180);
  sheet.fill(0, 0, W, sheet.height, [24, 24, 32, 255]);
  let y = 8;
  const label = (t) => { drawText(sheet, fontMain, t, 10, y); y += 16; };

  label('MOCK SCENE - one 240x160 GBA screen, 3x');
  sheet.blit(scale(mockScene(), 3), 10, y);
  y += 160 * 3 + 14;

  label('PLAYER - walk (rows: down/up/left/right), 3 frames each, 4x');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    sheet.blit(scale(playerFrame(c, r), 4), 10 + c * 72 + r * 224, y);
  }
  y += 24 * 4 + 12;

  label('PLAYER - run, 4x            NPCS - down frame, 4x');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    sheet.blit(scale(player.sub(c * 16, 96 + r * 24, 16, 24), 4), 10 + c * 72 + r * 224, y);
  }
  const npcs = ['npc-professor', 'npc-townsfolk-a', 'npc-townsfolk-b', 'npc-trainer', 'npc-clerk'];
  npcs.forEach((n, i) => sheet.blit(scale(load(`characters/${n}.png`).sub(0, 0, 16, 24), 4), 910 + i * 40, y));
  y += 24 * 4 + 12;

  label('TOWN TILESET 2x                                          INTERIOR TILESET 2x');
  sheet.blit(scale(town.sub(0, 0, 256, 48), 2), 10, y);
  sheet.blit(scale(load('tilesets/interior.png').sub(0, 0, 256, 48), 2), 540, y);
  y += 96 + 12;

  label('BUILDINGS 2x');
  let x = 10;
  for (const n of ['building-work', 'building-projects', 'building-about', 'building-contact']) {
    const f = frame(n);
    sheet.blit(scale(f, 2), x, y);
    x += f.width * 2 + 12;
  }
  y += 160 + 12;

  label('PROPS 3x');
  x = 10;
  const props = ['tree', 'bush', 'sign', 'fence', 'rock', 'mailbox', 'lamp', 'pc', 'bookshelf',
    'table', 'bed', 'tv', 'trophy-case', 'counter', 'plant', 'photo', 'certificate', 'lab-machine',
    'platform', 'rug'];
  let rowH = 0;
  for (const n of props) {
    const f = frame(n);
    if (x + f.width * 3 > W - 10) { x = 10; y += rowH + 8; rowH = 0; }
    sheet.blit(scale(f, 3), x, y);
    x += f.width * 3 + 10;
    rowH = Math.max(rowH, f.height * 3);
  }
  y += rowH + 14;

  label('UI + FONT 3x');
  sheet.blit(scale(nine(frame('window-frame'), 6, 120, 40), 2), 10, y);
  drawText(sheet, fontMain, 'ABCDEFGHIJKLM abcdefghijklm 0123456789', 260, y + 4);
  drawText(sheet, fontMain, 'NOPQRSTUVWXYZ nopqrstuvwxyz .,!?:;-()', 260, y + 20);
  drawText(sheet, fontMain, '▶ SELECT   ▼ MORE   ♪ MUSIC   @#%&+=/*', 260, y + 36);
  sheet.blit(scale(load('ui/dpad.png'), 1), 760, y);
  sheet.blit(scale(load('ui/btn-a.png'), 1), 830, y + 16);
  sheet.blit(scale(load('ui/btn-b.png'), 1), 862, y + 16);
  sheet.blit(scale(load('ui/title-emblem.png'), 1), 900, y);
  sheet.blit(scale(load('boot/spinner.png'), 2), 960, y);
  y += 70;

  return sheet.sub(0, 0, W, Math.min(y + 10, sheet.height));
}

const sheetBmp = contactSheet();
sheetBmp.save(path.join(OUT, 'contact-sheet.png'));
mockScene().save(path.join(OUT, 'scene.png'));
scale(mockScene(), 4).save(path.join(OUT, 'scene-4x.png'));
console.log(`preview -> ${OUT}/contact-sheet.png (${sheetBmp.width}x${sheetBmp.height})`);
console.log(`preview -> ${OUT}/scene.png, scene-4x.png`);
