import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GROUND_LAST_BENCHMARK_ROUTES,
  type GroundLastRouteId,
  summarizeTimingSamples,
} from './renderPerfAndVfxMath';
import {
  GpuFrameTimer,
  type BenchmarkPassResult,
  type GroundLastBenchmarkOptions,
  type GroundLastBenchmarkReport,
  type RouteBenchmarkReport,
  getGroundLastEnabled,
  setGroundLastEnabled,
  syncWaterRipplesToRiver,
} from './renderPerfAndVfx';
import {
  spawnWaterImpact,
  type WaterVfxPoolState,
} from './objects/waterVfxPool';

interface Sector7PerfBridgeProps {
  waterVfxPoolRef: React.MutableRefObject<WaterVfxPoolState>;
}

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

const _savedPos = new THREE.Vector3();
const _savedQuat = new THREE.Quaternion();
const _savedTarget = new THREE.Vector3();
const _benchPos = new THREE.Vector3();
const _benchTarget = new THREE.Vector3();

function nextAnimationFrame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((ts) => resolve(ts));
  });
}

/**
 * Headless console API bridge (`window.__sector7Perf`) for:
 * - Toggling Early-Z Ground Last (`TerrainSurface` renderOrder) at runtime
 * - Running deterministic A/B GPU p50/p95 benchmarks across both canonical routes
 *   (`refinery-citadel` & `open-canyon`) at identical camera pose and resolution
 * - Spawning deterministic river ripples for backlit specular inspection
 *
 * Renders zero DOM / zero HUD elements.
 */
