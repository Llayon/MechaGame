import type { LightingPreset } from '../map/sectors';

/**
 * Pure TypeScript reference math for Sector 7's visual polish package:
 * 1. Global geometric Specular Anti-Aliasing (perturbed-normal curvature roughness)
 * 2. Gravitational waterfall acceleration (`tau = sqrt(h + 0.06)`) & rope/froth profile
 * 3. Waterline contact darkening & canyon horizon reflection band
 * 4. Analytic 3D interior room ray-trace for tactical building windows
 */

export const SPECULAR_AA_CONFIG = Object.freeze({
  /** Gain applied to `|dFdx(N)|^2 + |dFdy(N)|^2` (matches Atlantis `2.0 * 0.25 = 0.5`). */
  curvatureGain: 0.5,
  /** Maximum variance added to roughness^2 so smooth faces stay crisp while edges calm down. */
  maxVariance: 0.18,
  /** Clearcoat variance scale relative to base lobe. */
  clearcoatScale: 0.75,
});

export const WATERFALL_GRAVITY_CONFIG = Object.freeze({
  /** Reference fall height (meters) for `heightScale = 1.0`. */
  referenceFallMeters: 14.0,
  /** Small lip offset inside `sqrt(h + lipOffset)` to avoid infinite derivative at crest. */
  lipOffset: 0.06,
  /** Distance from lip where smooth water film begins breaking into frothy strands. */
  ropeStartMeters: 0.18,
  /** Distance from lip where frothy strands reach full development. */
  ropeFullMeters: 3.8,
});

export const WATER_CONTACT_CONFIG = Object.freeze({
  /** Minimum brightness factor directly at zero-depth shoreline contact. */
  shoreMinFactor: 0.58,
  /** Depth (world units) over which the dark waterline contact line fades out. */
  shoreFadeDepth: 0.34,
  /** Minimum brightness factor directly against bridge piers / quay walls. */
  pierMinFactor: 0.68,
  /** Obstacle distance (world units) over which pier contact darkening fades out. */
  pierFadeDist: 0.42,
  /** Grazing reflection damping factor near shallow cliffs/walls. */
  shallowSpecMin: 0.76,
  /** Depth over which shallow canyon reflection damping releases. */
  shallowSpecFadeDepth: 2.2,
});

export interface InteriorWindowPreset {
  /** Overall interior emissive brightness multiplier (dim reflective glass by day, vivid at night). */
  glowScale: number;
  /** Warm amber industrial room linear RGB tint. */
  amberLinearRgb: readonly [number, number, number];
  /** Tactical cyan console/radar room linear RGB tint. */
  cyanLinearRgb: readonly [number, number, number];
  /** Exterior tinted glass base roughness. */
  glassRoughness: number;
}

export const INTERIOR_WINDOW_PRESETS: Record<LightingPreset, InteriorWindowPreset> = {
  day: {
    glowScale: 0.24,
    amberLinearRgb: [0.95, 0.56, 0.22],
    cyanLinearRgb: [0.16, 0.76, 0.92],
    glassRoughness: 0.12,
  },
  dusk: {
    glowScale: 1.08,
    amberLinearRgb: [1.0, 0.52, 0.16],
    cyanLinearRgb: [0.12, 0.82, 1.0],
    glassRoughness: 0.14,
  },
  night: {
    glowScale: 1.72,
    amberLinearRgb: [1.0, 0.54, 0.17],
    cyanLinearRgb: [0.14, 0.88, 1.0],
    glassRoughness: 0.15,
  },
};

export interface CanyonHorizonPreset {
  ridgeColor: string;
  pineColor: string;
  valleyColor: string;
  rimHighlight: string;
}

export const CANYON_HORIZON_PRESETS: Record<LightingPreset, CanyonHorizonPreset> = {
  day: {
    ridgeColor: '#3A4652',
    pineColor: '#243428',
    valleyColor: '#485240',
    rimHighlight: '#6E8599',
  },
  dusk: {
    ridgeColor: '#252630',
    pineColor: '#19221C',
    valleyColor: '#262324',
    rimHighlight: '#7A5442',
  },
  night: {
    ridgeColor: '#0A1019',
    pineColor: '#070E11',
    valleyColor: '#060A11',
    rimHighlight: '#18283B',
  },
};

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Pure TS mirror of Atlantis geometric Specular Anti-Aliasing.
 * Widens microfacet roughness on curved/bumped sub-pixel normals without dulling flat planes.
 */
export function computeGeometricSpecularAa(
  baseRoughness: number,
  normalGradSqSum: number,
): number {
  const r = clamp(baseRoughness, 0.045, 1.0);
  const gradSq = Math.max(0, Number.isFinite(normalGradSqSum) ? normalGradSqSum : 0);
  const kr = Math.min(
    SPECULAR_AA_CONFIG.curvatureGain * gradSq,
    SPECULAR_AA_CONFIG.maxVariance,
  );
  return Math.min(1.0, Math.sqrt(r * r + kr));
}

export interface WaterfallGravityProfile {
  /** Fallen distance from crest lip in meters (`0` at lip -> `referenceFallMeters * heightScale` at base). */
  fallenMeters: number;
  /** Remaining distance to plunge pool in meters. */
  remainingMeters: number;
  /** Non-linear gravitational flow coordinate `sqrt(h + lipOffset)`. */
  tau: number;
  /** Local vertical streak stretch factor proportional to instantaneous velocity (`sqrt(h + lipOffset)`). */
  velocityStretch: number;
  /** `[0..1]` breakup envelope from smooth crest film (`0`) to aerated frothy strands (`1`). */
  ropeBreakup: number;
  /** `[0..1]` churning foot foam envelope near plunge impact. */
  footChurn: number;
}

