import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { frameProfiler } from './frameMetrics';
import type { GraphicsSettings } from '../game/graphicsSettings';
import { analyzeSceneComplexity } from './sceneComplexity';

interface Props {
  paused: boolean;
  driveMode: boolean;
  lightingPreset: string;
  graphics: GraphicsSettings;
  renderDpr: number;
  shadowMapSize: number;
  isSoftwareGl: boolean;
  benchmarkContinuousFrames: boolean;
}

/** Invisible profiling adapter: measurements only, with no scene or gameplay mutations. */
export function ScenePerformanceProbe({
  paused, driveMode, lightingPreset, graphics, renderDpr, shadowMapSize,
  isSoftwareGl, benchmarkContinuousFrames,
}: Props) {
  const { gl, scene } = useThree();

  useEffect(() => {
    // Explicit request only: traversing thousands of meshes on every frame
    // would itself distort the performance measurements.
    window.__mechaSceneAudit = () => analyzeSceneComplexity(scene);
    return () => { delete window.__mechaSceneAudit; };
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
      renderDpr,
      shadowMapSize,
      vegetation: graphics.vegetation,
      particles: graphics.particles,
      atmosphere: graphics.atmosphere,
    });
  }, [gl, driveMode, lightingPreset, graphics, renderDpr, shadowMapSize,
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
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    });
  });
  return null;
}
