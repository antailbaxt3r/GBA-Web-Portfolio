// World props drawn as whole sprites rather than composed from 16px tiles:
// buildings, trees, fences, interior furniture. Placed from the object layer
// and y-sorted at runtime.
//
// The building construction traces the grammar of the Five Island houses in
// reference/: a ribbed roof in two shades over a bright ridge band, a near-white
// separator line, dentil edges top and bottom, then a busy wall of louvered
// windows, timber posts, a planked door and a multi-pane window.
import { Bitmap, snap15 } from '../pixel.mjs';
import { PAL } from './palette.mjs';

const O = PAL.outline;

// ---------------------------------------------------------------------------
// Shared wall furniture
// ---------------------------------------------------------------------------

/** Louvered window: white field with horizontal slats. */
function louver(b, x, y, w, h) {
  b.fill(x, y, w, h, PAL.frameWhite);
  for (let i = 1; i < h - 1; i += 2) b.hline(x + 1, y + i, w - 2, PAL.frameDark);
  b.rect(x, y, w, h, O);
  b.vline(x + 1, y + 1, h - 2, PAL.frameMid);
}

/** Timber post flanking a door or window. */
function post(b, x, y, w, h) {
  b.fill(x, y, w, h, PAL.postMid);
  b.vline(x, y, h, PAL.postLight);
  b.vline(x + w - 1, y, h, PAL.postDark);
  b.hline(x, y, w, PAL.postLight);
  b.hline(x, y + h - 1, w, PAL.postDark);
}

/** Multi-pane window with a white frame and a sill. */
function paneWindow(b, x, y, w, h) {
  b.fill(x, y, w, h, PAL.frameWhite);
  b.rect(x, y, w, h, O);
  b.hline(x + 1, y + 1, w - 2, PAL.frameMid);
  const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
  b.fill(ix, iy, iw, ih, PAL.paneMid);
  b.rect(ix, iy, iw, ih, PAL.frameShade);
  const panes = Math.max(2, Math.round(iw / 8));
  const pw = Math.floor(iw / panes);
  for (let p = 0; p < panes; p++) {
    const px = ix + p * pw;
    b.fill(px + 1, iy + 1, pw - 2, Math.floor(ih / 2), PAL.paneLight);
    b.fill(px + 1, iy + 1 + Math.floor(ih / 2), pw - 2, ih - Math.floor(ih / 2) - 2, PAL.paneDark);
    if (p) b.vline(px, iy, ih, PAL.frameWhite);
  }
  b.hline(x, y + h - 1, w, PAL.frameShade);
}

/** Planked door with a frame and a handle. */
function plankDoor(b, x, y, w, h) {
  b.fill(x, y, w, h, PAL.postMid);
  b.rect(x, y, w, h, O);
  b.rect(x + 1, y + 1, w - 2, h - 2, PAL.postDark);
  for (let i = x + 2; i < x + w - 2; i += 2) b.vline(i, y + 2, h - 3, PAL.postLight);
  b.set(x + 2, y + Math.floor(h / 2), PAL.frameShade);
  b.set(x + 2, y + Math.floor(h / 2) + 1, PAL.greyDark);
  b.hline(x, y + h - 1, w, O);
}

/** Alternating dentil edge — the little sawtooth at a roof's top and bottom. */
function dentil(b, y, w, a, c) {
  for (let x = 0; x < w; x++) b.set(x, y, (x >> 1) % 2 === 0 ? a : c);
}

/**
 * Wide horizontal sign board, modelled on the Gym's white nameplate.
 * Always at least 3x as wide as it is tall, so short labels never look square.
 */
/** Board dimensions for a label, so callers can position before drawing. */
function signPlateSize(label) {
  const h = label.height + 9; // 4px clear above the text, 3px below the baseline
  return { w: Math.max(label.width + 18, h * 3), h };
}

function signPlate(b, centreX, y, label, forcedW) {
  const size = signPlateSize(label);
  const sw = forcedW ?? size.w;
  const sh = size.h;
  const x = Math.round(centreX - sw / 2);
  b.fill(x - 2, y + 2, 2, sh - 4, PAL.greyDark);   // mounting brackets
  b.fill(x + sw, y + 2, 2, sh - 4, PAL.greyDark);
  b.fill(x, y, sw, sh, PAL.cream);
  b.rect(x, y, sw, sh, O);
  b.rect(x + 1, y + 1, sw - 2, sh - 2, PAL.postDark);
  b.hline(x + 2, y + 2, sw - 4, PAL.frameWhite);
  b.hline(x + 2, y + sh - 3, sw - 4, PAL.postDark);
  b.blit(label, x + Math.floor((sw - label.width) / 2), y + 4);
  return { x, y, w: sw, h: sh };
}