/**
 * Pure TS mirror of gravitational waterfall flow (`tau = sqrt(h + 0.06)`).
 * `uvY = 1` is the top crest lip; `uvY = 0` is the river plunge impact.
 */
export function computeWaterfallGravityProfile(
  uvY: number,
  heightScale = 1.0,
): WaterfallGravityProfile {
  const cfg = WATERFALL_GRAVITY_CONFIG;
  const hScale = Math.max(0.5, Number.isFinite(heightScale) ? heightScale : 1.0);
  const totalMeters = cfg.referenceFallMeters * hScale;
  const fallFrac = clamp(1.0 - uvY, 0.0, 1.0);
  const fallenMeters = fallFrac * totalMeters;
  const remainingMeters = (1.0 - fallFrac) * totalMeters;
  const tau = Math.sqrt(fallenMeters + cfg.lipOffset);
  const velocityStretch = tau / Math.sqrt(cfg.lipOffset);
  const ropeBreakup = smoothstep(cfg.ropeStartMeters, cfg.ropeFullMeters, fallenMeters);
  const footReach = Math.min(3.4, 0.28 * totalMeters);
  const footChurn = 1.0 - smoothstep(0.0, Math.max(0.25, footReach), remainingMeters);

  return {
    fallenMeters,
    remainingMeters,
    tau,
    velocityStretch,
    ropeBreakup,
    footChurn,
  };
}

export interface WaterContactResult {
  /** Combined dark meniscus multiplier `[shoreMinFactor * pierMinFactor .. 1.0]`. */
  contactFactor: number;
  /** Indirect specular damping near shallow shore/cliffs `[shallowSpecMin .. 1.0]`. */
  shallowSpecularFactor: number;
}

/**
 * Pure TS mirror of RiverWater shoreline/pier contact darkening and shallow cliff reflection damping.
 */
export function computeWaterContact(
  depth: number,
  obstDist: number,
): WaterContactResult {
  const cfg = WATER_CONTACT_CONFIG;
  const d = Math.max(0, Number.isFinite(depth) ? depth : 0);
  const o = Math.max(0, Number.isFinite(obstDist) ? obstDist : 10);

  const shoreT = smoothstep(0.0, cfg.shoreFadeDepth, d);
  const shoreFactor = cfg.shoreMinFactor + (1.0 - cfg.shoreMinFactor) * shoreT;

  const pierT = smoothstep(0.0, cfg.pierFadeDist, o);
  const pierFactor = cfg.pierMinFactor + (1.0 - cfg.pierMinFactor) * pierT;

  const specT = smoothstep(0.0, cfg.shallowSpecFadeDepth, d);
  const shallowSpecularFactor =
    cfg.shallowSpecMin + (1.0 - cfg.shallowSpecMin) * specT;

  return {
    contactFactor: clamp(shoreFactor * pierFactor, 0.42, 1.0),
    shallowSpecularFactor,
  };
}

export type InteriorHitSide = 'back' | 'side' | 'floor' | 'ceiling';
export type InteriorRoomKind = 'amber' | 'cyan' | 'dim';

export interface InteriorRayResult {
  side: InteriorHitSide;
  /** Normalized depth along room `[0..1]`, where `1` is the back wall. */
  depthT: number;
  /** Hit point coordinate inside `[0..1] x [0..1]`. */
  hitU: number;
  hitV: number;
  /** Room lighting category chosen deterministically from `roomSeed`. */
  roomKind: InteriorRoomKind;
  /** Whether the pane features half-drawn tactical blinds. */
  hasBlinds: boolean;
}

/**
 * Pure TS mirror of the analytic 3D room box intersection used in the Interior Mapping fragment shader.
 */
export function traceInteriorRoom(
  u: number,
  v: number,
  slopeX: number,
  slopeY: number,
  roomSeed: number,
): InteriorRayResult {
  const lu = clamp(u, 0, 1);
  const lv = clamp(v, 0, 1);
  const sx = Number.isFinite(slopeX) ? slopeX : 0;
  const sy = Number.isFinite(slopeY) ? slopeY : 0;
  const seed = ((roomSeed % 1) + 1) % 1;

  let t = 1.0;
  let side: InteriorHitSide = 'back';

  if (Math.abs(sx) > 1e-4) {
    const ts = ((sx > 0 ? 1.0 : 0.0) - lu) / sx;
    if (ts >= 0 && ts < t) {
      t = ts;
      side = 'side';
    }
  }
  if (Math.abs(sy) > 1e-4) {
    const tf = ((sy > 0 ? 1.0 : 0.0) - lv) / sy;
    if (tf >= 0 && tf < t) {
      t = tf;
      side = sy < 0 ? 'floor' : 'ceiling';
    }
  }

  const hitU = clamp(lu + sx * t, 0, 1);
  const hitV = clamp(lv + sy * t, 0, 1);

  const roomKind: InteriorRoomKind =
    seed < 0.56 ? 'amber' : seed < 0.84 ? 'cyan' : 'dim';
  const hasBlinds = seed > 0.52;

  return {
    side,
    depthT: clamp(t, 0, 1),
    hitU,
    hitV,
    roomKind,
    hasBlinds,
  };
}
