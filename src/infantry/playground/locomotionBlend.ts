import type { AnimationAction } from 'three';

interface Layer {
  action: AnimationAction;
  weight: number;
  startWeight: number;
  authoredSpeed: number;
}

const BLEND_SECONDS = .18;

/** Keep interrupted fades continuous and retire actions when their weight reaches zero. */
export class LocomotionBlend {
  private readonly layers: Layer[] = [];
  private target?: Layer;
  private elapsed = 0;

  play(action: AnimationAction, authoredSpeed: number, startTime: number, restart: boolean) {
    let incoming = this.layers.find(layer => layer.action === action);
    if (!incoming) {
      incoming = { action, authoredSpeed, weight: this.target ? 0 : 1, startWeight: 0 };
      this.layers.push(incoming);
      action.reset().play();
      action.time = startTime;
    } else if (restart) {
      action.reset().play();
      action.time = startTime;
    }
    this.target = incoming;
    this.elapsed = 0;
    for (const layer of this.layers) {
      layer.startWeight = layer.weight;
      layer.action.setEffectiveWeight(layer.weight);
    }
  }

  update(dt: number, speed: number) {
    this.elapsed = Math.min(this.elapsed + dt, BLEND_SECONDS);
    const phase = this.elapsed / BLEND_SECONDS;
    const blend = phase * phase * (3 - 2 * phase);
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      const destination = layer === this.target ? 1 : 0;
      layer.weight = layer.startWeight + (destination - layer.startWeight) * blend;
      if (destination === 0 && phase === 1) {
        layer.action.stop();
        this.layers.splice(i, 1);
        continue;
      }
      layer.action.setEffectiveWeight(layer.weight);
      layer.action.setEffectiveTimeScale(layer.authoredSpeed > 0 ? Math.max(.05, speed / layer.authoredSpeed) : 1);
    }
  }

  reset() {
    for (const layer of this.layers) layer.action.stop();
    this.layers.length = 0;
    this.target = undefined;
    this.elapsed = 0;
  }
}
