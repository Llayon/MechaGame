import type * as React from 'react';
import { PineForest } from './objects/PineForest';
import { GrassField } from './objects/GrassField';
import { RockOutcrops } from './objects/RockOutcrops';
import { PatrolConvoy } from './objects/PatrolConvoy';
import { AtmosphereMist } from './objects/AtmosphereMist';
import { FlankCoverZone } from './zones/FlankCoverZone';
import type { MechTelemetrySnapshot } from '../map/mechKinematics';

interface FoliageAndUnitsProps {
  showUnits: boolean;
  showMist: boolean;
  isSoftwareGl: boolean;
  driveMode: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
}

export function FoliageAndUnits({
  showUnits,
  showMist,
  isSoftwareGl,
  driveMode,
  mechPoseRef,
}: FoliageAndUnitsProps) {
  return (
    <group>
      <PineForest isSoftwareGl={isSoftwareGl} />
      <GrassField
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        isSoftwareGl={isSoftwareGl}
      />
      <RockOutcrops />
      <FlankCoverZone />
      <PatrolConvoy visible={showUnits} isSoftwareGl={isSoftwareGl} />
      <AtmosphereMist visible={showMist} isSoftwareGl={isSoftwareGl} />
    </group>
  );
}
