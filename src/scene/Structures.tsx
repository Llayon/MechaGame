import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { LightingPreset, SectorId } from '../map/sectors';
import { createCorrugatedTexture, createHelipadTexture } from './textures';
import { getInteriorWindowMaterial } from './visualPolish';
import { AirfieldZone } from './zones/AirfieldZone';
import { RefineryIslandZone } from './zones/RefineryIslandZone';
import { CitadelZone } from './zones/CitadelZone';
import { QuarryAndPassZone } from './zones/QuarryAndPassZone';
import { HorizonLandmarks } from './objects/HorizonLandmarks';
import { WindTurbines } from './objects/WindTurbines';
import { HorizonWarSystem } from './objects/HorizonWarSystem';
import { TitanWrecks } from './objects/TitanWrecks';

interface StructuresProps {
  prepareHorizonEffects: boolean;
  stage:number;
  quarryDetails:boolean;
  splitBridgeBatches: boolean;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  preparingBattle: boolean;
  distantWar: boolean;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function Structures({
  stage, quarryDetails, prepareHorizonEffects,
  splitBridgeBatches,
  lightingPreset,
  driveMode,
  preparingBattle,
  distantWar,
  isSoftwareGl,
  onSelectSector,
}: StructuresProps) {
  const { gl, camera, scene } = useThree();
  const refinery = useRef<Group>(null);
  const prepareRefinery = stage === 2 && (preparingBattle || driveMode) && !isSoftwareGl
    && gl.extensions.has('KHR_parallel_shader_compile');
  const horizonVisible = stage >= 5;
  const prepareHorizon = stage === 4 && driveMode && !isSoftwareGl && gl.extensions.has('KHR_parallel_shader_compile');
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const helipadTex = useMemo(() => createHelipadTexture(maxAniso), [maxAniso]);
  const corrugatedTex = useMemo(() => createCorrugatedTexture(maxAniso), [maxAniso]);

  useEffect(() => {
    if (!prepareRefinery || !refinery.current) return;
    // Warm each corrugated wall/roof variant and the merged interior windows after batching.
    const windows = getInteriorWindowMaterial();
    const variants = new Set<string>();
    for (const child of refinery.current.children) {
      child.traverseVisible(mesh => {
        if (!(mesh instanceof Mesh) || mesh instanceof InstancedMesh) return;
        const material = mesh.material;
        if (!(material instanceof MeshStandardMaterial)) return;
        if (material !== windows && material.bumpMap !== corrugatedTex) return;
        const key = material.customProgramCacheKey();
        if (variants.has(key)) return;
        variants.add(key);
        void gl.compileAsync(mesh, camera, scene).catch(error => {
          if (!gl.getContext().isContextLost()) console.warn('Refinery shader warmup failed', error);
        });
      });
    }
  }, [prepareRefinery, corrugatedTex, gl, camera, scene]);

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
      {(stage >= 3 || prepareRefinery) && <group name="bake-refinery" ref={refinery} visible={!prepareRefinery}>
        <RefineryIslandZone corrugatedTex={corrugatedTex} onSelectSector={prepareRefinery ? undefined : onSelectSector} />
      </group>}
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
      {(horizonVisible || prepareHorizon) && <HorizonLandmarks visible={horizonVisible} />}
      {(horizonVisible || prepareHorizon) && <TitanWrecks visible={horizonVisible} />}
      {(horizonVisible || prepareHorizon) && <WindTurbines
        visible={horizonVisible} lightingPreset={lightingPreset} isSoftwareGl={isSoftwareGl}
      />}
      {(horizonVisible || prepareHorizonEffects) && distantWar && <HorizonWarSystem
        visible={horizonVisible}
        lightingPreset={lightingPreset}
        driveMode={driveMode}
        isSoftwareGl={isSoftwareGl}
      />}
    </group>
  );
}
