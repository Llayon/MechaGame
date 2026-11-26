import * as THREE from 'three';
import {
  GROUND_LAST_BENCHMARK_ROUTES,
  MAX_SHADER_WATER_RIPPLES,
  type GroundLastRouteId,
  type ShaderWaterRipple,
  type TimingSummary,
  parseGroundLastFlag,
  selectTopWaterRipples,
  summarizeTimingSamples,
} from './renderPerfAndVfxMath';
import type { WaterVfxPoolState } from './objects/waterVfxPool';

// ============================================================================
// 1. Early-Z Ground Last live flag (`?groundLast=0|1`, default enabled)
// ============================================================================

let groundLastEnabled: boolean =
  typeof window !== 'undefined'
    ? parseGroundLastFlag(window.location.search, true)
    : true;

const groundLastListeners = new Set<(enabled: boolean) => void>();

export function getGroundLastEnabled(): boolean {
  return groundLastEnabled;
}

export function setGroundLastEnabled(enabled: boolean): void {
  const next = Boolean(enabled);
  if (groundLastEnabled === next) return;
  groundLastEnabled = next;
  for (const listener of groundLastListeners) {
    listener(next);
  }
}

export function subscribeGroundLastEnabled(
  listener: (enabled: boolean) => void,
): () => void {
  groundLastListeners.add(listener);
  return () => {
    groundLastListeners.delete(listener);
  };
}

// ============================================================================
// 2. Zero-allocation shared uniforms: Top-4 Water Ripples -> RiverWater shader
// ============================================================================

const ripplePosVecs: [THREE.Vector4, THREE.Vector4, THREE.Vector4, THREE.Vector4] = [
  new THREE.Vector4(0, 0, 0, 0),
  new THREE.Vector4(0, 0, 0, 0),
  new THREE.Vector4(0, 0, 0, 0),
  new THREE.Vector4(0, 0, 0, 0),
];

const rippleMetaVecs: [THREE.Vector4, THREE.Vector4, THREE.Vector4, THREE.Vector4] = [
  new THREE.Vector4(0, 1, 4, 0),
  new THREE.Vector4(0, 1, 4, 0),
  new THREE.Vector4(0, 1, 4, 0),
  new THREE.Vector4(0, 1, 4, 0),
];

const selectedRipplesScratch: ShaderWaterRipple[] = Array.from(
  { length: MAX_SHADER_WATER_RIPPLES },
  () => ({
    x: 0,
    z: 0,
    radius: 0,
    amplitude: 0,
    outerRadius: 0,
    invBandWidth: 1,
    waveFreq: 4,
    progress: 0,
  }),
);

export const WATER_RIPPLE_UNIFORMS = {
  /** xyz = (worldX, worldZ, crestRadius), w = slopeAmplitude */
  uWaterRipplePos: { value: ripplePosVecs },
  /** x = outerRadius, y = invBandWidth, z = waveFreq, w = progress */
  uWaterRippleMeta: { value: rippleMetaVecs },
  /** Number of active ripples in [0..4] (0 triggers single-branch shader early-out). */
  uWaterRippleCount: { value: 0 },
};

export function bindWaterRippleUniforms(
  uniforms: Record<string, THREE.IUniform>,
): void {
  uniforms.uWaterRipplePos = WATER_RIPPLE_UNIFORMS.uWaterRipplePos;
  uniforms.uWaterRippleMeta = WATER_RIPPLE_UNIFORMS.uWaterRippleMeta;
  uniforms.uWaterRippleCount = WATER_RIPPLE_UNIFORMS.uWaterRippleCount;
}

/**
 * Selects up to 4 closest/strongest active ripples from `WaterVfxPoolState` and writes them
 * into the shared RiverWater uniforms with zero per-frame allocations.
 */
export function syncWaterRipplesToRiver(
  pool: Readonly<WaterVfxPoolState>,
  focusX: number,
  focusZ: number,
): number {
  if (pool.activeRipples <= 0) {
    if (WATER_RIPPLE_UNIFORMS.uWaterRippleCount.value !== 0) {
      WATER_RIPPLE_UNIFORMS.uWaterRippleCount.value = 0;
    }
    return 0;
  }

  const count = selectTopWaterRipples(
    pool.ripples,
    focusX,
    focusZ,
    selectedRipplesScratch,
    MAX_SHADER_WATER_RIPPLES,
  );

  for (let i = 0; i < count; i++) {
    const r = selectedRipplesScratch[i];
    ripplePosVecs[i].set(r.x, r.z, r.radius, r.amplitude);
    rippleMetaVecs[i].set(r.outerRadius, r.invBandWidth, r.waveFreq, r.progress);
  }
  WATER_RIPPLE_UNIFORMS.uWaterRippleCount.value = count;
  return count;
}

export function clearRiverRipples(): void {
  WATER_RIPPLE_UNIFORMS.uWaterRippleCount.value = 0;
}

