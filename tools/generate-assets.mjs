#!/usr/bin/env node
// Generates every shipped asset from code. Run: npm run assets
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bitmap } from './pixel.mjs';
import { buildTownTileset, buildInteriorTileset } from './art/tiles.mjs';
import { buildCharacter, CHARACTERS } from './art/chars.mjs';
import * as P from './art/props.mjs';
import * as U from './art/ui.mjs';
import { buildFont, renderText } from './art/font.mjs';
import { PAL } from './art/palette.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets');

const written = [];
function save(rel, bmp) {
  const file = path.join(OUT, rel);
  bmp.save(file);
  written.push({ rel, w: bmp.width, h: bmp.height, bytes: fs.statSync(file).size });
  return file;
}
function saveText(rel, text) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  written.push({ rel, w: 0, h: 0, bytes: Buffer.byteLength(text) });
}

// ---------------------------------------------------------------------------
// Tilesets
// ---------------------------------------------------------------------------
save('tilesets/town-exterior.png', buildTownTileset());
save('tilesets/interior.png', buildInteriorTileset());

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------
for (const [name, def] of Object.entries(CHARACTERS)) {
  save(`characters/${name}.png`, buildCharacter(def.opts, def.run));
}

// ---------------------------------------------------------------------------
// Props + UI -> one packed atlas
// ---------------------------------------------------------------------------
const atlasSources = {};
for (const [name, cfg] of Object.entries(P.BUILDINGS)) {
  // Bake the building's name onto its roof sign using the in-game typeface.
  const sign = cfg.label ? renderText(cfg.label, PAL.uiText) : null;
  atlasSources[name] = P.buildingSprite({ ...cfg, sign });
}
Object.assign(atlasSources, {
  tree: P.treeSprite(),
  bush: P.bushSprite(),
  sign: P.signSprite(),
  fence: P.fenceSprite(),
  rock: P.rockSprite(),
  mailbox: P.mailboxSprite(),
  lamp: P.lampSprite(),
  pc: P.pcSprite(),
  bookshelf: P.bookshelfSprite(),
  table: P.tableSprite(),
  bed: P.bedSprite(),
  tv: P.tvSprite(),
  'trophy-case': P.trophyCaseSprite(),
  counter: P.counterSprite(),
  plant: P.plantSprite(),
  photo: P.frameSprite('photo'),
  certificate: P.frameSprite('cert'),
  'lab-machine': P.labMachineSprite(),
  platform: P.platformSprite(),
  rug: P.rugSprite(),
  'window-frame': U.windowFrame(),
  'menu-frame': U.windowFrame(PAL.uiBorderDark, PAL.uiBorder),
  cursor: U.cursorSprite(),
  'advance-arrow': U.advanceArrow(),
  hint: U.hintIcon(),
});

/** Shelf packer. Sorted by descending height, which is near-optimal for sprites. */
function packAtlas(sources, maxW = 512) {
  const items = Object.entries(sources)
    .map(([name, bmp]) => ({ name, bmp }))
    .sort((a, b) => b.bmp.height - a.bmp.height);
  const pad = 1;
  let x = pad, y = pad, shelfH = 0, width = 0;
  const placed = [];
  for (const it of items) {
    if (x + it.bmp.width + pad > maxW) { x = pad; y += shelfH + pad; shelfH = 0; }
    placed.push({ ...it, x, y });
    x += it.bmp.width + pad;
    shelfH = Math.max(shelfH, it.bmp.height);
    width = Math.max(width, x);
  }
  const height = y + shelfH + pad;
  const pow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));
  const sheet = new Bitmap(pow2(width), pow2(height));
  const frames = {};
  for (const p of placed) {
    sheet.blit(p.bmp, p.x, p.y);
    frames[p.name] = {
      frame: { x: p.x, y: p.y, w: p.bmp.width, h: p.bmp.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.bmp.width, h: p.bmp.height },
      sourceSize: { w: p.bmp.width, h: p.bmp.height },
    };
  }
  return { sheet, frames };
}

