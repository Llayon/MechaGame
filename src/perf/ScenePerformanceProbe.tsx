import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { frameProfiler } from './frameMetrics';

interface Props {
  paused: boolean;
  driveMode: boolean;
  lightingPreset: string;
  isSoftwareGl: boolean;
  benchmarkContinuousFrames: boolean;
}

/** Invisible profiling adapter: measurements only, with no scene or gameplay mutations. */
export function ScenePerformanceProbe({
  paused, driveMode, lightingPreset, isSoftwareGl, benchmarkContinuousFrames,
}: Props) {
  const { gl } = useThree();

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
    });
  }, [gl, driveMode, lightingPreset, isSoftwareGl, benchmarkContinuousFrames]);

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
