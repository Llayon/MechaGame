export const MAX_TRACER_INSTANCES = 128;

export interface TracerSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  speed: number;
  life: number;
  maxLife: number;
  length: number;
  thickness: number;
  r: number;
  g: number;
  b: number;
  isRicochet: boolean;
}

export interface TracerPoolState {
  slots: TracerSlot[];
  cursor: number;
  activeCount: number;
}

export interface SpawnTracerOptions {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  speed?: number;
  maxLife?: number;
  length?: number;
  thickness?: number;
  r?: number;
  g?: number;
  b?: number;
  isRicochet?: boolean;
}

export interface Vec3Out {
  x: number;
  y: number;
  z: number;
}

export function createTracerPool(capacity = MAX_TRACER_INSTANCES): TracerPoolState {
  return {
    slots: Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      dx: 0,
      dy: 0,
      dz: 1,
      speed: 72,
      life: 0,
      maxLife: 0.5,
      length: 1.65,
      thickness: 0.085,
      r: 1.0,
      g: 0.86,
      b: 0.42,
      isRicochet: false,
    })),
    cursor: 0,
    activeCount: 0,
  };
}

export function resetTracerPool(pool: TracerPoolState): void {
  for (let i = 0; i < pool.slots.length; i++) {
    pool.slots[i].active = false;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
}

/**
 * Computes normalized reflected ricochet vector R = D - 2*(D·N)*N with slight deterministic scatter.
 * Returns false if surface normal is invalid or ray moves away from surface.
 */
export function computeRicochetDirection(
  dx: number,
  dy: number,
  dz: number,
  nx: number,
  ny: number,
  nz: number,
  seed: number,
  out: Vec3Out,
): boolean {
  const dLen = Math.hypot(dx, dy, dz);
  const nLen = Math.hypot(nx, ny, nz);
  if (dLen < 1e-6 || nLen < 1e-6) return false;
  const idx = dx / dLen;
  const idy = dy / dLen;
  const idz = dz / dLen;
  const inx = nx / nLen;
  const iny = ny / nLen;
  const inz = nz / nLen;

  const dot = idx * inx + idy * iny + idz * inz;
  if (dot >= -0.02) return false;

  let rx = idx - 2 * dot * inx;
  let ry = idy - 2 * dot * iny;
  let rz = idz - 2 * dot * inz;

  const s1 = Math.sin(seed * 12.9898 + 1.3) * 43758.5453;
  const s2 = Math.sin(seed * 78.233 + 4.7) * 29154.3123;
  const s3 = Math.sin(seed * 37.719 + 9.1) * 18423.7291;
  const jx = (s1 - Math.floor(s1) - 0.5) * 0.24;
  const jy = Math.abs(s2 - Math.floor(s2)) * 0.22;
  const jz = (s3 - Math.floor(s3) - 0.5) * 0.24;

  rx += jx;
  ry += jy;
  rz += jz;

  const rDotN = rx * inx + ry * iny + rz * inz;
  if (rDotN < 0.08) {
    rx += inx * (0.12 - rDotN);
    ry += iny * (0.12 - rDotN);
    rz += inz * (0.12 - rDotN);
  }

  const rLen = Math.hypot(rx, ry, rz);
  if (rLen < 1e-6) return false;
  out.x = rx / rLen;
  out.y = ry / rLen;
  out.z = rz / rLen;
  return true;
}

export function spawnTracer(
  pool: TracerPoolState,
  opts: SpawnTracerOptions,
): number {
  const len = Math.hypot(opts.dx, opts.dy, opts.dz);
  if (len < 1e-6) return -1;
  const capacity = pool.slots.length;
  if (capacity === 0) return -1;

  const idx = pool.cursor % capacity;
  pool.cursor = (pool.cursor + 1) % capacity;
  const slot = pool.slots[idx];

  const wasActive = slot.active;
  slot.active = true;
  slot.x = opts.x;
  slot.y = opts.y;
  slot.z = opts.z;
  slot.dx = opts.dx / len;
  slot.dy = opts.dy / len;
  slot.dz = opts.dz / len;
  slot.speed = opts.speed ?? (opts.isRicochet ? 48 : 74);
  slot.life = 0;
  slot.maxLife = Math.max(0.025, opts.maxLife ?? (opts.isRicochet ? 0.22 : 0.72));
  slot.length = opts.length ?? (opts.isRicochet ? 1.05 : 1.75);
  slot.thickness = opts.thickness ?? (opts.isRicochet ? 0.068 : 0.09);
  slot.r = opts.r ?? (opts.isRicochet ? 1.0 : 1.0);
  slot.g = opts.g ?? (opts.isRicochet ? 0.56 : 0.88);
  slot.b = opts.b ?? (opts.isRicochet ? 0.16 : 0.44);
  slot.isRicochet = !!opts.isRicochet;

  if (!wasActive) {
    pool.activeCount += 1;
  }
  return idx;
}

const _ricochetDir: Vec3Out = { x: 0, y: 1, z: 0 };

/**
 * Spawns a ricochet tracer bouncing off an impact point when grazing angle or deflection check passes.
 */
export function maybeSpawnRicochetTracer(
  pool: TracerPoolState,
  hitX: number,
  hitY: number,
  hitZ: number,
  inDx: number,
  inDy: number,
  inDz: number,
  nx: number,
  ny: number,
  nz: number,
  seed: number,
  alwaysOnGrazing = true,
): boolean {
  const dLen = Math.hypot(inDx, inDy, inDz);
  const nLen = Math.hypot(nx, ny, nz);
  if (dLen < 1e-6 || nLen < 1e-6) return false;
  const cosIncidence = Math.abs(
    (inDx * nx + inDy * ny + inDz * nz) / (dLen * nLen),
  );
  const h = Math.sin(seed * 91.37 + hitX * 3.1 + hitZ * 7.7) * 43758.5453;
  const rand = h - Math.floor(h);
  const shouldBounce = alwaysOnGrazing
    ? cosIncidence < 0.62 || rand < 0.36
    : rand < 0.42;
  if (!shouldBounce) return false;

  if (!computeRicochetDirection(inDx, inDy, inDz, nx, ny, nz, seed, _ricochetDir)) {
    return false;
  }

  const off = 0.08;
  spawnTracer(pool, {
    x: hitX + (nx / nLen) * off,
    y: hitY + (ny / nLen) * off,
    z: hitZ + (nz / nLen) * off,
    dx: _ricochetDir.x,
    dy: _ricochetDir.y,
    dz: _ricochetDir.z,
    speed: 42 + rand * 16,
    maxLife: 0.16 + rand * 0.12,
    length: 0.95 + rand * 0.45,
    thickness: 0.068,
    r: 1.0,
    g: 0.54,
    b: 0.14,
    isRicochet: true,
  });
  return true;
}

export function stepTracerPool(pool: TracerPoolState, rawDt: number): number {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  let activeCount = 0;

  for (let i = 0; i < pool.slots.length; i++) {
    const s = pool.slots[i];
    if (!s.active) continue;

    s.life += dt;
    if (s.life >= s.maxLife) {
      s.active = false;
      continue;
    }

    const stepDist = s.speed * dt;
    s.x += s.dx * stepDist;
    s.y += s.dy * stepDist;
    s.z += s.dz * stepDist;
    if (s.isRicochet) {
      s.dy = Math.max(-0.95, s.dy - 0.55 * dt);
    }
    activeCount++;
  }

  pool.activeCount = activeCount;
  return activeCount;
}
