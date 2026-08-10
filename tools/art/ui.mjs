// UI chrome, transition masks, touch controls and misc runtime sprites.
import { Bitmap } from '../pixel.mjs';
import { PAL } from './palette.mjs';

const O = PAL.outline;

/**
 * 9-slice source for the FireRed window frame: white field inside a layered
 * blue border with clipped corners. Corner size 6, middle 6 -> 18x18 source.
 */
export function windowFrame(accent = PAL.uiBorder, accentLight = PAL.uiBorderLight) {
  const S = 18;
  const b = new Bitmap(S, S);
  b.fill(0, 0, S, S, PAL.uiBg);
  b.rect(0, 0, S, S, PAL.uiBorderDark);
  b.rect(1, 1, S - 2, S - 2, accent);
  b.rect(2, 2, S - 4, S - 4, accent);
  b.rect(3, 3, S - 6, S - 6, accentLight);
  // clip the four corners so the frame reads as rounded
  for (const [cx, cy] of [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]]) {
    b.put(cx, cy, [0, 0, 0, 0]);
    const ix = cx === 0 ? 1 : S - 2;
    const iy = cy === 0 ? 1 : S - 2;
    b.put(ix, cy, PAL.uiBorderDark);
    b.put(cx, iy, PAL.uiBorderDark);
    b.put(ix, iy, accent);
  }
  return b;
}

export function cursorSprite() {
  const b = new Bitmap(8, 8);
  const rows = ['.#......', '.##.....', '.###....', '.####...', '.###....', '.##.....', '.#......', '........'];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') b.put(x, y, PAL.uiAccent);
  });
  // outline pass
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (b.get(x, y)[3] !== 0) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.get(x + dx, y + dy)[3] !== 0 &&
      b.get(x + dx, y + dy)[0] === PAL.uiAccent[0]);
    if (near) b.put(x, y, O);
  }
  return b;
}

export function advanceArrow() {
  const b = new Bitmap(8, 6);
  const rows = ['#######.', '.#####..', '..###...', '...#....'];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') b.put(x, y + 1, PAL.uiBorder);
  });
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#' && y === 0) b.put(x, y, PAL.uiBorderDark);
  });
  return b;
}

export function hintIcon() {
  const b = new Bitmap(8, 10);
  b.fill(2, 0, 4, 10, O);
  b.fill(3, 1, 2, 5, PAL.white);
  b.fill(3, 7, 2, 2, PAL.white);
  b.fill(3, 1, 2, 4, PAL.npcShirtA);
  b.fill(3, 7, 2, 2, PAL.npcShirtA);
  return b;
}

/**
 * The corner button that opens the pause menu. Built to the same construction
 * as the window frame — dark outline, blue border, white field — so it reads
 * as part of the same UI rather than a browser control sitting on top of it.
 */
export function menuButton() {
  // 16, not 14: the border eats two pixels a side, leaving a 12px field. Three
  // 2px bars separated by 1px need 8, so an even 2px of padding survives on
  // every side. At 14 the field is only 10 and the bottom bar ends up flush
  // against the frame.
  const S = 16;
  const INSET = 2;
  const b = new Bitmap(S, S);
  b.fill(0, 0, S, S, PAL.uiBg);
  b.rect(0, 0, S, S, PAL.uiBorderDark);
  b.rect(1, 1, S - 2, S - 2, PAL.uiBorder);
  // Clip the corners to match windowFrame's rounding.
  for (const [cx, cy] of [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]]) {
    b.put(cx, cy, [0, 0, 0, 0]);
    b.put(cx === 0 ? 1 : S - 2, cy, PAL.uiBorderDark);
    b.put(cx, cy === 0 ? 1 : S - 2, PAL.uiBorderDark);
  }
  // Three bars, inset equally from the inner field on all four sides.
  const x0 = 2 + INSET;
  const y0 = 2 + INSET;
  for (let i = 0; i < 3; i++) b.fill(x0, y0 + i * 3, S - x0 * 2, 2, PAL.uiText);
  return b;
}

