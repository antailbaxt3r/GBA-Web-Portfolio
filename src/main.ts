import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Title } from './scenes/Title';
import { World } from './scenes/World';
import { UIScene } from './scenes/UIScene';
import { VIEW_W, VIEW_H } from './data/maps';
import { EventBus, Events } from './systems/EventBus';
import { SaveState } from './systems/SaveState';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  // Locked to the GBA framebuffer: one screen is exactly 15x10 tiles, and every
  // sprite lands on a whole pixel.
  width: VIEW_W,
  height: VIEW_H,
  pixelArt: true,
  roundPixels: true, // v4 defaults this to false
  antialias: false,
  // Transparent, so the page background is the single source of the letterbox
  // colour. When the canvas paints its own background there are two nearly
  // identical dark colours on screen and the seam between them is visible.
  transparent: true,
  scale: {
    // NONE + an explicit zoom, not FIT. FIT recomputes the canvas style on
    // every resize and overwrites any integer scale set from outside it,
    // leaving a fractional factor (4.5x) that makes pixels uneven.
    mode: Phaser.Scale.NONE,
    // #game-root already centres the canvas with CSS grid. Phaser's autoCenter
    // additionally sets margin-left/top, and the grid then centres the box
    // *including* that margin — so the offset lands one and a half times and
    // the whole game sits off to one side. Exactly one of them may centre.
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene: [Boot, Preload, Title, World, UIScene],
};

const game = new Phaser.Game(config);

// Handle for the dev console and for the Playwright smoke script.
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

// ---------------------------------------------------------------------------
// Integer-only upscaling.
//
// Scale.FIT alone produces fractional scale factors, which makes pixel art
// shimmer. Snap the canvas to the largest whole multiple that fits; below 2x,
// fall back to fractional scaling because legibility beats crispness there.
// ---------------------------------------------------------------------------
function applyIntegerScale(): void {
  if (!game.scale) return;
  const availW = window.innerWidth;
  const availH = window.innerHeight;
  const fit = Math.min(availW / VIEW_W, availH / VIEW_H);
  // Below 2x, legibility beats crispness, so allow a fractional factor there.
  const zoom = fit >= 2 ? Math.min(8, Math.floor(fit)) : Math.max(0.5, fit);
  if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
}

let resizeTimer = 0;
function scheduleScale(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(applyIntegerScale, 100);
}

game.events.once(Phaser.Core.Events.READY, () => {
  applyIntegerScale();
  document.documentElement.classList.add('game-ready');
});
window.addEventListener('resize', scheduleScale);
window.addEventListener('orientationchange', scheduleScale);

// ---------------------------------------------------------------------------
// Accessibility: mirror dialogue into a live region so the game is playable
// with a screen reader, not merely present on the page.
// ---------------------------------------------------------------------------
const live = document.getElementById('a11y-live');
EventBus.on(Events.Announce, (text: string) => {
  if (live) live.textContent = text;
});

// Persist on tab hide as well as on map change.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') SaveState.save();
});

// Text-mode toggle, wired to the skip link in index.html.
document.getElementById('skip-to-text')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.documentElement.classList.add('text-mode');
  document.getElementById('text-version')?.focus();
});
document.getElementById('back-to-game')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.documentElement.classList.remove('text-mode');
  applyIntegerScale();
});

export default game;
