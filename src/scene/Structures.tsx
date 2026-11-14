import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { LightingPreset, SectorId } from '../map/sectors';
import { createCorrugatedTexture, createHelipadTexture } from './textures';
import { AirfieldZone } from './zones/AirfieldZone';
import { RefineryIslandZone } from './zones/RefineryIslandZone';
import { CitadelZone } from './zones/CitadelZone';
import { QuarryAndPassZone } from './zones/QuarryAndPassZone';

interface StructuresProps {
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function Structures({
  lightingPreset,
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
      <AirfieldZone
        helipadTex={helipadTex}
        corrugatedTex={corrugatedTex}
        isSoftwareGl={isSoftwareGl}
        onSelectSector={onSelectSector}
      />
      <RefineryIslandZone
        corrugatedTex={corrugatedTex}
        onSelectSector={onSelectSector}
      />
      <CitadelZone
        corrugatedTex={corrugatedTex}
        lightingPreset={lightingPreset}
        isSoftwareGl={isSoftwareGl}
        onSelectSector={onSelectSector}
      />
      <QuarryAndPassZone
        lightingPreset={lightingPreset}
        isSoftwareGl={isSoftwareGl}
        onSelectSector={onSelectSector}
      />
    </group>
  );
}