export const GLSL_WATER_RIPPLE_PARS = /* glsl */ `
uniform vec4 uWaterRipplePos[ ${MAX_SHADER_WATER_RIPPLES} ];
uniform vec4 uWaterRippleMeta[ ${MAX_SHADER_WATER_RIPPLES} ];
uniform float uWaterRippleCount;

vec2 s7SampleInteractiveRipples( vec2 wpXZ, float pixelSize ) {
  if ( uWaterRippleCount < 0.5 ) return vec2( 0.0 );
  float nyquistKeep = 1.0 / ( 1.0 + pixelSize * pixelSize * 1.45 );
  if ( nyquistKeep <= 0.005 ) return vec2( 0.0 );

  vec2 slope = vec2( 0.0 );
  for ( int i = 0; i < ${MAX_SHADER_WATER_RIPPLES}; i++ ) {
    if ( float( i ) >= uWaterRippleCount ) break;
    vec4 rp = uWaterRipplePos[ i ];
    vec4 rm = uWaterRippleMeta[ i ];
    vec2 dVec = wpXZ - rp.xy;
    float distSq = dot( dVec, dVec );
    float outerR = rm.x;
    if ( distSq > outerR * outerR || distSq < 1e-6 ) continue;

    float dist = sqrt( distSq );
    float delta = dist - rp.z;
    float u = delta * rm.y;
    float env = exp( -u * u * 1.85 );
    if ( env <= 0.004 ) continue;

    float phase = delta * rm.z;
    float dHdR = -rp.w * env * ( sin( phase ) * 0.85 + cos( phase ) * ( u * 0.55 ) );
    vec2 dir = dVec / dist;
    // PlaneGeometry rotated -PI/2 around X: tangent T = +X, bitangent B = -Z -> (-dH/dx, +dH/dz)
    slope += vec2( -dHdR * dir.x, dHdR * dir.y ) * nyquistKeep;
  }
  return slope;
}
`;

// ============================================================================
// 3. Non-blocking WebGL2 GPU Timer Query ring (`EXT_disjoint_timer_query_webgl2`)
// ============================================================================

interface DisjointTimerQueryExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuFrameTimer {
  private readonly gl: WebGL2RenderingContext | null;
  private readonly ext: DisjointTimerQueryExt | null;
  private readonly pending: WebGLQuery[] = [];
  private activeQuery: WebGLQuery | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    const ctx = renderer.getContext();
    if (typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext) {
      this.gl = ctx;
      this.ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2') as DisjointTimerQueryExt | null;
    } else {
      this.gl = null;
      this.ext = null;
    }
  }

  get hasGpuTimer(): boolean {
    return this.gl !== null && this.ext !== null;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  begin(): void {
    if (!this.gl || !this.ext || this.activeQuery) return;
    if (this.pending.length >= 32) return;
    const query = this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.activeQuery = query;
  }

  end(): void {
    if (!this.gl || !this.ext || !this.activeQuery) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.activeQuery);
    this.activeQuery = null;
  }

  /** Polls any completed GPU queries without stalling the pipeline; appends ms values into `out`. */
  poll(out: number[]): void {
    if (!this.gl || !this.ext || this.pending.length === 0) return;
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length > 0) {
      const q = this.pending[0];
      const available = this.gl.getQueryParameter(q, this.gl.QUERY_RESULT_AVAILABLE);
      if (!available) break;
      this.pending.shift();
      if (!disjoint) {
        const ns = Number(this.gl.getQueryParameter(q, this.gl.QUERY_RESULT));
        if (Number.isFinite(ns) && ns > 0) {
          out.push(ns / 1e6);
        }
      }
      this.gl.deleteQuery(q);
    }
  }

  /** Discards any in-flight queries so samples can never bleed across benchmark passes. */
  clearPending(): void {
    if (!this.gl) return;
    if (this.activeQuery) {
      if (this.ext) this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.gl.deleteQuery(this.activeQuery);
      this.activeQuery = null;
    }
    while (this.pending.length > 0) {
      const q = this.pending.shift();
      if (q) this.gl.deleteQuery(q);
    }
  }

  dispose(): void {
    this.clearPending();
  }
}

export interface BenchmarkPassResult {
  groundLast: boolean;
  frameTime: TimingSummary;
  gpuTime: TimingSummary | null;
}

export interface RouteBenchmarkReport {
  route: GroundLastRouteId;
  label: string;
  baseline: BenchmarkPassResult;
  groundLast: BenchmarkPassResult;
  deltaP50Ms: number;
  deltaP95Ms: number;
  metric: 'gpu' | 'frame';
}

export interface GroundLastBenchmarkReport {
  width: number;
  height: number;
  pixelRatio: number;
  timerMode: 'EXT_disjoint_timer_query_webgl2' | 'frame-wall-clock';
  routes: RouteBenchmarkReport[];
}

export interface GroundLastBenchmarkOptions {
  framesPerPass?: number;
  warmupFrames?: number;
  routes?: GroundLastRouteId[];
}

export interface Sector7PerfApi {
  getGroundLast: () => boolean;
  setGroundLast: (enabled: boolean) => boolean;
  setCameraPose: (pos: readonly [number, number, number], target: readonly [number, number, number]) => void;
  spawnTestRipple: (x?: number, z?: number, intensity?: number) => { x: number; z: number; intensity: number };
  runGroundLastBenchmark: (options?: GroundLastBenchmarkOptions) => Promise<GroundLastBenchmarkReport>;
  routes: typeof GROUND_LAST_BENCHMARK_ROUTES;
}

declare global {
  interface Window {
    __sector7Perf?: Sector7PerfApi;
  }
}
