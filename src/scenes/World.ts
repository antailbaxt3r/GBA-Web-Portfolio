import Phaser from 'phaser';
import { GridEntity, registerCharacterAnims } from '../entities/GridEntity';
import { NPC } from '../entities/NPC';
import { InputController } from '../systems/InputController';
import { Pathfinder } from '../systems/Pathfinder';
import { TransitionSystem } from '../systems/TransitionSystem';
import { SaveState } from '../systems/SaveState';
import { Audio } from '../systems/AudioManager';
import { EventBus, Events } from '../systems/EventBus';
import { MAPS, TILE, VIEW_W, VIEW_H } from '../data/maps';
import { CONTENT } from '../data/content';
import {
  DIR_VEC, OPPOSITE,
  type Direction, type DoorObject, type InteractableObject,
  type MapKey, type MapObject, type NpcObject, type PropObject, type SpawnObject,
} from '../types';

interface WorldInit {
  mapKey: MapKey;
  spawnId: string;
  /** Skip the entry reveal (used on the very first load from Title). */
  instant?: boolean;
}

const KEY_TO_INDEX = (x: number, y: number) => `${x},${y}`;

export class World extends Phaser.Scene {
  static readonly KEY = 'World';

  private mapKey!: MapKey;
  private spawnId!: string;
  private mapW = 0;
  private mapH = 0;

  private solid: boolean[] = [];
  private objects: MapObject[] = [];
  private doors = new Map<string, DoorObject>();
  private interactables = new Map<string, InteractableObject>();
  private npcsByTile = new Map<string, NPC>();
  private npcs: NPC[] = [];

  private player!: GridEntity;
  private ctl!: InputController;
  private pathfinder = new Pathfinder();
  private transitions!: TransitionSystem;

  private path: { x: number; y: number }[] = [];
  private reticle?: Phaser.GameObjects.Sprite;
  private hint?: Phaser.GameObjects.Image;
  private busy = false;
  private dialogueOpen = false;

  constructor() {
    super(World.KEY);
  }

  init(data: WorldInit): void {
    this.mapKey = data.mapKey ?? 'town';
    this.spawnId = data.spawnId ?? 'default';
    this.busy = false;
    this.dialogueOpen = false;
    this.path = [];
    this.doors.clear();
    this.interactables.clear();
    this.npcsByTile.clear();
    this.npcs = [];
  }

