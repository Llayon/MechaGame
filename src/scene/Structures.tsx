import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { LightingPreset, SectorId } from '../map/sectors';
import { createCorrugatedTexture, createHelipadTexture } from './textures';
import { AirfieldZone } from './zones/AirfieldZone';
import { RefineryIslandZone } from './zones/RefineryIslandZone';
import { CitadelZone } from './zones/CitadelZone';
import { QuarryAndPassZone } from './zones/QuarryAndPassZone';
import { HorizonLandmarks } from './objects/HorizonLandmarks';
import { WindTurbines } from './objects/WindTurbines';
import { HorizonWarSystem } from './objects/HorizonWarSystem';
import { TitanWrecks } from './objects/TitanWrecks';

interface StructuresProps {
  stage:number;
  quarryDetails:boolean;
  splitBridgeBatches: boolean;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  distantWar: boolean;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function Structures({
  stage, quarryDetails,
  splitBridgeBatches,
  lightingPreset,
  driveMode,
  distantWar,
  isSoftwareGl,
  onSelectSector,
}: StructuresProps) {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const helipadTex = useMemo(() => createHelipadTexture(maxAniso), [maxAniso]);
  const corrugatedTex = useMemo(() => createCorrugatedTexture(maxAniso), [maxAniso]);

  useEffect(() => {
    return () => {
      helipadTex.dispose();
      corrugatedTex.dispose();
    };
  }, [helipadTex, corrugatedTex]);

  return (
    <group>
      {stage >= 1 && <group name="bake-airfield"><AirfieldZone
        helipadTex={helipadTex}
        corrugatedTex={corrugatedTex}
        isSoftwareGl={isSoftwareGl}
        onSelectSector={onSelectSector}
      /></group>}
      {stage >= 3 && <group name="bake-refinery"><RefineryIslandZone
        corrugatedTex={corrugatedTex}
        onSelectSector={onSelectSector}
      /></group>}
      {stage >= 4 && <group name="bake-citadel"><CitadelZone
        corrugatedTex={corrugatedTex}
        lightingPreset={lightingPreset}
        isSoftwareGl={isSoftwareGl}
        onSelectSector={onSelectSector}
      /></group>}
      {stage >= 2 && <QuarryAndPassZone details={quarryDetails}
        splitBridgeBatches={splitBridgeBatches}
        lightingPreset={lightingPreset}
        isSoftwareGl={isSoftwareGl}
        onSelectSector={onSelectSector}
      />}
      {stage >= 5 && <HorizonLandmarks />}
      {stage >= 5 && <TitanWrecks />}
      {stage >= 5 && <WindTurbines lightingPreset={lightingPreset} isSoftwareGl={isSoftwareGl} />}
      {stage >= 5 && distantWar && <HorizonWarSystem
        lightingPreset={lightingPreset}
        driveMode={driveMode}
        isSoftwareGl={isSoftwareGl}
      />}
    </group>
  );
}
