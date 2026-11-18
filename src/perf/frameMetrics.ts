import type { SceneComplexityReport } from './sceneComplexity';

export interface RenderCounters {
  shadowCalls?: number;
  shadowTriangles?: number;
  mainCalls?: number;
  mainTriangles?: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
}

export interface FrameSample extends RenderCounters {
  atMs: number;
  frameMs: number;
}

export interface FrameSummary {
  sampleCount: number;
  fps: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  slowOver33Ms: number;
  slowOver50Ms: number;
  drawCallsMean: number;
  drawCallsPeak: number;
  trianglesMean: number;
  trianglesPeak: number;
}

export interface ProfilerEnvironment {
  renderer: string;
  webglVersion: string;
  softwareMode: boolean;
  benchmarkContinuousFrames: boolean;
  scenario: 'combat' | 'overview';
  lighting: string;
  graphicsPreset?: string;
  objectDetail?: string;
  autoQuality?: boolean;
  targetFps?: number;
  adaptiveStep?: number;
  renderDpr?: number;
  shadowMapSize?: number;
  vegetation?: string;
  particles?: string;
  atmosphere?: string;
}

export interface DeviceMetadata {
  userAgent: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  hardwareConcurrency: number | null;
  deviceMemoryGB: number | null;
  jsHeapUsedBytes: number | null;
  jsHeapLimitBytes: number | null;
}

export interface CaptureReport {
  sceneInventory?: SceneComplexityReport;
  schemaVersion: 1;
  createdAt: string;
  requestedDurationMs: number;
  observedDurationMs: number;
  rendererStats: FrameSummary;
  frames: FrameSample[];
  environment: ProfilerEnvironment;
  device: DeviceMetadata;
  notes: string[];
}

export function percentile(sortedValues: readonly number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(q * sortedValues.length) - 1));
  return sortedValues[index];
}

/** Frame time means elapsed time between rAF render callbacks; it is not a GPU-timer query. */
export function summarizeFrames(samples: readonly FrameSample[]): FrameSummary {
  const n = samples.length;
  const empty: FrameSummary = {
    sampleCount: 0, fps: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0,
    worstMs: 0, slowOver33Ms: 0, slowOver50Ms: 0,
    drawCallsMean: 0, drawCallsPeak: 0, trianglesMean: 0, trianglesPeak: 0,
  };
  if (!n) return empty;
  const sorted = samples.map(s => s.frameMs).sort((a, b) => a - b);
  const duration = sorted.reduce((sum, ms) => sum + ms, 0);
  const sumCalls = samples.reduce((sum, s) => sum + s.calls, 0);
  const sumTriangles = samples.reduce((sum, s) => sum + s.triangles, 0);
  return {
    sampleCount: n,
    fps: duration > 0 ? 1000 * n / duration : 0,
    meanMs: duration / n,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    worstMs: sorted[n - 1],
    slowOver33Ms: samples.filter(s => s.frameMs > 33.33).length,
    slowOver50Ms: samples.filter(s => s.frameMs > 50).length,
    drawCallsMean: sumCalls / n,
    drawCallsPeak: Math.max(...samples.map(s => s.calls)),
    trianglesMean: sumTriangles / n,
    trianglesPeak: Math.max(...samples.map(s => s.triangles)),
  };
}

const EMPTY_COUNTERS: RenderCounters = {
  calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0,
};
const EMPTY_ENVIRONMENT: ProfilerEnvironment = {
  renderer: 'unavailable', webglVersion: 'unavailable', softwareMode: false,
  benchmarkContinuousFrames: false, scenario: 'overview', lighting: 'dusk',
};

interface CaptureSession {
  startedAt: number;
  endsAt: number;
  requestedDurationMs: number;
  frames: FrameSample[];
  environment: ProfilerEnvironment;
}

