import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { ChoiceMenu } from '../ui/ChoiceMenu';
import { TouchControls } from '../ui/TouchControls';
import { EventBus, Events, type SectionVisitedPayload } from '../systems/EventBus';
import { InputController } from '../systems/InputController';
import { SaveState } from '../systems/SaveState';
import { Audio } from '../systems/AudioManager';
import { CONTENT, type Choice } from '../data/content';
import { VIEW_W } from '../data/maps';
import { World } from './World';

/**
 * Always-on-top UI. Runs in parallel with World and communicates only over the
 * event bus, so neither scene holds a reference to the other.
 */
export class UIScene extends Phaser.Scene {
  static readonly KEY = 'UIScene';

  private box!: DialogueBox;
  private menu!: ChoiceMenu;
  private touch!: TouchControls;
  private ctl!: InputController;
  private hud!: Phaser.GameObjects.BitmapText;
  private toast?: Phaser.GameObjects.BitmapText;
  private awaitingChoices: Choice[] | null = null;

  constructor() {
    super({ key: UIScene.KEY, active: false });
  }

  create(): void {
    this.box = new DialogueBox(this);
    this.menu = new ChoiceMenu(this);
    this.touch = new TouchControls(this);
    this.ctl = new InputController(this);
    Audio.attach(this);

    this.hud = this.add
      .bitmapText(VIEW_W - 4, 4, 'font-small', '')
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(9000);
    this.refreshHud();

    this.box.onPageShown = (text) => EventBus.emit(Events.Announce, text);

    this.menu.onSelect = (choice) => this.runChoice(choice);
    this.menu.onCancel = () => this.closeDialogue();

    this.touch.onDirection = (dir) => this.getWorldInput()?.setTouchDirection(dir);
    this.touch.onA = () => this.getWorldInput()?.pressTouch('confirm');
    this.touch.onB = () => this.getWorldInput()?.pressTouch('cancel');

    EventBus.on(Events.InteractionStart, this.openDialogue, this);
    EventBus.on(Events.SectionVisited, this.onSectionVisited, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.InteractionStart, this.openDialogue, this);
      EventBus.off(Events.SectionVisited, this.onSectionVisited, this);
      this.ctl.destroy();
    });
  }

  /** Touch input is routed into the World scene's controller. */
  private getWorldInput(): InputController | null {
    const world = this.scene.get(World.KEY) as World | undefined;
    return (world as unknown as { ctl?: InputController })?.ctl ?? null;
  }

  // -------------------------------------------------------------------------

  private openDialogue(contentId: string): void {
    const node = CONTENT[contentId];
    if (!node) return;

    const firstTime = !SaveState.hasSeen(contentId);
    SaveState.markSeen(contentId);
    const pages = firstTime && node.firstTimeOnly ? node.firstTimeOnly : node.pages;

    const withTitle = node.title ? [`${node.title}`, ...pages] : pages;
    this.awaitingChoices = node.choices ?? null;
    this.box.show(withTitle);
    // The keypress that opened this dialogue must not also skip its first page.
    this.suppressUntil = this.time.now + 150;
    this.touch.setDialogueMode(true);
    EventBus.emit(Events.DialogueOpen, contentId);
  }

  private closeDialogue(): void {
    this.box.hide();
    this.menu.hide();
    this.awaitingChoices = null;
    this.touch.setDialogueMode(false);
    EventBus.emit(Events.DialogueClose);
  }

  private runChoice(choice: Choice): void {
    switch (choice.action.type) {
      case 'url': {
        const href = choice.action.href;
        window.open(href, '_blank', 'noopener,noreferrer');
        this.menu.hide();
        this.box.show([`Opened ${choice.label}.`]);
        this.awaitingChoices = null;
        break;
      }
      case 'copy': {
        const value = choice.action.value;
        void navigator.clipboard?.writeText(value).catch(() => undefined);
        this.menu.hide();
        this.box.show([`Copied ${value} to the clipboard.`]);
        this.awaitingChoices = null;
        break;
      }
      default:
        this.closeDialogue();
    }
  }

  private onSectionVisited(p: SectionVisitedPayload): void {
    this.refreshHud();
    this.showToast(`${p.section.toUpperCase()} - ${p.visited}/${p.total} SECTIONS`);
  }

  private refreshHud(): void {
    this.hud.setText(`SECTIONS ${SaveState.visitedCount()}/4`);
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    this.toast = this.add
      .bitmapText(VIEW_W / 2, 14, 'font-small', text)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(12000);
    this.tweens.add({
      targets: this.toast,
      alpha: { from: 1, to: 0 },
      delay: 1600,
      duration: 500,
      onComplete: () => this.toast?.destroy(),
    });
  }

  // -------------------------------------------------------------------------

  private suppressUntil = 0;

  override update(_t: number, delta: number): void {
    this.box.update(delta);
    if (!this.box.isOpen) return;
    if (this.time.now < this.suppressUntil) {
      this.ctl.clear();
      return;
    }

    if (this.menu.isOpen) {
      if (this.ctl.pressed('confirm')) this.menu.confirm();
      else if (this.ctl.pressed('cancel')) this.menu.cancel();
      else {
        const dir = this.ctl.direction();
        if (dir === 'up' && this.menuCooldown()) this.menu.move(-1);
        else if (dir === 'down' && this.menuCooldown()) this.menu.move(1);
      }
      return;
    }

    if (this.ctl.pressed('confirm')) {
      // Two-stage confirm: complete the page first, advance second.
      if (!this.box.pageComplete) {
        this.box.completePage();
      } else if (this.box.nextPage()) {
        Audio.play('sfx-select', 0.25);
      } else if (this.awaitingChoices) {
        this.menu.show(this.awaitingChoices);
      } else {
        this.closeDialogue();
      }
    } else if (this.ctl.pressed('cancel')) {
      if (!this.box.pageComplete) this.box.completePage();
      else if (!this.awaitingChoices) this.closeDialogue();
    }
  }

  private lastMenuMove = 0;
  private menuCooldown(): boolean {
    if (this.time.now - this.lastMenuMove < 160) return false;
    this.lastMenuMove = this.time.now;
    return true;
  }
}
