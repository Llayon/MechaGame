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

interface FoliageAndUnitsProps {
  showUnits: boolean;
  showMist: boolean;
  isSoftwareGl: boolean;
  driveMode: boolean;
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  combatRef: React.MutableRefObject<CombatSimulationState>;
}

export function FoliageAndUnits({
  showUnits,
  showMist,
  isSoftwareGl,
  driveMode,
  lightingPreset,
  sunPos,
  mechPoseRef,
  combatRef,
}: FoliageAndUnitsProps) {
  return (
    <group>
      <PineForest
        isSoftwareGl={isSoftwareGl}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        combatRef={combatRef}
      />
      <GrassBushAccents isSoftwareGl={isSoftwareGl} />
      <GrassField
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        lightingPreset={lightingPreset}
        sunPos={sunPos}
        isSoftwareGl={isSoftwareGl}
      />
      <RockOutcrops />
      <HangingVines isSoftwareGl={isSoftwareGl} />
      <FlankCoverZone />
      <PatrolConvoy visible={showUnits} isSoftwareGl={isSoftwareGl} />
      <AtmosphereMist visible={showMist} isSoftwareGl={isSoftwareGl} />
      <CanyonWaterfalls
        lightingPreset={lightingPreset}
        showMist={showMist}
        isSoftwareGl={isSoftwareGl}
      />
      <SkyBirds lightingPreset={lightingPreset} isSoftwareGl={isSoftwareGl} />
    </group>
  );
}
