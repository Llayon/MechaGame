import type { PineTreeInstance } from '../../map/worldStructures';

export const TREE_STATE_STANDING = 0;
export const TREE_STATE_FALLING = 1;
export const TREE_STATE_FALLEN = 2;

const GRID_CELL_SIZE = 8;
const FALL_SPEED = 1.45; // ~0.69s to reach ground impact
const BOUNCE_END = 1.24; // +0.16s bounce settle

function hashGridCell(gx: number, gz: number): number {
  return ((gx + 2048) << 12) | (gz + 2048);
}

export interface FallingTreeItem {
  index: number;
  axisX: number;
  axisZ: number;
  dirX: number;
  dirZ: number;
  progress: number;
  targetAngle: number;
  currentAngle: number;
  impactFired: boolean;
}

export interface TreeFallStartEvent {
  index: number;
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  heightScale: number;
}

export interface TreeGroundImpactEvent {
  index: number;
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  heightScale: number;
}

export interface FallingTreesState {
  trees: readonly PineTreeInstance[];
  states: Uint8Array;
  grid: Map<number, number[]>;
  active: FallingTreeItem[];
}

export function createFallingTreesState(trees: readonly PineTreeInstance[]): FallingTreesState {
  const states = new Uint8Array(trees.length);
  const grid = new Map<number, number[]>();

  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const gx = Math.floor(t.x / GRID_CELL_SIZE);
    const gz = Math.floor(t.z / GRID_CELL_SIZE);
    const key = hashGridCell(gx, gz);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  return {
    trees,
    states,
    grid,
    active: [],
  };
}

export function resetFallingTrees(state: FallingTreesState): number[] {
  const restoredIndices: number[] = [];
  for (let i = 0; i < state.states.length; i++) {
    if (state.states[i] !== TREE_STATE_STANDING) {
      state.states[i] = TREE_STATE_STANDING;
      restoredIndices.push(i);
    }
  }
  state.active.length = 0;
  return restoredIndices;
}

/**
 * Evaluates quadratic gravity + ground-impact bounce angle for normalized progress t in [0, BOUNCE_END].
 */
export function evaluateFallAngle(progress: number, targetAngle: number): number {
  if (progress <= 0) return 0;
  if (progress < 1.0) {
    return targetAngle * (progress * progress);
  }
  if (progress < BOUNCE_END) {
    const b = (progress - 1.0) / (BOUNCE_END - 1.0);
    return targetAngle - Math.sin(b * Math.PI) * 0.065;
  }
  return targetAngle;
}

/**
 * Checks only the 3x3 spatial hash cells around the Mech (~O(1)) for standing trees
 * inside `mechRadius`, initiating a terrain-adapted topple away from Mech center.
 */
export function checkFallingTreeCollisions(
  state: FallingTreesState,
  mechX: number,
  mechY: number,
  mechZ: number,
  mechRadius: number,
  getTerrainHeight: (x: number, z: number) => number,
  outEvents: TreeFallStartEvent[] = [],
): TreeFallStartEvent[] {
  outEvents.length = 0;
  const gx = Math.floor(mechX / GRID_CELL_SIZE);
  const gz = Math.floor(mechZ / GRID_CELL_SIZE);

  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const bucket = state.grid.get(hashGridCell(gx + ox, gz + oz));
      if (!bucket) continue;

      for (let k = 0; k < bucket.length; k++) {
        const idx = bucket[k];
        if (state.states[idx] !== TREE_STATE_STANDING) continue;

        const tree = state.trees[idx];
        if (Math.abs(mechY - tree.y) > 3.5) continue;

        const trunkHitR = mechRadius + Math.max(0.28, 0.34 * tree.widthScale);
        const dx = tree.x - mechX;
        const dz = tree.z - mechZ;
        const distSq = dx * dx + dz * dz;
        if (distSq >= trunkHitR * trunkHitR) continue;

        const dist = Math.sqrt(distSq);
        const dirX = dist > 1e-4 ? dx / dist : 0;
        const dirZ = dist > 1e-4 ? dz / dist : 1;

        // Probe terrain slope ahead of the falling crown so trunk rests cleanly on hillsides
        const sampleDist = Math.max(2.2, 2.2 * tree.heightScale);
        const groundAhead = getTerrainHeight(
          tree.x + dirX * sampleDist,
          tree.z + dirZ * sampleDist,
        );
        const slopeAngle = Math.atan2(tree.y - groundAhead, sampleDist);
        const targetAngle = Math.max(
          Math.PI * 0.32,
          Math.min(Math.PI * 0.64, Math.PI * 0.48 + slopeAngle),
        );

        // World rotation axis perpendicular to push direction (dirX, 0, dirZ):
        // up(0,1,0) x axis(-dirZ, 0, dirX) rotates +Y toward +dir! Wait:
        // Right-hand rule: rotating (0, 1, 0) around (dirZ, 0, -dirX) moves +Y -> (+dirX, 0, +dirZ)!
        // Let's verify: (dirZ, 0, -dirX) x (0, 1, 0) = (0 - (-dirX)*1, 0, dirZ*1 - 0) = (+dirX, 0, +dirZ)!
        const axisX = dirZ;
        const axisZ = -dirX;

        state.states[idx] = TREE_STATE_FALLING;
        state.active.push({
          index: idx,
          axisX,
          axisZ,
          dirX,
          dirZ,
          progress: 0,
          targetAngle,
          currentAngle: 0,
          impactFired: false,
        });

        outEvents.push({
          index: idx,
          x: tree.x,
          y: tree.y,
          z: tree.z,
          dirX,
          dirZ,
          heightScale: tree.heightScale,
        });
      }
    }
  }

  return outEvents;
}

/**
 * Advances only actively falling trees (typically 0..5 trees) and emits ground-impact events.
 */
export function stepFallingTrees(
  state: FallingTreesState,
  dt: number,
  outDirty: FallingTreeItem[] = [],
  outImpacts: TreeGroundImpactEvent[] = [],
): { dirty: FallingTreeItem[]; impacts: TreeGroundImpactEvent[] } {
  outDirty.length = 0;
  outImpacts.length = 0;
  if (state.active.length === 0 || dt <= 0) {
    return { dirty: outDirty, impacts: outImpacts };
  }

  for (let i = state.active.length - 1; i >= 0; i--) {
    const item = state.active[i];
    item.progress += dt * FALL_SPEED;

    if (item.progress >= 1.0 && !item.impactFired) {
      item.impactFired = true;
      const tree = state.trees[item.index];
      const crownDist = Math.max(1.8, 1.8 * tree.heightScale);
      outImpacts.push({
        index: item.index,
        x: tree.x + item.dirX * crownDist,
        y: tree.y + 0.35,
        z: tree.z + item.dirZ * crownDist,
        dirX: item.dirX,
        dirZ: item.dirZ,
        heightScale: tree.heightScale,
      });
    }

    item.currentAngle = evaluateFallAngle(item.progress, item.targetAngle);
    outDirty.push(item);

    if (item.progress >= BOUNCE_END) {
      item.currentAngle = item.targetAngle;
      state.states[item.index] = TREE_STATE_FALLEN;
      state.active.splice(i, 1);
    }
  }

  return { dirty: outDirty, impacts: outImpacts };
}
