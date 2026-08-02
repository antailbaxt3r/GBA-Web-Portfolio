import type { MapKey } from '../types';

export const TILE = 16;
export const VIEW_W = 240;
export const VIEW_H = 160;

export interface MapDef {
  key: MapKey;
  tilesetKey: string;
  /** Tileset name as written in the generated Tiled JSON. */
  tilesetName: string;
  music: string;
  /** Human-readable, announced to screen readers on entry. */
  label: string;
}

export const MAPS: Record<MapKey, MapDef> = {
  town: {
    key: 'town',
    tilesetKey: 'tiles-town',
    tilesetName: 'town-exterior',
    music: 'bgm-town',
    label: 'Portfolio Town',
  },
  'interior-work': {
    key: 'interior-work',
    tilesetKey: 'tiles-interior',
    tilesetName: 'interior',
    music: 'bgm-interior',
    label: 'Battle Hall — Work',
  },
  'interior-projects': {
    key: 'interior-projects',
    tilesetKey: 'tiles-interior',
    tilesetName: 'interior',
    music: 'bgm-interior',
    label: 'Research Lab — Projects',
  },
  'interior-about': {
    key: 'interior-about',
    tilesetKey: 'tiles-interior',
    tilesetName: 'interior',
    music: 'bgm-interior',
    label: 'Home — About Me',
  },
  'interior-contact': {
    key: 'interior-contact',
    tilesetKey: 'tiles-interior',
    tilesetName: 'interior',
    music: 'bgm-interior',
    label: 'Mart — Contact',
  },
};

export const ALL_MAP_KEYS = Object.keys(MAPS) as MapKey[];