/** Wall colour ramps, so the four buildings do not read as one recolour. */
export const WALLS = {
  green: { base: PAL.bWall, light: PAL.bWallLight, dark: PAL.bWallDark },
  slate: { base: PAL.wallMid, light: PAL.wall, dark: PAL.wallDark },
  cream: { base: snap15('#E0D8A0'), light: PAL.cream, dark: PAL.postDark },
};

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

// Each roof needs four visibly distinct shades: the ridge band and its rib,
// and the roof face and its rib. Collapsing any pair makes the ribbing vanish.
const R = (hex) => snap15(hex);
export const ROOFS = {
  green: { ridge: R('#A8E868'), rib: R('#78D060'), face: R('#58A848'), faceDark: R('#389030'), sep: R('#E8F8D0') },
  blue: { ridge: R('#88C0E8'), rib: R('#4890D8'), face: R('#4078C0'), faceDark: R('#284878'), sep: R('#D8F0F8') },
  red: { ridge: R('#E88068'), rib: R('#C03040'), face: R('#A82838'), faceDark: R('#781828'), sep: R('#F8D8C8') },
  grey: { ridge: R('#C8D8E8'), rib: R('#90A0B0'), face: R('#788090'), faceDark: R('#585870'), sep: R('#F0F8F8') },
  // The Gym's roof slab: gold over a darker gold rib.
  gold: { ridge: R('#E0D8A0'), rib: R('#C8B068'), face: R('#C8B068'), faceDark: R('#907840'), sep: R('#F0F0C8') },
};

/**
 * Ribbed-roof house.
 * @param {object} o { w, h, doorX, roof, feature }
 */
