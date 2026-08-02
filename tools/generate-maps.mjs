#!/usr/bin/env node
/**
 * Generates every map as Tiled-format JSON (openable in Tiled for hand editing)
 * plus a typed object manifest per map.
 *
 * Maps are generated rather than hand-authored so that collision, path
 * auto-tiling and building placement can never drift out of sync with the
 * sprite dimensions in tools/art/props.mjs.
 *
 * Run: npm run maps
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDINGS } from './art/props.mjs';
import { TOWN_TILE as T, INTERIOR_TILE as I } from './art/tiles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'maps');
const TS = 16;

const N = 1, S = 2, W = 4, E = 8;

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

class Grid {
  constructor(w, h, fill = 0) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(fill);
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.cells[y * this.w + x] : -1; }
  set(x, y, v) { if (this.in(x, y)) this.cells[y * this.w + x] = v; }
  rect(x, y, w, h, v) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
  }
  toGids() { return this.cells.map((v) => (v < 0 ? 0 : v + 1)); }
}

/** Stable per-tile pseudo-random, so regeneration is deterministic. */
function rnd(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Replace every tile in `region` with the matching edge variant, where the
 * mask marks which orthogonal neighbours are NOT part of the region.
 */
function autotile(ground, isMember, baseId, edgeBase) {
  const out = [];
  for (let y = 0; y < ground.h; y++) {
    for (let x = 0; x < ground.w; x++) {
      if (!isMember(x, y)) continue;
      let mask = 0;
      if (!isMember(x, y - 1)) mask |= N;
      if (!isMember(x, y + 1)) mask |= S;
      if (!isMember(x - 1, y)) mask |= W;
      if (!isMember(x + 1, y)) mask |= E;
      out.push([x, y, mask ? edgeBase + mask : baseId]);
    }
  }
  for (const [x, y, id] of out) ground.set(x, y, id);
}

// ---------------------------------------------------------------------------
// Map assembly
// ---------------------------------------------------------------------------

function makeMap(name, w, h, tilesetName, tilesetImage) {
  return {
    name,
    w,
    h,
    tilesetName,
    tilesetImage,
    ground: new Grid(w, h, 0),
    decorBelow: new Grid(w, h, -1),
    collision: new Grid(w, h, -1),
    objects: [],
  };
}

function block(map, x, y, w, h) { map.collision.rect(x, y, w, h, 0); }

/**
 * Place a building sprite so that its door lands exactly on `doorTile` and its
 * bottom edge sits on that tile's bottom edge, then block everything it covers
 * except the doorway itself.
 */
function placeBuilding(map, frame, doorTile, target, section) {
  const cfg = BUILDINGS[frame];
  const bx = doorTile.x * TS - cfg.doorX;
  const by = (doorTile.y + 1) * TS - cfg.h;

  map.objects.push({
    id: `${frame}`,
    type: 'prop',
    frame,
    x: bx,
    y: by,
    // +1 so the facade covers the player while they stand in the doorway
    depth: by + cfg.h + 1,
  });

  const tx0 = Math.floor(bx / TS);
  const tx1 = Math.ceil((bx + cfg.w) / TS) - 1;
  const ty0 = Math.floor(by / TS);
  const ty1 = doorTile.y;
  for (let y = ty0; y <= ty1; y++) {
    for (let x = tx0; x <= tx1; x++) {
      if (x === doorTile.x && y === doorTile.y) continue; // the doorway is walkable
      block(map, x, y, 1, 1);
    }
  }

  map.objects.push({
    id: `door-${section}`,
    type: 'door',
    x: doorTile.x * TS,
    y: doorTile.y * TS,
    target,
    targetSpawn: 'entry',
    transition: 'door',
    section,
  });
}

function tree(map, tx, ty) {
  map.objects.push({ id: `tree-${tx}-${ty}`, type: 'prop', frame: 'tree', x: tx * TS, y: ty * TS - 8 });
  block(map, tx, ty, 2, 2);
}

function prop(map, frame, tx, ty, opts = {}) {
  const { bw = 1, bh = 1, ox = 0, oy = 0, blocking = true, floor = false } = opts;
  map.objects.push({
    id: opts.id ?? `${frame}-${tx}-${ty}`,
    type: 'prop',
    frame,
    x: tx * TS + ox,
    y: ty * TS + oy,
    // Floor decor sits just above the tilemap layers so characters always walk
    // ON it. Default y-sorting would let a rug draw over the player's feet.
    ...(floor ? { depth: 2 } : {}),
  });
  if (blocking) block(map, tx, ty, bw, bh);
}

function interactable(map, contentId, frame, tx, ty, opts = {}) {
  const { bw = 1, bh = 1, ox = 0, oy = 0, facing } = opts;
  if (frame) {
    map.objects.push({ id: `${contentId}-art`, type: 'prop', frame, x: tx * TS + ox, y: ty * TS + oy });
  }
  block(map, tx, ty, bw, bh);
  for (let i = 0; i < bw; i++) {
    map.objects.push({
      id: `${contentId}-${i}`,
      type: 'interactable',
      contentId,
      x: (tx + i) * TS,
      y: ty * TS,
      ...(facing ? { facing } : {}),
    });
  }
}

function npc(map, sprite, contentId, tx, ty, opts = {}) {
  const { facing = 'down', movement = 'static', wander } = opts;
  map.objects.push({
    id: `npc-${contentId}`,
    type: 'npc',
    sprite,
    contentId,
    x: tx * TS,
    y: ty * TS,
    facing,
    movement,
    ...(wander ? { wander } : {}),
  });
  block(map, tx, ty, 1, 1);
}

function spawn(map, id, tx, ty, facing) {
  map.objects.push({ id, type: 'spawn', x: tx * TS, y: ty * TS, facing });
}

// ---------------------------------------------------------------------------
// The town
// ---------------------------------------------------------------------------

function buildTown() {
  const MW = 40, MH = 30;
  const m = makeMap('town', MW, MH, 'town-exterior', '../tilesets/town-exterior.png');

  // --- grass base with scattered variants ---
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const r = rnd(x, y, 1);
      let id = T.GRASS;
      if (r > 0.90) id = T.GRASS_A;
      else if (r > 0.84) id = T.GRASS_B;
      else if (r > 0.82) id = T.FLOWER_RED;
      else if (r > 0.80) id = T.FLOWER_PINK;
      m.ground.set(x, y, id);
    }
  }

  // --- paths ---
  const isPath = (x, y) => {
    if (y >= 13 && y <= 14 && x >= 8 && x <= 32) return true;      // main street
    if (x === 11 && y >= 9 && y <= 13) return true;                // north-west spur
    if (x === 28 && y >= 9 && y <= 13) return true;                // north-east spur
    if (x === 11 && y >= 14 && y <= 20) return true;               // south-west spur
    if (x === 28 && y >= 14 && y <= 20) return true;               // south-east spur
    if (x >= 18 && x <= 23 && y >= 12 && y <= 16) return true;     // plaza
    return false;
  };
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (isPath(x, y)) m.ground.set(x, y, rnd(x, y, 4) > 0.85 ? T.PATH_B : T.PATH);
    }
  }
  autotile(m.ground, isPath, T.PATH, T.PATH_EDGE);

  // --- water along the south edge, with a sandy shore ---
  const isWater = (x, y) => y >= 27;
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (isWater(x, y)) m.ground.set(x, y, T.WATER);
      else if (y === 26) m.ground.set(x, y, T.SAND);
    }
  }
  autotile(m.ground, isWater, T.WATER, T.WATER_EDGE);
  for (let y = 26; y < MH; y++) block(m, 0, y, MW, 1);

  // --- tall grass patches ---
  for (const [x0, y0, w, h] of [[4, 22, 4, 3], [33, 22, 4, 3], [34, 6, 3, 4]]) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m.ground.set(x, y, T.TALL_GRASS);
  }

  // --- tree border ---
  for (let x = 0; x < MW; x += 2) { tree(m, x, 0); tree(m, x, 2); }
  for (let y = 4; y < 26; y += 2) { tree(m, 0, y); tree(m, 2, y); tree(m, 36, y); tree(m, 38, y); }
  block(m, 0, 0, MW, 4);
  block(m, 0, 0, 4, MH);
  block(m, 36, 0, 4, MH);

  // A few trees inside the town for depth.
  for (const [x, y] of [[16, 5], [24, 5], [7, 16], [33, 17], [15, 23], [24, 23]]) tree(m, x, y);

  // --- buildings ---
  placeBuilding(m, 'building-work', { x: 11, y: 8 }, 'interior-work', 'work');
  placeBuilding(m, 'building-projects', { x: 28, y: 8 }, 'interior-projects', 'projects');
  placeBuilding(m, 'building-about', { x: 11, y: 20 }, 'interior-about', 'about');
  placeBuilding(m, 'building-contact', { x: 28, y: 20 }, 'interior-contact', 'contact');

  // --- town furniture ---
  interactable(m, 'town.sign', 'sign', 22, 14, { oy: -8, facing: 'up' });
  prop(m, 'lamp', 18, 12, { oy: -16 });
  prop(m, 'lamp', 23, 16, { oy: -16 });
  prop(m, 'mailbox', 30, 20, { oy: -8 });
  for (let x = 14; x <= 17; x++) prop(m, 'fence', x, 18);
  for (let x = 24; x <= 27; x++) prop(m, 'fence', x, 11);
  for (const [x, y] of [[9, 15], [32, 15], [20, 23], [6, 11]]) prop(m, 'bush', x, y);
  for (const [x, y] of [[13, 16], [30, 12]]) prop(m, 'rock', x, y);

  // --- people ---
  npc(m, 'npc-professor', 'town.professor', 20, 11, { facing: 'down', movement: 'lookAround' });
  npc(m, 'npc-townsfolk-a', 'town.villager.a', 25, 14, {
    facing: 'down', movement: 'wander', wander: { x: 23, y: 13, w: 4, h: 3 },
  });
  npc(m, 'npc-townsfolk-b', 'town.villager.b', 15, 13, {
    facing: 'down', movement: 'wander', wander: { x: 13, y: 12, w: 4, h: 3 },
  });

  // --- spawns ---
  spawn(m, 'default', 20, 16, 'up');
  spawn(m, 'from-work', 11, 9, 'down');
  spawn(m, 'from-projects', 28, 9, 'down');
  spawn(m, 'from-about', 11, 21, 'down');
  spawn(m, 'from-contact', 28, 21, 'down');

  return m;
}