export function reticleSprite(frame) {
  const b = new Bitmap(16, 16);
  const inset = frame === 0 ? 1 : 2;
  const len = 4;
  const col = frame === 0 ? PAL.white : PAL.uiAccent;
  const corners = [[inset, inset, 1, 1], [15 - inset, inset, -1, 1], [inset, 15 - inset, 1, -1], [15 - inset, 15 - inset, -1, -1]];
  for (const [x, y, dx, dy] of corners) {
    for (let i = 0; i < len; i++) { b.put(x + dx * i, y, col); b.put(x, y + dy * i, col); }
  }
  return b;
}

export function shadowSprite() {
  const b = new Bitmap(16, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const nx = (x - 7.5) / 7, ny = (y - 3.5) / 3.5;
    if (nx * nx + ny * ny <= 1) b.put(x, y, [0, 0, 0, 90]);
  }
  return b;
}

/** Loading spinner: eight dots orbiting, the lead dot brightest. 8 frames of 16x16. */
export function ringSpinner() {
  const F = 8, S = 16, DOTS = 8;
  const sheet = new Bitmap(S * F, S);
  for (let f = 0; f < F; f++) {
    for (let d = 0; d < DOTS; d++) {
      const a = ((d - f + DOTS) % DOTS) / DOTS;          // 0 = lead dot
      const ang = (d / DOTS) * Math.PI * 2 - Math.PI / 2;
      const cx = 7.5 + Math.cos(ang) * 5.5;
      const cy = 7.5 + Math.sin(ang) * 5.5;
      const col = a < 0.15 ? PAL.white : a < 0.4 ? PAL.uiBorderLight : a < 0.7 ? PAL.uiBorder : PAL.uiBorderDark;
      const r = a < 0.15 ? 2 : 1.6;
      for (let y = -3; y <= 3; y++) {
        for (let x = -3; x <= 3; x++) {
          if (Math.sqrt(x * x + y * y) > r) continue;
          sheet.put(f * S + Math.round(cx) + x, Math.round(cy) + y, col);
        }
      }
    }
  }
  return sheet;
}

/** Title-screen emblem: a town signpost. */
export function titleEmblem() {
  const W = 56, H = 48;
  const b = new Bitmap(W, H);
  b.fill(25, 26, 6, 22, PAL.woodDark);
  b.vline(25, 26, 22, PAL.wood);
  b.vline(30, 26, 22, PAL.woodDeep);
  b.fill(20, 45, 16, 3, PAL.treeDeep);

  b.fill(2, 4, 52, 24, PAL.postMid);
  b.rect(2, 4, 52, 24, O);
  b.hline(3, 5, 50, PAL.postLight);
  b.hline(3, 26, 50, PAL.postDark);
  b.fill(5, 8, 46, 17, PAL.postDark);
  b.rect(5, 8, 46, 17, PAL.woodDeep);
  // Three engraved lines standing in for the town's name.
  for (let i = 0; i < 3; i++) {
    const wdt = [34, 40, 26][i];
    b.fill(9, 11 + i * 5, wdt, 2, PAL.postLight);
    b.fill(9, 13 + i * 5, wdt, 1, PAL.woodDeep);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Transition masks. Greyscale: the shader blackens every pixel whose mask
// value is below `cutoff`, so low values disappear first.
// ---------------------------------------------------------------------------

export function maskCircle(size = 128) {
  const b = new Bitmap(size, size);
  const c = (size - 1) / 2;
  const max = Math.sqrt(2) * c;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2) / max;
      const v = Math.max(0, Math.min(255, Math.round((1 - d) * 255)));
      b.put(x, y, [v, v, v, 255]); // edges vanish first -> iris closes inward
    }
  }
  return b;
}

export function maskBlinds(size = 128, bands = 8) {
  const b = new Bitmap(size, size);
  const bandH = size / bands;
  for (let y = 0; y < size; y++) {
    const t = (y % bandH) / bandH;
    const v = Math.round(t * 255);
    for (let x = 0; x < size; x++) b.put(x, y, [v, v, v, 255]);
  }
  return b;
}

export function maskDiagonal(size = 128) {
  const b = new Bitmap(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(((x + y) / (size * 2 - 2)) * 255);
      b.put(x, y, [v, v, v, 255]);
    }
  }
  return b;
}