function houseSprite(o) {
  const { w, h, doorX, roof, feature } = o;
  const b = new Bitmap(w, h);

  const ridgeTop = 1, ridgeH = 7;
  const sepY = ridgeTop + ridgeH;
  const faceY = sepY + 2;
  const wallY = h - (o.wallH ?? 28);
  const faceH = wallY - 2 - faceY;

  // --- roof ---
  dentil(b, 0, w, roof.rib, roof.ridge);
  b.fill(0, ridgeTop, w, ridgeH, roof.ridge);
  for (let x = 0; x < w; x += 2) b.vline(x, ridgeTop, ridgeH, roof.rib);
  b.hline(0, sepY, w, roof.sep);
  b.hline(0, sepY + 1, w, roof.rib);
  b.fill(0, faceY, w, faceH, roof.face);
  if (o.ribs === 'h') {
    for (let y = faceY + 1; y < faceY + faceH; y += 2) b.hline(0, y, w, roof.faceDark);
  } else {
    for (let x = 0; x < w; x += 2) b.vline(x, faceY, faceH, roof.faceDark);
  }
  dentil(b, faceY + faceH, w, roof.faceDark, O);
  b.hline(0, faceY + faceH + 1, w, O);
  b.vline(0, 0, faceY + faceH + 2, O);
  b.vline(w - 1, 0, faceY + faceH + 2, O);

  // --- wall, inset so the roof overhangs ---
  const wall = o.wall ?? WALLS.green;
  const wx = 2, ww = w - 4;
  b.fill(wx, wallY, ww, h - wallY, wall.base);
  b.rect(wx, wallY, ww, h - wallY, O);
  b.hline(wx + 1, wallY + 1, ww - 2, wall.light);
  b.hline(wx + 1, h - 2, ww - 2, wall.dark);
  if (o.wallPattern === 'brick') {
    for (let y = wallY + 3; y < h - 2; y += 4) {
      b.hline(wx + 1, y, ww - 2, wall.dark);
      const off = ((y - wallY) / 4) % 2 ? 0 : 4;
      for (let x = wx + 1 + off; x < wx + ww - 1; x += 8) b.vline(x, y - 3, 3, wall.dark);
    }
  } else if (o.wallPattern === 'bands') {
    for (let y = wallY + 4; y < h - 2; y += 6) {
      b.hline(wx + 1, y, ww - 2, wall.dark);
      b.hline(wx + 1, y + 1, ww - 2, wall.light);
    }
  }

  // --- wall furniture: door, flanking posts, then windows in what is left ---
  const wallTop = wallY + 3;
  const wallBot = h - 1;
  const wallH = wallBot - wallTop;
  plankDoor(b, doorX, h - 21, 16, 21);
  post(b, doorX - 5, wallTop, 4, wallH);
  post(b, doorX + 16 + 1, wallTop, 4, wallH);

  // Fill each side of the door: a multi-pane window where there is room,
  // otherwise a louver. Wide gaps also get a louver at the far edge so the
  // wall stays as busy as the reference houses.
  const fillSide = (x0, x1) => {
    let a = x0, bx = x1;
    if (bx - a >= 32) {
      louver(b, a, wallTop + 1, 6, wallH - 3);
      a += 8;
      post(b, a, wallTop, 3, wallH);
      a += 4;
    }
    const avail = bx - a;
    if (avail >= 16) {
      const ww2 = Math.min(26, avail - 1);
      paneWindow(b, a + Math.floor((avail - ww2) / 2), wallTop + 2, ww2, wallH - 7);
    } else if (avail >= 8) {
      louver(b, a + Math.floor((avail - 6) / 2), wallTop + 1, 6, wallH - 3);
    }
  };
  fillSide(wx + 2, doorX - 6);
  fillSide(doorX + 21, wx + ww - 2);

  // --- distinguishing features, deliberately off-centre ---
  if (feature === 'dormer') {
    // A short gabled dormer near the ridge, not a full-height panel.
    const dh = 22;
    const dx = 6;
    b.fill(dx, 0, 18, dh, PAL.postMid);
    b.rect(dx, 0, 18, dh, O);
    b.hline(dx + 1, 1, 16, PAL.postLight);
    b.fill(dx + 3, 4, 12, 12, PAL.frameWhite);
    b.rect(dx + 3, 4, 12, 12, PAL.woodDeep);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      b.fill(dx + 4 + i * 4, 5 + j * 4, 3, 3, PAL.paneMid);
    }
    b.fill(dx - 1, dh - 4, 20, 4, PAL.postDark);
    b.rect(dx - 1, dh - 4, 20, 4, O);
  }
  if (feature === 'dish') {
    const cx = w - 24;
    b.fill(cx + 6, 3, 2, 9, PAL.metalDark);
    b.fill(cx, 0, 15, 7, PAL.metal);
    b.rect(cx, 0, 15, 7, O);
    b.fill(cx + 2, 1, 11, 3, PAL.wallLight);
    b.fill(cx + 4, 11, 5, 3, PAL.greyDark);
  }
  if (feature === 'vent') {
    // Roof vent stack, offset toward one end.
    const vx = 10;
    b.fill(vx, 2, 12, 14, PAL.metal);
    b.rect(vx, 2, 12, 14, O);
    b.fill(vx + 1, 3, 10, 3, PAL.frameWhite);
    for (let y = 8; y < 15; y += 3) b.hline(vx + 1, y, 10, PAL.metalDark);
  }

  // --- roof sign naming the building ---
  if (o.sign) {
    const natural = signPlateSize(o.sign);
    const sy = faceY + faceH - natural.h - 4;
    // Reserve the horizontal span a left-hand roof feature occupies, then fit
    // the board into what is left with a guaranteed gap, shrinking if needed.
    const featureRight = feature === 'dormer' ? 26 : feature === 'vent' ? 23 : 0;
    if (featureRight) {
      const gap = 5;
      const avail = w - featureRight - gap - 4;
      const sw = Math.max(o.sign.width + 12, Math.min(natural.w, avail));
      signPlate(b, featureRight + gap + sw / 2, sy, o.sign, sw);
    } else {
      signPlate(b, w / 2, sy, o.sign);
    }
  }
  if (feature === 'awning') {
    const ay = wallY + 1;
    for (let x = wx + 1; x < wx + ww - 1; x++) {
      b.vline(x, ay, 5, Math.floor((x - wx) / 5) % 2 === 0 ? PAL.roofRed : PAL.frameWhite);
    }
    b.hline(wx + 1, ay + 5, ww - 2, O);
  }
  if (feature === 'banner') {
    const bx = Math.floor(w / 2) - 15;
    b.fill(bx, faceY + 4, 30, 12, PAL.greyDeep);
    b.rect(bx, faceY + 4, 30, 12, O);
    b.fill(bx + 2, faceY + 6, 26, 8, PAL.roofRed);
    b.fill(bx + 4, faceY + 8, 22, 4, PAL.postLight);
  }

  return b;
}

