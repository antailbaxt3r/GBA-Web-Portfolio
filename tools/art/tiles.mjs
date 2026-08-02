// Terrain tilesets. 16x16 tiles on a 16-column grid, so tileId = row*16 + col.
// These ids are mirrored in src/data/tiles.ts.
//
// Style notes taken from reference/…Tileset 2.png: grass is a mint-teal field
// with sparse 2x2 lighter blocks (not per-pixel noise), and terrain boundaries
// are organic and wavy rather than straight.
import { Bitmap } from '../pixel.mjs';
import { PAL } from './palette.mjs';

export const TS = 16;
export const COLS = 16;

export const N = 1, S = 2, W = 4, E = 8;

function h(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Sparse 2x2 blocks, the way GBA-era tiles were actually dithered. */
function speckle(t, seed, col, chance = 0.10) {
  for (let y = 0; y < TS; y += 2) {
    for (let x = 0; x < TS; x += 2) {
      if (h(x, y, seed) < chance) t.fill(x, y, 2, 2, col);
    }
  }
}

// ---------------------------------------------------------------------------
// Town exterior
// ---------------------------------------------------------------------------

function grassBase(seed) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.grass);
  speckle(t, seed, PAL.grassLight, 0.16);
  speckle(t, seed + 101, PAL.grassDark, 0.05);
  return t;
}

/** The little three-blade grass marks scattered over FireRed's fields. */
function grassTuft(t, seed) {
  const spots = [[3, 5], [10, 3], [6, 11], [12, 12]];
  spots.forEach(([x, y], i) => {
    if (h(x, y, seed + i * 7) < 0.5) return;
    t.set(x, y, PAL.grassPale);
    t.set(x - 1, y + 1, PAL.grassPale);
    t.set(x + 1, y + 1, PAL.grassPale);
    t.set(x, y + 1, PAL.grassDeep);
  });
  return t;
}

function pathBase(seed) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.path);
  speckle(t, seed, PAL.pathMid, 0.12);
  speckle(t, seed + 51, PAL.pathLight, 0.10);
  return t;
}

/**
 * Path tile with grass encroaching from the sides named in `mask`.
 * The boundary wobbles by a pixel or two so joins read as organic.
 */
function pathEdge(mask, seed) {
  const t = pathBase(seed);
  const wob = (i, s) => 3 + (h(i, s, seed) > 0.55 ? 1 : 0) - (h(i, s + 9, seed) > 0.75 ? 1 : 0);

  const paintCol = (x, from, to, dir) => {
    for (let k = 0; k < to; k++) {
      const y = dir > 0 ? from + k : from - k;
      t.set(x, y, k === to - 1 ? PAL.pathEdge : PAL.grass);
    }
  };
  const paintRow = (y, from, to, dir) => {
    for (let k = 0; k < to; k++) {
      const x = dir > 0 ? from + k : from - k;
      t.set(x, y, k === to - 1 ? PAL.pathEdge : PAL.grass);
    }
  };

  if (mask & N) for (let x = 0; x < TS; x++) paintCol(x, 0, wob(x, 1), 1);
  if (mask & S) for (let x = 0; x < TS; x++) paintCol(x, TS - 1, wob(x, 2), -1);
  if (mask & W) for (let y = 0; y < TS; y++) paintRow(y, 0, wob(y, 3), 1);
  if (mask & E) for (let y = 0; y < TS; y++) paintRow(y, TS - 1, wob(y, 4), -1);

  // Re-speckle the grass so the border does not read as a flat band.
  for (let y = 0; y < TS; y += 2) {
    for (let x = 0; x < TS; x += 2) {
      const c = t.get(x, y);
      const isGrass = c[0] === PAL.grass[0] && c[1] === PAL.grass[1] && c[2] === PAL.grass[2];
      if (isGrass && h(x, y, seed + 200) < 0.18) t.fill(x, y, 2, 2, PAL.grassLight);
    }
  }
  return t;
}

function waterTile(frame) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.water);
  speckle(t, 3, PAL.waterDark, 0.14);
  speckle(t, 7, PAL.waterLight, 0.10);
  for (const [ry, rx, len] of [[3, 2, 6], [8, 9, 5], [12, 4, 7]]) {
    for (let i = 0; i < len; i++) t.set((rx + i + frame * 2) % TS, ry, PAL.waterLight);
    t.set((rx - 1 + frame * 2 + TS) % TS, ry + 1, PAL.waterFoam);
  }
  return t;
}