// ---------------------------------------------------------------------------
/**
 * Interiors are deliberately small — a FireRed house is legible in a single
 * screen, and a big room full of floor reads as unfinished rather than grand.
 * The viewport is 15x10 tiles, so these are between one and 1.5 screens.
 */
function buildInteriorShell(name, floorId, returnSpawn, W, H) {
  const m = makeMap(name, W, H, 'interior', '../tilesets/interior.png');

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let id = floorId;
      if (y === 0 || y === 1) id = x % 5 === 2 ? I.WALL_WINDOW : I.WALL_UP;
      else if (y === 2) id = I.WALL_LOW;
      else if (floorId === I.WOOD && rnd(x, y, 3) > 0.88) id = I.WOOD_B;
      m.ground.set(x, y, id);
    }
  }
  // Walls and the outer ring are solid.
  block(m, 0, 0, W, 3);
  block(m, 0, 0, 1, H);
  block(m, W - 1, 0, 1, H);
  block(m, 0, H - 1, W, 1);

  // Exit mat, and the doorway tile the player steps onto to leave.
  const ex = Math.floor(W / 2);
  m.ground.set(ex, H - 1, I.EXIT_MAT);
  m.collision.set(ex, H - 1, -1);
  m.objects.push({
    id: 'exit',
    type: 'door',
    x: ex * TS,
    y: (H - 1) * TS,
    target: 'town',
    targetSpawn: returnSpawn,
    transition: 'door',
  });
  spawn(m, 'entry', ex, H - 2, 'up');
  return { m, W, H, ex };
}

