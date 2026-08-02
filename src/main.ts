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
  backgroundColor: '#101018',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
  const canvas = game.canvas;
  if (!canvas) return;
  const host = canvas.parentElement ?? document.body;
  const availW = host.clientWidth || window.innerWidth;
  const availH = host.clientHeight || window.innerHeight;
  const zoom = Math.min(availW / VIEW_W, availH / VIEW_H);

  if (zoom >= 2) {
    const z = Math.min(6, Math.floor(zoom));
    canvas.style.width = `${VIEW_W * z}px`;
    canvas.style.height = `${VIEW_H * z}px`;
  } else {
    canvas.style.width = '';
    canvas.style.height = '';
  }
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