  create(data: WorldInit): void {
    const def = MAPS[this.mapKey];

    // --- tilemap ---
    const map = this.add.tilemap(`map-${this.mapKey}`);
    const tileset = map.addTilesetImage(def.tilesetName, def.tilesetKey);
    if (!tileset) throw new Error(`Tileset ${def.tilesetName} failed to load`);

    this.mapW = map.width;
    this.mapH = map.height;

    const gpu = this.game.renderer.type === Phaser.WEBGL;
    for (const name of ['ground', 'decor-below']) {
      const layer = map.createLayer(name, tileset, 0, 0, gpu);
      layer?.setDepth(name === 'ground' ? 0 : 1);
    }

    // Collision is read straight from the layer data — never rendered.
    this.solid = new Array(this.mapW * this.mapH).fill(false);
    const collisionLayer = map.layers.find((l) => l.name === 'collision');
    if (collisionLayer) {
      for (let y = 0; y < this.mapH; y++) {
        for (let x = 0; x < this.mapW; x++) {
          const t = collisionLayer.data[y]?.[x];
          if (t && t.index >= 0) this.solid[y * this.mapW + x] = true;
        }
      }
    }

    // --- objects ---
    this.objects = (this.cache.json.get(`obj-${this.mapKey}`)?.objects ?? []) as MapObject[];
    this.spawnObjects();

    // --- player ---
    registerCharacterAnims(this, 'player', true);
    const spawn = this.findSpawn(this.spawnId);
    this.player = new GridEntity(this, 'player', spawn.x, spawn.y, spawn.facing);
    this.player.isBlocked = (x, y, by) => this.isBlocked(x, y, by);
    this.player.onArrive(() => this.onPlayerArrive());
    // Bump feedback, throttled so holding into a wall does not machine-gun.
    (this.player as unknown as { onBump: () => void }).onBump = () =>
      Audio.play('sfx-bump', 0.4, 400);

    // --- pathfinding grid ---
    this.pathfinder.setGrid(this.mapW, this.mapH, (x, y) => this.isSolidTile(x, y));

    // --- camera: locked to the player with no lerp, exactly like FireRed ---
    const cam = this.cameras.main;
    const mw = this.mapW * TILE;
    const mh = this.mapH * TILE;
    // A room smaller than the viewport must be centred, not pinned to 0,0 —
    // otherwise the camera clamps and leaves a black bar down one side.
    cam.setBounds(
      mw < VIEW_W ? -Math.floor((VIEW_W - mw) / 2) : 0,
      mh < VIEW_H ? -Math.floor((VIEW_H - mh) / 2) : 0,
      Math.max(mw, VIEW_W),
      Math.max(mh, VIEW_H)
    );
    cam.setRoundPixels(true);
    cam.startFollow(this.player.sprite, true, 1, 1);

    // --- input ---
    this.ctl = new InputController(this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.transitions = new TransitionSystem(this);
    Audio.attach(this);

    this.reticle = this.add.sprite(0, 0, 'reticle', 0).setVisible(false).setDepth(9000);
    this.anims.exists('reticle-blink') ||
      this.anims.create({
        key: 'reticle-blink',
        frames: [{ key: 'reticle', frame: 0 }, { key: 'reticle', frame: 1 }],
        frameRate: 6,
        repeat: -1,
      });

    this.hint = this.add.image(0, 0, 'atlas-game', 'hint').setVisible(false).setDepth(9500);

    // --- lifecycle ---
    EventBus.on(Events.DialogueOpen, this.onDialogueOpen, this);
    EventBus.on(Events.DialogueClose, this.onDialogueClose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);

    Audio.playMusic(def.music);
    EventBus.emit(Events.Announce, `${def.label}. Use arrow keys to walk.`);

    // --- entry reveal ---
    if (data.instant) {
      this.transitions.reveal('fade');
    } else {
      this.busy = true;
      this.transitions.cover('door');
      void this.transitions.reveal('door').then(() => {
        this.busy = false;
      });
    }

    SaveState.setPosition(this.mapKey, spawn.x, spawn.y, spawn.facing);
  }

  // -------------------------------------------------------------------------
  // Setup helpers
  // -------------------------------------------------------------------------

  private spawnObjects(): void {
    for (const o of this.objects) {
      switch (o.type) {
        case 'prop': {
          const p = o as PropObject;
          const img = this.add.image(p.x, p.y, 'atlas-game', p.frame).setOrigin(0, 0);
          img.setDepth(p.depth ?? p.y + img.height);
          break;
        }
        case 'door': {
          const d = o as DoorObject;
          this.doors.set(KEY_TO_INDEX(d.x / TILE, d.y / TILE), d);
          break;
        }
        case 'interactable': {
          const it = o as InteractableObject;
          if (it.frame) {
            const img = this.add.image(it.x, it.y, 'atlas-game', it.frame).setOrigin(0, 0);
            img.setDepth(it.y + img.height);
          }
          this.interactables.set(KEY_TO_INDEX(it.x / TILE, it.y / TILE), it);
          break;
        }
        case 'npc': {
          const n = o as NpcObject;
          registerCharacterAnims(this, n.sprite, false);
          const npc = new NPC(this, n);
          npc.isBlocked = (x, y, by) => this.isBlocked(x, y, by);
          npc.onArrive(() => this.reindexNpcs());
          this.npcs.push(npc);
          break;
        }
        default:
          break;
      }
    }
    this.reindexNpcs();
  }

  private reindexNpcs(): void {
    this.npcsByTile.clear();
    for (const n of this.npcs) this.npcsByTile.set(KEY_TO_INDEX(n.tileX, n.tileY), n);
  }

  private findSpawn(id: string): { x: number; y: number; facing: Direction } {
    // "resume" restores the exact tile the player left off on.
    if (id === 'resume') {
      const r = this.registry.get('resume') as { x: number; y: number; facing: Direction } | undefined;
      this.registry.remove('resume');
      if (r && !this.isSolidTile(r.x, r.y)) return r;
    }
    const s = this.objects.find((o) => o.type === 'spawn' && o.id === id) as SpawnObject | undefined;
    const fallback = this.objects.find((o) => o.type === 'spawn') as SpawnObject | undefined;
    const use = s ?? fallback;
    if (!use) return { x: 1, y: 1, facing: 'down' };
    return { x: use.x / TILE, y: use.y / TILE, facing: use.facing };
  }

  // -------------------------------------------------------------------------
  // Collision
  // -------------------------------------------------------------------------

  private isSolidTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return true;
    return this.solid[y * this.mapW + x] === true;
  }

