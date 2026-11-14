import { PineForest } from './objects/PineForest';
import { RockOutcrops } from './objects/RockOutcrops';
import { PatrolConvoy } from './objects/PatrolConvoy';
import { AtmosphereMist } from './objects/AtmosphereMist';
import { FlankCoverZone } from './zones/FlankCoverZone';

interface FoliageAndUnitsProps {
  showUnits: boolean;
  showMist: boolean;
  isSoftwareGl: boolean;
}

export function FoliageAndUnits({
  showUnits,
  showMist,
  isSoftwareGl,
}: FoliageAndUnitsProps) {
  return (
    <group>
      <PineForest isSoftwareGl={isSoftwareGl} />
      <RockOutcrops />
      <FlankCoverZone />
      <PatrolConvoy visible={showUnits} isSoftwareGl={isSoftwareGl} />
      <AtmosphereMist visible={showMist} isSoftwareGl={isSoftwareGl} />
    </group>
  );
}
