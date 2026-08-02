import Phaser from 'phaser';
import type { SectionId } from '../types';

/**
 * One global emitter. World scenes never reach into UIScene directly and
 * vice versa — everything crosses this boundary.
 */
export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  /** (contentId) — the player pressed A on something interactable */
  InteractionStart: 'interaction:start',
  /** (contentId) — UIScene has opened a dialogue */
  DialogueOpen: 'dialogue:open',
  /** () — dialogue closed, world may resume */
  DialogueClose: 'dialogue:close',
  /** (sectionId) */
  SectionVisited: 'section:visited',
  /** () */
  InputLock: 'input:lock',
  InputUnlock: 'input:unlock',
  /** (kind) */
  TransitionBegin: 'transition:begin',
  TransitionComplete: 'transition:complete',
  /** (text) — mirrored into the aria-live region for screen readers */
  Announce: 'a11y:announce',
  /** () — settings changed, systems should re-read SaveState */
  SettingsChanged: 'settings:changed',
} as const;

export interface SectionVisitedPayload {
  section: SectionId;
  total: number;
  visited: number;
}
