#!/usr/bin/env node
/**
 * Build-time assertions that catch a whole class of silent bugs:
 *
 *  1. Every shipped PNG uses binary alpha and 15-bit-aligned colour, so nothing
 *     can sneak in a soft edge or an off-grid shade that breaks the GBA look.
 *  2. Every character in every content string exists in the bitmap font. A
 *     missing glyph renders as nothing at all, which is invisible in review.
 *  3. Every contentId referenced by a map object resolves to a dialogue node,
 *     so no interactable can be silently dead.
 *
 * Run: npm run validate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { decodePNG } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');

const errors = [];
const warnings = [];

// ---------------------------------------------------------------------------
// 1. PNG discipline
// ---------------------------------------------------------------------------
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.png')) out.push(p);
  }
  return out;
}

let pngCount = 0;
for (const file of walk(ASSETS)) {
  const rel = path.relative(ROOT, file);
  const { width, height, data } = decodePNG(fs.readFileSync(file));
  pngCount++;
  const badAlpha = new Set();
  const badColour = new Set();
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3];
    if (a !== 0 && a !== 255) badAlpha.add(a);
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) {
      const v = data[i * 4 + c];
      if (v % 8 !== 0) badColour.add(v);
    }
  }
  // The touch controls are deliberately translucent overlays, not pixel art.
  const translucentOk = /ui\/(dpad|btn-)/.test(rel);
  if (badAlpha.size && !translucentOk) {
    errors.push(`${rel}: ${badAlpha.size} partial alpha value(s), e.g. ${[...badAlpha][0]}`);
  }
  if (badColour.size) {
    errors.push(`${rel}: ${badColour.size} colour channel(s) off the 15-bit grid, e.g. ${[...badColour][0]}`);
  }
}

// ---------------------------------------------------------------------------
// 2 + 3. Content
// ---------------------------------------------------------------------------
const out = await build({
  entryPoints: [path.join(ROOT, 'src/data/content.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
);

const glyphs = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/glyphs.json'), 'utf8')).glyphs
);

let stringCount = 0;
let longest = { len: 0, text: '' };
function checkString(where, s) {
  stringCount++;
  if (s.length > longest.len) longest = { len: s.length, text: s };
  const missing = [...new Set([...s].filter((ch) => !glyphs.has(ch)))];
  if (missing.length) {
    errors.push(`${where}: unrenderable character(s) ${JSON.stringify(missing.join(''))} in "${s}"`);
  }
  if (s.length > 58) {
    warnings.push(`${where}: ${s.length} chars (will paginate) - "${s.slice(0, 50)}..."`);
  }
}

for (const [id, node] of Object.entries(mod.CONTENT)) {
  if (node.title) checkString(`CONTENT.${id}.title`, node.title);
  node.pages.forEach((p, i) => checkString(`CONTENT.${id}.pages[${i}]`, p));
  node.firstTimeOnly?.forEach((p, i) => checkString(`CONTENT.${id}.firstTimeOnly[${i}]`, p));
  node.choices?.forEach((c, i) => checkString(`CONTENT.${id}.choices[${i}]`, c.label));
}
mod.WORK.forEach((r, i) => {
  checkString(`WORK[${i}].company`, r.company);
  checkString(`WORK[${i}].title`, r.title);
  r.bullets.forEach((b, j) => checkString(`WORK[${i}].bullets[${j}]`, b));
});
mod.PROJECTS.forEach((p, i) => {
  checkString(`PROJECTS[${i}].name`, p.name);
  checkString(`PROJECTS[${i}].pitch`, p.pitch);
  checkString(`PROJECTS[${i}].description`, p.description);
});

// Every interactable and NPC must point at a real dialogue node.
const mapDir = path.join(ASSETS, 'maps');
let refCount = 0;
for (const f of fs.readdirSync(mapDir).filter((f) => f.endsWith('.objects.json'))) {
  const { name, objects } = JSON.parse(fs.readFileSync(path.join(mapDir, f), 'utf8'));
  for (const o of objects) {
    if (o.type !== 'interactable' && o.type !== 'npc') continue;
    refCount++;
    if (!mod.CONTENT[o.contentId]) {
      errors.push(`${name}: object "${o.id}" references missing content id "${o.contentId}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`\nValidated ${pngCount} PNGs, ${stringCount} content strings, ${refCount} map references.`);
console.log(`Longest string: ${longest.len} chars.\n`);

for (const w of warnings) console.log(`  warn  ${w}`);
if (warnings.length) console.log('');
for (const e of errors) console.error(`  FAIL  ${e}`);

if (errors.length) {
  console.error(`\n${errors.length} error(s).\n`);
  process.exit(1);
}
console.log('  All checks passed.\n');
