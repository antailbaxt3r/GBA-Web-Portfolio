export type Direction = 'down' | 'up' | 'left' | 'right';

export const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];

/** Row index of each direction inside a character spritesheet. */
export const DIR_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/** Unit tile step for each direction. */
export const DIR_VEC: Record<Direction, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  down: 'up', up: 'down', left: 'right', right: 'left',
};

export interface TileCoord {
  x: number;
  y: number;
}

export type MapKey = 'town' | 'interior-work' | 'interior-projects' | 'interior-about' | 'interior-contact';

export type SectionId = 'work' | 'projects' | 'about' | 'contact';

export type TransitionKind = 'door' | 'circle' | 'blinds' | 'fade';

/** Object types emitted into the Tiled `objects` layer by tools/generate-maps.mjs. */
export interface MapObjectBase {
  id: string;
  x: number;
  y: number;
}

export interface SpawnObject extends MapObjectBase {
  type: 'spawn';
  facing: Direction;
}

export interface DoorObject extends MapObjectBase {
  type: 'door';
  target: MapKey;
  targetSpawn: string;
  transition: TransitionKind;
  section?: SectionId;
}

export interface PropObject extends MapObjectBase {
  type: 'prop';
  frame: string;
  /** Depth override; defaults to the sprite's bottom edge. */
  depth?: number;
}

export interface InteractableObject extends MapObjectBase {
  type: 'interactable';
  contentId: string;
  frame?: string;
  facing?: Direction;
}

export interface NpcObject extends MapObjectBase {
  type: 'npc';
  sprite: string;
  contentId: string;
  facing: Direction;
  movement: 'static' | 'lookAround' | 'wander';
  wander?: { x: number; y: number; w: number; h: number };
}

export type MapObject =
  | SpawnObject
  | DoorObject
  | PropObject
  | InteractableObject
  | NpcObject;