function waterEdge(mask) {
  const t = waterTile(0);
  const band = 4;
  const paint = (x, y, d) => {
    if (d === 0) t.set(x, y, PAL.sand);
    else if (d === 1) t.set(x, y, PAL.sandDark);
    else t.set(x, y, PAL.waterFoam);
  };
  if (mask & N) for (let x = 0; x < TS; x++) for (let y = 0; y < band; y++) paint(x, y, y);
  if (mask & S) for (let x = 0; x < TS; x++) for (let y = 0; y < band; y++) paint(x, TS - 1 - y, y);
  if (mask & W) for (let y = 0; y < TS; y++) for (let x = 0; x < band; x++) paint(x, y, x);
  if (mask & E) for (let y = 0; y < TS; y++) for (let x = 0; x < band; x++) paint(TS - 1 - x, y, x);
  return t;
}

function tallGrassTile() {
  const t = grassBase(11);
  for (let x = 1; x < TS; x += 3) {
    const base = 13 + (h(x, 0, 9) > 0.5 ? 1 : 0);
    const top = base - 5 - Math.floor(h(x, 1, 9) * 3);
    for (let y = top; y <= base; y++) t.set(x, y, PAL.tallGrass);
    t.set(x, top, PAL.treeDeep);
    t.set(x + 1, base, PAL.grassDeep);
    t.set(x - 1, base - 2, PAL.tallGrass);
  }
  t.hline(0, TS - 1, TS, PAL.grassDeep);
  return t;
}

function flowerTile(color) {
  const t = grassTuft(grassBase(2), 2);
  for (const [x, y] of [[3, 4], [11, 6], [6, 12], [13, 12]]) {
    t.set(x, y - 1, color); t.set(x - 1, y, color); t.set(x + 1, y, color);
    t.set(x, y + 1, color); t.set(x, y, PAL.flowerYellow);
    t.set(x + 1, y + 1, PAL.grassDeep);
  }
  return t;
}

function sandTile() {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.sand);
  speckle(t, 21, PAL.sandDark, 0.10);
  return t;
}

/** Hoppable ledge, drawn as a low earthen lip with grass above and below. */
function ledgeTile(part) {
  const t = grassBase(4);
  t.fill(0, 5, TS, 7, PAL.pathMid);
  t.hline(0, 5, TS, PAL.pathLight);
  t.hline(0, 11, TS, PAL.trunkDark);
  for (let x = 0; x < TS; x++) {
    if (h(x, 0, 6) > 0.6) t.set(x, 8, PAL.pathEdge);
    if (h(x, 1, 6) > 0.7) t.set(x, 9, PAL.pathEdge);
  }
  if (part === 'left') { t.vline(0, 5, 7, PAL.trunkDark); t.vline(1, 6, 5, PAL.pathEdge); }
  if (part === 'right') { t.vline(TS - 1, 5, 7, PAL.trunkDark); t.vline(TS - 2, 6, 5, PAL.pathEdge); }
  return t;
}

export function buildTownTileset() {
  const sheet = new Bitmap(COLS * TS, COLS * TS);
  const place = (id, bmp) => sheet.blit(bmp, (id % COLS) * TS, Math.floor(id / COLS) * TS);

  place(0, grassBase(1));
  place(1, grassTuft(grassBase(2), 2));
  place(2, grassTuft(grassBase(3), 8));
  place(3, flowerTile(PAL.flowerRed));
  place(4, flowerTile(PAL.flowerCoral));
  place(5, tallGrassTile());
  place(6, pathBase(12));
  place(7, pathBase(13));
  place(8, sandTile());
  place(9, waterTile(0));
  place(10, waterTile(1));
  place(11, waterTile(2));
  place(12, waterTile(3));
  place(13, ledgeTile('mid'));
  place(14, ledgeTile('left'));
  place(15, ledgeTile('right'));

  for (let m = 0; m < 16; m++) place(16 + m, pathEdge(m, 30 + m));
  for (let m = 0; m < 16; m++) place(32 + m, waterEdge(m));

  return sheet;
}

// ---------------------------------------------------------------------------
// Interiors
// ---------------------------------------------------------------------------

/**
 * Floorboards. Vertical seams on every tile turn the floor into brickwork, so
 * the plain variant has none — only the rare `seam` variant breaks a run.
 */
function woodFloor(seed, seam = false) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.floorWood);
  for (const y of [0, 8]) {
    t.hline(0, y, TS, PAL.floorWoodDark);
    t.hline(0, y + 1, TS, PAL.pathLight);
  }
  // Long grain streaks along the boards.
  for (let y = 3; y < TS; y += 8) {
    for (let x = 0; x < TS; x++) if (h(x, y, seed) > 0.75) t.set(x, y, PAL.pathMid);
  }
  if (seam) {
    t.vline(6, 1, 7, PAL.floorWoodDark);
    t.vline(11, 9, 7, PAL.floorWoodDark);
  }
  return t;
}

function tileFloor(a, b) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, a);
  t.fill(0, 0, 8, 8, b);
  t.fill(8, 8, 8, 8, b);
  t.hline(0, 0, TS, PAL.floorTileDark);
  t.vline(0, 0, TS, PAL.floorTileDark);
  return t;
}