/**
 * Gym grammar, traced from the Pokémon Gym on the Buildings sheet: a wide flat
 * roof slab with fine HORIZONTAL ribbing inside a metal frame, gold corner
 * posts, then a silver panelled facade split into three bays with a protruding
 * entrance block and recessed glass doors.
 *
 * The horizontal ribbing is deliberate — it is the clearest way to make this
 * building read as a different structure from the vertically-ribbed houses.
 */
function gymSprite(o) {
  const { w, h, doorX, roof } = o;
  const b = new Bitmap(w, h);
  const roofBot = Math.round(h * 0.50);
  const frame = PAL.wallMid, frameLight = PAL.wall, frameDark = PAL.greyDark;

  // --- roof slab in a metal frame ---
  b.fill(0, 0, w, roofBot, frame);
  b.rect(0, 0, w, roofBot, O);
  b.hline(1, 1, w - 2, frameLight);
  const ix = 3, iy = 3, iw = w - 6, ih = roofBot - 8;
  b.fill(ix, iy, iw, ih, roof.face);
  for (let y = iy + 2; y < iy + ih; y += 2) b.hline(ix, y, iw, roof.faceDark);
  b.rect(ix, iy, iw, ih, roof.faceDark);
  b.hline(ix + 1, iy, iw - 2, roof.ridge);
  b.vline(ix, iy + 1, ih - 2, roof.ridge);

  // gold corner posts where the slab meets the facade
  for (const px of [1, w - 6]) {
    b.fill(px, roofBot - 9, 5, 9, roof.face);
    b.rect(px, roofBot - 9, 5, 9, O);
    b.vline(px + 1, roofBot - 8, 7, roof.ridge);
  }
  b.fill(0, roofBot - 4, w, 4, frame);
  b.hline(0, roofBot - 4, w, frameLight);
  b.hline(0, roofBot - 1, w, frameDark);

  // --- silver facade ---
  const wallY = roofBot;
  b.fill(0, wallY, w, h - wallY, PAL.frameDark);
  b.rect(0, wallY, w, h - wallY, O);
  b.hline(1, wallY + 1, w - 2, PAL.frameWhite);
  b.hline(1, h - 2, w - 2, PAL.frameShade);

  const ex = doorX - 8, ew = 32;   // entrance block bounds

  // Side bays: a row of glazed panels above a recessed band.
  const bay = (x0, x1) => {
    const width = x1 - x0;
    if (width < 14) return;
    b.fill(x0, wallY + 2, width, h - wallY - 4, PAL.frameMid);
    b.rect(x0, wallY + 2, width, h - wallY - 4, PAL.frameShade);
    b.hline(x0 + 1, wallY + 3, width - 2, PAL.frameWhite);
    const count = Math.max(1, Math.floor((width - 3) / 9));
    const pad = Math.floor((width - count * 9) / 2);
    for (let i = 0; i < count; i++) {
      const px = x0 + pad + i * 9;
      b.fill(px, wallY + 5, 8, 10, PAL.paneMid);
      b.rect(px, wallY + 5, 8, 10, PAL.greyDark);
      b.fill(px + 1, wallY + 6, 6, 4, PAL.paneLight);
      b.hline(px, wallY + 14, 8, PAL.frameWhite);
    }
    // recessed lower band with slot vents
    const by = wallY + 18;
    b.fill(x0 + 2, by, width - 4, h - by - 4, PAL.frameShade);
    b.hline(x0 + 2, by, width - 4, PAL.greyDark);
    for (let i = 0; i < count; i++) {
      const px = x0 + pad + i * 9 + 1;
      b.fill(px, by + 4, 6, 3, PAL.paneDark);
      b.hline(px, by + 4, 6, PAL.paneMid);
    }
  };
  bay(2, ex - 2);
  bay(ex + ew + 2, w - 2);

  // --- entrance block, protruding above and below the facade line ---
  b.fill(ex, wallY - 8, ew, h - wallY + 8, PAL.frameWhite);
  b.rect(ex, wallY - 8, ew, h - wallY + 8, O);
  b.fill(ex + 2, wallY - 6, ew - 4, 10, roof.face);           // gold header band
  b.rect(ex + 2, wallY - 6, ew - 4, 10, roof.faceDark);
  b.hline(ex + 3, wallY - 5, ew - 6, roof.ridge);
  b.hline(ex + 1, wallY + 6, ew - 2, PAL.frameShade);

  // recessed glass doors flanked by red trim
  const dy = h - 22;
  b.fill(doorX - 4, dy, 24, 22, PAL.frameMid);
  b.rect(doorX - 4, dy, 24, 22, O);
  b.fill(doorX - 3, dy + 1, 3, 20, PAL.roofRed);
  b.fill(doorX + 16, dy + 1, 3, 20, PAL.roofRed);
  b.fill(doorX, dy + 2, 16, 20, PAL.paneMid);
  b.rect(doorX, dy + 2, 16, 20, PAL.greyDark);
  b.fill(doorX + 1, dy + 3, 14, 7, PAL.paneLight);
  b.vline(doorX + 8, dy + 3, 18, PAL.frameWhite);
  b.hline(doorX, h - 1, 16, O);

  // --- sign across the roof slab ---
  if (o.sign) signPlate(b, w / 2, iy + Math.floor(ih / 2) - 8, o.sign);

  return b;
}

