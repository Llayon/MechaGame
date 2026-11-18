import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ComponentRef } from 'react';
import * as THREE from 'three';
import { frameProfiler, percentile } from '../perf/frameMetrics';
import { withGraphicsPreset, resolveGraphicsRuntime } from '../game/graphicsSettings';
import { analyzeSceneComplexity } from '../perf/sceneComplexity';
import { createGpuInfantry, disposeInfantryData, loadInfantryData } from './gpuAnimation';
import type { InfantryData } from './gpuAnimation';
import { ANIMATIONS, DEFAULT_LAB } from './types';
import type { LabSettings } from './types';
import { MechReference } from './MechReference';
import './lab.css';

interface UpdateSample { at: number; jsMs: number; matrices: number; gpuMs: number | null }
interface RuntimeView {
  ready: boolean; settings: LabSettings; capabilities: Record<string, unknown>;
  sourceTriangles: number; activeInstances: number; batches: number;
  resourceBytes: Record<string, number>; cpuSkeletonUpdates: number;
  matrixUpdatesLastFrame: number; uniformUpdatesLastFrame: number;
  calls: number; triangles: number; geometries: number; textures: number;
  instances: Array<{ id: number; animation: string; phase: number; alive: boolean }>;
  gameMissionMounted: false; time: number;
}
interface LabApi {
  configure(patch: Partial<LabSettings>): void;
  inspect(): RuntimeView | null;
  setTime(seconds: number | null): void;
  capture(warmupMs?: number, durationMs?: number): Promise<unknown>;
  audit(): ReturnType<typeof analyzeSceneComplexity> | null;
}
declare global { interface Window { __infantryLab?: LabApi } }

/** Optional timer-query measurements; never confuse rAF time with GPU time. */
class GpuTimer {
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  lastMs: number | null = null;
  sequence = 0;
  constructor(private context: WebGL2RenderingContext) { this.ext = context.getExtension('EXT_disjoint_timer_query_webgl2'); }
  begin() {
    if (!this.ext) return;
    while (this.pending.length && this.context.getQueryParameter(this.pending[0], this.context.QUERY_RESULT_AVAILABLE)) {
      const q = this.pending.shift()!;
      if (!this.context.getParameter(this.ext.GPU_DISJOINT_EXT)) this.lastMs = this.context.getQueryParameter(q, this.context.QUERY_RESULT) / 1e6;
      else this.lastMs = null;
      this.sequence++;
      this.context.deleteQuery(q);
    }
    if (this.pending.length >= 8) return;
    this.active = this.context.createQuery();
    if (this.active) this.context.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
  }
  end() { if (this.ext && this.active) { this.context.endQuery(this.ext.TIME_ELAPSED_EXT); this.pending.push(this.active); this.active = null; } }
  dispose() { if (this.active) this.end(); this.pending.forEach(q => this.context.deleteQuery(q)); this.pending = []; }
}

