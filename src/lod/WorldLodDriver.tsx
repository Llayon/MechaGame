import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { GraphicsSettings } from '../game/graphicsSettings';
import {
  AdaptiveDrsController,
  type AdaptiveState,
} from './adaptiveQuality';
import { readWorldLod } from './worldLod';

const detail = { low: 0.58, balanced: 0.8, high: 1, ultra: 1.3 };
const shadow = { off: 0, low: 0.7, high: 1, ultra: 1.25 };

interface WorldLodDriverProps {
  settings: GraphicsSettings;
  adaptation: AdaptiveState;
  onAdaptationChange: (next: AdaptiveState) => void;
  resetNonce: number;
  paused: boolean;
}

export function WorldLodDriver({
  settings,
  adaptation,
  onAdaptationChange,
  resetNonce,
  paused,
}: WorldLodDriverProps) {
  const controller = useMemo(() => new AdaptiveDrsController(), []);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    controller.resetAll();
    invalidate();
  }, [settings, resetNonce, controller, invalidate]);

  useEffect(() => {
    controller.resetWindow();
    invalidate();
  }, [paused, controller, invalidate]);

  useFrame(({ camera, size, frameloop }, delta) => {
    const view = readWorldLod(camera);
    const activeCascade = settings.autoQuality ? adaptation.cascadeStep : 0;
    view.focalPixels = 0.5 * size.height * camera.projectionMatrix.elements[5];
    view.shadowScale = shadow[settings.shadows] * (activeCascade >= 1 ? 0.6 : 1);
    view.detailScale = detail[settings.objectDetail] * (activeCascade >= 2 ? 0.7 : 1);

    if (paused || !settings.autoQuality || frameloop !== 'always' || document.hidden) {
      controller.resetWindow();
      return;
    }

    const next = controller.sample(
      delta,
      settings.targetFps,
      settings.resolutionScale,
      adaptation,
    );
    if (next !== adaptation) {
      onAdaptationChange(next);
    }
  }, -90);

  return null;
}