const { sheet: atlasSheet, frames: atlasFrames } = packAtlas(atlasSources);
save('atlas/atlas-game.png', atlasSheet);
saveText(
  'atlas/atlas-game.json',
  JSON.stringify(
    {
      frames: atlasFrames,
      meta: {
        app: 'tools/generate-assets.mjs',
        version: '1.0',
        image: 'atlas-game.png',
        format: 'RGBA8888',
        size: { w: atlasSheet.width, h: atlasSheet.height },
        scale: '1',
      },
    },
    null,
    1
  )
);

// ---------------------------------------------------------------------------
// Animated / standalone spritesheets
// ---------------------------------------------------------------------------
const reticle = new Bitmap(32, 16);
reticle.blit(U.reticleSprite(0), 0, 0);
reticle.blit(U.reticleSprite(1), 16, 0);
save('ui/reticle.png', reticle);
save('boot/spinner.png', U.ringSpinner());
save('ui/title-emblem.png', U.titleEmblem());

// ---------------------------------------------------------------------------
// Touch controls
// ---------------------------------------------------------------------------
save('ui/dpad.png', U.dpadSprite());
save('ui/btn-a.png', U.roundButton('A'));
save('ui/btn-b.png', U.roundButton('B'));

// ---------------------------------------------------------------------------
// Favicons — the player's own sprite, so the tab icon matches the game.
// ---------------------------------------------------------------------------
function nearestScale(src, z) {
  const out = new Bitmap(src.width * z, src.height * z);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) out.put(x, y, src.get(Math.floor(x / z), Math.floor(y / z)));
  }
  return out;
}

/** Player head on a grass tile, so the icon reads at 16px in a browser tab. */
function faviconBase() {
  const sheet = buildCharacter(CHARACTERS.player.opts, false);
  // Frame 0 is the down-facing neutral pose; content starts 4 rows down and the
  // head occupies cols 2-13, rows 4-15.
  const head = sheet.sub(2, 4, 12, 12);
  const b = new Bitmap(16, 16);
  b.fill(0, 0, 16, 16, PAL.grass);
  b.rect(0, 0, 16, 16, PAL.grassDeep);
  b.fill(1, 1, 14, 1, PAL.grassLight);
  b.blit(head, 2, 3);
  return b;
}

const fav = faviconBase();
function saveRoot(rel, bmp) {
  const file = path.join(ROOT, 'public', rel);
  bmp.save(file);
  written.push({ rel: `../${rel}`, w: bmp.width, h: bmp.height, bytes: fs.statSync(file).size });
}
saveRoot('favicon-16.png', fav);
saveRoot('favicon-32.png', nearestScale(fav, 2));
saveRoot('favicon.png', nearestScale(fav, 4));
saveRoot('apple-touch-icon.png', nearestScale(fav, 12));

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------
const main = buildFont('font-main', { shadow: true });
save('fonts/font-main.png', main.bitmap);
saveText('fonts/font-main.xml', main.xml);

const small = buildFont('font-small', { shadow: false, color: PAL.white });
save('boot/font-small.png', small.bitmap);
saveText('boot/font-small.xml', small.xml);

// The exact set of characters the game can render. src/data/content.ts is
// validated against this at build time so no string can contain a missing glyph.
fs.mkdirSync(path.join(ROOT, 'src', 'data'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'src', 'data', 'glyphs.json'),
  JSON.stringify({ glyphs: main.glyphs.join(''), lineHeight: main.lineHeight }, null, 2) + '\n'
);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const total = written.reduce((s, w) => s + w.bytes, 0);
console.log(`\nGenerated ${written.length} files into public/assets\n`);
for (const w of written.sort((a, b) => a.rel.localeCompare(b.rel))) {
  const dims = w.w ? `${w.w}x${w.h}`.padEnd(10) : ''.padEnd(10);
  console.log(`  ${w.rel.padEnd(34)} ${dims} ${(w.bytes / 1024).toFixed(1)} KB`);
}
console.log(`\n  TOTAL ${(total / 1024).toFixed(1)} KB\n`);
