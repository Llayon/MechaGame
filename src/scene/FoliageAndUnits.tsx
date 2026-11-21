import type * as React from 'react';
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
  grassMap: Uint8Array<ArrayBuffer>;
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
      {showDecorativeFoliage && stage >= 8 && <GrassField
        data={grassMap}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        lightingPreset={lightingPreset}
        sunPos={sunPos}
        isSoftwareGl={simplified}
      />}
      {stage >= 8 && <RockOutcrops />}
      {showDecorativeFoliage && stage >= 9 && <HangingVines isSoftwareGl={simplified} />}
      {stage >= 9 && <FlankCoverZone />}
      {stage >= 9 && <PatrolConvoy visible={showUnits} isSoftwareGl={isSoftwareGl} />}
      {stage >= 9 && <AtmosphereMist visible={mistVisible} isSoftwareGl={isSoftwareGl} />}
      {stage >= 9 && <CanyonWaterfalls
        lightingPreset={lightingPreset}
        showMist={mistVisible}
        isSoftwareGl={isSoftwareGl}
      />}
      {showDecorativeFoliage && stage >= 9 && <SkyBirds lightingPreset={lightingPreset} isSoftwareGl={isSoftwareGl} />}
    </group>
  );
}