export function Sector7PerfBridge({ waterVfxPoolRef }: Sector7PerfBridgeProps) {
  const { gl, scene, camera, controls, invalidate } = useThree();
  const runningRef = useRef(false);

  useEffect(() => {
    const gpuTimer = new GpuFrameTimer(gl);

    const applyPose = (
      pos: readonly [number, number, number],
      target: readonly [number, number, number],
    ) => {
      camera.position.set(pos[0], pos[1], pos[2]);
      const orbit = controls as unknown as OrbitControlsLike | null;
      if (orbit && orbit.target instanceof THREE.Vector3) {
        orbit.target.set(target[0], target[1], target[2]);
        orbit.update();
      } else {
        camera.lookAt(target[0], target[1], target[2]);
      }
      camera.updateMatrixWorld();
    };

    const runSinglePass = async (
      routeId: GroundLastRouteId,
      groundLast: boolean,
      warmupFrames: number,
      framesPerPass: number,
    ): Promise<BenchmarkPassResult> => {
      const route = GROUND_LAST_BENCHMARK_ROUTES[routeId];
      gpuTimer.clearPending();
      setGroundLastEnabled(groundLast);
      invalidate();
      // Yield two frames so React commits TerrainSurface renderOrder updates before warmup.
      await nextAnimationFrame();
      await nextAnimationFrame();

      const totalFrames = warmupFrames + framesPerPass;
      const frameSamples: number[] = [];
      const gpuSamples: number[] = [];

      for (let f = 0; f < totalFrames; f++) {
        const isWarmup = f < warmupFrames;
        const t = isWarmup
          ? 0
          : framesPerPass <= 1
            ? 0
            : (f - warmupFrames) / (framesPerPass - 1);

        _benchPos.set(
          route.start.pos[0] + (route.end.pos[0] - route.start.pos[0]) * t,
          route.start.pos[1] + (route.end.pos[1] - route.start.pos[1]) * t,
          route.start.pos[2] + (route.end.pos[2] - route.start.pos[2]) * t,
        );
        _benchTarget.set(
          route.start.target[0] + (route.end.target[0] - route.start.target[0]) * t,
          route.start.target[1] + (route.end.target[1] - route.start.target[1]) * t,
          route.start.target[2] + (route.end.target[2] - route.start.target[2]) * t,
        );

        applyPose(
          [_benchPos.x, _benchPos.y, _benchPos.z],
          [_benchTarget.x, _benchTarget.y, _benchTarget.z],
        );

        if (!isWarmup && gpuTimer.hasGpuTimer) {
          gpuTimer.begin();
        }
        const t0 = performance.now();
        gl.render(scene, camera);
        const dtMs = performance.now() - t0;
        if (!isWarmup && gpuTimer.hasGpuTimer) {
          gpuTimer.end();
        }

        if (!isWarmup) {
          frameSamples.push(dtMs);
          if (gpuTimer.hasGpuTimer) {
            gpuTimer.poll(gpuSamples);
          }
        }
        await nextAnimationFrame();
      }

      if (gpuTimer.hasGpuTimer && gpuTimer.pendingCount > 0) {
        gl.getContext().flush();
        const drainStart = performance.now();
        while (gpuTimer.pendingCount > 0 && performance.now() - drainStart < 4000) {
          gpuTimer.poll(gpuSamples);
          if (gpuTimer.pendingCount === 0) break;
          await nextAnimationFrame();
        }
        gpuTimer.clearPending();
      }

      return {
        groundLast,
        frameTime: summarizeTimingSamples(frameSamples),
        gpuTime: gpuSamples.length > 0 ? summarizeTimingSamples(gpuSamples) : null,
      };
    };

    const runGroundLastBenchmark = async (
      options?: GroundLastBenchmarkOptions,
    ): Promise<GroundLastBenchmarkReport> => {
      if (runningRef.current) {
        throw new Error('Ground-Last benchmark is already running');
      }
      runningRef.current = true;

      const framesPerPass = Math.max(6, Math.min(240, Math.round(options?.framesPerPass ?? 60)));
      const warmupFrames = Math.max(2, Math.min(60, Math.round(options?.warmupFrames ?? 12)));
      const requestedRoutes: GroundLastRouteId[] =
        options?.routes && options.routes.length > 0
          ? options.routes.filter(
              (r): r is GroundLastRouteId => r in GROUND_LAST_BENCHMARK_ROUTES,
            )
          : ['refinery-citadel', 'open-canyon'];

      const originalGroundLast = getGroundLastEnabled();
      _savedPos.copy(camera.position);
      _savedQuat.copy(camera.quaternion);
      const orbit = controls as unknown as OrbitControlsLike | null;
      const hasOrbit = Boolean(orbit && orbit.target instanceof THREE.Vector3);
      if (hasOrbit && orbit) {
        _savedTarget.copy(orbit.target);
      }

      const routeReports: RouteBenchmarkReport[] = [];

      try {
        for (const routeId of requestedRoutes) {
          const baseline = await runSinglePass(routeId, false, warmupFrames, framesPerPass);
          const groundLast = await runSinglePass(routeId, true, warmupFrames, framesPerPass);
          const useGpu = baseline.gpuTime !== null && groundLast.gpuTime !== null;
          const baseSummary = useGpu ? baseline.gpuTime! : baseline.frameTime;
          const optSummary = useGpu ? groundLast.gpuTime! : groundLast.frameTime;

          routeReports.push({
            route: routeId,
            label: GROUND_LAST_BENCHMARK_ROUTES[routeId].label,
            baseline,
            groundLast,
            deltaP50Ms: optSummary.p50Ms - baseSummary.p50Ms,
            deltaP95Ms: optSummary.p95Ms - baseSummary.p95Ms,
            metric: useGpu ? 'gpu' : 'frame',
          });
        }
      } finally {
        setGroundLastEnabled(originalGroundLast);
        camera.position.copy(_savedPos);
        camera.quaternion.copy(_savedQuat);
        if (hasOrbit && orbit) {
          orbit.target.copy(_savedTarget);
          orbit.update();
        }
        camera.updateMatrixWorld();
        invalidate();
        runningRef.current = false;
      }

      const drawSize = gl.getDrawingBufferSize(new THREE.Vector2());
      const report: GroundLastBenchmarkReport = {
        width: drawSize.x,
        height: drawSize.y,
        pixelRatio: gl.getPixelRatio(),
        timerMode:
          routeReports.every((r) => r.metric === 'gpu') && routeReports.length > 0
            ? 'EXT_disjoint_timer_query_webgl2'
            : 'frame-wall-clock',
        routes: routeReports,
      };

      console.table(
        routeReports.map((r) => {
          const b = r.metric === 'gpu' ? r.baseline.gpuTime! : r.baseline.frameTime;
          const g = r.metric === 'gpu' ? r.groundLast.gpuTime! : r.groundLast.frameTime;
          return {
            route: r.route,
            metric: r.metric,
            base_p50_ms: Number(b.p50Ms.toFixed(3)),
            groundLast_p50_ms: Number(g.p50Ms.toFixed(3)),
            delta_p50_ms: Number(r.deltaP50Ms.toFixed(3)),
            base_p95_ms: Number(b.p95Ms.toFixed(3)),
            groundLast_p95_ms: Number(g.p95Ms.toFixed(3)),
            delta_p95_ms: Number(r.deltaP95Ms.toFixed(3)),
          };
        }),
      );

      return report;
    };

    const spawnTestRipple = (x = -24, z = 50, intensity = 1.75) => {
      const pool = waterVfxPoolRef.current;
      const beforeCursor = pool.rippleCursor;
      spawnWaterImpact(pool, x, z, intensity);
      const spawned = pool.ripples[beforeCursor % pool.ripples.length];
      if (spawned && spawned.active) {
        // Seed past the zero-alpha birth frame so both live and on-demand frames show the crest clearly.
        spawned.age = Math.min(spawned.maxAge * 0.16, 0.22);
      }
      syncWaterRipplesToRiver(pool, camera.position.x, camera.position.z);
      invalidate();
      return { x, z, intensity };
    };

    window.__sector7Perf = {
      getGroundLast: getGroundLastEnabled,
      setGroundLast: (enabled: boolean) => {
        setGroundLastEnabled(enabled);
        invalidate();
        return getGroundLastEnabled();
      },
      setCameraPose: (pos, target) => {
        applyPose(pos, target);
        invalidate();
      },
      spawnTestRipple,
      runGroundLastBenchmark,
      routes: GROUND_LAST_BENCHMARK_ROUTES,
    };

    return () => {
      gpuTimer.dispose();
      delete window.__sector7Perf;
    };
  }, [gl, scene, camera, controls, invalidate, waterVfxPoolRef]);

  return null;
}