function buildWorkInterior() {
  const { m, W, H, ex } = buildInteriorShell('interior-work', I.GYM, 'from-work', 16, 14);

  // Red runway from the door to the back wall.
  for (let y = 3; y <= H - 2; y++) {
    for (let x = ex - 1; x <= ex; x++) {
      let mask = 0;
      if (y === 3) mask |= N;
      if (y === H - 2) mask |= S;
      if (x === ex - 1) mask |= W;
      if (x === ex) mask |= E;
      m.ground.set(x, y, mask ? I.CARPET_RED_EDGE + mask : I.CARPET_RED);
    }
  }

  // One trainer per role, each on a blue mat off the runway.
  const spots = [[3, 5], [12, 7], [3, 10]];
  spots.forEach(([x, y], i) => {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        let mask = 0;
        if (dy === 0) mask |= N;
        if (dy === 1) mask |= S;
        if (dx === 0) mask |= W;
        if (dx === 1) mask |= E;
        m.ground.set(x + dx, y + dy, I.CARPET_BLUE_EDGE + mask);
      }
    }
    npc(m, 'npc-trainer', `work.role.${i}`, x, y, { facing: 'down' });
    prop(m, 'platform', x, y + 1, { bw: 2, blocking: false, floor: true, id: `plat-${i}` });
  });

  interactable(m, 'work.skills', 'trophy-case', 2, 3, { bw: 2, oy: -16 });
  interactable(m, 'work.education.0', 'certificate', 11, 3, { oy: -8 });
  interactable(m, 'work.education.1', 'certificate', 13, 3, { oy: -8 });
  prop(m, 'bookshelf', 5, 3, { oy: -16 });
  prop(m, 'bookshelf', 10, 3, { oy: -16 });
  npc(m, 'npc-clerk', 'work.intro', 10, H - 2, { facing: 'left', movement: 'lookAround' });
  prop(m, 'plant', 1, H - 2, { oy: -8 });
  prop(m, 'plant', W - 2, H - 2, { oy: -8 });
  return m;
}

