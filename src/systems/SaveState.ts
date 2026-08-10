import type { Direction, MapKey, SectionId } from '../types';

const KEY = 'portfolio-2026.save';
const VERSION = 1;

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface SaveData {
  version: number;
  lastMap: MapKey;
  lastTile: { x: number; y: number };
  facing: Direction;
  visited: SectionId[];
  seenDialogue: string[];
  settings: {
    muted: boolean;
    /** Master output level, 0..1. Independent of `muted`, which overrides it. */
    volume: number;
    textSpeed: TextSpeed;
    showHints: boolean;
  };
}

function fresh(): SaveData {
  return {
    version: VERSION,
    lastMap: 'town',
    lastTile: { x: 20, y: 16 },
    facing: 'up',
    visited: [],
    seenDialogue: [],
    settings: { muted: false, volume: 0.7, textSpeed: 'normal', showHints: true },
  };
}

/** Milliseconds per revealed character. */
export const TEXT_SPEED_MS: Record<TextSpeed, number> = {
  slow: 55,
  normal: 30,
  fast: 15,
  instant: 0,
};

class SaveStateImpl {
  private data: SaveData = fresh();
  private loaded = false;

  load(): SaveData {
    if (this.loaded) return this.data;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        // Never attempt migration across schema versions — start clean instead.
        if (parsed?.version === VERSION) {
          this.data = { ...fresh(), ...parsed, settings: { ...fresh().settings, ...parsed.settings } };
        }
      }
    } catch {
      /* corrupt or unavailable storage: fall back to defaults */
    }
    return this.data;
  }

  get(): SaveData {
    return this.load();
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* private browsing / quota: the game must still run */
    }
  }

  hasSave(): boolean {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      return (JSON.parse(raw) as SaveData)?.version === VERSION;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.data = fresh();
    this.loaded = true;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  setPosition(map: MapKey, x: number, y: number, facing: Direction): void {
    const d = this.get();
    d.lastMap = map;
    d.lastTile = { x, y };
    d.facing = facing;
    this.save();
  }

  markVisited(section: SectionId): boolean {
    const d = this.get();
    if (d.visited.includes(section)) return false;
    d.visited.push(section);
    this.save();
    return true;
  }

  visitedCount(): number {
    return this.get().visited.length;
  }

  markSeen(contentId: string): boolean {
    const d = this.get();
    if (d.seenDialogue.includes(contentId)) return false;
    d.seenDialogue.push(contentId);
    this.save();
    return true;
  }

  hasSeen(contentId: string): boolean {
    return this.get().seenDialogue.includes(contentId);
  }

  setSetting<K extends keyof SaveData['settings']>(k: K, v: SaveData['settings'][K]): void {
    this.get().settings[k] = v;
    this.save();
  }
}

export const SaveState = new SaveStateImpl();