export function buildingSprite(o) {
  return o.style === 'gym' ? gymSprite(o) : houseSprite(o);
}

export const BUILDINGS = {
  'building-work': {
    style: 'gym', w: 96, h: 80, doorX: 40, roof: ROOFS.gold, label: 'WORK',
  },
  'building-projects': {
    style: 'house', w: 96, h: 68, doorX: 40, roof: ROOFS.blue, ribs: 'h',
    wall: WALLS.slate, wallPattern: 'bands', feature: 'dish', label: 'PROJECTS',
  },
  'building-about': {
    style: 'house', w: 80, h: 64, doorX: 32, roof: ROOFS.green, ribs: 'v',
    wall: WALLS.green, feature: 'dormer', label: 'ABOUT',
  },
  'building-contact': {
    style: 'house', w: 96, h: 64, doorX: 40, roof: ROOFS.red, ribs: 'v',
    wall: WALLS.cream, wallPattern: 'brick', feature: 'vent', label: 'CONTACT',
  },
};

// ---------------------------------------------------------------------------
// Outdoor props
// ---------------------------------------------------------------------------

function blob(b, cx, cy, rx, ry, col) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) b.set(cx + x, cy + y, col);
    }
  }
}

export function treeSprite() {
  const b = new Bitmap(32, 40);

  // Trunk first, so foliage overlaps its top.
  b.fill(12, 26, 8, 12, PAL.trunk);
  b.fill(12, 26, 2, 12, PAL.trunkLight);
  b.fill(18, 26, 2, 12, PAL.trunkDeep);
  b.rect(12, 26, 8, 12, PAL.trunkDark);
  b.hline(11, 37, 10, PAL.trunkDeep);

  // Canopy built from overlapping lobes rather than one ellipse, so the
  // silhouette is irregular the way FireRed's trees are.
  const lobes = [[10, 12, 8, 7], [22, 13, 8, 7], [16, 9, 8, 6], [8, 20, 7, 6], [24, 20, 7, 6], [16, 19, 10, 8]];
  for (const [cx, cy, rx, ry] of lobes) blob(b, cx, cy, rx, ry, PAL.treeBody);

  // Shade the lower-right of each lobe, highlight the upper-left.
  for (const [cx, cy, rx, ry] of lobes) blob(b, cx + 1, cy + 2, rx - 2, ry - 2, PAL.treeDark);
  for (const [cx, cy, rx, ry] of lobes) blob(b, cx - 1, cy - 1, rx - 3, ry - 3, PAL.treeMid);
  for (const [cx, cy] of [[9, 10], [21, 11], [15, 7], [7, 18]]) blob(b, cx, cy, 2, 2, PAL.treeLight);

  // Trace the top arc of each lower lobe so the clumps separate visibly.
  // Straight crease lines read as a drawn cross; arcs read as foliage.
  for (const [cx, cy, rx, ry] of [lobes[3], lobes[4], lobes[5]]) {
    for (let x = -rx; x <= rx; x++) {
      const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx))));
      const px = cx + x, py = cy - dy;
      if (b.get(px, py)[3] !== 0) b.set(px, py, PAL.treeDeep);
    }
  }

  // Hard outline on the silhouette only.
  const snapshot = b.sub(0, 0, 32, 40);
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < 26; y++) {
      if (snapshot.get(x, y)[3] === 0) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => snapshot.get(x + dx, y + dy)[3] === 0);
      if (edge) b.put(x, y, PAL.treeShadow);
    }
  }
  return b;
}

