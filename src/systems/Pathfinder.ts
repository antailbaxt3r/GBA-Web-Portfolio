import EasyStar from 'easystarjs';
import type { TileCoord } from '../types';

const WALKABLE = 0;
const SOLID = 1;
const MAX_PATH = 60;

/**
 * A* over the collision grid, via easystar.
 *
 * Diagonals are disabled: the character has no diagonal animation, and allowing
 * them would immediately look wrong.
 */
export class Pathfinder {
  private es = new EasyStar.js();
  private grid: number[][] = [];
  private w = 0;
  private h = 0;
  private pending = 0;

  /** Rebuilt once per map load, never per frame. */
  setGrid(width: number, height: number, isSolid: (x: number, y: number) => boolean): void {
    this.w = width;
    this.h = height;
    this.grid = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) row.push(isSolid(x, y) ? SOLID : WALKABLE);
      this.grid.push(row);
    }
    this.es.setGrid(this.grid);
    this.es.setAcceptableTiles([WALKABLE]);
    this.es.disableDiagonals();
    this.es.setIterationsPerCalculation(2000);
  }

  /** Mark a tile solid/clear without rebuilding — used for NPCs that move. */
  setSolid(x: number, y: number, solid: boolean): void {
    if (!this.inBounds(x, y)) return;
    this.grid[y]![x] = solid ? SOLID : WALKABLE;
    this.es.setGrid(this.grid);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.grid[y]![x] === WALKABLE;
  }

  /**
   * Nearest walkable tile orthogonally adjacent to a blocked target. This is
   * what makes clicking an object feel intelligent: click the PC, the character
   * walks to the tile in front of it.
   */
  adjacentTo(target: TileCoord, from: TileCoord): TileCoord | null {
    const cands = [
      { x: target.x, y: target.y + 1 },
      { x: target.x, y: target.y - 1 },
      { x: target.x - 1, y: target.y },
      { x: target.x + 1, y: target.y },
    ].filter((c) => this.isWalkable(c.x, c.y));
    if (!cands.length) return null;
    cands.sort(
      (a, b) =>
        Math.abs(a.x - from.x) + Math.abs(a.y - from.y) -
        (Math.abs(b.x - from.x) + Math.abs(b.y - from.y))
    );
    return cands[0]!;
  }

  /** Nearest walkable tile within `radius`, for clicks on plain scenery. */
  nearestWalkable(target: TileCoord, radius = 3): TileCoord | null {
    if (this.isWalkable(target.x, target.y)) return target;
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const c = { x: target.x + dx, y: target.y + dy };
          if (this.isWalkable(c.x, c.y)) return c;
        }
      }
    }
    return null;
  }

  find(from: TileCoord, to: TileCoord): Promise<TileCoord[] | null> {
    if (!this.isWalkable(to.x, to.y)) return Promise.resolve(null);
    if (from.x === to.x && from.y === to.y) return Promise.resolve([]);
    return new Promise((resolve) => {
      this.pending++;
      this.es.findPath(from.x, from.y, to.x, to.y, (path) => {
        this.pending--;
        if (!path || path.length < 2) return resolve(null);
        // Drop the starting tile and cap the route length.
        resolve(path.slice(1, MAX_PATH + 1).map((p) => ({ x: p.x, y: p.y })));
      });
    });
  }

  /** Must be called at most once per frame. */
  update(): void {
    if (this.pending > 0) this.es.calculate();
  }
}
