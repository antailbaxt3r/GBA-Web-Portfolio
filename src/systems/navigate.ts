import { SaveState } from './SaveState';
import { MINIMAL_URL } from '../data/routes';

/**
 * Leave the game for the plain-HTML portfolio.
 *
 * Saves first: this is a full page navigation, so the scene never gets a
 * shutdown and the usual "persist on map change" path does not run. Coming
 * back to the game should land the player where they left off.
 */
export function openMinimalSite(): void {
  SaveState.save();
  window.location.href = MINIMAL_URL;
}