export function bushSprite() {
  const b = new Bitmap(16, 16);
  blob(b, 8, 9, 7, 6, PAL.treeDeep);
  blob(b, 8, 9, 6, 5, PAL.treeBody);
  blob(b, 6, 7, 3, 2, PAL.treeMid);
  blob(b, 6, 6, 2, 1, PAL.treeLight);
  return b;
}

export function signSprite() {
  const b = new Bitmap(16, 24);
  b.fill(6, 15, 4, 9, PAL.trunkDark);
  b.fill(6, 15, 1, 9, PAL.trunk);
  b.fill(1, 3, 14, 13, PAL.postMid);
  b.rect(1, 3, 14, 13, O);
  b.hline(2, 4, 12, PAL.postLight);
  b.fill(3, 6, 10, 8, PAL.postDark);
  for (let y = 7; y < 13; y += 2) b.hline(4, y, 8, PAL.postLight);
  return b;
}

export function fenceSprite() {
  const b = new Bitmap(16, 16);
  // Two rails spanning the full tile so neighbours join seamlessly...
  for (const y of [5, 10]) {
    b.hline(0, y, 16, PAL.postLight);
    b.hline(0, y + 1, 16, PAL.postMid);
    b.hline(0, y + 2, 16, PAL.postDark);
  }
  // ...and a single slim post per tile.
  b.fill(6, 2, 3, 14, PAL.postMid);
  b.vline(6, 2, 14, PAL.postLight);
  b.vline(8, 2, 14, PAL.postDark);
  b.hline(6, 2, 3, PAL.postLight);
  b.hline(6, 15, 3, PAL.trunkDeep);
  return b;
}

export function rockSprite() {
  const b = new Bitmap(16, 16);
  blob(b, 8, 10, 6, 5, PAL.greyDeep);
  blob(b, 8, 10, 5, 4, PAL.greyDark);
  // Flat facets rather than a smooth blob.
  b.fill(4, 7, 5, 4, PAL.grey);
  b.fill(9, 9, 3, 3, PAL.greyDark);
  b.fill(5, 6, 3, 2, PAL.wallLight);
  b.hline(4, 12, 8, PAL.greyDeep);
  b.hline(4, 14, 8, PAL.greyDeep);
  return b;
}

export function mailboxSprite() {
  const b = new Bitmap(16, 24);
  b.fill(6, 13, 4, 11, PAL.greyDark);
  b.vline(6, 13, 11, PAL.grey);
  b.fill(2, 4, 12, 10, PAL.roofBlue);
  b.rect(2, 4, 12, 10, O);
  b.fill(3, 5, 10, 3, PAL.roofBlueLight);
  b.fill(4, 9, 8, 3, PAL.frameWhite);
  b.fill(3, 10, 2, 1, PAL.frameShade);
  b.fill(13, 6, 2, 6, PAL.roofRed);
  return b;
}

/** Street lamp — a bit of town furniture to break up open ground. */
export function lampSprite() {
  const b = new Bitmap(16, 32);
  b.fill(7, 10, 3, 22, PAL.greyDark);
  b.vline(7, 10, 22, PAL.grey);
  b.fill(5, 29, 7, 3, PAL.greyDeep);
  b.fill(4, 2, 9, 9, PAL.metal);
  b.rect(4, 2, 9, 9, O);
  b.fill(5, 3, 7, 6, PAL.window);
  b.fill(6, 4, 3, 3, PAL.cream);
  b.fill(3, 1, 11, 2, PAL.greyDeep);
  return b;
}

// ---------------------------------------------------------------------------
// Interior furniture
// ---------------------------------------------------------------------------

function panel(b, x, y, w, h, main, light, dark) {
  b.fill(x, y, w, h, main);
  b.rect(x, y, w, h, O);
  b.hline(x + 1, y + 1, w - 2, light);
  b.vline(x + 1, y + 1, h - 2, light);
  b.vline(x + w - 2, y + 1, h - 2, dark);
  b.hline(x + 1, y + h - 2, w - 2, dark);
}