  private isBlocked(x: number, y: number, by: GridEntity): boolean {
    if (this.isSolidTile(x, y)) return true;
    const npc = this.npcsByTile.get(KEY_TO_INDEX(x, y));
    if (npc && npc !== by) return true;
    if (by !== this.player && this.player.tileX === x && this.player.tileY === y) return true;
    return false;
  }

  // -------------------------------------------------------------------------
  // Input handling
  // -------------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.busy || this.dialogueOpen) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const target = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
    void this.walkTo(target);
  }

  /** Public so the touch UI can route taps through the same code path. */
  async walkTo(target: { x: number; y: number }): Promise<void> {
    if (this.busy || this.dialogueOpen) return;
    const from = { x: this.player.tileX, y: this.player.tileY };
    let goal: { x: number; y: number } | null = target;
    let autoInteract = false;

    const blockedTarget = this.isSolidTile(target.x, target.y);
    const hasThing =
      this.interactables.has(KEY_TO_INDEX(target.x, target.y)) ||
      this.npcsByTile.has(KEY_TO_INDEX(target.x, target.y));

    if (hasThing || (blockedTarget && this.doors.has(KEY_TO_INDEX(target.x, target.y)))) {
      // Signs and wall-mounted objects can only be read from one side, so walk
      // to that side rather than to whichever tile happens to be nearest.
      const it = this.interactables.get(KEY_TO_INDEX(target.x, target.y));
      if (it?.facing) {
        const v = DIR_VEC[it.facing];
        const stand = { x: target.x - v.x, y: target.y - v.y };
        goal = this.pathfinder.isWalkable(stand.x, stand.y) ? stand : null;
      } else {
        goal = this.pathfinder.adjacentTo(target, from);
      }
      autoInteract = true;
    } else if (blockedTarget) {
      goal = this.pathfinder.nearestWalkable(target, 3);
    }
    if (!goal) return;

    const path = await this.pathfinder.find(from, goal);
    if (!path || !path.length) {
      // Already adjacent? Then just turn and interact.
      if (autoInteract && Math.abs(from.x - target.x) + Math.abs(from.y - target.y) === 1) {
        this.faceTile(target);
        this.tryInteract();
      }
      return;
    }
    this.path = path;
    this.pendingInteractTile = autoInteract ? target : null;
    this.showReticle(goal);
  }

  private pendingInteractTile: { x: number; y: number } | null = null;

  private showReticle(tile: { x: number; y: number }): void {
    if (!this.reticle) return;
    this.reticle.setPosition(tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2);
    this.reticle.setVisible(true).play('reticle-blink', true);
  }

  private hideReticle(): void {
    this.reticle?.setVisible(false).stop();
  }

  private cancelPath(): void {
    if (!this.path.length && !this.pendingInteractTile) return;
    this.path = [];
    this.pendingInteractTile = null;
    this.hideReticle();
  }

  private faceTile(tile: { x: number; y: number }): void {
    const dx = tile.x - this.player.tileX;
    const dy = tile.y - this.player.tileY;
    const dir: Direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.player.face(dir);
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private tryInteract(): boolean {
    const t = this.player.facingTile();
    const key = KEY_TO_INDEX(t.x, t.y);

    const npc = this.npcsByTile.get(key);
    if (npc) {
      npc.freeze(OPPOSITE[this.player.facing]);
      this.openDialogue(npc.contentId);
      return true;
    }

    const it = this.interactables.get(key);
    if (it) {
      if (it.facing && it.facing !== this.player.facing) return false;
      this.openDialogue(it.contentId);
      return true;
    }
    return false;
  }

  private openDialogue(contentId: string): void {
    let id = contentId;
    // The guide has a different line once every section has been seen.
    if (contentId === 'town.professor' && SaveState.visitedCount() >= 4) {
      id = 'town.professor.complete';
    }
    // The TV cycles through its facts.
    if (contentId.startsWith('about.tv.')) {
      const count = Object.keys(CONTENT).filter((k) => k.startsWith('about.tv.')).length;
      const n = (this.tvIndex = (this.tvIndex + 1) % count);
      id = `about.tv.${n}`;
    }
    if (!CONTENT[id]) return;
    this.cancelPath();
    EventBus.emit(Events.InteractionStart, id);
  }

  private tvIndex = -1;

  private onDialogueOpen(): void {
    this.dialogueOpen = true;
    // Lock rather than merely clear. While a dialogue is open this scene keeps
    // receiving keydowns it never consumes; without the lock, the stale press
    // fires the instant the dialogue closes and immediately reopens it.
    this.ctl?.setLocked(true);
  }

  private onDialogueClose(): void {
    this.dialogueOpen = false;
    this.ctl?.setLocked(false);
    this.ctl?.clear();
    for (const n of this.npcs) n.unfreeze();
  }

  // -------------------------------------------------------------------------
  // Doors
  // -------------------------------------------------------------------------

  private onPlayerArrive(): void {
    const door = this.doors.get(KEY_TO_INDEX(this.player.tileX, this.player.tileY));
    if (door) {
      void this.useDoor(door);
      return;
    }
    SaveState.setPosition(this.mapKey, this.player.tileX, this.player.tileY, this.player.facing);
  }

  private async useDoor(door: DoorObject): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.cancelPath();
    this.ctl.setLocked(true);
    Audio.play('sfx-door');

    if (door.section && SaveState.markVisited(door.section)) {
      EventBus.emit(Events.SectionVisited, {
        section: door.section,
        visited: SaveState.visitedCount(),
        total: 4,
      });
    }

    // Step up into the doorway and fade out as the sprite disappears inside.
    this.tweens.add({ targets: this.player.sprite, alpha: 0, duration: 200, delay: 80 });
    await this.transitions.cover(door.transition);

    this.scene.restart({ mapKey: door.target, spawnId: door.targetSpawn });
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    this.pathfinder.update();

    for (const n of this.npcs) n.update(delta);
    this.player.update(delta);

    if (this.busy || this.dialogueOpen) {
      this.hint?.setVisible(false);
      return;
    }

    const ctl = this.ctl;
    if (!ctl) return;

    if (ctl.pressed('confirm')) {
      this.cancelPath();
      if (this.tryInteract()) return;
    }

    // A keypress always wins over an in-progress click path.
    if (ctl.anyDirectionPressed()) this.cancelPath();

    const canAct = this.player.state === 'idle' || this.player.inBufferWindow();
    if (canAct && this.player.state === 'idle') {
      const dir = ctl.direction();
      if (dir) {
        this.cancelPath();
        this.player.tryStep(dir, { run: ctl.isRunning() });
      } else if (this.path.length) {
        this.followPath();
      }
    }

    this.updateHint();
  }

  private followPath(): void {
    const next = this.path[0]!;
    const dx = next.x - this.player.tileX;
    const dy = next.y - this.player.tileY;
    const dir: Direction =
      dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';

    // If something moved into our route, replan rather than bumping forever.
    if (this.isBlocked(next.x, next.y, this.player)) {
      const goal = this.path[this.path.length - 1]!;
      this.path = [];
      void this.walkTo(goal);
      return;
    }

    if (this.player.tryStep(dir, { ignoreTurn: true, run: false })) {
      this.path.shift();
      if (!this.path.length) {
        this.hideReticle();
        const target = this.pendingInteractTile;
        this.pendingInteractTile = null;
        if (target) {
          this.player.onArriveOnce(() => {
            this.faceTile(target);
            this.tryInteract();
          });
        }
      }
    }
  }

  private updateHint(): void {
    if (!this.hint) return;
    if (!SaveState.get().settings.showHints || this.player.state !== 'idle') {
      this.hint.setVisible(false);
      return;
    }
    const t = this.player.facingTile();
    const key = KEY_TO_INDEX(t.x, t.y);
    const has = this.interactables.has(key) || this.npcsByTile.has(key);
    this.hint.setVisible(has);
    if (has) {
      const bob = Math.sin(this.time.now / 200) * 1.5;
      this.hint.setPosition(this.player.sprite.x - 4, this.player.sprite.y - 30 + bob);
      this.hint.setDepth(this.player.sprite.depth + 1);
    }
  }

  private shutdownScene(): void {
    EventBus.off(Events.DialogueOpen, this.onDialogueOpen, this);
    EventBus.off(Events.DialogueClose, this.onDialogueClose, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.transitions?.destroy();
    this.ctl?.destroy();
    for (const n of this.npcs) n.destroy();
    this.npcs = [];
  }
}
