import { createSystem, Vector3 } from '@iwsdk/core';
import { MovablePanel } from './movable-panel-component.js';

// A moved panel stays inside this box around the table, so it can always
// be reached again and never sinks below the floor or leaves the room.
const MIN = new Vector3(-1.6, 0.45, -1.8);
const MAX = new Vector3(1.6, 2.0, 0.25);

export class MovablePanelSystem extends createSystem({
  panels: { required: [MovablePanel] },
}) {
  update(): void {
    for (const panel of this.queries.panels.entities) {
      const position = panel.object3D!.position;
      position.x = Math.min(Math.max(position.x, MIN.x), MAX.x);
      position.y = Math.min(Math.max(position.y, MIN.y), MAX.y);
      position.z = Math.min(Math.max(position.z, MIN.z), MAX.z);
    }
  }
}
