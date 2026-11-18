export const MAX_MISSILE_RIBBONS = 48;
export const RIBBON_SEGMENTS = 16;
export const RIBBON_POINTS = RIBBON_SEGMENTS + 1;
const MIN_SPINE_STEP_SQ = 0.28; // ~0.53u (~2 m) between anchored spine points

export interface MissileRibbonSlot {
  active: boolean;
  fadingOut: boolean;
  alpha: number;
  historyX: Float32Array;
  historyY: Float32Array;
  historyZ: Float32Array;
}

export interface MissileRibbonPoolState {
  slots: MissileRibbonSlot[];
  cursor: number;
  activeCount: number;
  dirty: boolean;
}

function createEmptyRibbonSlot(): MissileRibbonSlot {
  return {
    active: false,
    fadingOut: false,
    alpha: 0,
    historyX: new Float32Array(RIBBON_POINTS),
    historyY: new Float32Array(RIBBON_POINTS),
    historyZ: new Float32Array(RIBBON_POINTS),
  };
}

export function createMissileRibbonPool(
  capacity = MAX_MISSILE_RIBBONS,
): MissileRibbonPoolState {
  return {
    slots: Array.from({ length: capacity }, createEmptyRibbonSlot),
    cursor: 0,
    activeCount: 0,
    dirty: false,
  };
}

export function resetMissileRibbonPool(pool: MissileRibbonPoolState): void {
  for (let i = 0; i < pool.slots.length; i++) {
    const slot = pool.slots[i];
    slot.active = false;
    slot.fadingOut = false;
    slot.alpha = 0;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
  pool.dirty = true;
}

export function spawnMissileRibbon(
  pool: MissileRibbonPoolState,
  startX: number,
  startY: number,
  startZ: number,
): number {
  const capacity = pool.slots.length;
  if (capacity === 0) return -1;

  const idx = pool.cursor;
  pool.cursor = (pool.cursor + 1) % capacity;
  const slot = pool.slots[idx];
  const wasActive = slot.active;

  slot.active = true;
  slot.fadingOut = false;
  slot.alpha = 1.0;

  for (let p = 0; p < RIBBON_POINTS; p++) {
    slot.historyX[p] = startX;
    slot.historyY[p] = startY;
    slot.historyZ[p] = startZ;
  }

  if (!wasActive) {
    pool.activeCount += 1;
  }
  pool.dirty = true;
  return idx;
}

export function updateMissileRibbonHead(
  pool: MissileRibbonPoolState,
  ribbonIdx: number,
  x: number,
  y: number,
  z: number,
): void {
  const slot = pool.slots[ribbonIdx];
  if (!slot || !slot.active) return;

  slot.historyX[0] = x;
  slot.historyY[0] = y;
  slot.historyZ[0] = z;

  const dx = x - slot.historyX[1];
  const dy = y - slot.historyY[1];
  const dz = z - slot.historyZ[1];
  if (dx * dx + dy * dy + dz * dz >= MIN_SPINE_STEP_SQ) {
    for (let p = RIBBON_POINTS - 1; p > 0; p--) {
      slot.historyX[p] = slot.historyX[p - 1];
      slot.historyY[p] = slot.historyY[p - 1];
      slot.historyZ[p] = slot.historyZ[p - 1];
    }
  }
  pool.dirty = true;
}

export function releaseMissileRibbon(
  pool: MissileRibbonPoolState,
  ribbonIdx: number,
): void {
  const slot = pool.slots[ribbonIdx];
  if (!slot || !slot.active) return;
  slot.fadingOut = true;
  pool.dirty = true;
}

export function stepMissileRibbonPool(
  pool: MissileRibbonPoolState,
  dt: number,
): number {
  if (dt <= 0) return pool.activeCount;
  let activeCount = 0;
  for (let i = 0; i < pool.slots.length; i++) {
    const slot = pool.slots[i];
    if (!slot.active) continue;
    if (slot.fadingOut) {
      slot.alpha -= dt * 1.35;
      if (slot.alpha <= 0) {
        slot.alpha = 0;
        slot.active = false;
        slot.fadingOut = false;
        pool.dirty = true;
        continue;
      }
      pool.dirty = true;
    }
    activeCount++;
  }
  pool.activeCount = activeCount;
  return activeCount;
}