export class FrameProfiler {
  inventoryAtCaptureEnd?: () => SceneComplexityReport;
  enabled = false;
  private previousFrameTime: number | null = null;
  private rolling: FrameSample[] = [];
  private capture: CaptureSession | null = null;
  private completed: CaptureReport | null = null;
  private lastCounters: RenderCounters = EMPTY_COUNTERS;
  private environment: ProfilerEnvironment = EMPTY_ENVIRONMENT;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.previousFrameTime = null;
  }

  setEnvironment(info: ProfilerEnvironment): void {
    this.environment = info;
  }

  /** Called when paused or hidden; the first resumed frame must not include pause time. */
  interrupt(): void {
    this.previousFrameTime = null;
  }

  recordFrame(now: number, counters: RenderCounters): void {
    if (!this.enabled || !Number.isFinite(now)) return;
    this.lastCounters = { ...counters };
    const previous = this.previousFrameTime;
    this.previousFrameTime = now;
    if (previous !== null) {
      const ms = now - previous;
      if (ms > 0 && Number.isFinite(ms)) {
        const sample = { atMs: now, frameMs: ms, ...counters };
        this.rolling.push(sample);
        if (this.rolling.length > 240) this.rolling.shift();
        if (this.capture && now <= this.capture.endsAt) {
          this.capture.frames.push(sample);
        }
      }
    }
    this.finishIfDue(now);
  }

  startCapture(durationMs = 20_000, now = performance.now()): void {
    const requested = Math.max(1000, Math.min(60_000, durationMs));
    this.enabled = true;
    this.completed = null;
    this.rolling = [];
    this.previousFrameTime = null;
    this.capture = {
      startedAt: now, endsAt: now + requested, requestedDurationMs: requested,
      frames: [], environment: { ...this.environment },
    };
  }

  getStatus(now = performance.now()): { active: boolean; progress: number; frames: number } {
    this.finishIfDue(now);
    const active = this.capture;
    return {
      active: Boolean(active),
      progress: active ? Math.max(0, Math.min(1, (now - active.startedAt) / active.requestedDurationMs)) : 1,
      frames: active ? active.frames.length : this.completed?.frames.length ?? 0,
    };
  }

  getLive(): { stats: FrameSummary; counters: RenderCounters; environment: ProfilerEnvironment } {
    return {
      stats: summarizeFrames(this.rolling),
      counters: { ...this.lastCounters },
      environment: { ...this.environment },
    };
  }

  getReport(now = performance.now()): CaptureReport | null {
    this.finishIfDue(now);
    return this.completed;
  }

  private finishIfDue(now: number): void {
    const cap = this.capture;
    if (!cap || now < cap.endsAt) return;
    this.capture = null;
    this.completed = {
      schemaVersion: 1,
      sceneInventory: this.inventoryAtCaptureEnd?.(),
      createdAt: new Date().toISOString(),
      requestedDurationMs: cap.requestedDurationMs,
      observedDurationMs: now - cap.startedAt,
      rendererStats: summarizeFrames(cap.frames),
      frames: cap.frames,
      environment: cap.environment,
      device: readDeviceMetadata(),
      notes: [
        'FPS and frame time are rAF inter-frame intervals, not isolated CPU/GPU times.',
        'Three.js draw calls and triangles are WebGLRenderer.info counters sampled one frame behind.',
        'Browser APIs do not expose full GPU utilization or VRAM usage.',
        'Chrome mobile emulation is not a physical mobile device benchmark.',
        'A software WebGL renderer is not representative of hardware GPU FPS.',
      ],
    };
  }
}

function readDeviceMetadata(): DeviceMetadata {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: 'unknown',
      viewport: { width: 0, height: 0, devicePixelRatio: 1 },
      hardwareConcurrency: null, deviceMemoryGB: null,
      jsHeapUsedBytes: null, jsHeapLimitBytes: null,
    };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  return {
    userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio: devicePixelRatio },
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: nav.deviceMemory ?? null,
    jsHeapUsedBytes: perf.memory?.usedJSHeapSize ?? null,
    jsHeapLimitBytes: perf.memory?.jsHeapSizeLimit ?? null,
  };
}

export const frameProfiler = new FrameProfiler();