function Stage({ data, settings, view, samples, frozen, audit }: {
  data: InfantryData; settings: LabSettings;
  view: React.MutableRefObject<RuntimeView | null>; samples: React.MutableRefObject<UpdateSample[]>;
  frozen: React.MutableRefObject<number | null>; audit: React.MutableRefObject<LabApi['audit']>;
}) {
  const { gl, camera, scene } = useThree();
  const gpu = useMemo(() => createGpuInfantry(data, settings), [data, settings]);
  const started = useRef(performance.now());
  const orbit = useRef<ComponentRef<typeof OrbitControls>>(null), lastTravel = useRef(0);
  const initialized = useRef(false), lastGpuSequence = useRef(0);
  const timer = useMemo(() => new GpuTimer(gl.getContext() as WebGL2RenderingContext), [gl]);
  const [software, setSoftware] = useState(false);
  const runtime = resolveGraphicsRuntime(withGraphicsPreset(settings.preset), devicePixelRatio, software);
  useEffect(() => { gl.setPixelRatio(runtime.dpr); }, [gl, runtime.dpr]);
  useEffect(() => { started.current = performance.now(); lastTravel.current = 0; return () => gpu.dispose(); }, [gpu]);
  useEffect(() => () => timer.dispose(), [timer]);
  useEffect(() => {
    const context = gl.getContext();
    const ext = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(context.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : context.RENDERER));
    const isSoftware = /swiftshader|llvmpipe|software/i.test(renderer); setSoftware(isSoftware);
    if (context.getParameter(context.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1 ||
        Math.max(data.atlas.width, data.atlas.heightTexels) > context.getParameter(context.MAX_TEXTURE_SIZE)) {
      throw Error('DEVICE UNSUPPORTED: vertex texture sampling/atlas dimensions');
    }
    frameProfiler.setEnvironment({ renderer, webglVersion: String(context.getParameter(context.VERSION)),
      softwareMode: isSoftware, benchmarkContinuousFrames: true, scenario: 'infantry', lighting: 'lab-studio',
      graphicsPreset: settings.preset, renderDpr: runtime.dpr,
      shadowMapSize: settings.shadows && runtime.shadowEnabled ? runtime.shadowMapSize : 0 });
    frameProfiler.setEnabled(true);
    if (!initialized.current) { frameProfiler.interrupt(); initialized.current = true; }
    audit.current = () => analyzeSceneComplexity(scene);
    view.current = {
      ready: true, settings, gameMissionMounted: false, sourceTriangles: (data.mesh.geometry.index?.count ?? 0) / 3,
      activeInstances: gpu.instances.length, batches: gpu.meshes.length,
      resourceBytes: gpu.resourceBytes, cpuSkeletonUpdates: 0, matrixUpdatesLastFrame: 0, uniformUpdatesLastFrame: 1,
      calls: 0, triangles: 0, geometries: 0, textures: 0, time: 0,
      instances: gpu.instances.map(s => ({ id: s.id, animation: s.animation, phase: s.animationPhase, alive: s.alive })),
      capabilities: { renderer, softwareMode: isSoftware, webgl2: true,
        maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE),
        vertexTextureUnits: context.getParameter(context.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        atlasFormat: 'RGBA16F / nearest sampling / manual quaternion interpolation',
        floatRenderTargetRequired: false, floatLinearFilteringRequired: false,
        gpuTimerAvailable: !!context.getExtension('EXT_disjoint_timer_query_webgl2'),
        physicalMobileVerified: false },
    };
    return () => { view.current = null; audit.current = () => null; };
  }, [gl, camera, scene, gpu, data, settings, runtime.dpr, runtime.shadowEnabled, runtime.shadowMapSize, audit, view]);
  useEffect(() => {
    if (settings.camera === 'close') camera.position.set(.65, .48, 1.05);
    else if (settings.camera === 'gameplay') camera.position.set(0, 2.6, -6);
    else camera.position.set(settings.count > 20 ? 8 : 2.5, settings.count > 20 ? 6 : 2, settings.count > 20 ? 10 : 4);
    gpu.root.position.z = settings.camera === 'gameplay' ? 6 : 0;
    camera.lookAt(0, .24, settings.camera === 'gameplay' ? 6 : 0);
    orbit.current?.target.set(0, .24, settings.camera === 'gameplay' ? 6 : 0);
  }, [camera, gpu, settings.camera, settings.count]);
  useFrame(() => {
    if (document.visibilityState === 'hidden') { frameProfiler.interrupt(); return; }
    const begin = performance.now();
    const time = frozen.current ?? (begin - started.current) / 1000;
    gpu.uniforms.uInfantryTime.value = settings.travel ? time % 60 : time;
    if (settings.travel && settings.count === 1 && orbit.current) {
      const distance = (time % 60) * gpu.instances[0].movementSpeed;
      const delta = distance - lastTravel.current; lastTravel.current = distance;
      camera.position.z += delta; orbit.current.target.z += delta; orbit.current.update();
    }
    const matrices = settings.matricesEveryFrame ? gpu.updateMatrices() : 0;
    const jsMs = performance.now() - begin;
    timer.begin(); gl.info.reset(); gl.render(scene, camera); timer.end();
    const counters = { ...gl.info.render, ...gl.info.memory };
    frameProfiler.recordFrame(performance.now(), counters);
    if (view.current) Object.assign(view.current, counters, { time, matrixUpdatesLastFrame: matrices });
    const gpuSample = timer.sequence !== lastGpuSequence.current ? timer.lastMs : null;
    lastGpuSequence.current = timer.sequence;
    samples.current.push({ at: begin, jsMs, matrices, gpuMs: gpuSample });
    if (samples.current.length > 5000) samples.current.splice(0, 1000);
  }, 1);
  const shadows = settings.shadows && runtime.shadowEnabled;
  return <>
    <color attach="background" args={['#171e24']} />
    <hemisphereLight args={['#e7efff', '#343c31', 2.5]} />
    <directionalLight position={[3, 6, 4]} intensity={3} castShadow={shadows}
      shadow-mapSize-width={Math.max(1, runtime.shadowMapSize)} shadow-mapSize-height={Math.max(1, runtime.shadowMapSize)}
      shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9}
      shadow-camera-near={.1} shadow-camera-far={30} shadow-bias={-.00005} shadow-normalBias={.008} />
    <primitive object={gpu.root} />
    {settings.camera === 'gameplay' && <MechReference />}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.002, 0]} receiveShadow={shadows}>
      <planeGeometry args={[70, 70]} /><meshStandardMaterial color="#465054" roughness={.95} />
    </mesh>
    <gridHelper args={[24, 48, '#748389', '#536065']} position={[0, -.001, 0]} />
    <OrbitControls ref={orbit} key={settings.camera + settings.count} target={[0, .24, settings.camera === 'gameplay' ? 6 : 0]} minDistance={.25} maxDistance={50} />
  </>;
}

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function summary(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { p50: percentile(sorted, .5), p95: percentile(sorted, .95), p99: percentile(sorted, .99), samples: sorted.length };
}