export function pcSprite() {
  const b = new Bitmap(16, 24);
  panel(b, 1, 13, 14, 11, PAL.metalDark, PAL.metal, PAL.greyDeep);
  panel(b, 1, 1, 14, 12, PAL.metal, PAL.frameDark, PAL.metalDark);
  b.fill(3, 3, 10, 8, PAL.screenDark);
  b.fill(3, 3, 10, 3, PAL.screen);
  b.hline(4, 7, 7, PAL.screen);
  b.hline(4, 9, 5, PAL.screen);
  b.fill(4, 16, 8, 3, PAL.frameDark);
  for (let x = 5; x < 12; x += 2) b.vline(x, 17, 2, PAL.metalDark);
  b.fill(4, 21, 3, 2, PAL.greyDeep);
  return b;
}

export function bookshelfSprite() {
  const b = new Bitmap(16, 32);
  panel(b, 0, 0, 16, 32, PAL.wood, PAL.trunkLight, PAL.woodDeep);
  for (let s = 0; s < 3; s++) {
    const y = 3 + s * 10;
    b.fill(2, y, 12, 8, PAL.woodDeep);
    const cols = [PAL.roofRed, PAL.roofBlue, PAL.npcShirtB, PAL.npcShirtA, PAL.screen, PAL.paneMid];
    for (let i = 0; i < 6; i++) {
      const c = cols[(s * 5 + i) % cols.length];
      const top = y + 1 + (i % 2);
      b.fill(2 + i * 2, top, 2, y + 8 - top, c);
      b.vline(2 + i * 2, top, y + 8 - top, PAL.frameWhite);
    }
    b.hline(1, y + 8, 14, PAL.trunkLight);
  }
  return b;
}

export function tableSprite() {
  const b = new Bitmap(32, 24);
  panel(b, 0, 4, 32, 11, PAL.wood, PAL.trunkLight, PAL.woodDeep);
  b.fill(3, 15, 3, 9, PAL.woodDark);
  b.fill(26, 15, 3, 9, PAL.woodDark);
  b.vline(3, 15, 9, PAL.trunk);
  b.vline(26, 15, 9, PAL.trunk);
  b.hline(2, 6, 28, PAL.trunkLight);
  return b;
}

export function bedSprite() {
  const b = new Bitmap(16, 32);
  panel(b, 0, 0, 16, 32, PAL.wood, PAL.trunkLight, PAL.woodDeep);
  b.fill(1, 1, 14, 10, PAL.frameWhite);
  b.fill(3, 2, 10, 8, PAL.frameDark);
  b.rect(3, 2, 10, 8, PAL.frameShade);
  b.fill(1, 11, 14, 20, PAL.carpetRed);
  b.hline(1, 11, 14, PAL.roofRedLight);
  for (let y = 15; y < 30; y += 4) b.hline(2, y, 12, PAL.carpetRedDark);
  b.hline(1, 30, 14, PAL.carpetRedDark);
  return b;
}

export function tvSprite() {
  const b = new Bitmap(24, 20);
  panel(b, 0, 0, 24, 16, PAL.metalDark, PAL.metal, PAL.greyDeep);
  b.fill(3, 2, 18, 11, PAL.screenDark);
  b.fill(3, 2, 18, 4, PAL.screen);
  b.fill(6, 8, 12, 2, PAL.screen);
  b.fill(20, 3, 2, 2, PAL.roofRed);
  b.fill(8, 16, 8, 4, PAL.greyDeep);
  b.hline(7, 19, 10, PAL.greyDark);
  return b;
}

export function trophyCaseSprite() {
  const b = new Bitmap(32, 32);
  panel(b, 0, 0, 32, 32, PAL.wood, PAL.trunkLight, PAL.woodDeep);
  b.fill(2, 2, 28, 28, PAL.paneMid);
  b.rect(2, 2, 28, 28, PAL.woodDeep);
  b.hline(2, 16, 28, PAL.trunkLight);
  for (const [x, y] of [[6, 6], [15, 6], [23, 6]]) {
    b.fill(x, y, 5, 5, PAL.npcShirtA);
    b.fill(x + 1, y + 5, 3, 2, PAL.npcShirtADark);
    b.fill(x - 1, y + 7, 7, 2, PAL.npcShirtADark);
    b.vline(x, y, 5, PAL.postLight);
  }
  for (const [x, y] of [[7, 20], [19, 20]]) {
    b.fill(x, y, 7, 7, PAL.metal);
    b.rect(x, y, 7, 7, PAL.metalDark);
    b.fill(x + 2, y + 2, 3, 3, PAL.frameWhite);
  }
  b.fill(3, 3, 10, 3, PAL.frameWhite);
  b.fill(3, 17, 8, 2, PAL.frameWhite);
  return b;
}

