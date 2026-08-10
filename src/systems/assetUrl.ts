/**
 * Cache-busting for everything under public/assets/.
 *
 * Those files have stable names — the game loads them by path — so a browser
 * that cached them under an old `max-age` will keep serving its copy no matter
 * what the server says on the next deploy. That is survivable when a file is
 * merely out of date, and not survivable at all when two files have to agree
 * with each other: a stale atlas-game.json against a fresh sprite sheet has no
 * `menu-button` frame, and Phaser answers a missing frame with
 * `frames[firstFrame]` — which in this atlas is `building-work`. The menu
 * button renders as the WORK building.
 *
 * Appending a per-build id makes every deploy a new URL, so a stale entry can
 * never be selected in the first place. Netlify ignores the query when serving
 * static files, and cache headers still match on path alone.
 */
declare const __BUILD_ID__: string;

const V = `?v=${__BUILD_ID__}`;

/** Tag one asset path. */
export function asset(path: string): string {
  return path + V;
}

/** Tag a list of paths — audio is loaded as an ogg/m4a pair. */
export function assets(paths: string[]): string[] {
  return paths.map(asset);
}