function buildProjectsInterior() {
  const { m, W, H } = buildInteriorShell('interior-projects', I.TILE, 'from-projects', 15, 13);

  for (const x of [2, 3, 11, 12]) prop(m, 'bookshelf', x, 3, { oy: -16 });
  interactable(m, 'projects.intro', 'lab-machine', 6, 3, { bw: 2, oy: -16 });

  // One terminal per project, each on its own desk.
  const PCS = [[2, 6], [5, 6], [10, 6], [13, 6]];
  PCS.forEach(([x, y], i) => {
    interactable(m, `projects.item.${i}`, 'pc', x, y, { oy: -8 });
    prop(m, 'table', x - 1, y + 1, { bw: 2, oy: -6, id: `desk-${i}` });
  });

  npc(m, 'npc-professor', 'projects.intro', 11, H - 2, { facing: 'left', movement: 'lookAround' });
  prop(m, 'plant', 1, H - 2, { oy: -8 });
  prop(m, 'plant', W - 2, 5, { oy: -8 });
  return m;
}

function buildAboutInterior() {
  const { m, W, H } = buildInteriorShell('interior-about', I.WOOD, 'from-about', 12, 10);

  interactable(m, 'about.bed', 'bed', 1, 3, { bh: 2, oy: -16 });
  interactable(m, 'about.bookshelf', 'bookshelf', 3, 3, { oy: -16 });
  interactable(m, 'about.photo', 'photo', 5, 3, { oy: -8 });
  interactable(m, 'about.tv.0', 'tv', 7, 3, { bw: 2, oy: -4 });
  interactable(m, 'about.plant', 'plant', 10, 3, { oy: -8 });

  prop(m, 'table', 3, 6, { bw: 2 });
  interactable(m, 'about.trainercard', 'pc', 9, 6, { oy: -8 });
  prop(m, 'rug', 5, 7, { bw: 2, blocking: false, floor: true });
  npc(m, 'npc-townsfolk-b', 'about.photo', 1, 7, { facing: 'right', movement: 'lookAround' });
  return m;
}

function buildContactInterior() {
  const { m, W, H } = buildInteriorShell('interior-contact', I.MART, 'from-contact', 13, 11);

  prop(m, 'counter', 4, 5, { bw: 3, id: 'counter' });
  npc(m, 'npc-clerk', 'contact.clerk', 5, 4, { facing: 'down' });

  interactable(m, 'contact.mailbox', 'mailbox', 2, 8, { oy: -8 });
  interactable(m, 'contact.shelf', 'bookshelf', 9, 3, { oy: -16 });
  prop(m, 'bookshelf', 10, 3, { oy: -16 });
  prop(m, 'plant', 1, H - 2, { oy: -8 });
  prop(m, 'plant', W - 2, H - 2, { oy: -8 });
  prop(m, 'rug', 8, 7, { bw: 2, blocking: false, floor: true });
  return m;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

function toTiled(m) {
  const layer = (id, name, grid, visible = true) => ({
    data: grid.toGids(),
    height: m.h,
    id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible,
    width: m.w,
    x: 0,
    y: 0,
  });

  return {
    compressionlevel: -1,
    width: m.w,
    height: m.h,
    infinite: false,
    layers: [
      layer(1, 'ground', m.ground),
      layer(2, 'decor-below', m.decorBelow),
      layer(3, 'collision', m.collision, false),
    ],
    nextlayerid: 4,
    nextobjectid: 1,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: TS,
    tilesets: [
      {
        columns: 16,
        firstgid: 1,
        image: m.tilesetImage,
        imageheight: 256,
        imagewidth: 256,
        margin: 0,
        name: m.tilesetName,
        spacing: 0,
        tilecount: 256,
        tileheight: TS,
        tilewidth: TS,
      },
    ],
    tilewidth: TS,
    type: 'map',
    version: '1.10',
  };
}

const maps = [
  buildTown(),
  buildWorkInterior(),
  buildProjectsInterior(),
  buildAboutInterior(),
  buildContactInterior(),
];

fs.mkdirSync(OUT, { recursive: true });
const summary = [];
for (const m of maps) {
  fs.writeFileSync(path.join(OUT, `${m.name}.json`), JSON.stringify(toTiled(m)));
  fs.writeFileSync(
    path.join(OUT, `${m.name}.objects.json`),
    JSON.stringify({ name: m.name, width: m.w, height: m.h, objects: m.objects }, null, 1)
  );
  const solid = m.collision.cells.filter((c) => c >= 0).length;
  summary.push({
    map: m.name,
    size: `${m.w}x${m.h}`,
    objects: m.objects.length,
    walkable: m.w * m.h - solid,
    solid,
  });
}

console.log('\nGenerated maps into public/assets/maps\n');
for (const s of summary) {
  console.log(
    `  ${s.map.padEnd(20)} ${s.size.padEnd(8)} ${String(s.objects).padStart(3)} objects  ` +
    `${String(s.walkable).padStart(4)} walkable / ${s.solid} solid`
  );
}
console.log('');
