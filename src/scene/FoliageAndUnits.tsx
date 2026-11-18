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
      <PineForest
        sunPos={sunPos}
        isSoftwareGl={simplified}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        combatRef={combatRef}
      />
      {showDecorativeFoliage && <GrassBushAccents isSoftwareGl={simplified} />}
      {showDecorativeFoliage && <GrassField
        data={grassMap}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        lightingPreset={lightingPreset}
        sunPos={sunPos}
        isSoftwareGl={simplified}
      />}
      <RockOutcrops />
      {showDecorativeFoliage && <HangingVines isSoftwareGl={simplified} />}
      <FlankCoverZone />
      <PatrolConvoy visible={showUnits} isSoftwareGl={isSoftwareGl} />
      <AtmosphereMist visible={mistVisible} isSoftwareGl={isSoftwareGl} />
      <CanyonWaterfalls
        lightingPreset={lightingPreset}
        showMist={mistVisible}
        isSoftwareGl={isSoftwareGl}
      />
      {showDecorativeFoliage && <SkyBirds lightingPreset={lightingPreset} isSoftwareGl={isSoftwareGl} />}
    </group>
  );
}
