import {
  createSystem,
  type Entity,
  Grabbed,
  type UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { onLanguageChange, t } from './i18n/index.js';
import { MovablePanel } from './movable-panel-component.js';
import {
  nearBar,
  releaseStop,
  ScreenStop,
  type ScreenStopName,
} from './screen-stops.js';

// A moved panel stays inside this box around the table, so it can always
// be reached again and never sinks below the floor or leaves the room.
const MIN = new Vector3(-1.6, 0.45, -1.8);
const MAX = new Vector3(1.6, 2.0, 0.25);

// How fast the screen glides to a stop: most of the way in about half a
// second, easing in, so it never jumps at the player.
const GLIDE_RATE = 4;
// The screen's centre sits this far above its bar at scale 1 (scene JSON).
const SCREEN_ABOVE_BAR = 0.42;

interface Rest {
  // The Far stop: where the scene puts the bar, and its scale there.
  farPosition: Vector3;
  farScale: number;
  target: Vector3;
  targetScale: number;
  gliding: boolean;
  // The stop the bar is at, or gliding to.
  stop: ScreenStopName;
  grabDistance: number;
  grabTime: number;
}

type UIElement = ReturnType<UIKitMLAsset['getElementById']>;

/**
 * Moves the screen between its two stops (see src/screen-stops.ts) and
 * keeps any moved panel near the table. Each page's header also has a
 * button for it: Closer at Far, Push back at Near. At Near a hand is too
 * close to the screen for its pointer ray (touch takes over there), so
 * that button, tapped with a fingertip, is the way to send it back.
 */
export class MovablePanelSystem extends createSystem({
  panels: { required: [MovablePanel] },
  held: { required: [MovablePanel, Grabbed] },
}) {
  private readonly rests = new Map<Entity, Rest>();
  private readonly head = new Vector3();
  private readonly bar = new Vector3();
  private readonly reachButtons: NonNullable<UIElement>[] = [];
  private readonly reachLabels: NonNullable<UIElement>[] = [];
  private clock = 0;

  init(): void {
    const adopt = (panel: Entity) => {
      const object = panel.object3D!;
      this.rests.set(panel, {
        farPosition: object.position.clone(),
        farScale: object.scale.x,
        target: object.position.clone(),
        targetScale: object.scale.x,
        gliding: false,
        stop: panel.getValue(MovablePanel, 'stop') as ScreenStopName,
        grabDistance: 0,
        grabTime: 0,
      });
    };
    for (const panel of this.queries.panels.entities) {
      adopt(panel);
    }
    const screen = this.world.getSceneObject<UIKitMLAsset>('screen');
    const toggle = () => this.toggleStop();
    for (const id of ['home-reach', 'puzzle-reach']) {
      const button = screen?.getElementById(id);
      const label = screen?.getElementById(`${id}-label`);
      if (button && label) {
        button.addEventListener('click', toggle);
        this.cleanupFuncs.push(() =>
          button.removeEventListener('click', toggle),
        );
        this.reachButtons.push(button);
        this.reachLabels.push(label);
      }
    }
    this.cleanupFuncs.push(onLanguageChange(() => this.renderReach()));
    this.renderReach();
    this.cleanupFuncs.push(
      this.queries.panels.subscribe('qualify', adopt),
      this.queries.panels.subscribe('disqualify', (panel) =>
        this.rests.delete(panel),
      ),
      this.queries.held.subscribe('qualify', (panel) => {
        const rest = this.rests.get(panel);
        if (rest) {
          rest.gliding = false;
          rest.grabDistance = this.distanceToHead(panel);
          rest.grabTime = this.clock;
        }
      }),
      this.queries.held.subscribe('disqualify', (panel) =>
        this.onReleased(panel),
      ),
      // Leaving VR sends a beckoned screen back: Near is placed for a
      // headset, not for a flat page's camera.
      // The reach buttons are for a headset only.
      this.world.visibilityState.subscribe((state) => {
        const flat = state === VisibilityState.NonImmersive;
        if (flat) {
          for (const panel of this.queries.panels.entities) {
            panel.setValue(MovablePanel, 'stop', ScreenStop.Far);
          }
        }
        for (const button of this.reachButtons) {
          button.setProperties({ display: flat ? 'none' : 'flex' });
        }
      }),
    );
  }

  update(delta: number): void {
    this.clock += delta;
    const blend = 1 - Math.exp(-GLIDE_RATE * delta);
    for (const panel of this.queries.panels.entities) {
      const object = panel.object3D!;
      const rest = this.rests.get(panel);
      const held = panel.hasComponent(Grabbed);
      if (rest && !held) {
        // A stop asked for from elsewhere: a new puzzle sends it Far.
        const asked = panel.getValue(MovablePanel, 'stop') as ScreenStopName;
        if (asked !== rest.stop) {
          this.goTo(panel, rest, asked);
        }
        if (rest.gliding) {
          this.glide(object, rest, blend);
        }
      }
      const position = object.position;
      position.x = Math.min(Math.max(position.x, MIN.x), MAX.x);
      position.y = Math.min(Math.max(position.y, MIN.y), MAX.y);
      position.z = Math.min(Math.max(position.z, MIN.z), MAX.z);
    }
  }

  /** In VR, letting go of the bar settles the screen at a stop. */
  private onReleased(panel: Entity): void {
    const rest = this.rests.get(panel);
    // On a flat page the mouse places the screen freely, as before.
    if (
      !rest ||
      this.world.visibilityState.peek() === VisibilityState.NonImmersive
    ) {
      return;
    }
    const pulled = rest.grabDistance - this.distanceToHead(panel);
    const next = releaseStop(rest.stop, pulled, this.clock - rest.grabTime);
    panel.setValue(MovablePanel, 'stop', next);
    this.goTo(panel, rest, next);
  }

  /** The header button: Closer at Far, Push back at Near. */
  private toggleStop(): void {
    for (const [panel, rest] of this.rests) {
      if (!panel.hasComponent(Grabbed)) {
        panel.setValue(
          MovablePanel,
          'stop',
          rest.stop === ScreenStop.Far ? ScreenStop.Near : ScreenStop.Far,
        );
      }
    }
  }

  private renderReach(): void {
    const near = [...this.rests.values()].some(
      (rest) => rest.stop === ScreenStop.Near,
    );
    for (const label of this.reachLabels) {
      label.setProperties({ text: t(near ? 'screen.back' : 'screen.closer') });
    }
  }

  private goTo(panel: Entity, rest: Rest, stop: ScreenStopName): void {
    rest.stop = stop;
    rest.gliding = true;
    this.renderReach();
    if (stop === ScreenStop.Far) {
      rest.target.copy(rest.farPosition);
      rest.targetScale = rest.farScale;
      return;
    }
    // Near is placed from where the head is now, then stays put.
    this.player.head.getWorldPosition(this.head);
    const near = nearBar(this.head, rest.farScale, SCREEN_ABOVE_BAR);
    rest.target.set(near.x, near.y, near.z);
    panel.object3D!.parent?.worldToLocal(rest.target);
    rest.targetScale = near.scale;
  }

  private glide(
    object: NonNullable<Entity['object3D']>,
    rest: Rest,
    blend: number,
  ): void {
    object.position.lerp(rest.target, blend);
    const scale = object.scale.x + (rest.targetScale - object.scale.x) * blend;
    object.scale.setScalar(scale);
    if (
      object.position.distanceToSquared(rest.target) < 1e-6 &&
      Math.abs(scale - rest.targetScale) < 1e-4
    ) {
      object.position.copy(rest.target);
      object.scale.setScalar(rest.targetScale);
      rest.gliding = false;
    }
  }

  private distanceToHead(panel: Entity): number {
    this.player.head.getWorldPosition(this.head);
    return panel.object3D!.getWorldPosition(this.bar).distanceTo(this.head);
  }
}
