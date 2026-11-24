import type * as React from 'react';
import { useThree } from '@react-three/fiber';
import { PineForest } from './objects/PineForest';
import { GrassField } from './objects/GrassField';
import { GrassBushAccents } from './objects/GrassBushAccents';
import { RockOutcrops } from './objects/RockOutcrops';
import { PatrolConvoy } from './objects/PatrolConvoy';
import { AtmosphereMist } from './objects/AtmosphereMist';
import { CanyonWaterfalls } from './objects/CanyonWaterfalls';
import { SkyBirds } from './objects/SkyBirds';
import { HangingVines } from './objects/HangingVines';
import { FlankCoverZone } from './zones/FlankCoverZone';
import type { LightingPreset } from '../map/sectors';
import type { MechTelemetrySnapshot } from '../map/mechKinematics';
import type { CombatSimulationState } from '../game/combatTypes';
import type { VegetationQuality, AtmosphereQuality } from '../game/graphicsSettings';

interface FoliageAndUnitsProps {
  stage:number;
  grassMap: Uint8Array<ArrayBuffer> | null;
  showUnits: boolean;
  showMist: boolean;
  vegetation: VegetationQuality;
  atmosphere: AtmosphereQuality;
  isSoftwareGl: boolean;
  driveMode: boolean;
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  combatRef: React.MutableRefObject<CombatSimulationState>;
}

export function FoliageAndUnits({
  stage,
  grassMap,
  showUnits,
  showMist,
  vegetation,
  atmosphere,
  isSoftwareGl,
  driveMode,
  lightingPreset,
  sunPos,
  mechPoseRef,
  combatRef,
}: FoliageAndUnitsProps) {
  const gl = useThree(state => state.gl);
  const coverAndWaterfallsVisible = stage >= 9;
  const prepareCoverAndWaterfalls = stage >= 7 && !coverAndWaterfallsVisible && driveMode && !isSoftwareGl
    && gl.extensions.has('KHR_parallel_shader_compile');
  const simplified = isSoftwareGl || vegetation !== 'full';
  const showDecorativeFoliage = vegetation !== 'minimal';
  const mistVisible = showMist && atmosphere !== 'off';
  // PineForest is always present: its trees participate in gameplay.
  // Only decorative grass, small bushes and vines are optional.
  return (
    <group>
      {stage >= 7 && <PineForest
        sunPos={sunPos}
        isSoftwareGl={simplified}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        combatRef={combatRef}
      />}
      {showDecorativeFoliage && stage >= 8 && <GrassBushAccents isSoftwareGl={simplified} />}
      {showDecorativeFoliage && stage >= 8 && grassMap && <GrassField
        data={grassMap}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        lightingPreset={lightingPreset}
        sunPos={sunPos}
        isSoftwareGl={simplified}
      />}
      {stage >= 8 && <RockOutcrops />}
      {showDecorativeFoliage && stage >= 9 && <HangingVines isSoftwareGl={simplified} />}
      {(coverAndWaterfallsVisible || prepareCoverAndWaterfalls) && <FlankCoverZone visible={coverAndWaterfallsVisible} />}
      {stage >= 9 && <PatrolConvoy visible={showUnits} isSoftwareGl={isSoftwareGl} />}
      {stage >= 9 && <AtmosphereMist visible={mistVisible} isSoftwareGl={isSoftwareGl} />}
      {(coverAndWaterfallsVisible || prepareCoverAndWaterfalls) && <CanyonWaterfalls
        visible={coverAndWaterfallsVisible}
        lightingPreset={lightingPreset}
        showMist={mistVisible}
        isSoftwareGl={isSoftwareGl}
      />}
      {showDecorativeFoliage && stage >= 9 && <SkyBirds lightingPreset={lightingPreset} isSoftwareGl={isSoftwareGl} />}
    </group>
  );
}
