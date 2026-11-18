import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { GraphicsSettings } from '../game/graphicsSettings';
import { AdaptiveFrameWindow } from './adaptiveQuality';
import { readWorldLod } from './worldLod';

const detail = { low: 0.58, balanced: 0.8, high: 1, ultra: 1.3 };
const shadow = { off: 0, low: 0.7, high: 1, ultra: 1.25 };

export function WorldLodDriver({ settings, step, changeStep, paused }: {
  settings: GraphicsSettings; step: number; changeStep: (next: number) => void; paused: boolean;
}) {
  const sampler = useMemo(() => new AdaptiveFrameWindow(), []);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    sampler.reset();
    invalidate();
  }, [settings, paused, sampler, invalidate]);
  useFrame(({camera, size, frameloop}, delta) => {
    const view = readWorldLod(camera);
    view.focalPixels = 0.5 * size.height * camera.projectionMatrix.elements[5];
    view.detailScale = detail[settings.objectDetail] * (step >= 3 ? 0.7 : 1);
    view.shadowScale = shadow[settings.shadows] * (step >= 2 ? 0.6 : 1);
    if (paused || !settings.autoQuality || frameloop !== 'always' || document.hidden) {
      sampler.reset();
      return;
    }
    const next = sampler.sample(delta, settings.targetFps, step);
    if (next !== step) changeStep(next);
  }, -90);
  return null;
}
