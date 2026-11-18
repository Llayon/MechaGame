import { useEffect, useRef } from 'react';
import { readWorldLod } from '../lod/worldLod';
import { showLodColors } from '../lod/debugColors';
import { useFrame, useThree } from '@react-three/fiber';
import { frameProfiler } from './frameMetrics';
import type { GraphicsSettings } from '../game/graphicsSettings';
import { analyzeSceneComplexity } from './sceneComplexity';

interface Props {
  paused: boolean;
  driveMode: boolean;
  lightingPreset: string;
  graphics: GraphicsSettings;
  adaptiveStep: number;
  renderDpr: number;
  shadowMapSize: number;
  isSoftwareGl: boolean;
  benchmarkContinuousFrames: boolean;
}

/** Invisible profiling adapter: measurements only, with no scene or gameplay mutations. */
export function ScenePerformanceProbe({
  paused, driveMode, lightingPreset, graphics, adaptiveStep, renderDpr, shadowMapSize,
  isSoftwareGl, benchmarkContinuousFrames,
}: Props) {
  const { gl, scene, camera, invalidate } = useThree();
  const shadow = useRef({ calls: 0, triangles: 0 });

  useEffect(() => {
    const original = gl.shadowMap.render;
    gl.shadowMap.render = function(lights, world, cam) {
      if (!frameProfiler.enabled) return original.call(this, lights, world, cam);
      const info = gl.info.render;
      const calls = info.calls, triangles = info.triangles;
      original.call(this, lights, world, cam);
      shadow.current.calls = info.calls - calls;
      shadow.current.triangles = info.triangles - triangles;
    };
    let restore: (() => void) | undefined;
    const toggle = (event: Event) => {
      const enabled = Boolean((event as CustomEvent<boolean>).detail);
      readWorldLod(camera).debug = enabled;
      restore?.();
      restore = enabled ? showLodColors(gl) : undefined;
      invalidate();
    };
    window.addEventListener('mecha-lod-debug', toggle);
    return () => {
      gl.shadowMap.render = original;
      readWorldLod(camera).debug = false;
      restore?.();
      window.removeEventListener('mecha-lod-debug', toggle);
    };
  }, [gl, camera, invalidate]);

  useEffect(() => {
    // Explicit request only: traversing thousands of meshes on every frame
    // would itself distort the performance measurements.
    window.__mechaSceneAudit = () => analyzeSceneComplexity(scene);
    frameProfiler.inventoryAtCaptureEnd = window.__mechaSceneAudit;
    return () => { delete window.__mechaSceneAudit; delete frameProfiler.inventoryAtCaptureEnd; };
  }, [scene]);

  useEffect(() => {
    const context = gl.getContext();
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug
      ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER));
    frameProfiler.setEnvironment({
      renderer,
      webglVersion: String(context.getParameter(context.VERSION)),
      softwareMode: isSoftwareGl,
      benchmarkContinuousFrames,
      scenario: driveMode ? 'combat' : 'overview',
      lighting: lightingPreset,
      graphicsPreset: graphics.preset,
      objectDetail: graphics.objectDetail,
      autoQuality: graphics.autoQuality,
      targetFps: graphics.targetFps,
      adaptiveStep,
      renderDpr,
      shadowMapSize,
      vegetation: graphics.vegetation,
      particles: graphics.particles,
      atmosphere: graphics.atmosphere,
    });
  }, [gl, driveMode, lightingPreset, graphics, adaptiveStep, renderDpr, shadowMapSize,
    isSoftwareGl, benchmarkContinuousFrames]);

  useFrame(() => {
    if (paused) {
      frameProfiler.interrupt();
      return;
    }
    if (!frameProfiler.enabled || document.visibilityState === 'hidden') {
      frameProfiler.interrupt();
      return;
    }
    const info = gl.info;
    frameProfiler.recordFrame(performance.now(), {
      calls: info.render.calls,
      shadowCalls: shadow.current.calls,
      shadowTriangles: shadow.current.triangles,
      mainCalls: info.render.calls - shadow.current.calls,
      mainTriangles: info.render.triangles - shadow.current.triangles,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    });
  });
  return null;
}