export function counterSprite() {
  const b = new Bitmap(48, 24);
  panel(b, 0, 3, 48, 14, PAL.wood, PAL.trunkLight, PAL.woodDeep);
  b.fill(1, 4, 46, 4, PAL.postMid);
  b.hline(1, 4, 46, PAL.postLight);
  b.fill(0, 17, 48, 5, PAL.woodDark);
  b.hline(0, 17, 48, PAL.trunk);
  for (let x = 5; x < 44; x += 9) {
    b.fill(x, 9, 5, 7, PAL.woodDeep);
    b.vline(x, 9, 7, PAL.trunk);
  }
  return b;
}

export function plantSprite() {
  const b = new Bitmap(16, 24);
  b.fill(3, 16, 10, 8, PAL.frameDark);
  b.rect(3, 16, 10, 8, O);
  b.fill(3, 16, 10, 2, PAL.frameWhite);
  b.fill(4, 22, 8, 2, PAL.frameShade);
  blob(b, 8, 10, 6, 7, PAL.treeDeep);
  blob(b, 8, 10, 5, 6, PAL.treeBody);
  blob(b, 6, 7, 3, 3, PAL.treeMid);
  blob(b, 6, 6, 1, 1, PAL.treeLight);
  b.vline(8, 14, 3, PAL.treeDeep);
  return b;
}

export function frameSprite(kind) {
  const b = new Bitmap(16, 16);
  panel(b, 0, 0, 16, 16, PAL.wood, PAL.trunkLight, PAL.woodDeep);
  b.fill(2, 2, 12, 12, kind === 'photo' ? PAL.paneLight : PAL.frameWhite);
  b.rect(2, 2, 12, 12, PAL.woodDeep);
  if (kind === 'photo') {
    b.fill(5, 6, 6, 5, PAL.skin);
    b.fill(5, 4, 6, 3, PAL.hair);
    b.fill(4, 11, 8, 3, PAL.shirt);
    b.fill(6, 7, 1, 1, PAL.eye);
    b.fill(9, 7, 1, 1, PAL.eye);
  } else {
    for (let y = 4; y < 11; y += 2) b.hline(4, y, 8, PAL.frameShade);
    b.fill(9, 9, 4, 4, PAL.roofRed);
    b.fill(10, 12, 2, 2, PAL.roofRedDark);
  }
  return b;
}

export function labMachineSprite() {
  const b = new Bitmap(32, 32);
  panel(b, 0, 4, 32, 28, PAL.metal, PAL.frameWhite, PAL.metalDark);
  b.fill(3, 8, 26, 11, PAL.screenDark);
  b.fill(3, 8, 26, 4, PAL.screen);
  for (let x = 5; x < 28; x += 4) b.vline(x, 13, 5, PAL.screen);
  for (let i = 0; i < 5; i++) {
    b.fill(4 + i * 5, 22, 4, 4, i % 2 ? PAL.roofRed : PAL.npcShirtB);
    b.set(4 + i * 5, 22, PAL.frameWhite);
  }
  b.fill(6, 0, 20, 5, PAL.metalDark);
  b.rect(6, 0, 20, 5, O);
  b.fill(8, 1, 16, 2, PAL.grey);
  return b;
}

export function platformSprite() {
  const b = new Bitmap(32, 16);
  b.fill(0, 2, 32, 11, PAL.roofBlue);
  b.rect(0, 2, 32, 11, O);
  b.hline(1, 3, 30, PAL.roofBlueLight);
  b.fill(0, 12, 32, 3, PAL.roofBlueDark);
  b.hline(0, 15, 32, O);
  for (let x = 3; x < 30; x += 6) {
    b.fill(x, 6, 3, 4, PAL.roofBlueDark);
    b.set(x, 6, PAL.paneLight);
  }
  return b;
}

export function rugSprite() {
  const b = new Bitmap(32, 24);
  // Warm woven rug: a bright blue slab reads as a swimming pool on a wood floor.
  b.fill(0, 0, 32, 24, PAL.postDark);
  b.rect(0, 0, 32, 24, PAL.woodDeep);
  b.rect(2, 2, 28, 20, PAL.postLight);
  b.fill(4, 4, 24, 16, PAL.carpetRed);
  for (let y = 6; y < 19; y += 4) b.hline(5, y, 22, PAL.carpetRedDark);
  b.fill(13, 9, 6, 6, PAL.postMid);
  return b;
}