export default function InfantryLab() {
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_LAB);
  const [data, setData] = useState<InfantryData | null>(null);
  const [error, setError] = useState('');
  const [display, setDisplay] = useState<RuntimeView | null>(null);
  const [report, setReport] = useState<unknown>(null);
  const [recording, setRecording] = useState(false);
  const view = useRef<RuntimeView | null>(null), samples = useRef<UpdateSample[]>([]);
  const frozen = useRef<number | null>(null), audit = useRef<LabApi['audit']>(() => null);
  useEffect(() => {
    let cancelled = false; let loaded: InfantryData | null = null;
    loadInfantryData().then(value => { loaded = value; if (cancelled) disposeInfantryData(value); else setData(value); }).catch(e => setError(String(e)));
    return () => { cancelled = true; if (loaded) disposeInfantryData(loaded); };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setDisplay(view.current ? { ...view.current } : null), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const api: LabApi = {
      configure(patch) { setSettings(current => ({ ...current, ...patch })); },
      inspect: () => view.current,
      setTime(value) { frozen.current = value; },
      audit: () => audit.current(),
      async capture(warmupMs = 3000, durationMs = 5000) {
        setRecording(true);
        try {
          await new Promise(resolve => setTimeout(resolve, warmupMs));
          const begin = performance.now(); samples.current = [];
          frameProfiler.startCapture(durationMs, begin);
          await new Promise(resolve => setTimeout(resolve, durationMs + 100));
          const capture = frameProfiler.getReport();
          const updates = samples.current.filter(s => s.at >= begin && s.at < begin + durationMs);
          const result = { schemaVersion: 1, lab: 'infantry', settings: view.current?.settings,
            capture, runtime: view.current, scene: audit.current(),
            cpu: { jsUpdateMs: summary(updates.map(s => s.jsMs)), skeletonUpdates: 0,
              instanceMatrixUpdates: updates.reduce((n, s) => n + s.matrices, 0),
              uniformUpdates: updates.length },
            gpuTimeMs: updates.some(s => s.gpuMs != null) ? summary(updates.flatMap(s => s.gpuMs == null ? [] : [s.gpuMs])) : null,
            updateSamples: updates,
            limitations: ['DEVICE QA NOT VERIFIED: no physical phone tested',
              'rAF times include scheduling; JS update excludes render submission',
              'GPU timings are asynchronous query results when the extension is available',
              'Resource byte counts cover owned geometry/atlas/matrices, not total GPU VRAM',
              'In-place benchmark uses authored locomotion clips; root-travel checkbox enables planted-foot preview'],
          };
          setReport(result); return result;
        } finally { setRecording(false); }
      },
    };
    window.__infantryLab = api;
    return () => { delete window.__infantryLab; frameProfiler.setEnabled(false); };
  }, []);
  const update = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) => setSettings(s => ({ ...s, [key]: value }));
  const stats = frameProfiler.getLive().stats;
  return <div className="infantry-lab">
    <header><span className="lab-kicker">GAUNTLET / OBJECT 316</span><h1>INFANTRY GPU ANIMATION LAB</h1>
      <p>Original Tripo mesh · 1.8 m / 0.48 units · baked bone texture · isolated from the mission</p><a href="?demo=infantry" style={{ color: '#e4bd68', fontSize: 12 }}>Полигон: побегать и примерить экипировку ↗</a></header>
    <main>{data ? <Canvas shadows camera={{ position: [2.5, 2, 4], fov: 42, near: .01, far: 150 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <Stage data={data} settings={settings} view={view} samples={samples} frozen={frozen} audit={audit} />
    </Canvas> : <div className="lab-loading">{error || 'Loading original infantry and animation atlas…'}</div>}</main>
    <aside>
      <label>INSTANCES<div className="lab-buttons">{([1, 20, 100, 200] as const).map(count => <button key={count} className={settings.count === count ? 'active' : ''} onClick={() => update('count', count)}>{count}</button>)}</div></label>
      <label>ANIMATION<select value={settings.animation} onChange={e => update('animation', e.target.value as LabSettings['animation'])}>{[...ANIMATIONS, 'mixed'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>BATCH CONFIGURATION<select value={settings.batches} onChange={e => update('batches', +e.target.value as 1 | 10)}><option value="1">A — one batch</option><option value="10">B — up to 10 × 20</option></select></label>
      <label>MECHAGAME QUALITY<select value={settings.preset} onChange={e => update('preset', e.target.value as LabSettings['preset'])}>{['low', 'balanced', 'high', 'ultra'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>CAMERA<select value={settings.camera} onChange={e => update('camera', e.target.value as LabSettings['camera'])}><option value="close">Close inspection</option><option value="medium">Formation</option><option value="gameplay">Mech-height viewpoint</option></select></label>
      {(['individualPhases', 'shadows', 'travel', 'matricesEveryFrame'] as const).map((key, i) => <label className="lab-check" key={key}><input type="checkbox" checked={settings[key]} onChange={e => update(key, e.target.checked)} />{['Individual phases / speeds', 'Animated shadows (preset dependent)', 'Root travel — 60 s inspection lane', 'Upload all matrices every frame (comparison)'][i]}</label>)}
      <button disabled={recording || !data} onClick={() => void window.__infantryLab?.capture()}>{recording ? 'CAPTURING…' : 'WARM UP + CAPTURE 5 S'}</button>
      <button disabled={!report} onClick={() => download('infantry-report.json', JSON.stringify(report, null, 2), 'application/json')}>SAVE JSON</button>
      <button disabled={!report} onClick={() => {
        const r = report as { capture?: { frames: Array<Record<string, number>> } };
        const frames = r.capture?.frames ?? []; const keys = Object.keys(frames[0] ?? {});
        download('infantry-frames.csv', [keys.join(','), ...frames.map(f => keys.map(k => f[k]).join(','))].join('\n'), 'text/csv');
      }}>SAVE CSV</button>
      <section><b>{stats.fps.toFixed(1)} FPS</b><span>p50 / p95 / p99: {stats.p50Ms.toFixed(1)} / {stats.p95Ms.toFixed(1)} / {stats.p99Ms.toFixed(1)} ms</span>
        <span>{display?.calls ?? 0} draw calls · {display?.triangles ?? 0} triangles</span>
        <span>CPU skeletons: 0 · matrices/frame: {display?.matrixUpdatesLastFrame ?? 0}</span>
        <span>Atlas: {data ? (data.binary.byteLength / 1024).toFixed(1) : '—'} KiB · 14 bones</span>
        <span>{String(display?.capabilities.renderer ?? 'Detecting renderer…')}</span></section>
    </aside>
    <footer>Drag to orbit · wheel to inspect · grid spacing 0.5 units = 1.875 m · no AI or combat simulation<br />DEVICE QA NOT VERIFIED — software WebGL results are not smartphone performance.</footer>
  </div>;
}