function carpet(main, dark) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, main);
  // A sparse weave, not a polka dot: one mark per tile reads as texture.
  t.set(4, 4, dark); t.set(5, 4, dark);
  t.set(12, 9, dark); t.set(13, 9, dark);
  t.set(8, 13, dark);
  return t;
}

function carpetEdge(mask, main, dark) {
  const t = carpet(main, dark);
  if (mask & N) t.hline(0, 0, TS, dark);
  if (mask & S) t.hline(0, TS - 1, TS, dark);
  if (mask & W) t.vline(0, 0, TS, dark);
  if (mask & E) t.vline(TS - 1, 0, TS, dark);
  return t;
}

function wallLower() {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.wallInnerMid);
  t.hline(0, 0, TS, PAL.wallInnerDark);
  for (let y = 3; y < TS; y += 5) t.hline(0, y, TS, PAL.wallInner);
  return t;
}

function wallUpper(variant) {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.wallInner);
  speckle(t, 33, PAL.wallInnerMid, 0.05);
  if (variant === 'window') {
    t.fill(3, 3, 10, 9, PAL.windowBlue);
    t.rect(3, 3, 10, 9, PAL.woodDark);
    t.vline(8, 4, 7, PAL.woodDark);
    t.hline(4, 7, 8, PAL.woodDark);
    t.fill(4, 4, 4, 3, PAL.waterFoam);
  }
  if (variant === 'trim') {
    t.fill(0, TS - 3, TS, 3, PAL.wallInnerDark);
    t.hline(0, TS - 4, TS, PAL.wallInnerMid);
  }
  return t;
}

function exitMat() {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.carpetRedDark);
  t.rect(1, 1, TS - 2, TS - 2, PAL.carpetRed);
  t.fill(4, 6, 8, 4, PAL.carpetRed);
  return t;
}

/** Clean polished hall floor. A per-tile motif turns into visual noise
 *  the moment you tile a whole room with it. */
function gymFloor() {
  const t = new Bitmap(TS, TS);
  t.fill(0, 0, TS, TS, PAL.floorTile);
  t.hline(0, 0, TS, PAL.frameWhite);
  t.vline(0, 0, TS, PAL.frameWhite);
  t.hline(0, TS - 1, TS, PAL.floorTileDark);
  t.vline(TS - 1, 0, TS, PAL.floorTileDark);
  return t;
}

export function buildInteriorTileset() {
  const sheet = new Bitmap(COLS * TS, COLS * TS);
  const place = (id, bmp) => sheet.blit(bmp, (id % COLS) * TS, Math.floor(id / COLS) * TS);

  place(0, woodFloor(1));
  place(1, woodFloor(2, true));
  place(2, tileFloor(PAL.floorTile, PAL.floorTileDark));
  place(3, tileFloor(PAL.wallInner, PAL.floorTile));
  place(4, carpet(PAL.carpetRed, PAL.carpetRedDark));
  place(5, carpet(PAL.carpetBlue, PAL.carpetBlueDark));
  place(6, gymFloor());
  place(7, exitMat());
  place(8, wallLower());
  place(9, wallUpper('plain'));
  place(10, wallUpper('window'));
  place(11, wallUpper('trim'));
  place(12, tileFloor(PAL.screenDark, PAL.screen));
  place(13, carpet(PAL.floorTile, PAL.metal));
  place(14, woodFloor(5));
  place(15, tileFloor(PAL.wallInnerMid, PAL.wallInner));

  for (let m = 0; m < 16; m++) place(16 + m, carpetEdge(m, PAL.carpetRed, PAL.carpetRedDark));
  for (let m = 0; m < 16; m++) place(32 + m, carpetEdge(m, PAL.carpetBlue, PAL.carpetBlueDark));

  return sheet;
}

export const TOWN_TILE = {
  GRASS: 0, GRASS_A: 1, GRASS_B: 2, FLOWER_RED: 3, FLOWER_PINK: 4, TALL_GRASS: 5,
  PATH: 6, PATH_B: 7, SAND: 8, WATER: 9, LEDGE: 13, LEDGE_L: 14, LEDGE_R: 15,
  PATH_EDGE: 16, WATER_EDGE: 32,
};

export const INTERIOR_TILE = {
  WOOD: 0, WOOD_B: 1, TILE: 2, TILE_B: 3, CARPET_RED: 4, CARPET_BLUE: 5,
  GYM: 6, EXIT_MAT: 7, WALL_LOW: 8, WALL_UP: 9, WALL_WINDOW: 10, WALL_TRIM: 11,
  LAB: 12, MART: 13, WOOD_C: 14, PLAIN: 15,
  CARPET_RED_EDGE: 16, CARPET_BLUE_EDGE: 32,
};
